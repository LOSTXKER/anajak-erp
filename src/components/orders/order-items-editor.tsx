"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/number-input";
import { Section } from "@/components/ui/section";
import { formatCurrency } from "@/lib/utils";
import { calculateFormItemSubtotal, calculateOrderSummary } from "@/lib/pricing";
import { Loader2, Save } from "lucide-react";
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
import {
  OrderFeeSection,
  OrderFormActionBar,
  OrderCatalogAlert,
  OrderItemCard,
  OrderItemsListHeader,
  OrderPriceSummary,
} from "@/components/orders/new";
import { useMarginEstimate } from "@/components/orders/new/order-price-summary";
import {
  ProductPickerDialog,
  type SelectedVariantItem,
} from "@/components/product-picker";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { canIssueChangeOrder } from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  DISPLAY_AMOUNT,
  RADIUS,
  SUNK_PANEL,
  TINT,
} from "@/components/ui/tokens";

// ฟิลด์เงินเป็น number | null ตามชนิดจาก order.getById (นโยบาย ⑦ ปิดเงินให้ viewer นอกการเงิน)
// — editor เปิดได้เฉพาะ flow ฝั่งขาย (role เห็นเงิน) ค่าจริงเลยเป็นตัวเลขเสมอ · ?? 0 แค่ให้ TS ผ่าน
interface OrderItemsEditorOrder {
  items: Array<{
    description: string | null;
    notes: string | null;
    products: Array<Record<string, unknown> & {
      productId: string | null;
      productType: string;
      description: string;
      material: string | null;
      baseUnitPrice: number | null;
      discount: number | null;
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
      unitPrice: number | null;
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
      unitPrice: number | null;
    }>;
  }>;
  fees: Array<{ feeType: string; name: string; amount: number | null }>;
  discount: number | null;
  taxRate: number;
  totalAmount: number | null;
  // เพดานขาที่สอง (B9) จาก order.getById — ยอดออเดอร์ต่ำสุดที่ยังคุ้มบิลที่ออกแล้ว
  billedFloor?: number | null;
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
  const [reason, setReason] = useState("");
  // ออเดอร์อนุมัติแล้ว (DESIGN_APPROVED/PRODUCTION_QUEUE) → แก้ผ่าน "ใบแก้ไขออเดอร์"
  const changeOrderMode = canIssueChangeOrder(internalStatus as InternalStatus);

  const utils = trpc.useUtils();

  const printCatalogQuery = trpc.serviceCatalog.list.useQuery({
    category: "PRINT",
    isActive: true,
  });
  const addonCatalogQuery = trpc.serviceCatalog.list.useQuery({
    category: "ADDON",
    isActive: true,
  });
  const feeCatalogQuery = trpc.serviceCatalog.list.useQuery({
    category: "FEE",
    isActive: true,
  });
  const printCatalog = printCatalogQuery.data;
  const addonCatalog = addonCatalogQuery.data;
  const feeCatalog = feeCatalogQuery.data;
  // catalog พังแล้วเงียบ = ตัวเลือกลาย/ส่วนเสริม/ค่าใช้จ่ายหายเฉยๆ ผู้ใช้ไม่รู้ว่าระบบมีปัญหา
  const catalogError =
    printCatalogQuery.isError ||
    addonCatalogQuery.isError ||
    feeCatalogQuery.isError;

  const updateItemsMutation = useMutationWithInvalidation(trpc.order.updateItems, {
    invalidate: [utils.order.getById],
  });
  const applyChangeOrderMutation = useMutationWithInvalidation(
    trpc.order.applyChangeOrder,
    { invalidate: [utils.order.getById, utils.order.changeOrders] }
  );

  // preview ใช้สูตร A เดียวกับ server (order.updateItems คิด VAT จาก taxRate ของออเดอร์เสมอ)
  const pricingSummary = calculateOrderSummary({
    itemSubtotals: items.map((item) => calculateFormItemSubtotal(item)),
    feeAmounts: fees.map((f) => f.amount),
    discount,
    taxRate: order.taxRate,
  });
  const { subtotalItems, subtotalFees, grandTotal: totalAmount } = pricingSummary;
  const hasItemContent = items.some(itemHasContent);

  // กำไรขั้นต้นโดยประมาณ (ก้อน 2 ชิ้น 5b) — hook+บล็อกชุดเดียวกับหน้าเปิดงาน
  // revenue = ฐานก่อน VAT ที่ฟอร์มคำนวณแล้ว · role นอกการเงินโดน FORBIDDEN → null → ไม่ render
  const marginEstimate = useMarginEstimate(
    items,
    subtotalItems + subtotalFees - discount
  );

  // เพดานขาที่สอง (B9): ยอดใหม่ต่ำกว่าบิลที่ออกแล้ว — โหมดแก้ตรง server จะปฏิเสธ
  // เฉพาะเมื่อ "ลดจากยอดเดิม" ด้วย (ออเดอร์เก่าที่บิลเกินยอดอยู่แล้ว ขยับเข้าหา floor ได้)
  // — เงื่อนไขเตือนต้อง mirror server ทั้งสองขา ไม่งั้นป้ายบอกผลตรงข้ามกับที่เกิดจริง ·
  // โหมดใบแก้ไข (CO) server ไม่ block แต่บิลจะเกินยอดใหม่ → ต้องออกใบลดหนี้ตาม
  const orderBilledFloor = order.billedFloor ?? 0;
  const belowFloor = orderBilledFloor > 0 && totalAmount < orderBilledFloor - 0.005;
  const belowBilledFloor = changeOrderMode
    ? belowFloor
    : belowFloor && totalAmount < (order.totalAmount ?? 0) - 0.005;

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
    if (changeOrderMode && !reason.trim()) {
      errors.push("กรุณาระบุเหตุผลการแก้ไข (ใบแก้ไขออเดอร์)");
    }
    setFormErrors(errors);
    if (errors.length > 0) return;

    setSaving(true);
    try {
      if (changeOrderMode) {
        // อนุมัติแล้ว — แก้ items+fees+discount ผ่านใบแก้ไขออเดอร์ใบเดียว (server ออกเลข CO)
        const result = await applyChangeOrderMutation.mutateAsync({
          id: orderId,
          items: mapItemsToMutationInput(items.filter(itemHasContent)),
          fees: mapFeesToMutationInput(fees),
          discount,
          reason: reason.trim(),
        });
        if (result.invoicedWarning) {
          toast.warning(
            "ออเดอร์นี้ออกใบกำกับ/มัดจำไปแล้ว — ยอดเปลี่ยน ต้องออกใบลดหนี้/เพิ่มหนี้แยก"
          );
        }
      } else {
        // fees เปลี่ยน → แนบไปกับ updateItems ให้แทนทั้งชุดใน tx เดียว (atomic) —
        // ยิงแยกสอง mutation เคยทำด่านเพดาน B9 ตัดสินจากยอดกลางทาง (items ใหม่+fees เก่า)
        // แล้วบันทึกค้างครึ่งเดียวเมื่อใบหลังโดน block · ไม่เปลี่ยน = ไม่แนบ (audit ไม่รก)
        const feesChanged = JSON.stringify(fees) !== initialFeesJson;
        await updateItemsMutation.mutateAsync({
          id: orderId,
          items: mapItemsToMutationInput(items.filter(itemHasContent)),
          discount,
          ...(feesChanged ? { fees: mapFeesToMutationInput(fees) } : {}),
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
      <div className="w-full space-y-6">
        <section aria-labelledby="edit-order-items-heading" className="space-y-4">
          <OrderItemsListHeader
            headingId="edit-order-items-heading"
            itemIdPrefix="edit-order-item"
            title="รายการงาน"
            count={items.length}
            onAdd={() => {
              addItem();
              setExpandedItemIdx(items.length);
            }}
          />

          <OrderCatalogAlert
            hasError={catalogError}
            onRetry={() => {
              if (printCatalogQuery.isError) void printCatalogQuery.refetch();
              if (addonCatalogQuery.isError) void addonCatalogQuery.refetch();
              if (feeCatalogQuery.isError) void feeCatalogQuery.refetch();
            }}
          />
          {changeOrderMode && (
            <Alert variant="warning">
              บันทึกครั้งนี้จะออกเป็นใบแก้ไขออเดอร์ — ระบบจะให้ระบุเหตุผลก่อนบันทึก
            </Alert>
          )}
          {/* รายการสินค้า — หนึ่งรายการต่อหนึ่ง card และใช้ฟอร์มชุดเดียวกับหน้าเปิดงาน */}
          <div role="list" className="space-y-4">
            {items.map((item, itemIdx) => (
              <OrderItemCard
                key={itemIdx}
                cardId={`edit-order-item-${itemIdx + 1}`}
                item={item}
                itemIdx={itemIdx}
                canRemove={items.length > 1}
                isExpanded
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
        </section>

        <Section title="ราคาและเงื่อนไข">
          <div className="space-y-6">
            <OrderFeeSection
              fees={fees}
              onAddFee={addFee}
              onRemoveFee={removeFee}
              onUpdateFee={updateFee as (idx: number, field: string, value: unknown) => void}
              feeCatalog={feeCatalog}
              embedded
            />

            <Section title="เงื่อนไขการขาย" bordered={false} headingLevel={3}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ส่วนลดท้ายบิล" id="order-items-discount">
                  <MoneyInput
                    id="order-items-discount"
                    value={discount}
                    onValueChange={setDiscount}
                  />
                </Field>
              </div>
            </Section>

            {/* Validation errors — เกณฑ์เดียวกับหน้าเปิดงาน จับก่อนถึง server */}
            {formErrors.length > 0 && (
              <Alert variant="error">
                <ul className="list-inside list-disc space-y-0.5">
                  {formErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* เพดานขาที่สอง (B9) — ยอดใหม่ต่ำกว่าบิลที่ออกแล้ว */}
            {belowBilledFloor && (
              <Alert variant="warning" className="text-xs font-medium">
                {changeOrderMode
                  ? `ยอดใหม่ ${formatCurrency(totalAmount)} ต่ำกว่ายอดบิลที่ออกแล้ว ${formatCurrency(orderBilledFloor)} — ออกใบแก้ไขได้ แต่ต้องออกใบลดหนี้ตามให้ยอดบิลตรงยอดจริง`
                  : `ยอดใหม่ ${formatCurrency(totalAmount)} ต่ำกว่ายอดบิลที่ออกแล้ว ${formatCurrency(orderBilledFloor)} — บันทึกไม่ผ่าน ต้องยกเลิกบิลเดิม (แล้วออกใหม่ตามยอดที่ถูก) ก่อนลดยอด`}
              </Alert>
            )}

            {/* โหมดใบแก้ไข — เหตุผลบังคับ (server ออกเลข CO + บันทึกยอดเก่า→ใหม่) */}
            {changeOrderMode && (
              <div className={cn(TINT.warning, "rounded-xl border p-3")}>
                <Field
                  label="เหตุผลการแก้ไข"
                  id="order-change-reason"
                  description="ออเดอร์อนุมัติแล้ว ระบบจะออกใบแก้ไขและบันทึกยอดเก่า → ใหม่"
                  required
                >
                  <Textarea
                    id="order-change-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="เช่น ลูกค้าเพิ่มจำนวน 20 ตัว"
                    rows={2}
                  />
                </Field>
              </div>
            )}

            <div className={cn(RADIUS.surface, SUNK_PANEL, "p-5")}>
              <OrderPriceSummary
                pricingSummary={{ ...pricingSummary, platformFee: 0 }}
                showFeeSections
                isMarketplace={false}
                channelLabel=""
                taxRate={order.taxRate}
                platformFee={0}
                discount={discount}
                marginEstimate={marginEstimate}
                embedded
              />
            </div>
          </div>
        </Section>

        <OrderFormActionBar
          data-order-editor-action-bar=""
          summary={
            hasItemContent ? (
              <>
                <p className="text-2xs text-muted">
                  ยอดรวมทั้งหมด{order.taxRate > 0 ? " (รวม VAT)" : ""}
                </p>
                <p className={cn("truncate", DISPLAY_AMOUNT)}>
                  {formatCurrency(totalAmount)}
                </p>
              </>
            ) : (
              <p className="text-xs leading-snug text-muted">
                ยังไม่ใส่รายการ/ราคา
              </p>
            )
          }
        >
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={items.length === 0 || saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save />
            )}
            {changeOrderMode ? "ออกใบแก้ไข" : "บันทึกรายการ"}
          </Button>
        </OrderFormActionBar>
      </div>

      {/* picker สต๊อก — popup เฉพาะตัวเลือกชั่วคราว (ฟอร์มหลักอยู่บนหน้าแล้ว) */}
      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectVariants={handleVariantsSelected}
      />
    </>
  );
}
