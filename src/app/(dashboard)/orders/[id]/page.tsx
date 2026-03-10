"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  INTERNAL_STATUS_COLORS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  ORDER_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PAYMENT_TERMS_LABELS,
  getFlowSteps,
  getNextStatuses,
} from "@/lib/order-status";
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  Package,
  ShoppingBag,
  Truck,
  Receipt,
  Tag,
  ChevronRight,
  XCircle,
  Check,
  Palette,
  PlusCircle,
  DollarSign,
  BarChart3,
  Store,
  Hash,
  Edit3,
  ImageIcon,
  AlertTriangle,
  Copy,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { COLLAR_TYPES, SLEEVE_TYPES, BODY_FITS, GARMENT_CONDITIONS } from "@/types/order-form";

// Section components
import { OrderDesignSection } from "@/components/orders/order-design-section";
import { OrderBillingSection } from "@/components/orders/order-billing-section";
import { OrderProductionSection } from "@/components/orders/order-production-section";
import { OrderDeliverySection } from "@/components/orders/order-delivery-section";
import { OrderEditDialog } from "@/components/orders/order-edit-dialog";
import { OrderInfoEditDialog } from "@/components/orders/order-info-edit-dialog";

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

  const selectClass = "flex h-8 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950/30">
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-3.5 w-3.5 text-yellow-600" />
        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">ตรวจรับของจากลูกค้า</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">สภาพเสื้อ</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={selectClass}>
            <option value="">-- เลือก --</option>
            {Object.entries(GARMENT_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
// Loading skeleton
// ============================================================

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main page component
// ============================================================

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInfoEditDialog, setShowInfoEditDialog] = useState(false);

  const { data: order, isLoading } = trpc.order.getById.useQuery({ id });
  const { data: attachments } = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: id });
  const utils = trpc.useUtils();

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      utils.order.getById.invalidate({ id });
      utils.order.list.invalidate();
    },
  });

  const duplicateOrder = trpc.order.duplicate.useMutation({
    onSuccess: (data) => {
      utils.order.list.invalidate();
      router.push(`/orders/${data.id}`);
    },
  });

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) return <OrderDetailSkeleton />;
  if (!order) return null;

  // ----------------------------------------------------------
  // Derived data
  // ----------------------------------------------------------
  const flowSteps = getFlowSteps(order.orderType);
  const nextStatuses = getNextStatuses(order.orderType, order.internalStatus);
  const forwardStatuses = nextStatuses.filter((s) => s !== "CANCELLED");
  const canCancel = nextStatuses.includes("CANCELLED");

  const currentStepIndex = flowSteps.indexOf(order.internalStatus);

  const isTerminal =
    order.internalStatus === "COMPLETED" || order.internalStatus === "CANCELLED";

  // Marketplace detection
  const isMarketplace = ["SHOPEE", "LAZADA", "TIKTOK"].includes(order.channel);

  // Cost tracking
  const totalCost =
    order.costEntries?.reduce(
      (sum: number, c: { amount: number }) => sum + c.amount,
      0,
    ) ?? 0;
  const hasCostEntries = order.costEntries && order.costEntries.length > 0;

  // Price breakdown
  const subtotalItems =
    order.items?.reduce(
      (sum: number, item: { subtotal: number }) => sum + (item.subtotal ?? 0),
      0,
    ) ?? 0;
  const subtotalFees =
    order.fees?.reduce(
      (sum: number, fee: { amount: number }) => sum + fee.amount,
      0,
    ) ?? 0;
  const discount = order.discount ?? 0;
  const totalAmount = order.totalAmount ?? subtotalItems + subtotalFees - discount;

  const profitMargin =
    hasCostEntries && totalAmount > 0
      ? ((totalAmount - totalCost) / totalAmount) * 100
      : null;

  // Can edit items (before production starts)
  const canEditItems = ![
    "PRODUCING", "QUALITY_CHECK", "PACKING", "READY_TO_SHIP",
    "SHIPPED", "COMPLETED", "CANCELLED",
  ].includes(order.internalStatus);

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------
  function handleStatusChange(newStatus: string) {
    if (newStatus === "CANCELLED") {
      const reason = prompt("เหตุผลที่ยกเลิก:");
      if (!reason) return;
      updateStatus.mutate({
        id,
        internalStatus: newStatus as never,
        reason,
      });
    } else {
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    }
  }

  // ----------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------
  const customerColor = CUSTOMER_STATUS_COLORS[order.customerStatus];
  const internalColor = INTERNAL_STATUS_COLORS[order.internalStatus];
  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  };

  return (
    <div className="space-y-6">
      {/* ====================================================
          HEADER
      ==================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {order.orderNumber}
              </h1>

              {/* Customer status - big badge with dot */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${customerColor.bg} ${customerColor.text}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${customerColor.dot}`}
                />
                {CUSTOMER_STATUS_LABELS[order.customerStatus]}
              </span>

              {/* Internal status - small badge */}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${internalColor.bg} ${internalColor.text}`}
              >
                {INTERNAL_STATUS_LABELS[order.internalStatus]}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Order type badge */}
              <Badge variant={order.orderType === "CUSTOM" ? "purple" : "default"}>
                {ORDER_TYPE_LABELS[order.orderType]}
              </Badge>

              {/* Channel badge */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${channelColor.bg} ${channelColor.text}`}
              >
                {CHANNEL_LABELS[order.channel] ?? order.channel}
              </span>

              {order.title && (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {order.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {!isTerminal && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInfoEditDialog(true)}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4" />
              แก้ไขข้อมูลออเดอร์
            </Button>

            {canEditItems && (
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(true)}
                className="gap-1.5"
              >
                <Edit3 className="h-4 w-4" />
                แก้ไข
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => duplicateOrder.mutate({ id })}
              disabled={duplicateOrder.isPending}
              className="gap-1.5"
            >
              <Copy className="h-4 w-4" />
              {duplicateOrder.isPending ? "กำลังสำเนา..." : "สำเนาออเดอร์"}
            </Button>

            {forwardStatuses.map((status) => (
              <Button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={updateStatus.isPending}
                className="gap-1.5"
              >
                <ChevronRight className="h-4 w-4" />
                {INTERNAL_STATUS_LABELS[status]}
              </Button>
            ))}

            {canCancel && (
              <Button
                variant="destructive"
                onClick={() => handleStatusChange("CANCELLED")}
                disabled={updateStatus.isPending}
                className="gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                ยกเลิก
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ====================================================
          STATUS PROGRESS BAR
      ==================================================== */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {flowSteps.map((step, i) => {
              const isPast = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              const isCancelled = order.internalStatus === "CANCELLED";

              return (
                <div key={step} className="flex items-center">
                  {/* Step circle */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isCancelled && isCurrent
                          ? "bg-red-500 text-white"
                          : isPast
                            ? "bg-green-500 text-white"
                            : isCurrent
                              ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950"
                              : "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                      }`}
                    >
                      {isPast ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isCancelled && isCurrent ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`max-w-[4.5rem] text-center text-[10px] leading-tight ${
                        isCurrent
                          ? "font-semibold text-blue-700 dark:text-blue-300"
                          : isPast
                            ? "font-medium text-green-700 dark:text-green-400"
                            : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {INTERNAL_STATUS_LABELS[step]}
                    </span>
                  </div>

                  {/* Connector line */}
                  {i < flowSteps.length - 1 && (
                    <div
                      className={`mx-1 mt-[-1.25rem] h-0.5 w-6 shrink-0 sm:w-8 ${
                        isPast
                          ? "bg-green-500"
                          : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ====================================================
          MAIN GRID: CONTENT + SIDEBAR
      ==================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ================================================
            LEFT: MAIN CONTENT (2/3)
        ================================================ */}
        <div className="space-y-6 lg:col-span-2">
          {/* ------------------------------------------
              ITEMS SECTION
          ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                รายการสินค้า ({order.items?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {order.items?.map((item: any, itemIndex: number) => {
                  const itemTotalQty = item.products?.reduce((s: number, p: any) => s + (p.variants?.reduce((vs: number, v: any) => vs + v.quantity, 0) ?? 0), 0) ?? 0;

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
                        {/* Prints (shown first - this is a screen printing factory) */}
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
                                  {item.prints.map((p: any) => (
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
                              {item.prints.some((p: any) => p.designNote) && (
                                <div className="mt-2 space-y-1">
                                  {item.prints.filter((p: any) => p.designNote).map((p: any) => (
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
                              {item.products.map((prod: any, prodIdx: number) => {
                                const prodQty = prod.variants?.reduce((s: number, v: any) => s + v.quantity, 0) ?? 0;
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
                                          onSuccess={() => utils.order.getById.invalidate({ id })}
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
                                            {prod.variants.map((v: any) => (
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
                                  {item.addons.map((a: any) => (
                                    <tr key={a.id}>
                                      <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{a.name || "-"}</td>
                                      <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{a.addonType || "-"}</td>
                                      <td className="py-1.5 pr-4">
                                        <Badge variant={a.pricingType === "PER_PIECE" ? "default" : "secondary"}>
                                          {a.pricingType === "PER_PIECE" ? "ต่อชิ้น" : "ต่อออเดอร์"}
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

          {/* ------------------------------------------
              FEES SECTION
          ------------------------------------------ */}
          {order.fees && order.fees.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4" />
                  ค่าธรรมเนียม / ค่าใช้จ่ายเพิ่มเติม
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {order.fees.map((fee: any, i: number) => (
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

          {/* ------------------------------------------
              REFERENCE IMAGES (from attachments)
          ------------------------------------------ */}
          {(() => {
            const refImages = attachments?.filter(a => a.category === "REFERENCE_IMAGE") ?? [];
            if (refImages.length === 0) return null;

            const POSITION_LABELS: Record<string, string> = {
              FRONT: "หน้า", BACK: "หลัง", SLEEVE_L: "แขนซ้าย", SLEEVE_R: "แขนขวา",
              COLLAR: "ปก", POCKET: "กระเป๋า", OTHER: "อื่นๆ",
            };

            // Group by position
            const generalImages = refImages.filter(a => !a.printPosition);
            const positionGroups = refImages.reduce<Record<string, typeof refImages>>((acc, a) => {
              if (a.printPosition) {
                if (!acc[a.printPosition]) acc[a.printPosition] = [];
                acc[a.printPosition].push(a);
              }
              return acc;
            }, {});

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ImageIcon className="h-4 w-4" />
                    ภาพอ้างอิง ({refImages.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* General images (no position) */}
                  {generalImages.length > 0 && (
                    <div>
                      {Object.keys(positionGroups).length > 0 && (
                        <p className="mb-2 text-xs font-medium text-slate-500">ทั่วไป</p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        {generalImages.map((att) => (
                          <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="group relative">
                            {att.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={att.fileUrl} alt={att.fileName} className="h-28 w-28 rounded-lg border border-slate-200 object-cover transition-shadow hover:shadow-md dark:border-slate-700" />
                            ) : (
                              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                                <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                <span className="mt-1 text-[10px] text-slate-400">{att.fileName.split(".").pop()?.toUpperCase()}</span>
                              </div>
                            )}
                            <p className="mt-1 max-w-[7rem] truncate text-[10px] text-slate-400">{att.fileName}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grouped by position */}
                  {Object.entries(positionGroups).map(([pos, imgs]) => (
                    <div key={pos}>
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        <Badge variant="secondary" className="text-[10px]">{POSITION_LABELS[pos] || pos}</Badge>
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {imgs.map((att) => (
                          <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="group relative">
                            {att.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={att.fileUrl} alt={att.fileName} className="h-28 w-28 rounded-lg border border-slate-200 object-cover transition-shadow hover:shadow-md dark:border-slate-700" />
                            ) : (
                              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                                <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                <span className="mt-1 text-[10px] text-slate-400">{att.fileName.split(".").pop()?.toUpperCase()}</span>
                              </div>
                            )}
                            <p className="mt-1 max-w-[7rem] truncate text-[10px] text-slate-400">{att.fileName}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {/* ------------------------------------------
              DESIGN SECTION (new)
          ------------------------------------------ */}
          <OrderDesignSection
            orderId={id}
            orderNumber={order.orderNumber}
            internalStatus={order.internalStatus}
          />

          {/* ------------------------------------------
              PRODUCTION SECTION (new)
          ------------------------------------------ */}
          <OrderProductionSection
            orderId={id}
            internalStatus={order.internalStatus}
          />

          {/* ------------------------------------------
              DELIVERY SECTION (new, replaces old read-only)
          ------------------------------------------ */}
          <OrderDeliverySection
            orderId={id}
            internalStatus={order.internalStatus}
            customerName={order.customer?.name}
            customerPhone={order.customer?.phone ?? undefined}
          />

          {/* ------------------------------------------
              REVISION HISTORY
          ------------------------------------------ */}
          {order.revisions && order.revisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  ประวัติการเปลี่ยนแปลง
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.revisions.map((rev: any) => (
                      <div
                        key={rev.id}
                        className="flex gap-3 border-l-2 border-slate-200 pl-4 dark:border-slate-700"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-slate-900 dark:text-white">
                            {rev.description}
                          </p>
                          <p className="text-xs text-slate-400">
                            {rev.changedBy} &mdash; {formatDateTime(rev.createdAt)}
                          </p>
                        </div>
                        {rev.changeType && (
                          <Badge variant="secondary">{rev.changeType}</Badge>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ================================================
            RIGHT: SIDEBAR (1/3)
        ================================================ */}
        <div className="space-y-6">
          {/* ------------------------------------------
              CUSTOMER INFO
          ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                ลูกค้า
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.customer && (
                <>
                  <Link
                    href={`/customers/${order.customer.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {order.customer.name}
                  </Link>
                  {order.customer.company && (
                    <p className="text-sm text-slate-500">{order.customer.company}</p>
                  )}
                  {order.customer.phone && (
                    <p className="text-sm text-slate-500">{order.customer.phone}</p>
                  )}
                  {order.customer.email && (
                    <p className="text-sm text-slate-500">{order.customer.email}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------
              ORDER INFO
          ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                ข้อมูลออเดอร์
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ประเภท</span>
                <Badge variant={order.orderType === "CUSTOM" ? "purple" : "default"}>
                  {ORDER_TYPE_LABELS[order.orderType]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ช่องทาง</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${channelColor.bg} ${channelColor.text}`}>
                  {CHANNEL_LABELS[order.channel] ?? order.channel}
                </span>
              </div>
              {order.createdBy && (
                <div className="flex justify-between">
                  <span className="text-slate-500">สร้างโดย</span>
                  <span className="text-slate-900 dark:text-white">
                    {typeof order.createdBy === "string" ? order.createdBy : order.createdBy.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">วันที่สร้าง</span>
                <span className="text-slate-900 dark:text-white">{formatDate(order.createdAt)}</span>
              </div>
              {order.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">แก้ไขล่าสุด</span>
                  <span className="text-slate-900 dark:text-white">{formatDateTime(order.updatedAt)}</span>
                </div>
              )}
              {order.deadline && (
                <div className="flex justify-between">
                  <span className="text-slate-500">กำหนดส่ง</span>
                  <span className="font-medium text-slate-900 dark:text-white">{formatDate(order.deadline)}</span>
                </div>
              )}
              {order.estimatedQuantity && (
                <div className="flex justify-between">
                  <span className="text-slate-500">จำนวนโดยประมาณ</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    ~{order.estimatedQuantity.toLocaleString()} ชิ้น
                  </span>
                </div>
              )}
              {order.priority && order.priority !== "NORMAL" && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ความเร่งด่วน</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[order.priority]?.bg ?? ""} ${PRIORITY_COLORS[order.priority]?.text ?? ""}`}>
                    {PRIORITY_LABELS[order.priority] ?? order.priority}
                  </span>
                </div>
              )}
              {order.paymentTerms && (
                <div className="flex justify-between">
                  <span className="text-slate-500">เงื่อนไขชำระ</span>
                  <span className="text-slate-900 dark:text-white">
                    {PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms}
                  </span>
                </div>
              )}
              {order.poNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">เลขที่ PO</span>
                  <span className="font-mono text-slate-900 dark:text-white">{order.poNumber}</span>
                </div>
              )}
              {order.description && (
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-slate-500">{order.description}</p>
                </div>
              )}
              {order.notes && (
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-1 text-xs text-slate-400">หมายเหตุ</p>
                  <p className="text-slate-500">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------
              SHIPPING ADDRESS (if set)
          ------------------------------------------ */}
          {order.shippingRecipientName && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4" />
                  ที่อยู่จัดส่ง
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium text-slate-900 dark:text-white">{order.shippingRecipientName}</p>
                {order.shippingPhone && <p className="text-slate-500">{order.shippingPhone}</p>}
                {order.shippingAddress && <p className="text-slate-500">{order.shippingAddress}</p>}
                <p className="text-slate-500">
                  {[order.shippingSubDistrict, order.shippingDistrict, order.shippingProvince, order.shippingPostalCode]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------
              MARKETPLACE INFO (if applicable)
          ------------------------------------------ */}
          {isMarketplace && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="h-4 w-4" />
                  ข้อมูล Marketplace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {order.externalOrderId && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Hash className="h-3.5 w-3.5" />
                      หมายเลขภายนอก
                    </span>
                    <span className="font-mono text-xs text-slate-900 dark:text-white">{order.externalOrderId}</span>
                  </div>
                )}
                {order.platformFee != null && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Tag className="h-3.5 w-3.5" />
                      ค่าธรรมเนียมแพลตฟอร์ม
                    </span>
                    <span className="tabular-nums font-medium text-red-600 dark:text-red-400">
                      -{formatCurrency(order.platformFee)}
                    </span>
                  </div>
                )}
                {order.trackingNumber && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Truck className="h-3.5 w-3.5" />
                      เลขพัสดุ
                    </span>
                    <span className="font-mono text-xs text-slate-900 dark:text-white">{order.trackingNumber}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------
              PRICE BREAKDOWN
          ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                สรุปราคา
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดรวมสินค้า</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(subtotalItems)}</span>
              </div>
              {subtotalFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ค่าธรรมเนียม</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(subtotalFees)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ส่วนลด</span>
                  <span className="tabular-nums text-red-600 dark:text-red-400">-{formatCurrency(discount)}</span>
                </div>
              )}
              {order.taxRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">VAT ({order.taxRate}%)</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(order.taxAmount ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  ยอดรวมทั้งหมด {order.taxRate > 0 ? "(รวม VAT)" : ""}
                </span>
                <span className="tabular-nums text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalAmount)}</span>
              </div>

              {/* Cost tracking */}
              {hasCostEntries && (
                <div className="border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <BarChart3 className="h-3.5 w-3.5" />
                    ต้นทุน
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ต้นทุนรวม</span>
                      <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(totalCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">กำไร</span>
                      <span className="tabular-nums font-medium text-slate-900 dark:text-white">{formatCurrency(totalAmount - totalCost)}</span>
                    </div>
                    {profitMargin != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">อัตรากำไร</span>
                        <span
                          className={`tabular-nums font-bold ${
                            profitMargin >= 30
                              ? "text-green-600 dark:text-green-400"
                              : profitMargin >= 15
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {profitMargin.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------
              BILLING SECTION (new, replaces old read-only invoices)
          ------------------------------------------ */}
          <OrderBillingSection
            orderId={id}
            customerId={order.customerId}
            totalAmount={totalAmount}
            internalStatus={order.internalStatus}
          />
        </div>
      </div>

      {/* ====================================================
          EDIT DIALOG
      ==================================================== */}
      <OrderEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        orderId={id}
        orderType={order.orderType}
        order={order}
      />

      <OrderInfoEditDialog
        open={showInfoEditDialog}
        onOpenChange={setShowInfoEditDialog}
        order={order}
      />
    </div>
  );
}
