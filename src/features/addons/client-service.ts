/**
 * Addon Client Service (Fetch API)
 * API calls สำหรับ client-side components
 */

import type { AddonType } from './types'

const API_BASE = '/api/addons'

/**
 * ดึงรายการ Addon Types ทั้งหมด
 */
export async function getAddonTypes(): Promise<AddonType[]> {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error('Failed to fetch addon types')
  return res.json()
}

/**
 * ดึง Addon Types ตาม Category
 */
export async function getAddonTypesByCategory(category: string): Promise<AddonType[]> {
  const res = await fetch(`${API_BASE}?category=${category}`)
  if (!res.ok) throw new Error('Failed to fetch addon types')
  return res.json()
}

