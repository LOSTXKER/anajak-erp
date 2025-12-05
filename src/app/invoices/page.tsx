/**
 * Invoices Management Page
 */

'use client'

import { useEffect, useState } from 'react'
import { FileText, Plus, Eye, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/invoices')
      .then(res => res.json())
      .then(data => {
        setInvoices(data)
        setLoading(false)
      })
  }, [])

  const statusConfig = {
    draft: { label: 'ร่าง', color: 'bg-gray-100 text-gray-700' },
    sent: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700' },
    partial: { label: 'ชำระบางส่วน', color: 'bg-yellow-100 text-yellow-700' },
    paid: { label: 'ชำระครบ', color: 'bg-green-100 text-green-700' },
    overdue: { label: 'เกินกำหนด', color: 'bg-red-100 text-red-700' },
    cancelled: { label: 'ยกเลิก', color: 'bg-gray-100 text-gray-500' },
  }

  const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0)

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-purple-600" />
            ใบแจ้งหนี้
          </h1>
          <p className="text-gray-500 mt-1">จัดการใบแจ้งหนี้และรับชำระเงิน</p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          สร้างใบแจ้งหนี้
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">ทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">{invoices.length}</p>
              <p className="text-xs text-gray-500 mt-1">ใบแจ้งหนี้</p>
            </div>
            <div className="bg-purple-500 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">รับชำระแล้ว</p>
              <p className="text-3xl font-bold text-green-600">
                ฿{totalPaid.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">ยอดรวมที่ได้รับ</p>
            </div>
            <div className="bg-green-500 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">ค้างชำระ</p>
              <p className="text-3xl font-bold text-orange-600">
                ฿{totalOutstanding.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">ยอดที่ต้องรับ</p>
            </div>
            <div className="bg-orange-500 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ออเดอร์</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ยอดรวม</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชำระแล้ว</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">คงเหลือ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>ยังไม่มีใบแจ้งหนี้</p>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const config = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.draft

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.order?.orderNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {invoice.customer?.companyName || invoice.customer?.contactPerson}
                          </div>
                          <div className="text-gray-500">{invoice.customer?.customerCode}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">
                          ฿{Number(invoice.totalAmount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-green-600">
                          ฿{Number(invoice.paidAmount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-orange-600">
                          ฿{Number(invoice.balanceDue).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full ${config.color}`}>
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

