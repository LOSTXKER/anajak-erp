/**
 * API Route: /api/orders/[id]/repeat
 * Repeat Order (Clone existing order)
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST - Create repeat order from existing order
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get original order with items and addons
    const originalOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        addons: {
          include: { addonType: true }
        }
      }
    })

    if (!originalOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Generate new order number
    const count = await prisma.order.count()
    const orderNumber = `ORD-${String(count + 1).padStart(6, '0')}`

    // Create new order (clone)
    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        customerId: originalOrder.customerId,
        customerName: originalOrder.customerName,
        customerPhone: originalOrder.customerPhone,
        orderTypeCode: originalOrder.orderTypeCode,
        orderDate: new Date(),
        dueDate: body.newDueDate ? new Date(body.newDueDate) : null,
        productionMode: originalOrder.productionMode,
        priorityLevel: body.priorityLevel || 0,
        freeRevisions: originalOrder.freeRevisions,
        deliveryMethod: originalOrder.deliveryMethod,
        deliveryAddress: originalOrder.deliveryAddress,
        notes: body.notes || `สั่งซ้ำจาก ${originalOrder.orderNumber}`,
        createdBy: body.createdBy,
        
        // Clone items
        items: {
          create: originalOrder.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: body.useOriginalQuantity ? item.quantity : (body.newQuantity || item.quantity),
            unitPrice: item.unitPrice,
            totalPrice: (body.useOriginalQuantity ? item.quantity : (body.newQuantity || item.quantity)) * Number(item.unitPrice),
            sizes: item.sizes,
            colors: item.colors,
            printingMethod: item.printingMethod,
            printLocations: item.printLocations,
          }))
        },

        // Clone addons if requested
        ...(body.includeAddons && {
          addons: {
            create: originalOrder.addons.map(addon => ({
              addonTypeId: addon.addonTypeId,
              quantity: addon.quantity,
              unitPrice: addon.unitPrice,
              totalPrice: addon.totalPrice,
            }))
          }
        })
      },
      include: {
        items: true,
        addons: true
      }
    })

    // Recalculate totals
    const itemsTotal = newOrder.items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
    const addonsTotal = newOrder.addons.reduce((sum, addon) => sum + Number(addon.totalPrice), 0)
    const subtotal = itemsTotal + addonsTotal
    const taxAmount = subtotal * 0.07
    const totalAmount = subtotal + taxAmount

    const updatedOrder = await prisma.order.update({
      where: { id: newOrder.id },
      data: {
        subtotal,
        taxAmount,
        totalAmount
      }
    })

    return NextResponse.json(updatedOrder, { status: 201 })
  } catch (error: any) {
    console.error('[API] Repeat order error:', error?.message)
    return NextResponse.json({ error: 'Failed to create repeat order' }, { status: 500 })
  }
}

