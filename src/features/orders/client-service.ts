/**
 * Order Client Service (Fetch API)
 * API calls สำหรับ client-side components
 */

import type { Order, CreateOrderInput } from './types'

const API_BASE = '/api/orders'

/**
 * ดึงรายการออเดอร์ทั้งหมด
 */
export async function getOrders(filters?: any): Promise<Order[]> {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error('Failed to fetch orders')
  return res.json()
}

/**
 * ดึงข้อมูลออเดอร์ตาม ID
 */
export async function getOrderById(id: string): Promise<Order> {
  const res = await fetch(`${API_BASE}/${id}`)
  if (!res.ok) throw new Error('Failed to fetch order')
  return res.json()
}

/**
 * สร้างออเดอร์ใหม่
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create order')
  }
  return res.json()
}

/**
 * อัปเดตข้อมูลออเดอร์
 */
export async function updateOrder(id: string, input: Partial<CreateOrderInput>): Promise<Order> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to update order')
  return res.json()
}

/**
 * ลบออเดอร์
 */
export async function deleteOrder(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete order')
}

