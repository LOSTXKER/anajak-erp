/**
 * Order Types & Work Types
 */

export interface OrderType {
  id: string
  code: string
  name: string
  name_th: string
  description: string | null
  default_lead_days: number
  requires_pattern: boolean
  requires_fabric: boolean
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface WorkType {
  id: string
  code: string
  name: string
  name_th: string
  category: string
  requires_design: boolean
  requires_material: boolean
  default_price: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export type WorkCategory = 'PRINTING' | 'EMBROIDERY' | 'GARMENT' | 'LABELING' | 'FINISHING'

