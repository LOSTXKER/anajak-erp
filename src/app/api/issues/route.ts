/**
 * API Route: /api/issues
 * Production Issue Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all issues
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const orderId = searchParams.get('orderId')

    const issues = await prisma.productionIssue.findMany({
      where: {
        ...(status && { status }),
        ...(orderId && { orderId }),
      },
      include: {
        order: {
          select: { orderNumber: true, customerName: true }
        },
        productionJob: {
          select: { jobNumber: true, workName: true }
        }
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(issues)
  } catch (error: any) {
    console.error('[API] Get issues error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 })
  }
}

// POST - Create new issue
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate issue number
    const count = await prisma.productionIssue.count()
    const issueNumber = `ISS-${String(count + 1).padStart(5, '0')}`

    const issue = await prisma.productionIssue.create({
      data: {
        issueNumber,
        orderId: body.orderId,
        productionJobId: body.productionJobId,
        issueType: body.issueType,
        severity: body.severity || 'medium',
        title: body.title,
        description: body.description,
        affectedQuantity: body.affectedQuantity || 0,
        photos: body.photos || [],
        reportedBy: body.reportedBy,
      }
    })

    return NextResponse.json(issue, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create issue error:', error?.message)
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 })
  }
}

