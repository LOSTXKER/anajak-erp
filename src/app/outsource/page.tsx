/**
 * Outsource Management Page
 */

'use client'

import { useEffect, useState } from 'react'
import { Truck, Plus, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OutsourcePage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/outsource/jobs').then(res => res.json()),
      fetch('/api/outsource/vendors').then(res => res.json())
    ]).then(([jobsData, vendorsData]) => {
      setJobs(jobsData)
      setVendors(vendorsData)
      setLoading(false)
    })
  }, [])

  const statusConfig = {
    pending: { label: 'รอส่ง', color: 'bg-yellow-100 text-yellow-700' },
    sent: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'กำลังทำ', color: 'bg-purple-100 text-purple-700' },
    completed: { label: 'เสร็จแล้ว', color: 'bg-cyan-100 text-cyan-700' },
    returned: { label: 'รับคืนแล้ว', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'ปฏิเสธ', color: 'bg-red-100 text-red-700' },
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Truck className="h-8 w-8 text-orange-600" />
            ระบบส่งงานนอก
          </h1>
          <p className="text-gray-500 mt-1">จัดการงานที่ส่งโรงนอกและผู้รับจ้าง</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มผู้รับจ้าง
          </Button>
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-2" />
            ส่งงานนอก
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">งานทั้งหมด</p>
          <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">กำลังทำ</p>
          <p className="text-2xl font-bold text-purple-600">
            {jobs.filter(j => j.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">ผู้รับจ้าง</p>
          <p className="text-2xl font-bold text-orange-600">{vendors.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">เสร็จสิ้น</p>
          <p className="text-2xl font-bold text-green-600">
            {jobs.filter(j => j.status === 'returned').length}
          </p>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่งาน</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ออเดอร์</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้รับจ้าง</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภทงาน</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ราคา</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>ยังไม่มีงานส่งนอก</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const config = statusConfig[job.status as keyof typeof statusConfig]

                  return (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {job.jobNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>{job.order?.orderNumber}</div>
                        <div className="text-gray-500">{job.order?.customerName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">{job.vendor?.name}</div>
                        <div className="text-gray-500">{job.vendor?.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {job.workType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {job.quantity} ชิ้น
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-blue-600">
                        ฿{Number(job.totalPrice).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full ${config.color}`}>
                          <span className="text-sm font-medium">{config.label}</span>
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

