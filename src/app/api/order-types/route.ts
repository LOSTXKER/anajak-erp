/**
 * API Route: /api/order-types
 * GET - ดึงรายการ Order Types
 */

import { NextResponse } from 'next/server'
import { getAllOrderTypes } from '@/features/order-types/service'

export async function GET() {
  try {
    const orderTypes = await getAllOrderTypes()
    return NextResponse.json(orderTypes)
  } catch (error) {
    console.error('[API] Get order types error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order types' },
      { status: 500 }
    )
  }
}

