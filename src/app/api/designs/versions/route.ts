/**
 * API Route: /api/designs/versions
 * POST - สร้าง Design Version ใหม่
 */

import { NextResponse } from 'next/server'
import { createDesignVersion } from '@/features/designs/service'
import type { CreateDesignVersionInput } from '@/features/designs/types'

export async function POST(request: Request) {
  try {
    const body: CreateDesignVersionInput = await request.json()
    const version = await createDesignVersion(body)
    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    console.error('[API] Create design version error:', error)
    return NextResponse.json(
      { error: 'Failed to create design version' },
      { status: 500 }
    )
  }
}

