'use client'

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/layout/navbar"
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  Plus, 
  Settings, 
  FileText, 
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Palette,
  Truck,
  Factory,
  Calendar
} from "lucide-react"
import { useOrders } from "@/features/orders/hooks/useOrders"
import { useCustomers } from "@/features/customers/hooks/useCustomers"
import { useProducts } from "@/features/products/hooks/useProducts"

export default function Home() {
  const { data: orders, isLoading: ordersLoading } = useOrders()
  const { data: customers } = useCustomers()
  const { data: products } = useProducts()

  // Calculate stats
  const totalOrders = orders?.length || 0
  const pendingOrders = orders?.filter(o => o.status === 'pending_approval').length || 0
  const inProduction = orders?.filter(o => o.status === 'in_production').length || 0
  const completedOrders = orders?.filter(o => o.status === 'completed').length || 0

  const recentOrders = orders?.slice(0, 5) || []

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: 'แบบร่าง', className: 'bg-slate-100 text-slate-700' },
      pending_approval: { label: 'รออนุมัติ', className: 'bg-yellow-100 text-yellow-700' },
      approved: { label: 'อนุมัติแล้ว', className: 'bg-blue-100 text-blue-700' },
      in_production: { label: 'กำลังผลิต', className: 'bg-purple-100 text-purple-700' },
      qc: { label: 'ตรวจ QC', className: 'bg-orange-100 text-orange-700' },
      completed: { label: 'เสร็จสิ้น', className: 'bg-green-100 text-green-700' },
      shipped: { label: 'จัดส่งแล้ว', className: 'bg-teal-100 text-teal-700' },
      cancelled: { label: 'ยกเลิก', className: 'bg-red-100 text-red-700' },
    }
    const { label, className } = config[status] || config.draft
    return <Badge className={className}>{label}</Badge>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Navbar />

      {/* Main Content */}
      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Header with Gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 md:p-8 text-white shadow-xl">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-blue-200 text-sm font-medium mb-1">
                  {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  สวัสดี! ยินดีต้อนรับสู่ Anajak ERP
                </h1>
                <p className="text-blue-100 mt-2 text-sm md:text-base">
                  ระบบจัดการโรงงานผลิตเสื้อครบวงจร
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/orders/create">
                  <Button className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg">
                    <Plus className="mr-2 h-4 w-4" /> สร้างออเดอร์ใหม่
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -right-20 -bottom-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">ออเดอร์ทั้งหมด</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{totalOrders}</p>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" /> เดือนนี้
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">รออนุมัติ</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{pendingOrders}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> รอดำเนินการ
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-xl group-hover:bg-yellow-200 transition-colors">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">กำลังผลิต</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">{inProduction}</p>
                  <p className="text-xs text-purple-600 mt-1 flex items-center">
                    <Factory className="w-3 h-3 mr-1" /> ในไลน์ผลิต
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">เสร็จสิ้น</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">{completedOrders}</p>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> พร้อมส่ง
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Orders */}
          <Card className="lg:col-span-2 border-0 shadow-sm bg-white/90 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  ออเดอร์ล่าสุด
                </CardTitle>
                <Link href="/orders">
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                    ดูทั้งหมด <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div 
                      key={order.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {order.order_number?.slice(-3) || '#'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{order.customer_name}</p>
                          <p className="text-sm text-slate-500">
                            {order.order_number} • {order.items?.length || 0} รายการ
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="font-semibold text-slate-900">
                            ฿{order.total_amount.toLocaleString('th-TH')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(order.order_date).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                  <p className="font-medium">ยังไม่มีออเดอร์</p>
                  <Link href="/orders/create">
                    <Button variant="outline" size="sm" className="mt-3">
                      <Plus className="w-4 h-4 mr-2" /> สร้างออเดอร์แรก
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions & Stats */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-0 shadow-sm bg-white/90 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">เมนูลัด</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Link href="/orders/create">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200/50 transition-all cursor-pointer group">
                    <Plus className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-medium text-blue-900">สร้างออเดอร์</p>
                  </div>
                </Link>
                <Link href="/customers">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:from-emerald-100 hover:to-emerald-200/50 transition-all cursor-pointer group">
                    <Users className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-medium text-emerald-900">ลูกค้า</p>
                  </div>
                </Link>
                <Link href="/products">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 hover:from-purple-100 hover:to-purple-200/50 transition-all cursor-pointer group">
                    <Package className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-medium text-purple-900">สินค้า</p>
                  </div>
                </Link>
                <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 hover:from-orange-100 hover:to-orange-200/50 transition-all cursor-pointer group">
                  <FileText className="w-6 h-6 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium text-orange-900">รายงาน</p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-0 shadow-sm bg-white/90 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">สรุปข้อมูล</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-slate-600">ลูกค้าทั้งหมด</span>
                  </div>
                  <span className="font-bold text-slate-900">{customers?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Package className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-sm text-slate-600">สินค้าทั้งหมด</span>
                  </div>
                  <span className="font-bold text-slate-900">{products?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm text-slate-600">ออเดอร์เดือนนี้</span>
                  </div>
                  <span className="font-bold text-slate-900">{totalOrders}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Production Pipeline */}
        <Card className="border-0 shadow-sm bg-white/90 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Factory className="w-5 h-5 text-purple-600" />
              Production Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'รอดีไซน์', count: 0, color: 'bg-slate-100 text-slate-600', icon: Palette },
                { label: 'รออนุมัติ', count: pendingOrders, color: 'bg-yellow-100 text-yellow-700', icon: Clock },
                { label: 'กำลังผลิต', count: inProduction, color: 'bg-purple-100 text-purple-700', icon: Factory },
                { label: 'ตรวจ QC', count: 0, color: 'bg-orange-100 text-orange-700', icon: CheckCircle2 },
                { label: 'พร้อมส่ง', count: completedOrders, color: 'bg-emerald-100 text-emerald-700', icon: Truck },
              ].map((stage, i) => (
                <div key={i} className="text-center">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${stage.color} mb-2`}>
                    <stage.icon className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stage.count}</p>
                  <p className="text-xs text-slate-500">{stage.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
