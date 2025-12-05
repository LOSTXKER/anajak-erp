/**
 * Order Types & Interfaces
 */

export type OrderStatus = 
  | 'draft' 
  | 'pending_approval' 
  | 'approved' 
  | 'in_production' 
  | 'qc' 
  | 'completed' 
  | 'shipped' 
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type DeliveryMethod = 'pickup' | 'delivery' | 'courier'
export type ProductionMode = 'in_house' | 'outsource' | 'hybrid'

export interface Order {
  id: string
  order_number: string
  
  // Customer Info
  customer_id: string
  customer_name: string
  customer_phone: string | null
  
  // Order Info
  order_type_code: string
  order_date: string
  due_date: string | null
  
  // Production
  production_mode: ProductionMode
  priority_level: number
  
  // Design & Approval
  all_designs_approved: boolean
  mockup_approved: boolean
  production_unlocked: boolean
  
  // Pricing
  subtotal: number
  discount_amount: number
  tax_amount: number
  shipping_fee: number
  total_amount: number
  
  // Payment
  payment_status: PaymentStatus
  paid_amount: number
  
  // Status
  status: OrderStatus
  
  // Delivery
  delivery_method: DeliveryMethod | null
  delivery_address: string | null
  
  // Notes
  notes: string | null
  
  // Metadata
  created_at: string
  updated_at: string
  
  // Relations
  items?: OrderItem[]
  addons?: OrderAddon[]
  customer?: {
    id: string
    customer_code: string
    contact_person: string
    phone: string
  }
}

export interface OrderAddon {
  id: string
  order_id: string
  addon_type_id: string | null
  addon_code: string
  addon_name: string
  quantity: number
  unit_price: number
  total_price: number
  status: string
  design_file_url: string | null
  notes: string | null
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  item_number: number
  
  // Product
  product_id: string | null
  product_sku: string | null
  product_name: string
  
  // Customization
  size: string | null
  color: string | null
  quantity: number
  
  // Pricing
  unit_price: number
  line_total: number
  
  // Design
  design_files: string[]
  design_status: string
  mockup_url: string | null
  
  // Notes
  notes: string | null
  
  // Relation
  product?: {
    id: string
    sku: string
    name: string
    image_url: string | null
  }
}

export interface CreateOrderInput {
  customer_id: string
  order_type_code?: string
  due_date?: string
  delivery_method?: DeliveryMethod
  delivery_address?: string
  notes?: string
  items: CreateOrderItemInput[]
  addons?: CreateOrderAddonInput[]
}

export interface CreateOrderAddonInput {
  addon_type_id: string
  addon_code: string
  addon_name: string
  quantity: number
  unit_price: number
}

export interface CreateOrderItemInput {
  product_id: string
  product_name: string
  size?: string
  color?: string
  quantity: number
  unit_price: number
  notes?: string
}

export interface UpdateOrderInput extends Partial<CreateOrderInput> {
  id: string
}

export interface OrderFilters {
  search?: string
  status?: OrderStatus
  payment_status?: PaymentStatus
  customer_id?: string
  date_from?: string
  date_to?: string
}

// Order Summary for Dashboard
export interface OrderSummary {
  total_orders: number
  pending_orders: number
  in_production: number
  completed_today: number
  total_revenue: number
  pending_revenue: number
}

