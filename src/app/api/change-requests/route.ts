/**
 * API Route: /api/change-requests
 * GET - ดึงรายการ Change Requests (ตาม order_id)
 * POST - สร้าง Change Request ใหม่
 */

import { NextResponse } from 'next/server'
import { 
  getChangeRequestsByOrder, 
  createChangeRequest,
  quoteChangeRequest,
  approveChangeRequest,
  rejectChangeRequest
} from '@/features/change-requests/service'
import type { CreateChangeRequestInput } from '@/features/change-requests/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')

    if (!orderId) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      )
    }

    const changeRequests = await getChangeRequestsByOrder(orderId)
    return NextResponse.json(changeRequests)
  } catch (error) {
    console.error('[API] Get change requests error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch change requests' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Handle different actions
    if (body.action === 'create') {
      const input: CreateChangeRequestInput = body
      const changeRequest = await createChangeRequest(input)
      return NextResponse.json(changeRequest, { status: 201 })
    } else if (body.action === 'quote') {
      const changeRequest = await quoteChangeRequest(body)
      return NextResponse.json(changeRequest)
    } else if (body.action === 'approve') {
      const changeRequest = await approveChangeRequest(body)
      return NextResponse.json(changeRequest)
    } else if (body.action === 'reject') {
      const changeRequest = await rejectChangeRequest(body.change_request_id, body.reason)
      return NextResponse.json(changeRequest)
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[API] Change request error:', error)
    return NextResponse.json(
      { error: 'Failed to process change request' },
      { status: 500 }
    )
  }
}

