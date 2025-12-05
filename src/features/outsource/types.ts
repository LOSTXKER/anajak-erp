/**
 * Outsource System Types
 */

export interface OutsourceVendor {
  id: string
  code: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  capabilities: string[]
  leadTimeDays: number
  rating: number
  isActive: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface OutsourceJob {
  id: string
  jobNumber: string
  orderId: string
  vendorId: string
  workType: string
  description?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  sentAt?: string | null
  expectedReturnAt?: string | null
  actualReturnAt?: string | null
  status: OutsourceJobStatus
  receivedQuantity: number
  defectQuantity: number
  notes?: string | null
  createdAt: string
  updatedAt: string
  // Relations
  order?: any
  vendor?: OutsourceVendor
}

export type OutsourceJobStatus = 'pending' | 'sent' | 'in_progress' | 'completed' | 'returned' | 'rejected'

export interface CreateVendorInput {
  code: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  capabilities: string[]
  leadTimeDays?: number
}

export interface CreateOutsourceJobInput {
  orderId: string
  vendorId: string
  workType: string
  description?: string
  quantity: number
  unitPrice: number
  expectedReturnAt?: string
}

