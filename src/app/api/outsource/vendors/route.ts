/**
 * API Route: /api/outsource/vendors
 * Outsource Vendor Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all vendors
export async function GET() {
  try {
    const vendors = await prisma.outsourceVendor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(vendors)
  } catch (error: any) {
    console.error('[API] Get vendors error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}

// POST - Create new vendor
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const vendor = await prisma.outsourceVendor.create({
      data: {
        code: body.code,
        name: body.name,
        contactPerson: body.contactPerson,
        phone: body.phone,
        email: body.email,
        address: body.address,
        capabilities: body.capabilities || [],
        leadTimeDays: body.leadTimeDays || 3,
      }
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create vendor error:', error?.message)
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 })
  }
}

