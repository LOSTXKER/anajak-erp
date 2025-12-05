/**
 * Design & Approval Service (Prisma)
 * API calls สำหรับจัดการ Design Versions และ Approvals
 */

import prisma from '@/lib/prisma'
import type { 
  DesignVersion, 
  CreateDesignVersionInput,
  ApproveDesignInput,
  RejectDesignInput,
  ApprovalGate,
  CreateApprovalGateInput,
  RevisionCostCalculation
} from './types'

/**
 * ดึงรายการ Design Versions ของ OrderItem
 */
export async function getDesignVersionsByOrderItem(orderItemId: string): Promise<DesignVersion[]> {
  const versions = await prisma.designVersion.findMany({
    where: { orderItemId },
    orderBy: { versionNumber: 'desc' }
  })

  return versions.map(mapPrismaToDesignVersion)
}

/**
 * ดึง Design Version ปัจจุบัน
 */
export async function getCurrentDesignVersion(orderItemId: string): Promise<DesignVersion | null> {
  const version = await prisma.designVersion.findFirst({
    where: { 
      orderItemId,
      isCurrentVersion: true 
    }
  })

  return version ? mapPrismaToDesignVersion(version) : null
}

/**
 * สร้าง Design Version ใหม่
 */
export async function createDesignVersion(input: CreateDesignVersionInput): Promise<DesignVersion> {
  // หาเวอร์ชันล่าสุด
  const latestVersion = await prisma.designVersion.findFirst({
    where: { orderItemId: input.order_item_id },
    orderBy: { versionNumber: 'desc' }
  })

  const newVersionNumber = (latestVersion?.versionNumber || 0) + 1

  // ตรวจสอบว่าเกิน free revisions หรือไม่
  const order = await prisma.orderItem.findUnique({
    where: { id: input.order_item_id },
    include: { order: true }
  })

  const isBillable = newVersionNumber > (order?.order.freeRevisions || 2)
  const revisionFee = isBillable ? 500 : 0 // ค่าแก้ไขครั้งละ 500 บาท

  // ปิด current version เก่า
  await prisma.designVersion.updateMany({
    where: { 
      orderItemId: input.order_item_id,
      isCurrentVersion: true 
    },
    data: { isCurrentVersion: false }
  })

  // สร้างเวอร์ชันใหม่
  const version = await prisma.designVersion.create({
    data: {
      orderItemId: input.order_item_id,
      versionNumber: newVersionNumber,
      designFiles: input.design_files,
      mockupUrl: input.mockup_url || null,
      status: 'submitted',
      uploadedBy: input.uploaded_by || null,
      revisionNotes: input.revision_notes || null,
      isCurrentVersion: true,
      isBillable,
      revisionFee,
    }
  })

  // อัปเดต revision count ในออเดอร์
  if (order) {
    await prisma.order.update({
      where: { id: order.order.id },
      data: { 
        revisionCount: newVersionNumber,
        allDesignsApproved: false // รีเซ็ตสถานะอนุมัติ
      }
    })
  }

  return mapPrismaToDesignVersion(version)
}

/**
 * อนุมัติ Design Version
 */
export async function approveDesignVersion(input: ApproveDesignInput): Promise<DesignVersion> {
  const version = await prisma.designVersion.update({
    where: { id: input.design_version_id },
    data: {
      status: 'approved',
      approvedBy: input.approved_by,
      approvedAt: new Date(),
    }
  })

  // ตรวจสอบว่า OrderItem นี้มี design versions ที่ยังไม่ approved หรือไม่
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: version.orderItemId },
    include: { 
      order: true,
      designVersions: {
        where: { isCurrentVersion: true }
      }
    }
  })

  if (orderItem) {
    // อัปเดต OrderItem design status
    await prisma.orderItem.update({
      where: { id: version.orderItemId },
      data: { designStatus: 'approved' }
    })

    // ตรวจสอบว่าทุก items ในออเดอร์อนุมัติหมดหรือยัง
    const allItems = await prisma.orderItem.findMany({
      where: { orderId: orderItem.orderId }
    })

    const allApproved = allItems.every(item => item.designStatus === 'approved')

    if (allApproved) {
      await prisma.order.update({
        where: { id: orderItem.orderId },
        data: { allDesignsApproved: true }
      })
    }
  }

  return mapPrismaToDesignVersion(version)
}

/**
 * ปฏิเสธ Design Version
 */
export async function rejectDesignVersion(input: RejectDesignInput): Promise<DesignVersion> {
  const version = await prisma.designVersion.update({
    where: { id: input.design_version_id },
    data: {
      status: 'rejected',
      rejectedBy: input.rejected_by,
      rejectedAt: new Date(),
      rejectionReason: input.rejection_reason,
    }
  })

  // อัปเดต OrderItem design status
  await prisma.orderItem.update({
    where: { id: version.orderItemId },
    data: { designStatus: 'revision_requested' }
  })

  return mapPrismaToDesignVersion(version)
}

/**
 * คำนวณค่าแก้ไขดีไซน์
 */
export async function calculateRevisionCost(orderId: string): Promise<RevisionCostCalculation> {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  })

  if (!order) {
    throw new Error('Order not found')
  }

  const billableRevisions = Math.max(0, order.revisionCount - order.freeRevisions)
  const revisionFeePerChange = 500 // ฿500 ต่อครั้ง
  const totalRevisionCost = billableRevisions * revisionFeePerChange

  return {
    order_id: orderId,
    current_revision_count: order.revisionCount,
    free_revisions: order.freeRevisions,
    billable_revisions: billableRevisions,
    revision_fee_per_change: revisionFeePerChange,
    total_revision_cost: totalRevisionCost,
    is_over_limit: order.revisionCount > order.freeRevisions
  }
}

/**
 * ดึงรายการ Approval Gates ของ Order
 */
export async function getApprovalGatesByOrder(orderId: string): Promise<ApprovalGate[]> {
  const gates = await prisma.approvalGate.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' }
  })

  return gates.map(mapPrismaToApprovalGate)
}

/**
 * สร้าง Approval Gate ใหม่
 */
export async function createApprovalGate(input: CreateApprovalGateInput): Promise<ApprovalGate> {
  const gate = await prisma.approvalGate.create({
    data: {
      orderId: input.order_id,
      gateType: input.gate_type,
      gateName: input.gate_name,
      status: 'pending',
    }
  })

  return mapPrismaToApprovalGate(gate)
}

/**
 * อนุมัติ Approval Gate
 */
export async function approveGate(gateId: string, approvedBy: string): Promise<ApprovalGate> {
  const gate = await prisma.approvalGate.update({
    where: { id: gateId },
    data: {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    }
  })

  return mapPrismaToApprovalGate(gate)
}

/**
 * Helper: แปลง Prisma DesignVersion model
 */
function mapPrismaToDesignVersion(version: any): DesignVersion {
  return {
    id: version.id,
    order_item_id: version.orderItemId,
    version_number: version.versionNumber,
    design_files: version.designFiles,
    mockup_url: version.mockupUrl,
    status: version.status,
    uploaded_by: version.uploadedBy,
    uploaded_at: version.uploadedAt.toISOString(),
    approved_by: version.approvedBy,
    approved_at: version.approvedAt?.toISOString() || null,
    rejected_by: version.rejectedBy,
    rejected_at: version.rejectedAt?.toISOString() || null,
    rejection_reason: version.rejectionReason,
    revision_notes: version.revisionNotes,
    is_current_version: version.isCurrentVersion,
    is_billable: version.isBillable,
    revision_fee: Number(version.revisionFee),
  }
}

/**
 * Helper: แปลง Prisma ApprovalGate model
 */
function mapPrismaToApprovalGate(gate: any): ApprovalGate {
  return {
    id: gate.id,
    order_id: gate.orderId,
    gate_type: gate.gateType,
    gate_name: gate.gateName,
    status: gate.status,
    approved_by: gate.approvedBy,
    approved_at: gate.approvedAt?.toISOString() || null,
    customer_confirmed_at: gate.customerConfirmedAt?.toISOString() || null,
    customer_ip: gate.customerIp,
    customer_signature: gate.customerSignature,
    notes: gate.notes,
    rejection_reason: gate.rejectionReason,
    created_at: gate.createdAt.toISOString(),
  }
}

