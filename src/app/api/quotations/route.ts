/**
 * API Route: /api/quotations
 * Quotation Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all quotations
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')

    const quotations = await prisma.quotation.findMany({
      where: {
        ...(status && { status }),
        ...(customerId && { customerId }),
      },
      include: {
        customer: {
          select: { customerCode: true, contactPerson: true, companyName: true }
        },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(quotations)
  } catch (error: any) {
    console.error('[API] Get quotations error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 })
  }
}

// POST - Create new quotation
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate quotation number
    const count = await prisma.quotation.count()
    const quotationNumber = `QT-${String(count + 1).padStart(5, '0')}`

    // Calculate totals
    const itemsTotal = body.items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unitPrice)
    }, 0)

    const discountAmount = itemsTotal * ((body.discountPercent || 0) / 100)
    const subtotal = itemsTotal - discountAmount
    const vatAmount = subtotal * ((body.vatPercent || 7) / 100)
    const totalAmount = subtotal + vatAmount

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId: body.customerId,
        title: body.title,
        description: body.description,
        subtotal,
        discountPercent: body.discountPercent || 0,
        discountAmount,
        vatPercent: body.vatPercent || 7,
        vatAmount,
        totalAmount,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        terms: body.terms,
        notes: body.notes,
        createdBy: body.createdBy,
        items: {
          create: body.items.map((item: any, index: number) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            notes: item.notes,
            sortOrder: index
          }))
        }
      },
      include: { items: true }
    })

    return NextResponse.json(quotation, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create quotation error:', error?.message)
    return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 })
  }
}

