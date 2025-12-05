/**
 * API Route: /api/designs/approve
 * POST - อนุมัติ Design Version
 */

import { NextResponse } from 'next/server'
import { approveDesignVersion, rejectDesignVersion } from '@/features/designs/service'
import type { ApproveDesignInput, RejectDesignInput } from '@/features/designs/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (body.action === 'approve') {
      const input: ApproveDesignInput = body
      const version = await approveDesignVersion(input)
      return NextResponse.json(version)
    } else if (body.action === 'reject') {
      const input: RejectDesignInput = body
      const version = await rejectDesignVersion(input)
      return NextResponse.json(version)
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[API] Approve/Reject design error:', error)
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}

