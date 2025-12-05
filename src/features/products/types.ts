/**
 * Product Types & Interfaces
 */

export type ProductType = 'tshirt' | 'polo' | 'hoodie' | 'cap' | 'tote_bag' | 'other'
export type MaterialType = 'cotton_32' | 'poly_65_35' | 'pique' | 'french_terry' | 'other'

export interface Product {
  id: string
  sku: string
  
  // Basic Info
  product_type: ProductType
  name: string
  name_th: string
  description: string | null
  
  // Material
  material_type: MaterialType | null
  weight_gsm: number | null
  
  // Variants
  base_color: string | null
  available_sizes: string[] | null
  
  // Pricing
  cost_price: number
  base_price: number
  
  // Inventory
  track_inventory: boolean
  low_stock_threshold: number
  
  // Images
  image_url: string | null
  mockup_template_url: string | null
  
  // Status
  is_active: boolean
  is_featured: boolean
  
  // SEO
  slug: string | null
  
  // Metadata
  created_at: string
  updated_at: string
}

export interface CreateProductInput {
  product_type: ProductType
  name: string
  name_th: string
  description?: string
  material_type?: MaterialType
  weight_gsm?: number
  base_color?: string
  available_sizes?: string[]
  cost_price?: number
  base_price: number
  track_inventory?: boolean
  low_stock_threshold?: number
  image_url?: string
  mockup_template_url?: string
  is_featured?: boolean
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string
}

export interface ProductFilters {
  search?: string
  product_type?: ProductType
  is_active?: boolean
  is_featured?: boolean
}

// Common Sizes
export const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Free Size']

// Common Colors
export const COMMON_COLORS = [
  { value: 'white', label: 'ขาว', hex: '#FFFFFF' },
  { value: 'black', label: 'ดำ', hex: '#000000' },
  { value: 'navy', label: 'กรมท่า', hex: '#001F3F' },
  { value: 'gray', label: 'เทา', hex: '#808080' },
  { value: 'red', label: 'แดง', hex: '#FF0000' },
  { value: 'blue', label: 'น้ำเงิน', hex: '#0074D9' },
  { value: 'green', label: 'เขียว', hex: '#2ECC40' },
  { value: 'yellow', label: 'เหลือง', hex: '#FFDC00' },
  { value: 'pink', label: 'ชมพู', hex: '#FF69B4' },
  { value: 'orange', label: 'ส้ม', hex: '#FF851B' },
]

