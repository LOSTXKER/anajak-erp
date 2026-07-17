"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn, formatCurrency } from "@/lib/utils";
import { buildOrderItemPriceSummary } from "@/lib/order-item-composer";
import {
  Plus,
  Trash2,
  Copy,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import type { OrderItemForm } from "@/types/order-form";
import {
  PRICING_TYPE_LABELS,
  EMPTY_PRODUCT,
  itemHasContent,
} from "@/types/order-form";
import { PrintTableRow } from "./print-table-row";
import { ProductTableRow } from "./product-table-row";
import { ProductCardMobile } from "./product-card-mobile";
import { AddProductPopover, PRODUCT_TYPE_OPTIONS } from "./add-product-popover";

export const labelClass =
  "mb-1 block text-[12px] text-slate-500 dark:text-slate-400";

// หัวข้อกลุ่ม — เด่นชัด (แถบน้ำเงิน + ตัวหนาเข้ม) แยกกลุ่มให้สายตาจับได้ทันที (เบส: highlight หัวข้อ)
const groupLabelClass =
  "border-l-[3px] border-blue-500 pl-2 text-sm font-semibold text-slate-800 dark:border-blue-400 dark:text-slate-100";

interface OrderItemCardProps {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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

// ============================================================
// COLLAPSED ROW
// ============================================================

// หัวการ์ดของแต่ละรายการ (ทุกรายการกางเห็นหมด ไม่ accordion — เบส: ไม่ต้องซ่อน)
function OrderItemRow({
  item, itemIdx, canRemove, onRemoveItem,
}: {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  onRemoveItem: (idx: number) => void;
}) {
  const itemPriceSummary = buildOrderItemPriceSummary(item);
  const { totalQuantity: totalQty, subtotal } = itemPriceSummary;
  const empty = !itemHasContent(item);

  return (
    <div className="flex items-center gap-2 border-b border-slate-200/60 py-2.5 dark:border-slate-700/50">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        {itemIdx + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
        รายการที่ {itemIdx + 1}
      </span>
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
      {canRemove && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveItem(itemIdx)} aria-label="ลบรายการ" className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ============================================================
// MAIN ORDER ITEM CARD
// ============================================================

export function OrderItemCard({
  item, itemIdx, canRemove, isExpanded,
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

  const itemPriceSummary = buildOrderItemPriceSummary(item);
  const { totalQuantity: totalQty, subtotal } = itemPriceSummary;

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
              <NativeSelect
                aria-label="คัดลอกลายจากรายการอื่น"
                value=""
                onChange={(e) => {
                  if (e.target.value) copyPrintsFrom(parseInt(e.target.value));
                }}
                className="w-auto appearance-none rounded-md border-0 bg-transparent pl-7 pr-2 text-slate-600 hover:bg-slate-100 sm:text-xs dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <option value="">คัดลอกลาย...</option>
                {otherItemsWithPrints.map(({ it, idx }) => (
                  <option key={idx} value={idx}>
                    #{idx + 1} {it.description.slice(0, 20)} ({it.prints.length} ลาย)
                  </option>
                ))}
              </NativeSelect>
              <Copy className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => onAddPrint(itemIdx)}>
            <Plus className="h-3.5 w-3.5" />เพิ่มลาย
          </Button>
        </div>
      </div>
      {item.prints.length === 0 ? (
        <button
          type="button"
          onClick={() => onAddPrint(itemIdx)}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
        >
          <ImageIcon className="h-6 w-6 text-slate-300 dark:text-slate-600" />
          <span className="text-xs text-slate-500 dark:text-slate-400">ยังไม่มีลาย — กดเพื่อเพิ่มลายแรก</span>
        </button>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-normal text-slate-400 dark:text-slate-500">
                <th className="w-12 pb-1.5 pr-1">รูปแบบ</th>
                <th className="pb-1.5 px-1">วิธีพิมพ์</th>
                <th className="w-28 pb-1.5 px-1 text-right">ค่าสกรีน</th>
                <th className="w-10 pb-1.5">
                  <span className="sr-only">การทำงาน</span>
                </th>
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
        {item.products.length > 0 && (
          <AddProductPopover
            onAddFromStock={onOpenPicker}
            onAddCustomMade={() => addProductWithSource("CUSTOM_MADE")}
            onAddCustomerProvided={() => addProductWithSource("CUSTOMER_PROVIDED")}
          />
        )}
      </div>
      {item.products.length === 0 ? (
        // เลือกชนิดงานก่อน → ระบบโชว์เฉพาะ field ที่ชนิดนั้นใช้ (guided by type)
        <div>
          <p className="mb-2 text-center text-xs text-slate-500 dark:text-slate-400">งานนี้ใช้เสื้อแบบไหน? เลือกเพื่อเริ่ม</p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {PRODUCT_TYPE_OPTIONS.map(({ key, icon: Icon, label, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === "stock") onOpenPicker();
                  else if (key === "custom") addProductWithSource("CUSTOM_MADE");
                  else addProductWithSource("CUSTOMER_PROVIDED");
                }}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-slate-200 p-4 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
              >
                <Icon className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* เดสก์ท็อป (≥ sm): ตาราง 5 คอลัมน์หลัก */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 76 }} />
                <col />
                <col style={{ width: 82 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr className="text-xs font-normal text-slate-400 dark:text-slate-500">
                  <th className="pb-1.5 pl-1 text-left">แหล่ง</th>
                  <th className="pb-1.5 pr-2 text-left">สินค้า</th>
                  <th className="pb-1.5 px-1.5 text-right">ราคา</th>
                  <th className="pb-1.5 px-1.5 text-center">จำนวน</th>
                  <th className="pb-1.5 px-1.5 text-right">รวม</th>
                  <th className="pb-1.5">
                    <span className="sr-only">จัดลำดับและลบสินค้า</span>
                  </th>
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
          {/* มือถือ (< sm): การ์ดเรียงแนวตั้ง — ไม่ต้องเลื่อนซ้ายขวา (UX7) */}
          <div className="space-y-2.5 sm:hidden">
            {item.products.map((prod, pIdx) => (
              <ProductCardMobile
                key={pIdx}
                product={prod}
                prodIdx={pIdx}
                itemIdx={itemIdx}
                totalProducts={item.products.length}
                onSetItems={onSetItems}
              />
            ))}
          </div>
        </>
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
        <button
          type="button"
          onClick={() => onAddAddon(itemIdx)}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
        >
          <Sparkles className="h-6 w-6 text-slate-300 dark:text-slate-600" />
          <span className="text-xs text-slate-500 dark:text-slate-400">ยังไม่มีส่วนเสริม — กดเพื่อเพิ่ม</span>
        </button>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-normal text-slate-400 dark:text-slate-500">
                <th className="min-w-[100px] pb-1.5 px-1">ประเภท</th>
                <th className="min-w-[120px] pb-1.5 px-1">ชื่อ</th>
                <th className="min-w-[90px] pb-1.5 px-1">คิดราคา</th>
                <th className="min-w-[80px] pb-1.5 px-1">ราคา</th>
                <th className="w-10 pb-1.5">
                  <span className="sr-only">ลบส่วนเสริม</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {item.addons.map((a, aIdx) => (
                <tr key={aIdx} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-1 py-1.5 align-middle">
                    {addonCatalog && addonCatalog.length > 0 ? (
                      <NativeSelect aria-label={`เลือกประเภทส่วนเสริม ${aIdx + 1} จากแค็ตตาล็อก`} value="" onChange={(e) => { if (e.target.value) applyAddonFromCatalog(aIdx, e.target.value); e.target.value = ""; }} className="sm:h-9 sm:text-xs">
                        <option value="">{a.addonType || "แค็ตตาล็อก..."}</option>
                        {addonCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </NativeSelect>
                    ) : (
                      <Input aria-label={`ประเภทส่วนเสริม ${aIdx + 1}`} value={a.addonType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "addonType", e.target.value)} placeholder="LABEL, TAG..." className="sm:h-9 sm:text-xs" />
                    )}
                  </td>
                  <td className="px-1 py-1.5 align-middle"><Input aria-label={`ชื่อส่วนเสริม ${aIdx + 1}`} value={a.name} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "name", e.target.value)} placeholder="ชื่อ add-on" className="sm:h-9 sm:text-xs" /></td>
                  <td className="px-1 py-1.5 align-middle"><NativeSelect aria-label={`วิธีคิดราคาส่วนเสริม ${aIdx + 1}`} value={a.pricingType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "pricingType", e.target.value as "PER_PIECE" | "PER_ORDER")} className="sm:h-9 sm:text-xs"><option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option><option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option></NativeSelect></td>
                  <td className="px-1 py-1.5 align-middle"><Input aria-label={`ราคาส่วนเสริม ${aIdx + 1}`} type="number" min={0} step={0.01} value={a.unitPrice || ""} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="sm:h-9 sm:text-xs" /></td>
                  <td className="py-1.5 pl-1 text-right align-middle"><Button type="button" variant="ghost" size="icon" aria-label={`ลบส่วนเสริม ${aIdx + 1}`} className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => onRemoveAddon(itemIdx, aIdx)}><Trash2 className="h-4 w-4" /></Button></td>
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
    <Field label="หมายเหตุรายการ">
      <Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder="หมายเหตุเพิ่มเติมสำหรับรายการนี้..." />
    </Field>
  );

  // ── section: สรุปราคาต่อรายการ (เฉพาะโหมดปกติ — compact ใช้สรุปรวมที่ sidebar) ──
  const priceSummary = totalQty > 0 ? (
    <div className="border-t border-slate-200/70 pt-3 dark:border-slate-700/60">
      <p className={cn(groupLabelClass, "mb-2")}>สรุปราคารายการ</p>
      <table className="w-full text-xs">
        <tbody className="text-slate-600 dark:text-slate-300">
          {itemPriceSummary.lines.map((line) => {
            return (
              <tr key={line.key}>
                <td className="py-1">
                  <span className="text-slate-700 dark:text-slate-200">{line.label}</span>
                  {line.detail && (
                    <span className={cn("ml-1 text-slate-400", line.kind === "addon" && "text-xs")}>
                      ({line.detail})
                    </span>
                  )}
                  {line.kind === "product" && (line.discount || 0) > 0 && (
                    <span className="ml-1 text-red-500">-{formatCurrency(line.discount || 0)}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">{formatCurrency(line.unitPrice)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">×{line.quantity}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(line.total)}</td>
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
            <td colSpan={3} className="text-xs text-slate-400">
              เฉลี่ย {formatCurrency(itemPriceSummary.averageUnitPrice ?? 0)} / ตัว
            </td>
            <td aria-hidden="true" />
          </tr>
        </tfoot>
      </table>
    </div>
  ) : null;

  return (
    // ทุกรายการกางเห็นหมด (ไม่ accordion) — หัว "รายการที่ N" + เนื้อหา · คั่นด้วย divide-y ของ parent
    <div className={cn(!solo && "px-4")}>
      {!solo && (
        <OrderItemRow
          item={item} itemIdx={itemIdx} canRemove={canRemove}
          onRemoveItem={onRemoveItem}
        />
      )}

      {expanded && (
        <div className="space-y-4 py-4">
          {compact ? (
            <>
              {/* คำอธิบายงานอยู่บนสุด ใต้เลขรายการ (เบส: คำอธิบายไปอยู่ข้างบนกับเลข) */}
              {descField}
              {showPrints && printsSection}
              {productsSection}
              {showAddons && addonsSection}
              {notesField}
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
