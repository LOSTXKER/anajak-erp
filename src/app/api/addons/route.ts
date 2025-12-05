/**
 * API Route: /api/addons
 * GET - ดึงรายการ Addon Types ทั้งหมด
 */

import { NextResponse } from 'next/server'
import { getAddonTypes } from '@/features/addons/service'

export async function GET() {
  try {
    const addons = await getAddonTypes()
    return NextResponse.json(addons)
  } catch (error) {
    console.error('[API] Get addon types error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch addon types' },
      { status: 500 }
    )
  }
}

