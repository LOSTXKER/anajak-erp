'use client'

/**
 * Order List Page
 * หน้าแสดงรายการออเดอร์ทั้งหมด
 */

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useOrders } from '@/features/orders/hooks/useOrders'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Eye, Package, Loader2, Calendar, User, Phone } from 'lucide-react'
import type { Order } from '@/features/orders/types'
import Link from 'next/link'

export default function OrdersPage() {
  const [search, setSearch] = useState('')
  const { data: orders, isLoading, error } = useOrders()

  // Filter orders based on search
  const filteredOrders = orders?.filter((order) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(searchLower) ||
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.customer_phone?.includes(search)
    )
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Main Content */}
      <main className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              ออเดอร์ (Orders)
            </h1>
            <p className="text-slate-500 mt-1">รายการออเดอร์ทั้งหมด</p>
          </div>
          <Link href="/orders/create">
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" /> สร้างออเดอร์ใหม่
            </Button>
          </Link>
        </div>

        {/* Search & Stats */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ค้นหาออเดอร์ (เลขที่, ลูกค้า, เบอร์)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline" className="px-3 py-2">
            {filteredOrders?.length || 0} ออเดอร์
          </Badge>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <p className="font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
              <p className="text-sm mt-1">กรุณาลองใหม่อีกครั้ง</p>
            </div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>กำหนดส่ง</TableHead>
                  <TableHead className="text-right">ยอดเงิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>การชำระ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">ยังไม่มีออเดอร์ในระบบ</p>
              <p className="text-sm mt-1">กดปุ่ม "สร้างออเดอร์ใหม่" เพื่อเริ่มต้น</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// Order Row Component
function OrderRow({ order }: { order: Order }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-blue-100 text-blue-700 border-blue-200',
    in_production: 'bg-purple-100 text-purple-700 border-purple-200',
    qc: 'bg-orange-100 text-orange-700 border-orange-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    shipped: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
  }

  const paymentColors: Record<string, string> = {
    unpaid: 'bg-rose-100 text-rose-700 border-rose-200',
    partial: 'bg-amber-100 text-amber-700 border-amber-200',
    paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }

  const statusLabels: Record<string, string> = {
    draft: 'ร่าง',
    pending_approval: 'รออนุมัติ',
    approved: 'อนุมัติแล้ว',
    in_production: 'กำลังผลิต',
    qc: 'ตรวจสอบ',
    completed: 'เสร็จสิ้น',
    shipped: 'จัดส่งแล้ว',
    cancelled: 'ยกเลิก',
  }

  const paymentLabels: Record<string, string> = {
    unpaid: 'ยังไม่ชำระ',
    partial: 'ชำระบางส่วน',
    paid: 'ชำระแล้ว',
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm font-medium">
        {order.order_number}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-slate-400" />
            <span className="font-medium">{order.customer_name}</span>
          </div>
          {order.customer_phone && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{order.customer_phone}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {order.items?.length || 0} รายการ
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-slate-600">
        {new Date(order.order_date).toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })}
      </TableCell>
      <TableCell>
        {order.due_date ? (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-3 h-3 text-slate-400" />
            {new Date(order.due_date).toLocaleDateString('th-TH', {
              day: 'numeric',
              month: 'short'
            })}
          </div>
        ) : (
          <span className="text-slate-400 text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono font-medium">
        ฿{order.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusColors[order.status]}>
          {statusLabels[order.status] || order.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={paymentColors[order.payment_status]}>
          {paymentLabels[order.payment_status]}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Link href={`/orders/${order.id}`}>
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  )
}

