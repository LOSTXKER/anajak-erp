"use client";

import { Copy, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { c, CardHead } from "@/components/kit/kit";
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
  /** ปุ่ม "ใช้ที่อยู่ลูกค้า" — ส่งมาเมื่อลูกค้าที่เลือกมีที่อยู่ผู้ติดต่อให้ก๊อปจริง
   *  (เบสสั่ง 2026-08-12 · แทนการเติมให้เงียบๆ ซึ่งทำให้ที่อยู่หายตอนบันทึก) */
  onUseCustomerAddress?: () => void;
  /** ซ่อนช่องที่อยู่ตอนสวิตช์ปิดโดยไม่ล้างค่าใน state */
  collapseWhenInactive?: boolean;
}

/* การ์ดจัดส่งตามต้นแบบ mockup-order-form-2026-09-18: ปุ่มก๊อปที่อยู่ + สวิตช์อยู่หัวการ์ด
   ช่องที่อยู่เรียง ชื่อผู้รับ/เบอร์ → ที่อยู่เต็มแถว → ตำบล อำเภอ จังหวัด รหัสไปรษณีย์ */
export function OrderShippingSection({
  includeShipping,
  onIncludeShippingChange,
  shipping,
  onUpdate,
  onUseCustomerAddress,
  collapseWhenInactive = false,
}: OrderShippingSectionProps) {
  return (
    <section className={c("card")}>
      <CardHead
        icon={Truck}
        tone="good"
        title="การจัดส่ง"
        right={
          <>
            {/* ปุ่มก๊อปอยู่นอก fieldset — ต้องกดได้ตอนสวิตช์ยังปิด (กดแล้วเปิดสวิตช์ให้เอง)
                ไม่งั้นคนต้องรู้ลำดับ "เปิดสวิตช์ก่อนแล้วค่อยกดปุ่ม" ซึ่งไม่มีอะไรบอก */}
            {onUseCustomerAddress && (
              <button type="button" className={c("btn sm")} onClick={onUseCustomerAddress}>
                <Copy aria-hidden="true" />
                ใช้ที่อยู่ลูกค้า
              </button>
            )}
            <label htmlFor="include-order-shipping" className={cn(c("swrow"), "cursor-pointer")}>
              <Switch
                id="include-order-shipping"
                checked={includeShipping}
                onCheckedChange={onIncludeShippingChange}
              />
              จัดส่งตามที่อยู่
            </label>
          </>
        }
      />
      {(!collapseWhenInactive || includeShipping) && (
        <div className={c("cb")}>
          <fieldset
            disabled={!includeShipping}
            className={cn(c("form"), "min-w-0 transition-opacity", !includeShipping && "opacity-55")}
          >
            <div className={c("f2")}>
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
            <Field label="ที่อยู่" required={includeShipping} className={c("full")}>
              <Textarea
                required={includeShipping}
                value={shipping.address}
                onChange={(e) => onUpdate("address", e.target.value)}
                placeholder="บ้านเลขที่ ถนน ซอย..."
                rows={2}
              />
            </Field>
            <div className={c("f4")}>
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
        </div>
      )}
    </section>
  );
}
