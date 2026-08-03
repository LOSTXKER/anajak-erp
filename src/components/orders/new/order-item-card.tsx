"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { PrintCardMobile } from "./print-card-mobile";
import { ProductTableRow } from "./product-table-row";
import { ProductCardMobile } from "./product-card-mobile";
import { AddProductPopover, PRODUCT_TYPE_OPTIONS } from "./add-product-popover";
import { DASHED, FIELD_LABEL, FIELD_MEASURE, SUNK_PANEL, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";

export const labelClass = FIELD_LABEL;

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
  /** presentation เฉพาะหน้าเปิดงานใหม่: สินค้าก่อนลาย + empty CTA กระชับ */
  appearance?: "default" | "intake";
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
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveItem(itemIdx)} aria-label="ลบรายการ" className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

/* โครงคอลัมน์ร่วมของ 3 ตารางในชุดงาน (สินค้า · ลาย · ส่วนเสริม)
   เบสสั่ง 2026-08-03 "แถวคอลัมขอให้มันตรงกันทั้งหมด เพื่อความสวย" — เดิมแต่ละตาราง
   ตั้งความกว้างเองคนละชุด (สินค้า 76/-/92/80/84/64/84/80 · ลาย 64/-/104/124/92/64/84/40)
   คอลัมน์ตัวเลขกับปุ่มถังขยะจึงอยู่คนละตำแหน่งเมื่อวางซ้อนกันในการ์ดเดียว
   ตารางส่วนเสริมมี 4 ช่องข้อมูล จึงใช้ colSpan ยืดให้ "ราคา" กับถังขยะไปลงตำแหน่งเดียวกัน */
function ItemTableCols() {
  return (
    <colgroup>
      <col style={{ width: 76 }} />
      <col />
      <col style={{ width: 104 }} />
      <col style={{ width: 116 }} />
      <col style={{ width: 92 }} />
      <col style={{ width: 76 }} />
      <col style={{ width: 96 }} />
      <col style={{ width: 44 }} />
    </colgroup>
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
  appearance = "default",
}: OrderItemCardProps) {
  const expanded = solo || isExpanded;
  const isIntake = appearance === "intake";
  const groupHeadingClass = isIntake
    ? "text-sm font-semibold text-slate-800 dark:text-slate-100"
    : groupLabelClass;
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
    <Field label={isIntake ? "ชื่อชุดงาน" : "คำอธิบายงาน"} className={isIntake ? FIELD_MEASURE : undefined}>
      <Input value={item.description} onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)} placeholder={isIntake ? "เช่น เสื้อทีมหน้าร้าน 30 ตัว" : "เช่น งานสกรีนทีม ABC, งานพิมพ์เสื้อกิจกรรม..."} />
    </Field>
  );

  // ── section: ลาย ──
  const printsSection = (
    <div className="@container">
      {(!isIntake || item.prints.length > 0 || otherItemsWithPrints.length > 0) && (
        <div className="mb-2 flex items-center justify-between">
          <span className={groupHeadingClass}>{isIntake ? "ลายและงานพิมพ์" : compact ? "ลาย" : "ลายที่ต้องการสั่งผลิต"}</span>
          <div className="flex items-center gap-1.5">
            {otherItemsWithPrints.length > 0 && (
              <div className="relative">
                <Select
                  aria-label="คัดลอกลายจากรายการอื่น"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) copyPrintsFrom(parseInt(e.target.value));
                  }}
                  className="w-auto appearance-none rounded-lg border-0 bg-transparent pl-7 pr-2 text-slate-600 hover:bg-slate-100 sm:text-xs dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <option value="">คัดลอกลาย...</option>
                  {otherItemsWithPrints.map(({ it, idx }) => (
                    <option key={idx} value={idx}>
                      #{idx + 1} {it.description.slice(0, 20)} ({it.prints.length} ลาย)
                    </option>
                  ))}
                </Select>
                <Copy className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              </div>
            )}
            {(!isIntake || item.prints.length > 0) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onAddPrint(itemIdx)}>
                <Plus />เพิ่มลาย
              </Button>
            )}
          </div>
        </div>
      )}
      {item.prints.length === 0 ? (
        isIntake ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddPrint(itemIdx)}
            className="gap-2 text-slate-600 dark:text-slate-300"
          >
            <ImageIcon className="h-4 w-4" />
            เพิ่มลายหรืองานพิมพ์
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => onAddPrint(itemIdx)}
            className={cn(DASHED, "flex w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-700 dark:hover:bg-blue-950/20")}
          >
            <ImageIcon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">ยังไม่มีลาย — กดเพื่อเพิ่มลายแรก</span>
          </button>
        )
      ) : (
        <>
          <div
            className={cn(
              "hidden overflow-hidden",
              isIntake ? "@2xl:block" : "@3xl:block"
            )}
          >
            <table className="w-full table-fixed">
              <ItemTableCols />
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-xs font-medium">
                  <th className="whitespace-nowrap px-2 py-2.5 text-left">
                    รูปแบบ
                  </th>
                  <th className="px-2 py-2.5 text-left">วิธีพิมพ์</th>
                  <th className="px-2 py-2.5 text-left">ขนาด</th>
                  <th className="px-2 py-2.5 text-center">กว้าง × สูง</th>
                  <th className="px-2 py-2.5 text-left">ตำแหน่ง</th>
                  <th className="px-2 py-2.5 text-center">จำนวนสี</th>
                  <th className="px-2 py-2.5 text-right">ค่าสกรีน</th>
                  <th className="py-2.5">
                    <span className="sr-only">ลบลาย</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {item.prints.map((print, printIdx) => (
                  <PrintTableRow
                    key={printIdx}
                    print={print}
                    printIdx={printIdx}
                    onUpdate={(field, value) =>
                      onUpdatePrint(itemIdx, printIdx, field, value)
                    }
                    onRemove={() => onRemovePrint(itemIdx, printIdx)}
                    printCatalog={printCatalog}
                    onApplyCatalog={(catalogId) =>
                      applyPrintFromCatalog(printIdx, catalogId)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className={cn("space-y-2.5", isIntake ? "@2xl:hidden" : "@3xl:hidden")}>
            {item.prints.map((print, printIdx) => (
              <PrintCardMobile
                key={printIdx}
                print={print}
                printIdx={printIdx}
                onUpdate={(field, value) =>
                  onUpdatePrint(itemIdx, printIdx, field, value)
                }
                onRemove={() => onRemovePrint(itemIdx, printIdx)}
                printCatalog={printCatalog}
                onApplyCatalog={(catalogId) =>
                  applyPrintFromCatalog(printIdx, catalogId)
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── section: สินค้า ──
  const productsSection = (
    <div className="@container">
      <div className="mb-2 flex items-center justify-between">
        <span className={groupHeadingClass}>{isIntake ? "สินค้าในชุดงาน" : compact ? "สินค้า" : "สินค้าที่ต้องการสั่งผลิต"}</span>
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
        isIntake ? (
          <div className="flex flex-wrap gap-2">
            {PRODUCT_TYPE_OPTIONS.map(({ key, icon: Icon, label }) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (key === "stock") onOpenPicker();
                  else if (key === "custom") addProductWithSource("CUSTOM_MADE");
                  else addProductWithSource("CUSTOMER_PROVIDED");
                }}
                className="gap-2 text-slate-600 dark:text-slate-300"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {label}
              </Button>
            ))}
          </div>
        ) : (
          <div>
            <p className="mb-2 text-center text-xs text-slate-500 dark:text-slate-400">งานนี้ใช้เสื้อแบบไหน? เลือกเพื่อเริ่ม</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PRODUCT_TYPE_OPTIONS.map(({ key, icon: Icon, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "stock") onOpenPicker();
                    else if (key === "custom") addProductWithSource("CUSTOM_MADE");
                    else addProductWithSource("CUSTOMER_PROVIDED");
                  }}
                  className={cn(DASHED, "flex flex-col items-center gap-1.5 rounded-xl p-4 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-700 dark:hover:bg-blue-950/20")}
                >
                  <Icon className="h-6 w-6 shrink-0 text-slate-400" strokeWidth={1.75} />
                  <span>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {/* พื้นที่กว้างพอ (container ≥ 2xl): ตารางหนึ่งแถวต่อสินค้า พร้อมหัวคอลัมน์ครบ */}
          <div
            className={cn(
              "hidden overflow-hidden",
              isIntake ? "@2xl:block" : "@3xl:block"
            )}
          >
            <table className="w-full table-fixed">
              <ItemTableCols />
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-xs font-medium">
                  <th className="px-2 py-2.5 text-left">แหล่ง</th>
                  <th className="px-2 py-2.5 text-left">สินค้า</th>
                  <th className="px-2 py-2.5 text-left">แพค</th>
                  <th className="px-2 py-2.5 text-right">ราคา</th>
                  <th className="px-2 py-2.5 text-right">ส่วนลด</th>
                  <th className="px-2 py-2.5 text-center">จำนวน</th>
                  <th className="px-2 py-2.5 text-right">รวม</th>
                  <th className="py-2.5">
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
          {/* จอแคบใช้การ์ด ไม่บีบตาราง 8 คอลัมน์ลงมือถือ/แท็บเล็ต */}
          <div className={cn("space-y-2.5", isIntake ? "@2xl:hidden" : "@3xl:hidden")}>
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
    <div className="@container">
      {(!isIntake || item.addons.length > 0) && (
        <div className="mb-2 flex items-center justify-between">
          <span className={groupHeadingClass}>{isIntake ? "ส่วนเสริมในชุดงาน" : "ส่วนเสริม (Add-ons)"}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onAddAddon(itemIdx)}>
            <Plus />เพิ่มส่วนเสริม
          </Button>
        </div>
      )}
      {item.addons.length === 0 ? (
        isIntake ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddAddon(itemIdx)}
            className="gap-2 text-slate-600 dark:text-slate-300"
          >
            <Sparkles className="h-4 w-4" />
            เพิ่มส่วนเสริม
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => onAddAddon(itemIdx)}
            className={cn(DASHED, "flex w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-700 dark:hover:bg-blue-950/20")}
          >
            <Sparkles className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">ยังไม่มีส่วนเสริม — กดเพื่อเพิ่ม</span>
          </button>
        )
      ) : (
        <>
        <div
          className={cn(
            "hidden overflow-hidden",
            isIntake ? "@2xl:block" : "@3xl:block"
          )}
        >
          <table className="w-full table-fixed">
            <ItemTableCols />
            <thead className={TABLE_HEAD_SURFACE}>
              <tr className="text-left text-xs font-medium">
                <th colSpan={2} className="px-2 py-2.5">ประเภท</th>
                <th colSpan={2} className="px-2 py-2.5">ชื่อ</th>
                <th colSpan={2} className="px-2 py-2.5">คิดราคา</th>
                <th className="px-2 py-2.5 text-right">ราคา</th>
                <th className="py-2.5">
                  <span className="sr-only">ลบส่วนเสริม</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {item.addons.map((a, aIdx) => (
                <tr key={aIdx} className="border-b border-slate-100 last:border-0 dark:border-white/10">
                  <td colSpan={2} className="px-2 py-1.5 align-middle">
                    {addonCatalog && addonCatalog.length > 0 ? (
                      <Select aria-label={`เลือกประเภทส่วนเสริม ${aIdx + 1} จากแค็ตตาล็อก`} value="" onChange={(e) => { if (e.target.value) applyAddonFromCatalog(aIdx, e.target.value); }} size="dense">
                        <option value="">{a.addonType || "แค็ตตาล็อก..."}</option>
                        {addonCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                    ) : (
                      <Input aria-label={`ประเภทส่วนเสริม ${aIdx + 1}`} value={a.addonType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "addonType", e.target.value)} placeholder="LABEL, TAG..." size="dense" />
                    )}
                  </td>
                  <td colSpan={2} className="px-2 py-1.5 align-middle"><Input aria-label={`ชื่อส่วนเสริม ${aIdx + 1}`} value={a.name} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "name", e.target.value)} placeholder="ชื่อ add-on" size="dense" /></td>
                  <td colSpan={2} className="px-2 py-1.5 align-middle"><Select aria-label={`วิธีคิดราคาส่วนเสริม ${aIdx + 1}`} value={a.pricingType} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "pricingType", e.target.value as "PER_PIECE" | "PER_ORDER")} size="dense"><option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option><option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option></Select></td>
                  <td className="px-2 py-1.5 align-middle"><Input aria-label={`ราคาส่วนเสริม ${aIdx + 1}`} type="number" min={0} step={0.01} value={a.unitPrice || ""} onChange={(e) => onUpdateAddon(itemIdx, aIdx, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" size="dense" /></td>
                  <td className="py-1.5 pl-1 text-right align-middle"><Button type="button" variant="ghost" size="icon" aria-label={`ลบส่วนเสริม ${aIdx + 1}`} className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => onRemoveAddon(itemIdx, aIdx)}><Trash2 /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={cn("space-y-2.5", isIntake ? "@2xl:hidden" : "@3xl:hidden")}>
          {item.addons.map((addon, addonIdx) => (
            <div key={addonIdx} className={cn("space-y-3 rounded-xl p-3", SUNK_PANEL)}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ส่วนเสริม #{addonIdx + 1}
                </p>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`ลบส่วนเสริม ${addonIdx + 1}`} className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => onRemoveAddon(itemIdx, addonIdx)}><Trash2 /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ประเภท">
                  {addonCatalog && addonCatalog.length > 0 ? (
                    <Select aria-label={`เลือกประเภทส่วนเสริม ${addonIdx + 1} จากแค็ตตาล็อก`} value="" onChange={(e) => { if (e.target.value) applyAddonFromCatalog(addonIdx, e.target.value); }}>
                      <option value="">{addon.addonType || "แค็ตตาล็อก..."}</option>
                      {addonCatalog.map((catalogItem) => <option key={catalogItem.id} value={catalogItem.id}>{catalogItem.name}</option>)}
                    </Select>
                  ) : (
                    <Input aria-label={`ประเภทส่วนเสริม ${addonIdx + 1}`} value={addon.addonType} onChange={(e) => onUpdateAddon(itemIdx, addonIdx, "addonType", e.target.value)} placeholder="LABEL, TAG..." />
                  )}
                </Field>
                <Field label="ชื่อ">
                  <Input aria-label={`ชื่อส่วนเสริม ${addonIdx + 1}`} value={addon.name} onChange={(e) => onUpdateAddon(itemIdx, addonIdx, "name", e.target.value)} placeholder="ชื่อ add-on" />
                </Field>
                <Field label="คิดราคา">
                  <Select aria-label={`วิธีคิดราคาส่วนเสริม ${addonIdx + 1}`} value={addon.pricingType} onChange={(e) => onUpdateAddon(itemIdx, addonIdx, "pricingType", e.target.value as "PER_PIECE" | "PER_ORDER")}>
                    <option value="PER_PIECE">{PRICING_TYPE_LABELS.PER_PIECE}</option>
                    <option value="PER_ORDER">{PRICING_TYPE_LABELS.PER_ORDER}</option>
                  </Select>
                </Field>
                <Field label="ราคา">
                  <Input aria-label={`ราคาส่วนเสริม ${addonIdx + 1}`} type="number" min={0} step={0.01} value={addon.unitPrice || ""} onChange={(e) => onUpdateAddon(itemIdx, addonIdx, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="text-right" />
                </Field>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );

  // ── section: หมายเหตุ ──
  const notesField = (
    <Field label={isIntake ? "หมายเหตุการผลิตชุดนี้" : "หมายเหตุรายการ"} className={isIntake ? FIELD_MEASURE : undefined}>
      <Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder={isIntake ? "รายละเอียดที่ทีมผลิตต้องรู้..." : "หมายเหตุเพิ่มเติมสำหรับรายการนี้..."} />
    </Field>
  );

  // ── section: สรุปราคาต่อรายการ (เฉพาะโหมดปกติ — compact ใช้สรุปรวมที่ sidebar) ──
  const priceSummary = totalQty > 0 ? (
    <div className="border-t border-slate-200/70 pt-3 dark:border-slate-700/60">
      <p className={cn(groupHeadingClass, "mb-2")}>สรุปราคารายการ</p>
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

  const showCompactDetailActions =
    isIntake &&
    showPrints &&
    showAddons &&
    item.prints.length === 0 &&
    item.addons.length === 0;

  const productionSections = isIntake ? (
    <>
      {productsSection}
      {showCompactDetailActions ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddPrint(itemIdx)}
            className="gap-2 text-slate-600 dark:text-slate-300"
          >
            <ImageIcon className="h-4 w-4" />
            เพิ่มลายหรืองานพิมพ์
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddAddon(itemIdx)}
            className="gap-2 text-slate-600 dark:text-slate-300"
          >
            <Sparkles className="h-4 w-4" />
            เพิ่มส่วนเสริม
          </Button>
        </div>
      ) : (
        <>
          {showPrints && printsSection}
          {showAddons && addonsSection}
        </>
      )}
    </>
  ) : (
    <>
      {showPrints && printsSection}
      {productsSection}
      {showAddons && addonsSection}
    </>
  );

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
              {productionSections}
              {notesField}
            </>
          ) : (
            <>
              {descField}
              {productionSections}
              {notesField}
              {priceSummary}
            </>
          )}
        </div>
      )}
    </div>
  );
}
