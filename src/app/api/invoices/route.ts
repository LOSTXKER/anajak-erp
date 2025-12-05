/**
 * API Route: /api/invoices
 * Invoice Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all invoices
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const orderId = searchParams.get('orderId')

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(status && { status }),
        ...(orderId && { orderId }),
      },
      include: {
        order: {
          select: { orderNumber: true }
        },
        customer: {
          select: { customerCode: true, contactPerson: true, companyName: true }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(invoices)
  } catch (error: any) {
    console.error('[API] Get invoices error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

// POST - Create new invoice from order
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      select: {
        customerId: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        paidAmount: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Generate invoice number
    const count = await prisma.invoice.count()
    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`

    const balanceDue = Number(order.totalAmount) - Number(order.paidAmount)

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: body.orderId,
        customerId: order.customerId,
        invoiceType: body.invoiceType || 'full',
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        vatAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        paidAmount: order.paidAmount,
        balanceDue,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes,
        createdBy: body.createdBy,
      }
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create invoice error:', error?.message)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}

