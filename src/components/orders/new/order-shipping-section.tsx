"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ShippingData {
  recipientName: string;
  phone: string;
  address: string;
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

interface OrderShippingSectionProps {
  includeShipping: boolean;
  onIncludeShippingChange: (value: boolean) => void;
  shipping: ShippingData;
  onUpdate: <K extends keyof ShippingData>(field: K, value: ShippingData[K]) => void;
}

export function OrderShippingSection({
  includeShipping,
  onIncludeShippingChange,
  shipping,
  onUpdate,
}: OrderShippingSectionProps) {
  return (
    <Section
      title="ที่อยู่จัดส่ง (ไม่บังคับ)"
      description="ช่องแสดงไว้เสมอ · เปิดสวิตช์เพื่อใช้หรือแก้ไขที่อยู่นี้ (ปิดอยู่ = ไม่บันทึก)"
      compact
      action={
        <label htmlFor="include-order-shipping" className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <Switch
            id="include-order-shipping"
            checked={includeShipping}
            onCheckedChange={onIncludeShippingChange}
          />
          ใช้ที่อยู่นี้
        </label>
      }
    >
      <fieldset
        disabled={!includeShipping}
        className={cn("space-y-3 transition-opacity", !includeShipping && "opacity-55")}
      >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="ชื่อผู้รับ" required={includeShipping}>
              <Input
                required={includeShipping}
                value={shipping.recipientName}
                onChange={(e) => onUpdate("recipientName", e.target.value)}
                placeholder="ชื่อ-นามสกุล ผู้รับ"
              />
            </Field>
            <Field label="เบอร์โทร">
              <Input
                value={shipping.phone}
                onChange={(e) => onUpdate("phone", e.target.value)}
                placeholder="08X-XXX-XXXX"
              />
            </Field>
          </div>
          <Field label="ที่อยู่" required={includeShipping}>
            <Textarea
              required={includeShipping}
              value={shipping.address}
              onChange={(e) => onUpdate("address", e.target.value)}
              placeholder="บ้านเลขที่ ถนน ซอย..."
              rows={2}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="ตำบล/แขวง">
              <Input
                value={shipping.subDistrict}
                onChange={(e) => onUpdate("subDistrict", e.target.value)}
              />
            </Field>
            <Field label="อำเภอ/เขต">
              <Input
                value={shipping.district}
                onChange={(e) => onUpdate("district", e.target.value)}
              />
            </Field>
            <Field label="จังหวัด">
              <Input
                value={shipping.province}
                onChange={(e) => onUpdate("province", e.target.value)}
              />
            </Field>
            <Field label="รหัสไปรษณีย์">
              <Input
                value={shipping.postalCode}
                onChange={(e) => onUpdate("postalCode", e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            ที่อยู่จัดส่งสามารถแก้ไขได้ภายหลังในหน้ารายละเอียดออเดอร์
          </p>
      </fieldset>
    </Section>
  );
}
