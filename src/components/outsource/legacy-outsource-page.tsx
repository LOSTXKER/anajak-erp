"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { Alert } from "@/components/ui/alert";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { formatDate } from "@/lib/utils";
import {
  Truck,
  Send,
  PackageCheck,
  Check,
  X,
  AlertCircle,
  Share2,
  Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { OutsourceShareDialog } from "@/components/outsource/outsource-share-dialog";
import { ProductionModuleNav } from "@/components/production/production-module-nav";
import {
  OUTSOURCE_QUEUE_FILTERS,
  isOutsourceOverdue,
  outsourceActionAvailability,
  outsourceQueueForStatus,
  outsourceStatusMeta,
  sortOutsourceByExpectedReturn,
  type OutsourceQueue,
} from "@/lib/outsource-ui";

const QUEUE_EMPTY_COPY: Record<OutsourceQueue, { title: string; description: string }> = {
  send: {
    title: "ไม่มีงานรอส่งร้าน",
    description: "ใบงานที่สร้างจากหน้าใบผลิตจะมารอให้ยืนยันส่งของที่คิวนี้",
  },
  receive: {
    title: "ไม่มีงานค้างรับกลับ",
    description: "งานที่ส่งร้านแล้วและยังไม่ได้รับของกลับจะแสดงที่นี่",
  },
  qc: {
    title: "ไม่มีงานรอตรวจรับ",
    description: "เมื่อนับรับของกลับแล้ว งานจะย้ายมารอหัวหน้าตรวจคุณภาพจากร้านที่คิวนี้",
  },
  done: {
    title: "ยังไม่มีประวัติงานจบ",
    description: "งานที่ตรวจรับผ่านหรือส่งกลับแก้จะแสดงเป็นประวัติที่นี่",
  },
};

type OutsourceOrder = RouterOutput["outsource"]["listOrders"][number];

function v2CommandFields(order: OutsourceOrder) {
  return order.operationJobId && order.operationRevision !== null
    ? {
        commandId: crypto.randomUUID(),
        expectedRevision: order.operationRevision,
      }
    : {};
}

function qcQuantityLines(
  order: OutsourceOrder,
  disposition: "PASS" | "REWORK" | "SCRAP",
) {
  if (!order.executionEnabled) return undefined;
  const allocatedTotal = order.quantityAllocations.reduce(
    (sum, line) => sum + line.qty,
    0,
  );
  if (
    order.quantityAllocations.length === 0 ||
    allocatedTotal !== order.quantity
  ) {
    return null;
  }
  return order.quantityAllocations.map((line) => ({
    quantityLineId: line.quantityLineId,
    qtyGood: disposition === "PASS" ? line.qty : 0,
    qtyScrap: disposition === "SCRAP" ? line.qty : 0,
    qtyRework: disposition === "REWORK" ? line.qty : 0,
  }));
}

export function LegacyOutsourcePage({
  embedded = false,
  v2Only = false,
}: {
  embedded?: boolean;
  v2Only?: boolean;
} = {}) {
  const [queue, setQueue] = useState<OutsourceQueue>("send");

  // ตรวจรับจากร้านไม่ผ่าน (ชื่อ field/status ฝั่งข้อมูลเดิมยังเป็น QC_*)
  const [qcFailTarget, setQcFailTarget] = useState<OutsourceOrder | null>(null);
  const [qcFailNotes, setQcFailNotes] = useState("");
  const [qcFailDisposition, setQcFailDisposition] = useState<"REWORK" | "SCRAP">(
    "REWORK",
  );

  // รับกลับร้านนอก = นับของก่อน (ใบตรวจรับ OUTSOURCE_RETURN — มตินับของ 2 จุด)
  // บันทึกใบเสร็จแล้วค่อย flip สถานะเป็น RECEIVED_BACK
  const [receiveTarget, setReceiveTarget] = useState<OutsourceOrder | null>(null);

  // แชร์ใบงานให้ร้านผ่าน LINE + แนบไฟล์ลาย (B14)
  const [shareTarget, setShareTarget] = useState<{
    id: string;
    description: string;
    quantity: number;
    expectedBackAt: Date | string | null;
  } | null>(null);

  const utils = trpc.useUtils();
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const permissionReady = !meQuery.isError;
  // ตั้งค่าร้านยังเป็นสิทธิ์ระบบ; lifecycle (รวมยกเลิกร่าง) ใช้หัวหน้าผลิตแยกกัน
  const canManageSettings =
    permissionReady && !!me && permAllows(me.permissions, "manage_settings");
  const {
    data: orders,
    isLoading: loadingOrders,
    isError: ordersError,
    refetch: refetchOrders,
  } = trpc.outsource.listOrders.useQuery({});

  const updateStatus = useMutationWithInvalidation(trpc.outsource.updateOrderStatus, {
    invalidate: [utils.outsource.listOrders, utils.production.getByOrderId],
    onSuccess: () => {
      setQcFailTarget(null);
      setQcFailNotes("");
    },
    onError: (err: { message?: string }) => toast.error(err.message ?? "อัปเดตไม่สำเร็จ"),
  });
  const cancelDraft = useMutationWithInvalidation(trpc.outsource.cancelDraftOrder, {
    invalidate: [utils.outsource.listOrders, utils.production.getByOrderId],
    onError: (err: { message?: string }) => toast.error(err.message ?? "ยกเลิกไม่สำเร็จ"),
  });

  function moveOrder(
    order: OutsourceOrder,
    status: "SENT" | "IN_PROGRESS" | "COMPLETED" | "RECEIVED_BACK" | "QC_PASSED" | "QC_FAILED",
    options: { qcNotes?: string; disposition?: "REWORK" | "SCRAP" } = {},
  ) {
    const quantityLines =
      status === "QC_PASSED"
        ? qcQuantityLines(order, "PASS")
        : status === "QC_FAILED" && options.disposition
          ? qcQuantityLines(order, options.disposition)
          : undefined;
    if (
      order.executionEnabled &&
      (status === "QC_PASSED" || status === "QC_FAILED") &&
      !quantityLines
    ) {
      toast.error("ใบงานนี้ไม่มีจำนวนแยกตามรายการที่ครบถ้วน กรุณาให้หัวหน้าตรวจใบงาน");
      return;
    }
    updateStatus.mutate({
      id: order.id,
      status,
      ...options,
      ...v2CommandFields(order),
      ...(quantityLines ? { quantityLines } : {}),
    });
  }

  function cancelOrder(order: OutsourceOrder) {
    cancelDraft.mutate({ id: order.id, ...v2CommandFields(order) });
  }

  // รับของกลับ: เคยนับผ่านใบตรวจรับแล้ว (flip รอบก่อนพลาด เช่น เน็ตหลุด/ใบถูกคนอื่นขยับ)
  // → flip ตรงเลย ไม่เปิดฟอร์มบังคับนับซ้ำเป็นใบเบิ้ล · ยังไม่เคยนับ → เปิดใบตรวจรับตามปกติ
  async function handleReceiveBack(target: OutsourceOrder) {
    try {
      const receipts = await utils.goodsReceipt.listByOrder.fetch({
        orderId: target.productionStep.production.orderId,
      });
      if (
        receipts.some(
          (r) => r.outsourceOrderId === target.id && r.receiptType === "OUTSOURCE_RETURN"
        )
      ) {
        moveOrder(target, "RECEIVED_BACK");
        return;
      }
    } catch {
      // อ่านประวัติใบตรวจไม่ได้ — ตกไปทางเปิดฟอร์มนับตามปกติ (ปลอดภัยกว่าข้าม)
    }
    setReceiveTarget(target);
  }

  async function finishReceiveBack(id: string) {
    const fresh = await utils.outsource.listOrders.fetch({});
    const target = fresh.find((order) => order.id === id);
    if (!target) {
      toast.error("บันทึกใบรับแล้ว แต่โหลดใบงานร้านนอกล่าสุดไม่สำเร็จ");
      return;
    }
    moveOrder(target, "RECEIVED_BACK");
  }

  // query หลักพังตอนโหลดแรก → error แยกจาก empty state
  // && !data: refetch เบื้องหลังล้มทั้งที่มี cache ห้ามถอนหน้า (dialog รับของ/แชร์ค้างอยู่)
  if (ordersError && !orders) return <QueryError onRetry={() => refetchOrders()} />;

  const ordersStale = ordersError && Boolean(orders);
  const allOrders = (orders ?? []).filter(
    (order) => !v2Only || order.productionStep.executionEnabled,
  );
  // Dialog ต้องอิงสิทธิ์/สถานะล่าสุดจาก server ไม่ใช้ object ตอนที่กดเปิดซึ่งอาจ stale
  // หลัง refetch, hold/cancel หรือถูกถอดสิทธิ์แล้ว dialog จะปิดทันทีแทนที่จะกดแล้ว error.
  const currentQcFailTarget = qcFailTarget
    ? (allOrders.find((order) => order.id === qcFailTarget.id) ?? null)
    : null;
  const currentReceiveTarget = receiveTarget
    ? (allOrders.find((order) => order.id === receiveTarget.id) ?? null)
    : null;
  const currentShareTarget = shareTarget
    ? (allOrders.find((order) => order.id === shareTarget.id) ?? null)
    : null;
  const queueCounts = OUTSOURCE_QUEUE_FILTERS.reduce<Record<OutsourceQueue, number>>(
    (counts, item) => {
      counts[item.value] = allOrders.filter(
        (order) => outsourceQueueForStatus(order.status) === item.value
      ).length;
      return counts;
    },
    { send: 0, receive: 0, qc: 0, done: 0 }
  );
  const overdueCount = allOrders.filter((order) => isOutsourceOverdue(order)).length;
  const queueOrders = allOrders.filter(
    (order) => outsourceQueueForStatus(order.status) === queue
  );
  const visibleOrders =
    queue === "receive" ? sortOutsourceByExpectedReturn(queueOrders) : queueOrders;
  const currentQueue = OUTSOURCE_QUEUE_FILTERS.find((item) => item.value === queue)!;

  return (
    <div className="space-y-5">
      {!embedded ? (
        <>
          <PageHeader
            title="งานร้านนอก"
            description="ติดตามกำหนดรับ ตรวจรับจากร้าน และส่งต่อเข้า QC ขั้นสุดท้าย"
            action={
              <div className="flex flex-wrap items-center gap-2">
                {canManageSettings ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/settings/vendors">
                      <Settings2 />
                      จัดการร้าน
                    </Link>
                  </Button>
                ) : null}
                <ProductionModuleNav />
              </div>
            }
          />
        </>
      ) : canManageSettings ? (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/vendors">
              <Settings2 /> จัดการร้าน
            </Link>
          </Button>
        </div>
      ) : null}

      {meQuery.isError && (
        <Alert variant="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>โหลดสิทธิ์จัดการร้านไม่สำเร็จ — ซ่อนเมนูตั้งค่าชั่วคราว</span>
            <Button variant="outline" size="sm" onClick={() => void meQuery.refetch()}>
              ลองใหม่
            </Button>
          </span>
        </Alert>
      )}

      {ordersStale && (
        <Alert variant="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>ข้อมูลงานร้านนอกล่าสุดอาจยังไม่สด — ปิดปุ่มบันทึกชั่วคราว</span>
            <Button variant="outline" size="sm" onClick={() => void refetchOrders()}>
              ลองใหม่
            </Button>
          </span>
        </Alert>
      )}

      {overdueCount > 0 && (
        <Alert variant="warning" icon={AlertCircle} title={`เลยกำหนดรับ ${overdueCount} งาน`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>เปิดคิวรับกลับเพื่อติดตามร้าน งานเลยกำหนดจะอยู่บนสุด</span>
            <Button variant="outline" size="sm" onClick={() => setQueue("receive")}>
              ดูงานเลยกำหนด
            </Button>
          </div>
        </Alert>
      )}

      <div
        role="group"
        className="flex flex-wrap gap-2"
        aria-label="เลือกคิวงานร้านนอก"
      >
        {OUTSOURCE_QUEUE_FILTERS.map((item) => (
          <FilterChip
            key={item.value}
            selected={queue === item.value}
            onClick={() => setQueue(item.value)}
          >
            {item.label} ({queueCounts[item.value]})
          </FilterChip>
        ))}
      </div>

      <section aria-labelledby="outsource-worklist-heading">
        <h2 id="outsource-worklist-heading" className="sr-only">
          {currentQueue.label} {visibleOrders.length} งาน
        </h2>

        {loadingOrders ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : visibleOrders.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={QUEUE_EMPTY_COPY[queue].title}
            description={QUEUE_EMPTY_COPY[queue].description}
          />
        ) : (
          <ul className="card-surface divide-y divide-divider overflow-hidden rounded-2xl">
            {visibleOrders.map((o) => {
              const status = outsourceStatusMeta(o.status);
              const order = o.productionStep.production.order;
              const overdue = isOutsourceOverdue(o);
              const actions = outsourceActionAvailability(o.availableCommands, {
                enabled: !ordersStale,
              });
              const hasActions = Object.values(actions).some(Boolean);

              return (
                <li
                  key={o.id}
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-medium text-strong">
                        <Link
                          href={`/orders/${o.productionStep.production.orderId}`}
                          className="inline-flex min-h-11 touch-manipulation items-center text-blue-700 hover:underline sm:min-h-0 dark:text-blue-300"
                        >
                          {order.orderNumber}
                        </Link>{" "}
                        — {o.description}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-secondary">
                        {o.vendor.name} · {o.quantity} ชิ้น · {order.customer.name}
                      </p>
                    </div>
                    {/* จุดสี + ข้อความ (ภาษาเดียวกับหน้าอื่นทั้งเว็บ) —
                        ย้อมข้อความเฉพาะผลตรวจรับจากร้าน ผ่าน/ไม่ผ่าน
                        ระหว่างทางปล่อยให้จุดสีบอก ไม่งั้นคิวจะกลายเป็นรุ้ง */}
                    <StatusLabel
                      label={status.label}
                      tone={toneFromBadgeVariant(status.variant)}
                      emphasize={o.status === "QC_PASSED" || o.status === "QC_FAILED"}
                      className="shrink-0"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {o.sentAt && <span>ส่ง {formatDate(o.sentAt)}</span>}
                    {o.expectedBackAt && (
                      <span
                        className={
                          overdue
                            ? "font-medium text-red-700 dark:text-red-300"
                            : undefined
                        }
                      >
                        กำหนดรับ {formatDate(o.expectedBackAt)}
                        {overdue ? " — เลยกำหนด" : ""}
                      </span>
                    )}
                    {o.receivedAt && <span>รับกลับ {formatDate(o.receivedAt)}</span>}
                  </div>
                  {o.qcNotes && (
                    <p className="mt-2 break-words text-xs text-secondary">
                      <span className="font-medium">ผลตรวจรับ:</span> {o.qcNotes}
                    </p>
                  )}
                  {o.blockedReason && (
                    <p
                      role="status"
                      className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{o.blockedReason}</span>
                    </p>
                  )}

                  {hasActions && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-divider pt-3">
                      {actions.canMarkSent && (
                        <Button
                          size="sm"
                          disabled={updateStatus.isPending}
                          onClick={() => moveOrder(o, "SENT")}
                        >
                          <Send />
                          ส่งของให้ร้านแล้ว
                        </Button>
                      )}
                      {actions.canReceiveBack && (
                        <Button
                          size="sm"
                          disabled={updateStatus.isPending}
                          onClick={() => handleReceiveBack(o)}
                        >
                          <PackageCheck />
                          รับของกลับแล้ว
                        </Button>
                      )}
                      {actions.canPassQc && (
                        <Button
                          size="sm"
                          disabled={updateStatus.isPending}
                          onClick={() => moveOrder(o, "QC_PASSED")}
                        >
                          <Check />
                          ตรวจรับผ่าน
                        </Button>
                      )}
                      {actions.canFailQc && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                          disabled={updateStatus.isPending}
                          onClick={() => {
                            setQcFailNotes("");
                            setQcFailDisposition("REWORK");
                            setQcFailTarget(o);
                          }}
                        >
                          <X />
                          ตรวจรับไม่ผ่าน
                        </Button>
                      )}
                      {actions.canShare && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShareTarget({
                              id: o.id,
                              description: o.description,
                              quantity: o.quantity,
                              expectedBackAt: o.expectedBackAt,
                            })
                          }
                        >
                          <Share2 />
                          แชร์ให้ร้าน
                        </Button>
                      )}
                      {actions.canCancelDraft && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                          disabled={cancelDraft.isPending}
                          onClick={() => cancelOrder(o)}
                        >
                          <X />
                          ยกเลิกร่าง
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ตรวจรับไม่ผ่าน — ต้องบอกเหตุผล (ใช้คุยกับร้าน + เปิดรอบส่งแก้) */}
      <Dialog
        open={
          currentQcFailTarget !== null &&
          !ordersStale &&
          currentQcFailTarget.availableCommands.includes("failQc")
        }
        onOpenChange={(open) => !open && setQcFailTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ตรวจรับไม่ผ่าน</DialogTitle>
            <DialogDescription>
              ระบุปัญหาที่พบ — ขั้นตอนผลิตจะยังเปิดอยู่ ส่งแก้รอบใหม่ได้จากหน้าใบผลิต
            </DialogDescription>
          </DialogHeader>
          <Field label="ปัญหาที่พบ" required>
            <Textarea
              value={qcFailNotes}
              onChange={(e) => setQcFailNotes(e.target.value)}
              rows={3}
              required
              placeholder="เช่น สีเพี้ยนจากแบบ 5 ตัว, ตำแหน่งพิมพ์เบี้ยว..."
            />
          </Field>
          <Field label="จัดการงานที่ไม่ผ่าน" required>
            <Select
              value={qcFailDisposition}
              onChange={(event) =>
                setQcFailDisposition(event.target.value as "REWORK" | "SCRAP")
              }
            >
              <option value="REWORK">ส่งกลับแก้และตรวจซ้ำ</option>
              <option value="SCRAP">คัดทิ้ง</option>
            </Select>
          </Field>
          <DialogSubmitFooter
            pending={updateStatus.isPending}
            disabled={!qcFailNotes}
            submitLabel="ยืนยันตรวจรับไม่ผ่าน"
            submitIcon={<X />}
            destructive
            onCancel={() => setQcFailTarget(null)}
            onSubmit={() => {
              if (currentQcFailTarget) {
                moveOrder(currentQcFailTarget, "QC_FAILED", {
                  qcNotes: qcFailNotes.trim(),
                  disposition: qcFailDisposition,
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* รับกลับร้านนอก: นับของก่อน (ใบตรวจรับ) → บันทึกแล้วค่อย flip สถานะรับกลับ
          ถ้า flip พลาด (ใบถูกคนอื่นขยับ) ใบตรวจรับยังอยู่ — กด "รับของกลับแล้ว" ซ้ำได้ */}
      {/* แชร์ใบงานให้ร้าน (B14) — ลิงก์ public + ไฟล์ลาย */}
      {shareTarget &&
        currentShareTarget?.availableCommands.includes("share") &&
        !ordersStale && (
          <OutsourceShareDialog
            job={{
              id: currentShareTarget.id,
              description: currentShareTarget.description,
              quantity: currentShareTarget.quantity,
              expectedBackAt: currentShareTarget.expectedBackAt,
            }}
            onClose={() => setShareTarget(null)}
          />
        )}

      {currentReceiveTarget &&
        !ordersStale &&
        currentReceiveTarget.availableCommands.includes("receiveBack") && (
          <GoodsReceiptDialog
            orderId={currentReceiveTarget.productionStep.production.orderId}
            receiptType="OUTSOURCE_RETURN"
            outsourceOrderId={currentReceiveTarget.id}
            presetLines={[
              {
                description: currentReceiveTarget.description,
                qtyExpected: currentReceiveTarget.quantity,
              },
            ]}
            onCreated={() => void finishReceiveBack(currentReceiveTarget.id)}
            onClose={() => setReceiveTarget(null)}
          />
        )}
    </div>
  );
}
