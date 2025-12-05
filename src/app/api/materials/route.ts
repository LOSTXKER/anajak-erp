/**
 * API Route: /api/materials
 * Material Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all materials
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock') === 'true'

    const materials = await prisma.material.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
        ...(lowStock && {
          currentStock: { lte: prisma.material.fields.lowStockThreshold }
        }),
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(materials)
  } catch (error: any) {
    console.error('[API] Get materials error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 })
  }
}

// POST - Create new material
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const material = await prisma.material.create({
      data: {
        code: body.code,
        name: body.name,
        nameTh: body.nameTh,
        category: body.category,
        unit: body.unit || 'pcs',
        costPrice: body.costPrice || 0,
        currentStock: body.currentStock || 0,
        lowStockThreshold: body.lowStockThreshold || 10,
        notes: body.notes,
      }
    })

    return NextResponse.json(material, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create material error:', error?.message)
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 })
  }
}

