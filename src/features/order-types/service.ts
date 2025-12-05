/**
 * Order Types Service (Prisma)
 */

import prisma from '@/lib/prisma'
import type { OrderType, WorkType } from './types'

export async function getAllOrderTypes(): Promise<OrderType[]> {
  console.log('[Service] getAllOrderTypes called')
  try {
    const types = await prisma.orderType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    })
    console.log('[Service] Found types:', types.length)
    return types.map(mapPrismaToOrderType)
  } catch (error: any) {
    console.error('[Service] Prisma error:', error?.message)
    throw error
  }
}

export async function getWorkTypesByCategory(category?: string): Promise<WorkType[]> {
  const types = await prisma.workType.findMany({
    where: {
      isActive: true,
      ...(category && { category })
    },
    orderBy: [
      { category: 'asc' },
      { sortOrder: 'asc' }
    ]
  })

  return types.map(mapPrismaToWorkType)
}

export async function getWorkTypeById(id: string): Promise<WorkType | null> {
  const type = await prisma.workType.findUnique({
    where: { id }
  })

  return type ? mapPrismaToWorkType(type) : null
}

function mapPrismaToOrderType(type: any): OrderType {
  return {
    id: type.id,
    code: type.code,
    name: type.name,
    name_th: type.nameTh,
    description: type.description,
    default_lead_days: type.defaultLeadDays,
    requires_pattern: type.requiresPattern,
    requires_fabric: type.requiresFabric,
    sort_order: type.sortOrder,
    is_active: type.isActive,
    created_at: type.createdAt.toISOString(),
  }
}

function mapPrismaToWorkType(type: any): WorkType {
  return {
    id: type.id,
    code: type.code,
    name: type.name,
    name_th: type.nameTh,
    category: type.category,
    requires_design: type.requiresDesign,
    requires_material: type.requiresMaterial,
    default_price: Number(type.defaultPrice),
    sort_order: type.sortOrder,
    is_active: type.isActive,
    created_at: type.createdAt.toISOString(),
  }
}

