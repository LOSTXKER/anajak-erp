'use client'

/**
 * Order Creation Page
 * Wizard แบบ Multi-step สำหรับสร้างออเดอร์ใหม่
 */

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useCreateOrder } from '@/features/orders/hooks/useOrders'
import { AddonSelector, type SelectedAddon as SelectedAddonType } from '@/features/addons/components/addon-selector'
import { OrderTypeSelector } from '@/features/order-types/components/order-type-selector'
import { WorkTypeSelector } from '@/features/work-types/components/work-type-selector'
import { MaterialSelector } from '@/features/work-types/components/material-selector'
import { PatternSelector } from '@/features/work-types/components/pattern-selector'
import { useQuery } from '@tanstack/react-query'
import type { OrderType, WorkType } from '@/features/order-types/types'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  User, 
  Package, 
  FileText,
  CheckCircle2,
  Loader2,
  Search,
  Plus,
  Minus,
  Trash2
} from 'lucide-react'
import type { Customer } from '@/features/customers/types'
import type { Product } from '@/features/products/types'
import type { CreateOrderItemInput } from '@/features/orders/types'

// Wizard Steps
type WizardStep = 
  | 'order-type' 
  | 'customer' 
  | 'pattern'        // Custom Sewing: เลือก Pattern
  | 'pattern-upload' // Full Custom: Upload Pattern
  | 'materials'      // Custom/Full: เลือกผ้า/วัสดุ
  | 'items'          // Ready-Made: เลือกสินค้า
  | 'works'          // Work Types ที่จะทำ
  | 'addons' 
  | 'details' 
  | 'review'

interface SelectedItem {
  product: Product
  quantity: number
  size?: string
  color?: string
  notes?: string
}

export default function CreateOrderPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>('order-type')
  const [selectedOrderType, setSelectedOrderType] = useState<string>('ready_made')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [selectedWorks, setSelectedWorks] = useState<any[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<any[]>([])
  const [selectedPattern, setSelectedPattern] = useState<any>(null)
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddonType[]>([])
  const [searchCustomer, setSearchCustomer] = useState('')
  const [searchProduct, setSearchProduct] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')

  const { data: orderTypes } = useQuery<OrderType[]>({
    queryKey: ['orderTypes'],
    queryFn: async () => {
      const res = await fetch('/api/order-types')
      if (!res.ok) throw new Error('Failed to fetch order types')
      return res.json()
    }
  })

  const { data: workTypes } = useQuery<WorkType[]>({
    queryKey: ['workTypes'],
    queryFn: async () => {
      const res = await fetch('/api/work-types')
      if (!res.ok) throw new Error('Failed to fetch work types')
      return res.json()
    }
  })

  const { data: customers } = useCustomers()
  const { data: products } = useProducts({ is_active: true })
  const createMutation = useCreateOrder()

  // Get steps based on order type
  const getStepsForOrderType = (orderType: string): WizardStep[] => {
    const baseSteps: WizardStep[] = ['order-type', 'customer']
    
    switch (orderType) {
      case 'ready_made':
        return [...baseSteps, 'items', 'works', 'addons', 'details', 'review']
      case 'custom_sewing':
        return [...baseSteps, 'pattern', 'materials', 'works', 'addons', 'details', 'review']
      case 'full_custom':
        return [...baseSteps, 'pattern-upload', 'materials', 'works', 'addons', 'details', 'review']
      case 'print_only':
        return [...baseSteps, 'works', 'addons', 'details', 'review']
      default:
        return [...baseSteps, 'items', 'works', 'addons', 'details', 'review']
    }
  }

  const currentSteps = getStepsForOrderType(selectedOrderType)

  const filteredCustomers = customers?.filter((c) =>
    c.contact_person.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.phone.includes(searchCustomer) ||
    c.customer_code.toLowerCase().includes(searchCustomer.toLowerCase())
  )

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.name_th.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchProduct.toLowerCase())
  )

  const addItem = (product: Product) => {
    setSelectedItems([...selectedItems, { product, quantity: 1 }])
  }

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index))
  }

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...selectedItems]
    newItems[index].quantity = Math.max(1, quantity)
    setSelectedItems(newItems)
  }

  const updateSize = (index: number, size: string) => {
    const newItems = [...selectedItems]
    newItems[index].size = size
    setSelectedItems(newItems)
  }

  const calculateTotal = () => {
    const itemsTotal = selectedItems.reduce((sum, item) => {
      return sum + (item.product.base_price * item.quantity)
    }, 0)
    
    const addonsTotal = selectedAddons.reduce((sum, addon) => {
      if (addon.addon.price_type === 'fixed') {
        return sum + addon.addon.base_price
      }
      return sum + (addon.addon.base_price * addon.quantity)
    }, 0)
    
    return itemsTotal + addonsTotal
  }
  
  const getTotalItemQuantity = () => {
    return selectedItems.reduce((sum, item) => sum + item.quantity, 0)
  }

  const handleSubmit = async () => {
    // Validate based on order type
    if (!selectedCustomer) {
      alert('กรุณาเลือกลูกค้า')
      return
    }

    // Ready-Made ต้องมี items
    if (selectedOrderType === 'ready_made' && selectedItems.length === 0) {
      alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')
      return
    }

    // Custom/Full Custom ต้องมี materials
    if ((selectedOrderType === 'custom_sewing' || selectedOrderType === 'full_custom') && selectedMaterials.length === 0) {
      alert('กรุณาเลือกผ้า/วัสดุอย่างน้อย 1 รายการ')
      return
    }

    // ทุกประเภทต้องมี works
    if (selectedWorks.length === 0) {
      alert('กรุณาเลือกงานที่จะทำอย่างน้อย 1 รายการ')
      return
    }

    try {
      const orderItems: CreateOrderItemInput[] = selectedItems.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unit_price: item.product.base_price,
        notes: item.notes,
      }))

      const orderAddons = selectedAddons.map((item) => ({
        addon_type_id: item.addon.id,
        addon_code: item.addon.code,
        addon_name: item.addon.name_th,
        quantity: item.quantity,
        unit_price: item.addon.base_price,
      }))

      await createMutation.mutateAsync({
        customer_id: selectedCustomer.id,
        order_type_code: selectedOrderType,
        due_date: dueDate || undefined,
        delivery_address: deliveryAddress || undefined,
        notes: notes || undefined,
        items: orderItems,
        addons: orderAddons.length > 0 ? orderAddons : undefined,
      })

      router.push('/orders')
    } catch (error) {
      console.error('Error creating order:', error)
      alert('เกิดข้อผิดพลาดในการสร้างออเดอร์')
    }
  }

  const canGoNext = () => {
    if (currentStep === 'order-type') return !!selectedOrderType
    if (currentStep === 'customer') return !!selectedCustomer
    if (currentStep === 'pattern') return !!selectedPattern
    if (currentStep === 'pattern-upload') return !!selectedPattern
    if (currentStep === 'materials') return selectedMaterials.length > 0
    if (currentStep === 'items') return selectedItems.length > 0
    if (currentStep === 'works') return selectedWorks.length > 0
    if (currentStep === 'addons') return true // Addons ไม่บังคับ
    return true
  }

  const stepLabels: Record<WizardStep, { label: string; icon: any }> = {
    'order-type': { label: 'ประเภทงาน', icon: FileText },
    'customer': { label: 'ลูกค้า', icon: User },
    'pattern': { label: 'Pattern', icon: FileText },
    'pattern-upload': { label: 'Upload Pattern', icon: FileText },
    'materials': { label: 'ผ้า/วัสดุ', icon: Package },
    'items': { label: 'สินค้า', icon: Package },
    'works': { label: 'งานที่ทำ', icon: Package },
    'addons': { label: 'Addons', icon: Plus },
    'details': { label: 'รายละเอียด', icon: FileText },
    'review': { label: 'ตรวจสอบ', icon: CheckCircle2 },
  }

  const steps = currentSteps.map(stepId => ({
    id: stepId,
    ...stepLabels[stepId]
  }))

  const currentStepIndex = currentSteps.findIndex(s => s === currentStep)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              สร้างออเดอร์ใหม่
            </h1>
            <p className="text-slate-500 mt-1">กรอกข้อมูลทีละขั้นตอน</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/orders')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับ
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isCompleted ? 'bg-emerald-500 text-white' : 
                      isActive ? 'bg-blue-600 text-white' : 
                      'bg-slate-200 text-slate-400'}
                  `}>
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <p className={`text-sm mt-2 font-medium ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.label}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-6">
            {/* Step 0: เลือกประเภทงาน */}
            {currentStep === 'order-type' && (
              <div className="space-y-4">
                <CardTitle>เลือกประเภทงาน</CardTitle>
                <p className="text-sm text-slate-500">
                  กรุณาเลือกประเภทงานที่ต้องการ (เสื้อสำเร็จรูป, ตัดเย็บ, ออกแบบเต็มรูปแบบ, หรือสกรีน/ปักอย่างเดียว)
                </p>
                {orderTypes && (
                  <OrderTypeSelector
                    orderTypes={orderTypes}
                    selectedType={selectedOrderType}
                    onSelect={setSelectedOrderType}
                  />
                )}
              </div>
            )}

            {/* Step 1: เลือกลูกค้า */}
            {currentStep === 'customer' && (
              <div className="space-y-4">
                <CardTitle>เลือกลูกค้า</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="ค้นหาลูกค้า..."
                    value={searchCustomer}
                    onChange={(e) => setSearchCustomer(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {filteredCustomers?.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${selectedCustomer?.id === customer.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'}
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{customer.company_name || customer.contact_person}</p>
                          <p className="text-sm text-slate-500 mt-1">{customer.phone}</p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {customer.customer_code}
                          </Badge>
                        </div>
                        {selectedCustomer?.id === customer.id && (
                          <Check className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step: Pattern (Custom Sewing) */}
            {currentStep === 'pattern' && (
              <div className="space-y-4">
                <CardTitle>เลือก Pattern</CardTitle>
                <p className="text-sm text-slate-500">
                  เลือก Pattern ที่มีอยู่สำหรับการตัดเย็บ
                </p>
                <PatternSelector
                  mode="select"
                  onPatternChange={setSelectedPattern}
                />
              </div>
            )}

            {/* Step: Pattern Upload (Full Custom) */}
            {currentStep === 'pattern-upload' && (
              <div className="space-y-4">
                <CardTitle>Upload Pattern Design</CardTitle>
                <p className="text-sm text-slate-500">
                  อัปโหลดไฟล์ Pattern ใหม่สำหรับการออกแบบเต็มรูปแบบ
                </p>
                <PatternSelector
                  mode="upload"
                  onPatternChange={setSelectedPattern}
                />
              </div>
            )}

            {/* Step: Materials (Custom/Full Custom) */}
            {currentStep === 'materials' && (
              <div className="space-y-4">
                <CardTitle>เลือกผ้าและวัสดุ</CardTitle>
                <p className="text-sm text-slate-500">
                  ระบุผ้าและวัสดุที่ต้องการใช้ในการตัดเย็บ
                </p>
                <MaterialSelector
                  onMaterialsChange={setSelectedMaterials}
                />
              </div>
            )}

            {/* Step: เลือกสินค้า (Ready-Made only) */}
            {currentStep === 'items' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <CardTitle>เลือกสินค้า</CardTitle>
                  <Badge>{selectedItems.length} รายการ</Badge>
                </div>

                {/* Selected Items */}
                {selectedItems.length > 0 && (
                  <div className="space-y-3 pb-4 border-b">
                    <p className="text-sm font-medium text-slate-700">รายการที่เลือก:</p>
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex-1">
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-slate-500">฿{item.product.base_price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Product Selection */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">เพิ่มสินค้า:</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="ค้นหาสินค้า..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                    {filteredProducts?.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => addItem(product)}
                        className="p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
                      >
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{product.sku}</p>
                        <p className="text-sm font-bold text-blue-600 mt-2">
                          ฿{product.base_price.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step: Works (เลือกงานที่จะทำ) */}
            {currentStep === 'works' && (
              <div className="space-y-4">
                <CardTitle>เลือกงานที่จะทำ</CardTitle>
                <p className="text-sm text-slate-500">
                  เลือกงานที่ต้องการ เช่น DTF, ปัก, ตัดผ้า, เย็บ ตามประเภทออเดอร์ที่เลือก
                </p>
                {workTypes && (
                  <WorkTypeSelector
                    workTypes={workTypes}
                    orderTypeCode={selectedOrderType}
                    onWorkTypesChange={setSelectedWorks}
                  />
                )}
                {selectedWorks.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      งานที่เลือก ({selectedWorks.length} รายการ):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedWorks.map((w) => (
                        <Badge key={w.workType.id} className="bg-blue-600">
                          {w.workType.name_th} × {w.quantity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step: Addons */}
            {currentStep === 'addons' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle>เลือก Addons (ถุง, ป้าย, พับแพค)</CardTitle>
                  <Badge variant="outline">ไม่บังคับ - ข้ามได้</Badge>
                </div>
                <AddonSelector
                  selectedAddons={selectedAddons}
                  onAddonsChange={setSelectedAddons}
                  totalQuantity={getTotalItemQuantity()}
                />
              </div>
            )}

            {/* Step 4: รายละเอียด */}
            {currentStep === 'details' && (
              <div className="space-y-4">
                <CardTitle>รายละเอียดเพิ่มเติม</CardTitle>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="due_date">วันที่ต้องการรับ</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_address">ที่อยู่จัดส่ง (ถ้าต่างจากที่อยู่ลูกค้า)</Label>
                  <textarea
                    id="delivery_address"
                    rows={3}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ที่อยู่จัดส่ง..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">หมายเหตุ</Label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>
              </div>
            )}

            {/* Step: ตรวจสอบ */}
            {currentStep === 'review' && (
              <div className="space-y-6">
                <CardTitle>ตรวจสอบออเดอร์</CardTitle>

                {/* Order Type */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-500">ประเภทงาน</p>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="font-semibold text-purple-900">
                      {orderTypes?.find(t => t.code === selectedOrderType)?.name_th || selectedOrderType}
                    </p>
                  </div>
                </div>

                {/* Customer */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-500">ลูกค้า</p>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-medium">{selectedCustomer?.company_name || selectedCustomer?.contact_person}</p>
                    <p className="text-sm text-slate-600 mt-1">{selectedCustomer?.phone}</p>
                  </div>
                </div>

                {/* Pattern (if selected) */}
                {selectedPattern && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">Pattern</p>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="font-medium text-orange-900">
                        {selectedPattern.name || (selectedPattern instanceof File ? selectedPattern.name : 'Pattern เลือกแล้ว')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Materials (if selected) */}
                {selectedMaterials.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">ผ้า/วัสดุ ({selectedMaterials.length} รายการ)</p>
                    <div className="space-y-2">
                      {selectedMaterials.map((mat, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-200">
                          <div className="flex-1">
                            <p className="font-medium text-teal-900">{mat.name}</p>
                            <p className="text-sm text-teal-700">{mat.color && `สี: ${mat.color}`}</p>
                          </div>
                          <Badge className="bg-teal-600">{mat.quantity} {mat.unit}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Works (if selected) */}
                {selectedWorks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">งานที่ทำ ({selectedWorks.length} รายการ)</p>
                    <div className="space-y-2">
                      {selectedWorks.map((work, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex-1">
                            <p className="font-medium text-blue-900">{work.workType.name_th}</p>
                            <p className="text-sm text-blue-700">{work.workType.category}</p>
                          </div>
                          <p className="font-bold text-blue-600">
                            ฿{(work.workType.default_price * work.quantity).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items (Ready-Made only) */}
                {selectedItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">รายการสินค้า</p>
                    <div className="space-y-2">
                      {selectedItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-slate-500">
                              {item.size && `Size: ${item.size}`} × {item.quantity}
                            </p>
                          </div>
                          <p className="font-bold">
                            ฿{(item.product.base_price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Addons */}
                {selectedAddons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">Addons</p>
                    <div className="space-y-2">
                      {selectedAddons.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex-1">
                            <p className="font-medium">{item.addon.name_th}</p>
                            <p className="text-sm text-slate-500">
                              {item.addon.price_type === 'fixed' 
                                ? 'ราคาเหมา' 
                                : `× ${item.quantity} ${item.addon.price_type === 'per_piece' ? 'ชิ้น' : 'Lot'}`
                              }
                            </p>
                          </div>
                          <p className="font-bold text-blue-600">
                            ฿{(item.addon.price_type === 'fixed' 
                              ? item.addon.base_price 
                              : item.addon.base_price * item.quantity
                            ).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>รวมทั้งสิ้น</span>
                    <span className="text-blue-600">
                      ฿{calculateTotal().toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStepIndex > 0) {
                setCurrentStep(currentSteps[currentStepIndex - 1])
              } else {
                router.push('/orders')
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStepIndex === 0 ? 'ยกเลิก' : 'ย้อนกลับ'}
          </Button>

          {currentStep === 'review' ? (
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-2 h-4 w-4" />
              สร้างออเดอร์
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (currentStepIndex < currentSteps.length - 1) {
                  setCurrentStep(currentSteps[currentStepIndex + 1])
                }
              }}
              disabled={!canGoNext()}
            >
              ถัดไป
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}

