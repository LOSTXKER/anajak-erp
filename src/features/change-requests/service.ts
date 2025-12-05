/**
 * Change Request Service (Prisma)
 * จัดการคำขอเปลี่ยนแปลงออเดอร์
 */

import prisma from '@/lib/prisma'
import type {
  ChangeRequest,
  CreateChangeRequestInput,
  QuoteChangeRequestInput,
  ApproveChangeRequestInput,
  CHANGE_REQUEST_FEES
} from './types'

/**
 * ดึงรายการ Change Requests ของ Order
 */
export async function getChangeRequestsByOrder(orderId: string): Promise<ChangeRequest[]> {
  const requests = await prisma.changeRequest.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' }
  })

  return requests.map(mapPrismaToChangeRequest)
}

/**
 * ดึง Change Request ตาม ID
 */
export async function getChangeRequestById(id: string): Promise<ChangeRequest | null> {
  const request = await prisma.changeRequest.findUnique({
    where: { id }
  })

  return request ? mapPrismaToChangeRequest(request) : null
}

/**
 * สร้าง Change Request ใหม่
 */
export async function createChangeRequest(input: CreateChangeRequestInput): Promise<ChangeRequest> {
  // Generate request number
  const count = await prisma.changeRequest.count()
  const requestNumber = `CR-${String(count + 1).padStart(5, '0')}`

  const request = await prisma.changeRequest.create({
    data: {
      requestNumber,
      orderId: input.order_id,
      orderPhase: input.order_phase,
      changeType: input.change_type,
      description: input.description,
      customerReason: input.customer_reason || null,
      referenceFiles: input.reference_files || [],
      affectedWorkItems: input.affected_work_items || [],
      status: 'pending',
    }
  })

  return mapPrismaToChangeRequest(request)
}

/**
 * คำนวณค่าใช้จ่ายอัตโนมัติ (Auto Cost Calculation)
 */
export async function calculateChangeRequestCost(
  changeType: string,
  orderPhase: string,
  quantityChange?: number
): Promise<{
  base_fee: number
  design_fee: number
  rework_fee: number
  material_fee: number
  total_fee: number
  suggested_days_delayed: number
}> {
  let baseFee = 200  // ค่าดำเนินการพื้นฐาน
  let designFee = 0
  let reworkFee = 0
  let materialFee = 0
  let daysDelayed = 0

  // คำนวณตาม Change Type
  switch (changeType) {
    case 'design_change':
      if (orderPhase === 'design') {
        designFee = 500  // แก้ไขเล็กน้อย
        daysDelayed = 1
      } else if (orderPhase === 'pre_production') {
        designFee = 2000 // แก้ใหญ่
        daysDelayed = 3
      } else {
        designFee = 5000 // ออกแบบใหม่ทั้งหมด
        daysDelayed = 7
      }
      break

    case 'quantity_change':
      materialFee = Math.abs(quantityChange || 0) * 100
      daysDelayed = Math.ceil(Math.abs(quantityChange || 0) / 100) // เพิ่ม 100 ชิ้น = +1 วัน
      break

    case 'spec_change':
      if (orderPhase === 'in_production' || orderPhase === 'post_production') {
        reworkFee = 3000  // ทำใหม่
        materialFee = 1000
        daysDelayed = 5
      } else {
        reworkFee = 1000
        daysDelayed = 2
      }
      break

    case 'add_item':
      designFee = 1000
      materialFee = 500
      daysDelayed = 2
      break

    case 'addon_change':
      baseFee = 100
      daysDelayed = 1
      break

    default:
      baseFee = 500
      daysDelayed = 1
  }

  const totalFee = baseFee + designFee + reworkFee + materialFee

  return {
    base_fee: baseFee,
    design_fee: designFee,
    rework_fee: reworkFee,
    material_fee: materialFee,
    total_fee: totalFee,
    suggested_days_delayed: daysDelayed
  }
}

/**
 * สร้างใบเสนอราคาสำหรับ Change Request
 */
export async function quoteChangeRequest(input: QuoteChangeRequestInput): Promise<ChangeRequest> {
  const totalFee = Number(input.base_fee) + Number(input.design_fee) + Number(input.rework_fee) + Number(input.material_fee)

  const request = await prisma.changeRequest.update({
    where: { id: input.change_request_id },
    data: {
      baseFee: input.base_fee,
      designFee: input.design_fee,
      reworkFee: input.rework_fee,
      materialFee: input.material_fee,
      totalFee,
      daysDelayed: input.days_delayed,
      newDueDate: input.new_due_date ? new Date(input.new_due_date) : null,
      adminNotes: input.admin_notes || null,
      quotedBy: input.quoted_by,
      quotedAt: new Date(),
      status: 'quoted',
    }
  })

  return mapPrismaToChangeRequest(request)
}

/**
 * ลูกค้าอนุมัติ Change Request
 */
export async function approveChangeRequest(input: ApproveChangeRequestInput): Promise<ChangeRequest> {
  const request = await prisma.changeRequest.update({
    where: { id: input.change_request_id },
    data: {
      status: 'approved',
      customerApprovedAt: new Date(),
    }
  })

  // อัปเดต Order due date ถ้ามีการเลื่อน
  if (request.newDueDate) {
    await prisma.order.update({
      where: { id: request.orderId },
      data: {
        dueDate: request.newDueDate
      }
    })
  }

  // เพิ่มค่าใช้จ่ายเข้า Order
  const order = await prisma.order.findUnique({
    where: { id: request.orderId }
  })

  if (order) {
    await prisma.order.update({
      where: { id: request.orderId },
      data: {
        totalAmount: Number(order.totalAmount) + Number(request.totalFee)
      }
    })
  }

  return mapPrismaToChangeRequest(request)
}

/**
 * ปฏิเสธ Change Request
 */
export async function rejectChangeRequest(
  id: string,
  reason: string
): Promise<ChangeRequest> {
  const request = await prisma.changeRequest.update({
    where: { id },
    data: {
      status: 'rejected',
      adminNotes: reason,
    }
  })

  return mapPrismaToChangeRequest(request)
}

/**
 * Helper: แปลง Prisma model เป็น ChangeRequest
 */
function mapPrismaToChangeRequest(request: any): ChangeRequest {
  return {
    id: request.id,
    request_number: request.requestNumber,
    order_id: request.orderId,
    order_phase: request.orderPhase,
    change_type: request.changeType,
    description: request.description,
    affected_work_items: request.affectedWorkItems,
    base_fee: Number(request.baseFee),
    design_fee: Number(request.designFee),
    rework_fee: Number(request.reworkFee),
    material_fee: Number(request.materialFee),
    total_fee: Number(request.totalFee),
    days_delayed: request.daysDelayed,
    new_due_date: request.newDueDate?.toISOString() || null,
    status: request.status,
    payment_status: request.paymentStatus,
    quoted_at: request.quotedAt?.toISOString() || null,
    quoted_by: request.quotedBy,
    customer_approved_at: request.customerApprovedAt?.toISOString() || null,
    reference_files: request.referenceFiles,
    customer_reason: request.customerReason,
    admin_notes: request.adminNotes,
    created_by: request.createdBy,
    created_at: request.createdAt.toISOString(),
    updated_at: request.updatedAt.toISOString(),
  }
}

