/**
 * Quotations Management Page
 */

'use client'

import { useEffect, useState } from 'react'
import { FileText, Plus, Eye, Check, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/quotations')
      .then(res => res.json())
      .then(data => {
        setQuotations(data)
        setLoading(false)
      })
  }, [])

  const statusConfig = {
    draft: { label: 'ร่าง', color: 'bg-gray-100 text-gray-700', icon: FileText },
    sent: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700', icon: Clock },
    approved: { label: 'อนุมัติ', color: 'bg-green-100 text-green-700', icon: Check },
    rejected: { label: 'ปฏิเสธ', color: 'bg-red-100 text-red-700', icon: X },
    expired: { label: 'หมดอายุ', color: 'bg-gray-100 text-gray-500', icon: Clock },
    converted: { label: 'แปลงเป็น Order', color: 'bg-purple-100 text-purple-700', icon: Check },
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            ใบเสนอราคา
          </h1>
          <p className="text-gray-500 mt-1">จัดการและติดตามใบเสนอราคาทั้งหมด</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          สร้างใบเสนอราคา
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">ทั้งหมด</p>
          <p className="text-2xl font-bold text-gray-900">{quotations.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">รอตอบรับ</p>
          <p className="text-2xl font-bold text-blue-600">
            {quotations.filter(q => q.status === 'sent').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">อนุมัติ</p>
          <p className="text-2xl font-bold text-green-600">
            {quotations.filter(q => q.status === 'approved').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">แปลงเป็น Order</p>
          <p className="text-2xl font-bold text-purple-600">
            {quotations.filter(q => q.status === 'converted').length}
          </p>
        </div>
      </div>

      {/* Quotations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวนเงิน</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ใช้ได้ถึง</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>ยังไม่มีใบเสนอราคา</p>
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => {
                  const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.draft
                  const Icon = config.icon

                  return (
                    <tr key={quotation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{quotation.quotationNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {quotation.customer?.companyName || quotation.customer?.contactPerson}
                          </div>
                          <div className="text-gray-500">{quotation.customer?.customerCode}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-semibold text-blue-600">
                          ฿{Number(quotation.totalAmount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {quotation.validUntil 
                          ? new Date(quotation.validUntil).toLocaleDateString('th-TH')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
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

import { CheckCircle, Clock } from 'lucide-react'

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color,
  large,
  subtitle
}: { 
  label: string
  value: string | number
  icon: any
  color: string
  large?: boolean
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`font-bold text-gray-900 ${large ? 'text-2xl' : 'text-xl'}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`${color} p-2 rounded-lg`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

