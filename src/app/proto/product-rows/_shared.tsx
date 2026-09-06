"use client";

/**
 * ของที่ "ไม่ได้กำลังเทียบ" ในหน้าลองสินค้าในชุดงาน — ทุกทางใช้ชุดเดียวกัน
 *   · state ของสินค้าในชุดงาน + handler (แก้ช่อง / แก้ไซส์ / ลบ / เลื่อน)
 *   · โครงคอลัมน์ 8 ช่อง ความกว้างเดียวกับ ItemTableCols ของฟอร์มจริง
 *   · ช่องกรอกแต่ละช่องใช้ component ตัวจริง (Input · Select · MoneyInput · NumberInput · SizeMatrix · ProductRowActions)
 *   · ช่องสเปคตัดเย็บ 9 ช่องเขียนตามฟอร์มจริง (CustomMadeDetail) แต่ตัวเลือกแพทเทิร์นเป็นของปลอม
 *     เพราะตัวจริงยิงฐานข้อมูล — เขียนบอกไว้บนหน้าแล้ว
 * สิ่งที่แต่ละทางต่างกันคือ "วางช่องเหล่านี้ตรงไหน" เท่านั้น
 */

import { useState, type ReactNode } from "react";
import { ImageIcon, Plus, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { RADIUS, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { SizeMatrix } from "@/components/orders/new/size-matrix";
import { ProductRowActions } from "@/components/orders/new/product-row-actions";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { sumVariantQty } from "@/lib/size-matrix";
import { cn, formatCurrency } from "@/lib/utils";
import {
  BODY_FITS,
  COLLAR_TYPES,
  FABRIC_TYPES,
  PRODUCT_TYPES,
  SLEEVE_TYPES,
  type OrderItemProductForm,
  type VariantForm,
} from "@/types/order-form";
import { PACKAGING, PATTERNS } from "./_data";

/* ------------------------------------------------------------------ state */

export interface ProductHandlers {
  update: (idx: number, field: keyof OrderItemProductForm, value: unknown) => void;
  setVariants: (idx: number, variants: VariantForm[]) => void;
  remove: (idx: number) => void;
  move: (idx: number, direction: -1 | 1) => void;
}

export function useProtoProducts(initial: OrderItemProductForm[]) {
  const [products, setProducts] = useState(initial);
  const handlers: ProductHandlers = {
    update: (idx, field, value) =>
      setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))),
    setVariants: (idx, variants) =>
      setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, variants } : p))),
    remove: (idx) => setProducts((prev) => prev.filter((_, i) => i !== idx)),
    move: (idx, direction) =>
      setProducts((prev) => {
        const next = [...prev];
        const j = idx + direction;
        if (j < 0 || j >= next.length) return prev;
        [next[idx], next[j]] = [next[j], next[idx]];
        return next;
      }),
  };
  return [products, handlers] as const;
}

/* --------------------------------------------------------------- ตัวเลข */

export function netPrice(p: OrderItemProductForm): number {
  return Math.max(0, p.baseUnitPrice - (p.discount || 0));
}
export function totalQty(p: OrderItemProductForm): number {
  return sumVariantQty(p.variants.filter((v) => v.size.trim()));
}
export function lineTotal(p: OrderItemProductForm): number {
  return p.itemSource === "CUSTOMER_PROVIDED" ? 0 : netPrice(p) * totalQty(p);
}
export const isStock = (p: OrderItemProductForm) => p.itemSource === "FROM_STOCK";
export const isCustomMade = (p: OrderItemProductForm) => p.itemSource === "CUSTOM_MADE";
export const isCustomerProvided = (p: OrderItemProductForm) => p.itemSource === "CUSTOMER_PROVIDED";

/* ------------------------------------------------------------------ ชิ้น */

export const TH = "px-2 py-2.5 text-xs font-medium";
export const DENSE_CELL = "px-2 py-2 align-top";

/** โครงคอลัมน์เดียวกับฟอร์มจริง (ItemTableCols) — แหล่ง · สินค้า · แพค · ราคา · ส่วนลด · จำนวน · รวม · จัดการ */
export function FormCols() {
  return (
    <colgroup>
      <col style={{ width: 100 }} />
      <col />
      <col style={{ width: 104 }} />
      <col style={{ width: 112 }} />
      <col style={{ width: 92 }} />
      <col style={{ width: 76 }} />
      <col style={{ width: 96 }} />
      <col style={{ width: 44 }} />
    </colgroup>
  );
}

export function FormHead() {
  return (
    <thead className={TABLE_HEAD_SURFACE}>
      <tr>
        <th className={cn(TH, "text-left")}>แหล่ง</th>
        <th className={cn(TH, "text-left")}>สินค้า</th>
        <th className={cn(TH, "text-center")}>แพค</th>
        <th className={cn(TH, "text-center")}>ราคา</th>
        <th className={cn(TH, "text-center")}>ส่วนลด</th>
        <th className={cn(TH, "text-center")}>จำนวน</th>
        <th className={cn(TH, "text-center")}>รวม</th>
        <th className="py-2.5"><span className="sr-only">จัดลำดับและลบสินค้า</span></th>
      </tr>
    </thead>
  );
}

export function SourceBadge({ p }: { p: OrderItemProductForm }) {
  const s = p.itemSource ? getProductSourcePresentation(p.itemSource) : null;
  if (!s) return null;
  return <Badge variant={s.variant} size="sm">{s.label}</Badge>;
}

export function Dash() {
  return <span className="text-xs text-muted">—</span>;
}

/** ช่อง "สินค้า" — สต๊อก = รูป+ชื่อ+รหัส · ตัดเย็บ/ลูกค้า = ช่องพิมพ์ชื่อ */
export function IdentityCell({ p, idx, h, dense = true }: { p: OrderItemProductForm; idx: number; h: ProductHandlers; dense?: boolean }) {
  if (isStock(p)) {
    const label = p.productName || "สินค้า";
    const v = p.variants[0];
    return (
      <div className="flex items-center gap-2">
        {p.productImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.productImageUrl} alt={label} className="h-9 w-9 flex-shrink-0 rounded-lg border border-border object-cover" />
        ) : (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted"><ImageIcon className="h-4 w-4 text-muted" /></div>
        )}
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-strong">{label}</span>
          {v && <span className="block text-xs text-secondary">{[v.color, v.size].filter(Boolean).join(" ")}</span>}
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            {p.productSku && <span className="font-mono">{p.productSku}</span>}
            {p.stockAvailable != null && <span className="text-green-600 dark:text-green-400">คลัง {p.stockAvailable}</span>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <Input
      aria-label={`ชื่อสินค้า ${idx + 1}`}
      value={p.description}
      onChange={(e) => h.update(idx, "description", e.target.value)}
      placeholder={isCustomerProvided(p) ? "ชื่อสินค้า เช่น เสื้อยืดลูกค้า" : "ชื่อสินค้า เช่น เสื้อคอกลม Cotton"}
      size={dense ? "dense" : undefined}
    />
  );
}

export function PackSelect({ p, idx, h, dense = true }: { p: OrderItemProductForm; idx: number; h: ProductHandlers; dense?: boolean }) {
  return (
    <Select size={dense ? "dense" : undefined} aria-label={`แพคสินค้า ${idx + 1}`} value={p.packagingOptionId} onChange={(e) => h.update(idx, "packagingOptionId", e.target.value)}>
      <option value="">—</option>
      {PACKAGING.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </Select>
  );
}

export function PriceInput({ p, idx, h, field, dense = true }: { p: OrderItemProductForm; idx: number; h: ProductHandlers; field: "baseUnitPrice" | "discount"; dense?: boolean }) {
  if (isCustomerProvided(p)) return <div className={cn("flex items-center justify-center", dense ? "h-9" : CONTROL_MIN_H)}><Dash /></div>;
  return (
    <MoneyInput
      aria-label={`${field === "discount" ? "ส่วนลดต่อชิ้น" : "ราคา"} สินค้า ${idx + 1}`}
      value={p[field]}
      onValueChange={(v) => h.update(idx, field, v)}
      size={dense ? "dense" : undefined}
      className="w-full px-2"
    />
  );
}

export function QtyCell({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  if (!isStock(p)) {
    return <div className="flex h-9 items-center justify-center text-sm font-medium text-secondary tabular-nums">{totalQty(p)}</div>;
  }
  const v = p.variants[0];
  return (
    <NumberInput
      integer
      aria-label={`จำนวนสินค้า ${idx + 1}`}
      min={0}
      value={v?.quantity ?? 0}
      onValueChange={(q) => h.setVariants(idx, [{ ...(v ?? { size: "", color: "" }), quantity: q }])}
      size="dense"
      className="w-full text-center"
    />
  );
}

export function TotalCell({ p }: { p: OrderItemProductForm }) {
  if (isCustomerProvided(p)) return <div className="flex h-9 items-center justify-center"><Dash /></div>;
  return <div className="flex h-9 items-center justify-center text-sm font-semibold tabular-nums text-strong">{formatCurrency(lineTotal(p))}</div>;
}

export function RowActions({ idx, total, h, mode = "menu" }: { idx: number; total: number; h: ProductHandlers; mode?: "menu" | "inline" }) {
  return <ProductRowActions mode={mode} productIndex={idx} totalProducts={total} onMove={(d) => h.move(idx, d)} onRemove={() => h.remove(idx)} />;
}

/* ------------------------------------------------------- สเปคตัดเย็บ (9 ช่อง) */

/** ช่องสเปคชุดเดียวกับ CustomMadeDetail ของจริง — แพทเทิร์นเป็นรายการปลอม (ตัวจริงยิงฐาน) */
export function SpecFields({ p, idx, h, compact = false }: { p: OrderItemProductForm; idx: number; h: ProductHandlers; compact?: boolean }) {
  const size = compact ? "sm" : undefined;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Scissors className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        <span className="text-xs font-semibold text-secondary">สเปคตัดเย็บ</span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1.5 text-muted"><Plus className="h-3 w-3" />สร้างแพทเทิร์นใหม่</Button>
      </div>
      <Select size={size} aria-label={`แพทเทิร์น สินค้า ${idx + 1}`} value={p.patternId ?? ""} onChange={(e) => h.update(idx, "patternId", e.target.value || undefined)}>
        <option value="">เลือกแพทเทิร์น</option>
        {PATTERNS.map((pt) => <option key={pt.id} value={pt.id}>{pt.name} — {pt.description}</option>)}
      </Select>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="ประเภทสินค้า"><Select size={size} value={p.productType} onChange={(e) => h.update(idx, "productType", e.target.value)}>{Object.entries(PRODUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="ชนิดผ้า"><Select size={size} value={p.fabricType} onChange={(e) => h.update(idx, "fabricType", e.target.value)}><option value="">เลือก</option>{Object.entries(FABRIC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="ส่วนผสมผ้า"><Input size={size} value={p.material} onChange={(e) => h.update(idx, "material", e.target.value)} placeholder="เช่น Cotton 60% Poly 40%" /></Field>
        <Field label="น้ำหนักผ้า"><Input size={size} value={p.fabricWeight} onChange={(e) => h.update(idx, "fabricWeight", e.target.value)} placeholder="160gsm" /></Field>
        <Field label="สีผ้า"><Input size={size} value={p.fabricColor} onChange={(e) => h.update(idx, "fabricColor", e.target.value)} placeholder="ขาว, ดำ" /></Field>
        <Field label="ทรงคอ"><Select size={size} value={p.collarType} onChange={(e) => h.update(idx, "collarType", e.target.value)}><option value="">เลือก</option>{Object.entries(COLLAR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="แขน"><Select size={size} value={p.sleeveType} onChange={(e) => h.update(idx, "sleeveType", e.target.value)}><option value="">เลือก</option>{Object.entries(SLEEVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="ทรงตัว"><Select size={size} value={p.bodyFit} onChange={(e) => h.update(idx, "bodyFit", e.target.value)}><option value="">เลือก</option>{Object.entries(BODY_FITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="หมายเหตุแพทเทิร์น"><Input size={size} value={p.patternNote} onChange={(e) => h.update(idx, "patternNote", e.target.value)} placeholder="หมายเหตุ..." /></Field>
      </div>
    </div>
  );
}

/** สรุปสเปคที่กรอกแล้วเป็นชิป (ใช้ตอนพับ) */
export function specSummary(p: OrderItemProductForm): string[] {
  return [
    PRODUCT_TYPES[p.productType],
    FABRIC_TYPES[p.fabricType],
    p.fabricWeight,
    p.fabricColor,
    COLLAR_TYPES[p.collarType],
    SLEEVE_TYPES[p.sleeveType],
    BODY_FITS[p.bodyFit],
  ].filter((s): s is string => Boolean(s));
}

/* ------------------------------------------------------------- ไซส์และจำนวน */

export function SizeBlock({ p, idx, h, prefix }: { p: OrderItemProductForm; idx: number; h: ProductHandlers; prefix: string }) {
  return (
    <SizeMatrix
      embedded
      idPrefix={`${prefix}-${p.formKey ?? idx}`}
      title={isCustomerProvided(p) ? "จำนวนที่ลูกค้าส่งมา" : "ไซส์และจำนวน"}
      variants={p.variants}
      onChange={(v) => h.setVariants(idx, v)}
    />
  );
}

/** พื้นที่รายละเอียดใต้แถว — พื้นขาว มีเส้นบางซ้ายบอกว่าเป็นลูกของแถวบน (ไม่ใช่กล่องเทา) */
export function DetailRail({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-l-2 border-border pl-4", className)}>{children}</div>;
}

export function CustomerNote() {
  return <p className="text-xs text-secondary">ตัวเสื้อเป็นของลูกค้า จึงไม่คิดราคาตัวเสื้อ</p>;
}

/* ------------------------------------------------------------ การ์ดจอแคบ */

/** การ์ดต่อสินค้าบนจอแคบ — ขอบบาง พื้นขาว (แทนกล่องเทาเดิม) */
export function NarrowCard({ p, idx, total, h, children }: { p: OrderItemProductForm; idx: number; total: number; h: ProductHandlers; children?: ReactNode }) {
  return (
    <div className={cn(RADIUS.inner, "space-y-3 border border-border p-3")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">สินค้า {idx + 1}/{total}</span>
          <SourceBadge p={p} />
        </div>
        <RowActions idx={idx} total={total} h={h} mode="inline" />
      </div>
      <IdentityCell p={p} idx={idx} h={h} dense={false} />
      <div className={cn("grid gap-3", isCustomerProvided(p) ? "grid-cols-1" : "grid-cols-3")}>
        <Field label="แพค"><PackSelect p={p} idx={idx} h={h} dense={false} /></Field>
        {!isCustomerProvided(p) && <Field label="ราคา/ชิ้น"><PriceInput p={p} idx={idx} h={h} field="baseUnitPrice" dense={false} /></Field>}
        {!isCustomerProvided(p) && <Field label="ส่วนลด/ชิ้น"><PriceInput p={p} idx={idx} h={h} field="discount" dense={false} /></Field>}
      </div>
      {children}
      {!isCustomerProvided(p) && (
        <div className="flex items-center justify-between border-t border-divider pt-3 text-sm">
          <span className="text-secondary">รวม {totalQty(p)} ตัว</span>
          <span className="font-semibold tabular-nums text-strong">{formatCurrency(lineTotal(p))}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ หัวหมวด */

export function SectionHead() {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-sm font-semibold text-strong">สินค้าในชุดงาน</span>
      <Button type="button" variant="ghost" size="sm" className="gap-1.5"><Plus />เพิ่มสินค้า</Button>
    </div>
  );
}
