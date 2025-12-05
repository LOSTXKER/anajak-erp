/**
 * React Query Hooks สำหรับ Order Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getOrders, 
  getOrderById, 
  createOrder, 
  updateOrder,
  deleteOrder
} from '../client-service'
import type { CreateOrderInput, UpdateOrderInput, OrderFilters } from '../types'

// Query Keys
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters?: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  summary: () => [...orderKeys.all, 'summary'] as const,
}

/**
 * Hook: ดึงรายการออเดอร์ทั้งหมด
 */
export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => getOrders(filters),
  })
}

/**
 * Hook: ดึงข้อมูลออเดอร์ตาม ID
 */
export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrderById(id),
    enabled: !!id,
  })
}

/**
 * Hook: สร้างออเดอร์ใหม่
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      queryClient.invalidateQueries({ queryKey: orderKeys.summary() })
    },
  })
}

/**
 * Hook: อัปเดตออเดอร์
 */
export function useUpdateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateOrderInput) => {
      const { id, ...data } = input
      return updateOrder(id, data)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(data.id) })
    },
  })
}

/**
 * Hook: อัปเดตสถานะออเดอร์
 */
// TODO: Implement updateOrderStatus in client-service
// export function useUpdateOrderStatus() {
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: ({ id, status }: { id: string; status: string }) => 
//       updateOrderStatus(id, status),
//     onSuccess: (data) => {
//       queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
//       queryClient.invalidateQueries({ queryKey: orderKeys.detail(data.id) })
//       queryClient.invalidateQueries({ queryKey: orderKeys.summary() })
//     },
//   })
// }

/**
 * Hook: ลบออเดอร์
 */
export function useDeleteOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      queryClient.invalidateQueries({ queryKey: orderKeys.summary() })
    },
  })
}

/**
 * Hook: ดึงสรุปออเดอร์สำหรับ Dashboard
 */
// TODO: Implement getOrderSummary in client-service
// export function useOrderSummary() {
//   return useQuery({
//     queryKey: orderKeys.summary(),
//     queryFn: () => getOrderSummary(),
//     staleTime: 30 * 1000, // 30 seconds
//   })
// }

