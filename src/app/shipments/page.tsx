/**
 * Shipments Management Page
 */

'use client'

import { useEffect, useState } from 'react'
import { Truck, Plus, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shipments')
      .then(res => res.json())
      .then(data => {
        setShipments(data)
        setLoading(false)
      })
  }, [])

  const statusConfig = {
    pending: { label: 'รอจัดส่ง', color: 'bg-yellow-100 text-yellow-700' },
    preparing: { label: 'กำลังเตรียม', color: 'bg-blue-100 text-blue-700' },
    shipped: { label: 'จัดส่งแล้ว', color: 'bg-purple-100 text-purple-700' },
    in_transit: { label: 'ระหว่างขนส่ง', color: 'bg-cyan-100 text-cyan-700' },
    delivered: { label: 'ส่งถึงแล้ว', color: 'bg-green-100 text-green-700' },
    returned: { label: 'ส่งคืน', color: 'bg-red-100 text-red-700' },
  }

  const methodConfig = {
    pickup: { label: 'รับเอง', icon: '🏪' },
    delivery: { label: 'ส่งเอง', icon: '🚗' },
    courier: { label: 'ขนส่ง', icon: '📦' },
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Truck className="h-8 w-8 text-cyan-600" />
            ระบบจัดส่ง
          </h1>
          <p className="text-gray-500 mt-1">จัดการการจัดส่งและติดตามสถานะ</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="h-4 w-4 mr-2" />
          สร้างการจัดส่ง
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">รอจัดส่ง</p>
          <p className="text-2xl font-bold text-yellow-600">
            {shipments.filter(s => s.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">ระหว่างทาง</p>
          <p className="text-2xl font-bold text-cyan-600">
            {shipments.filter(s => ['shipped', 'in_transit'].includes(s.status)).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">ส่งถึงแล้ว</p>
          <p className="text-2xl font-bold text-green-600">
            {shipments.filter(s => s.status === 'delivered').length}
          </p>
        </div>
      </div>

      {/* Shipments List */}
      <div className="space-y-4">
        {shipments.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">ยังไม่มีการจัดส่ง</h3>
            <p className="text-gray-500">เมื่อมีออเดอร์พร้อมส่ง จะสามารถสร้างการจัดส่งได้</p>
          </div>
        ) : (
          shipments.map((shipment) => {
            const statusConf = statusConfig[shipment.status as keyof typeof statusConfig]
            const methodConf = methodConfig[shipment.shippingMethod as keyof typeof methodConfig]

            return (
              <div key={shipment.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{shipment.shipmentNumber}</h3>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full ${statusConf.color}`}>
                        <span className="text-sm font-medium">{statusConf.label}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">ออเดอร์</p>
                        <p className="font-medium text-gray-900">{shipment.order?.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">ลูกค้า</p>
                        <p className="font-medium text-gray-900">{shipment.order?.customerName}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">วิธีจัดส่ง</p>
                        <p className="font-medium text-gray-900">
                          {methodConf.icon} {methodConf.label}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">ผู้รับ</p>
                        <p className="font-medium text-gray-900">{shipment.recipientName}</p>
                        <p className="text-gray-500">{shipment.recipientPhone}</p>
                      </div>
                    </div>
                    {shipment.trackingNumber && (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-cyan-600" />
                        <span className="text-gray-500">Tracking:</span>
                        <span className="font-mono font-medium text-cyan-600">{shipment.trackingNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {shipment.scheduledDate && (
                      <div className="text-sm mb-2">
                        <p className="text-gray-500">กำหนดส่ง</p>
                        <p className="font-medium text-gray-900">
                          {new Date(shipment.scheduledDate).toLocaleDateString('th-TH')}
                        </p>
                        {shipment.scheduledTime && (
                          <p className="text-gray-500">{shipment.scheduledTime}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

