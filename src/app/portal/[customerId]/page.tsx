/**
 * Customer Portal - ลูกค้าดูสถานะออเดอร์
 * Route: /portal/[customerId]
 */

'use client'

import { use, useState } from 'react'
import { Package, Truck, Clock, CheckCircle, FileText } from 'lucide-react'

interface CustomerPortalProps {
  params: Promise<{ customerId: string }>
}

export default function CustomerPortal({ params }: CustomerPortalProps) {
  const { customerId } = use(params)
  const [customer, setCustomer] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch customer and orders
  useState(() => {
    fetch(`/api/customers`)
      .then(res => res.json())
      .then(data => {
        const found = data.find((c: any) => c.id === customerId)
        setCustomer(found)
      })

    fetch(`/api/orders?customerId=${customerId}`)
      .then(res => res.json())
      .then(data => {
        setOrders(data)
        setLoading(false)
      })
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">ไม่พบข้อมูลลูกค้า</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {customer.companyName || customer.contactPerson}
              </h1>
              <p className="text-gray-500 mt-1">รหัสลูกค้า: {customer.customerCode}</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">{orders.length} ออเดอร์</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {orders.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">ยังไม่มีออเดอร์</h3>
              <p className="text-gray-500">เมื่อมีการสร้างออเดอร์ จะแสดงที่นี่</p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order }: { order: any }) {
  const statusConfig = {
    draft: { label: 'ร่าง', color: 'bg-gray-100 text-gray-700', icon: FileText },
    pending_approval: { label: 'รออนุมัติ', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    approved: { label: 'อนุมัติแล้ว', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    in_production: { label: 'กำลังผลิต', color: 'bg-purple-100 text-purple-700', icon: Package },
    qc_checking: { label: 'ตรวจสอบ QC', color: 'bg-orange-100 text-orange-700', icon: Package },
    ready_to_ship: { label: 'พร้อมส่ง', color: 'bg-green-100 text-green-700', icon: Truck },
    shipped: { label: 'จัดส่งแล้ว', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
    completed: { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700', icon: FileText },
  }

  const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.draft
  const Icon = config.icon

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{order.orderNumber}</h3>
            <p className="text-sm text-gray-500 mt-1">
              สร้างเมื่อ {new Date(order.createdAt).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.color}`}>
            <Icon className="h-4 w-4" />
            <span className="font-medium text-sm">{config.label}</span>
          </div>
        </div>

        {/* Order Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 mb-1">ประเภทงาน</p>
            <p className="font-medium text-gray-900">{order.orderTypeCode || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">กำหนดส่ง</p>
            <p className="font-medium text-gray-900">
              {order.dueDate ? new Date(order.dueDate).toLocaleDateString('th-TH') : 'ไม่ระบุ'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">จำนวนเงิน</p>
            <p className="font-medium text-blue-600">
              ฿{Number(order.totalAmount || 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">ชำระแล้ว</p>
            <p className="font-medium text-green-600">
              ฿{Number(order.paidAmount || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="relative pt-4">
          <div className="flex items-center justify-between">
            <TimelineStep 
              label="สร้างออเดอร์" 
              active={true} 
              completed={true}
            />
            <TimelineStep 
              label="อนุมัติ" 
              active={['approved', 'in_production', 'qc_checking', 'ready_to_ship', 'shipped', 'completed'].includes(order.status)}
              completed={['approved', 'in_production', 'qc_checking', 'ready_to_ship', 'shipped', 'completed'].includes(order.status)}
            />
            <TimelineStep 
              label="ผลิต" 
              active={['in_production', 'qc_checking', 'ready_to_ship', 'shipped', 'completed'].includes(order.status)}
              completed={['qc_checking', 'ready_to_ship', 'shipped', 'completed'].includes(order.status)}
            />
            <TimelineStep 
              label="QC" 
              active={['qc_checking', 'ready_to_ship', 'shipped', 'completed'].includes(order.status)}
              completed={['ready_to_ship', 'shipped', 'completed'].includes(order.status)}
            />
            <TimelineStep 
              label="จัดส่ง" 
              active={['shipped', 'completed'].includes(order.status)}
              completed={order.status === 'completed'}
            />
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineStep({ label, active, completed }: { label: string, active: boolean, completed: boolean }) {
  return (
    <div className="flex flex-col items-center relative">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
        completed ? 'bg-green-500 border-green-500' :
        active ? 'bg-blue-500 border-blue-500' :
        'bg-white border-gray-300'
      }`}>
        {completed ? (
          <CheckCircle className="h-6 w-6 text-white" />
        ) : (
          <div className={`h-4 w-4 rounded-full ${active ? 'bg-white' : 'bg-gray-300'}`}></div>
        )}
      </div>
      <span className={`mt-2 text-xs font-medium whitespace-nowrap ${
        active ? 'text-gray-900' : 'text-gray-500'
      }`}>{label}</span>
    </div>
  )
}

