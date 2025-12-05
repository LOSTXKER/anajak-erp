/**
 * API Route: /api/reports/summary
 * Dashboard Summary & Analytics
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Dashboard Summary
export async function GET() {
  try {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())

    // Orders Summary
    const [
      totalOrders,
      ordersThisMonth,
      pendingOrders,
      inProductionOrders,
      completedOrders
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: { createdAt: { gte: startOfMonth } }
      }),
      prisma.order.count({
        where: { status: { in: ['draft', 'pending_approval', 'approved'] } }
      }),
      prisma.order.count({
        where: { status: 'in_production' }
      }),
      prisma.order.count({
        where: { status: 'completed' }
      })
    ])

    // Revenue Summary
    const revenueThisMonth = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: { notIn: ['cancelled', 'draft'] }
      },
      _sum: { totalAmount: true }
    })

    // Payments Summary
    const paymentsThisMonth = await prisma.payment.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: 'confirmed'
      },
      _sum: { amount: true }
    })

    // Outstanding Invoices
    const outstandingInvoices = await prisma.invoice.aggregate({
      where: {
        status: { in: ['sent', 'partial', 'overdue'] }
      },
      _sum: { balanceDue: true },
      _count: true
    })

    // Production Issues
    const openIssues = await prisma.productionIssue.count({
      where: { status: { in: ['open', 'investigating'] } }
    })

    // Outsource Jobs
    const pendingOutsource = await prisma.outsourceJob.count({
      where: { status: { in: ['pending', 'sent', 'in_progress'] } }
    })

    // Low Stock Materials
    const lowStockMaterials = await prisma.material.count({
      where: {
        isActive: true,
        currentStock: { lte: prisma.material.fields.lowStockThreshold }
      }
    })

    // Pending Shipments
    const pendingShipments = await prisma.shipment.count({
      where: { status: { in: ['pending', 'preparing'] } }
    })

    return NextResponse.json({
      orders: {
        total: totalOrders,
        thisMonth: ordersThisMonth,
        pending: pendingOrders,
        inProduction: inProductionOrders,
        completed: completedOrders
      },
      revenue: {
        thisMonth: Number(revenueThisMonth._sum.totalAmount || 0),
        paymentsReceived: Number(paymentsThisMonth._sum.amount || 0)
      },
      invoices: {
        outstanding: outstandingInvoices._count,
        outstandingAmount: Number(outstandingInvoices._sum.balanceDue || 0)
      },
      alerts: {
        openIssues,
        pendingOutsource,
        lowStockMaterials,
        pendingShipments
      }
    })
  } catch (error: any) {
    console.error('[API] Get summary error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 })
  }
}

