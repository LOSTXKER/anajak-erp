/**
 * Production Issues Page
 */

'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Plus, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function IssuesPage() {
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/issues')
      .then(res => res.json())
      .then(data => {
        setIssues(data)
        setLoading(false)
      })
  }, [])

  const severityConfig = {
    low: { label: 'ต่ำ', color: 'bg-gray-100 text-gray-700' },
    medium: { label: 'ปานกลาง', color: 'bg-yellow-100 text-yellow-700' },
    high: { label: 'สูง', color: 'bg-orange-100 text-orange-700' },
    critical: { label: 'วิกฤติ', color: 'bg-red-100 text-red-700' },
  }

  const statusConfig = {
    open: { label: 'เปิด', color: 'bg-red-100 text-red-700' },
    investigating: { label: 'กำลังตรวจสอบ', color: 'bg-yellow-100 text-yellow-700' },
    resolved: { label: 'แก้ไขแล้ว', color: 'bg-green-100 text-green-700' },
    closed: { label: 'ปิด', color: 'bg-gray-100 text-gray-500' },
  }

  const typeConfig: any = {
    defect: { label: 'ของเสีย', icon: '🔴' },
    material_shortage: { label: 'วัสดุขาด', icon: '📦' },
    machine_error: { label: 'เครื่องเสีย', icon: '⚙️' },
    human_error: { label: 'ความผิดพลาด', icon: '👤' },
    delay: { label: 'ล่าช้า', icon: '⏰' },
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            ปัญหาการผลิต
          </h1>
          <p className="text-gray-500 mt-1">ติดตามและแก้ไขปัญหาในการผลิต</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />
          รายงานปัญหา
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">{config.label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {issues.filter(i => i.status === key).length}
            </p>
          </div>
        ))}
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        {issues.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">ไม่มีปัญหา</h3>
            <p className="text-gray-500">ระบบการผลิตทำงานได้ดี 👍</p>
          </div>
        ) : (
          issues.map((issue) => {
            const severityConf = severityConfig[issue.severity as keyof typeof severityConfig]
            const statusConf = statusConfig[issue.status as keyof typeof statusConfig]
            const typeConf = typeConfig[issue.issueType] || { label: issue.issueType, icon: '❗' }

            return (
              <div key={issue.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{typeConf.icon}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{issue.title}</h3>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full ${severityConf.color}`}>
                        <span className="text-xs font-medium">{severityConf.label}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{issue.description}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span>📦 {issue.order?.orderNumber}</span>
                      <span>👤 {issue.order?.customerName}</span>
                      {issue.productionJob && (
                        <span>🏭 {issue.productionJob.workName}</span>
                      )}
                      <span>📅 {new Date(issue.reportedAt).toLocaleDateString('th-TH')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${statusConf.color}`}>
                      <span className="text-sm font-medium">{statusConf.label}</span>
                    </div>
                    {issue.affectedQuantity > 0 && (
                      <div className="text-sm text-red-600 font-medium">
                        ของเสีย: {issue.affectedQuantity} ชิ้น
                      </div>
                    )}
                  </div>
                </div>
                {issue.resolution && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                    <p className="text-sm text-green-900">
                      <strong>การแก้ไข:</strong> {issue.resolution}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

