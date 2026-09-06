"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Section, SectionTitle, ToneMark } from "@/components/ui/section";
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
import { sumOrderQuantity } from "@/lib/pricing";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { Package, Receipt, PlusCircle, Edit3, Check, ImageIcon, Calculator } from "lucide-react";
import { DISPLAY_AMOUNT, FOCUS_BUTTON, RADIUS, SUNK_PANEL, TABLE_HEAD_SURFACE, TINT } from "@/components/ui/tokens";
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
//   · ลำดับหมวดตามฟอร์ม (มติ 2026-08-14): ลาย → เสื้อ → ส่วนเสริม → หมายเหตุ
//   · จอกว้าง (xl) วาง 2 คอลัมน์: การ์ดชุดงานซ้าย · "สรุปราคา" ทั้งใบก้อนเดียวขวา (sticky)
//     — เบสสั่ง 2026-09-06 "ปรับเป็น 2 คอลัมน์ สรุปต่อรายการไม่ต้องมี สรุปทีเดียวด้านขวาเลย"
//     ค่าธรรมเนียมจึงเป็นบรรทัดในสรุปเดียวกัน (การ์ดค่าธรรมเนียมแยกเหลือเฉพาะ role ที่ไม่เห็นเงิน)
//   · **เสื้อแถวละตัว (เบสสั่ง 2026-09-06 ค่ำ จากรูประบบเก่า)**: หนึ่งสี/ไซส์ = หนึ่งแถว
//     ลายของชุดงานแปะทุกแถว (ฟอร์มกรอกครั้งเดียว) · ค่าสกรีน/ตัว = รวมทุกลาย · รวม = จำนวน × (เสื้อ + สกรีน)
//     ส่วนเสริมยังเป็นตารางเล็กใต้ตารางเสื้อ (คอลัมน์ชุดเดียวกับฟอร์ม `ItemTableCols`)
//   · เสื้อตัดเย็บ/ลูกค้าส่งมา = กล่องจมสเปก + ฟอร์มตรวจรับ เหนือตาราง (ไซส์/จำนวนอยู่ในแถวแล้ว)
//   · จอแคบ (< @3xl ของกล่อง) สลับเป็นการ์ดต่อตัว
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
  // ยอดท้ายบิลจาก order (ส่วนลด/VAT/ยอดรวม) — ไม่ส่ง = คิดจากรายการ+ค่าธรรมเนียมตรงๆ (หน้าลอง)
  totals?: OrderTotals;
}

interface OrderTotals {
  discount: number;
  taxRate: number;
  taxAmount: number | null;
  totalAmount: number;
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

/** ช่อง "ลาย" ของแถว — ลายทุกจุดของชุดงานซ้อนกัน (หน้า/หลัง) ไม่คิดรวมกันเป็นคำเดียว */
function PrintCell({ prints, thumb = "h-10 w-10" }: { prints: OrderItemPrint[]; thumb?: string }) {
  if (prints.length === 0) return <Dash />;
  return (
    <div className="space-y-2">
      {prints.map((p) => {
        const dims = printDims(p);
        return (
          <div key={p.id} className="flex items-center gap-2">
            <PrintThumb print={p} size={thumb} />
            <div className="min-w-0 text-xs leading-5">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="font-medium text-strong">{PRINT_TYPES[p.printType] ?? p.printType}</span>
                <InfoChip size="sm">{PRINT_POSITIONS[p.position] ?? p.position}</InfoChip>
              </p>
              <p className="text-secondary">
                <span>{printSizeLabel(p)}</span>
                {dims !== "—" && <span className={cn("ml-1.5", NUM)}>({dims} ซม.)</span>}
                {p.colorCount != null && <span className={cn("ml-1.5", NUM)}>{p.colorCount} สี</span>}
              </p>
              {p.designNote && <p className="text-muted [overflow-wrap:anywhere]">{p.designNote}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ แถวละตัว */

/**
 * หนึ่งแถว = เสื้อหนึ่งสี/ไซส์ของชุดงาน (เบสสั่ง 2026-09-06 จากรูประบบเก่า "แยกออกมารายชิ้นเลย
 * เพราะสกรีนเรากรอกครั้งเดียว แต่เสื้อมีหลายไซส์") — ฟอร์มยังกรอกลายครั้งเดียว + ไซส์เป็นตาราง
 * ตอนแสดงเอาลายของชุดงานมาแปะทุกแถวให้เอง · ค่าสกรีน/ตัว = รวมทุกลาย · รวม = จำนวน × (เสื้อสุทธิ + สกรีน)
 * ผลรวมทุกแถว + ส่วนเสริม = item.subtotal ที่ server คิด (ไม่มีสูตรใหม่)
 */
interface PieceRow {
  key: string;
  prod: OrderItemProduct;
  color: string | null;
  size: string | null;
  qty: number;
}

function itemPieceRows(item: OrderItem): PieceRow[] {
  return (item.products ?? []).flatMap((prod) => {
    const variants = prod.variants ?? [];
    // สินค้าที่ยังไม่มีไซส์ = แถวเดียวจำนวน 0 (ให้เห็นว่ามีสินค้าแต่ยังไม่ได้ใส่จำนวน)
    if (variants.length === 0) return [{ key: prod.id, prod, color: null, size: null, qty: 0 }];
    return variants.map((v) => ({ key: v.id, prod, color: v.color ?? null, size: v.size || null, qty: v.quantity }));
  });
}

function printPerPiece(item: OrderItem): number {
  return (item.prints ?? []).reduce((s, p) => s + (p.unitPrice ?? 0), 0);
}

function pieceTotal(row: PieceRow, printCost: number): number {
  return row.qty * (netUnitPrice(row.prod) + printCost);
}

function PieceIdentity({ row }: { row: PieceRow }) {
  const { prod } = row;
  const name = prod.product?.name || prod.description || "สินค้า";
  const variantLabel = [row.color, row.size].filter(Boolean).join(" ");
  const source = prod.itemSource && prod.itemSource !== "FROM_STOCK" ? getProductSourcePresentation(prod.itemSource) : null;
  return (
    <div className="flex items-center gap-2">
      {prod.product?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={prod.product.imageUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg border border-border object-cover" />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted">
          <ImageIcon className="h-4 w-4 text-muted" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">
          {name}
          {variantLabel && <span className="ml-1.5 font-semibold text-strong">{variantLabel}</span>}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {prod.product?.sku && <span className="font-mono text-secondary">{prod.product.sku}</span>}
          {prod.packagingOption?.name && (
            <span className="text-secondary">
              <span className="text-muted">แพค</span> {prod.packagingOption.name}
            </span>
          )}
          {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
        </p>
      </div>
    </div>
  );
}

/** ราคาเสื้อ/ตัว — สุทธิหลังหักส่วนลด · มีส่วนลดจึงบอกบรรทัดเล็ก */
function PiecePrice({ prod }: { prod: OrderItemProduct }) {
  const discount = prod.discount ?? 0;
  return (
    <>
      <span>{formatCurrency(netUnitPrice(prod))}</span>
      {discount > 0 && <span className="block text-xs text-muted">ลด {formatCurrency(discount)}</span>}
    </>
  );
}

const PIECE_TH = "px-2 py-2.5 text-xs font-medium";

/** ตารางแถวละตัว (จอกว้างของกล่อง) — ช่องเงิน 3 ช่องหายทั้งช่องเมื่อไม่เห็นเงิน ไม่ใช่ว่างเปล่า */
function PieceTable({
  rows,
  prints,
  startIndex,
  showMoney,
}: {
  rows: PieceRow[];
  prints: OrderItemPrint[];
  startIndex: number;
  showMoney: boolean;
}) {
  const printCost = showMoney ? printPerPiece({ prints } as OrderItem) : 0;
  return (
    <table className="w-full table-fixed">
      <colgroup>
        <col style={{ width: 40 }} />
        <col />
        <col style={{ width: 236 }} />
        <col style={{ width: 60 }} />
        {showMoney && <col style={{ width: 88 }} />}
        {showMoney && <col style={{ width: 88 }} />}
        {showMoney && <col style={{ width: 96 }} />}
      </colgroup>
      <thead className={TABLE_HEAD_SURFACE}>
        <tr>
          <th className={cn(PIECE_TH, "text-center")}>#</th>
          <th className={cn(PIECE_TH, "text-left")}>สินค้า</th>
          <th className={cn(PIECE_TH, "text-left")}>ลาย</th>
          <th className={cn(PIECE_TH, "text-center")}>จำนวน</th>
          {showMoney && <th className={cn(PIECE_TH, "text-right")}>ราคาเสื้อ</th>}
          {showMoney && <th className={cn(PIECE_TH, "text-right")}>ค่าสกรีน</th>}
          {showMoney && <th className={cn(PIECE_TH, "text-right")}>รวม</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-divider">
        {rows.map((row, i) => (
          <tr key={row.key} className="align-top">
            <td className={cn(TD, NUM, "pt-3 text-center text-muted")}>{startIndex + i + 1}</td>
            <td className={cn(TD, "pt-3")}><PieceIdentity row={row} /></td>
            <td className={cn(TD, "pt-3")}><PrintCell prints={prints} /></td>
            <td className={cn(TD, NUM, "pt-3 text-center font-medium text-strong")}>{row.qty}</td>
            {showMoney && <td className={cn(TD, NUM, "pt-3 text-right text-secondary")}><PiecePrice prod={row.prod} /></td>}
            {showMoney && <td className={cn(TD, NUM, "pt-3 text-right text-secondary")}>{prints.length > 0 ? formatCurrency(printCost) : <Dash />}</td>}
            {showMoney && <td className={cn(TD, NUM, "pt-3 text-right font-semibold text-strong")}>{formatCurrency(pieceTotal(row, printCost))}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** แถวละตัวบนจอแคบ — การ์ดต่อตัว ข้อมูลชุดเดียวกับตาราง */
function PieceCardNarrow({
  row,
  prints,
  index,
  showMoney,
}: {
  row: PieceRow;
  prints: OrderItemPrint[];
  index: number;
  showMoney: boolean;
}) {
  const printCost = printPerPiece({ prints } as OrderItem);
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className={cn("mt-2 w-5 flex-shrink-0 text-xs text-muted", NUM)}>{index}</span>
          <PieceIdentity row={row} />
        </div>
        {showMoney && (
          <p className={cn("flex-shrink-0 text-sm font-semibold text-strong", NUM)}>{formatCurrency(pieceTotal(row, printCost))}</p>
        )}
      </div>
      {prints.length > 0 && <PrintCell prints={prints} thumb="h-12 w-12" />}
      <FactList columns={showMoney ? 3 : 1}>
        <Fact size="sm" label="จำนวน" value={row.qty} />
        {showMoney && <Fact size="sm" label="ราคาเสื้อ" value={<PiecePrice prod={row.prod} />} />}
        {showMoney && <Fact size="sm" label="ค่าสกรีน/ตัว" value={prints.length > 0 ? formatCurrency(printCost) : "—"} />}
      </FactList>
    </div>
  );
}

/* ------------------------------------------------- สเปกเสื้อที่ไม่ใช่สต๊อก */

/** เสื้อตัดเย็บ/ลูกค้าส่งมา — สเปกกับหลักฐานรับเสื้ออยู่กล่องจมเหนือตาราง (ไซส์/จำนวน/ราคาอยู่ในแถวแล้ว) */
function ProductSpecBox({
  prod,
  orderId,
  canEditReceiveTracking,
}: {
  prod: OrderItemProduct;
  orderId: string;
  canEditReceiveTracking: boolean;
}) {
  const utils = trpc.useUtils();
  const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
  const isCustomerProvided = prod.itemSource === "CUSTOMER_PROVIDED";
  const isCustomMade = prod.itemSource === "CUSTOM_MADE";
  const specs = isCustomMade
    ? [
        prod.fabricType && <Fact key="fabric" size="sm" label="ชนิดผ้า" value={FABRIC_TYPES[prod.fabricType] ?? prod.fabricType} />,
        prod.material && <Fact key="material" size="sm" label="ส่วนผสมผ้า" value={prod.material} />,
        prod.fabricWeight && <Fact key="weight" size="sm" label="น้ำหนักผ้า" value={prod.fabricWeight} />,
        prod.fabricColor && <Fact key="color" size="sm" label="สีผ้า" value={prod.fabricColor} />,
        prod.collarType && <Fact key="collar" size="sm" label="ทรงคอ" value={COLLAR_TYPES[prod.collarType] ?? prod.collarType} />,
        prod.sleeveType && <Fact key="sleeve" size="sm" label="แขน" value={SLEEVE_TYPES[prod.sleeveType] ?? prod.sleeveType} />,
        prod.bodyFit && <Fact key="fit" size="sm" label="ทรงตัว" value={BODY_FITS[prod.bodyFit] ?? prod.bodyFit} />,
        prod.patternNote && <Fact key="pattern" size="sm" label="หมายเหตุแพทเทิร์น" value={prod.patternNote} className="col-span-full" />,
      ].filter(Boolean)
    : [];
  if (!isCustomerProvided && specs.length === 0) return null;

  return (
    <div className={cn(SUNK_PANEL, RADIUS.inner, "space-y-3 p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-strong">{prod.description || prod.product?.name || "สินค้า"}</h4>
        {source && <Badge variant={source.variant} size="sm">{source.label}</Badge>}
        {prod.productType && <Badge variant="secondary" size="sm">{PRODUCT_TYPES[prod.productType] ?? prod.productType}</Badge>}
      </div>
      {specs.length > 0 && <FactList columns={4}>{specs}</FactList>}
      {isCustomerProvided && (
        <>
          {/* หลักฐานรับเสื้อ — ฟอร์มตัวเดิม (Production V2 ให้จุดเตรียมงานเป็นเจ้าของ หน้านี้อ่านอย่างเดียว) */}
          <ReceiveTrackingInline
            product={{ id: prod.id, garmentCondition: prod.garmentCondition, receivedInspected: prod.receivedInspected, receiveNote: prod.receiveNote }}
            onSuccess={() => utils.order.getById.invalidate({ id: orderId })}
            readOnly={!canEditReceiveTracking}
          />
        </>
      )}
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
          <th colSpan={4} className={cn(TH, "text-left")}>ส่วนเสริม</th>
          <th colSpan={2} className={cn(TH, "text-center")}>คิดราคา</th>
          <th className={cn(TH, "text-center")}>{showMoney ? "ราคา" : ""}</th>
        </tr>
      </thead>
      <tbody>
        {addons.map((a) => (
          <tr key={a.id}>
            <td colSpan={4} className={cn(TD, "font-medium text-strong [overflow-wrap:anywhere]")}>{a.name || "—"}</td>
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
        <Fact size="sm" label="คิดราคา" value={PRICING_TYPE_LABELS[addon.pricingType as PricingType] ?? addon.pricingType} />
      </FactList>
    </div>
  );
}

/* ------------------------------------------------------- สรุปราคา (ทั้งใบ) */

function SummaryRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("text-right text-secondary", NUM)}>{value}</span>
    </div>
  );
}

/**
 * ยอดของออเดอร์ทั้งใบในก้อนเดียว (คอลัมน์ขวาบนจอกว้าง · ท้ายรายการบนจอแคบ)
 *   · รายการละบรรทัด: ชื่อชุดงาน · จำนวน · item.subtotal ที่ server คิด (ไม่คำนวณใหม่ตรงนี้)
 *   · ท่อนล่างเรียงเหมือน "สรุปยอด" ของฟอร์มและแท็บเงิน (รวมสินค้า → ค่าธรรมเนียม → ส่วนลด → VAT → ยอดรวม)
 *     ให้เลขเดียวกันทุกที่ ไม่คิดสูตรใหม่ตรงนี้
 */
function OrderPriceSummaryPanel({ items, fees, totals }: { items: OrderItem[]; fees: OrderFee[]; totals?: OrderTotals }) {
  const subtotalItems = items.reduce((s, it) => s + (it.subtotal ?? 0), 0);
  const subtotalFees = fees.reduce((s, f) => s + (f.amount ?? 0), 0);
  const discount = totals?.discount ?? 0;
  const taxRate = totals?.taxRate ?? 0;
  const taxAmount = totals?.taxAmount ?? 0;
  const grandTotal = totals?.totalAmount ?? subtotalItems + subtotalFees - discount;
  // ชุดงานเดียว ไม่มีอะไรบวก/หัก → "รวมสินค้า" ซ้ำกับยอดชุดงาน ไม่ต้องมีท่อนกลาง
  const hasBreakdown = items.length > 1 || fees.length > 0 || discount > 0 || taxRate > 0;

  return (
    <Section title={<SectionTitle icon={Calculator} tone="finance">สรุปราคา</SectionTitle>}>
      <div className="space-y-4">
        {/* รายการละบรรทัดเดียว — ราคา × จำนวนของแต่ละชิ้นอยู่ในตารางซ้ายแล้ว
            (เคยใส่บรรทัดย่อยไว้ เบสบอก "อ่านยาก" 2026-09-06 · คอลัมน์ 20rem แคบเกินกว่าจะวาง 3 ช่องตัวเลข) */}
        <div className="space-y-2.5">
          {items.map((item, itemIdx) => {
            const qty = itemQty(item);
            return (
              <div key={item.id} className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm text-secondary">
                  <span className="font-medium text-strong">{item.description || `รายการที่ ${itemIdx + 1}`}</span>
                  {qty > 0 && <span className={cn("ml-1.5 text-xs text-muted", NUM)}>{qty} ตัว</span>}
                </p>
                <p className={cn("flex-shrink-0 text-sm font-semibold text-strong", NUM)}>{formatCurrency(item.subtotal ?? 0)}</p>
              </div>
            );
          })}
        </div>

        {hasBreakdown && (
          <div className="space-y-2 border-t border-divider pt-3">
            <SummaryRow label="รวมสินค้า" value={formatCurrency(subtotalItems)} />
            {fees.map((fee, i) => (
              <SummaryRow key={fee.id ?? i} label={fee.name || fee.feeType || "ค่าธรรมเนียม"} value={formatCurrency(fee.amount ?? 0)} />
            ))}
            {discount > 0 && <SummaryRow label="ส่วนลดท้ายบิล" value={`-${formatCurrency(discount)}`} />}
            {taxRate > 0 && <SummaryRow label={`VAT (${taxRate}%)`} value={formatCurrency(taxAmount)} />}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 border-t border-divider pt-3">
          <span className="text-sm font-medium text-strong">
            ยอดรวมทั้งหมด
            {taxRate > 0 && <span className="ml-1 text-xs font-normal text-muted">(รวม VAT)</span>}
          </span>
          <span className={DISPLAY_AMOUNT}>{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- การ์ดชุดงาน */

function ItemCard({
  item,
  itemIdx,
  startIndex,
  showMoney,
  orderId,
  canEditReceiveTracking,
}: {
  item: OrderItem;
  itemIdx: number;
  /** เลขแถวแรกของชุดงานนี้ (นับต่อกันทั้งใบเหมือนบิล) */
  startIndex: number;
  showMoney: boolean;
  orderId: string;
  canEditReceiveTracking: boolean;
}) {
  const totalQty = itemQty(item);
  const products = item.products ?? [];
  const prints = item.prints ?? [];
  const addons = item.addons ?? [];
  const rows = itemPieceRows(item);

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
        {/* สเปกเสื้อตัดเย็บ/ลูกค้าส่งมา — เฉพาะที่มี (สต๊อกล้วนไม่มีกล่องนี้) */}
        {products.map((prod) => (
          <ProductSpecBox key={prod.id} prod={prod} orderId={orderId} canEditReceiveTracking={canEditReceiveTracking} />
        ))}

        {/* เสื้อแถวละตัว + ลายแปะทุกแถว */}
        {rows.length > 0 ? (
          <div className="@container">
            <div className="hidden overflow-hidden @3xl:block">
              <PieceTable rows={rows} prints={prints} startIndex={startIndex} showMoney={showMoney} />
            </div>
            <div className="space-y-3 @3xl:hidden">
              {rows.map((row, i) => (
                <PieceCardNarrow key={row.key} row={row} prints={prints} index={startIndex + i + 1} showMoney={showMoney} />
              ))}
            </div>
          </div>
        ) : prints.length > 0 ? (
          // มีลายแต่ยังไม่มีเสื้อ — โชว์ลายเดี่ยว ไม่ปล่อยให้ลายหาย
          <PrintCell prints={prints} thumb="h-12 w-12" />
        ) : null}

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
  totals,
}: OrderItemsDisplayProps) {
  const isEmpty = !items || items.length === 0;
  const isSingleItem = (items?.length ?? 0) === 1;
  const orderTotalQty = sumOrderQuantity(items);
  // เลขแถวแรกของแต่ละชุดงาน — แถวนับต่อกันทั้งใบเหมือนบิล (ชุดงาน 2 เริ่มต่อจากแถวสุดท้ายของชุดงาน 1)
  const rowStarts = (items ?? []).reduce<number[]>((acc, item, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + itemPieceRows(items[i - 1]).length);
    return acc;
  }, []);

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
      </CardTitle>
      {onEditItems && !isEmpty && (
        <Button variant="outline" size="sm" onClick={onEditItems} className="flex-shrink-0 gap-1.5">
          <Edit3 />
          แก้ไข
        </Button>
      )}
    </div>
  );

  // การ์ดค่าธรรมเนียมแยก — เหลือเฉพาะ role ที่ไม่เห็นเงิน (เห็นชื่อรายการว่ามีอะไร)
  // role ที่เห็นเงินอ่านค่าธรรมเนียมจากบรรทัดใน "สรุปราคา" ก้อนเดียวแทน ไม่โชว์สองที่
  const feesCard =
    !showMoney && fees && fees.length > 0 ? (
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
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5"
              >
                {fee.feeType && <Badge variant="secondary">{fee.feeType}</Badge>}
                <span className="text-sm text-secondary">{fee.name || fee.feeType || "ค่าธรรมเนียม"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ) : null;

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
          {/* จอกว้าง 2 คอลัมน์ · จอแคบซ้อนกัน สรุปอยู่ท้ายเหมือนใบเสร็จ
              role ที่ไม่เห็นเงิน = คอลัมน์เดียวเต็มหน้า (ไม่มีก้อนสรุปให้วาง) */}
          <div className={cn("grid items-start gap-5", showMoney && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
            <div className="space-y-4">
              {items.map((item, itemIdx) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  itemIdx={itemIdx}
                  startIndex={rowStarts[itemIdx]}
                  showMoney={showMoney}
                  orderId={orderId}
                  canEditReceiveTracking={canEditReceiveTracking}
                />
              ))}
              {feesCard}
            </div>
            {showMoney && (
              <div className="xl:sticky xl:top-14">
                <OrderPriceSummaryPanel items={items} fees={fees ?? []} totals={totals} />
              </div>
            )}
          </div>
        </section>
      )}
      {isEmpty && feesCard}

    </>
  );
}
