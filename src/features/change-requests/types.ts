/**
 * Change Request Types
 */

export type ChangeRequestStatus = 'pending' | 'quoted' | 'approved' | 'rejected' | 'in_progress' | 'completed'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type ChangeType = 
  | 'design_change'      // เปลี่ยนดีไซน์
  | 'quantity_change'    // เปลี่ยนจำนวน
  | 'spec_change'        // เปลี่ยนสเปค (ผ้า, สี, ไซส์)
  | 'add_item'           // เพิ่มรายการ
  | 'remove_item'        // ลบรายการ
  | 'addon_change'       // เปลี่ยน Addon
  | 'other'              // อื่นๆ

export type OrderPhase = 
  | 'design'             // ช่วงออกแบบ
  | 'pre_production'     // ก่อนผลิต
  | 'in_production'      // ระหว่างผลิต
  | 'post_production'    // หลังผลิต

export interface ChangeRequest {
  id: string
  request_number: string
  order_id: string
  order_phase: OrderPhase
  change_type: ChangeType
  description: string
  affected_work_items: string[]
  
  // Fees
  base_fee: number
  design_fee: number
  rework_fee: number
  material_fee: number
  total_fee: number
  
  // Timeline Impact
  days_delayed: number
  new_due_date: string | null
  
  // Status
  status: ChangeRequestStatus
  payment_status: PaymentStatus
  
  // Approval
  quoted_at: string | null
  quoted_by: string | null
  customer_approved_at: string | null
  
  // Files & Notes
  reference_files: string[]
  customer_reason: string | null
  admin_notes: string | null
  
  // Metadata
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateChangeRequestInput {
  order_id: string
  order_phase: OrderPhase
  change_type: ChangeType
  description: string
  customer_reason?: string
  reference_files?: string[]
  affected_work_items?: string[]
}

export interface QuoteChangeRequestInput {
  change_request_id: string
  base_fee: number
  design_fee: number
  rework_fee: number
  material_fee: number
  days_delayed: number
  new_due_date?: string
  admin_notes?: string
  quoted_by: string
}

export interface ApproveChangeRequestInput {
  change_request_id: string
  approved_by: string
}

// Auto Cost Calculation Rules
export const CHANGE_REQUEST_FEES = {
  design: {
    minor: 500,      // แก้ไขเล็กน้อย
    major: 2000,     // แก้ไขใหญ่
    complete: 5000,  // ออกแบบใหม่ทั้งหมด
  },
  rework: {
    pre_production: 1000,   // ก่อนผลิต
    in_production: 3000,    // ระหว่างผลิต
    post_production: 5000,  // หลังผลิต (ต้องทำใหม่)
  },
  material: {
    per_meter: 50,     // ฿50 ต่อเมตร
    per_piece: 100,    // ฿100 ต่อชิ้น
  },
  base: {
    admin_fee: 200,    // ค่าดำเนินการ
  }
}

