/**
 * React Query Hooks สำหรับ Addon Management
 */

import { useQuery } from '@tanstack/react-query'
import { getAddonTypes, getAddonTypesByCategory } from '../client-service'

// Query Keys
export const addonKeys = {
  all: ['addons'] as const,
  types: () => [...addonKeys.all, 'types'] as const,
  byCategory: (category: string) => [...addonKeys.types(), category] as const,
}

/**
 * Hook: ดึงรายการ Addon Types ทั้งหมด
 */
export function useAddonTypes() {
  return useQuery({
    queryKey: addonKeys.types(),
    queryFn: () => getAddonTypes(),
    staleTime: 5 * 60 * 1000, // 5 minutes (addon types ไม่ค่อยเปลี่ยน)
  })
}

/**
 * Hook: ดึง Addon Types ตาม Category
 */
export function useAddonTypesByCategory(category: string) {
  return useQuery({
    queryKey: addonKeys.byCategory(category),
    queryFn: () => getAddonTypesByCategory(category),
    staleTime: 5 * 60 * 1000,
  })
}

