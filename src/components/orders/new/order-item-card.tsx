"use client";

import { AddCard } from "@/components/ui/add-card";
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
  createOrderItemProduct,
  itemHasContent,
} from "@/types/order-form";
import { PrintTableRow } from "./print-table-row";
import { PrintCardMobile } from "./print-card-mobile";
import { ProductTableRow } from "./product-table-row";
import { ProductCardMobile } from "./product-card-mobile";
import { ProductAdaptiveCard } from "./product-adaptive-card";
import { AddProductPopover, PRODUCT_TYPE_OPTIONS } from "./add-product-popover";
import { FIELD_LABEL, FIELD_MEASURE, FOCUS_BUTTON, RADIUS, SUNK_PANEL, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";

export const labelClass = FIELD_LABEL;

const groupHeadingClass =
  "text-sm font-semibold text-slate-800 dark:text-slate-100";

interface OrderItemCardProps {
  cardId: string;
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
  // โหมดกระชับ (หน้าแก้รายการ): ยุบ คำอธิบาย/ส่วนเสริม/หมายเหตุ เป็น "รายละเอียดเพิ่มเติม" ·
  // ตัดสรุปราคาต่อรายการ (sidebar มีรวมแล้ว) · ย่อหัวข้อ (redesign 2026-06-12)
  compact?: boolean;
}

// ============================================================
// COLLAPSED ROW
// ============================================================

// หัวการ์ดของแต่ละรายการ (ทุกรายการกางเห็นหมด ไม่ accordion — เบส: ไม่ต้องซ่อน)
function OrderItemRow({
  item, itemIdx, canRemove, headingId, onRemoveItem,
}: {
  item: OrderItemForm;
  itemIdx: number;
  canRemove: boolean;
  headingId: string;
  onRemoveItem: (idx: number) => void;
}) {
  const itemPriceSummary = buildOrderItemPriceSummary(item);
  const { totalQuantity: totalQty, subtotal } = itemPriceSummary;
  const empty = !itemHasContent(item);

  return (
    <div className="flex min-h-11 items-center gap-2">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        {itemIdx + 1}
      </span>
      <h3 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold text-strong">
        รายการที่ {itemIdx + 1}
      </h3>
      {/* จำนวน/ยอด โผล่เมื่อมีเลขจริงเท่านั้น — เดิมใส่ขีด "—" ไว้แทนค่าว่าง
          กลายเป็นขีดลอยสองอันบนหัวรายการที่ไม่ได้บอกอะไร (เบสถามเอง 2026-08-05
          "ขีดนี้คืออะไร" = สัญญาณว่ามันสื่อความไม่ได้) */}
      {!empty && totalQty > 0 && (
        <span className="flex-shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {totalQty} ตัว
        </span>
      )}
      {!empty && subtotal > 0 && (
        <span className="flex-shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatCurrency(subtotal)}
        </span>
      )}
      {canRemove && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveItem(itemIdx)} aria-label="ลบรายการ" className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400">
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

/* การ์ดเพิ่มของตอนยังว่าง — สินค้า/ลาย/ส่วนเสริม ใช้หน้าตาเดียวกัน
   (เบสเห็นของจริง 2026-08-04: "ลาย/ส่วนเสริม ไม่เหมือนตัวอย่าง เอาแบบสินค้าในชุดงาน") */
/* โครงคอลัมน์ร่วมของ 3 ตารางในชุดงาน (สินค้า · ลาย · ส่วนเสริม)
   เบสสั่ง 2026-08-03 "แถวคอลัมขอให้มันตรงกันทั้งหมด เพื่อความสวย" — เดิมแต่ละตาราง
   ตั้งความกว้างเองคนละชุด (สินค้า 76/-/92/80/84/64/84/80 · ลาย 64/-/104/124/92/64/84/40)
   คอลัมน์ตัวเลขกับปุ่มถังขยะจึงอยู่คนละตำแหน่งเมื่อวางซ้อนกันในการ์ดเดียว
   ตารางส่วนเสริมมี 4 ช่องข้อมูล จึงใช้ colSpan ยืดให้ "ราคา" กับถังขยะไปลงตำแหน่งเดียวกัน */
function ItemTableCols() {
  return (
    <colgroup>
      {/* 100px — ป้ายแหล่งยาวสุด "ลูกค้าส่งมา" ต้องมีลมหายใจก่อนถึงคอลัมน์สินค้า
          (เบสเห็นจอจริง 2026-08-04 "คอลัมแหล่งกับสินค้าดูติดไป") */}
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

// ============================================================
// MAIN ORDER ITEM CARD
// ============================================================

export function OrderItemCard({
  cardId, item, itemIdx, canRemove, isExpanded,
  allItems, printCatalog, addonCatalog,
  onUpdateItem, onRemoveItem,
  onAddPrint, onRemovePrint, onUpdatePrint,
  onAddAddon, onRemoveAddon, onUpdateAddon,
  onOpenPicker, onSetItems,
  showPrints = true, showAddons = true,
  compact = false,
}: OrderItemCardProps) {
  const expanded = isExpanded;
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
      addons[aIdx] = {
        ...addons[aIdx],
        addonType: catalogItem.type,
        name: catalogItem.name,
        pricingType: catalogItem.pricingType as "PER_PIECE" | "PER_ORDER",
        unitPrice: catalogItem.defaultPrice,
        // เปลี่ยน identity ของส่วนเสริมแล้วต้องไม่แบก metadata/จำนวน override
        // ที่ UI ไม่ได้แสดงจากรายการเดิมไปคิดราคากับรายการใหม่
        description: undefined,
        quantity: undefined,
        notes: undefined,
      };
      copy[itemIdx] = { ...copy[itemIdx], addons };
      return copy;
    });
  };

  const addProductWithSource = (source: string) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const newProd = createOrderItemProduct({
        itemSource: source,
        ...(source === "CUSTOMER_PROVIDED" ? { baseUnitPrice: 0 } : {}),
      });
      copy[itemIdx] = { ...copy[itemIdx], products: [...copy[itemIdx].products, newProd] };
      return copy;
    });
  };

  const itemPriceSummary = buildOrderItemPriceSummary(item);
  const { totalQuantity: totalQty, subtotal } = itemPriceSummary;
  const headingId = `${cardId}-heading`;
  const usesAdaptiveProductBlocks = item.products.some(
    (product) => product.itemSource !== "FROM_STOCK",
  );

  // ── section: คำอธิบายงาน ──
  const descField = (
    <Field label="ชื่อชุดงาน" className={FIELD_MEASURE}>
      <Input value={item.description} onChange={(e) => onUpdateItem(itemIdx, "description", e.target.value)} placeholder="เช่น เสื้อทีมหน้าร้าน 30 ตัว" />
    </Field>
  );

  // ── section: ลาย ──
  const printsSection = (
    <div className="@container">
      <div className="mb-2 flex items-center justify-between">
          <span className={groupHeadingClass}>ลายและงานพิมพ์</span>
          <div className="flex items-center gap-1.5">
            {otherItemsWithPrints.length > 0 && (
              <div className="relative">
                <Select
                  surface="inline"
                  aria-label="คัดลอกลายจากรายการอื่น"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) copyPrintsFrom(parseInt(e.target.value));
                  }}
                  className="w-auto appearance-none rounded-lg pl-7 pr-2 text-slate-600 hover:bg-interactive-hover hover:text-secondary sm:text-xs dark:text-slate-400 dark:hover:bg-interactive-hover dark:hover:text-secondary"
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
            {item.prints.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onAddPrint(itemIdx)}>
                <Plus />เพิ่มลาย
              </Button>
            )}
          </div>
      </div>
      {item.prints.length === 0 ? (
        <AddCard
          icon={ImageIcon}
          label="เพิ่มลาย"
          desc="งานพิมพ์/สกรีน/ปัก ที่ลงบนเสื้อ"
          onClick={() => onAddPrint(itemIdx)}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden @2xl:block">
            <table className="w-full table-fixed">
              <ItemTableCols />
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-xs font-medium">
                  <th className="whitespace-nowrap px-2 py-2.5 text-center">ลาย</th>
                  <th className="px-2 py-2.5 text-left">วิธีพิมพ์</th>
                  <th className="px-2 py-2.5 text-center">ขนาด</th>
                  <th className="px-2 py-2.5 text-center">กว้าง × สูง</th>
                  <th className="px-2 py-2.5 text-center">ตำแหน่ง</th>
                  <th className="px-2 py-2.5 text-center">จำนวนสี</th>
                  <th className="px-2 py-2.5 text-center">ค่าสกรีน</th>
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
          <div className="space-y-2.5 @2xl:hidden">
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
        <span className={groupHeadingClass}>สินค้าในชุดงาน</span>
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
        <div className="grid gap-2 sm:grid-cols-3">
          {PRODUCT_TYPE_OPTIONS.map(({ key, icon, label, desc }) => (
            <AddCard
              key={key}
              icon={icon}
              label={label}
              desc={desc}
              onClick={() => {
                if (key === "stock") onOpenPicker();
                else if (key === "custom") addProductWithSource("CUSTOM_MADE");
                else addProductWithSource("CUSTOMER_PROVIDED");
              }}
            />
          ))}
        </div>
      ) : (
        usesAdaptiveProductBlocks ? (
          <div className="space-y-3">
            {item.products.map((prod, pIdx) => (
              <ProductAdaptiveCard
                key={prod.formKey ?? `${prod.itemSource}-${pIdx}`}
                product={prod}
                prodIdx={pIdx}
                itemIdx={itemIdx}
                totalProducts={item.products.length}
                onSetItems={onSetItems}
              />
            ))}
          </div>
        ) : (
          <>
            {/* สินค้าจากสต็อกล้วนคงตารางเดิมที่เบสเคาะไว้ */}
            <div className="hidden overflow-hidden @2xl:block">
              <table className="w-full table-fixed">
                <ItemTableCols />
                <thead className={TABLE_HEAD_SURFACE}>
                  <tr className="text-xs font-medium">
                    <th className="px-2 py-2.5 text-left">แหล่ง</th>
                    <th className="px-2 py-2.5 text-left">สินค้า</th>
                    <th className="px-2 py-2.5 text-center">แพค</th>
                    <th className="px-2 py-2.5 text-center">ราคา</th>
                    <th className="px-2 py-2.5 text-center">ส่วนลด</th>
                    <th className="px-2 py-2.5 text-center">จำนวน</th>
                    <th className="px-2 py-2.5 text-center">รวม</th>
                    <th className="py-2.5">
                      <span className="sr-only">จัดลำดับและลบสินค้า</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {item.products.map((prod, pIdx) => (
                    <ProductTableRow
                      key={prod.formKey ?? `stock-table-${pIdx}`}
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
            <div className="space-y-2.5 @2xl:hidden">
              {item.products.map((prod, pIdx) => (
                <ProductCardMobile
                  key={prod.formKey ?? `stock-mobile-${pIdx}`}
                  product={prod}
                  prodIdx={pIdx}
                  itemIdx={itemIdx}
                  totalProducts={item.products.length}
                  onSetItems={onSetItems}
                />
              ))}
            </div>
          </>
        )
      )}
    </div>
  );

  // ── section: ส่วนเสริม ──
  const addonsSection = (
    <div className="@container">
      <div className="mb-2 flex items-center justify-between">
        <span className={groupHeadingClass}>ส่วนเสริมในชุดงาน</span>
        {item.addons.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onAddAddon(itemIdx)}>
            <Plus />เพิ่มส่วนเสริม
          </Button>
        )}
      </div>
      {item.addons.length === 0 ? (
        <AddCard
          icon={Sparkles}
          label="เพิ่มส่วนเสริม"
          desc="ป้ายคอ · ถุงแพ็ค · งานเพิ่มนอกจากตัวเสื้อ"
          onClick={() => onAddAddon(itemIdx)}
        />
      ) : (
        <>
        <div className="hidden overflow-hidden @2xl:block">
          <table className="w-full table-fixed">
            <ItemTableCols />
            <thead className={TABLE_HEAD_SURFACE}>
              <tr className="text-left text-xs font-medium">
                <th colSpan={2} className="px-2 py-2.5">ประเภท</th>
                <th colSpan={2} className="px-2 py-2.5">ชื่อ</th>
                <th colSpan={2} className="px-2 py-2.5 text-center">คิดราคา</th>
                <th className="px-2 py-2.5 text-center">ราคา</th>
                <th className="py-2.5">
                  <span className="sr-only">ลบส่วนเสริม</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {item.addons.map((a, aIdx) => (
                <tr key={aIdx}>
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
                  <td className="py-1.5 pl-1 text-right align-middle"><Button type="button" variant="ghost" size="icon" aria-label={`ลบส่วนเสริม ${aIdx + 1}`} className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" onClick={() => onRemoveAddon(itemIdx, aIdx)}><Trash2 /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2.5 @2xl:hidden">
          {item.addons.map((addon, addonIdx) => (
            <div key={addonIdx} className={cn("space-y-3 rounded-lg p-3", SUNK_PANEL)}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ส่วนเสริม #{addonIdx + 1}
                </p>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`ลบส่วนเสริม ${addonIdx + 1}`} className="text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" onClick={() => onRemoveAddon(itemIdx, addonIdx)}><Trash2 /></Button>
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
    <Field label="หมายเหตุการผลิตชุดนี้" className={FIELD_MEASURE}>
      <Input value={item.notes} onChange={(e) => onUpdateItem(itemIdx, "notes", e.target.value)} placeholder="รายละเอียดที่ทีมผลิตต้องรู้..." />
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

  // หน้าเปิดงานและหน้าแก้ใช้ลำดับ/ถ้อยคำ/หน้าตาชุดเดียวกัน — ลายอยู่เหนือสินค้า
  // ตามมติล่าสุด 2026-08-14 และไม่มี presentation branch ให้สองหน้ากลับมา drift
  const productionSections = (
    <>
      {showPrints && printsSection}
      {productsSection}
      {showAddons && addonsSection}
    </>
  );

  return (
    // หนึ่งชุดงาน = หนึ่ง card surface โดยตรง ไม่มี card ใหญ่ครอบและไม่มีเส้นรอบซ้อน
    // (เบส 2026-08-14: รายการที่ 2 ต้องแยกเป็นการ์ดใหม่ และเอาขอบรายการออก)
    <article
      id={cardId}
      tabIndex={-1}
      role="listitem"
      aria-labelledby={headingId}
      className={cn(
        "card-surface scroll-mt-24 p-4 outline-none sm:p-5",
        FOCUS_BUTTON,
        RADIUS.surface,
      )}
    >
      <OrderItemRow
        item={item} itemIdx={itemIdx} canRemove={canRemove}
        headingId={headingId}
        onRemoveItem={onRemoveItem}
      />

      {expanded && (
        <div className="space-y-5 pt-4">
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
    </article>
  );
}
