/**
 * Design & Approval Types
 */

export type DesignStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'revision_requested'
export type ApprovalGateType = 'design_approval' | 'mockup_approval' | 'sample_approval' | 'final_approval'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped'

export interface DesignVersion {
  id: string
  order_item_id: string
  version_number: number
  design_files: string[]
  mockup_url: string | null
  status: DesignStatus
  uploaded_by: string | null
  uploaded_at: string
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  revision_notes: string | null
  is_current_version: boolean
  is_billable: boolean
  revision_fee: number
}

export interface ApprovalGate {
  id: string
  order_id: string
  gate_type: ApprovalGateType
  gate_name: string
  status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  customer_confirmed_at: string | null
  customer_ip: string | null
  customer_signature: string | null
  notes: string | null
  rejection_reason: string | null
  created_at: string
}

export interface CreateDesignVersionInput {
  order_item_id: string
  design_files: string[]
  mockup_url?: string
  revision_notes?: string
  uploaded_by?: string
}

export interface ApproveDesignInput {
  design_version_id: string
  approved_by: string
  notes?: string
}

export interface RejectDesignInput {
  design_version_id: string
  rejected_by: string
  rejection_reason: string
}

export interface CreateApprovalGateInput {
  order_id: string
  gate_type: ApprovalGateType
  gate_name: string
}

export interface RevisionCostCalculation {
  order_id: string
  current_revision_count: number
  free_revisions: number
  billable_revisions: number
  revision_fee_per_change: number
  total_revision_cost: number
  is_over_limit: boolean
}

