'use client'

/**
 * Production Queue Interface
 * แสดงคิวงานผลิตเรียงตาม Priority Score
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Factory, 
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  User
} from 'lucide-react'
import type { ProductionJob } from '../types'

interface ProductionQueueProps {
  jobs: ProductionJob[]
  onStartJob?: (jobId: string) => void
  onCompleteJob?: (jobId: string) => void
}

export function ProductionQueue({ jobs, onStartJob, onCompleteJob }: ProductionQueueProps) {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { icon: any; label: string; className: string }> = {
      queued: { icon: Clock, label: 'รอคิว', className: 'bg-slate-100 text-slate-700' },
      ready: { icon: CheckCircle2, label: 'พร้อมผลิต', className: 'bg-blue-100 text-blue-700' },
      in_progress: { icon: Factory, label: 'กำลังผลิต', className: 'bg-purple-100 text-purple-700' },
      paused: { icon: Pause, label: 'หยุดชั่วคราว', className: 'bg-yellow-100 text-yellow-700' },
      qc: { icon: AlertTriangle, label: 'ตรวจ QC', className: 'bg-orange-100 text-orange-700' },
      completed: { icon: CheckCircle2, label: 'เสร็จสิ้น', className: 'bg-green-100 text-green-700' },
      failed: { icon: AlertTriangle, label: 'ไม่ผ่าน', className: 'bg-red-100 text-red-700' },
    }
    return configs[status] || configs.queued
  }

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'from-red-500 to-rose-600'
    if (score >= 60) return 'from-orange-500 to-amber-600'
    if (score >= 40) return 'from-yellow-500 to-amber-500'
    return 'from-blue-500 to-cyan-600'
  }

  const getPriorityLabel = (score: number) => {
    if (score >= 80) return 'URGENT'
    if (score >= 60) return 'HIGH'
    if (score >= 40) return 'MEDIUM'
    return 'NORMAL'
  }

  return (
    <Card className="border-0 shadow-sm bg-white/90 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Factory className="w-5 h-5 text-purple-600" />
            Production Queue
          </CardTitle>
          <Badge variant="secondary">{jobs.length} งาน</Badge>
        </div>
      </CardHeader>

      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">ไม่มีงานในคิว</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job, index) => {
              const config = getStatusConfig(job.status)
              const StatusIcon = config.icon

              return (
                <div
                  key={job.id}
                  className="group relative p-4 rounded-xl border-2 bg-gradient-to-r from-white to-slate-50/50 hover:shadow-md transition-all"
                >
                  {/* Priority Badge (Top-right) */}
                  <div className="absolute top-2 right-2">
                    <div className={`px-2 py-1 rounded-lg bg-gradient-to-r ${getPriorityColor(job.priority_score)} text-white text-xs font-bold shadow-lg`}>
                      {getPriorityLabel(job.priority_score)} {job.priority_score}
                    </div>
                  </div>

                  {/* Queue Number */}
                  <div className="absolute -left-3 top-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-lg">
                      {index + 1}
                    </div>
                  </div>

                  <div className="ml-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-slate-700">
                            {job.job_number}
                          </span>
                          <Badge className={config.className}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-slate-900">{job.work_name}</h3>
                        <p className="text-sm text-slate-500">{job.work_type}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">จำนวน:</p>
                        <p className="font-semibold text-slate-900">{job.quantity} ชิ้น</p>
                      </div>
                      {job.assigned_to && (
                        <div>
                          <p className="text-slate-500">ผู้รับผิดชอบ:</p>
                          <p className="font-semibold text-slate-900 flex items-center gap-1">
                            <User className="w-3 h-3" /> Worker
                          </p>
                        </div>
                      )}
                      {job.actual_quantity > 0 && (
                        <div>
                          <p className="text-slate-500">ทำได้:</p>
                          <p className="font-semibold text-emerald-600">
                            {job.actual_quantity} / {job.quantity}
                          </p>
                        </div>
                      )}
                      {job.defect_quantity > 0 && (
                        <div>
                          <p className="text-slate-500">เสีย:</p>
                          <p className="font-semibold text-red-600">{job.defect_quantity} ชิ้น</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {onStartJob && onCompleteJob && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                        {job.status === 'queued' || job.status === 'ready' ? (
                          <Button
                            size="sm"
                            onClick={() => onStartJob(job.id)}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            เริ่มผลิต
                          </Button>
                        ) : job.status === 'in_progress' ? (
                          <Button
                            size="sm"
                            onClick={() => onCompleteJob(job.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            เสร็จสิ้น
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

