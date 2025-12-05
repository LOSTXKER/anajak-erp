/**
 * API Route: /api/work-types
 * GET - ดึงรายการ Work Types
 */

import { NextResponse } from 'next/server'
import { getWorkTypesByCategory } from '@/features/order-types/service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined

    const workTypes = await getWorkTypesByCategory(category)
    return NextResponse.json(workTypes)
  } catch (error) {
    console.error('[API] Get work types error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch work types' },
      { status: 500 }
    )
  }
}

