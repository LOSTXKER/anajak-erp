"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { usePromptText } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { PageHeader } from "@/components/page-header";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  CHANNEL_COLORS,
  getFlowSteps,
  getNextStatuses,
} from "@/lib/order-status";
import {
  FileText,
  ChevronRight,
  XCircle,
  Edit3,
  Copy,
  MoreHorizontal,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { OrderDesignSection } from "@/components/orders/order-design-section";
import { OrderNextStep } from "@/components/orders/detail/order-next-step";
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
  const promptText = usePromptText();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInfoEditDialog, setShowInfoEditDialog] = useState(false);

  const { data: order, isLoading, isError, refetch } = trpc.order.getById.useQuery({ id });
  const { data: attachments } = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: id });
  const utils = trpc.useUtils();

  const updateStatus = useMutationWithInvalidation(trpc.order.updateStatus, {
    invalidate: [utils.order.getById, utils.order.list],
    // server มีด่านปฏิเสธ (วงเงินเครดิต/ปิดงานก่อนวางบิลครบ) — เงียบไม่ได้ ผู้ใช้ต้องเห็นเหตุผล
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "เปลี่ยนสถานะไม่สำเร็จ");
    },
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
  async function handleStatusChange(newStatus: string) {
    if (newStatus === "CANCELLED") {
      const reason = await promptText({
        title: "ยกเลิกออเดอร์นี้?",
        description: "ระบุเหตุผลที่ยกเลิก — จะถูกบันทึกในประวัติออเดอร์",
        placeholder: "เหตุผลที่ยกเลิก",
        confirmText: "ยกเลิกออเดอร์",
        destructive: true,
      });
      if (reason === null || reason === "") return;
      updateStatus.mutate({
        id,
        internalStatus: newStatus as never,
        reason,
      });
    } else {
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    }
  }

  const customerColor = CUSTOMER_STATUS_COLORS[order.customerStatus];
  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  };

  const primaryNext = forwardStatuses[0];
  const otherNext = forwardStatuses.slice(1);
  const dropdownItemClass =
    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900 dark:text-slate-300 dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-white";

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[
          { label: "ออเดอร์", href: "/orders" },
          { label: order.orderNumber },
        ]}
        title={order.orderNumber}
        description={order.title || undefined}
        action={
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                "border-slate-200 bg-white dark:border-slate-800/60 dark:bg-slate-900/80"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", customerColor.dot)} />
              <span className="text-slate-900 dark:text-white">
                {CUSTOMER_STATUS_LABELS[order.customerStatus]}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                {INTERNAL_STATUS_LABELS[order.internalStatus]}
              </span>
            </span>

            <Button variant="outline" size="sm" asChild>
              <a href={`/print/job-ticket/${id}`} target="_blank" rel="noreferrer">
                <ClipboardList className="h-4 w-4" />
                ใบสั่งงาน
              </a>
            </Button>

            {!isTerminal && primaryNext && (
              <Button
                size="sm"
                onClick={() => handleStatusChange(primaryNext)}
                disabled={updateStatus.isPending}
              >
                <ChevronRight className="h-4 w-4" />
                {INTERNAL_STATUS_LABELS[primaryNext]}
              </Button>
            )}

            {!isTerminal && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="เพิ่มเติม">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 min-w-[200px] rounded-2xl border border-slate-200/70 bg-white p-1 shadow-lg dark:border-slate-800/60 dark:bg-slate-900/80"
                  >
                    <DropdownMenu.Item
                      className={dropdownItemClass}
                      onSelect={() => setShowInfoEditDialog(true)}
                    >
                      <FileText className="h-4 w-4" />
                      แก้ไขข้อมูลออเดอร์
                    </DropdownMenu.Item>
                    {canEditItems && (
                      <DropdownMenu.Item
                        className={dropdownItemClass}
                        onSelect={() => setShowEditDialog(true)}
                      >
                        <Edit3 className="h-4 w-4" />
                        แก้ไขรายการ
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item
                      className={dropdownItemClass}
                      onSelect={() => duplicateOrder.mutate({ id })}
                      disabled={duplicateOrder.isPending}
                    >
                      <Copy className="h-4 w-4" />
                      สำเนาออเดอร์
                    </DropdownMenu.Item>
                    {otherNext.length > 0 && (
                      <>
                        <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                        {otherNext.map((status) => (
                          <DropdownMenu.Item
                            key={status}
                            className={dropdownItemClass}
                            onSelect={() => handleStatusChange(status)}
                            disabled={updateStatus.isPending}
                          >
                            <ChevronRight className="h-4 w-4" />
                            {INTERNAL_STATUS_LABELS[status]}
                          </DropdownMenu.Item>
                        ))}
                      </>
                    )}
                    {canCancel && (
                      <>
                        <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                        <DropdownMenu.Item
                          className={cn(
                            dropdownItemClass,
                            "text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-950/40"
                          )}
                          onSelect={() => handleStatusChange("CANCELLED")}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                          ยกเลิกออเดอร์
                        </DropdownMenu.Item>
                      </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </>
        }
      />

      <OrderStatusBar
        flowSteps={flowSteps}
        currentStepIndex={currentStepIndex}
        internalStatus={order.internalStatus}
      />

      {/* เข็มทิศ — ขั้นถัดไปที่แนะนำหนึ่งอย่าง พร้อมปุ่มทำได้เลย */}
      <OrderNextStep
        order={order}
        onEditItems={() => setShowEditDialog(true)}
        onStatusChange={(status) => handleStatusChange(status)}
        statusPending={updateStatus.isPending}
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

          <div id="order-section-design" className="scroll-mt-20">
            <OrderDesignSection
              orderId={id}
              orderNumber={order.orderNumber}
              internalStatus={order.internalStatus}
            />
          </div>

          <div id="order-section-production" className="scroll-mt-20">
            <OrderProductionSection
              orderId={id}
              internalStatus={order.internalStatus}
              printTypes={[
                ...new Set(
                  (order.items ?? []).flatMap((it) =>
                    (it.prints ?? []).map((pr) => pr.printType)
                  )
                ),
              ]}
            />
          </div>

          <OrderDeliverySection
            orderId={id}
            internalStatus={order.internalStatus}
            customerName={order.customer?.name}
            customerPhone={order.customer?.phone ?? undefined}
            customerHasAddress={!!order.customer?.address}
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
