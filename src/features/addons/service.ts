/**
 * Addon Service (Prisma)
 * API calls สำหรับจัดการ Addons
 */

import prisma from '@/lib/prisma'
import type { AddonType } from './types'

/**
 * ดึงรายการ Addon Types ทั้งหมด
 */
export async function getAddonTypes(): Promise<AddonType[]> {
  const addons = await prisma.addonType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  })

  return addons.map(mapPrismaToAddonType)
}

/**
 * ดึง Addon Types ตาม Category
 */
export async function getAddonTypesByCategory(category: string): Promise<AddonType[]> {
  const addons = await prisma.addonType.findMany({
    where: { 
      category,
      isActive: true 
    },
    orderBy: { sortOrder: 'asc' }
  })

  return addons.map(mapPrismaToAddonType)
}

/**
 * Helper: แปลง Prisma model เป็น AddonType
 */
function mapPrismaToAddonType(addon: any): AddonType {
  return {
    id: addon.id,
    code: addon.code,
    name: addon.name,
    name_th: addon.nameTh,
    category: addon.category,
    base_price: Number(addon.basePrice),
    price_type: addon.priceType,
    requires_design: addon.requiresDesign,
    requires_material: addon.requiresMaterial,
    sort_order: addon.sortOrder,
    is_active: addon.isActive,
    created_at: addon.createdAt.toISOString(),
  }
}

