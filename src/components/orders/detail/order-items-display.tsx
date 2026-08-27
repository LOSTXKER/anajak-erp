"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, formatCurrency, isImageUrl } from "@/lib/utils";
import {
  COLLAR_TYPES,
  SLEEVE_TYPES,
  BODY_FITS,
  FABRIC_TYPES,
  GARMENT_CONDITIONS,
  PRICING_TYPE_LABELS,
  PRINT_POSITIONS,
  PRINT_TYPES,
  PRODUCT_TYPES,
} from "@/types/order-form";
import type { PricingType } from "@/types/order-form";
import { buildItemPriceLines, orderItemFormToPricingItem, sumOrderQuantity } from "@/lib/pricing";
import type { PriceLine } from "@/lib/pricing";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import {
  Package,
  ShoppingBag,
  Receipt,
  Palette,
  PlusCircle,
  Edit3,
  Check,
} from "lucide-react";
import { FOCUS_BUTTON, SUNK_PANEL, TABLE_HEAD_SURFACE, TINT } from "@/components/ui/tokens";
import { Alert } from "@/components/ui/alert";

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

function ReceiveTrackingInline({ product, onSuccess, readOnly }: {
  product: { id: string; garmentCondition?: string | null; receivedInspected: boolean; receiveNote?: string | null };
  onSuccess: () => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [condition, setCondition] = useState(product.garmentCondition ?? "");
  const [note, setNote] = useState(product.receiveNote ?? "");

  const mutation = trpc.order.updateReceiveTracking.useMutation({
    onSuccess: () => { setEditing(false); onSuccess(); },
  });

  if (!editing || readOnly) {
    return (
      <div className={cn(TINT.warning, "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs")}>
        <Package className="h-3.5 w-3.5 text-yellow-600" />
        <span className="font-medium text-yellow-700 dark:text-yellow-300">ตรวจรับของ:</span>
        {product.receivedInspected ? (
          <>
            <Badge variant="default">ตรวจรับแล้ว</Badge>
            {product.garmentCondition && <span className="text-muted">สภาพ: {GARMENT_CONDITIONS[product.garmentCondition] ?? product.garmentCondition}</span>}
            {product.receiveNote && <span className="text-muted">({product.receiveNote})</span>}
          </>
        ) : (
          <span className="text-muted">ยังไม่มีหลักฐานใบตรวจรับ</span>
        )}
        {!readOnly ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="ml-auto gap-1.5 text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300">
            <Edit3 />แก้สภาพ/หมายเหตุ
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Alert variant="warning">
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-3.5 w-3.5 text-yellow-600" />
        <div>
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">ข้อมูลสภาพเสื้อจากลูกค้า</p>
          <p className="text-xs text-muted">สถานะตรวจรับอ้างอิงจากใบตรวจรับและยอดนับจริงเท่านั้น</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`garment-condition-${product.id}`} className="mb-0.5 block text-xs font-medium text-muted">สภาพเสื้อ</label>
          <Select size="sm" id={`garment-condition-${product.id}`} value={condition} onChange={(e) => setCondition(e.target.value)} className={cn("px-2 py-1", FOCUS_BUTTON)}>
            <option value="">เลือก</option>
            {Object.entries(GARMENT_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label htmlFor={`garment-note-${product.id}`} className="mb-0.5 block text-xs font-medium text-muted">หมายเหตุ</label>
          <Input size="sm" id={`garment-note-${product.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เสื้อสภาพดี มีถุงครบ" />
        </div>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" onClick={() => mutation.mutate({ orderItemProductId: product.id, garmentCondition: condition || undefined, receiveNote: note || undefined })} disabled={mutation.isPending} className="h-8 gap-1.5 bg-yellow-700 text-white hover:bg-yellow-800">
            <Check />{mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setCondition(product.garmentCondition ?? ""); setNote(product.receiveNote ?? ""); }} className="h-8">
            ยกเลิก
          </Button>
        </div>
      </div>
      {mutation.isError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{mutation.error.message}</p>}
    </Alert>
  );
}

// ============================================================
// Order Items Display
// ============================================================

interface OrderItemsDisplayProps {
  orderId: string;
  items: OrderItem[];
  fees: OrderFee[];
  // ปุ่มแก้ไขบนหัวการ์ด — จุดแก้รายการต้องอยู่ที่รายการ ไม่ใช่ซ่อนในเมนู ⋯ อย่างเดียว
  onEditItems?: () => void;
  // นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นราคา — false = ตัดคอลัมน์/ช่องเงินออก (ห้ามโชว์ ฿0)
  // จำนวน/ไซส์/รายละเอียดงานยังเห็นครบ (ต้องใช้ทำงาน)
  showMoney?: boolean;
  // Production V2 ให้จุดเตรียมงานเป็นเจ้าของหลักฐานรับเสื้อ หน้า Order อ่านอย่างเดียว
  canEditReceiveTracking?: boolean;
}

/** หัวข้อย่อยในรายการ (สินค้า/งานพิมพ์/ส่วนเสริม/สรุปราคา) — เขียนซ้ำ 4 ที่ */
const GROUP_HEADING =
  "mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted";

/**
 * ป้ายไทยของแต่ละบรรทัดใน "สรุปราคา"
 *
 * buildItemPriceLines คืนแค่ตัวเลข + ตำแหน่งใน array (ตัวมันไม่รู้จักภาษา) —
 * การแปลรหัส FRONT/DTF/T_SHIRT เป็นคำไทยจึงอยู่ฝั่งหน้าจอที่เดียวกับตารางอื่นในหน้านี้
 */
function priceLineText(item: OrderItem, line: PriceLine): { label: string; detail: string } {
  if (line.kind === "product") {
    const prod = item.products?.[line.index];
    // ไซส์ที่ไม่ซ้ำของสินค้าตัวนั้น — บอกได้ว่าบรรทัดนี้คือของกอง S/M/L กองไหน
    const sizes = [...new Set((prod?.variants ?? []).map((v) => v.size).filter(Boolean))].join(" · ");
    return {
      label: prod?.product?.name || prod?.description || `สินค้า ${line.index + 1}`,
      detail: sizes,
    };
  }
  if (line.kind === "print") {
    const print = item.prints?.[line.index];
    if (!print) return { label: "งานพิมพ์", detail: "" };
    return {
      label: PRINT_TYPES[print.printType] ?? print.printType,
      detail: PRINT_POSITIONS[print.position] ?? print.position,
    };
  }
  const addon = item.addons?.[line.index];
  if (!addon) return { label: "ส่วนเสริม", detail: "" };
  return {
    label: addon.name || "ส่วนเสริม",
    detail: PRICING_TYPE_LABELS[addon.pricingType as PricingType] ?? addon.pricingType,
  };
}

export function OrderItemsDisplay({
  orderId,
  items,
  fees,
  onEditItems,
  showMoney = true,
  canEditReceiveTracking = false,
}: OrderItemsDisplayProps) {
  const utils = trpc.useUtils();
  const isEmpty = !items || items.length === 0;
  // รายการเดียว = ยุบกล่องชั้นนอกทิ้ง หัวการ์ดพูดครบในบรรทัดเดียวแล้วเข้าเนื้อเลย
  // (ของเดิมซ้อน 5 ชั้นและพูดเลข "1" ซ้ำ 4 ที่ ทั้งที่มีรายการเดียว)
  const isSingleItem = (items?.length ?? 0) === 1;
  const orderTotalQty = sumOrderQuantity(items);
  const singleSubtotal = isSingleItem ? items[0]?.subtotal ?? null : null;

  return (
    <>
      {/* ITEMS SECTION */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
              <Package className="h-4 w-4 flex-shrink-0" />
              <span className="[overflow-wrap:anywhere]">
                รายการสินค้า
                {!isSingleItem && !isEmpty ? ` (${items.length})` : ""}
                {orderTotalQty > 0 ? ` · ${orderTotalQty} ชิ้น` : ""}
              </span>
              {showMoney && singleSubtotal != null && (
                <span className="tabular-nums">· {formatCurrency(singleSubtotal)}</span>
              )}
            </CardTitle>
            {onEditItems && !isEmpty && (
              <Button variant="outline" size="sm" onClick={onEditItems} className="flex-shrink-0 gap-1.5">
                <Edit3 />
                แก้ไข
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEmpty && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted">
                ยังไม่มีรายการสินค้า/ราคา — ใส่ก่อนถึงจะยืนยันออเดอร์ได้
              </p>
              {onEditItems && (
                <Button onClick={onEditItems} className="gap-1.5">
                  <PlusCircle />
                  ใส่รายการสินค้า
                </Button>
              )}
            </div>
          )}
          <div className={isSingleItem ? undefined : "space-y-6"}>
            {items?.map((item, itemIndex) => {
              const itemTotalQty = item.products?.reduce((s: number, p: OrderItemProduct) => s + (p.variants?.reduce((vs: number, v: OrderItemVariant) => vs + v.quantity, 0) ?? 0), 0) ?? 0;

              // แจกแจงยอดด้วย helper กลางตัวเดียวกับหน้าเปิดงานใหม่ — ห้ามคำนวณเองใน JSX
              // (สูตรอยู่ที่เดียว ผลรวมทุกบรรทัดจึงเท่า item.subtotal ที่ server คิดเสมอ)
              const pricingItem = {
                ...orderItemFormToPricingItem({
                  products: (item.products ?? []).map((p: OrderItemProduct) => ({
                    baseUnitPrice: p.baseUnitPrice ?? 0,
                    discount: p.discount ?? 0,
                    variants: (p.variants ?? []).map((v: OrderItemVariant) => ({ quantity: v.quantity })),
                  })),
                  prints: (item.prints ?? []).map((p: OrderItemPrint) => ({ unitPrice: p.unitPrice ?? 0 })),
                  addons: (item.addons ?? []).map((a: OrderItemAddon) => ({ pricingType: a.pricingType, unitPrice: a.unitPrice ?? 0 })),
                }),
                // ตัวแปลงฟอร์มไม่รู้จัก quantity ที่ล็อกไว้ราย addon (ฟอร์มไม่มีช่องนี้ แต่ฐานข้อมูลมี)
                // ถ้าไม่ใส่คืน ยอดส่วนเสริมจะเพี้ยนจากที่ server เก็บเงินจริง
                addons: (item.addons ?? []).map((a: OrderItemAddon) => ({
                  pricingType: a.pricingType,
                  unitPrice: a.unitPrice ?? 0,
                  quantity: a.quantity,
                })),
              };
              const priceLines = buildItemPriceLines(pricingItem);

              // คอลัมน์ที่ "ทั้งตารางไม่มีค่าสักแถว" = ตัดทิ้ง ไม่ใช่ซ่อน — ค่ามันไม่มีอยู่จริง
              const printsHavePosition = item.prints?.some((p: OrderItemPrint) => p.position) ?? false;
              const printsHaveType = item.prints?.some((p: OrderItemPrint) => p.printType) ?? false;
              const printsHaveColorCount = item.prints?.some((p: OrderItemPrint) => p.colorCount != null) ?? false;
              const printsHaveSize = item.prints?.some((p: OrderItemPrint) => p.width || p.height) ?? false;

              const body = (
                <div className={cn("space-y-4", !isSingleItem && "p-4")}>
                  {/* Products — ต้องรู้ก่อนว่าเสื้ออะไรกี่ตัว แล้วค่อยรู้ว่าพิมพ์อะไรลงไป */}
                  {item.products && item.products.length > 0 && (
                    <div>
                      <div className={GROUP_HEADING}>
                        <ShoppingBag className="h-3.5 w-3.5" />
                        สินค้า{item.products.length > 1 ? ` (${item.products.length})` : ""}
                      </div>
                      <div className="divide-y divide-divider">
                        {item.products.map((prod, prodIdx) => {
                          const prodQty = prod.variants?.reduce((s: number, v: OrderItemVariant) => s + v.quantity, 0) ?? 0;
                          const netPrice = Math.max(0, (prod.baseUnitPrice ?? 0) - (prod.discount ?? 0));
                          const source = prod.itemSource ? getProductSourcePresentation(prod.itemSource) : null;
                          // ไซส์เป็นฟิลด์บังคับ ส่วนสีไม่ใช่ — ตารางไหนไม่มีค่าเลยก็ไม่ต้องมีคอลัมน์
                          const variantsHaveColor = prod.variants?.some((v: OrderItemVariant) => v.color) ?? false;
                          const variantsHaveSize = prod.variants?.some((v: OrderItemVariant) => v.size) ?? false;
                          const variantLeadCols = (variantsHaveColor ? 1 : 0) + (variantsHaveSize ? 1 : 0);

                          return (
                            <div key={prod.id} className="py-3 first:pt-0 last:pb-0">
                              {/* Product header */}
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {item.products.length > 1 && (
                                      <span className="text-xs font-medium text-muted">{prodIdx + 1}.</span>
                                    )}
                                    {prod.product?.imageUrl && (
                                      <img src={prod.product.imageUrl} alt="" className="h-8 w-8 rounded border object-cover" />
                                    )}
                                    <span className="text-sm font-medium text-strong [overflow-wrap:anywhere]">
                                      {prod.product?.name || prod.description || "สินค้า"}
                                    </span>
                                    {prod.product?.sku && (
                                      <span className="font-mono text-xs text-muted">{prod.product.sku}</span>
                                    )}
                                    {source && <Badge variant={source.variant}>{source.label}</Badge>}
                                    {prod.productType && (
                                      <Badge variant="secondary">{PRODUCT_TYPES[prod.productType] ?? prod.productType}</Badge>
                                    )}
                                    {prod.material && <Badge variant="outline">{prod.material}</Badge>}
                                  </div>
                                  {(prod.fabricType || prod.fabricWeight || prod.fabricColor) && (
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                      {prod.fabricType && <span>ผ้า: {FABRIC_TYPES[prod.fabricType] ?? prod.fabricType}</span>}
                                      {prod.fabricWeight && <span>น้ำหนัก: {prod.fabricWeight}</span>}
                                      {prod.fabricColor && <span>สีผ้า: {prod.fabricColor}</span>}
                                    </div>
                                  )}
                                  {(prod.collarType || prod.sleeveType || prod.bodyFit) && (
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                      {prod.collarType && <span>ทรงคอ: {COLLAR_TYPES[prod.collarType] ?? prod.collarType}</span>}
                                      {prod.sleeveType && <span>แขน: {SLEEVE_TYPES[prod.sleeveType] ?? prod.sleeveType}</span>}
                                      {prod.bodyFit && <span>ฟิต: {BODY_FITS[prod.bodyFit] ?? prod.bodyFit}</span>}
                                      {prod.patternNote && <span>หมายเหตุ: {prod.patternNote}</span>}
                                    </div>
                                  )}
                                  {prod.packagingOption && (
                                    <div className="text-xs text-muted">แพ็คเกจ: {prod.packagingOption.name}</div>
                                  )}
                                </div>
                                {showMoney && (
                                  <div className="flex-shrink-0 text-right">
                                    <p className="text-xs text-muted">
                                      {formatCurrency(prod.baseUnitPrice ?? 0)}/ชิ้น
                                      {(prod.discount ?? 0) > 0 && <span className="ml-1 text-red-500">(-{formatCurrency(prod.discount ?? 0)})</span>}
                                    </p>
                                    <p className="tabular-nums text-sm font-semibold text-strong">
                                      {formatCurrency(prodQty * netPrice)}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Receive tracking for CUSTOMER_PROVIDED */}
                              {prod.itemSource === "CUSTOMER_PROVIDED" && (
                                <div className="mb-2">
                                  <ReceiveTrackingInline
                                    product={{ id: prod.id, garmentCondition: prod.garmentCondition, receivedInspected: prod.receivedInspected, receiveNote: prod.receiveNote }}
                                    onSuccess={() => utils.order.getById.invalidate({ id: orderId })}
                                    readOnly={!canEditReceiveTracking}
                                  />
                                </div>
                              )}

                              {/* Variants table */}
                              {prod.variants && prod.variants.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className={TABLE_HEAD_SURFACE}>
                                      <tr>
                                        {variantsHaveColor && <th className="pb-2 pr-4 text-left text-xs font-medium">สี</th>}
                                        {variantsHaveSize && <th className="pb-2 pr-4 text-left text-xs font-medium">ไซส์</th>}
                                        <th className="pb-2 text-right text-xs font-medium">จำนวน</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                      {prod.variants.map((v) => (
                                        <tr key={v.id}>
                                          {variantsHaveColor && <td className="py-1.5 pr-4 text-secondary">{v.color || "-"}</td>}
                                          {variantsHaveSize && <td className="py-1.5 pr-4 text-secondary">{v.size || "-"}</td>}
                                          <td className="py-1.5 text-right tabular-nums font-medium text-strong">{v.quantity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      {/* ช่องคำว่า "รวม" ยืดตามจำนวนคอลัมน์ที่เหลืออยู่จริง —
                                          ถ้าไม่มีทั้งสี/ไซส์ ก็ไม่มีช่องให้ยืน ต้องพ่วงคำไปกับตัวเลขแทน */}
                                      <tr className="border-t border-divider">
                                        {variantLeadCols > 0 && (
                                          <td colSpan={variantLeadCols} className="pt-1.5 text-xs font-medium text-muted">รวม</td>
                                        )}
                                        <td className="pt-1.5 text-right tabular-nums text-sm font-semibold text-strong">
                                          {variantLeadCols > 0 ? prodQty : `รวม ${prodQty}`}
                                        </td>
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

                  {/* Prints */}
                  {item.prints && item.prints.length > 0 && (
                    <div>
                      <div className={GROUP_HEADING}>
                        <Palette className="h-3.5 w-3.5" />
                        งานพิมพ์
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={TABLE_HEAD_SURFACE}>
                            <tr>
                              <th className="pb-2 pr-4 text-left text-xs font-medium">แบบ</th>
                              {printsHavePosition && <th className="pb-2 pr-4 text-left text-xs font-medium">ตำแหน่ง</th>}
                              {printsHaveType && <th className="pb-2 pr-4 text-left text-xs font-medium">ประเภท</th>}
                              {printsHaveColorCount && <th className="pb-2 pr-4 text-right text-xs font-medium">สี</th>}
                              {printsHaveSize && <th className="pb-2 pr-4 text-right text-xs font-medium">ขนาด (ซม.)</th>}
                              {showMoney && (
                                <th className="pb-2 text-right text-xs font-medium">ราคา/ชิ้น</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {item.prints.map((p) => {
                              const positionLabel = p.position ? PRINT_POSITIONS[p.position] ?? p.position : "-";
                              return (
                                <tr key={p.id}>
                                  <td className="py-1.5 pr-4">
                                    {isImageUrl(p.designImageUrl) ? (
                                      <a
                                        href={p.designImageUrl!}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="เปิดภาพเต็ม"
                                        className={cn(
                                          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg",
                                          FOCUS_BUTTON,
                                        )}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={p.designImageUrl!}
                                          alt={`ลาย ${positionLabel}`}
                                          className="h-10 w-10 rounded border border-border object-contain"
                                        />
                                      </a>
                                    ) : p.designImageUrl ? (
                                      // มีไฟล์แต่ไม่ใช่รูป (เช่น .ai/.pdf) — ยังต้องกดเปิดได้ ไม่ใช่ขึ้นว่าไม่มีไฟล์
                                      <a
                                        href={p.designImageUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={cn(
                                          "inline-flex min-h-11 min-w-11 items-center rounded-lg text-xs text-blue-600 hover:underline dark:text-blue-400",
                                          FOCUS_BUTTON,
                                        )}
                                      >
                                        เปิดไฟล์แบบ
                                      </a>
                                    ) : (
                                      // เขียนเป็นคำ ไม่ใช้ขีด — ขีดหน้าตาเหมือนช่อง "ไม่ต้องกรอก" ทั้งที่นี่คือ "งานเดินต่อไม่ได้"
                                      <span className="text-xs text-muted">ยังไม่มีไฟล์แบบ</span>
                                    )}
                                  </td>
                                  {printsHavePosition && (
                                    <td className="py-1.5 pr-4 text-secondary">{positionLabel}</td>
                                  )}
                                  {printsHaveType && (
                                    <td className="py-1.5 pr-4 text-secondary">{p.printType ? PRINT_TYPES[p.printType] ?? p.printType : "-"}</td>
                                  )}
                                  {printsHaveColorCount && (
                                    <td className="py-1.5 pr-4 text-right tabular-nums text-secondary">{p.colorCount ?? "-"}</td>
                                  )}
                                  {printsHaveSize && (
                                    <td className="py-1.5 pr-4 text-right tabular-nums text-secondary">
                                      {(p.width || p.height) ? `${p.width || 0} x ${p.height || 0}` : "-"}
                                    </td>
                                  )}
                                  {showMoney && (
                                    <td className="py-1.5 text-right tabular-nums font-medium text-strong">{formatCurrency(p.unitPrice ?? 0)}</td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {item.prints.some((p) => p.designNote) && (
                          <div className="mt-2 space-y-1">
                            {item.prints.filter((p) => p.designNote).map((p) => (
                              <p key={p.id} className="text-xs text-muted [overflow-wrap:anywhere]">
                                <span className="font-medium">{PRINT_POSITIONS[p.position] ?? p.position}:</span> {p.designNote}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Addons list */}
                  {item.addons && item.addons.length > 0 && (
                    <div>
                      <div className={GROUP_HEADING}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        ส่วนเสริม
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={TABLE_HEAD_SURFACE}>
                            <tr>
                              <th className="pb-2 pr-4 text-left text-xs font-medium">ชื่อ</th>
                              <th className="pb-2 pr-4 text-left text-xs font-medium">คิดราคา</th>
                              {showMoney && (
                                <th className="pb-2 pr-4 text-right text-xs font-medium">ราคา/หน่วย</th>
                              )}
                              <th className="pb-2 pr-4 text-right text-xs font-medium">จำนวน</th>
                              {showMoney && (
                                <th className="pb-2 text-right text-xs font-medium">รวม</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {item.addons.map((a) => {
                              // ต่อชิ้น = ราคา × จำนวน (ล็อกจำนวนเองได้) · ต่อออเดอร์ = ก้อนเดียว
                              // สูตรเดียวกับที่ server เก็บเงินจริง — เดิมจอโชว์แค่ราคา/หน่วย จึงดูน้อยกว่าที่เก็บ
                              const addonQty = a.pricingType === "PER_PIECE" ? (a.quantity ?? itemTotalQty) : 1;
                              return (
                                <tr key={a.id}>
                                  <td className="py-1.5 pr-4 text-secondary [overflow-wrap:anywhere]">{a.name || "-"}</td>
                                  <td className="py-1.5 pr-4">
                                    <Badge variant={a.pricingType === "PER_PIECE" ? "default" : "secondary"}>
                                      {PRICING_TYPE_LABELS[a.pricingType as PricingType] ?? a.pricingType}
                                    </Badge>
                                  </td>
                                  {showMoney && (
                                    <td className="py-1.5 pr-4 text-right tabular-nums text-secondary">{formatCurrency(a.unitPrice ?? 0)}</td>
                                  )}
                                  <td className="py-1.5 pr-4 text-right tabular-nums text-secondary">{addonQty}</td>
                                  {showMoney && (
                                    <td className="py-1.5 text-right tabular-nums font-medium text-strong">{formatCurrency((a.unitPrice ?? 0) * addonQty)}</td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* สรุปราคา — ทุกบรรทัดบวกกันแล้วต้องเท่า item.subtotal ที่ server คิดมา */}
                  {showMoney && priceLines.length > 0 && (
                    <div className="border-t border-border/70 pt-3/60">
                      <div className={GROUP_HEADING}>
                        <Receipt className="h-3.5 w-3.5" />
                        สรุปราคา
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <tbody className="text-secondary">
                            {priceLines.map((line) => {
                              const { label, detail } = priceLineText(item, line);
                              return (
                                <tr key={`${line.kind}-${line.index}`}>
                                  <td className="py-1 pr-2 [overflow-wrap:anywhere]">
                                    <span className="text-secondary">{label}</span>
                                    {detail && <span className="ml-1 text-muted">({detail})</span>}
                                  </td>
                                  <td className="px-2 py-1 text-right tabular-nums text-muted">{formatCurrency(line.unitPrice)}</td>
                                  <td className="px-2 py-1 text-right tabular-nums text-muted">×{line.quantity}</td>
                                  <td className="py-1 text-right tabular-nums">{formatCurrency(line.total)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border/70/60">
                              <td colSpan={2} className="pt-2 text-sm font-semibold text-strong">
                                รวมทั้งหมด
                              </td>
                              <td className="px-2 pt-2 text-right text-xs tabular-nums text-muted">
                                {itemTotalQty} ตัว
                              </td>
                              <td className="pt-2 text-right text-sm font-semibold tabular-nums text-strong">
                                {formatCurrency(item.subtotal ?? 0)}
                              </td>
                            </tr>
                            {itemTotalQty > 0 && (
                              <tr>
                                <td colSpan={3} className="text-xs text-muted">
                                  เฉลี่ย {formatCurrency(Math.round(((item.subtotal ?? 0) / itemTotalQty) * 100) / 100)}/ตัว
                                </td>
                                <td aria-hidden="true" />
                              </tr>
                            )}
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );

              // รายการเดียว: ไม่มีกล่องชั้นนอก ไม่มีวงกลมเลข — เหลือแค่ชื่อ/หมายเหตุที่พิมพ์ไว้จริง
              if (isSingleItem) {
                return (
                  <div key={item.id} className="space-y-3">
                    {(item.description || item.notes) && (
                      <div className="space-y-0.5">
                        {item.description && (
                          <p className="text-sm font-medium text-secondary [overflow-wrap:anywhere]">{item.description}</p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-muted [overflow-wrap:anywhere]">{item.notes}</p>
                        )}
                      </div>
                    )}
                    {body}
                  </div>
                );
              }

              return (
                // กล่องย่อยแยกชั้นด้วยพื้นที่จมกว่าการ์ด ไม่ใช้เส้นขอบ (มาตรฐานหน้าตาปี 2026-08)
                <div key={item.id} className={cn("overflow-hidden rounded-lg", SUNK_PANEL)}>
                  {/* Item header — ชื่อนำ · จำนวนเป็นบรรทัดจาง (เลิก badge ซ้อน ลดความรก) */}
                  <div className="flex items-start justify-between gap-3 px-4 pt-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {itemIndex + 1}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-secondary [overflow-wrap:anywhere]">
                          {item.description || `รายการที่ ${itemIndex + 1}`}
                        </p>
                        <p className="text-xs text-muted">
                          {item.products?.length ?? 0} สินค้า · {itemTotalQty} ชิ้น
                        </p>
                        {item.notes && (
                          <p className="text-xs text-muted [overflow-wrap:anywhere]">{item.notes}</p>
                        )}
                      </div>
                    </div>
                    {showMoney && item.subtotal != null && (
                      <p className="flex-shrink-0 tabular-nums text-sm font-semibold text-strong">
                        {formatCurrency(item.subtotal)}
                      </p>
                    )}
                  </div>

                  {body}
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
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      {fee.feeType && (
                        <Badge variant="secondary">{fee.feeType}</Badge>
                      )}
                      <span className="text-sm text-secondary">
                        {fee.name || fee.feeType || "ค่าธรรมเนียม"}
                      </span>
                    </div>
                    {showMoney && (
                      <span className="tabular-nums text-sm font-medium text-strong">
                        {formatCurrency(fee.amount ?? 0)}
                      </span>
                    )}
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
