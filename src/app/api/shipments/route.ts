/**
 * API Route: /api/shipments
 * Shipment Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all shipments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const orderId = searchParams.get('orderId')

    const shipments = await prisma.shipment.findMany({
      where: {
        ...(status && { status }),
        ...(orderId && { orderId }),
      },
      include: {
        order: {
          select: { orderNumber: true, customerName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(shipments)
  } catch (error: any) {
    console.error('[API] Get shipments error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 })
  }
}

// POST - Create new shipment
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate shipment number
    const count = await prisma.shipment.count()
    const shipmentNumber = `SHP-${String(count + 1).padStart(5, '0')}`

    const shipment = await prisma.shipment.create({
      data: {
        shipmentNumber,
        orderId: body.orderId,
        shippingMethod: body.shippingMethod,
        courierName: body.courierName,
        shippingCost: body.shippingCost || 0,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        shippingAddress: body.shippingAddress,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        scheduledTime: body.scheduledTime,
        notes: body.notes,
      }
    })

    return NextResponse.json(shipment, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create shipment error:', error?.message)
    return NextResponse.json({ error: 'Failed to create shipment' }, { status: 500 })
  }
}

