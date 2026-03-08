"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { calculateItemSubtotal, calculateTotalQuantity } from "@/lib/pricing";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Package,
} from "lucide-react";
import type { OrderItemForm, OrderFeeForm } from "@/types/order-form";
import { PRINT_POSITIONS, PRINT_TYPES, deriveProcessingType } from "@/types/order-form";
import { useOrderItemsForm, useOrderFeesForm } from "@/hooks/use-order-items-form";

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderType: string;
  order: any;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  orderId,
  orderType,
  order,
}: OrderEditDialogProps) {
  const {
    items,
    addItem,
    removeItem,
    updateItem,
    addVariant,
    removeVariant,
    updateVariant,
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

  const utils = trpc.useUtils();

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
      resetItems(
        order.items.map((item: any) => ({
          productType: item.productType,
          description: item.description,
          material: item.material || "",
          baseUnitPrice: item.baseUnitPrice,
          variants: item.variants.map((v: any) => ({
            size: v.size,
            color: v.color || "",
            quantity: v.quantity,
          })),
          prints: item.prints.map((p: any) => ({
            position: p.position,
            printType: p.printType,
            colorCount: p.colorCount || 0,
            unitPrice: p.unitPrice,
            printSize: p.printSize || "",
            width: p.width || 0,
            height: p.height || 0,
            designNote: p.designNote || "",
            designImageUrl: p.designImageUrl || undefined,
          })),
          addons: item.addons.map((a: any) => ({
            addonType: a.addonType,
            name: a.name,
            pricingType: a.pricingType,
            unitPrice: a.unitPrice,
          })),
          notes: item.notes || "",
          itemSource: item.itemSource === "ORDER_FROM_SUPPLIER" ? "FROM_STOCK" : (item.itemSource || ""),
          needsPrinting: (item.prints?.length ?? 0) > 0,
          fabricType: item.fabricType || "",
          fabricWeight: item.fabricWeight || "",
          fabricColor: item.fabricColor || "",
          processingType: item.processingType || "",
          patternId: item.patternId || undefined,
          patternMode: item.patternId ? "catalog" as const : "custom" as const,
          collarType: item.collarType || "",
          sleeveType: item.sleeveType || "",
          bodyFit: item.bodyFit || "",
          patternFileUrl: item.patternFileUrl || "",
          patternNote: item.patternNote || "",
          garmentCondition: item.garmentCondition || "",
          receivedInspected: item.receivedInspected ?? false,
          receiveNote: item.receiveNote || "",
        }))
      );
      resetFees(
        order.fees.map((f: any) => ({
          feeType: f.feeType,
          name: f.name,
          amount: f.amount,
        }))
      );
      setDiscount(order.discount || 0);
    }
  }, [open, order]);

  const subtotalItems = items.reduce((sum, item) => {
    const totalQty = item.variants.reduce((s, v) => s + v.quantity, 0);
    return sum + calculateItemSubtotal({
      baseUnitPrice: item.baseUnitPrice,
      totalQuantity: totalQty,
      prints: item.prints,
      addons: item.addons.map((a) => ({ ...a, quantity: undefined })),
    });
  }, 0);

  const subtotalFees = fees.reduce((sum, f) => sum + f.amount, 0);
  const totalAmount = Math.max(0, subtotalItems + subtotalFees - discount);

  function handleSaveItems() {
    updateItemsMutation.mutate({
      id: orderId,
      items: items.map((item) => ({
        productType: item.productType,
        description: item.description,
        material: item.material || undefined,
        baseUnitPrice: item.baseUnitPrice,
        itemSource: (item.itemSource || undefined) as "FROM_STOCK" | "CUSTOM_MADE" | "CUSTOMER_PROVIDED" | undefined,
        fabricType: item.fabricType || undefined,
        fabricWeight: item.fabricWeight || undefined,
        fabricColor: item.fabricColor || undefined,
        processingType: deriveProcessingType(item.itemSource, item.needsPrinting) as "PRINT_ONLY" | "CUT_AND_SEW_PRINT" | "CUT_AND_SEW_ONLY" | "PACK_ONLY" | "FULL_PRODUCTION",
        variants: item.variants,
        prints: item.prints.map((p) => ({
          position: p.position,
          printType: p.printType,
          colorCount: p.colorCount || undefined,
          printSize: p.printSize || undefined,
          width: p.width || undefined,
          height: p.height || undefined,
          designNote: p.designNote || undefined,
          designImageUrl: p.designImageUrl || undefined,
          unitPrice: p.unitPrice,
        })),
        addons: item.addons.map((a) => ({
          addonType: a.addonType,
          name: a.name,
          pricingType: a.pricingType as "PER_PIECE" | "PER_ORDER",
          unitPrice: a.unitPrice,
        })),
        notes: item.notes || undefined,
        patternId: item.patternId || undefined,
        collarType: item.collarType || undefined,
        sleeveType: item.sleeveType || undefined,
        bodyFit: item.bodyFit || undefined,
        patternFileUrl: item.patternFileUrl || undefined,
        patternNote: item.patternNote || undefined,
        garmentCondition: item.garmentCondition || undefined,
        receivedInspected: item.receivedInspected,
        receiveNote: item.receiveNote || undefined,
      })),
      discount,
    });
  }

  function handleSaveFees() {
    updateFeesMutation.mutate({
      id: orderId,
      fees: fees.map((f) => ({
        feeType: f.feeType,
        name: f.name,
        amount: f.amount,
      })),
    });
  }

  const isPending = updateItemsMutation.isPending || updateFeesMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-3xl">
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

        <div className="max-h-[50vh] overflow-y-auto">
          {activeTab === "items" ? (
            <div className="space-y-4">
              {items.map((item, itemIdx) => {
                const itemQty = item.variants.reduce((s, v) => s + v.quantity, 0);
                const itemSubtotal = calculateItemSubtotal({
                  baseUnitPrice: item.baseUnitPrice,
                  totalQuantity: itemQty,
                  prints: item.prints,
                  addons: item.addons.map((a) => ({ ...a, quantity: undefined })),
                });

                return (
                  <div
                    key={itemIdx}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          รายการ {itemIdx + 1}
                        </span>
                        <Badge variant="secondary">
                          {formatCurrency(itemSubtotal)}
                        </Badge>
                      </div>
                      {items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => removeItem(itemIdx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Item basics */}
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <Input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(itemIdx, "description", e.target.value)}
                        placeholder="รายละเอียด *"
                        className="col-span-2 h-8"
                      />
                      <Input
                        type="number"
                        value={item.baseUnitPrice || ""}
                        onChange={(e) =>
                          updateItem(itemIdx, "baseUnitPrice", parseFloat(e.target.value) || 0)
                        }
                        placeholder="ราคา/ตัว"
                        className="h-8"
                        min="0"
                      />
                    </div>

                    {/* Variants */}
                    <div className="mb-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">ไซส์/สี/จำนวน ({itemQty} ตัว)</span>
                        <button
                          className="text-xs text-blue-500 hover:underline"
                          onClick={() => addVariant(itemIdx)}
                        >
                          + เพิ่ม
                        </button>
                      </div>
                      <div className="space-y-1">
                        {item.variants.map((v, vi) => (
                          <div key={vi} className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={v.size}
                              onChange={(e) => updateVariant(itemIdx, vi, "size", e.target.value)}
                              placeholder="ไซส์"
                              className="h-7 w-20 px-2 text-xs"
                            />
                            <Input
                              type="text"
                              value={v.color}
                              onChange={(e) => updateVariant(itemIdx, vi, "color", e.target.value)}
                              placeholder="สี"
                              className="h-7 w-24 px-2 text-xs"
                            />
                            <Input
                              type="number"
                              value={v.quantity || ""}
                              onChange={(e) =>
                                updateVariant(itemIdx, vi, "quantity", parseInt(e.target.value) || 0)
                              }
                              placeholder="จำนวน"
                              className="h-7 w-20 px-2 text-xs"
                              min="1"
                            />
                            {item.variants.length > 1 && (
                              <button
                                className="text-red-400 hover:text-red-500"
                                onClick={() => removeVariant(itemIdx, vi)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Prints (CUSTOM orders) */}
                    {orderType === "CUSTOM" && (
                      <div className="mb-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">สกรีน</span>
                          <button
                            className="text-xs text-blue-500 hover:underline"
                            onClick={() => addPrint(itemIdx)}
                          >
                            + เพิ่ม
                          </button>
                        </div>
                        {item.prints.map((p, pi) => (
                          <div key={pi} className="flex items-center gap-2 mb-1">
                            <Select
                              value={p.position}
                              onValueChange={(v) => updatePrint(itemIdx, pi, "position", v)}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PRINT_POSITIONS).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={p.printType}
                              onValueChange={(v) => updatePrint(itemIdx, pi, "printType", v)}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PRINT_TYPES).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              value={p.unitPrice || ""}
                              onChange={(e) =>
                                updatePrint(itemIdx, pi, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              placeholder="ราคา/ตัว"
                              className="h-7 w-24 px-2 text-xs"
                              min="0"
                            />
                            <button
                              className="text-red-400 hover:text-red-500"
                              onClick={() => removePrint(itemIdx, pi)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Addons (CUSTOM orders) */}
                    {orderType === "CUSTOM" && (
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">ส่วนเสริม</span>
                          <button
                            className="text-xs text-blue-500 hover:underline"
                            onClick={() => addAddon(itemIdx)}
                          >
                            + เพิ่ม
                          </button>
                        </div>
                        {item.addons.map((a, ai) => (
                          <div key={ai} className="flex items-center gap-2 mb-1">
                            <Input
                              type="text"
                              value={a.name}
                              onChange={(e) => updateAddon(itemIdx, ai, "name", e.target.value)}
                              placeholder="ชื่อ"
                              className="h-7 w-28 px-2 text-xs"
                            />
                            <Select
                              value={a.pricingType}
                              onValueChange={(v) => updateAddon(itemIdx, ai, "pricingType", v)}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PER_PIECE">ต่อตัว</SelectItem>
                                <SelectItem value="PER_ORDER">ต่อออเดอร์</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              value={a.unitPrice || ""}
                              onChange={(e) =>
                                updateAddon(itemIdx, ai, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              placeholder="ราคา"
                              className="h-7 w-24 px-2 text-xs"
                              min="0"
                            />
                            <button
                              className="text-red-400 hover:text-red-500"
                              onClick={() => removeAddon(itemIdx, ai)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={addItem}
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
  );
}
