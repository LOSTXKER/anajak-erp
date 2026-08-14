"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { UseAddressButton } from "@/components/orders/use-address-button";
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
  /** ปุ่ม "ใช้ที่อยู่ลูกค้า" — ส่งมาเมื่อลูกค้าที่เลือกมีที่อยู่ผู้ติดต่อให้ก๊อปจริง
   *  (เบสสั่ง 2026-08-12 · แทนการเติมให้เงียบๆ ซึ่งทำให้ที่อยู่หายตอนบันทึก) */
  onUseCustomerAddress?: () => void;
  /** โหมดแก้ออเดอร์: ไม่มีสวิตช์ "จัดส่งตามที่อยู่" — ออเดอร์ที่เปิดแล้วลบที่อยู่ทิ้ง
   *  ด้วยการล้างช่องได้ตรงๆ (input เป็น nullable ตั้งแต่ 2026-08-12) สวิตช์จึงเป็น
   *  ขั้นตอนซ้ำที่ทำให้สับสนว่า "ปิดแล้วที่อยู่เดิมหายไหม" */
  alwaysOn?: boolean;
  showGuidance?: boolean;
  /** ซ่อนช่องที่อยู่ตอนสวิตช์ปิดโดยไม่ล้างค่าใน state */
  collapseWhenInactive?: boolean;
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
  onUseCustomerAddress,
  alwaysOn = false,
  showGuidance = true,
  collapseWhenInactive = false,
}: OrderShippingSectionProps) {
  const active = alwaysOn || includeShipping;
  return (
    <Section
      id={id}
      tabIndex={id ? -1 : undefined}
      title={title}
      description={
        showGuidance
          ? alwaysOn
            ? "ล้างช่องให้ว่าง = ลบที่อยู่จัดส่งของงานนี้"
            : "ปิดอยู่ = ไม่บันทึกที่อยู่นี้"
          : undefined
      }
      bordered={!embedded}
      headingLevel={embedded ? 3 : 2}
      className={className}
      action={
        alwaysOn ? undefined : (
          <label htmlFor="include-order-shipping" className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-secondary">
            <Switch
              id="include-order-shipping"
              checked={includeShipping}
              onCheckedChange={onIncludeShippingChange}
            />
            จัดส่งตามที่อยู่
          </label>
        )
      }
    >
      {/* ปุ่มก๊อปอยู่นอก fieldset — ต้องกดได้ตอนสวิตช์ยังปิด (กดแล้วเปิดสวิตช์ให้เอง)
          ไม่งั้นคนต้องรู้ลำดับ "เปิดสวิตช์ก่อนแล้วค่อยกดปุ่ม" ซึ่งไม่มีอะไรบอก */}
      {onUseCustomerAddress && (
        <UseAddressButton onClick={onUseCustomerAddress} className="mb-3">
          ใช้ที่อยู่ลูกค้า
        </UseAddressButton>
      )}
      {(!collapseWhenInactive || active) && (
        <fieldset
          disabled={!active}
          className={cn("space-y-3 transition-opacity", !active && "opacity-55")}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="ชื่อผู้รับ" required={active}>
              <Input
                required={active}
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
          <Field label="ที่อยู่" required={active}>
            <Textarea
              required={active}
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
      )}
    </Section>
  );
}
