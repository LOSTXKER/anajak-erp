'use client'

/**
 * Customer Form Dialog
 * Dialog สำหรับเพิ่ม/แก้ไขข้อมูลลูกค้า
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateCustomer, useUpdateCustomer } from '../hooks/useCustomers'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { Customer, CreateCustomerInput } from '../types'

interface CustomerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSuccess?: () => void
}

export function CustomerFormDialog({ 
  open, 
  onOpenChange, 
  customer,
  onSuccess 
}: CustomerFormDialogProps) {
  const isEdit = !!customer
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateCustomerInput>({
    defaultValues: customer ? {
      company_name: customer.company_name || '',
      contact_person: customer.contact_person,
      email: customer.email || '',
      phone: customer.phone,
      line_id: customer.line_id || '',
      address: customer.address || '',
      district: customer.district || '',
      city: customer.city || '',
      province: customer.province || '',
      postal_code: customer.postal_code || '',
      tax_id: customer.tax_id || '',
      notes: customer.notes || '',
    } : {
      contact_person: '',
      phone: '',
    },
  })

  const onSubmit = async (data: CreateCustomerInput) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: customer.id, ...data })
      } else {
        await createMutation.mutateAsync(data)
      }
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error saving customer:', error)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</DialogTitle>
          <DialogDescription>
            กรอกข้อมูลลูกค้า ข้อมูลที่มีเครื่องหมาย * จำเป็นต้องกรอก
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
              <div className="col-span-2 space-y-2">
                <Label htmlFor="contact_person">
                  ชื่อผู้ติดต่อ <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="contact_person"
                  placeholder="นาย/นาง/นางสาว ชื่อ นามสกุล"
                  {...register('contact_person', { required: 'กรุณากรอกชื่อผู้ติดต่อ' })}
                />
                {errors.contact_person && (
                  <p className="text-sm text-rose-500">{errors.contact_person.message}</p>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="company_name">ชื่อบริษัท (ถ้ามี)</Label>
                <Input
                  id="company_name"
                  placeholder="บริษัท ABC จำกัด"
                  {...register('company_name')}
                />
              </div>
            </div>
          </div>

          {/* ข้อมูลติดต่อ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200" />
              <Badge variant="outline">ข้อมูลติดต่อ</Badge>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">
                  เบอร์โทร <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="phone"
                  placeholder="0812345678"
                  {...register('phone', { 
                    required: 'กรุณากรอกเบอร์โทร',
                    pattern: {
                      value: /^[0-9]{9,10}$/,
                      message: 'รูปแบบเบอร์โทรไม่ถูกต้อง'
                    }
                  })}
                />
                {errors.phone && (
                  <p className="text-sm text-rose-500">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="line_id">LINE ID</Label>
                <Input
                  id="line_id"
                  placeholder="@lineid"
                  {...register('line_id')}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="customer@example.com"
                  {...register('email')}
                />
              </div>
            </div>
          </div>

          {/* ที่อยู่ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200" />
              <Badge variant="outline">ที่อยู่</Badge>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">ที่อยู่</Label>
                <Input
                  id="address"
                  placeholder="เลขที่ ซอย ถนน"
                  {...register('address')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">แขวง/ตำบล</Label>
                  <Input
                    id="district"
                    placeholder="แขวง..."
                    {...register('district')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">เขต/อำเภอ</Label>
                  <Input
                    id="city"
                    placeholder="เขต..."
                    {...register('city')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="province">จังหวัด</Label>
                  <Input
                    id="province"
                    placeholder="กรุงเทพมหานคร"
                    {...register('province')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">รหัสไปรษณีย์</Label>
                  <Input
                    id="postal_code"
                    placeholder="10100"
                    {...register('postal_code', {
                      pattern: {
                        value: /^[0-9]{5}$/,
                        message: 'รูปแบบรหัสไปรษณีย์ไม่ถูกต้อง (5 หลัก)'
                      }
                    })}
                  />
                  {errors.postal_code && (
                    <p className="text-sm text-rose-500">{errors.postal_code.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* หมายเหตุ */}
          <div className="space-y-2">
            <Label htmlFor="notes">หมายเหตุ</Label>
            <textarea
              id="notes"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="หมายเหตุเพิ่มเติม..."
              {...register('notes')}
            />
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
              {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

