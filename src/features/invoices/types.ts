/**
 * Invoice & Payment Types
 */

export interface Invoice {
  id: string
  invoiceNumber: string
  orderId: string
  customerId: string
  invoiceType: InvoiceType
  subtotal: number
  discountAmount: number
  vatAmount: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  dueDate?: string | null
  status: InvoiceStatus
  sentAt?: string | null
  paidAt?: string | null
  notes?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  // Relations
  order?: any
  customer?: any
  payments?: Payment[]
}

export interface Payment {
  id: string
  paymentNumber: string
  invoiceId: string
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  referenceNumber?: string | null
  bankAccount?: string | null
  proofUrl?: string | null
  status: PaymentStatus
  confirmedBy?: string | null
  confirmedAt?: string | null
  notes?: string | null
  createdAt: string
}

export type InvoiceType = 'deposit' | 'partial' | 'full'
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'cash' | 'transfer' | 'credit_card' | 'qr_code'
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected'

export interface CreateInvoiceInput {
  orderId: string
  invoiceType?: InvoiceType
  dueDate?: string
  notes?: string
}

export interface CreatePaymentInput {
  invoiceId: string
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  referenceNumber?: string
  bankAccount?: string
  proofUrl?: string
  notes?: string
}

