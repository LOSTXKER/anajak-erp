/**
 * Production Issue Types
 */

export interface ProductionIssue {
  id: string
  issueNumber: string
  orderId: string
  productionJobId?: string | null
  issueType: IssueType
  severity: IssueSeverity
  title: string
  description: string
  affectedQuantity: number
  photos: string[]
  reportedBy?: string | null
  reportedAt: string
  assignedTo?: string | null
  status: IssueStatus
  resolution?: string | null
  resolvedBy?: string | null
  resolvedAt?: string | null
  costImpact: number
  timeImpactHours: number
  createdAt: string
  updatedAt: string
  // Relations
  order?: any
  productionJob?: any
}

export type IssueType = 'defect' | 'material_shortage' | 'machine_error' | 'human_error' | 'delay'
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'closed'

export interface CreateIssueInput {
  orderId: string
  productionJobId?: string
  issueType: IssueType
  severity: IssueSeverity
  title: string
  description: string
  affectedQuantity?: number
  photos?: string[]
}

export interface UpdateIssueInput {
  status?: IssueStatus
  assignedTo?: string
  resolution?: string
  costImpact?: number
  timeImpactHours?: number
}

