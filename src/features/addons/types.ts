/**
 * Addon Types & Interfaces
 */

export type AddonCategory = 'packaging' | 'labeling' | 'finishing' | 'extra'
export type PriceType = 'per_piece' | 'per_lot' | 'fixed'

export interface AddonType {
  id: string
  code: string
  name: string
  name_th: string
  category: AddonCategory
  base_price: number
  price_type: PriceType
  requires_design: boolean
  requires_material: boolean
  sort_order: number
  is_active: boolean
  created_at: string
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

export interface CreateOrderAddonInput {
  addon_type_id: string
  addon_code: string
  addon_name: string
  quantity: number
  unit_price: number
}

