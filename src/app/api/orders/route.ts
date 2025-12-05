/**
 * API Route: /api/orders
 * GET - ดึงรายการออเดอร์ทั้งหมด
 * POST - สร้างออเดอร์ใหม่
 */

import { NextResponse } from 'next/server'
import { getOrders, createOrder } from '@/features/orders/service'
import type { CreateOrderInput } from '@/features/orders/types'

export async function GET() {
  try {
    const orders = await getOrders()
    return NextResponse.json(orders)
  } catch (error) {
    console.error('[API] Get orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateOrderInput = await request.json()
    const order = await createOrder(body)
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('[API] Create order error:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

