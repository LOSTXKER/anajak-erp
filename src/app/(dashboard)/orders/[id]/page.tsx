"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import {
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  INTERNAL_STATUS_COLORS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  ORDER_TYPE_LABELS,
  getFlowSteps,
  getNextStatuses,
} from "@/lib/order-status";
import {
  ArrowLeft,
  FileText,
  ChevronRight,
  XCircle,
  Edit3,
  Copy,
} from "lucide-react";

import { OrderDesignSection } from "@/components/orders/order-design-section";
import { OrderProductionSection } from "@/components/orders/order-production-section";
import { OrderDeliverySection } from "@/components/orders/order-delivery-section";
import { OrderEditDialog } from "@/components/orders/order-edit-dialog";
import { OrderInfoEditDialog } from "@/components/orders/order-info-edit-dialog";
import {
  OrderItemsDisplay,
  OrderStatusBar,
  OrderSidebar,
  OrderReferenceImages,
  OrderRevisions,
} from "@/components/orders/detail";

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

  const { data: order, isLoading, isError, refetch } = trpc.order.getById.useQuery({ id });
  const { data: attachments } = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: id });
  const utils = trpc.useUtils();

  const updateStatus = useMutationWithInvalidation(trpc.order.updateStatus, {
    invalidate: [utils.order.getById, utils.order.list],
  });

  const duplicateOrder = useMutationWithInvalidation(trpc.order.duplicate, {
    invalidate: [utils.order.list],
    onSuccess: (data: { id: string }) => {
      router.push(`/orders/${data.id}`);
    },
  });

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) return <OrderDetailSkeleton />;
  if (isError) return <QueryError onRetry={() => refetch()} />;
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

  const isMarketplace = ["SHOPEE", "LAZADA", "TIKTOK"].includes(order.channel);

  const totalCost =
    order.costEntries?.reduce(
      (sum: number, c: { amount: number }) => sum + c.amount,
      0,
    ) ?? 0;
  const hasCostEntries = order.costEntries && order.costEntries.length > 0;

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

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${customerColor.bg} ${customerColor.text}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${customerColor.dot}`}
                />
                {CUSTOMER_STATUS_LABELS[order.customerStatus]}
              </span>

              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${internalColor.bg} ${internalColor.text}`}
              >
                {INTERNAL_STATUS_LABELS[order.internalStatus]}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={order.orderType === "CUSTOM" ? "purple" : "default"}>
                {ORDER_TYPE_LABELS[order.orderType]}
              </Badge>

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
      <OrderStatusBar
        flowSteps={flowSteps}
        currentStepIndex={currentStepIndex}
        internalStatus={order.internalStatus}
      />

      {/* ====================================================
          MAIN GRID: CONTENT + SIDEBAR
      ==================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT: MAIN CONTENT (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <OrderItemsDisplay
            orderId={id}
            items={order.items ?? []}
            fees={order.fees ?? []}
          />

          <OrderReferenceImages attachments={attachments} />

          <OrderDesignSection
            orderId={id}
            orderNumber={order.orderNumber}
            internalStatus={order.internalStatus}
          />

          <OrderProductionSection
            orderId={id}
            internalStatus={order.internalStatus}
          />

          <OrderDeliverySection
            orderId={id}
            internalStatus={order.internalStatus}
            customerName={order.customer?.name}
            customerPhone={order.customer?.phone ?? undefined}
          />

          <OrderRevisions revisions={order.revisions ?? []} />
        </div>

        {/* RIGHT: SIDEBAR (1/3) */}
        <OrderSidebar
          order={order}
          subtotalItems={subtotalItems}
          subtotalFees={subtotalFees}
          discount={discount}
          totalAmount={totalAmount}
          totalCost={totalCost}
          hasCostEntries={!!hasCostEntries}
          profitMargin={profitMargin}
          channelColor={channelColor}
          isMarketplace={isMarketplace}
        />
      </div>

      {/* ====================================================
          EDIT DIALOGS
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
