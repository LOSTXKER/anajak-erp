'use client'

/**
 * Approval Gates Tracker
 * แสดงสถานะ Approval Gates ทั้งหมดของออเดอร์
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, 
  Circle, 
  XCircle, 
  Clock,
  FileCheck,
  Image,
  PackageCheck,
  Truck
} from 'lucide-react'
import type { ApprovalGate } from '../types'

interface ApprovalGatesTrackerProps {
  gates: ApprovalGate[]
  orderId: string
}

export function ApprovalGatesTracker({ gates, orderId }: ApprovalGatesTrackerProps) {
  const getGateIcon = (gateType: string) => {
    const icons = {
      design_approval: FileCheck,
      mockup_approval: Image,
      sample_approval: PackageCheck,
      final_approval: CheckCircle2,
    }
    return icons[gateType as keyof typeof icons] || Circle
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />
      case 'skipped':
        return <Circle className="w-5 h-5 text-slate-400" />
      default:
        return <Circle className="w-5 h-5 text-slate-300" />
    }
  }

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'รอดำเนินการ', variant: 'default' as const, className: 'bg-yellow-500' },
      approved: { label: 'ผ่านแล้ว', variant: 'default' as const, className: 'bg-green-500' },
      rejected: { label: 'ปฏิเสธ', variant: 'destructive' as const, className: '' },
      skipped: { label: 'ข้าม', variant: 'secondary' as const, className: '' },
    }
    
    const { label, variant, className } = config[status as keyof typeof config] || config.pending
    
    return <Badge variant={variant} className={className || ''}>{label}</Badge>
  }

  const completedGates = gates.filter(g => g.status === 'approved').length
  const totalGates = gates.length
  const progress = totalGates > 0 ? (completedGates / totalGates) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Approval Gates</CardTitle>
          <div className="text-sm text-slate-600">
            {completedGates}/{totalGates} ผ่านแล้ว
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {gates.length === 0 ? (
          <p className="text-center text-slate-500 py-4">
            ยังไม่มี Approval Gates
          </p>
        ) : (
          gates.map((gate, index) => {
            const Icon = getGateIcon(gate.gate_type)
            
            return (
              <div
                key={gate.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50"
              >
                {/* Icon & Connector */}
                <div className="flex flex-col items-center">
                  <div className="p-2 bg-white rounded-full border-2">
                    <Icon className="w-5 h-5 text-slate-700" />
                  </div>
                  {index < gates.length - 1 && (
                    <div className="w-px h-8 bg-slate-300 my-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{gate.gate_name}</p>
                      {gate.notes && (
                        <p className="text-sm text-slate-600 mt-1">{gate.notes}</p>
                      )}
                      {gate.rejection_reason && (
                        <p className="text-sm text-red-600 mt-1">
                          ปฏิเสธ: {gate.rejection_reason}
                        </p>
                      )}
                      {gate.approved_at && (
                        <p className="text-xs text-slate-500 mt-1">
                          อนุมัติเมื่อ {new Date(gate.approved_at).toLocaleString('th-TH')}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(gate.status)}
                      {getStatusIcon(gate.status)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* All Gates Passed */}
        {completedGates === totalGates && totalGates > 0 && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">ผ่านทุก Gates แล้ว - พร้อมผลิต!</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

