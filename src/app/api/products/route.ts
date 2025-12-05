/**
 * API Route: /api/products
 * GET - ดึงรายการสินค้าทั้งหมด
 * POST - สร้างสินค้าใหม่
 */

import { NextResponse } from 'next/server'
import { getProducts, createProduct } from '@/features/products/service'
import type { CreateProductInput } from '@/features/products/types'

export async function GET() {
  try {
    const products = await getProducts()
    return NextResponse.json(products)
  } catch (error) {
    console.error('[API] Get products error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateProductInput = await request.json()
    const product = await createProduct(body)
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[API] Create product error:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

