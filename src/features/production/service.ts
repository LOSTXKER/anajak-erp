/**
 * Production Service (Prisma)
 * จัดการระบบผลิต + Priority Queue + QC
 */

import prisma from '@/lib/prisma'
import type {
  ProductionJob,
  CreateProductionJobInput,
  UpdateProductionJobInput,
  QcRecord,
  CreateQcRecordInput,
  PriorityFactors
} from './types'

/**
 * คำนวณ Priority Score อัตโนมัติ
 */
export async function calculatePriorityScore(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true }
  })

  if (!order) return 50 // Default score

  const factors: PriorityFactors = {
    due_date_urgency: 0,
    customer_tier: 0,
    order_value: 0,
    is_delayed: 0,
    manual_priority: order.priorityLevel
  }

  // 1. Due Date Urgency (0-30 คะแนน)
  if (order.dueDate) {
    const daysUntilDue = Math.ceil(
      (order.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysUntilDue < 0) {
      factors.is_delayed = 30  // เลยกำหนดแล้ว!
    } else if (daysUntilDue <= 3) {
      factors.due_date_urgency = 30  // เหลือ 3 วัน
    } else if (daysUntilDue <= 7) {
      factors.due_date_urgency = 20  // เหลือ 7 วัน
    } else if (daysUntilDue <= 14) {
      factors.due_date_urgency = 10  // เหลือ 2 สัปดาห์
    } else {
      factors.due_date_urgency = 5
    }
  }

  // 2. Customer Tier (0-20 คะแนน)
  if (order.customer) {
    const tierScores: Record<string, number> = {
      vip: 20,
      standard: 10,
      new: 5
    }
    factors.customer_tier = tierScores[order.customer.customerTier] || 10
  }

  // 3. Order Value (0-20 คะแนน)
  const orderValue = Number(order.totalAmount)
  if (orderValue > 50000) {
    factors.order_value = 20
  } else if (orderValue > 20000) {
    factors.order_value = 15
  } else if (orderValue > 10000) {
    factors.order_value = 10
  } else {
    factors.order_value = 5
  }

  // Total Score = max 120 points
  const totalScore = 
    factors.due_date_urgency +
    factors.customer_tier +
    factors.order_value +
    factors.is_delayed +
    factors.manual_priority

  return Math.min(100, totalScore) // Cap at 100
}

/**
 * สร้าง Production Job ใหม่
 */
export async function createProductionJob(input: CreateProductionJobInput): Promise<ProductionJob> {
  // Generate job number
  const count = await prisma.productionJob.count()
  const jobNumber = `JOB-${String(count + 1).padStart(6, '0')}`

  // Calculate priority score
  const priorityScore = input.priority_score || await calculatePriorityScore(input.order_id)

  const job = await prisma.productionJob.create({
    data: {
      jobNumber,
      orderId: input.order_id,
      orderItemId: input.order_item_id || null,
      workType: input.work_type,
      workName: input.work_name,
      quantity: input.quantity,
      priorityScore,
      status: 'queued',
    }
  })

  return mapPrismaToProductionJob(job)
}

/**
 * ดึง Production Queue (เรียงตาม Priority)
 */
export async function getProductionQueue(): Promise<ProductionJob[]> {
  const jobs = await prisma.productionJob.findMany({
    where: {
      status: {
        in: ['queued', 'ready', 'in_progress']
      }
    },
    orderBy: [
      { priorityScore: 'desc' },
      { createdAt: 'asc' }
    ],
    take: 50  // Top 50 jobs
  })

  return jobs.map(mapPrismaToProductionJob)
}

/**
 * อัปเดต Production Job
 */
export async function updateProductionJob(input: UpdateProductionJobInput): Promise<ProductionJob> {
  const updateData: any = {}

  if (input.status) {
    updateData.status = input.status
    if (input.status === 'in_progress' && !updateData.startedAt) {
      updateData.startedAt = new Date()
    }
    if (input.status === 'completed') {
      updateData.completedAt = new Date()
    }
  }

  if (input.assigned_to !== undefined) updateData.assignedTo = input.assigned_to
  if (input.actual_quantity !== undefined) updateData.actualQuantity = input.actual_quantity
  if (input.defect_quantity !== undefined) updateData.defectQuantity = input.defect_quantity
  if (input.notes !== undefined) updateData.notes = input.notes

  const job = await prisma.productionJob.update({
    where: { id: input.job_id },
    data: updateData
  })

  return mapPrismaToProductionJob(job)
}

/**
 * สร้าง QC Record
 */
export async function createQcRecord(input: CreateQcRecordInput): Promise<QcRecord> {
  const record = await prisma.qcRecord.create({
    data: {
      productionJobId: input.production_job_id,
      qcStageId: input.qc_stage_id,
      inspectedBy: input.inspected_by,
      inspectedAt: new Date(),
      result: input.result,
      passedQuantity: input.passed_quantity,
      failedQuantity: input.failed_quantity,
      defectTypes: input.defect_types || [],
      notes: input.notes || null,
      photos: input.photos || [],
    }
  })

  // อัปเดต Production Job status
  if (input.result === 'passed') {
    await prisma.productionJob.update({
      where: { id: input.production_job_id },
      data: { status: 'completed' }
    })
  } else if (input.result === 'failed') {
    await prisma.productionJob.update({
      where: { id: input.production_job_id },
      data: { 
        status: 'failed',
        defectQuantity: input.failed_quantity
      }
    })
  }

  return mapPrismaToQcRecord(record)
}

/**
 * ดึง QC Stages ทั้งหมด
 */
export async function getQcStages() {
  const stages = await prisma.qcStage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  })

  return stages
}

/**
 * Helper: แปลง Prisma ProductionJob
 */
function mapPrismaToProductionJob(job: any): ProductionJob {
  return {
    id: job.id,
    job_number: job.jobNumber,
    order_id: job.orderId,
    order_item_id: job.orderItemId,
    work_type: job.workType,
    work_name: job.workName,
    quantity: job.quantity,
    priority_score: job.priorityScore,
    status: job.status,
    assigned_to: job.assignedTo,
    machine_id: job.machineId,
    started_at: job.startedAt?.toISOString() || null,
    completed_at: job.completedAt?.toISOString() || null,
    actual_quantity: job.actualQuantity,
    defect_quantity: job.defectQuantity,
    rework_quantity: job.reworkQuantity,
    notes: job.notes,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
  }
}

/**
 * Helper: แปลง Prisma QcRecord
 */
function mapPrismaToQcRecord(record: any): QcRecord {
  return {
    id: record.id,
    production_job_id: record.productionJobId,
    qc_stage_id: record.qcStageId,
    inspected_by: record.inspectedBy,
    inspected_at: record.inspectedAt?.toISOString() || null,
    result: record.result,
    passed_quantity: record.passedQuantity,
    failed_quantity: record.failedQuantity,
    defect_types: record.defectTypes,
    notes: record.notes,
    photos: record.photos,
    created_at: record.createdAt.toISOString(),
  }
}

