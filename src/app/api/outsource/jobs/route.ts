/**
 * API Route: /api/outsource/jobs
 * Outsource Job Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all outsource jobs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const vendorId = searchParams.get('vendorId')

    const jobs = await prisma.outsourceJob.findMany({
      where: {
        ...(status && { status }),
        ...(vendorId && { vendorId }),
      },
      include: {
        order: {
          select: { orderNumber: true, customerName: true }
        },
        vendor: {
          select: { name: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(jobs)
  } catch (error: any) {
    console.error('[API] Get outsource jobs error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch outsource jobs' }, { status: 500 })
  }
}

// POST - Create new outsource job
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate job number
    const count = await prisma.outsourceJob.count()
    const jobNumber = `OUT-${String(count + 1).padStart(5, '0')}`

    const totalPrice = body.quantity * body.unitPrice

    const job = await prisma.outsourceJob.create({
      data: {
        jobNumber,
        orderId: body.orderId,
        vendorId: body.vendorId,
        workType: body.workType,
        description: body.description,
        quantity: body.quantity,
        unitPrice: body.unitPrice,
        totalPrice,
        expectedReturnAt: body.expectedReturnAt ? new Date(body.expectedReturnAt) : null,
      }
    })

    return NextResponse.json(job, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create outsource job error:', error?.message)
    return NextResponse.json({ error: 'Failed to create outsource job' }, { status: 500 })
  }
}

