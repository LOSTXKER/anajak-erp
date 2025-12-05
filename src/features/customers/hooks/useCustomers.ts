/**
 * React Query Hooks สำหรับ Customer Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getCustomers, 
  getCustomerById, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer 
} from '../client-service'
import type { CreateCustomerInput, UpdateCustomerInput, CustomerFilters } from '../types'

// Query Keys
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters?: CustomerFilters) => [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

/**
 * Hook: ดึงรายการลูกค้าทั้งหมด
 */
export function useCustomers(filters?: CustomerFilters) {
  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: () => getCustomers(filters),
  })
}

/**
 * Hook: ดึงข้อมูลลูกค้าตาม ID
 */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => getCustomerById(id),
    enabled: !!id,
  })
}

/**
 * Hook: สร้างลูกค้าใหม่
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCustomerInput) => createCustomer(input),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

/**
 * Hook: อัปเดตข้อมูลลูกค้า
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateCustomerInput) => {
      const { id, ...data } = input
      return updateCustomer(id, data)
    },
    onSuccess: (data) => {
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      // Update specific customer cache
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(data.id) })
    },
  })
}

/**
 * Hook: ลบลูกค้า
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

