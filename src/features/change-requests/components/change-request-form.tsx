'use client'

/**
 * Change Request Form
 * ฟอร์มขอเปลี่ยนแปลงออเดอร์
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Calculator, FileText, DollarSign } from 'lucide-react'
import type { ChangeType, OrderPhase } from '../types'

interface ChangeRequestFormProps {
  orderId: string
  orderNumber: string
  currentPhase: OrderPhase
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
}

export function ChangeRequestForm({
  orderId,
  orderNumber,
  currentPhase,
  onSubmit,
  onCancel
}: ChangeRequestFormProps) {
  const [changeType, setChangeType] = useState<ChangeType>('design_change')
  const [description, setDescription] = useState('')
  const [customerReason, setCustomerReason] = useState('')
  const [estimatedCost, setEstimatedCost] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const changeTypes = [
    { value: 'design_change', label: '🎨 เปลี่ยนดีไซน์', description: 'แก้ไขไฟล์ดีไซน์หรือสี' },
    { value: 'quantity_change', label: '📊 เปลี่ยนจำนวน', description: 'เพิ่มหรือลดจำนวนสินค้า' },
    { value: 'spec_change', label: '📐 เปลี่ยนสเปค', description: 'เปลี่ยนผ้า, สี, ไซส์' },
    { value: 'add_item', label: '➕ เพิ่มรายการ', description: 'เพิ่มสินค้าใหม่' },
    { value: 'remove_item', label: '➖ ลบรายการ', description: 'ลบสินค้าออก' },
    { value: 'addon_change', label: '📦 เปลี่ยน Addon', description: 'เปลี่ยนถุง/ป้าย/พับแพค' },
    { value: 'other', label: '📝 อื่นๆ', description: 'การเปลี่ยนแปลงอื่นๆ' },
  ]

  // Auto-calculate cost เมื่อเลือก change type
  useEffect(() => {
    calculateEstimatedCost()
  }, [changeType])

  const calculateEstimatedCost = async () => {
    // Simple estimation logic
    let baseFee = 200
    let designFee = 0
    let reworkFee = 0
    let materialFee = 0
    let daysDelayed = 0

    switch (changeType) {
      case 'design_change':
        designFee = currentPhase === 'design' ? 500 : currentPhase === 'pre_production' ? 2000 : 5000
        daysDelayed = currentPhase === 'design' ? 1 : currentPhase === 'pre_production' ? 3 : 7
        break
      case 'quantity_change':
        materialFee = 1000
        daysDelayed = 2
        break
      case 'spec_change':
        reworkFee = currentPhase === 'in_production' ? 3000 : 1000
        materialFee = 1000
        daysDelayed = currentPhase === 'in_production' ? 5 : 2
        break
      case 'add_item':
        designFee = 1000
        materialFee = 500
        daysDelayed = 2
        break
      case 'addon_change':
        baseFee = 100
        daysDelayed = 1
        break
      default:
        baseFee = 500
        daysDelayed = 1
    }

    setEstimatedCost({
      baseFee,
      designFee,
      reworkFee,
      materialFee,
      totalFee: baseFee + designFee + reworkFee + materialFee,
      daysDelayed
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim()) {
      alert('กรุณาระบุรายละเอียดการเปลี่ยนแปลง')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        order_id: orderId,
        order_phase: currentPhase,
        change_type: changeType,
        description,
        customer_reason: customerReason || undefined,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            ขอเปลี่ยนแปลงออเดอร์: {orderNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">ช่วงเวลา:</span>
            <Badge variant="outline">{currentPhase}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Change Type Selection */}
      <div className="space-y-2">
        <Label>ประเภทการเปลี่ยนแปลง</Label>
        <Select value={changeType} onValueChange={(v) => setChangeType(v as ChangeType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {changeTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <p className="font-medium">{type.label}</p>
                  <p className="text-xs text-slate-500">{type.description}</p>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>รายละเอียดการเปลี่ยนแปลง *</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ระบุรายละเอียดที่ต้องการเปลี่ยนแปลง..."
          rows={4}
          required
        />
      </div>

      {/* Customer Reason */}
      <div className="space-y-2">
        <Label>เหตุผลในการเปลี่ยนแปลง</Label>
        <Textarea
          value={customerReason}
          onChange={(e) => setCustomerReason(e.target.value)}
          placeholder="ทำไมต้องเปลี่ยนแปลง? (ไม่บังคับ)"
          rows={2}
        />
      </div>

      {/* Estimated Cost */}
      {estimatedCost && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <Calculator className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold text-yellow-900">ประมาณการค่าใช้จ่าย:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">ค่าดำเนินการ:</span>
                  <span className="font-medium">฿{estimatedCost.baseFee.toLocaleString()}</span>
                </div>
                {estimatedCost.designFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">ค่าดีไซน์:</span>
                    <span className="font-medium">฿{estimatedCost.designFee.toLocaleString()}</span>
                  </div>
                )}
                {estimatedCost.reworkFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">ค่าทำใหม่:</span>
                    <span className="font-medium">฿{estimatedCost.reworkFee.toLocaleString()}</span>
                  </div>
                )}
                {estimatedCost.materialFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">ค่าวัสดุ:</span>
                    <span className="font-medium">฿{estimatedCost.materialFee.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-yellow-200 flex justify-between items-center">
                <span className="font-semibold text-yellow-900">รวมทั้งสิ้น:</span>
                <span className="text-xl font-bold text-yellow-700">
                  ฿{estimatedCost.totalFee.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-yellow-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                อาจเลื่อนกำหนดส่งประมาณ {estimatedCost.daysDelayed} วัน
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          ยกเลิก
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || !description.trim()}
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
        >
          {isSubmitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอเปลี่ยนแปลง'}
        </Button>
      </div>
    </form>
  )
}

