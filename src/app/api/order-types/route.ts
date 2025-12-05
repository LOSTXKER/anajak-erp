/**
 * API Route: /api/order-types
 * GET - ดึงรายการ Order Types
 */

import { NextResponse } from 'next/server'
import { getAllOrderTypes } from '@/features/order-types/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('[API] Fetching order types...')
    console.log('[API] DATABASE_URL exists:', !!process.env.DATABASE_URL)
    const orderTypes = await getAllOrderTypes()
    console.log('[API] Found order types:', orderTypes.length)
    return NextResponse.json(orderTypes)
  } catch (error: any) {
    console.error('[API] Get order types error:', error?.message || error)
    console.error('[API] Stack:', error?.stack)
    return NextResponse.json(
      { error: 'Failed to fetch order types', detail: error?.message },
      { status: 500 }
    )
  }
}

