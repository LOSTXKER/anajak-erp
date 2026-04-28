"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/ui/section";

const labelClass =
  "mb-1 block text-[12px] text-slate-500 dark:text-slate-400";

const sectionLabelClass =
  "mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400";

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
  showShipping: boolean;
  onToggleShipping: () => void;
  shipping: ShippingData;
  onUpdate: <K extends keyof ShippingData>(field: K, value: ShippingData[K]) => void;
}

export function OrderShippingSection({
  showShipping,
  onToggleShipping,
  shipping,
  onUpdate,
}: OrderShippingSectionProps) {
  return (
    <Section
      title="ที่อยู่จัดส่ง"
      compact
      action={
        <Button
          type="button"
          variant={showShipping ? "subtle" : "outline"}
          size="sm"
          onClick={onToggleShipping}
        >
          {showShipping ? "ซ่อน" : "ระบุที่อยู่"}
        </Button>
      }
    >
      {showShipping ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={sectionLabelClass}>ชื่อผู้รับ *</label>
              <Input
                value={shipping.recipientName}
                onChange={(e) => onUpdate("recipientName", e.target.value)}
                placeholder="ชื่อ-นามสกุล ผู้รับ"
              />
            </div>
            <div>
              <label className={sectionLabelClass}>เบอร์โทร *</label>
              <Input
                value={shipping.phone}
                onChange={(e) => onUpdate("phone", e.target.value)}
                placeholder="08X-XXX-XXXX"
              />
            </div>
          </div>
          <div>
            <label className={sectionLabelClass}>ที่อยู่ *</label>
            <Textarea
              value={shipping.address}
              onChange={(e) => onUpdate("address", e.target.value)}
              placeholder="บ้านเลขที่ ถนน ซอย..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className={labelClass}>ตำบล/แขวง</label>
              <Input
                value={shipping.subDistrict}
                onChange={(e) => onUpdate("subDistrict", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>อำเภอ/เขต</label>
              <Input
                value={shipping.district}
                onChange={(e) => onUpdate("district", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>จังหวัด</label>
              <Input
                value={shipping.province}
                onChange={(e) => onUpdate("province", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>รหัสไปรษณีย์</label>
              <Input
                value={shipping.postalCode}
                onChange={(e) => onUpdate("postalCode", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            ที่อยู่จัดส่งสามารถแก้ไขได้ภายหลังในหน้ารายละเอียดออเดอร์
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          ยังไม่ได้ระบุที่อยู่จัดส่ง
        </p>
      )}
    </Section>
  );
}
