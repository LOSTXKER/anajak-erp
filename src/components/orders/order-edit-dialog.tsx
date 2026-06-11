"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { calculateFormItemSubtotal, calculateOrderSummary } from "@/lib/pricing";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { validateOrderItem, validateOrderItemProduct } from "@/types/order-form";
import {
  mapItemsToMutationInput,
  mapFeesToMutationInput,
  mapApiItemsToForm,
  mapApiFeesToForm,
} from "@/lib/order-mapping";
import { mergeStockVariantsIntoItems } from "@/lib/order-form-stock";
import { useOrderItemsForm, useOrderFeesForm } from "@/hooks/use-order-items-form";
// ฟอร์มรายการ "ชุดเดียวกับหน้าเปิดงาน" — เปิดงานเบาแล้วมาเติมทีหลังต้องได้ของเต็ม
// (multi-size/หยิบจากสต๊อก/ผ้า-แพทเทิร์น/ลายเต็ม) ไม่ใช่ฟอร์มย่อที่ drift กันเอง
import { OrderItemCard } from "@/components/orders/new";
import {
  ProductPickerDialog,
  type SelectedVariantItem,
} from "@/components/product-picker";

interface OrderEditDialogOrder {
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

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderType: string;
  internalStatus: string;
  order: OrderEditDialogOrder;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  orderId,
  orderType,
  internalStatus,
  order,
}: OrderEditDialogProps) {
  // ช่วง DRAFT/INQUIRY server ยัง re-derive ชนิดออเดอร์จากเนื้อรายการ — ออเดอร์ที่กลายเป็น
  // READY_MADE (เปิดเบา→เติมเสื้อเปล่า) ต้องเพิ่มลายได้ ไม่งั้นต้องยกเลิกเปิดใหม่ (audit ข้อ 3)
  const canAddPrints =
    orderType === "CUSTOM" || ["DRAFT", "INQUIRY"].includes(internalStatus);
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
    resetItems,
  } = useOrderItemsForm([]);

  const {
    fees,
    addFee,
    removeFee,
    updateFee,
    resetFees,
  } = useOrderFeesForm([]);

  const [discount, setDiscount] = useState(0);
  const [activeTab, setActiveTab] = useState<"items" | "fees">("items");
  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const utils = trpc.useUtils();

  // แค็ตตาล็อกลาย/ส่วนเสริม — โหลดเมื่อเปิด dialog เท่านั้น
  const { data: printCatalog } = trpc.serviceCatalog.list.useQuery(
    { category: "PRINT", isActive: true },
    { enabled: open }
  );
  const { data: addonCatalog } = trpc.serviceCatalog.list.useQuery(
    { category: "ADDON", isActive: true },
    { enabled: open }
  );

  const updateItemsMutation = useMutationWithInvalidation(trpc.order.updateItems, {
    invalidate: [utils.order.getById],
    onSuccess: () => onOpenChange(false),
  });

  const updateFeesMutation = useMutationWithInvalidation(trpc.order.updateFees, {
    invalidate: [utils.order.getById],
    onSuccess: () => onOpenChange(false),
  });

  useEffect(() => {
    if (open && order) {
      resetItems(mapApiItemsToForm(order.items));
      resetFees(mapApiFeesToForm(order.fees));
      setDiscount(order.discount || 0);
      setExpandedItemIdx(0);
      setFormErrors([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order]);

  // preview ใช้สูตร A เดียวกับ server (order.updateItems คิด VAT จาก taxRate ของออเดอร์เสมอ)
  const { subtotalItems, subtotalFees, taxAmount, grandTotal: totalAmount } = calculateOrderSummary({
    itemSubtotals: items.map((item) => calculateFormItemSubtotal(item)),
    feeAmounts: fees.map((f) => f.amount),
    discount,
    taxRate: order.taxRate,
  });

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

  // เกณฑ์เดียวกับฟอร์มเปิดงาน — จับให้ครบก่อนยิง server (จำนวน 0/ไม่มีไซส์/ไม่มีราคา ฯลฯ)
  function validateItems(): string[] {
    const errors: string[] = [];
    items.forEach((item, idx) => {
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

  function handleSaveItems() {
    const errors = validateItems();
    setFormErrors(errors);
    if (errors.length > 0) return;
    updateItemsMutation.mutate({
      id: orderId,
      items: mapItemsToMutationInput(items),
      discount,
    });
  }

  function handleSaveFees() {
    updateFeesMutation.mutate({
      id: orderId,
      fees: mapFeesToMutationInput(fees),
    });
  }

  const isPending = updateItemsMutation.isPending || updateFeesMutation.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>แก้ไขรายการออเดอร์</DialogTitle>
          <DialogDescription>
            แก้ไขรายการสินค้า ค่าธรรมเนียม และส่วนลด
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "items"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
            onClick={() => setActiveTab("items")}
          >
            รายการสินค้า ({items.length})
          </button>
          <button
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "fees"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
            onClick={() => setActiveTab("fees")}
          >
            ค่าธรรมเนียม ({fees.length})
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto pr-1">
          {activeTab === "items" ? (
            <div className="space-y-3">
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/60 px-3 dark:divide-slate-800 dark:border-slate-800/60">
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
                    // ส่ง setter ตรง — ห้าม updater(items) แบบ eager: หลาย update ใน tick เดียว
                    // (เช่นเลือกแพทเทิร์น set 4 field) จะอ่าน snapshot เก่าแล้วทับกันเหลือ field สุดท้าย
                    onSetItems={setItems}
                    showPrints={canAddPrints}
                    showAddons={canAddPrints}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  addItem();
                  setExpandedItemIdx(items.length);
                }}
                className="w-full gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                เพิ่มรายการ
              </Button>

              {/* Discount */}
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
          ) : (
            /* Fees tab */
            <div className="space-y-3">
              {fees.map((fee, fi) => (
                <div
                  key={fi}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
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
                    onChange={(e) =>
                      updateFee(fi, "amount", parseFloat(e.target.value) || 0)
                    }
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
              <Button
                variant="outline"
                size="sm"
                onClick={addFee}
                className="w-full gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                เพิ่มค่าธรรมเนียม
              </Button>
            </div>
          )}
        </div>

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

        {/* Price summary */}
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
              <span className="text-slate-600 dark:text-slate-400">VAT ({order.taxRate}%)</span>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          {activeTab === "items" ? (
            <Button
              onClick={handleSaveItems}
              disabled={items.length === 0 || isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึกรายการ
            </Button>
          ) : (
            <Button
              onClick={handleSaveFees}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึกค่าธรรมเนียม
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* picker สต๊อก — dialog ซ้อน (Radix portal แยกชั้นให้เอง) */}
    <ProductPickerDialog
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelectVariants={handleVariantsSelected}
    />
    </>
  );
}
