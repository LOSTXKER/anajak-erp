"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle, ToneMark } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, formatCurrency, isImageUrl } from "@/lib/utils";
import {
  COLLAR_TYPES,
  SLEEVE_TYPES,
  BODY_FITS,
  FABRIC_TYPES,
  GARMENT_CONDITIONS,
  PRICING_TYPE_LABELS,
  PRINT_POSITIONS,
  PRINT_SIZES,
  PRINT_TYPES,
  PRODUCT_TYPES,
} from "@/types/order-form";
import type { PricingType } from "@/types/order-form";
import { buildItemPriceLines, orderItemFormToPricingItem, sumOrderQuantity } from "@/lib/pricing";
import type { PriceLine } from "@/lib/pricing";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { Package, Receipt, PlusCircle, Edit3, Check, ImageIcon } from "lucide-react";
import { FOCUS_BUTTON, RADIUS, SUNK_PANEL, TABLE_HEAD_SURFACE, TINT } from "@/components/ui/tokens";
import { Alert } from "@/components/ui/alert";

type OrderData = RouterOutput["order"]["getById"];
type OrderItem = OrderData["items"][number];
type OrderItemProduct = OrderItem["products"][number];
type OrderItemPrint = OrderItem["prints"][number];
type OrderItemAddon = OrderItem["addons"][number];
type OrderFee = OrderData["fees"][number];

// ============================================================
// Receive Tracking Inline Form (for CUSTOMER_PROVIDED items)
// ============================================================

function ReceiveTrackingInline({ product, onSuccess, readOnly }: {
  product: { id: string; garmentCondition?: string | null; receivedInspected: boolean; receiveNote?: string | null };
  onSuccess: () => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [condition, setCondition] = useState(product.garmentCondition ?? "");
  const [note, setNote] = useState(product.receiveNote ?? "");

  const mutation = trpc.order.updateReceiveTracking.useMutation({
    onSuccess: () => { setEditing(false); onSuccess(); },
  });

  if (!editing || readOnly) {
    return (
      <div className={cn(TINT.warning, "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs")}>
        <Package className="h-3.5 w-3.5 text-yellow-600" />
        <span className="font-medium text-yellow-700 dark:text-yellow-300">ตรวจรับของ:</span>
        {product.receivedInspected ? (
          <>
            <Badge variant="default">ตรวจรับแล้ว</Badge>
            {product.garmentCondition && <span className="text-muted">สภาพ: {GARMENT_CONDITIONS[product.garmentCondition] ?? product.garmentCondition}</span>}
            {product.receiveNote && <span className="text-muted">({product.receiveNote})</span>}
          </>
        ) : (
          <span className="text-muted">ยังไม่มีหลักฐานใบตรวจรับ</span>
        )}
        {!readOnly ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="ml-auto gap-1.5 text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300">
            <Edit3 />แก้สภาพ/หมายเหตุ
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Alert variant="warning">
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-3.5 w-3.5 text-yellow-600" />
        <div>
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">ข้อมูลสภาพเสื้อจากลูกค้า</p>
          <p className="text-xs text-muted">สถานะตรวจรับอ้างอิงจากใบตรวจรับและยอดนับจริงเท่านั้น</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`garment-condition-${product.id}`} className="mb-0.5 block text-xs font-medium text-muted">สภาพเสื้อ</label>
          <Select size="sm" id={`garment-condition-${product.id}`} value={condition} onChange={(e) => setCondition(e.target.value)} className={cn("px-2 py-1", FOCUS_BUTTON)}>
            <option value="">เลือก</option>
            {Object.entries(GARMENT_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label htmlFor={`garment-note-${product.id}`} className="mb-0.5 block text-xs font-medium text-muted">หมายเหตุ</label>
          <Input size="sm" id={`garment-note-${product.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เสื้อสภาพดี มีถุงครบ" />
        </div>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" onClick={() => mutation.mutate({ orderItemProductId: product.id, garmentCondition: condition || undefined, receiveNote: note || undefined })} disabled={mutation.isPending} className="h-8 gap-1.5 bg-yellow-700 text-white hover:bg-yellow-800">
            <Check />{mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setCondition(product.garmentCondition ?? ""); setNote(product.receiveNote ?? ""); }} className="h-8">
            ยกเลิก
          </Button>
        </div>
      </div>
      {mutation.isError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{mutation.error.message}</p>}
    </Alert>
  );
}

// ============================================================
// Order Items Display — แบบ A "เหมือนหน้าแก้ไข" (เบสเคาะ 2026-09-06 · /proto/order-items)
//
// แท็บรายการวางโครงเดียวกับฟอร์มสร้าง/แก้ (`components/orders/new/order-item-card.tsx`)
// แต่เป็นตัวหนังสืออ่านอย่างเดียว — เบสเห็นของเดิม (ก้อนต่อเสื้อ + ตารางย่อยหลายชั้น)
// แล้วบอก "แสดงผลได้งงมาก แสดงเหมือนตอนแก้ไขจะมองง่ายกว่า"
//   · หนึ่งชุดงาน = หนึ่งการ์ด `card-surface` (ไม่มีการ์ดใหญ่ครอบ — เหมือนหน้าแก้ไข)
//   · ลำดับหมวดตามฟอร์ม (มติ 2026-08-14): ลาย → เสื้อ → ส่วนเสริม → หมายเหตุ → สรุปราคา
//   · ตาราง 3 หมวดใช้ความกว้างคอลัมน์ชุดเดียวกับ `ItemTableCols` ของฟอร์ม (ตัดช่องปุ่ม 44px ทิ้ง)
//   · เสื้อสต๊อกล้วน = ตาราง · มีเสื้อตัดเย็บ/ลูกค้าส่งมา = กล่องจมแบบ `ProductAdaptiveCard`
//   · จอแคบ (< @2xl ของกล่อง) สลับเป็นการ์ดเหมือน `ProductCardMobile`/`PrintCardMobile`
// แก้ฟอร์มเมื่อไหร่ต้องแก้ตรงนี้ตาม ไม่งั้น "ดู" กับ "แก้" กลับมา drift อีก
// ============================================================

interface OrderItemsDisplayProps {
  orderId: string;
  items: OrderItem[];
  fees: OrderFee[];
  // ปุ่มแก้ไขบนหัวการ์ด — จุดแก้รายการต้องอยู่ที่รายการ ไม่ใช่ซ่อนในเมนู ⋯ อย่างเดียว
  onEditItems?: () => void;
  // นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นราคา — false = ตัดคอลัมน์/ช่องเงินออก (ห้ามโชว์ ฿0)
  // จำนวน/ไซส์/รายละเอียดงานยังเห็นครบ (ต้องใช้ทำงาน)
  showMoney?: boolean;
  // Production V2 ให้จุดเตรียมงานเป็นเจ้าของหลักฐานรับเสื้อ หน้า Order อ่านอย่างเดียว
  canEditReceiveTracking?: boolean;
}

const GROUP_HEADING = "text-sm font-semibold text-strong";
const TH = "px-2 py-2.5 text-xs font-medium";
const TD = "px-2 py-2 align-middle text-sm";
const NUM = "tabular-nums";

/* ---------------------------------------------------------------- ตัวเลข */

function productQty(prod: OrderItemProduct): number {
  return prod.variants?.reduce((s, v) => s + v.quantity, 0) ?? 0;
}

function itemQty(item: OrderItem): number {
  return item.products?.reduce((s, p) => s + productQty(p), 0) ?? 0;
}

function netUnitPrice(prod: OrderItemProduct): number {
  return Math.max(0, (prod.baseUnitPrice ?? 0) - (prod.discount ?? 0));
}

/** แจกแจงยอดด้วย helper กลางตัวเดียวกับหน้าเปิดงาน — ห้ามคำนวณเองใน JSX
 *  (สูตรอยู่ที่เดียว ผลรวมทุกบรรทัดจึงเท่า item.subtotal ที่ server คิดเสมอ) */
function itemPriceLines(item: OrderItem): PriceLine[] {
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
    // ตัวแปลงฟอร์มไม่รู้จัก quantity ที่ล็อกไว้ราย addon (ฟอร์มไม่มีช่องนี้ แต่ฐานข้อมูลมี)
    // ถ้าไม่ใส่คืน ยอดส่วนเสริมจะเพี้ยนจากที่ server เก็บเงินจริง
    addons: (item.addons ?? []).map((a) => ({
      pricingType: a.pricingType,
      unitPrice: a.unitPrice ?? 0,
      quantity: a.quantity,
    })),
  };
  return buildItemPriceLines(pricingItem);
}

/**
 * ป้ายไทยของแต่ละบรรทัดใน "สรุปราคา"
 *
 * buildItemPriceLines คืนแค่ตัวเลข + ตำแหน่งใน array (ตัวมันไม่รู้จักภาษา) —
 * การแปลรหัส FRONT/DTF/T_SHIRT เป็นคำไทยจึงอยู่ฝั่งหน้าจอที่เดียวกับตารางอื่นในหน้านี้
 */
function priceLineText(item: OrderItem, line: PriceLine): { label: string; detail: string } {
  if (line.kind === "product") {
    const prod = item.products?.[line.index];
    // ไซส์ที่ไม่ซ้ำของสินค้าตัวนั้น — บอกได้ว่าบรรทัดนี้คือของกอง S/M/L กองไหน
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
function printSizeLabel(print: OrderItemPrint): string {
  const key = print.printSize;
  if (key && PRINT_SIZES[key]) return key === "CUSTOM" ? PRINT_SIZES.CUSTOM.label : key;
  return print.width || print.height ? "กำหนดเอง" : "—";
}

function printDims(print: OrderItemPrint): string {
  return print.width || print.height ? `${print.width || 0} × ${print.height || 0}` : "—";
}

/* โครงคอลัมน์ร่วมของ 3 ตาราง — ตัวเลขเดียวกับ ItemTableCols ของฟอร์ม ยกเว้นไม่มีช่องปุ่ม 44px
   (เบสสั่ง 2026-08-03 "แถวคอลัมขอให้มันตรงกันทั้งหมด" — หน้าดูก็ต้องตรงกับหน้าแก้ด้วย) */
function ItemTableCols() {
  return (
    <colgroup>
      <col style={{ width: 100 }} />
      <col />
      <col style={{ width: 104 }} />
      <col style={{ width: 112 }} />
      <col style={{ width: 92 }} />
      <col style={{ width: 76 }} />
      <col style={{ width: 96 }} />
    </colgroup>
  );
}

function Dash() {
  return <span className="text-muted">—</span>;
}

/* ------------------------------------------------------------------ ลาย */

function PrintThumb({ print, size = "h-11 w-11" }: { print: OrderItemPrint; size?: string }) {
  const positionLabel = PRINT_POSITIONS[print.position] ?? print.position;
  if (isImageUrl(print.designImageUrl)) {
    return (
      <a
        href={print.designImageUrl!}
        target="_blank"
        rel="noreferrer"
        title="เปิดภาพเต็ม"
        className={cn("inline-block", RADIUS.item, FOCUS_BUTTON)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={print.designImageUrl!}
          alt={`ลาย ${positionLabel}`}
          className={cn(RADIUS.item, size, "border border-border object-cover")}
        />
      </a>
    );
  }
  if (print.designImageUrl) {
    // มีไฟล์แต่ไม่ใช่รูป (เช่น .ai/.pdf) — ยังต้องกดเปิดได้ ไม่ใช่ขึ้นว่าไม่มีไฟล์
    return (
      <a
        href={print.designImageUrl}
        target="_blank"
        rel="noreferrer"
        className={cn("inline-flex min-h-11 items-center rounded-lg text-xs text-blue-600 hover:underline dark:text-blue-400", FOCUS_BUTTON)}
      >
        เปิดไฟล์แบบ
      </a>
    );
  }
  // ไม่มีไฟล์ = ช่องว่างเส้นประ (เหมือนปุ่ม "เพิ่มไฟล์ลาย" ในฟอร์ม แต่กดไม่ได้) — งานเดินต่อไม่ได้จนกว่าจะมีไฟล์
  return (
    <div
      title="ยังไม่มีไฟล์แบบ"
      className={cn(RADIUS.item, size, "flex items-center justify-center border border-dashed border-border text-muted")}
    >
      <ImageIcon className="h-4 w-4" />
    </div>
  );
}

function PrintsTable({ prints, showMoney }: { prints: OrderItemPrint[]; showMoney: boolean }) {
  return (
    <table className="w-full table-fixed">
      <ItemTableCols />
      <thead className={TABLE_HEAD_SURFACE}>
        <tr>
          <th className={cn(TH, "text-center")}>ลาย</th>
          <th className={cn(TH, "text-left")}>วิธีพิมพ์</th>
          <th className={cn(TH, "text-center")}>ขนาด</th>
          <th className={cn(TH, "text-center")}>กว้าง × สูง</th>
          <th className={cn(TH, "text-center")}>ตำแหน่ง</th>
          <th className={cn(TH, "text-center")}>จำนวนสี</th>
          <th className={cn(TH, "text-center")}>{showMoney ? "ค่าสกรีน" : ""}</th>
        </tr>
      </thead>
      <tbody>
        {prints.map((p) => (
          <tr key={p.id}>
            <td className="py-2 pr-1 text-center align-middle">
              <div className="flex justify-center">
                <PrintThumb print={p} />
              </div>
            </td>
            <td className={cn(TD, "font-medium text-strong")}>
              {PRINT_TYPES[p.printType] ?? p.printType}
              {p.designNote && (
                <p className="mt-0.5 text-xs font-normal text-muted [overflow-wrap:anywhere]">{p.designNote}</p>
              )}
            </td>
            <td className={cn(TD, "text-center text-secondary")}>{printSizeLabel(p)}</td>
            <td className={cn(TD, NUM, "text-center text-secondary")}>{printDims(p)}</td>
            <td className={cn(TD, "text-center text-secondary")}>{PRINT_POSITIONS[p.position] ?? p.position}</td>
            <td className={cn(TD, NUM, "text-center text-secondary")}>{p.colorCount ?? <Dash />}</td>
            <td className={cn(TD, NUM, "text-center font-semibold text-strong")}>
              {showMoney ? formatCurrency(p.unitPrice ?? 0) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintCardNarrow({ print, showMoney }: { print: OrderItemPrint; showMoney: boolean }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border p-3">
      <PrintThumb print={print} size="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-strong">
            {PRINT_TYPES[print.printType] ?? print.printType} · {PRINT_POSITIONS[print.position] ?? print.position}
          </p>
          {showMoney && (
            <p className={cn(NUM, "text-sm font-semibold text-strong")}>{formatCurrency(print.unitPrice ?? 0)}</p>
          )}
        </div>
        <FactList columns={3} className="mt-2">
          <Fact size="sm" label="ขนาด" value={printSizeLabel(print)} />
          <Fact size="sm" label="กว้าง × สูง" value={printDims(print)} />
          {print.colorCount != null && <Fact size="sm" label="จำนวนสี" value={print.colorCount} />}
        </FactList>
        {print.designNote && <p className="mt-2 text-xs text-muted [overflow-wrap:anywhere]">{print.designNote}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- สินค้า */

function StockIdentity({ prod }: { prod: OrderItemProduct }) {
  const name = prod.product?.name || prod.description || "สินค้า";
  const v = prod.variants?.[0];
  const variantLabel = prod.variants?.length === 1 ? [v?.color, v?.size].filter(Boolean).join(" ") : "";
  return (
    <div className="flex items-center gap-2">
      {prod.product?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={prod.product.imageUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg border border-border object-cover" />
      ) : (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted">
          <ImageIcon className="h-4 w-4 text-muted" />
        </div>
      )}
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium text-strong">{name}</span>
        {variantLabel && <span className="block text-xs text-muted">{variantLabel}</span>}
        {prod.product?.sku && <span className="block font-mono text-xs text-secondary">{prod.product.sku}</span>}
      </div>
    </div>
  );
}

function StockRow({ prod, showMoney }: { prod: OrderItemProduct; showMoney: boolean }) {
  const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
  const qty = productQty(prod);
  return (
    <tr>
      <td className="py-2 pl-1 pr-3 align-middle">
        {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
      </td>
      <td className="py-2 pr-2 align-middle"><StockIdentity prod={prod} /></td>
      <td className={cn(TD, "text-center text-secondary")}>{prod.packagingOption?.name ?? <Dash />}</td>
      <td className={cn(TD, NUM, "text-center text-secondary")}>{showMoney ? formatCurrency(prod.baseUnitPrice ?? 0) : null}</td>
      <td className={cn(TD, NUM, "text-center text-secondary")}>
        {showMoney ? ((prod.discount ?? 0) > 0 ? formatCurrency(prod.discount ?? 0) : <Dash />) : null}
      </td>
      <td className={cn(TD, NUM, "text-center font-medium text-secondary")}>{qty}</td>
      <td className={cn(TD, NUM, "text-center font-semibold text-strong")}>
        {showMoney ? formatCurrency(qty * netUnitPrice(prod)) : null}
      </td>
    </tr>
  );
}

function StockCardNarrow({ prod, showMoney }: { prod: OrderItemProduct; showMoney: boolean }) {
  const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
  const qty = productQty(prod);
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
      <StockIdentity prod={prod} />
      <FactList columns={showMoney ? 4 : 2}>
        <Fact size="sm" label="แพค" value={prod.packagingOption?.name ?? "—"} />
        {showMoney && <Fact size="sm" label="ราคา" value={formatCurrency(prod.baseUnitPrice ?? 0)} />}
        {showMoney && (prod.discount ?? 0) > 0 && <Fact size="sm" label="ส่วนลด" value={formatCurrency(prod.discount ?? 0)} />}
        <Fact size="sm" label="จำนวน" value={qty} />
        {showMoney && <Fact size="sm" label="รวม" value={formatCurrency(qty * netUnitPrice(prod))} />}
      </FactList>
    </div>
  );
}

/** ตารางไซส์อ่านอย่างเดียว — ไซส์บน จำนวนล่าง เหมือน SizeMatrix ของฟอร์ม */
function SizeGrid({ prod, title }: { prod: OrderItemProduct; title: string }) {
  const color = prod.variants?.find((v) => v.color)?.color;
  const total = productQty(prod);
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-strong">{title}</h4>
      {color && (
        <p className="mb-2 text-xs text-secondary">
          สี (ใช้ทุกไซส์): <span className="font-medium text-strong">{color}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(prod.variants ?? []).map((v) => (
          <div key={v.id} className={cn(RADIUS.item, "w-14 border border-border py-1.5 text-center")}>
            <p className="text-xs font-medium text-muted">{v.size || "—"}</p>
            <p className={cn(NUM, "text-base font-semibold text-strong")}>{v.quantity}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-secondary">
        รวม <span className="font-semibold text-strong">{total}</span> ตัว
      </p>
    </div>
  );
}

/** สินค้าที่ไม่ใช่สต๊อก — กล่องจมแบบ ProductAdaptiveCard แต่อ่านอย่างเดียว */
function AdaptiveProductCard({
  prod,
  prodIdx,
  total,
  showMoney,
  orderId,
  canEditReceiveTracking,
}: {
  prod: OrderItemProduct;
  prodIdx: number;
  total: number;
  showMoney: boolean;
  orderId: string;
  canEditReceiveTracking: boolean;
}) {
  const utils = trpc.useUtils();
  const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
  const isCustomerProvided = prod.itemSource === "CUSTOMER_PROVIDED";
  const isCustomMade = prod.itemSource === "CUSTOM_MADE";
  const qty = productQty(prod);

  return (
    <div className={cn(SUNK_PANEL, RADIUS.inner, "p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-strong">
          สินค้า {prodIdx + 1}/{total}
        </h4>
        {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
        {prod.productType && <Badge variant="secondary" size="sm">{PRODUCT_TYPES[prod.productType] ?? prod.productType}</Badge>}
      </div>

      <div className="mt-3 space-y-4">
        <FactList columns={2}>
          <Fact label="ชื่อสินค้า" value={prod.description || prod.product?.name || "—"} />
          <Fact label="แพค" value={prod.packagingOption?.name ?? "—"} />
        </FactList>

        {isCustomerProvided ? (
          <>
            <p className="text-xs text-secondary">ตัวเสื้อเป็นของลูกค้า จึงไม่คิดราคาตัวเสื้อ</p>
            <div className="border-t border-divider pt-4">
              <SizeGrid prod={prod} title="จำนวนที่ลูกค้าส่งมา" />
            </div>
            {/* หลักฐานรับเสื้อ — ฟอร์มตัวเดิม (Production V2 ให้จุดเตรียมงานเป็นเจ้าของ หน้านี้อ่านอย่างเดียว) */}
            <ReceiveTrackingInline
              product={{ id: prod.id, garmentCondition: prod.garmentCondition, receivedInspected: prod.receivedInspected, receiveNote: prod.receiveNote }}
              onSuccess={() => utils.order.getById.invalidate({ id: orderId })}
              readOnly={!canEditReceiveTracking}
            />
          </>
        ) : (
          <>
            {showMoney && (
              <FactList columns={3}>
                <Fact label="ราคา/ชิ้น" value={formatCurrency(prod.baseUnitPrice ?? 0)} />
                <Fact label="ส่วนลด/ชิ้น" value={(prod.discount ?? 0) > 0 ? formatCurrency(prod.discount ?? 0) : "—"} />
                <Fact label="รวมตัวเสื้อ" value={formatCurrency(qty * netUnitPrice(prod))} />
              </FactList>
            )}
            <div className={cn("grid items-start gap-5 border-t border-divider pt-4", isCustomMade && "lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]")}>
              {isCustomMade && (
                <FactList columns={3}>
                  {prod.fabricType && <Fact size="sm" label="ชนิดผ้า" value={FABRIC_TYPES[prod.fabricType] ?? prod.fabricType} />}
                  {prod.material && <Fact size="sm" label="ส่วนผสมผ้า" value={prod.material} />}
                  {prod.fabricWeight && <Fact size="sm" label="น้ำหนักผ้า" value={prod.fabricWeight} />}
                  {prod.fabricColor && <Fact size="sm" label="สีผ้า" value={prod.fabricColor} />}
                  {prod.collarType && <Fact size="sm" label="ทรงคอ" value={COLLAR_TYPES[prod.collarType] ?? prod.collarType} />}
                  {prod.sleeveType && <Fact size="sm" label="แขน" value={SLEEVE_TYPES[prod.sleeveType] ?? prod.sleeveType} />}
                  {prod.bodyFit && <Fact size="sm" label="ทรงตัว" value={BODY_FITS[prod.bodyFit] ?? prod.bodyFit} />}
                  {prod.patternNote && <Fact size="sm" label="หมายเหตุแพทเทิร์น" value={prod.patternNote} className="col-span-full" />}
                </FactList>
              )}
              <div className={cn("min-w-0", isCustomMade && "lg:border-l lg:border-divider lg:pl-5")}>
                <SizeGrid prod={prod} title="ไซส์และจำนวน" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ ส่วนเสริม */

function AddonsTable({ addons, showMoney }: { addons: OrderItemAddon[]; showMoney: boolean }) {
  return (
    <table className="w-full table-fixed">
      <ItemTableCols />
      <thead className={TABLE_HEAD_SURFACE}>
        <tr>
          <th colSpan={2} className={cn(TH, "text-left")}>ชื่อ</th>
          <th colSpan={2} className={cn(TH, "text-left")}>ประเภท</th>
          <th colSpan={2} className={cn(TH, "text-center")}>คิดราคา</th>
          <th className={cn(TH, "text-center")}>{showMoney ? "ราคา" : ""}</th>
        </tr>
      </thead>
      <tbody>
        {addons.map((a) => (
          <tr key={a.id}>
            <td colSpan={2} className={cn(TD, "font-medium text-strong [overflow-wrap:anywhere]")}>{a.name || "—"}</td>
            <td colSpan={2} className={cn(TD, "text-secondary")}>{a.addonType || <Dash />}</td>
            <td colSpan={2} className={cn(TD, "text-center")}>
              <Badge variant={a.pricingType === "PER_PIECE" ? "default" : "secondary"} size="sm">
                {PRICING_TYPE_LABELS[a.pricingType as PricingType] ?? a.pricingType}
              </Badge>
            </td>
            <td className={cn(TD, NUM, "text-center font-semibold text-strong")}>
              {showMoney ? formatCurrency(a.unitPrice ?? 0) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AddonCardNarrow({ addon, showMoney }: { addon: OrderItemAddon; showMoney: boolean }) {
  return (
    <div className={cn("rounded-lg p-3", SUNK_PANEL)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">{addon.name || "—"}</p>
        {showMoney && <p className={cn(NUM, "text-sm font-semibold text-strong")}>{formatCurrency(addon.unitPrice ?? 0)}</p>}
      </div>
      <FactList columns={2} className="mt-2">
        <Fact size="sm" label="ประเภท" value={addon.addonType || "—"} />
        <Fact size="sm" label="คิดราคา" value={PRICING_TYPE_LABELS[addon.pricingType as PricingType] ?? addon.pricingType} />
      </FactList>
    </div>
  );
}

/* ------------------------------------------------------------ สรุปราคา */

/** ทุกบรรทัดบวกกันแล้วต้องเท่า item.subtotal ที่ server คิดมา */
function ItemPriceSummary({ item }: { item: OrderItem }) {
  const lines = itemPriceLines(item);
  const totalQty = itemQty(item);
  if (lines.length === 0) return null;
  return (
    <div className="border-t border-border/70 pt-3">
      <p className={cn(GROUP_HEADING, "mb-2")}>สรุปราคารายการ</p>
      <table className="w-full text-xs">
        <tbody className="text-secondary">
          {lines.map((line) => {
            const { label, detail } = priceLineText(item, line);
            return (
              <tr key={`${line.kind}-${line.index}`}>
                <td className="py-1 [overflow-wrap:anywhere]">
                  <span className="text-secondary">{label}</span>
                  {detail && <span className="ml-1 text-muted">({detail})</span>}
                </td>
                <td className={cn("px-2 py-1 text-right text-muted", NUM)}>{formatCurrency(line.unitPrice)}</td>
                <td className={cn("px-2 py-1 text-right text-muted", NUM)}>×{line.quantity}</td>
                <td className={cn("py-1 text-right", NUM)}>{formatCurrency(line.total)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/70">
            <td colSpan={2} className="pt-2 text-sm font-semibold text-strong">รวมทั้งหมด</td>
            <td className={cn("px-2 pt-2 text-right text-muted", NUM)}>{totalQty} ตัว</td>
            <td className={cn("pt-2 text-right text-sm font-semibold text-strong", NUM)}>{formatCurrency(item.subtotal ?? 0)}</td>
          </tr>
          {totalQty > 0 && (
            <tr>
              <td colSpan={3} className="text-muted">
                เฉลี่ย {formatCurrency(Math.round(((item.subtotal ?? 0) / totalQty) * 100) / 100)} / ตัว
              </td>
              <td aria-hidden="true" />
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- การ์ดชุดงาน */

function ItemCard({
  item,
  itemIdx,
  showMoney,
  orderId,
  canEditReceiveTracking,
}: {
  item: OrderItem;
  itemIdx: number;
  showMoney: boolean;
  orderId: string;
  canEditReceiveTracking: boolean;
}) {
  const totalQty = itemQty(item);
  const products = item.products ?? [];
  const prints = item.prints ?? [];
  const addons = item.addons ?? [];
  // สินค้าจากสต็อกล้วนคงตารางที่เบสเคาะไว้ · มีตัดเย็บ/ลูกค้าส่งมา = กล่องจม (เหมือนฟอร์ม)
  const usesAdaptive = products.some((p) => p.itemSource !== "FROM_STOCK");

  return (
    <article className={cn("card-surface p-4 sm:p-5", RADIUS.surface)}>
      {/* หัวการ์ด — ลอกจาก OrderItemRow ของฟอร์ม · ชื่อชุดงานขึ้นแทน "รายการที่ N" เมื่อมี */}
      <div className="flex min-h-11 items-center gap-2">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {itemIdx + 1}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-strong">
          {item.description ? item.description : `รายการที่ ${itemIdx + 1}`}
        </h3>
        {totalQty > 0 && <span className={cn("flex-shrink-0 text-xs text-muted", NUM)}>{totalQty} ตัว</span>}
        {showMoney && (item.subtotal ?? 0) > 0 && (
          <span className={cn("flex-shrink-0 text-sm font-semibold text-strong", NUM)}>{formatCurrency(item.subtotal ?? 0)}</span>
        )}
      </div>

      <div className="space-y-5 pt-4">
        {/* ลาย — ก่อนเสื้อ ตามฟอร์ม (มติ 2026-08-14) */}
        {prints.length > 0 && (
          <div className="@container">
            <p className={cn(GROUP_HEADING, "mb-2")}>ลายและงานพิมพ์</p>
            <div className="hidden overflow-hidden @2xl:block"><PrintsTable prints={prints} showMoney={showMoney} /></div>
            <div className="space-y-3 @2xl:hidden">
              {prints.map((p) => <PrintCardNarrow key={p.id} print={p} showMoney={showMoney} />)}
            </div>
          </div>
        )}

        {/* เสื้อ */}
        {products.length > 0 && (
          <div className="@container">
            <p className={cn(GROUP_HEADING, "mb-2")}>สินค้าในชุดงาน</p>
            {usesAdaptive ? (
              <div className="space-y-3">
                {products.map((prod, i) => (
                  <AdaptiveProductCard
                    key={prod.id}
                    prod={prod}
                    prodIdx={i}
                    total={products.length}
                    showMoney={showMoney}
                    orderId={orderId}
                    canEditReceiveTracking={canEditReceiveTracking}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="hidden overflow-hidden @2xl:block">
                  <table className="w-full table-fixed">
                    <ItemTableCols />
                    <thead className={TABLE_HEAD_SURFACE}>
                      <tr>
                        <th className={cn(TH, "text-left")}>แหล่ง</th>
                        <th className={cn(TH, "text-left")}>สินค้า</th>
                        <th className={cn(TH, "text-center")}>แพค</th>
                        <th className={cn(TH, "text-center")}>{showMoney ? "ราคา" : ""}</th>
                        <th className={cn(TH, "text-center")}>{showMoney ? "ส่วนลด" : ""}</th>
                        <th className={cn(TH, "text-center")}>จำนวน</th>
                        <th className={cn(TH, "text-center")}>{showMoney ? "รวม" : ""}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((prod) => <StockRow key={prod.id} prod={prod} showMoney={showMoney} />)}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 @2xl:hidden">
                  {products.map((prod) => <StockCardNarrow key={prod.id} prod={prod} showMoney={showMoney} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ส่วนเสริม */}
        {addons.length > 0 && (
          <div className="@container">
            <p className={cn(GROUP_HEADING, "mb-2")}>ส่วนเสริมในชุดงาน</p>
            <div className="hidden overflow-hidden @2xl:block"><AddonsTable addons={addons} showMoney={showMoney} /></div>
            <div className="space-y-3 @2xl:hidden">
              {addons.map((a) => <AddonCardNarrow key={a.id} addon={a} showMoney={showMoney} />)}
            </div>
          </div>
        )}

        {item.notes && <Fact label="หมายเหตุการผลิตชุดนี้" value={item.notes} />}

        {showMoney && <ItemPriceSummary item={item} />}
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- ส่งออก */

export function OrderItemsDisplay({
  orderId,
  items,
  fees,
  onEditItems,
  showMoney = true,
  canEditReceiveTracking = false,
}: OrderItemsDisplayProps) {
  const isEmpty = !items || items.length === 0;
  const isSingleItem = (items?.length ?? 0) === 1;
  const orderTotalQty = sumOrderQuantity(items);
  const singleSubtotal = isSingleItem ? items[0]?.subtotal ?? null : null;

  // หัว "รายการสินค้า" + ชิป + ปุ่มแก้ไข — ข้อความชุดเดิม แต่ยืนเป็นแถวเหนือการ์ดชุดงาน
  // (ไม่มีการ์ดใหญ่ครอบซ้ำ — เบสสั่งเอาการ์ดซ้อนการ์ดออกจากฟอร์มไปแล้ว 2026-08-14)
  const heading = (
    <div className="flex items-center justify-between gap-3">
      <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        <ToneMark icon={Package} tone="product" />
        <span className="[overflow-wrap:anywhere]">
          รายการสินค้า
          {!isSingleItem && !isEmpty ? ` (${items.length})` : ""}
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
      {onEditItems && !isEmpty && (
        <Button variant="outline" size="sm" onClick={onEditItems} className="flex-shrink-0 gap-1.5">
          <Edit3 />
          แก้ไข
        </Button>
      )}
    </div>
  );

  return (
    <>
      {isEmpty ? (
        <Card>
          <CardHeader>{heading}</CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted">
                ยังไม่มีรายการสินค้า/ราคา — ใส่ก่อนถึงจะยืนยันออเดอร์ได้
              </p>
              {onEditItems && (
                <Button onClick={onEditItems} className="gap-1.5">
                  <PlusCircle />
                  ใส่รายการสินค้า
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <section aria-label="รายการสินค้า" className="space-y-4">
          {heading}
          {items.map((item, itemIdx) => (
            <ItemCard
              key={item.id}
              item={item}
              itemIdx={itemIdx}
              showMoney={showMoney}
              orderId={orderId}
              canEditReceiveTracking={canEditReceiveTracking}
            />
          ))}
        </section>
      )}

      {/* FEES SECTION */}
      {fees && fees.length > 0 && (
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
                      {fee.feeType && (
                        <Badge variant="secondary">{fee.feeType}</Badge>
                      )}
                      <span className="text-sm text-secondary">
                        {fee.name || fee.feeType || "ค่าธรรมเนียม"}
                      </span>
                    </div>
                    {showMoney && (
                      <span className="tabular-nums text-sm font-medium text-strong">
                        {formatCurrency(fee.amount ?? 0)}
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
