"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCurrency } from "@/lib/utils";
import { COLLAR_TYPES, SLEEVE_TYPES, BODY_FITS, GARMENT_CONDITIONS, PRICING_TYPE_LABELS } from "@/types/order-form";
import type { PricingType } from "@/types/order-form";
import {
  Package,
  ShoppingBag,
  Receipt,
  Palette,
  PlusCircle,
  Edit3,
  Check,
} from "lucide-react";

type OrderData = RouterOutput["order"]["getById"];
type OrderItem = OrderData["items"][number];
type OrderItemProduct = OrderItem["products"][number];
type OrderItemVariant = OrderItemProduct["variants"][number];
type OrderItemPrint = OrderItem["prints"][number];
type OrderItemAddon = OrderItem["addons"][number];
type OrderFee = OrderData["fees"][number];

// ============================================================
// Receive Tracking Inline Form (for CUSTOMER_PROVIDED items)
// ============================================================

function ReceiveTrackingInline({ product, onSuccess }: {
  product: { id: string; garmentCondition?: string | null; receivedInspected: boolean; receiveNote?: string | null };
  onSuccess: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [condition, setCondition] = useState(product.garmentCondition ?? "");
  const [inspected, setInspected] = useState(product.receivedInspected);
  const [note, setNote] = useState(product.receiveNote ?? "");

  const mutation = trpc.order.updateReceiveTracking.useMutation({
    onSuccess: () => { setEditing(false); onSuccess(); },
  });

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50/50 px-3 py-2 text-xs dark:border-yellow-900 dark:bg-yellow-950/20">
        <Package className="h-3.5 w-3.5 text-yellow-600" />
        <span className="font-medium text-yellow-700 dark:text-yellow-300">ตรวจรับของ:</span>
        {product.receivedInspected ? (
          <>
            <Badge variant="default" className="text-[10px]">ตรวจรับแล้ว</Badge>
            {product.garmentCondition && <span className="text-slate-500">สภาพ: {GARMENT_CONDITIONS[product.garmentCondition] ?? product.garmentCondition}</span>}
            {product.receiveNote && <span className="text-slate-500">({product.receiveNote})</span>}
          </>
        ) : (
          <span className="text-slate-400">ยังไม่ได้ตรวจรับ</span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="ml-auto h-6 gap-1 px-2 text-[10px] text-yellow-600 hover:text-yellow-800 dark:text-yellow-400">
          <Edit3 className="h-3 w-3" />{product.receivedInspected ? "แก้ไข" : "ตรวจรับ"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950/30">
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-3.5 w-3.5 text-yellow-600" />
        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">ตรวจรับของจากลูกค้า</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">สภาพเสื้อ</label>
          <NativeSelect value={condition} onChange={(e) => setCondition(e.target.value)} className="h-8 px-2 py-1 text-xs focus:ring-yellow-500">
            <option value="">-- เลือก --</option>
            {Object.entries(GARMENT_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={inspected} onChange={(e) => setInspected(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-yellow-600 focus:ring-yellow-500" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">ตรวจรับแล้ว</span>
          </label>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">หมายเหตุ</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เสื้อสภาพดี มีถุงครบ" className="h-8 text-xs" />
        </div>
        <div className="flex gap-1">
          <Button type="button" size="sm" onClick={() => mutation.mutate({ orderItemProductId: product.id, garmentCondition: condition || undefined, receivedInspected: inspected, receiveNote: note || undefined })} disabled={mutation.isPending} className="h-8 gap-1 bg-yellow-600 text-xs text-white hover:bg-yellow-700">
            <Check className="h-3 w-3" />{mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setCondition(product.garmentCondition ?? ""); setInspected(product.receivedInspected); setNote(product.receiveNote ?? ""); }} className="h-8 text-xs">
            ยกเลิก
          </Button>
        </div>
      </div>
      {mutation.isError && <p className="mt-1 text-xs text-red-500">{mutation.error.message}</p>}
    </div>
  );
}

// ============================================================
// Order Items Display
// ============================================================

interface OrderItemsDisplayProps {
  orderId: string;
  items: OrderItem[];
  fees: OrderFee[];
}

export function OrderItemsDisplay({ orderId, items, fees }: OrderItemsDisplayProps) {
  const utils = trpc.useUtils();

  return (
    <>
      {/* ITEMS SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            รายการสินค้า ({items?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {items?.map((item, itemIndex) => {
              const itemTotalQty = item.products?.reduce((s: number, p: OrderItemProduct) => s + (p.variants?.reduce((vs: number, v: OrderItemVariant) => vs + v.quantity, 0) ?? 0), 0) ?? 0;

              return (
                <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
                  {/* Item header */}
                  <div className="flex items-start justify-between border-b border-slate-100 p-4 dark:border-slate-800">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {itemIndex + 1}
                        </span>
                        <Badge variant="secondary">{item.products?.length ?? 0} สินค้า</Badge>
                        <Badge variant="outline">{itemTotalQty} ชิ้น</Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {item.description}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-slate-500">{item.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {item.subtotal != null && (
                        <p className="tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.subtotal)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    {/* Prints */}
                    {item.prints && item.prints.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <Palette className="h-3.5 w-3.5" />
                          งานพิมพ์
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">ตำแหน่ง</th>
                                <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">ประเภท</th>
                                <th className="pb-2 pr-4 text-right text-xs font-medium text-slate-500">สี</th>
                                <th className="pb-2 pr-4 text-right text-xs font-medium text-slate-500">ขนาด (ซม.)</th>
                                <th className="pb-2 text-right text-xs font-medium text-slate-500">ราคา/ชิ้น</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                              {item.prints.map((p) => (
                                <tr key={p.id}>
                                  <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{p.position || "-"}</td>
                                  <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{p.printType || "-"}</td>
                                  <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{p.colorCount ?? "-"}</td>
                                  <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                    {(p.width || p.height) ? `${p.width || 0} x ${p.height || 0}` : "-"}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-900 dark:text-white">{formatCurrency(p.unitPrice)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {item.prints.some((p) => p.designNote) && (
                            <div className="mt-2 space-y-1">
                              {item.prints.filter((p) => p.designNote).map((p) => (
                                <p key={p.id} className="text-xs text-slate-500">
                                  <span className="font-medium">{p.position}:</span> {p.designNote}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Products */}
                    {item.products && item.products.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <ShoppingBag className="h-3.5 w-3.5" />
                          สินค้า ({item.products.length})
                        </div>
                        <div className="space-y-3">
                          {item.products.map((prod, prodIdx) => {
                            const prodQty = prod.variants?.reduce((s: number, v: OrderItemVariant) => s + v.quantity, 0) ?? 0;
                            const netPrice = Math.max(0, (prod.baseUnitPrice ?? 0) - (prod.discount ?? 0));

                            return (
                              <div key={prod.id} className="rounded-md border border-slate-100 p-3 dark:border-slate-800">
                                {/* Product header */}
                                <div className="mb-2 flex items-start justify-between">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-medium text-slate-400">{prodIdx + 1}.</span>
                                      {prod.product?.imageUrl && (
                                        <img src={prod.product.imageUrl} alt="" className="h-8 w-8 rounded border object-cover" />
                                      )}
                                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                                        {prod.product?.name || prod.description || "สินค้า"}
                                      </span>
                                      {prod.product?.sku && (
                                        <span className="font-mono text-xs text-slate-400">{prod.product.sku}</span>
                                      )}
                                      {prod.itemSource && (
                                        <Badge variant={
                                          prod.itemSource === "FROM_STOCK" ? "default" :
                                          prod.itemSource === "CUSTOMER_PROVIDED" ? "warning" :
                                          prod.itemSource === "CUSTOM_MADE" ? "purple" : "default"
                                        }>
                                          {prod.itemSource === "FROM_STOCK" ? "จากสต็อก" :
                                           prod.itemSource === "CUSTOM_MADE" ? "ตัดเย็บใหม่" :
                                           prod.itemSource === "CUSTOMER_PROVIDED" ? "ลูกค้าส่งมา" :
                                           prod.itemSource}
                                        </Badge>
                                      )}
                                      {prod.productType && <Badge variant="secondary">{prod.productType}</Badge>}
                                      {prod.material && <Badge variant="outline">{prod.material}</Badge>}
                                    </div>
                                    {(prod.fabricType || prod.fabricWeight || prod.fabricColor) && (
                                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        {prod.fabricType && <span>ผ้า: {prod.fabricType}</span>}
                                        {prod.fabricWeight && <span>น้ำหนัก: {prod.fabricWeight}</span>}
                                        {prod.fabricColor && <span>สีผ้า: {prod.fabricColor}</span>}
                                      </div>
                                    )}
                                    {(prod.collarType || prod.sleeveType || prod.bodyFit) && (
                                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        {prod.collarType && <span>ทรงคอ: {COLLAR_TYPES[prod.collarType] ?? prod.collarType}</span>}
                                        {prod.sleeveType && <span>แขน: {SLEEVE_TYPES[prod.sleeveType] ?? prod.sleeveType}</span>}
                                        {prod.bodyFit && <span>ฟิต: {BODY_FITS[prod.bodyFit] ?? prod.bodyFit}</span>}
                                        {prod.patternNote && <span>หมายเหตุ: {prod.patternNote}</span>}
                                      </div>
                                    )}
                                    {prod.packagingOption && (
                                      <div className="text-xs text-slate-500">แพ็คเกจ: {prod.packagingOption.name}</div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500">
                                      {formatCurrency(prod.baseUnitPrice)}/ชิ้น
                                      {prod.discount > 0 && <span className="ml-1 text-red-500">(-{formatCurrency(prod.discount)})</span>}
                                    </p>
                                    <p className="tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
                                      {formatCurrency(prodQty * netPrice)}
                                    </p>
                                  </div>
                                </div>

                                {/* Receive tracking for CUSTOMER_PROVIDED */}
                                {prod.itemSource === "CUSTOMER_PROVIDED" && (
                                  <div className="mb-2">
                                    <ReceiveTrackingInline
                                      product={{ id: prod.id, garmentCondition: prod.garmentCondition, receivedInspected: prod.receivedInspected, receiveNote: prod.receiveNote }}
                                      onSuccess={() => utils.order.getById.invalidate({ id: orderId })}
                                    />
                                  </div>
                                )}

                                {/* Variants table */}
                                {prod.variants && prod.variants.length > 0 && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                          <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">สี</th>
                                          <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">ไซส์</th>
                                          <th className="pb-2 text-right text-xs font-medium text-slate-500">จำนวน</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {prod.variants.map((v) => (
                                          <tr key={v.id}>
                                            <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{v.color || "-"}</td>
                                            <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{v.size || "-"}</td>
                                            <td className="py-1.5 text-right tabular-nums font-medium text-slate-900 dark:text-white">{v.quantity}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="border-t border-slate-100 dark:border-slate-800">
                                          <td colSpan={2} className="pt-1.5 text-xs font-medium text-slate-500">รวม</td>
                                          <td className="pt-1.5 text-right tabular-nums text-sm font-bold text-slate-900 dark:text-white">{prodQty}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Addons list */}
                    {item.addons && item.addons.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <PlusCircle className="h-3.5 w-3.5" />
                          ส่วนเสริม
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">ชื่อ</th>
                                <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">ประเภท</th>
                                <th className="pb-2 pr-4 text-left text-xs font-medium text-slate-500">คิดราคา</th>
                                <th className="pb-2 text-right text-xs font-medium text-slate-500">ราคา</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                              {item.addons.map((a) => (
                                <tr key={a.id}>
                                  <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{a.name || "-"}</td>
                                  <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{a.addonType || "-"}</td>
                                  <td className="py-1.5 pr-4">
                                    <Badge variant={a.pricingType === "PER_PIECE" ? "default" : "secondary"}>
                                      {PRICING_TYPE_LABELS[a.pricingType as PricingType] ?? a.pricingType}
                                    </Badge>
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-900 dark:text-white">{formatCurrency(a.unitPrice)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Item subtotal */}
                    {item.subtotal != null && (
                      <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="text-sm font-medium text-slate-500">ยอดรวมรายการ</span>
                        <span className="tabular-nums text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(item.subtotal)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* FEES SECTION */}
      {fees && fees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              ค่าธรรมเนียม / ค่าใช้จ่ายเพิ่มเติม
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fees.map((fee, i) => (
                  <div
                    key={fee.id ?? i}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2.5 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      {fee.feeType && (
                        <Badge variant="secondary">{fee.feeType}</Badge>
                      )}
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {fee.name || fee.feeType || "ค่าธรรมเนียม"}
                      </span>
                    </div>
                    <span className="tabular-nums text-sm font-medium text-slate-900 dark:text-white">
                      {formatCurrency(fee.amount)}
                    </span>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
