/**
 * Customer Client Service (Fetch API)
 * API calls สำหรับ client-side components
 */

import type { Customer, CreateCustomerInput } from './types'

const API_BASE = '/api/customers'

/**
 * ดึงรายการลูกค้าทั้งหมด
 */
export async function getCustomers(filters?: any): Promise<Customer[]> {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error('Failed to fetch customers')
  return res.json()
}

/**
 * ดึงข้อมูลลูกค้าตาม ID
 */
export async function getCustomerById(id: string): Promise<Customer> {
  const res = await fetch(`${API_BASE}/${id}`)
  if (!res.ok) throw new Error('Failed to fetch customer')
  return res.json()
}

/**
 * สร้างลูกค้าใหม่
 */
export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create customer')
  return res.json()
}

/**
 * อัปเดตข้อมูลลูกค้า
 */
export async function updateCustomer(id: string, input: Partial<CreateCustomerInput>): Promise<Customer> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to update customer')
  return res.json()
}

/**
 * ลบลูกค้า (soft delete)
 */
export async function deleteCustomer(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete customer')
}

