/**
 * Quotation Types
 */

export interface Quotation {
  id: string
  quotationNumber: string
  customerId: string
  title?: string | null
  description?: string | null
  subtotal: number
  discountPercent: number
  discountAmount: number
  vatPercent: number
  vatAmount: number
  totalAmount: number
  validUntil?: string | null
  status: QuotationStatus
  sentAt?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  convertedOrderId?: string | null
  terms?: string | null
  notes?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  // Relations
  customer?: any
  items?: QuotationItem[]
}

export interface QuotationItem {
  id: string
  quotationId: string
  productId?: string | null
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string | null
  sortOrder: number
  // Relations
  product?: any
}

export type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'

export interface CreateQuotationInput {
  customerId: string
  title?: string
  description?: string
  validUntil?: string
  discountPercent?: number
  terms?: string
  notes?: string
  items: CreateQuotationItemInput[]
}

export interface CreateQuotationItemInput {
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  notes?: string
}

