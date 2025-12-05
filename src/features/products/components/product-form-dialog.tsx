'use client'

/**
 * Product Form Dialog
 * Dialog สำหรับเพิ่ม/แก้ไขข้อมูลสินค้า
 */

import { useForm, Controller } from 'react-hook-form'
import { useCreateProduct, useUpdateProduct } from '../hooks/useProducts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, X } from 'lucide-react'
import type { Product, CreateProductInput } from '../types'
import { COMMON_SIZES } from '../types'

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  onSuccess?: () => void
}

export function ProductFormDialog({ 
  open, 
  onOpenChange, 
  product,
  onSuccess 
}: ProductFormDialogProps) {
  const isEdit = !!product
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CreateProductInput>({
    defaultValues: product ? {
      product_type: product.product_type,
      name: product.name,
      name_th: product.name_th,
      description: product.description || '',
      material_type: product.material_type || undefined,
      weight_gsm: product.weight_gsm || undefined,
      base_color: product.base_color || '',
      available_sizes: product.available_sizes || [],
      cost_price: product.cost_price,
      base_price: product.base_price,
      low_stock_threshold: product.low_stock_threshold,
      is_featured: product.is_featured,
    } : {
      product_type: 'tshirt',
      name: '',
      name_th: '',
      base_price: 0,
      cost_price: 0,
      available_sizes: [],
      is_featured: false,
    },
  })

  const selectedSizes = watch('available_sizes') || []

  const toggleSize = (size: string) => {
    const current = selectedSizes
    if (current.includes(size)) {
      setValue('available_sizes', current.filter(s => s !== size))
    } else {
      setValue('available_sizes', [...current, size])
    }
  }

  const onSubmit = async (data: CreateProductInput) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: product.id, ...data })
      } else {
        await createMutation.mutateAsync(data)
      }
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error saving product:', error)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}</DialogTitle>
          <DialogDescription>
            กรอกข้อมูลสินค้า ข้อมูลที่มีเครื่องหมาย * จำเป็นต้องกรอก
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ข้อมูลพื้นฐาน */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200" />
              <Badge variant="outline">ข้อมูลพื้นฐาน</Badge>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_type">
                  ประเภทสินค้า <span className="text-rose-500">*</span>
                </Label>
                <Controller
                  name="product_type"
                  control={control}
                  rules={{ required: 'กรุณาเลือกประเภทสินค้า' }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกประเภท" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tshirt">เสื้อยืด (T-Shirt)</SelectItem>
                        <SelectItem value="polo">เสื้อโปโล (Polo)</SelectItem>
                        <SelectItem value="hoodie">ฮู้ด (Hoodie)</SelectItem>
                        <SelectItem value="cap">หมวก (Cap)</SelectItem>
                        <SelectItem value="tote_bag">กระเป๋าผ้า (Tote Bag)</SelectItem>
                        <SelectItem value="other">อื่นๆ</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.product_type && (
                  <p className="text-sm text-rose-500">{errors.product_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="material_type">ประเภทผ้า</Label>
                <Controller
                  name="material_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกประเภทผ้า" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cotton_32">Cotton 32s</SelectItem>
                        <SelectItem value="poly_65_35">Poly 65/35</SelectItem>
                        <SelectItem value="pique">Pique</SelectItem>
                        <SelectItem value="french_terry">French Terry</SelectItem>
                        <SelectItem value="other">อื่นๆ</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">
                  ชื่อสินค้า (EN) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Premium Cotton T-Shirt"
                  {...register('name', { required: 'กรุณากรอกชื่อสินค้า' })}
                />
                {errors.name && (
                  <p className="text-sm text-rose-500">{errors.name.message}</p>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="name_th">
                  ชื่อสินค้า (TH) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="name_th"
                  placeholder="เสื้อยืดคอตตอน พรีเมี่ยม"
                  {...register('name_th', { required: 'กรุณากรอกชื่อสินค้าภาษาไทย' })}
                />
                {errors.name_th && (
                  <p className="text-sm text-rose-500">{errors.name_th.message}</p>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">คำอธิบาย</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="รายละเอียดสินค้า..."
                  {...register('description')}
                />
              </div>
            </div>
          </div>

          {/* ข้อมูลสินค้า */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200" />
              <Badge variant="outline">ข้อมูลสินค้า</Badge>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_color">สีพื้นฐาน</Label>
                <Input
                  id="base_color"
                  placeholder="White, Black, Navy"
                  {...register('base_color')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_gsm">น้ำหนักผ้า (GSM)</Label>
                <Input
                  id="weight_gsm"
                  type="number"
                  placeholder="180"
                  {...register('weight_gsm', { valueAsNumber: true })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>ไซส์ที่มีจำหน่าย</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SIZES.map((size) => (
                    <Badge
                      key={size}
                      variant={selectedSizes.includes(size) ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-slate-200"
                      onClick={() => toggleSize(size)}
                    >
                      {selectedSizes.includes(size) && <X className="w-3 h-3 mr-1" />}
                      {size}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ราคา */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200" />
              <Badge variant="outline">ราคา</Badge>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_price">ต้นทุน (บาท)</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  {...register('cost_price', { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_price">
                  ราคาขาย (บาท) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  placeholder="150.00"
                  {...register('base_price', { 
                    required: 'กรุณากรอกราคาขาย',
                    valueAsNumber: true 
                  })}
                />
                {errors.base_price && (
                  <p className="text-sm text-rose-500">{errors.base_price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">เตือนสต็อกต่ำ</Label>
                <Input
                  id="low_stock_threshold"
                  type="number"
                  placeholder="10"
                  {...register('low_stock_threshold', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Controller
              name="is_featured"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="is_featured"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label
              htmlFor="is_featured"
              className="text-sm font-normal cursor-pointer"
            >
              แสดงในหน้าสินค้าแนะนำ (Featured)
            </Label>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

