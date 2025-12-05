'use client'

/**
 * QC Inspection Form
 * ฟอร์มตรวจสอบคุณภาพ (Quality Control)
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, XCircle, AlertCircle, Camera } from 'lucide-react'

interface QcInspectionFormProps {
  productionJobNumber: string
  quantity: number
  checklistItems: string[]
  onSubmit: (data: {
    result: 'passed' | 'failed' | 'conditional_pass'
    passed_quantity: number
    failed_quantity: number
    defect_types: string[]
    notes?: string
  }) => Promise<void>
  onCancel: () => void
}

export function QcInspectionForm({
  productionJobNumber,
  quantity,
  checklistItems,
  onSubmit,
  onCancel
}: QcInspectionFormProps) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [passedQty, setPassedQty] = useState(quantity)
  const [failedQty, setFailedQty] = useState(0)
  const [defectTypes, setDefectTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const commonDefects = [
    'รอยคราบสี',
    'ผ้าฉีกขาด',
    'ตำแหน่งสกรีนผิด',
    'สีไม่ตรง',
    'ตะเข็บไม่เรียบ',
    'ขนาดไม่ถูกต้อง',
  ]

  const handleDefectToggle = (defect: string) => {
    setDefectTypes(prev =>
      prev.includes(defect)
        ? prev.filter(d => d !== defect)
        : [...prev, defect]
    )
  }

  const handleSubmit = async (result: 'passed' | 'failed' | 'conditional_pass') => {
    setIsSubmitting(true)
    try {
      await onSubmit({
        result,
        passed_quantity: passedQty,
        failed_quantity: failedQty,
        defect_types: defectTypes,
        notes: notes || undefined
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const allChecked = checklistItems.length > 0 && 
    checklistItems.every(item => checkedItems[item])

  return (
    <Card className="border-2 border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-600" />
          QC Inspection: {productionJobNumber}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Checklist */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Checklist:</Label>
          <div className="space-y-2">
            {checklistItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <Checkbox
                  checked={checkedItems[item] || false}
                  onCheckedChange={(checked) => 
                    setCheckedItems(prev => ({ ...prev, [item]: !!checked }))
                  }
                />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quantity Check */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ผ่าน QC (ชิ้น)</Label>
            <Input
              type="number"
              value={passedQty}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0
                setPassedQty(val)
                setFailedQty(quantity - val)
              }}
              max={quantity}
              min={0}
              className="text-emerald-600 font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label>ไม่ผ่าน (ชิ้น)</Label>
            <Input
              type="number"
              value={failedQty}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0
                setFailedQty(val)
                setPassedQty(quantity - val)
              }}
              max={quantity}
              min={0}
              className="text-red-600 font-semibold"
            />
          </div>
        </div>

        {/* Defect Types (if failed) */}
        {failedQty > 0 && (
          <div className="space-y-2">
            <Label>ประเภทข้อบกพร่อง:</Label>
            <div className="grid grid-cols-2 gap-2">
              {commonDefects.map((defect) => (
                <div
                  key={defect}
                  onClick={() => handleDefectToggle(defect)}
                  className={`
                    p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${defectTypes.includes(defect)
                      ? 'border-red-400 bg-red-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }
                  `}
                >
                  <span className="text-sm">{defect}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label>หมายเหตุ:</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="บันทึกข้อสังเกตเพิ่มเติม..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            ยกเลิก
          </Button>
          
          {failedQty === 0 ? (
            <Button
              onClick={() => handleSubmit('passed')}
              disabled={isSubmitting || !allChecked}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              ผ่าน QC
            </Button>
          ) : failedQty === quantity ? (
            <Button
              onClick={() => handleSubmit('failed')}
              disabled={isSubmitting || defectTypes.length === 0}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-2" />
              ไม่ผ่าน
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit('conditional_pass')}
              disabled={isSubmitting}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              ผ่านบางส่วน
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

