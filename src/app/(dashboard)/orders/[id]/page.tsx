"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { PageHeader } from "@/components/page-header";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  INTERNAL_STATUS_LABELS,
  CHANNEL_COLORS,
  getFlowSteps,
  getNextStatuses,
  canRoleSetStatus,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import {
  FileText,
  ChevronRight,
  XCircle,
  Edit3,
  Copy,
  MoreHorizontal,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { OrderDesignSection } from "@/components/orders/order-design-section";
import { ProductionSummaryCard } from "@/components/orders/production-summary-card";
import { OrderDeliverySection } from "@/components/orders/order-delivery-section";
import { OrderItemsEditor } from "@/components/orders/order-items-editor";
import { OrderInfoEditDialog } from "@/components/orders/order-info-edit-dialog";
import { OrderGoodsReceiptSection } from "@/components/goods-receipt/order-goods-receipt-section";
import { OrderQcSection } from "@/components/qc/order-qc-section";
// หมายเหตุ: OrderNextStep ถูกถอดออก (เบสเคาะ 2026-06-12) — logic getOrderNextStep ยังอยู่
// ที่ lib/order-next-step.ts เผื่อกลับมาใช้รูปแบบอื่น
import {
  OrderItemsDisplay,
  OrderStatusBar,
  OrderSidebar,
  OrderFilesCard,
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
  const confirm = useConfirm();
  // แก้รายการ = ฟอร์มเต็มแสดง inline ตรงส่วนรายการสินค้า (เบสเคาะ: ไม่เอา popup)
  const [editingItems, setEditingItems] = useState(false);
  const [showInfoEditDialog, setShowInfoEditDialog] = useState(false);

  function openItemsEditor() {
    setEditingItems(true);
    // เลื่อนไปที่ฟอร์มหลัง render — กดจากการ์ดขั้นถัดไป/เมนูแล้วต้องเห็นฟอร์มทันที
    requestAnimationFrame(() => {
      document
        .getElementById("order-section-items")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const { data: order, isLoading, isError, refetch } = trpc.order.getById.useQuery({ id });
  const { data: attachments } = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: id });
  const { data: me } = trpc.user.me.useQuery();
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

  // จองสต๊อคใหม่หลังแก้ต้นเหตุ (ของไม่พอ/ท่อล่ม) — server จำกัดช่วงสถานะก่อนเริ่มผลิต
  const retryReserve = useMutationWithInvalidation(trpc.order.retryStockReservation, {
    invalidate: [utils.order.getById],
    onSuccess: () => toast.success("จองสต๊อคสำเร็จ"),
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "จองสต๊อคไม่สำเร็จ");
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
  // ซ่อนปุ่มที่ role นี้กดแล้ว server ปฏิเสธ (ชุดกติกาเดียวกับ server — audit ข้อ 29)
  const roleAllows = (to: string) =>
    canRoleSetStatus(me?.role, order.internalStatus, to as InternalStatus);
  const forwardStatuses = nextStatuses.filter((s) => s !== "CANCELLED" && roleAllows(s));
  const canCancel = nextStatuses.includes("CANCELLED") && roleAllows("CANCELLED");
  // เมนูฝั่งขาย (แก้ข้อมูล/รายการ/สำเนา/ออกใบเสนอ) — server เป็น salesUp
  const isSalesUp = !me || ["OWNER", "MANAGER", "SALES"].includes(me.role);

  const currentStepIndex = flowSteps.indexOf(order.internalStatus);

  const isCancelled = order.internalStatus === "CANCELLED";
  const isCompleted = order.internalStatus === "COMPLETED";
  // terminal สำหรับปุ่มหลัก — COMPLETED เปิดกลับได้แต่ซ่อนไว้ใน dropdown (ไม่เชียร์ให้กด)
  const isTerminal = isCancelled || isCompleted;

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
    const current = order?.internalStatus ?? "";
    // ถอยจากจุดที่ประกาศกับลูกค้าแล้ว (ส่งแล้ว/ปิดแล้ว) — server บังคับเหตุผล+ผู้จัดการ
    const isRollback =
      current === "COMPLETED" ||
      (current === "SHIPPED" && ["READY_TO_SHIP", "QUALITY_CHECK"].includes(newStatus));

    if (newStatus === "CANCELLED") {
      const reason = await promptText({
        title: "ยกเลิกออเดอร์นี้?",
        description: "ระบุเหตุผลที่ยกเลิก — จะถูกบันทึกในประวัติออเดอร์",
        placeholder: "เหตุผลที่ยกเลิก",
        confirmText: "ยกเลิกออเดอร์",
        destructive: true,
      });
      if (reason === null || reason === "") return;
      updateStatus.mutate({ id, internalStatus: newStatus as never, reason });
    } else if (isRollback) {
      const reason = await promptText({
        title: current === "COMPLETED" ? "เปิดงานกลับ?" : "ถอยสถานะกลับ?",
        description:
          "งานนี้ประกาศส่งแล้ว/ปิดแล้ว — ระบุเหตุผล (เช่น ของตีกลับ/กดพลาด) จะถูกบันทึกในประวัติ",
        placeholder: "เหตุผล",
        confirmText: "ยืนยันถอยสถานะ",
        destructive: true,
      });
      if (reason === null || reason === "") return;
      updateStatus.mutate({ id, internalStatus: newStatus as never, reason });
    } else if (newStatus === "COMPLETED") {
      const ok = await confirm({
        title: "ปิดงานออเดอร์นี้?",
        description:
          "ปิดแล้วแก้รายการ/ตัวเงินไม่ได้อีก — เปิดกลับได้เฉพาะผู้จัดการพร้อมเหตุผล",
        confirmText: "ปิดงาน",
      });
      if (!ok) return;
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    } else if (newStatus === "SHIPPED") {
      const ok = await confirm({
        title: "ยืนยันว่าส่งของแล้ว?",
        description:
          "แนะนำให้กด \"ส่งของ\" ที่ใบส่งในส่วนจัดส่งแทน — เลขพัสดุจะติดออเดอร์และสถานะเดินให้เอง",
        confirmText: "ส่งแล้ว",
      });
      if (!ok) return;
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    } else {
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    }
  }

  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  };

  // COMPLETED: ไม่มีปุ่มหลัก — ทางถอย (เปิดงานกลับ) ทั้งหมดอยู่ใน dropdown
  const primaryNext = isTerminal ? undefined : forwardStatuses[0];
  const otherNext = isTerminal ? forwardStatuses : forwardStatuses.slice(1);
  const statusItemLabel = (status: string) =>
    isCompleted && status === "SHIPPED"
      ? "เปิดงานกลับ (→ จัดส่งแล้ว)"
      : INTERNAL_STATUS_LABELS[status as keyof typeof INTERNAL_STATUS_LABELS];
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

            {/* dropdown ต้องมีเสมอ — "ใบสั่งงาน" อยู่ในนี้ ทุก role/ทุกสถานะต้องพิมพ์ได้
                (review จับ: เดิม gate ตาม role ทำช่าง/กราฟิกพิมพ์ใบสั่งงานไม่ได้) */}
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
                    <DropdownMenu.Item className={dropdownItemClass} asChild>
                      <a href={`/print/job-ticket/${id}`} target="_blank" rel="noreferrer">
                        <ClipboardList className="h-4 w-4" />
                        ใบสั่งงาน (พิมพ์)
                      </a>
                    </DropdownMenu.Item>
                    {isSalesUp && (
                      <>
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
                            onSelect={openItemsEditor}
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
                        {["DRAFT", "INQUIRY"].includes(order.internalStatus) && (
                          // สะพานใบเสนอ: ออกใบเสนอผูกใบนี้ — ลูกค้าตกลงแล้วยืนยันออเดอร์เดิม ไม่สร้างซ้ำ
                          <DropdownMenu.Item
                            className={dropdownItemClass}
                            onSelect={() => router.push(`/quotations/new?orderId=${id}`)}
                          >
                            <FileText className="h-4 w-4" />
                            ออกใบเสนอราคา
                          </DropdownMenu.Item>
                        )}
                      </>
                    )}
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
                            {statusItemLabel(status)}
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
          </>
        }
      />

      <OrderStatusBar
        flowSteps={flowSteps}
        currentStepIndex={currentStepIndex}
        internalStatus={order.internalStatus}
        customerStatus={order.customerStatus}
      />

      {/* จองสต๊อคมีปัญหา — ต้องเห็นทันทีบนหน้าออเดอร์ (ด่านพร้อมผลิตจะกั้นงานไม่ให้เข้าคิวช่างอยู่แล้ว
          แต่คนแก้ต้นเหตุคือคนที่เปิดหน้านี้) · จองสำเร็จดูได้จากประวัติออเดอร์ */}
      {order.stockReservationError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">จองสต๊อคไม่สำเร็จ:</span> {order.stockReservationError}
          </span>
          {isSalesUp &&
            ["CONFIRMED", "DESIGNING", "DESIGN_APPROVED", "PRODUCTION_QUEUE"].includes(
              order.internalStatus
            ) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryReserve.mutate({ id })}
                disabled={retryReserve.isPending}
              >
                {retryReserve.isPending ? "กำลังจอง..." : "จองใหม่"}
              </Button>
            )}
        </div>
      )}

      {/* เลิกการ์ด "ขั้นถัดไป" (เบสเคาะ 2026-06-12) — ผู้ใช้ทำงานจากปุ่มในแต่ละการ์ดตรงๆ:
          ยืนยันออเดอร์=ปุ่มมุมขวาบน · ใส่รายการ=ปุ่มในการ์ดรายการ (empty state) · มัดจำ=การ์ดบิล */}

      {/* ====================================================
          MAIN GRID: CONTENT + SIDEBAR
      ==================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT: MAIN CONTENT (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <div id="order-section-items" className="scroll-mt-20">
            {editingItems && canEditItems ? (
              <OrderItemsEditor
                orderId={id}
                orderType={order.orderType}
                internalStatus={order.internalStatus}
                order={order}
                onDone={() => setEditingItems(false)}
                onCancel={() => setEditingItems(false)}
              />
            ) : (
              <OrderItemsDisplay
                orderId={id}
                items={order.items ?? []}
                fees={order.fees ?? []}
                onEditItems={canEditItems && isSalesUp ? openItemsEditor : undefined}
              />
            )}
          </div>

          {/* ไฟล์ 3 ชั้น (ก้อน 4) — ดิบ/แบบอนุมัติ/ไฟล์พิมพ์ + ปุ่มแอดมินแนบแทนลูกค้า */}
          <OrderFilesCard
            orderId={id}
            attachments={attachments}
            userId={me?.id}
            userRole={me?.role}
          />

          <div id="order-section-design" className="scroll-mt-20">
            <OrderDesignSection
              orderId={id}
              orderNumber={order.orderNumber}
              internalStatus={order.internalStatus}
            />
          </div>

          {/* ของเข้า/ตรวจรับ — เสื้อลูกค้า/เสื้อโรงเย็บ นับจริงต่อไซส์ (ก้อน 1) */}
          <OrderGoodsReceiptSection
            orderId={id}
            itemSources={(order.items ?? []).flatMap((it) =>
              (it.products ?? [])
                .map((p) => p.itemSource)
                .filter((s): s is string => s !== null)
            )}
            canReceive={
              !!me && ["OWNER", "MANAGER", "SALES", "PRODUCTION_STAFF"].includes(me.role)
            }
          />

          {/* ตรวจนับ QC — นับของจุดที่ 2 ก่อนแพ็ค (ก้อน 3): ดีล้วนเด้งแพ็ค · มีเสียถอยกลับผลิต */}
          <OrderQcSection orderId={id} internalStatus={order.internalStatus} />

          {/* การ์ดสรุปอ่านอย่างเดียว — ตัวจัดการผลิตจริงอยู่ /production/[id] (เบสเคาะแยกโมดูล) */}
          <div id="order-section-production" className="scroll-mt-20">
            <ProductionSummaryCard
              orderId={id}
              internalStatus={order.internalStatus}
              productions={order.productions ?? []}
              isManagerUp={!!me && ["OWNER", "MANAGER"].includes(me.role)}
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
      <OrderInfoEditDialog
        open={showInfoEditDialog}
        onOpenChange={setShowInfoEditDialog}
        order={order}
      />
    </div>
  );
}
