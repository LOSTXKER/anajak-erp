'use client'

/**
 * Work Type Selector
 * เลือกประเภทงานที่จะทำ (DTF, ปัก, ตัดผ้า, เย็บ, ฯลฯ)
 */

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Paintbrush, 
  Scissors, 
  Tag, 
  Package as PackageIcon,
  Sparkles 
} from 'lucide-react'
import type { WorkType } from '@/features/order-types/types'

interface SelectedWorkType {
  workType: WorkType
  quantity: number
  notes?: string
}

interface WorkTypeSelectorProps {
  workTypes: WorkType[]
  orderTypeCode: string
  onWorkTypesChange: (selected: SelectedWorkType[]) => void
}

export function WorkTypeSelector({ workTypes, orderTypeCode, onWorkTypesChange }: WorkTypeSelectorProps) {
  const [selectedWorks, setSelectedWorks] = useState<SelectedWorkType[]>([])

  // แนะนำ Work Types ตาม Order Type
  const getRecommendedWorks = () => {
    switch (orderTypeCode) {
      case 'ready_made':
        return ['dtf', 'dtg', 'embroidery', 'silkscreen']
      case 'custom_sewing':
        return ['cutting', 'sewing', 'dtf', 'embroidery']
      case 'full_custom':
        return ['pattern', 'cutting', 'sewing', 'dtf', 'embroidery']
      case 'print_only':
        return ['dtf', 'dtg', 'embroidery', 'silkscreen', 'vinyl']
      default:
        return []
    }
  }

  const recommendedCodes = getRecommendedWorks()
  
  // จัดกลุ่มตาม Category
  const groupedWorks = workTypes.reduce((acc, work) => {
    if (!acc[work.category]) {
      acc[work.category] = []
    }
    acc[work.category].push(work)
    return acc
  }, {} as Record<string, WorkType[]>)

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PRINTING':
        return Paintbrush
      case 'EMBROIDERY':
        return Sparkles
      case 'GARMENT':
        return Scissors
      case 'LABELING':
        return Tag
      case 'FINISHING':
        return PackageIcon
      default:
        return Paintbrush
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'PRINTING':
        return 'from-blue-500 to-cyan-600'
      case 'EMBROIDERY':
        return 'from-purple-500 to-pink-600'
      case 'GARMENT':
        return 'from-orange-500 to-red-600'
      case 'LABELING':
        return 'from-green-500 to-emerald-600'
      case 'FINISHING':
        return 'from-slate-500 to-slate-600'
      default:
        return 'from-slate-500 to-slate-600'
    }
  }

  const toggleWorkType = (workType: WorkType) => {
    const exists = selectedWorks.find(w => w.workType.id === workType.id)
    
    let newSelected: SelectedWorkType[]
    if (exists) {
      newSelected = selectedWorks.filter(w => w.workType.id !== workType.id)
    } else {
      newSelected = [...selectedWorks, { workType, quantity: 1 }]
    }
    
    setSelectedWorks(newSelected)
    onWorkTypesChange(newSelected)
  }

  const updateQuantity = (workTypeId: string, quantity: number) => {
    const newSelected = selectedWorks.map(w =>
      w.workType.id === workTypeId ? { ...w, quantity: Math.max(1, quantity) } : w
    )
    setSelectedWorks(newSelected)
    onWorkTypesChange(newSelected)
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedWorks).map(([category, works]) => {
        const Icon = getCategoryIcon(category)
        const gradient = getCategoryColor(category)
        
        // แสดงเฉพาะหมวดที่เกี่ยวข้องกับ Order Type
        const relevantWorks = works.filter(w => recommendedCodes.includes(w.code))
        if (relevantWorks.length === 0 && orderTypeCode !== 'full_custom') {
          return null
        }

        return (
          <div key={category} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-900">{category}</h3>
              <Badge variant="outline" className="ml-auto">
                {works.length} งาน
              </Badge>
            </div>

            {/* Work Types Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {works.map((work) => {
                const isSelected = selectedWorks.some(w => w.workType.id === work.id)
                const selectedWork = selectedWorks.find(w => w.workType.id === work.id)
                const isRecommended = recommendedCodes.includes(work.code)

                return (
                  <Card
                    key={work.id}
                    className={`
                      cursor-pointer transition-all
                      ${isSelected
                        ? 'ring-2 ring-blue-500 bg-blue-50/50'
                        : 'hover:shadow-md'
                      }
                      ${!isRecommended && orderTypeCode !== 'full_custom' ? 'opacity-50' : ''}
                    `}
                    onClick={() => toggleWorkType(work)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isSelected} className="mt-1" />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900">{work.name_th}</h4>
                            {isRecommended && (
                              <Badge variant="secondary" className="text-xs">แนะนำ</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">{work.name}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="font-semibold text-blue-600">
                              ฿{work.default_price.toLocaleString()}
                            </span>
                            {work.requires_design && (
                              <Badge variant="outline" className="text-xs">ต้องมีไฟล์</Badge>
                            )}
                            {work.requires_material && (
                              <Badge variant="outline" className="text-xs">ต้องมีวัสดุ</Badge>
                            )}
                          </div>

                          {/* Quantity Input (if selected) */}
                          {isSelected && selectedWork && (
                            <div className="mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                              <Label className="text-xs">จำนวน (ชิ้น/ครั้ง)</Label>
                              <Input
                                type="number"
                                value={selectedWork.quantity}
                                onChange={(e) => updateQuantity(work.id, parseInt(e.target.value) || 1)}
                                min={1}
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

