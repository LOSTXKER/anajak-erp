/**
 * API Route: /api/suppliers
 * Supplier Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all suppliers
export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(suppliers)
  } catch (error: any) {
    console.error('[API] Get suppliers error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

// POST - Create new supplier
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const supplier = await prisma.supplier.create({
      data: {
        code: body.code,
        name: body.name,
        contactPerson: body.contactPerson,
        phone: body.phone,
        email: body.email,
        address: body.address,
        taxId: body.taxId,
        paymentTerms: body.paymentTerms,
        leadTimeDays: body.leadTimeDays || 7,
        notes: body.notes,
      }
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create supplier error:', error?.message)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}

