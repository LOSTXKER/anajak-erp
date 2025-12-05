'use client'

/**
 * Order Type Selector
 * เลือกประเภทงาน (Ready-Made, Custom Sewing, Full Custom, Print Only)
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, Scissors, Sparkles, Paintbrush } from 'lucide-react'
import type { OrderType } from '../types'

interface OrderTypeSelectorProps {
  orderTypes: OrderType[]
  selectedType?: string
  onSelect: (typeCode: string) => void
}

export function OrderTypeSelector({ orderTypes, selectedType, onSelect }: OrderTypeSelectorProps) {
  const getIcon = (code: string) => {
    switch (code) {
      case 'ready_made':
        return Paintbrush
      case 'custom_sewing':
        return Scissors
      case 'full_custom':
        return Sparkles
      case 'print_only':
        return Paintbrush
      default:
        return Paintbrush
    }
  }

  const getGradient = (code: string) => {
    switch (code) {
      case 'ready_made':
        return 'from-blue-500 to-cyan-600'
      case 'custom_sewing':
        return 'from-purple-500 to-pink-600'
      case 'full_custom':
        return 'from-orange-500 to-red-600'
      case 'print_only':
        return 'from-green-500 to-emerald-600'
      default:
        return 'from-slate-500 to-slate-600'
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {orderTypes.map((type) => {
        const Icon = getIcon(type.code)
        const isSelected = selectedType === type.code

        return (
          <Card
            key={type.id}
            onClick={() => onSelect(type.code)}
            className={`
              relative cursor-pointer transition-all duration-200
              ${isSelected
                ? 'ring-4 ring-blue-500 shadow-lg scale-[1.02]'
                : 'hover:shadow-md hover:scale-[1.01]'
              }
            `}
          >
            <CardContent className="p-6">
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="w-6 h-6 text-blue-600" />
                </div>
              )}

              {/* Icon */}
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getGradient(type.code)} flex items-center justify-center mb-4 shadow-lg`}>
                <Icon className="w-8 h-8 text-white" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                {type.name_th}
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                {type.name}
              </p>

              {/* Description */}
              {type.description && (
                <p className="text-sm text-slate-500 mb-4">
                  {type.description}
                </p>
              )}

              {/* Details */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-slate-600">
                  <Clock className="w-4 h-4" />
                  <span>{type.default_lead_days} วัน</span>
                </div>
                
                {type.requires_pattern && (
                  <Badge variant="outline" className="text-xs">
                    ต้องมี Pattern
                  </Badge>
                )}
                
                {type.requires_fabric && (
                  <Badge variant="outline" className="text-xs">
                    ต้องมีผ้า
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

