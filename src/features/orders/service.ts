/**
 * Order Service (Prisma Edition)
 * API calls สำหรับจัดการออเดอร์
 */

import prisma from '@/lib/prisma'
import type { 
  Order, 
  OrderItem,
  CreateOrderInput, 
  UpdateOrderInput, 
  OrderFilters,
  OrderSummary 
} from './types'

/**
 * สร้าง Order Number อัตโนมัติ (ORD-2024-0001)
 */
async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ORD-${year}-`
  
  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix
      }
    },
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true }
  })

  if (!lastOrder) {
    return `${prefix}0001`
  }

  const lastNumber = parseInt(lastOrder.orderNumber.split('-')[2] || '0')
  const nextNumber = lastNumber + 1
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * ดึงรายการออเดอร์ทั้งหมด (พร้อม Filters)
 */
export async function getOrders(filters?: OrderFilters): Promise<Order[]> {
  const where: any = {}

  // Apply filters
  if (filters?.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: 'insensitive' } },
      { customerName: { contains: filters.search, mode: 'insensitive' } },
      { customerPhone: { contains: filters.search } },
    ]
  }

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.payment_status) {
    where.paymentStatus = filters.payment_status
  }

  if (filters?.customer_id) {
    where.customerId = filters.customer_id
  }

  if (filters?.date_from || filters?.date_to) {
    where.orderDate = {}
    if (filters.date_from) {
      where.orderDate.gte = new Date(filters.date_from)
    }
    if (filters.date_to) {
      where.orderDate.lte = new Date(filters.date_to)
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          customerCode: true,
          contactPerson: true,
          phone: true,
        }
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              imageUrl: true,
            }
          }
        }
      },
      addons: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return orders.map(mapPrismaToOrder)
}

/**
 * ดึงข้อมูลออเดอร์ตาม ID
 */
export async function getOrderById(id: string): Promise<Order | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          customerCode: true,
          contactPerson: true,
          phone: true,
        }
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              imageUrl: true,
            }
          }
        },
        orderBy: { itemNumber: 'asc' }
      },
      addons: true
    }
  })

  if (!order) return null
  return mapPrismaToOrder(order)
}

/**
 * สร้างออเดอร์ใหม่
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const orderNumber = await generateOrderNumber()

  // Get customer info
  const customer = await prisma.customer.findUnique({
    where: { id: input.customer_id },
    select: {
      contactPerson: true,
      companyName: true,
      phone: true,
    }
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Calculate totals
  const subtotal = input.items.reduce((sum, item) => {
    return sum + (item.unit_price * item.quantity)
  }, 0)

  const addonTotal = (input.addons || []).reduce((sum, addon) => {
    return sum + (addon.unit_price * addon.quantity)
  }, 0)

  const totalAmount = subtotal + addonTotal

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: input.customer_id,
      customerName: customer.companyName || customer.contactPerson,
      customerPhone: customer.phone,
      orderTypeCode: input.order_type_code || 'ready_made',
      dueDate: input.due_date ? new Date(input.due_date) : null,
      deliveryMethod: input.delivery_method || null,
      deliveryAddress: input.delivery_address || null,
      notes: input.notes || null,
      subtotal,
      totalAmount,
      items: {
        create: input.items.map((item, index) => ({
          itemNumber: index + 1,
          productId: item.product_id,
          productName: item.product_name,
          size: item.size || null,
          color: item.color || null,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          lineTotal: item.unit_price * item.quantity,
          notes: item.notes || null,
          designFiles: [],
        }))
      },
      addons: {
        create: (input.addons || []).map((addon) => ({
          addonTypeId: addon.addon_type_id,
          addonCode: addon.addon_code,
          addonName: addon.addon_name,
          quantity: addon.quantity,
          unitPrice: addon.unit_price,
          totalPrice: addon.unit_price * addon.quantity,
          status: 'pending',
        }))
      }
    },
    include: {
      customer: {
        select: {
          id: true,
          customerCode: true,
          contactPerson: true,
          phone: true,
        }
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              imageUrl: true,
            }
          }
        }
      }
    }
  })

  return mapPrismaToOrder(order)
}

/**
 * อัปเดตออเดอร์
 */
export async function updateOrder(input: UpdateOrderInput): Promise<Order> {
  const { id, items, ...data } = input

  const order = await prisma.order.update({
    where: { id },
    data: {
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      deliveryMethod: data.delivery_method,
      deliveryAddress: data.delivery_address,
      notes: data.notes,
    },
    include: {
      customer: {
        select: {
          id: true,
          customerCode: true,
          contactPerson: true,
          phone: true,
        }
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              imageUrl: true,
            }
          }
        }
      }
    }
  })

  return mapPrismaToOrder(order)
}

/**
 * ลบออเดอร์ (Soft Delete)
 */
export async function deleteOrder(id: string): Promise<void> {
  await prisma.order.update({
    where: { id },
    data: { 
      status: 'cancelled',
      cancelledAt: new Date()
    }
  })
}

/**
 * อัปเดตสถานะออเดอร์
 */
export async function updateOrderStatus(id: string, status: string): Promise<Order> {
  const order = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      customer: {
        select: {
          id: true,
          customerCode: true,
          contactPerson: true,
          phone: true,
        }
      },
      items: true
    }
  })

  return mapPrismaToOrder(order)
}

/**
 * ดึงสรุปออเดอร์สำหรับ Dashboard
 */
export async function getOrderSummary(): Promise<OrderSummary> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [totalOrders, pendingOrders, inProduction, completedToday, revenue] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ['draft', 'pending_approval', 'approved'] } } }),
    prisma.order.count({ where: { status: 'in_production' } }),
    prisma.order.count({ where: { status: 'completed', completedAt: { gte: today } } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: 'cancelled' } }
    })
  ])

  const pendingRevenue = await prisma.order.aggregate({
    _sum: { totalAmount: true },
    where: { 
      paymentStatus: { in: ['unpaid', 'partial'] },
      status: { not: 'cancelled' }
    }
  })

  return {
    total_orders: totalOrders,
    pending_orders: pendingOrders,
    in_production: inProduction,
    completed_today: completedToday,
    total_revenue: Number(revenue._sum.totalAmount || 0),
    pending_revenue: Number(pendingRevenue._sum.totalAmount || 0),
  }
}

/**
 * Helper: แปลง Prisma model เป็น Order type
 */
function mapPrismaToOrder(order: any): Order {
  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_id: order.customerId,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    order_type_code: order.orderTypeCode,
    order_date: order.orderDate.toISOString(),
    due_date: order.dueDate?.toISOString() || null,
    production_mode: order.productionMode,
    priority_level: order.priorityLevel,
    all_designs_approved: order.allDesignsApproved,
    mockup_approved: order.mockupApproved,
    production_unlocked: order.productionUnlocked,
    subtotal: Number(order.subtotal),
    discount_amount: Number(order.discountAmount),
    tax_amount: Number(order.taxAmount),
    shipping_fee: Number(order.shippingFee),
    total_amount: Number(order.totalAmount),
    payment_status: order.paymentStatus,
    paid_amount: Number(order.paidAmount),
    status: order.status,
    delivery_method: order.deliveryMethod,
    delivery_address: order.deliveryAddress,
    notes: order.notes,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    items: order.items?.map(mapPrismaToOrderItem),
    addons: order.addons?.map(mapPrismaToOrderAddon),
    customer: order.customer ? {
      id: order.customer.id,
      customer_code: order.customer.customerCode,
      contact_person: order.customer.contactPerson,
      phone: order.customer.phone,
    } : undefined,
  }
}

/**
 * Helper: แปลง Prisma OrderItem model
 */
function mapPrismaToOrderItem(item: any): OrderItem {
  return {
    id: item.id,
    order_id: item.orderId,
    item_number: item.itemNumber,
    product_id: item.productId,
    product_sku: item.productSku,
    product_name: item.productName,
    size: item.size,
    color: item.color,
    quantity: item.quantity,
    unit_price: Number(item.unitPrice),
    line_total: Number(item.lineTotal),
    design_files: item.designFiles,
    design_status: item.designStatus,
    mockup_url: item.mockupUrl,
    notes: item.notes,
    product: item.product ? {
      id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      image_url: item.product.imageUrl,
    } : undefined,
  }
}

/**
 * Helper: แปลง Prisma OrderAddon model
 */
function mapPrismaToOrderAddon(addon: any): import('./types').OrderAddon {
  return {
    id: addon.id,
    order_id: addon.orderId,
    addon_type_id: addon.addonTypeId,
    addon_code: addon.addonCode,
    addon_name: addon.addonName,
    quantity: addon.quantity,
    unit_price: Number(addon.unitPrice),
    total_price: Number(addon.totalPrice),
    status: addon.status,
    design_file_url: addon.designFileUrl,
    notes: addon.notes,
    created_at: addon.createdAt.toISOString(),
  }
}

