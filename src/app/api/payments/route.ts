/**
 * API Route: /api/payments
 * Payment Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all payments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    const status = searchParams.get('status')

    const payments = await prisma.payment.findMany({
      where: {
        ...(invoiceId && { invoiceId }),
        ...(status && { status }),
      },
      include: {
        invoice: {
          select: { invoiceNumber: true, orderId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(payments)
  } catch (error: any) {
    console.error('[API] Get payments error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

// POST - Record new payment
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate payment number
    const count = await prisma.payment.count()
    const paymentNumber = `PAY-${String(count + 1).padStart(5, '0')}`

    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        invoiceId: body.invoiceId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        paymentDate: new Date(body.paymentDate),
        referenceNumber: body.referenceNumber,
        bankAccount: body.bankAccount,
        proofUrl: body.proofUrl,
        notes: body.notes,
      }
    })

    // Update invoice paid amount
    const invoice = await prisma.invoice.findUnique({
      where: { id: body.invoiceId },
      select: { paidAmount: true, totalAmount: true }
    })

    if (invoice) {
      const newPaidAmount = Number(invoice.paidAmount) + Number(body.amount)
      const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount
      const newStatus = newBalanceDue <= 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'sent'

      await prisma.invoice.update({
        where: { id: body.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: newBalanceDue,
          status: newStatus,
          paidAt: newStatus === 'paid' ? new Date() : null
        }
      })
    }

    return NextResponse.json(payment, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create payment error:', error?.message)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}

