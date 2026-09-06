"use client";

/**
 * ของที่ "ไม่ได้กำลังเทียบ" ในหน้าลองแท็บรายการ — ทุกทางใช้ชุดเดียวกัน
 *   · กรอบการ์ด "รายการสินค้า" + หัวการ์ด (ชิปจำนวน/ยอด · ปุ่มแก้ไข) — ลอกจาก order-items-display.tsx
 *   · การ์ดค่าธรรมเนียม — ลอกจากไฟล์เดียวกัน
 *   · ตัวช่วยนับจำนวน/แจกแจงราคา — เรียก helper กลาง lib/pricing ตัวเดียวกับของจริง
 *
 * ตั้งใจให้เหมือนกันทุกทาง เพื่อให้สิ่งที่เบสเทียบคือ "เนื้อในของรายการ" ไม่ใช่กรอบรอบ ๆ
 */

import type { ReactNode } from "react";
import { Edit3, Package, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoChip } from "@/components/ui/info-chip";
import { SectionTitle, ToneMark } from "@/components/ui/section";
import { formatCurrency } from "@/lib/utils";
import { buildItemPriceLines, orderItemFormToPricingItem, sumOrderQuantity } from "@/lib/pricing";
import type { PriceLine } from "@/lib/pricing";
import {
  PRICING_TYPE_LABELS,
  PRINT_POSITIONS,
  PRINT_SIZES,
  PRINT_TYPES,
} from "@/types/order-form";
import type { PricingType } from "@/types/order-form";
import type { DemoFees, DemoItem, DemoItems } from "./_data";

export type DemoProduct = DemoItem["products"][number];
export type DemoVariantRow = DemoProduct["variants"][number];
export type DemoPrint = DemoItem["prints"][number];
export type DemoAddon = DemoItem["addons"][number];

/* ---------------------------------------------------------------- ตัวเลข */

export function productQty(prod: DemoProduct): number {
  return prod.variants?.reduce((s, v) => s + v.quantity, 0) ?? 0;
}

export function itemQty(item: DemoItem): number {
  return item.products?.reduce((s, p) => s + productQty(p), 0) ?? 0;
}

export function netUnitPrice(prod: DemoProduct): number {
  return Math.max(0, (prod.baseUnitPrice ?? 0) - (prod.discount ?? 0));
}

export function addonQty(addon: DemoAddon, itemTotalQty: number): number {
  return addon.pricingType === "PER_PIECE" ? (addon.quantity ?? itemTotalQty) : 1;
}

/** แจกแจงยอดด้วย helper กลางตัวเดียวกับของจริง — ห้ามคำนวณเองใน JSX */
export function itemPriceLines(item: DemoItem): PriceLine[] {
  const pricingItem = {
    ...orderItemFormToPricingItem({
      products: (item.products ?? []).map((p) => ({
        baseUnitPrice: p.baseUnitPrice ?? 0,
        discount: p.discount ?? 0,
        variants: (p.variants ?? []).map((v) => ({ quantity: v.quantity })),
      })),
      prints: (item.prints ?? []).map((p) => ({ unitPrice: p.unitPrice ?? 0 })),
      addons: (item.addons ?? []).map((a) => ({ pricingType: a.pricingType, unitPrice: a.unitPrice ?? 0 })),
    }),
    addons: (item.addons ?? []).map((a) => ({
      pricingType: a.pricingType,
      unitPrice: a.unitPrice ?? 0,
      quantity: a.quantity,
    })),
  };
  return buildItemPriceLines(pricingItem);
}

export function priceLineText(item: DemoItem, line: PriceLine): { label: string; detail: string } {
  if (line.kind === "product") {
    const prod = item.products?.[line.index];
    const sizes = [...new Set((prod?.variants ?? []).map((v) => v.size).filter(Boolean))].join(" · ");
    return {
      label: prod?.product?.name || prod?.description || `สินค้า ${line.index + 1}`,
      detail: sizes,
    };
  }
  if (line.kind === "print") {
    const print = item.prints?.[line.index];
    if (!print) return { label: "งานพิมพ์", detail: "" };
    return {
      label: PRINT_TYPES[print.printType] ?? print.printType,
      detail: PRINT_POSITIONS[print.position] ?? print.position,
    };
  }
  const addon = item.addons?.[line.index];
  if (!addon) return { label: "ส่วนเสริม", detail: "" };
  return {
    label: addon.name || "ส่วนเสริม",
    detail: PRICING_TYPE_LABELS[addon.pricingType as PricingType] ?? addon.pricingType,
  };
}

/** ป้ายขนาดลายแบบเดียวกับช่อง "ขนาด" ในฟอร์ม (A3 / A4 / กำหนดเอง) */
export function printSizeLabel(print: DemoPrint): string {
  const key = print.printSize;
  if (key && PRINT_SIZES[key]) return key === "CUSTOM" ? PRINT_SIZES.CUSTOM.label : key;
  return print.width || print.height ? "กำหนดเอง" : "—";
}

export function printDims(print: DemoPrint): string {
  return print.width || print.height ? `${print.width || 0} × ${print.height || 0}` : "—";
}

/* ---------------------------------------------------------------- กรอบการ์ด */

/**
 * หัว "รายการสินค้า" + ชิป + ปุ่มแก้ไข — ข้อความชุดเดียวกับของจริงทุกทาง
 * `bare` = ไม่มีการ์ดใหญ่ครอบ (ทาง A ล้อหน้าแก้ไขที่หนึ่งชุดงาน = หนึ่งการ์ดอยู่แล้ว
 * ครอบซ้ำจะได้การ์ดซ้อนการ์ด ซึ่งเบสสั่งเอาออกจากฟอร์มไปแล้ว 2026-08-14)
 */
export function ItemsCardFrame({
  items,
  showMoney,
  bare = false,
  children,
}: {
  items: DemoItems;
  showMoney: boolean;
  bare?: boolean;
  children: ReactNode;
}) {
  const isSingleItem = items.length === 1;
  const orderTotalQty = sumOrderQuantity(items);
  const singleSubtotal = isSingleItem ? items[0]?.subtotal ?? null : null;

  const heading = (
    <div className="flex items-center justify-between gap-3">
      <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        <ToneMark icon={Package} tone="product" />
        <span className="[overflow-wrap:anywhere]">
          รายการสินค้า
          {!isSingleItem ? ` (${items.length})` : ""}
        </span>
        {orderTotalQty > 0 ? (
          <InfoChip size="sm" strong>
            {orderTotalQty} ชิ้น
          </InfoChip>
        ) : null}
        {showMoney && singleSubtotal != null && (
          <InfoChip size="sm" className="tabular-nums">
            {formatCurrency(singleSubtotal)}
          </InfoChip>
        )}
      </CardTitle>
      <Button variant="outline" size="sm" className="flex-shrink-0 gap-1.5">
        <Edit3 />
        แก้ไข
      </Button>
    </div>
  );

  if (bare) {
    return (
      <section className="space-y-4">
        {heading}
        {children}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>{heading}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function FeesCard({ fees, showMoney }: { fees: DemoFees; showMoney: boolean }) {
  if (!fees || fees.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SectionTitle icon={Receipt} tone="finance">
            ค่าธรรมเนียม / ค่าใช้จ่ายเพิ่มเติม
          </SectionTitle>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fees.map((fee, i) => (
            <div
              key={fee.id ?? i}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                {fee.feeType && <Badge variant="secondary">{fee.feeType}</Badge>}
                <span className="text-sm text-secondary">{fee.name || fee.feeType || "ค่าธรรมเนียม"}</span>
              </div>
              {showMoney && (
                <span className="tabular-nums text-sm font-medium text-strong">
                  {formatCurrency(fee.amount ?? 0)}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
