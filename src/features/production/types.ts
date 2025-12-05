/**
 * Production Types
 */

export type ProductionStatus = 
  | 'queued'        // รอเข้าคิว
  | 'ready'         // พร้อมผลิต
  | 'in_progress'   // กำลังผลิต
  | 'paused'        // หยุดชั่วคราว
  | 'qc'            // ตรวจ QC
  | 'completed'     // เสร็จสิ้น
  | 'failed'        // ไม่ผ่าน

export type QcResult = 'pending' | 'passed' | 'failed' | 'conditional_pass'

export interface ProductionJob {
  id: string
  job_number: string
  order_id: string
  order_item_id: string | null
  work_type: string
  work_name: string
  quantity: number
  priority_score: number
  status: ProductionStatus
  assigned_to: string | null
  machine_id: string | null
  started_at: string | null
  completed_at: string | null
  actual_quantity: number
  defect_quantity: number
  rework_quantity: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface QcStage {
  id: string
  code: string
  name: string
  name_th: string
  description: string | null
  checklist_items: string[]
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface QcRecord {
  id: string
  production_job_id: string
  qc_stage_id: string
  inspected_by: string | null
  inspected_at: string | null
  result: QcResult
  passed_quantity: number
  failed_quantity: number
  defect_types: string[]
  notes: string | null
  photos: string[]
  created_at: string
}

export interface CreateProductionJobInput {
  order_id: string
  order_item_id?: string
  work_type: string
  work_name: string
  quantity: number
  priority_score?: number
}

export interface UpdateProductionJobInput {
  job_id: string
  status?: ProductionStatus
  assigned_to?: string
  actual_quantity?: number
  defect_quantity?: number
  notes?: string
}

export interface CreateQcRecordInput {
  production_job_id: string
  qc_stage_id: string
  inspected_by: string
  result: QcResult
  passed_quantity: number
  failed_quantity: number
  defect_types?: string[]
  notes?: string
  photos?: string[]
}

// Priority Scoring Factors
export interface PriorityFactors {
  due_date_urgency: number    // 0-30 points (ใกล้วันส่ง = คะแนนสูง)
  customer_tier: number       // 0-20 points (VIP = 20, Standard = 10, New = 5)
  order_value: number         // 0-20 points (ยิ่งมูลค่าสูง = คะแนนสูง)
  is_delayed: number          // 0-30 points (เลยกำหนดแล้ว = 30)
  manual_priority: number     // 0-20 points (Admin กำหนดเอง)
}

