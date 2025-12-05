/**
 * Product Client Service (Fetch API)
 * API calls สำหรับ client-side components
 */

import type { Product, CreateProductInput } from './types'

const API_BASE = '/api/products'

/**
 * ดึงรายการสินค้าทั้งหมด
 */
export async function getProducts(filters?: any): Promise<Product[]> {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json()
}

/**
 * ดึงข้อมูลสินค้าตาม ID
 */
export async function getProductById(id: string): Promise<Product> {
  const res = await fetch(`${API_BASE}/${id}`)
  if (!res.ok) throw new Error('Failed to fetch product')
  return res.json()
}

/**
 * สร้างสินค้าใหม่
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create product')
  return res.json()
}

/**
 * อัปเดตข้อมูลสินค้า
 */
export async function updateProduct(id: string, input: Partial<CreateProductInput>): Promise<Product> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to update product')
  return res.json()
}

/**
 * ลบสินค้า (soft delete)
 */
export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete product')
}

