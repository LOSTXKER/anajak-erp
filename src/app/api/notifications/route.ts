/**
 * API Route: /api/notifications
 * Notification Management
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List notifications
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const customerId = searchParams.get('customerId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const notifications = await prisma.notification.findMany({
      where: {
        ...(userId && { userId }),
        ...(customerId && { customerId }),
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json(notifications)
  } catch (error: any) {
    console.error('[API] Get notifications error:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// POST - Create new notification
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const notification = await prisma.notification.create({
      data: {
        userId: body.userId,
        customerId: body.customerId,
        type: body.type,
        title: body.title,
        message: body.message,
        entityType: body.entityType,
        entityId: body.entityId,
        channels: body.channels || ['app'],
        sentChannels: ['app'], // Mark app as sent immediately
      }
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error: any) {
    console.error('[API] Create notification error:', error?.message)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

// PATCH - Mark notifications as read
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { notificationIds } = body

    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds }
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Mark read error:', error?.message)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }
}

