/**
 * API Route: /api/calendar/production
 * Production Calendar Data
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Production calendar events
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    const where: any = {}
    
    if (startDate && endDate) {
      where.OR = [
        {
          dueDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }
      ]
    }

    // Get orders with due dates
    const orders = await prisma.order.findMany({
      where: {
        ...where,
        status: { notIn: ['cancelled', 'completed'] },
        dueDate: { not: null }
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        orderTypeCode: true,
        dueDate: true,
        status: true,
        totalAmount: true,
        priorityLevel: true
      },
      orderBy: { dueDate: 'asc' }
    })

    // Get production jobs with schedules
    const productionJobs = await prisma.productionJob.findMany({
      where: {
        status: { in: ['queued', 'in_progress'] },
        ...(startDate && endDate && {
          OR: [
            { startedAt: { gte: new Date(startDate), lte: new Date(endDate) } },
            { completedAt: { gte: new Date(startDate), lte: new Date(endDate) } }
          ]
        })
      },
      select: {
        id: true,
        jobNumber: true,
        workName: true,
        status: true,
        startedAt: true,
        completedAt: true,
        order: {
          select: { orderNumber: true, customerName: true }
        }
      }
    })

    // Get scheduled shipments
    const shipments = await prisma.shipment.findMany({
      where: {
        status: { in: ['pending', 'preparing', 'shipped'] },
        ...(startDate && endDate && {
          scheduledDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        })
      },
      select: {
        id: true,
        shipmentNumber: true,
        scheduledDate: true,
        scheduledTime: true,
        status: true,
        order: {
          select: { orderNumber: true, customerName: true }
        }
      }
    })

    // Format as calendar events
    const events = [
      ...orders.map(order => ({
        id: order.id,
        type: 'order_due',
        title: `📦 ${order.orderNumber} - ${order.customerName}`,
        date: order.dueDate,
        status: order.status,
        priority: order.priorityLevel,
        amount: order.totalAmount,
        color: order.priorityLevel > 0 ? 'red' : 'blue'
      })),
      ...productionJobs.map(job => ({
        id: job.id,
        type: 'production',
        title: `🏭 ${job.workName} (${job.order.orderNumber})`,
        date: job.startedAt || new Date(),
        status: job.status,
        color: 'purple'
      })),
      ...shipments.map(shipment => ({
        id: shipment.id,
        type: 'shipment',
        title: `🚚 จัดส่ง ${shipment.order.orderNumber}`,
        date: shipment.scheduledDate,
        time: shipment.scheduledTime,
        status: shipment.status,
        color: 'green'
      }))
    ]

    return NextResponse.json(events)
  } catch (error: any) {
    console.error('[API] Get calendar error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
  }
}

