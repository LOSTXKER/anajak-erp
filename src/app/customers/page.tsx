'use client'

/**
 * Customer List Page
 * หน้าแสดงรายการลูกค้าทั้งหมด พร้อม CRUD operations
 */

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useCustomers, useDeleteCustomer } from '@/features/customers/hooks/useCustomers'
import { CustomerFormDialog } from '@/features/customers/components/customer-form-dialog'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Phone, Mail, Building2, User, Edit, Trash2, Loader2, Users, TrendingUp, Star } from 'lucide-react'
import type { Customer } from '@/features/customers/types'

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  
  const { data: customers, isLoading, error } = useCustomers()
  const deleteMutation = useDeleteCustomer()

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedCustomer(null)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบลูกค้ารายนี้?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบลูกค้า')
      }
    }
  }

  // Filter customers based on search
  const filteredCustomers = customers?.filter((customer) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      customer.contact_person.toLowerCase().includes(searchLower) ||
      customer.phone.includes(search) ||
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.customer_code.toLowerCase().includes(searchLower) ||
      customer.company_name?.toLowerCase().includes(searchLower)
    )
  })

  // Stats
  const totalCustomers = customers?.length || 0
  const vipCustomers = customers?.filter(c => c.customer_tier === 'vip').length || 0
  const totalRevenue = customers?.reduce((sum, c) => sum + c.total_revenue, 0) || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <Navbar />

      {/* Main Content */}
      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              จัดการลูกค้า
            </h1>
            <p className="text-slate-500 mt-1 ml-14">เพิ่ม แก้ไข และจัดการข้อมูลลูกค้าทั้งหมด</p>
          </div>
          <Button 
            size="lg" 
            onClick={handleAdd}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25"
          >
            <Plus className="mr-2 h-5 w-5" /> เพิ่มลูกค้าใหม่
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">ลูกค้าทั้งหมด</p>
                  <p className="text-2xl font-bold text-slate-900">{totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Star className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">ลูกค้า VIP</p>
                  <p className="text-2xl font-bold text-amber-600">{vipCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">ยอดขายรวม</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    ฿{totalRevenue.toLocaleString('th-TH')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="ค้นหาลูกค้า (ชื่อ, เบอร์, อีเมล, รหัส)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
              <Badge variant="secondary" className="px-4 py-2 bg-slate-100">
                {filteredCustomers?.length || 0} รายการ
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm bg-white/90 backdrop-blur overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto mb-3" />
                <p className="text-slate-500">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <p className="font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
              <p className="text-sm mt-1">กรุณาลองใหม่อีกครั้ง</p>
            </div>
          ) : filteredCustomers && filteredCustomers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold">รหัส</TableHead>
                  <TableHead className="font-semibold">ลูกค้า</TableHead>
                  <TableHead className="font-semibold">ติดต่อ</TableHead>
                  <TableHead className="font-semibold">ประเภท</TableHead>
                  <TableHead className="font-semibold">ระดับ</TableHead>
                  <TableHead className="text-right font-semibold">ยอดซื้อ</TableHead>
                  <TableHead className="text-right font-semibold">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <CustomerRow 
                    key={customer.id} 
                    customer={customer}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="p-4 bg-slate-100 rounded-full mb-4">
                <User className="w-10 h-10 opacity-50" />
              </div>
              <p className="font-medium text-slate-600">ยังไม่มีลูกค้าในระบบ</p>
              <p className="text-sm mt-1 mb-4">กดปุ่ม "เพิ่มลูกค้าใหม่" เพื่อเริ่มต้น</p>
              <Button onClick={handleAdd} variant="outline">
                <Plus className="w-4 h-4 mr-2" /> เพิ่มลูกค้าใหม่
              </Button>
            </div>
          )}
        </Card>

        {/* Customer Form Dialog */}
        <CustomerFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          customer={selectedCustomer}
          onSuccess={() => {
            setDialogOpen(false)
            setSelectedCustomer(null)
          }}
        />
      </main>
    </div>
  )
}

// Customer Row Component
function CustomerRow({ 
  customer, 
  onEdit, 
  onDelete 
}: { 
  customer: Customer
  onEdit: (customer: Customer) => void
  onDelete: (id: string) => void
}) {
  const tierColors: Record<string, string> = {
    vip: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border-amber-200',
    standard: 'bg-blue-50 text-blue-700 border-blue-200',
    new: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  const typeConfig: Record<string, { icon: React.ReactNode; label: string }> = {
    individual: { icon: <User className="w-4 h-4" />, label: 'บุคคล' },
    business: { icon: <Building2 className="w-4 h-4" />, label: 'ธุรกิจ' },
    reseller: { icon: <Building2 className="w-4 h-4" />, label: 'ตัวแทน' },
  }

  return (
    <TableRow className="hover:bg-slate-50/50 transition-colors">
      <TableCell className="font-mono text-sm font-semibold text-slate-700">
        {customer.customer_code}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
            {(customer.company_name || customer.contact_person).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-900">{customer.company_name || customer.contact_person}</p>
            {customer.company_name && (
              <p className="text-sm text-slate-500">{customer.contact_person}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-700">{customer.phone}</span>
          </div>
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{customer.email}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-slate-600">
          {typeConfig[customer.customer_type]?.icon}
          <span className="text-sm">{typeConfig[customer.customer_type]?.label}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={`${tierColors[customer.customer_tier]} font-semibold`}>
          {customer.customer_tier === 'vip' && <Star className="w-3 h-3 mr-1" />}
          {customer.customer_tier.toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-semibold text-slate-900">
          ฿{customer.total_revenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => onEdit(customer)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
            onClick={() => onDelete(customer.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
