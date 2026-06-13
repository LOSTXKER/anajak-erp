"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { formatCurrency } from "@/lib/utils";
import { calculateFormItemSubtotal, calculateOrderSummary } from "@/lib/pricing";
import { Loader2, Plus, Trash2, Save, Pencil } from "lucide-react";
import { validateOrderItem, validateOrderItemProduct, itemHasContent } from "@/types/order-form";
import {
  mapItemsToMutationInput,
  mapFeesToMutationInput,
  mapApiItemsToForm,
  mapApiFeesToForm,
} from "@/lib/order-mapping";
import { mergeStockVariantsIntoItems } from "@/lib/order-form-stock";
import { useOrderItemsForm, useOrderFeesForm } from "@/hooks/use-order-items-form";
// ฟอร์มรายการ "ชุดเดียวกับหน้าเปิดงาน" — แสดง inline บนหน้าออเดอร์เลย ไม่ใช่ popup
// (เบสเคาะ 2026-06-11: เปิดงานเบาแล้วมาเติมทีหลัง ต้องเห็นฟอร์มเต็มกว้างตรงที่รายการอยู่)
import { OrderItemCard } from "@/components/orders/new";
import {
  MarginEstimateBlock,
  useMarginEstimate,
} from "@/components/orders/new/order-price-summary";
import {
  ProductPickerDialog,
  type SelectedVariantItem,
} from "@/components/product-picker";

interface OrderItemsEditorOrder {
  items: Array<{
    description: string | null;
    notes: string | null;
    products: Array<Record<string, unknown> & {
      productId: string | null;
      productType: string;
      description: string;
      material: string | null;
      baseUnitPrice: number;
      discount: number;
      packagingOptionId: string | null;
      itemSource: string | null;
      fabricType: string | null;
      fabricWeight: string | null;
      fabricColor: string | null;
      processingType: string | null;
      patternId: string | null;
      collarType: string | null;
      sleeveType: string | null;
      bodyFit: string | null;
      patternFileUrl: string | null;
      patternNote: string | null;
      garmentCondition: string | null;
      receivedInspected: boolean;
      receiveNote: string | null;
      product?: { name?: string; sku?: string; imageUrl?: string | null } | null;
      variants: Array<{ size: string; color: string | null; quantity: number }>;
    }>;
    prints: Array<{
      position: string;
      printType: string;
      colorCount: number | null;
      unitPrice: number;
      printSize: string | null;
      width: number | null;
      height: number | null;
      designNote: string | null;
      designImageUrl: string | null;
      // ลิงก์คลังลาย — ห้ามหายจาก contract นี้ ไม่งั้น excess property check ตัดทิ้ง
      // ตอน refactor แล้วการผูกหลุดเงียบตอนบันทึกแก้รายการ
      artworkId?: string | null;
    }>;
    addons: Array<{
      addonType: string;
      name: string;
      pricingType: string;
      unitPrice: number;
    }>;
  }>;
  fees: Array<{ feeType: string; name: string; amount: number }>;
  discount: number;
  taxRate: number;
}

interface OrderItemsEditorProps {
  orderId: string;
  orderType: string;
  internalStatus: string;
  order: OrderItemsEditorOrder;
  onDone: () => void;
  onCancel: () => void;
}

export function OrderItemsEditor({
  orderId,
  orderType,
  internalStatus,
  order,
  onDone,
  onCancel,
}: OrderItemsEditorProps) {
  // ช่วง DRAFT/INQUIRY server ยัง re-derive ชนิดออเดอร์จากเนื้อรายการ — ออเดอร์ที่กลายเป็น
  // READY_MADE (เปิดเบา→เติมเสื้อเปล่า) ต้องเพิ่มลายได้ ไม่งั้นต้องยกเลิกเปิดใหม่ (audit ข้อ 3)
  const canAddPrints =
    orderType === "CUSTOM" || ["DRAFT", "INQUIRY"].includes(internalStatus);

  // ตั้งค่าเริ่มจาก props ตรงๆ — editor ถูก mount ใหม่ทุกครั้งที่กดแก้ไข ไม่ต้องใช้ effect-reset
  // (effect-reset เดิมทำฟอร์มวูบหายตอนออเดอร์ 0 รายการ + defaultOpen ของกล่องพับตายด้าน —
  // review 2026-06-11) · ออเดอร์ยังไม่มีรายการ → เริ่มด้วยรายการเปล่า 1 ชุด พร้อมกรอกทันที
  const [initialItems] = useState(() => {
    const mapped = mapApiItemsToForm(order.items);
    return mapped.length > 0 ? mapped : undefined; // undefined = hook seed รายการเปล่าให้
  });
  const [initialFees] = useState(() => mapApiFeesToForm(order.fees));

  const {
    items,
    setItems,
    addItem,
    removeItem,
    updateItem,
    addPrint,
    removePrint,
    updatePrint,
    addAddon,
    removeAddon,
    updateAddon,
  } = useOrderItemsForm(initialItems);

  const { fees, addFee, removeFee, updateFee } = useOrderFeesForm(initialFees);

  const [discount, setDiscount] = useState(order.discount || 0);
  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [initialFeesJson] = useState(() => JSON.stringify(initialFees));
  const [saving, setSaving] = useState(false);

  const utils = trpc.useUtils();

  const { data: printCatalog } = trpc.serviceCatalog.list.useQuery({
    category: "PRINT",
    isActive: true,
  });
  const { data: addonCatalog } = trpc.serviceCatalog.list.useQuery({
    category: "ADDON",
    isActive: true,
  });

  const updateItemsMutation = useMutationWithInvalidation(trpc.order.updateItems, {
    invalidate: [utils.order.getById],
  });
  const updateFeesMutation = useMutationWithInvalidation(trpc.order.updateFees, {
    invalidate: [utils.order.getById],
  });

  // preview ใช้สูตร A เดียวกับ server (order.updateItems คิด VAT จาก taxRate ของออเดอร์เสมอ)
  const { subtotalItems, subtotalFees, taxAmount, grandTotal: totalAmount } =
    calculateOrderSummary({
      itemSubtotals: items.map((item) => calculateFormItemSubtotal(item)),
      feeAmounts: fees.map((f) => f.amount),
      discount,
      taxRate: order.taxRate,
    });

  // กำไรขั้นต้นโดยประมาณ (ก้อน 2 ชิ้น 5b) — hook+บล็อกชุดเดียวกับหน้าเปิดงาน
  // revenue = ฐานก่อน VAT ที่ฟอร์มคำนวณแล้ว · role นอกการเงินโดน FORBIDDEN → null → ไม่ render
  const marginEstimate = useMarginEstimate(
    items,
    subtotalItems + subtotalFees - discount
  );

  // หยิบจากสต๊อก — logic รวมเดียวกับหน้าเปิดงาน (lib/order-form-stock)
  // pruneEmpty: false — รายการจาก DB ที่ "ดูว่าง" คือข้อมูลจริงที่บันทึกแล้ว ห้ามลบเงียบ
  const handleVariantsSelected = (selected: SelectedVariantItem[]) => {
    setItems((prev) => {
      const { items: merged, targetIdx } = mergeStockVariantsIntoItems(
        prev,
        selected,
        expandedItemIdx,
        { pruneEmpty: false }
      );
      setExpandedItemIdx(targetIdx);
      return merged;
    });
  };

  // เกณฑ์เดียวกับฟอร์มเปิดงาน — จับให้ครบก่อนยิง server
  function validateItems(): string[] {
    const errors: string[] = [];
    // รายการเปล่า (กดเพิ่มแล้วยังไม่กรอก) ไม่นับ/ไม่บันทึก — กันค้างรก + ไม่ต้องให้ผู้ใช้ลบเอง
    if (!items.some(itemHasContent)) {
      errors.push("ต้องมีรายการสินค้าอย่างน้อย 1 รายการ");
      return errors;
    }
    // ใช้ index จริงของ items (ไม่ใช่ index หลังกรอง) — เลขในข้อความตรงกับเลขการ์ดที่ผู้ใช้เห็น
    items.forEach((item, idx) => {
      if (!itemHasContent(item)) return; // ข้ามรายการเปล่า (ไม่ถูกบันทึกอยู่แล้ว)
      const itemErrors = validateOrderItem(item);
      if (itemErrors.products) errors.push(`รายการ ${idx + 1}: ${itemErrors.products}`);
      item.products.forEach((product, pIdx) => {
        const productErrors = validateOrderItemProduct(product);
        for (const msg of Object.values(productErrors)) {
          if (msg) errors.push(`รายการ ${idx + 1} สินค้า ${pIdx + 1}: ${msg}`);
        }
      });
    });
    if (discount < 0) errors.push("ส่วนลดติดลบไม่ได้");
    if (discount > subtotalItems + subtotalFees) {
      errors.push("ส่วนลดมากกว่ายอดรวม — ตรวจสอบยอดอีกครั้ง");
    }
    return errors;
  }

  async function handleSave() {
    const errors = validateItems();
    setFormErrors(errors);
    if (errors.length > 0) return;

    setSaving(true);
    try {
      await updateItemsMutation.mutateAsync({
        id: orderId,
        items: mapItemsToMutationInput(items.filter(itemHasContent)),
        discount,
      });
      // ค่าธรรมเนียมยิงเฉพาะเมื่อแก้จริง — ไม่ยิงเปล่าให้ audit log รก
      if (JSON.stringify(fees) !== initialFeesJson) {
        await updateFeesMutation.mutateAsync({
          id: orderId,
          fees: mapFeesToMutationInput(fees),
        });
      }
      onDone();
    } catch {
      // hook default onError โชว์ toast แล้ว — ค้างอยู่ในโหมดแก้ไขให้ผู้ใช้แก้ต่อ
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          {/* หัวการ์ด = ชื่อล้วน · ปุ่มยกเลิกอยู่แถบล่าง sticky (เลี่ยงปุ่มยกเลิกซ้ำ 2 จุด) */}
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4" />
            แก้ไขรายการสินค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* รายการสินค้า — ฟอร์มชุดเดียวกับหน้าเปิดงาน
              รายการเดียว = โหมด solo: ไม่มีชั้น "รายการ #1" ให้แบก โชว์ ลาย/สินค้า ตรงๆ */}
          {items.length === 1 ? (
            <OrderItemCard
              item={items[0]}
              itemIdx={0}
              canRemove={false}
              isExpanded
              solo
              onToggleExpand={() => {}}
              allItems={items}
              printCatalog={printCatalog}
              addonCatalog={addonCatalog}
              onUpdateItem={updateItem}
              onRemoveItem={() => {}}
              onAddPrint={addPrint}
              onRemovePrint={removePrint}
              onUpdatePrint={updatePrint}
              onAddAddon={addAddon}
              onRemoveAddon={removeAddon}
              onUpdateAddon={updateAddon}
              onOpenPicker={() => setPickerOpen(true)}
              // setter ตรง — eager updater ทำ multi-update ใน tick เดียวทับกันเอง
              onSetItems={setItems}
              showPrints={canAddPrints}
              showAddons={canAddPrints}
              compact
            />
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/70 dark:divide-slate-800 dark:border-slate-800/60">
              {items.map((item, itemIdx) => (
                <OrderItemCard
                  key={itemIdx}
                  item={item}
                  itemIdx={itemIdx}
                  canRemove={items.length > 1}
                  isExpanded={expandedItemIdx === itemIdx}
                  onToggleExpand={() =>
                    setExpandedItemIdx(expandedItemIdx === itemIdx ? null : itemIdx)
                  }
                  allItems={items}
                  printCatalog={printCatalog}
                  addonCatalog={addonCatalog}
                  onUpdateItem={updateItem}
                  onRemoveItem={(idx) => {
                    removeItem(idx);
                    if (expandedItemIdx === idx) setExpandedItemIdx(null);
                    else if (expandedItemIdx != null && expandedItemIdx > idx)
                      setExpandedItemIdx(expandedItemIdx - 1);
                  }}
                  onAddPrint={addPrint}
                  onRemovePrint={removePrint}
                  onUpdatePrint={updatePrint}
                  onAddAddon={addAddon}
                  onRemoveAddon={removeAddon}
                  onUpdateAddon={updateAddon}
                  onOpenPicker={() => setPickerOpen(true)}
                  onSetItems={setItems}
                  showPrints={canAddPrints}
                  showAddons={canAddPrints}
                  compact
                />
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              addItem();
              setExpandedItemIdx(items.length);
            }}
            className="w-full gap-1 text-slate-500"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มรายการงานอีกชุด (ลาย/เงื่อนไขต่างจากชุดแรก)
          </Button>

          {/* ค่าธรรมเนียม + ส่วนลด — พับไว้ ไม่รบกวนจนกว่าจะมีของ (redesign 2026-06-11)
              defaultOpen คิดจากข้อมูลตอน mount (initial state) — กางเองเมื่อออเดอร์มีของเดิม */}
          <CollapsibleSection
            title="ค่าธรรมเนียม & ส่วนลด"
            defaultOpen={initialFees.length > 0 || (order.discount || 0) > 0}
            summary={
              fees.length > 0 || discount > 0
                ? `${fees.length > 0 ? `${fees.length} รายการ` : ""}${
                    fees.length > 0 && discount > 0 ? " · " : ""
                  }${discount > 0 ? `ลด ${formatCurrency(discount)}` : ""}`
                : "ไม่มี — เติมได้ถ้าต้องการ"
            }
          >
            <div className="space-y-3">
              <div className="space-y-2">
                {fees.map((fee, fi) => (
                  <div
                    key={fi}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                  >
                    <Input
                      type="text"
                      value={fee.feeType}
                      onChange={(e) => updateFee(fi, "feeType", e.target.value)}
                      placeholder="ประเภท"
                      className="h-8 w-28"
                    />
                    <Input
                      type="text"
                      value={fee.name}
                      onChange={(e) => updateFee(fi, "name", e.target.value)}
                      placeholder="ชื่อ"
                      className="h-8 flex-1"
                    />
                    <Input
                      type="number"
                      value={fee.amount || ""}
                      onChange={(e) => updateFee(fi, "amount", parseFloat(e.target.value) || 0)}
                      placeholder="จำนวน"
                      className="h-8 w-28"
                      min="0"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => removeFee(fi)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addFee} className="w-full gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  เพิ่มค่าธรรมเนียม
                </Button>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <label className="text-sm text-slate-500">ส่วนลด</label>
                <Input
                  type="number"
                  value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="h-8 w-32"
                  min="0"
                />
                <span className="text-sm text-slate-400">บาท</span>
              </div>
            </div>
          </CollapsibleSection>

          {/* Validation errors — เกณฑ์เดียวกับหน้าเปิดงาน จับก่อนถึง server */}
          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              <ul className="list-inside list-disc space-y-0.5">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* สรุปราคา (สูตร A เดียวกับ server) — โชว์เมื่อเริ่มมีตัวเลขจริง ไม่โชว์ ฿0 เปล่าๆ */}
          {(subtotalItems > 0 || subtotalFees > 0 || discount > 0) && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">รวมสินค้า</span>
              <span className="font-medium">{formatCurrency(subtotalItems)}</span>
            </div>
            {subtotalFees > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">ค่าธรรมเนียม</span>
                <span className="font-medium">{formatCurrency(subtotalFees)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">ส่วนลด</span>
                <span className="font-medium text-red-500">-{formatCurrency(discount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  VAT ({order.taxRate}%)
                </span>
                <span className="font-medium">{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-blue-200 pt-1 dark:border-blue-800">
              <span className="font-semibold text-slate-900 dark:text-white">ยอดรวม</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
          )}

          {/* กำไรขั้นต้นโดยประมาณ — เฉพาะ role การเงิน (null = ไม่ render เลย) */}
          {marginEstimate && (
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <MarginEstimateBlock estimate={marginEstimate} />
            </div>
          )}

          {/* ปุ่มบันทึก — sticky ล่างจอ มือถือกดถึงเสมอ */}
          <div className="sticky bottom-3 flex justify-end gap-2 rounded-xl border border-slate-200/70 bg-white/95 p-2.5 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={items.length === 0 || saving}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึกรายการ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* picker สต๊อก — popup เฉพาะตัวเลือกชั่วคราว (ฟอร์มหลักอยู่บนหน้าแล้ว) */}
      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectVariants={handleVariantsSelected}
      />
    </>
  );
}
