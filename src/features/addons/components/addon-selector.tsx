'use client'

/**
 * Addon Selector Component
 * Component สำหรับเลือก Addons (ถุง, ป้าย, พับแพค)
 */

import { useState } from 'react'
import { useAddonTypes } from '../hooks/useAddons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Package, Tag, Scissors, Plus, Minus, X } from 'lucide-react'
import type { AddonType } from '../types'

export interface SelectedAddon {
  addon: AddonType
  quantity: number
}

interface AddonSelectorProps {
  selectedAddons: SelectedAddon[]
  onAddonsChange: (addons: SelectedAddon[]) => void
  totalQuantity: number // จำนวนสินค้าทั้งหมดในออเดอร์
}

export function AddonSelector({ 
  selectedAddons, 
  onAddonsChange,
  totalQuantity 
}: AddonSelectorProps) {
  const { data: addonTypes, isLoading } = useAddonTypes()
  const [activeCategory, setActiveCategory] = useState<string>('packaging')

  const categories = [
    { id: 'packaging', label: 'บรรจุภัณฑ์', icon: Package },
    { id: 'labeling', label: 'ป้าย/แท็ก', icon: Tag },
    { id: 'finishing', label: 'Finishing', icon: Scissors },
    { id: 'extra', label: 'เพิ่มเติม', icon: Plus },
  ]

  const filteredAddons = addonTypes?.filter(a => a.category === activeCategory)

  const toggleAddon = (addon: AddonType) => {
    const existing = selectedAddons.find(a => a.addon.id === addon.id)
    
    if (existing) {
      // Remove
      onAddonsChange(selectedAddons.filter(a => a.addon.id !== addon.id))
    } else {
      // Add with default quantity
      const defaultQty = addon.price_type === 'per_piece' ? totalQuantity : 1
      onAddonsChange([...selectedAddons, { addon, quantity: defaultQty }])
    }
  }

  const updateQuantity = (addonId: string, quantity: number) => {
    onAddonsChange(
      selectedAddons.map(a => 
        a.addon.id === addonId ? { ...a, quantity: Math.max(1, quantity) } : a
      )
    )
  }

  const isSelected = (addonId: string) => {
    return selectedAddons.some(a => a.addon.id === addonId)
  }

  const getSelectedQuantity = (addonId: string) => {
    return selectedAddons.find(a => a.addon.id === addonId)?.quantity || 0
  }

  const calculateAddonTotal = () => {
    return selectedAddons.reduce((sum, item) => {
      if (item.addon.price_type === 'fixed') {
        return sum + item.addon.base_price
      }
      return sum + (item.addon.base_price * item.quantity)
    }, 0)
  }

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">กำลังโหลด Addons...</div>
  }

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => {
          const Icon = cat.icon
          return (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {cat.label}
            </Button>
          )
        })}
      </div>

      {/* Addon List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredAddons?.map((addon) => {
          const selected = isSelected(addon.id)
          const quantity = getSelectedQuantity(addon.id)

          return (
            <div
              key={addon.id}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}
              `}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleAddon(addon)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{addon.name_th}</p>
                      <p className="text-sm text-slate-500">{addon.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">
                        ฿{addon.base_price.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {addon.price_type === 'per_piece' && 'ต่อชิ้น'}
                        {addon.price_type === 'per_lot' && 'ต่อ Lot'}
                        {addon.price_type === 'fixed' && 'ราคาเหมา'}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Control (if selected) */}
                  {selected && addon.price_type !== 'fixed' && (
                    <div className="flex items-center gap-2 mt-3">
                      <Label className="text-sm">จำนวน:</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateQuantity(addon.id, quantity - 1)
                          }}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => updateQuantity(addon.id, parseInt(e.target.value) || 1)}
                          className="w-20 text-center"
                          min="1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateQuantity(addon.id, quantity + 1)
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-sm text-slate-600 ml-auto">
                        = ฿{(addon.base_price * quantity).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {selectedAddons.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-600">ค่า Addons ทั้งหมด</p>
              <p className="text-xs text-slate-500 mt-1">{selectedAddons.length} รายการ</p>
            </div>
            <p className="text-xl font-bold text-blue-600">
              +฿{calculateAddonTotal().toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

