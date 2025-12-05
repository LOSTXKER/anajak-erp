/**
 * API Route: /api/customers
 * GET - ดึงรายการลูกค้าทั้งหมด
 * POST - สร้างลูกค้าใหม่
 */

import { NextResponse } from 'next/server'
import { getCustomers, createCustomer } from '@/features/customers/service'
import type { CreateCustomerInput } from '@/features/customers/types'

export async function GET() {
  try {
    const customers = await getCustomers()
    return NextResponse.json(customers)
  } catch (error) {
    console.error('[API] Get customers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateCustomerInput = await request.json()
    const customer = await createCustomer(body)
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('[API] Create customer error:', error)
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}

