'use client'

/**
 * Change History Timeline
 * แสดงประวัติ Change Requests ทั้งหมดของออเดอร์
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign,
  Calendar,
  FileText,
  AlertCircle
} from 'lucide-react'
import type { ChangeRequest } from '../types'

interface ChangeHistoryTimelineProps {
  changeRequests: ChangeRequest[]
  onApprove?: (id: string) => Promise<void>
  onReject?: (id: string) => Promise<void>
  showActions?: boolean
}

export function ChangeHistoryTimeline({
  changeRequests,
  onApprove,
  onReject,
  showActions = false
}: ChangeHistoryTimelineProps) {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { icon: any; label: string; className: string }> = {
      pending: { 
        icon: Clock, 
        label: 'รอใบเสนอราคา', 
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200' 
      },
      quoted: { 
        icon: DollarSign, 
        label: 'รอลูกค้าอนุมัติ', 
        className: 'bg-blue-100 text-blue-700 border-blue-200' 
      },
      approved: { 
        icon: CheckCircle2, 
        label: 'อนุมัติแล้ว', 
        className: 'bg-green-100 text-green-700 border-green-200' 
      },
      rejected: { 
        icon: XCircle, 
        label: 'ปฏิเสธ', 
        className: 'bg-red-100 text-red-700 border-red-200' 
      },
      in_progress: { 
        icon: Clock, 
        label: 'กำลังดำเนินการ', 
        className: 'bg-purple-100 text-purple-700 border-purple-200' 
      },
      completed: { 
        icon: CheckCircle2, 
        label: 'เสร็จสิ้น', 
        className: 'bg-teal-100 text-teal-700 border-teal-200' 
      },
    }
    return configs[status] || configs.pending
  }

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      design_change: '🎨 เปลี่ยนดีไซน์',
      quantity_change: '📊 เปลี่ยนจำนวน',
      spec_change: '📐 เปลี่ยนสเปค',
      add_item: '➕ เพิ่มรายการ',
      remove_item: '➖ ลบรายการ',
      addon_change: '📦 เปลี่ยน Addon',
      other: '📝 อื่นๆ',
    }
    return labels[type] || type
  }

  if (changeRequests.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center h-48 text-slate-400">
          <FileText className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">ยังไม่มีการเปลี่ยนแปลง</p>
          <p className="text-sm mt-1">ออเดอร์นี้ยังไม่เคยถูกแก้ไข</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm bg-white/90 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          ประวัติการเปลี่ยนแปลง ({changeRequests.length} รายการ)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {changeRequests.map((request, index) => {
            const config = getStatusConfig(request.status)
            const StatusIcon = config.icon

            return (
              <div key={request.id} className="relative">
                {/* Timeline Connector */}
                {index < changeRequests.length - 1 && (
                  <div className="absolute left-5 top-12 w-px h-full bg-slate-200" />
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="relative z-10">
                    <div className={`p-2 rounded-full border-2 bg-white ${config.className}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-slate-700">
                            {request.request_number}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getChangeTypeLabel(request.change_type)}
                          </Badge>
                          <Badge className={config.className}>{config.label}</Badge>
                        </div>

                        {/* Description */}
                        <p className="text-slate-700 mt-2">{request.description}</p>
                        
                        {/* Customer Reason */}
                        {request.customer_reason && (
                          <p className="text-sm text-slate-500 mt-1 italic">
                            เหตุผล: {request.customer_reason}
                          </p>
                        )}

                        {/* Cost Breakdown (if quoted) */}
                        {request.status !== 'pending' && request.total_fee > 0 && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {request.base_fee > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600">ค่าดำเนินการ:</span>
                                  <span>฿{request.base_fee.toLocaleString()}</span>
                                </div>
                              )}
                              {request.design_fee > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600">ค่าดีไซน์:</span>
                                  <span>฿{request.design_fee.toLocaleString()}</span>
                                </div>
                              )}
                              {request.rework_fee > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600">ค่าทำใหม่:</span>
                                  <span>฿{request.rework_fee.toLocaleString()}</span>
                                </div>
                              )}
                              {request.material_fee > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600">ค่าวัสดุ:</span>
                                  <span>฿{request.material_fee.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
                              <span className="font-semibold text-slate-700">รวมทั้งสิ้น:</span>
                              <span className="text-lg font-bold text-blue-600">
                                ฿{request.total_fee.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Timeline Info */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(request.created_at).toLocaleDateString('th-TH')}
                          </span>
                          {request.days_delayed > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <AlertCircle className="w-3 h-3" />
                              เลื่อน {request.days_delayed} วัน
                            </span>
                          )}
                        </div>

                        {/* Actions (for quoted status) */}
                        {showActions && request.status === 'quoted' && onApprove && onReject && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => onApprove(request.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReject(request.id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              ปฏิเสธ
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

