"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn, formatCurrency } from "@/lib/utils";
import { calculateFormItemSubtotal, getFormItemTotalQty, calculateTotalQuantity } from "@/lib/pricing";
import {
  Plus,
  Trash2,
  Copy,
  Pencil,
  Check,
} from "lucide-react";
import type { OrderItemForm } from "@/types/order-form";
import {
  PRINT_TYPES,
  PRINT_POSITIONS,
  PRICING_TYPE_LABELS,
  EMPTY_PRODUCT,
  itemHasContent,
} from "@/types/order-form";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PrintTableRow, Field } from "./print-table-row";
import { ProductTableRow } from "./product-table-row";
import { AddProductPopover } from "./add-product-popover";

export const labelClass =
  "mb-1 block text-[12px] text-slate-500 dark:text-slate-400";

const groupLabelClass =
  "text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500";

interface OrderItemCardProps {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  allItems?: OrderItemForm[];
  printCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  addonCatalog?: Array<{ id: string; name: string; type: string; defaultPrice: number; pricingType: string }>;
  onUpdateItem: (idx: number, field: string, value: unknown) => void;
  onRemoveItem: (idx: number) => void;
  onAddPrint: (idx: number) => void;
  onRemovePrint: (itemIdx: number, pIdx: number) => void;
  onUpdatePrint: (itemIdx: number, pIdx: number, field: string, value: unknown) => void;
  onAddAddon: (idx: number) => void;
  onRemoveAddon: (itemIdx: number, aIdx: number) => void;
  onUpdateAddon: (itemIdx: number, aIdx: number, field: string, value: unknown) => void;
  onOpenPicker: () => void;
  onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void;
  showPrints?: boolean;
  showAddons?: boolean;
  // โหมดรายการเดียว: ไม่โชว์หัวแถว "รายการ #1" — เนื้อฟอร์มกางตลอด (redesign 2026-06-11)
  solo?: boolean;
  // โหมดกระชับ (หน้าแก้รายการ): ยุบ คำอธิบาย/ส่วนเสริม/หมายเหตุ เป็น "รายละเอียดเพิ่มเติม" ·
  // ตัดสรุปราคาต่อรายการ (sidebar มีรวมแล้ว) · ย่อหัวข้อ (redesign 2026-06-12)
  compact?: boolean;
}

function getItemLabel(item: OrderItemForm): string {
  if (item.description) return item.description;
  const first = item.products[0];
  if (first?.productName) return first.productName;
  if (first?.description) return first.description;
  return "รายการใหม่";
}

// ============================================================
// COLLAPSED ROW
// ============================================================

function OrderItemRow({
  item, itemIdx, canRemove, isExpanded, onToggleExpand, onRemoveItem,
}: {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemoveItem: (idx: number) => void;
}) {
  const totalQty = getFormItemTotalQty(item);
  const subtotal = calculateFormItemSubtotal(item);
  // รายการยังไม่กรอกอะไร — แสดงเรียบๆ (ไม่โชว์ "—" จำนวน/ราคา ไม่มีปุ่มแก้ซ้ำ) ลดความรก
  const empty = !itemHasContent(item);

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-2.5 transition-colors",
        isExpanded && "border-b border-slate-200/80 dark:border-slate-700/60",
      )}
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {itemIdx + 1}
      </span>

      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm",
          empty
            ? "italic text-slate-400 dark:text-slate-500"
            : "font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
        )}
      >
        {empty ? "รายการใหม่ — ยังไม่ได้กรอก" : getItemLabel(item)}
      </button>

      {!empty && (
        <>
          <span className="w-12 flex-shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {totalQty > 0 ? `${totalQty} ตัว` : "—"}
          </span>
          <span className="w-20 flex-shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
            {subtotal > 0 ? formatCurrency(subtotal) : "—"}
          </span>
        </>
      )}

      <div className="flex flex-shrink-0 items-center gap-1">
        {!empty && (
          <Button type="button" variant="ghost" size="sm" onClick={onToggleExpand} aria-label={isExpanded ? "เสร็จสิ้นแก้ไข" : "แก้ไขรายการ"} className={cn("h-7 w-7 p-0", isExpanded ? "text-blue-600" : "text-slate-400 hover:text-blue-600")}>
            {isExpanded ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
        )}
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemoveItem(itemIdx); }} aria-label="ลบรายการ" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN ORDER ITEM CARD
// ============================================================

export function OrderItemCard({
  item, itemIdx, canRemove, isExpanded, onToggleExpand,
  allItems, printCatalog, addonCatalog,
  onUpdateItem, onRemoveItem,
  onAddPrint, onRemovePrint, onUpdatePrint,
  onAddAddon, onRemoveAddon, onUpdateAddon,
  onOpenPicker, onSetItems,
  showPrints = true, showAddons = true,
  solo = false, compact = false,
}: OrderItemCardProps) {
  const expanded = solo || isExpanded;
  const otherItemsWithPrints = (allItems ?? []).map((it, idx) => ({ it, idx })).filter(({ idx }) => idx !== itemIdx).filter(({ it }) => it.prints.length > 0);

  const copyPrintsFrom = (sourceIdx: number) => {
    const source = allItems?.[sourceIdx];
    if (!source) return;
    onSetItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = { ...copy[itemIdx], prints: source.prints.map((p) => ({ ...p })) };
      return copy;
    });
  };

  const applyPrintFromCatalog = (pIdx: number, catalogId: string) => {
    const catalogItem = printCatalog?.find((c) => c.id === catalogId);
    if (!catalogItem) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const prints = [...copy[itemIdx].prints];
      prints[pIdx] = { ...prints[pIdx], printType: catalogItem.type, unitPrice: catalogItem.defaultPrice };
      copy[itemIdx] = { ...copy[itemIdx], prints };
      return copy;
    });
  };

  const applyAddonFromCatalog = (aIdx: number, catalogId: string) => {
    const catalogItem = addonCatalog?.find((c) => c.id === catalogId);
    if (!catalogItem) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const addons = [...copy[itemIdx].addons];
      addons[aIdx] = { ...addons[aIdx], addonType: catalogItem.type, name: catalogItem.name, pricingType: catalogItem.pricingType as "PER_PIECE" | "PER_ORDER", unitPrice: catalogItem.defaultPrice };
      copy[itemIdx] = { ...copy[itemIdx], addons };
      return copy;
    });
  };

  const addProductWithSource = (source: string) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const newProd = structuredClone(EMPTY_PRODUCT);
      newProd.itemSource = source;
      if (source === "CUSTOMER_PROVIDED") newProd.baseUnitPrice = 0;
      copy[itemIdx] = { ...copy[itemIdx], products: [...copy[itemIdx].products, newProd] };
      return copy;
    });
  };

  const totalQty = getFormItemTotalQty(item);
  const subtotal = calculateFormItemSubtotal(item);

  // ── section: คำอธิบายงาน ──
  const descField = (
    <Field label="คำอธิบายงาน">
      <Input value={item.description} onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)} placeholder="เช่น งานสกรีนทีม ABC, งานพิมพ์เสื้อกิจกรรม..." />
    </Field>
  );

  // ── section: ลาย ──
  const printsSection = (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={groupLabelClass}>{compact ? "ลาย" : "ลายที่ต้องการสั่งผลิต"}</span>
        <div className="flex items-center gap-1">
          {otherItemsWithPrints.length > 0 && (
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) copyPrintsFrom(parseInt(e.target.value));
                }}
                className="h-7 appearance-none rounded-md border-0 bg-transparent pl-6 pr-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <option value="">คัดลอกลาย...</option>
                {otherItemsWithPrints.map(({ it, idx }) => (
                  <option key={idx} value={idx}>
                    #{idx + 1} {it.description.slice(0, 20)} ({it.prints.length} ลาย)
                  </option>
                ))}
              </select>
              <Copy className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => onAddPrint(itemIdx)}>
            <Plus className="h-3.5 w-3.5" />เพิ่มลาย
          </Button>
        </div>
      </div>
      {item.prints.length === 0 ? (
        <p className="py-3 text-center text-xs italic text-slate-400 dark:text-slate-500">ยังไม่มีลายสกรีน — กด &quot;เพิ่มลาย&quot; เพื่อเริ่ม</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10.5px] font-normal text-slate-400 dark:text-slate-500">
                <th className="pb-1.5 pr-1">รูปแบบ</th>
                <th className="pb-1.5 px-1">วิธีพิมพ์</th>
                <th className="pb-1.5 px-1">ขนาด</th>
                <th className="pb-1.5 px-1">ตำแหน่ง</th>
                <th className="w-14 pb-1.5 px-1">สี</th>
                <th className="min-w-[80px] pb-1.5 px-1">ค่าสกรีน</th>
                <th className="w-14 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {item.prints.map((p, pIdx) => (
                <PrintTableRow
                  key={pIdx}
                  print={p}
                  printIdx={pIdx}
                  onUpdate={(field, value) => onUpdatePrint(itemIdx, pIdx, field, value)}
                  onRemove={() => onRemovePrint(itemIdx, pIdx)}
                  printCatalog={printCatalog}
                  onApplyCatalog={(catalogId) => applyPrintFromCatalog(pIdx, catalogId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── section: สินค้า ──
  const productsSection = (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={groupLabelClass}>{compact ? "สินค้า" : "สินค้าที่ต้องการสั่งผลิต"}</span>
        <AddProductPopover
          onAddFromStock={onOpenPicker}
          onAddCustomMade={() => addProductWithSource("CUSTOM_MADE")}
          onAddCustomerProvided={() => addProductWithSource("CUSTOMER_PROVIDED")}
        />
      </div>
      {item.products.length === 0 ? (
        <p className="py-3 text-center text-xs italic text-slate-400 dark:text-slate-500">ยังไม่มีสินค้า — กด &quot;เพิ่มสินค้า&quot; เพื่อเริ่ม</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 80 }} />
              <col />
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 56 }} />
            </colgroup>
            <thead>
              <tr className="text-left text-[10.5px] font-normal text-slate-400 dark:text-slate-500">
                <th className="pb-1.5 pl-1">แหล่ง</th>
                <th className="pb-1.5 pr-2">สินค้า</th>
                <th className="pb-1.5 px-1.5">ราคา (ต่อหน่วย)</th>
                <th className="pb-1.5 px-1.5">จำนวน</th>
                <th className="pb-1.5 px-1.5">ส่วนลด</th>
                <th className="pb-1.5 px-1.5">แพ็คเกจ</th>
                <th className="pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {item.products.map((prod, pIdx) => (
                <ProductTableRow
                  key={pIdx}
                  product={prod}
                  prodIdx={pIdx}
                  itemIdx={itemIdx}
                  totalProducts={item.products.length}
                  onSetItems={onSetItems}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── section: ส่วนเสริม ──
  const addonsSection = (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={groupLabelClass}>ส่วนเสริม (Add-ons)</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onAddAddon(itemIdx)}>
          <Plus className="h-3.5 w-3.5" />เพิ่มส่วนเสริม
        </Button>
      </div>
      {item.addons.length === 0 ? (
        <p className="py-2 text-center text-xs italic text-slate-400 dark:text-slate-500">ไม่มีส่วนเสริม — กด &quot;Add-on&quot; เพื่อเพิ่ม</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10.5px] font-normal text-slate-400 dark:text-slate-500">
                <th className="w-8 pb-1.5" />
                <th className="min-w-[100px] pb-1.5 px-1">ประเภท</th>
                <th className="min-w-[120px] pb-1.5 px-1">ชื่อ</th>
                <th className="min-w-[90px] pb-1.5 px-1">คิดราคา</th>
                <th className="min-w-[80px] pb-1.5 pl-1">ราคา</th>
              </tr>
            </thead>
            <tbody>
              {item.addons.map((a, aIdx) => (
                <tr key={aIdx} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="py-1.5 align-middle"><Button type="button" variant="ghost" size="icon" aria-label="ลบส่วนเสริม" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onRemoveAddon(itemIdx, aIdx)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  <td className="px-1 py-1.5 align-middle">
                    {addonCatalog && addonCatalog.length > 0 ? (
                      <NativeSelect value="" onChange={(e) => { if (e.target.value) applyAddonFromCatalog(aIdx, e.target.value); e.target.value = ""; }} className="h-8 text-xs">
                        <option value="">{a.addonType || "แค็ตตาล็อก..."}</option>
                        {addonCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </NativeSelect>
                    ) : (
                      <Input value={a.addonType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "addonType", e.target.value)} placeholder="LABEL, TAG..." className="h-8 text-xs" />
                    )}
                  </td>
                  <td className="px-1 py-1.5 align-middle"><Input value={a.name} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "name", e.target.value)} placeholder="ชื่อ add-on" className="h-8 text-xs" /></td>
                  <td className="px-1 py-1.5 align-middle"><NativeSelect value={a.pricingType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "pricingType", e.target.value as "PER_PIECE" | "PER_ORDER")} className="h-8 text-xs"><option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option><option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option></NativeSelect></td>
                  <td className="pl-1 py-1.5 align-middle"><Input type="number" min={0} step={0.01} value={a.unitPrice || ""} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8 text-xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── section: หมายเหตุ ──
  const notesField = (
    <div>
      <label className={labelClass}>หมายเหตุรายการ</label>
      <Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder="หมายเหตุเพิ่มเติมสำหรับรายการนี้..." />
    </div>
  );

  // ── section: สรุปราคาต่อรายการ (เฉพาะโหมดปกติ — compact ใช้สรุปรวมที่ sidebar) ──
  const priceSummary = totalQty > 0 ? (
    <div className="border-t border-slate-200/70 pt-3 dark:border-slate-700/60">
      <p className={cn(groupLabelClass, "mb-2")}>สรุปราคารายการ</p>
      <table className="w-full text-xs">
        <tbody className="text-slate-600 dark:text-slate-300">
          {item.products.map((p, i) => {
            const pQty = calculateTotalQuantity(p.variants);
            const net = Math.max(0, p.baseUnitPrice - (p.discount || 0));
            const pTotal = pQty * net;
            if (pQty === 0) return null;
            const label = p.productName || p.description || `สินค้า ${i + 1}`;
            const variant = [p.variants[0]?.color, p.variants[0]?.size].filter(Boolean).join(" ");
            return (
              <tr key={`p-${i}`}>
                <td className="py-1">
                  <span className="text-slate-700 dark:text-slate-200">{label}</span>
                  {variant && <span className="ml-1 text-slate-400">({variant})</span>}
                  {(p.discount || 0) > 0 && <span className="ml-1 text-red-500">-{formatCurrency(p.discount || 0)}</span>}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">{formatCurrency(net)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">×{pQty}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(pTotal)}</td>
              </tr>
            );
          })}
          {item.prints.map((pr, i) => {
            const prTotal = totalQty * pr.unitPrice;
            if (pr.unitPrice === 0) return null;
            const prLabel = PRINT_TYPES[pr.printType] || pr.printType;
            const prPos = PRINT_POSITIONS[pr.position] || pr.position;
            return (
              <tr key={`pr-${i}`}>
                <td className="py-1">
                  <span className="text-slate-700 dark:text-slate-200">{prLabel}</span>
                  <span className="ml-1 text-slate-400">({prPos})</span>
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">{formatCurrency(pr.unitPrice)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">×{totalQty}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(prTotal)}</td>
              </tr>
            );
          })}
          {item.addons.map((a, i) => {
            const aTotal = a.pricingType === "PER_PIECE" ? totalQty * a.unitPrice : a.unitPrice;
            if (a.unitPrice === 0) return null;
            return (
              <tr key={`a-${i}`}>
                <td className="py-1">
                  <span className="text-slate-700 dark:text-slate-200">{a.name || `ส่วนเสริม ${i + 1}`}</span>
                  <span className="ml-1 text-[10px] text-slate-400">({PRICING_TYPE_LABELS[a.pricingType as "PER_PIECE" | "PER_ORDER"] ?? a.pricingType})</span>
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">{formatCurrency(a.unitPrice)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">×{a.pricingType === "PER_PIECE" ? totalQty : "1"}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(aTotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200/70 dark:border-slate-700/60">
            <td colSpan={2} className="pt-2 text-sm font-semibold text-slate-900 dark:text-white">
              รวมทั้งหมด
            </td>
            <td className="px-2 pt-2 text-right text-xs tabular-nums text-slate-400">
              {totalQty} ตัว
            </td>
            <td className="pt-2 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(subtotal)}
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="text-[11px] text-slate-400">
              เฉลี่ย {formatCurrency(Math.round((subtotal / totalQty) * 100) / 100)} / ตัว
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  ) : null;

  // compact: ย่อ คำอธิบาย/ส่วนเสริม/หมายเหตุ ไว้ใน "รายละเอียดเพิ่มเติม" — กางเองถ้ามีของอยู่แล้ว
  const hasSecondary = !!item.description || item.addons.length > 0 || !!item.notes;
  const secondarySummary =
    [
      item.description ? "มีคำอธิบาย" : "",
      item.addons.length > 0 ? `${item.addons.length} ส่วนเสริม` : "",
      item.notes ? "มีหมายเหตุ" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "คำอธิบาย · ส่วนเสริม · หมายเหตุ";

  return (
    <div
      className={cn(
        // compact (หน้าแก้รายการ): ทุกรายการอยู่ในเฟรมเดียว — ไม่ทำกล่องซ้อนกล่อง
        // รายการที่กำลังแก้ = พื้นจางบอกเฉยๆ (ไม่มีขอบ/เงา/margin) ลดชั้นภาพจาก 4 เหลือ 2
        !solo && compact && "px-4",
        !solo && compact && isExpanded && "bg-slate-50/60 dark:bg-slate-800/30",
        // full (หน้าเปิดงานใหม่): คงแผงเทาขอบชัดเดิม
        !solo &&
          !compact &&
          isExpanded &&
          "my-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 dark:border-slate-700/60 dark:bg-slate-800/40"
      )}
    >
      {!solo && (
        <OrderItemRow
          item={item} itemIdx={itemIdx} canRemove={canRemove}
          isExpanded={isExpanded} onToggleExpand={onToggleExpand}
          onRemoveItem={onRemoveItem}
        />
      )}

      {expanded && (
        <div className="space-y-4 py-4">
          {compact ? (
            <>
              {showPrints && printsSection}
              {productsSection}
              <CollapsibleSection
                title="รายละเอียดเพิ่มเติม"
                summary={secondarySummary}
                defaultOpen={hasSecondary}
              >
                <div className="space-y-4 pt-1">
                  {descField}
                  {showAddons && addonsSection}
                  {notesField}
                </div>
              </CollapsibleSection>
            </>
          ) : (
            <>
              {descField}
              {showPrints && printsSection}
              {productsSection}
              {showAddons && addonsSection}
              {notesField}
              {priceSummary}
            </>
          )}
        </div>
      )}
    </div>
  );
}
