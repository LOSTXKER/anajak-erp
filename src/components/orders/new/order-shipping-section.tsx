"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const sectionLabelClass =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          ที่อยู่จัดส่ง
        </CardTitle>
        <Button
          type="button"
          variant={showShipping ? "default" : "outline"}
          size="sm"
          onClick={onToggleShipping}
          className={showShipping ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
        >
          {showShipping ? "ซ่อน" : "ระบุที่อยู่"}
        </Button>
      </CardHeader>
      {showShipping && (
        <CardContent className="space-y-3">
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
        </CardContent>
      )}
    </Card>
  );
}
