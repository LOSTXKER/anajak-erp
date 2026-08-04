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
  embedded?: boolean;
  title?: React.ReactNode;
  className?: string;
  /** anchor ให้แถบขั้นตอนของหน้าเปิดงานกระโดดมาได้ */
  id?: string;
}

export function OrderShippingSection({
  includeShipping,
  onIncludeShippingChange,
  shipping,
  onUpdate,
  embedded = false,
  title = "การจัดส่ง",
  className,
  id,
}: OrderShippingSectionProps) {
  return (
    <Section
      id={id}
      tabIndex={id ? -1 : undefined}
      title={title}
      description="ปิดอยู่ = ไม่บันทึกที่อยู่นี้"
      bordered={!embedded}
      className={className}
      action={
        <label htmlFor="include-order-shipping" className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-secondary">
          <Switch
            id="include-order-shipping"
            checked={includeShipping}
            onCheckedChange={onIncludeShippingChange}
          />
          จัดส่งตามที่อยู่
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
      </fieldset>
    </Section>
  );
}
