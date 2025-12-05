/**
 * Procurement Types
 */

export interface Supplier {
  id: string
  code: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  taxId?: string | null
  paymentTerms?: string | null
  leadTimeDays: number
  rating: number
  isActive: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Material {
  id: string
  code: string
  name: string
  nameTh: string
  category: MaterialCategory
  unit: string
  costPrice: number
  currentStock: number
  reservedStock: number
  lowStockThreshold: number
  isActive: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface PurchaseRequest {
  id: string
  requestNumber: string
  orderId?: string | null
  materialId?: string | null
  itemName: string
  itemDescription?: string | null
  quantity: number
  unit: string
  estimatedPrice: number
  actualPrice: number
  supplierId?: string | null
  requestedBy?: string | null
  requestedAt: string
  approvedBy?: string | null
  approvedAt?: string | null
  status: PurchaseRequestStatus
  priority: PurchasePriority
  expectedDate?: string | null
  receivedDate?: string | null
  receivedQuantity: number
  notes?: string | null
  createdAt: string
  updatedAt: string
  // Relations
  supplier?: Supplier
  material?: Material
}

export type MaterialCategory = 'fabric' | 'thread' | 'ink' | 'label' | 'packaging'
export type PurchaseRequestStatus = 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled'
export type PurchasePriority = 'low' | 'normal' | 'high' | 'urgent'

export interface CreatePurchaseRequestInput {
  orderId?: string
  materialId?: string
  itemName: string
  itemDescription?: string
  quantity: number
  unit: string
  estimatedPrice?: number
  supplierId?: string
  priority?: PurchasePriority
  expectedDate?: string
}

export interface CreateSupplierInput {
  code: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  taxId?: string
  paymentTerms?: string
  leadTimeDays?: number
}

