/**
 * Procurement (Purchase Requests) Page
 */

'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, Plus, Package, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ProcurementPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/procurement/requests')
      .then(res => res.json())
      .then(data => {
        setRequests(data)
        setLoading(false)
      })
  }, [])

  const statusConfig = {
    pending: { label: 'รออนุมัติ', color: 'bg-yellow-100 text-yellow-700' },
    approved: { label: 'อนุมัติแล้ว', color: 'bg-blue-100 text-blue-700' },
    ordered: { label: 'สั่งซื้อแล้ว', color: 'bg-purple-100 text-purple-700' },
    received: { label: 'รับของแล้ว', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ยกเลิก', color: 'bg-gray-100 text-gray-500' },
  }

  const priorityConfig = {
    low: { label: 'ต่ำ', color: 'bg-gray-100 text-gray-600' },
    normal: { label: 'ปกติ', color: 'bg-blue-100 text-blue-600' },
    high: { label: 'สูง', color: 'bg-orange-100 text-orange-600' },
    urgent: { label: 'ด่วนมาก', color: 'bg-red-100 text-red-600' },
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-green-600" />
            ระบบจัดซื้อ
          </h1>
          <p className="text-gray-500 mt-1">จัดการคำขอซื้อวัสดุและติดตามสถานะ</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          สร้างคำขอซื้อ
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">{config.label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {requests.filter(r => r.status === key).length}
            </p>
          </div>
        ))}
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายการ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้จำหน่าย</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ราคา</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ความสำคัญ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>ยังไม่มีคำขอซื้อ</p>
                  </td>
                </tr>
              ) : (
                requests.map((request) => {
                  const statusConf = statusConfig[request.status as keyof typeof statusConfig]
                  const priorityConf = priorityConfig[request.priority as keyof typeof priorityConfig]

                  return (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {request.requestNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{request.itemName}</div>
                          {request.itemDescription && (
                            <div className="text-gray-500">{request.itemDescription}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Number(request.quantity).toLocaleString()} {request.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.supplier?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-blue-600">
                        ฿{Number(request.actualPrice || request.estimatedPrice).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full ${priorityConf.color}`}>
                          <span className="text-xs font-medium">{priorityConf.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full ${statusConf.color}`}>
                          <span className="text-sm font-medium">{statusConf.label}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

