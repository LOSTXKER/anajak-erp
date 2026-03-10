"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { cn, formatCurrency } from "@/lib/utils";
import { calculateFormItemSubtotal, getFormItemTotalQty, calculateTotalQuantity } from "@/lib/pricing";
import {
  Plus,
  Trash2,
  Palette,
  Copy,
  Pencil,
  Check,
  PackagePlus,
} from "lucide-react";
import type { OrderItemForm } from "@/types/order-form";
import {
  PRINT_TYPES,
  PRINT_POSITIONS,
  PRICING_TYPE_LABELS,
  EMPTY_PRODUCT,
} from "@/types/order-form";
import { PrintTableRow, Field } from "./print-table-row";
import { ProductTableRow } from "./product-table-row";
import { AddProductPopover } from "./add-product-popover";

export const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

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
  const productCount = item.products.length;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 transition-colors",
        isExpanded
          ? "border-b border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
      )}
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {itemIdx + 1}
      </span>

      <button
        type="button"
        onClick={onToggleExpand}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
      >
        {getItemLabel(item)}
        {productCount > 0 && (
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            · {productCount} สินค้า
          </span>
        )}
      </button>

      <span className="w-12 flex-shrink-0 text-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {totalQty > 0 ? totalQty : "—"}
      </span>

      <span className="hidden w-16 flex-shrink-0 text-center text-xs text-slate-500 dark:text-slate-400 md:block">
        {item.prints.length > 0 ? `${item.prints.length} ลาย` : "—"}
      </span>

      <span className="w-20 flex-shrink-0 text-right text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
        {subtotal > 0 ? formatCurrency(subtotal) : "—"}
      </span>

      <div className="flex flex-shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpand} aria-label={isExpanded ? "เสร็จสิ้นแก้ไข" : "แก้ไขรายการ"} className={cn("h-7 w-7 p-0", isExpanded ? "text-blue-600" : "text-slate-400 hover:text-blue-600")}>
          {isExpanded ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
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
}: OrderItemCardProps) {
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

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm dark:bg-slate-900", isExpanded ? "border-blue-300 dark:border-blue-800" : "border-slate-200 dark:border-slate-700")}>
      <OrderItemRow
        item={item} itemIdx={itemIdx} canRemove={canRemove}
        isExpanded={isExpanded} onToggleExpand={onToggleExpand}
        onRemoveItem={onRemoveItem}
      />

      {isExpanded && (
        <div className="space-y-4 p-4">
          {/* Job description */}
          <Field label="คำอธิบายงาน">
            <Input value={item.description} onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)} placeholder="เช่น งานสกรีนทีม ABC, งานพิมพ์เสื้อกิจกรรม..." />
          </Field>

          {/* ── PRINTS ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">ลายที่ต้องการสั่งผลิต</span>
                {item.prints.length > 0 && <Badge variant="purple" className="text-[10px]">{item.prints.length} ลาย</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {otherItemsWithPrints.length > 0 && (
                  <div className="relative">
                    <select value="" onChange={(e) => { if (e.target.value) copyPrintsFrom(parseInt(e.target.value)); }} className="h-7 appearance-none rounded-md border-0 bg-transparent pl-6 pr-2 text-xs text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/50">
                      <option value="">คัดลอกลาย...</option>
                      {otherItemsWithPrints.map(({ it, idx }) => <option key={idx} value={idx}>#{idx + 1} {it.description.slice(0, 20)} ({it.prints.length} ลาย)</option>)}
                    </select>
                    <Copy className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-purple-500" />
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => onAddPrint(itemIdx)} className="h-7 gap-1 border-purple-300 px-2.5 text-xs text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950">
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
                    <tr className="text-left text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <th className="pb-2 pr-1">รูปแบบ</th>
                      <th className="pb-2 px-1">วิธีพิมพ์</th>
                      <th className="pb-2 px-1">ขนาด</th>
                      <th className="pb-2 px-1">ตำแหน่ง</th>
                      <th className="w-14 pb-2 px-1">สี</th>
                      <th className="min-w-[80px] pb-2 px-1">ค่าสกรีน</th>
                      <th className="w-14 pb-2" />
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

          {/* ── PRODUCTS (flat table) ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">สินค้าที่ต้องการสั่งผลิต</span>
              </div>
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
                    <tr className="text-left text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <th className="pb-2 pl-1">แหล่ง</th>
                      <th className="pb-2 pr-2">สินค้า</th>
                      <th className="pb-2 px-1.5">ราคา (ต่อหน่วย)</th>
                      <th className="pb-2 px-1.5">จำนวน</th>
                      <th className="pb-2 px-1.5">ส่วนลด</th>
                      <th className="pb-2 px-1.5">แพ็คเกจ</th>
                      <th className="pb-2" />
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

          {/* ── ADD-ONS ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">ส่วนเสริม (Add-ons)</span>
                {item.addons.length > 0 && <Badge variant="secondary" className="text-[10px]">{item.addons.length}</Badge>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onAddAddon(itemIdx)} className="h-7 gap-1 border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"><Plus className="h-3.5 w-3.5" />เพิ่มส่วนเสริม</Button>
            </div>
            {item.addons.length === 0 ? (
              <p className="py-2 text-center text-xs italic text-slate-400 dark:text-slate-500">ไม่มีส่วนเสริม — กด &quot;Add-on&quot; เพื่อเพิ่ม</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <th className="w-8 pb-2" />
                      <th className="min-w-[100px] pb-2 px-1">ประเภท</th>
                      <th className="min-w-[120px] pb-2 px-1">ชื่อ</th>
                      <th className="min-w-[90px] pb-2 px-1">คิดราคา</th>
                      <th className="min-w-[80px] pb-2 pl-1">ราคา</th>
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

          {/* Notes */}
          <div>
            <label className={labelClass}>หมายเหตุรายการ</label>
            <Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder="หมายเหตุเพิ่มเติมสำหรับรายการนี้..." />
          </div>

          {/* Price summary — detailed breakdown */}
          {totalQty > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">สรุปราคารายการ</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-t border-slate-200 text-[11px] text-slate-400 dark:border-slate-700">
                    <th className="px-4 py-1.5 text-left font-medium">รายการ</th>
                    <th className="px-2 py-1.5 text-right font-medium">ราคา/ตัว</th>
                    <th className="px-2 py-1.5 text-right font-medium">จำนวน</th>
                    <th className="px-4 py-1.5 text-right font-medium">รวม</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-slate-300">
                  {/* Per-product cost */}
                  {item.products.map((p, i) => {
                    const pQty = calculateTotalQuantity(p.variants);
                    const net = Math.max(0, p.baseUnitPrice - (p.discount || 0));
                    const pTotal = pQty * net;
                    if (pQty === 0) return null;
                    const label = p.productName || p.description || `สินค้า ${i + 1}`;
                    const variant = [p.variants[0]?.color, p.variants[0]?.size].filter(Boolean).join(" ");
                    return (
                      <tr key={`p-${i}`} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-1.5">
                          <span className="text-slate-700 dark:text-slate-200">{label}</span>
                          {variant && <span className="ml-1 text-slate-400">({variant})</span>}
                          {(p.discount || 0) > 0 && <span className="ml-1 text-red-500">-{formatCurrency(p.discount || 0)}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(net)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{pQty}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCurrency(pTotal)}</td>
                      </tr>
                    );
                  })}
                  {/* Per-print cost */}
                  {item.prints.map((pr, i) => {
                    const prTotal = totalQty * pr.unitPrice;
                    if (pr.unitPrice === 0) return null;
                    const prLabel = PRINT_TYPES[pr.printType] || pr.printType;
                    const prPos = PRINT_POSITIONS[pr.position] || pr.position;
                    return (
                      <tr key={`pr-${i}`} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-1.5">
                          <span className="text-purple-600 dark:text-purple-400">🎨 {prLabel}</span>
                          <span className="ml-1 text-slate-400">({prPos})</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(pr.unitPrice)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{totalQty}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCurrency(prTotal)}</td>
                      </tr>
                    );
                  })}
                  {/* Per-addon cost */}
                  {item.addons.map((a, i) => {
                    const aTotal = a.pricingType === "PER_PIECE" ? totalQty * a.unitPrice : a.unitPrice;
                    if (a.unitPrice === 0) return null;
                    return (
                      <tr key={`a-${i}`} className="border-t border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-1.5">
                          <span className="text-slate-500">{a.name || `ส่วนเสริม ${i + 1}`}</span>
                          <span className="ml-1 text-[10px] text-slate-400">({PRICING_TYPE_LABELS[a.pricingType as "PER_PIECE" | "PER_ORDER"] ?? a.pricingType})</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(a.unitPrice)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{a.pricingType === "PER_PIECE" ? totalQty : "1"}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCurrency(aTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Grand total */}
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600">
                    <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      รวมทั้งหมด
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                      {totalQty} ตัว
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">
                      {formatCurrency(subtotal)}
                    </td>
                  </tr>
                  {totalQty > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 pb-2.5 text-[11px] text-slate-400">
                        เฉลี่ยต่อตัว
                      </td>
                      <td className="px-4 pb-2.5 text-right text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                        {formatCurrency(Math.round((subtotal / totalQty) * 100) / 100)}/ตัว
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onToggleExpand} className="gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />เสร็จสิ้น
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
