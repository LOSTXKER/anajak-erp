/**
 * Customer Types & Interfaces
 */

export type CustomerType = 'individual' | 'business' | 'reseller'
export type CustomerTier = 'vip' | 'standard' | 'new'

export interface Customer {
  id: string
  customer_code: string
  
  // Basic Info
  customer_type: CustomerType
  company_name: string | null
  contact_person: string
  email: string | null
  phone: string
  line_id: string | null
  
  // Address
  address: string | null
  district: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  
  // Business Info
  tax_id: string | null
  branch: string
  
  // Sales Info
  assigned_sales_id: string | null
  customer_tier: CustomerTier
  discount_percentage: number
  
  // Payment
  credit_limit: number
  credit_days: number
  
  // Stats
  total_orders: number
  total_revenue: number
  last_order_date: string | null
  
  // Status
  is_active: boolean
  
  // Notes
  notes: string | null
  tags: string[] | null
  
  // Metadata
  created_at: string
  updated_at: string
}

export interface CreateCustomerInput {
  customer_type?: CustomerType
  company_name?: string
  contact_person: string
  email?: string
  phone: string
  line_id?: string
  address?: string
  district?: string
  city?: string
  province?: string
  postal_code?: string
  tax_id?: string
  branch?: string
  customer_tier?: CustomerTier
  discount_percentage?: number
  credit_limit?: number
  credit_days?: number
  notes?: string
  tags?: string[]
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  id: string
}

export interface CustomerFilters {
  search?: string
  customer_type?: CustomerType
  customer_tier?: CustomerTier
  is_active?: boolean
}

