'use client'

/**
 * Material/Fabric Selector
 * เลือกผ้าและวัสดุสำหรับ Custom Sewing & Full Custom
 */

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Plus, Minus, Trash2 } from 'lucide-react'

interface Material {
  id: string
  type: 'fabric' | 'thread' | 'button' | 'zipper' | 'other'
  name: string
  color?: string
  quantity: number
  unit: string
  notes?: string
}

interface MaterialSelectorProps {
  onMaterialsChange: (materials: Material[]) => void
}

const FABRIC_TYPES = [
  { value: 'cotton', label: 'ผ้าฝ้าย (Cotton)', unit: 'เมตร' },
  { value: 'polyester', label: 'โพลีเอสเตอร์', unit: 'เมตร' },
  { value: 'blend', label: 'ผ้าผสม (Cotton-Poly)', unit: 'เมตร' },
  { value: 'pique', label: 'ผ้าปีเก้ (Pique)', unit: 'เมตร' },
  { value: 'jersey', label: 'ผ้าเจอร์ซี่ (Jersey)', unit: 'เมตร' },
  { value: 'french_terry', label: 'ผ้าเฟรนช์เทอร์รี่', unit: 'เมตร' },
]

const MATERIAL_TYPES = [
  { value: 'thread', label: 'ด้าย', unit: 'กรัม' },
  { value: 'button', label: 'กระดุม', unit: 'เม็ด' },
  { value: 'zipper', label: 'ซิป', unit: 'เส้น' },
  { value: 'other', label: 'อื่นๆ', unit: 'ชิ้น' },
]

export function MaterialSelector({ onMaterialsChange }: MaterialSelectorProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMaterial, setNewMaterial] = useState({
    type: 'fabric' as Material['type'],
    name: '',
    color: '',
    quantity: 1,
    unit: 'เมตร',
    notes: '',
  })

  const addMaterial = () => {
    if (!newMaterial.name) return

    const material: Material = {
      id: Date.now().toString(),
      ...newMaterial,
      quantity: Number(newMaterial.quantity),
    }

    const updated = [...materials, material]
    setMaterials(updated)
    onMaterialsChange(updated)

    // Reset form
    setNewMaterial({
      type: 'fabric',
      name: '',
      color: '',
      quantity: 1,
      unit: 'เมตร',
      notes: '',
    })
    setShowAddForm(false)
  }

  const removeMaterial = (id: string) => {
    const updated = materials.filter(m => m.id !== id)
    setMaterials(updated)
    onMaterialsChange(updated)
  }

  const updateQuantity = (id: string, quantity: number) => {
    const updated = materials.map(m =>
      m.id === id ? { ...m, quantity: Math.max(0.1, quantity) } : m
    )
    setMaterials(updated)
    onMaterialsChange(updated)
  }

  const getTypeLabel = (type: Material['type']) => {
    switch (type) {
      case 'fabric':
        return '🧵 ผ้า'
      case 'thread':
        return '🧶 ด้าย'
      case 'button':
        return '⚫ กระดุม'
      case 'zipper':
        return '🔗 ซิป'
      default:
        return '📦 อื่นๆ'
    }
  }

  return (
    <div className="space-y-4">
      {/* Materials List */}
      {materials.length > 0 && (
        <div className="space-y-3">
          {materials.map((material) => (
            <Card key={material.id} className="bg-slate-50/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{getTypeLabel(material.type)}</Badge>
                      <h4 className="font-medium text-slate-900">{material.name}</h4>
                      {material.color && (
                        <Badge variant="outline">สี: {material.color}</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(material.id, material.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm font-medium min-w-[60px] text-center">
                          {material.quantity} {material.unit}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(material.id, material.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      {material.notes && (
                        <span className="text-xs text-slate-500">{material.notes}</span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMaterial(material.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Material Button */}
      {!showAddForm && (
        <Button
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full border-dashed border-2"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มผ้า/วัสดุ
        </Button>
      )}

      {/* Add Material Form */}
      {showAddForm && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-semibold text-slate-900">เพิ่มผ้า/วัสดุใหม่</h4>

            {/* Type Selection */}
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={newMaterial.type === 'fabric' ? 'default' : 'outline'}
                  onClick={() => setNewMaterial({ ...newMaterial, type: 'fabric', unit: 'เมตร' })}
                  size="sm"
                >
                  🧵 ผ้า
                </Button>
                <Button
                  type="button"
                  variant={newMaterial.type === 'thread' ? 'default' : 'outline'}
                  onClick={() => setNewMaterial({ ...newMaterial, type: 'thread', unit: 'กรัม' })}
                  size="sm"
                >
                  🧶 ด้าย
                </Button>
                <Button
                  type="button"
                  variant={newMaterial.type === 'button' ? 'default' : 'outline'}
                  onClick={() => setNewMaterial({ ...newMaterial, type: 'button', unit: 'เม็ด' })}
                  size="sm"
                >
                  ⚫ กระดุม
                </Button>
                <Button
                  type="button"
                  variant={newMaterial.type === 'zipper' ? 'default' : 'outline'}
                  onClick={() => setNewMaterial({ ...newMaterial, type: 'zipper', unit: 'เส้น' })}
                  size="sm"
                >
                  🔗 ซิป
                </Button>
              </div>
            </div>

            {/* Fabric Type (if fabric) */}
            {newMaterial.type === 'fabric' && (
              <div className="space-y-2">
                <Label>ชนิดผ้า</Label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                >
                  <option value="">เลือกชนิดผ้า...</option>
                  {FABRIC_TYPES.map((type) => (
                    <option key={type.value} value={type.label}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Name (if not fabric) */}
            {newMaterial.type !== 'fabric' && (
              <div className="space-y-2">
                <Label>ชื่อ</Label>
                <Input
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                  placeholder="ระบุชื่อวัสดุ..."
                />
              </div>
            )}

            {/* Color */}
            <div className="space-y-2">
              <Label>สี</Label>
              <Input
                value={newMaterial.color}
                onChange={(e) => setNewMaterial({ ...newMaterial, color: e.target.value })}
                placeholder="เช่น ดำ, ขาว, กรมท่า..."
              />
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>จำนวน ({newMaterial.unit})</Label>
              <Input
                type="number"
                step="0.1"
                value={newMaterial.quantity}
                onChange={(e) => setNewMaterial({ ...newMaterial, quantity: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                value={newMaterial.notes}
                onChange={(e) => setNewMaterial({ ...newMaterial, notes: e.target.value })}
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={addMaterial}
                disabled={!newMaterial.name}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่ม
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

