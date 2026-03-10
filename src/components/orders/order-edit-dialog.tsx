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
import { calculateTotalQuantity } from "@/lib/pricing";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Package,
} from "lucide-react";
import type { OrderItemForm, OrderFeeForm, OrderItemProductForm } from "@/types/order-form";
import { PRINT_POSITIONS, PRINT_TYPES, EMPTY_PRODUCT, deriveProcessingType } from "@/types/order-form";
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
          description: item.description || "",
          products: (item.products || []).flatMap((p: any) => {
            const base = {
              ...structuredClone(EMPTY_PRODUCT),
              productId: p.productId || undefined,
              productType: p.productType || "OTHER",
              description: p.description || "",
              material: p.material || "",
              baseUnitPrice: p.baseUnitPrice || 0,
              discount: p.discount || 0,
              packagingOptionId: p.packagingOptionId || "",
              itemSource: p.itemSource || "",
              fabricType: p.fabricType || "",
              fabricWeight: p.fabricWeight || "",
              fabricColor: p.fabricColor || "",
              processingType: p.processingType || "",
              patternId: p.patternId || undefined,
              patternMode: p.patternId ? "catalog" as const : "custom" as const,
              collarType: p.collarType || "",
              sleeveType: p.sleeveType || "",
              bodyFit: p.bodyFit || "",
              patternFileUrl: p.patternFileUrl || "",
              patternNote: p.patternNote || "",
              garmentCondition: p.garmentCondition || "",
              receivedInspected: p.receivedInspected ?? false,
              receiveNote: p.receiveNote || "",
              productName: p.product?.name,
              productSku: p.product?.sku,
              productImageUrl: p.product?.imageUrl,
            } as OrderItemProductForm;
            const variants = (p.variants || []) as any[];
            if (variants.length <= 1) {
              return [{ ...base, variants: variants.map((v: any) => ({ size: v.size, color: v.color || "", quantity: v.quantity })) }];
            }
            return variants.map((v: any) => ({
              ...structuredClone(base),
              variants: [{ size: v.size, color: v.color || "", quantity: v.quantity }],
            }));
          }),
          prints: (item.prints || []).map((pr: any) => ({
            position: pr.position,
            printType: pr.printType,
            colorCount: pr.colorCount || 0,
            unitPrice: pr.unitPrice,
            printSize: pr.printSize || "",
            width: pr.width || 0,
            height: pr.height || 0,
            designNote: pr.designNote || "",
            designImageUrl: pr.designImageUrl || undefined,
          })),
          addons: (item.addons || []).map((a: any) => ({
            addonType: a.addonType,
            name: a.name,
            pricingType: a.pricingType,
            unitPrice: a.unitPrice,
          })),
          notes: item.notes || "",
        } as OrderItemForm))
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
    const productsCost = item.products.reduce((pSum, p) => {
      const pQty = calculateTotalQuantity(p.variants);
      const net = Math.max(0, p.baseUnitPrice - (p.discount || 0));
      return pSum + pQty * net;
    }, 0);
    const itemTotalQty = item.products.reduce((s, p) => s + calculateTotalQuantity(p.variants), 0);
    const printsCost = itemTotalQty * item.prints.reduce((s, p) => s + p.unitPrice, 0);
    const addonsCost = item.addons.reduce((s, a) => {
      if (a.pricingType === "PER_PIECE") return s + itemTotalQty * a.unitPrice;
      return s + a.unitPrice;
    }, 0);
    return sum + productsCost + printsCost + addonsCost;
  }, 0);

  const subtotalFees = fees.reduce((sum, f) => sum + f.amount, 0);
  const totalAmount = Math.max(0, subtotalItems + subtotalFees - discount);

  function handleSaveItems() {
    updateItemsMutation.mutate({
      id: orderId,
      items: items.map((item) => ({
        description: item.description || undefined,
        notes: item.notes || undefined,
        products: item.products.map((p) => ({
          productId: p.productId,
          productType: p.productType,
          description: p.description,
          material: p.material || undefined,
          baseUnitPrice: p.baseUnitPrice,
          discount: p.discount || 0,
          packagingOptionId: p.packagingOptionId || undefined,
          itemSource: (p.itemSource || undefined) as "FROM_STOCK" | "CUSTOM_MADE" | "CUSTOMER_PROVIDED" | undefined,
          fabricType: p.fabricType || undefined,
          fabricWeight: p.fabricWeight || undefined,
          fabricColor: p.fabricColor || undefined,
          processingType: deriveProcessingType(p.itemSource, item.prints.length > 0) as "PRINT_ONLY" | "CUT_AND_SEW_PRINT" | "CUT_AND_SEW_ONLY" | "PACK_ONLY" | "FULL_PRODUCTION",
          variants: p.variants,
          patternId: p.patternId || undefined,
          collarType: p.collarType || undefined,
          sleeveType: p.sleeveType || undefined,
          bodyFit: p.bodyFit || undefined,
          patternFileUrl: p.patternFileUrl || undefined,
          patternNote: p.patternNote || undefined,
          garmentCondition: p.garmentCondition || undefined,
          receivedInspected: p.receivedInspected,
          receiveNote: p.receiveNote || undefined,
        })),
        prints: item.prints.map((pr) => ({
          position: pr.position,
          printType: pr.printType,
          colorCount: pr.colorCount || undefined,
          printSize: pr.printSize || undefined,
          width: pr.width || undefined,
          height: pr.height || undefined,
          designNote: pr.designNote || undefined,
          designImageUrl: pr.designImageUrl || undefined,
          unitPrice: pr.unitPrice,
        })),
        addons: item.addons.map((a) => ({
          addonType: a.addonType,
          name: a.name,
          pricingType: a.pricingType as "PER_PIECE" | "PER_ORDER",
          unitPrice: a.unitPrice,
        })),
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
                const itemTotalQty = item.products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + v.quantity, 0), 0);

                return (
                  <div key={itemIdx} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          รายการ {itemIdx + 1}
                        </span>
                        <Badge variant="secondary">{item.products.length} สินค้า · {itemTotalQty} ชิ้น</Badge>
                      </div>
                      {items.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItem(itemIdx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Description */}
                    <div className="mb-3">
                      <Input type="text" value={item.description} onChange={(e) => updateItem(itemIdx, "description", e.target.value)} placeholder="คำอธิบายงาน..." className="h-8" />
                    </div>

                    {/* Products (flat per-SKU rows) */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[11px] text-slate-400">
                            <th className="w-7 pb-1" />
                            <th className="pb-1 pr-1">สินค้า</th>
                            <th className="w-16 pb-1 px-1">สี</th>
                            <th className="w-14 pb-1 px-1">ไซส์</th>
                            <th className="w-20 pb-1 px-1">ราคา</th>
                            <th className="w-16 pb-1 px-1">จำนวน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.products.map((prod, prodIdx) => {
                            const v = prod.variants[0] || { size: "", color: "", quantity: 0 };
                            const updateProd = (field: string, value: unknown) => {
                              const newItems = [...items];
                              const prods = [...newItems[itemIdx].products];
                              prods[prodIdx] = { ...prods[prodIdx], [field]: value };
                              newItems[itemIdx] = { ...newItems[itemIdx], products: prods };
                              resetItems(newItems);
                            };
                            const updateVariant = (field: string, val: string | number) => {
                              const newItems = [...items];
                              const prods = [...newItems[itemIdx].products];
                              const vs = [...prods[prodIdx].variants];
                              vs[0] = { ...vs[0], [field]: val };
                              prods[prodIdx] = { ...prods[prodIdx], variants: vs };
                              newItems[itemIdx] = { ...newItems[itemIdx], products: prods };
                              resetItems(newItems);
                            };
                            return (
                              <tr key={prodIdx} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                <td className="py-1 align-middle">
                                  {item.products.length > 1 && (
                                    <button className="text-red-400 hover:text-red-500" onClick={() => {
                                      const newItems = [...items];
                                      newItems[itemIdx] = { ...newItems[itemIdx], products: newItems[itemIdx].products.filter((_, i) => i !== prodIdx) };
                                      resetItems(newItems);
                                    }}>
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </td>
                                <td className="py-1 pr-1 align-middle">
                                  {prod.productName ? (
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{prod.productName}</span>
                                  ) : (
                                    <Input value={prod.description} onChange={(e) => updateProd("description", e.target.value)} placeholder="คำอธิบาย" className="h-7 text-xs" />
                                  )}
                                </td>
                                <td className="px-1 py-1 align-middle">
                                  <Input value={v.color} onChange={(e) => updateVariant("color", e.target.value)} placeholder="สี" className="h-7 text-xs" />
                                </td>
                                <td className="px-1 py-1 align-middle">
                                  <Input value={v.size} onChange={(e) => updateVariant("size", e.target.value)} placeholder="ไซส์" className="h-7 text-xs" />
                                </td>
                                <td className="px-1 py-1 align-middle">
                                  <Input type="number" value={prod.baseUnitPrice || ""} onChange={(e) => updateProd("baseUnitPrice", parseFloat(e.target.value) || 0)} placeholder="0" className="h-7 text-xs" min="0" />
                                </td>
                                <td className="px-1 py-1 align-middle">
                                  <Input type="number" value={v.quantity || ""} onChange={(e) => updateVariant("quantity", parseInt(e.target.value) || 0)} placeholder="0" className="h-7 text-xs" min="0" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <button className="mb-2 mt-1 text-xs text-blue-500 hover:underline" onClick={() => {
                      const newItems = [...items];
                      newItems[itemIdx] = { ...newItems[itemIdx], products: [...newItems[itemIdx].products, structuredClone(EMPTY_PRODUCT)] };
                      resetItems(newItems);
                    }}>+ เพิ่มสินค้า</button>

                    {/* Prints */}
                    {orderType === "CUSTOM" && (
                      <div className="mb-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">สกรีน</span>
                          <button className="text-xs text-blue-500 hover:underline" onClick={() => addPrint(itemIdx)}>+ เพิ่ม</button>
                        </div>
                        {item.prints.map((p, pi) => (
                          <div key={pi} className="mb-1 flex items-center gap-2">
                            <Select value={p.position} onValueChange={(v) => updatePrint(itemIdx, pi, "position", v)}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(PRINT_POSITIONS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={p.printType} onValueChange={(v) => updatePrint(itemIdx, pi, "printType", v)}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(PRINT_TYPES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input type="number" value={p.unitPrice || ""} onChange={(e) => updatePrint(itemIdx, pi, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="ราคา/ตัว" className="h-7 w-24 px-2 text-xs" min="0" />
                            <button className="text-red-400 hover:text-red-500" onClick={() => removePrint(itemIdx, pi)}><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Addons */}
                    {orderType === "CUSTOM" && (
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">ส่วนเสริม</span>
                          <button className="text-xs text-blue-500 hover:underline" onClick={() => addAddon(itemIdx)}>+ เพิ่ม</button>
                        </div>
                        {item.addons.map((a, ai) => (
                          <div key={ai} className="mb-1 flex items-center gap-2">
                            <Input type="text" value={a.name} onChange={(e) => updateAddon(itemIdx, ai, "name", e.target.value)} placeholder="ชื่อ" className="h-7 w-28 px-2 text-xs" />
                            <Select value={a.pricingType} onValueChange={(v) => updateAddon(itemIdx, ai, "pricingType", v)}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="PER_PIECE">ต่อตัว</SelectItem><SelectItem value="PER_ORDER">ต่อออเดอร์</SelectItem></SelectContent>
                            </Select>
                            <Input type="number" value={a.unitPrice || ""} onChange={(e) => updateAddon(itemIdx, ai, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="ราคา" className="h-7 w-24 px-2 text-xs" min="0" />
                            <button className="text-red-400 hover:text-red-500" onClick={() => removeAddon(itemIdx, ai)}><Trash2 className="h-3 w-3" /></button>
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
