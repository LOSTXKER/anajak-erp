/**
 * API Route: /api/procurement/requests
 * Purchase Request Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all purchase requests
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const requests = await prisma.purchaseRequest.findMany({
      where: {
        ...(status && { status }),
        ...(priority && { priority }),
      },
      include: {
        supplier: {
          select: { name: true, phone: true }
        },
        material: {
          select: { name: true, code: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(requests)
  } catch (error: any) {
    console.error('[API] Get purchase requests error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch purchase requests' }, { status: 500 })
  }
}

// POST - Create new purchase request
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate request number
    const count = await prisma.purchaseRequest.count()
    const requestNumber = `PR-${String(count + 1).padStart(5, '0')}`

    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        requestNumber,
        orderId: body.orderId,
        materialId: body.materialId,
        itemName: body.itemName,
        itemDescription: body.itemDescription,
        quantity: body.quantity,
        unit: body.unit,
        estimatedPrice: body.estimatedPrice || 0,
        supplierId: body.supplierId,
        priority: body.priority || 'normal',
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        requestedBy: body.requestedBy,
      }
    })

    return NextResponse.json(purchaseRequest, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create purchase request error:', error?.message)
    return NextResponse.json({ error: 'Failed to create purchase request' }, { status: 500 })
  }
}

