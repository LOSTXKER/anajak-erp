"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { StatCard } from "@/components/ui/stat-card";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import {
  Truck,
  Send,
  PackageCheck,
  Check,
  X,
  AlertCircle,
  Loader2,
  Share2,
  Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { OutsourceShareDialog } from "@/components/outsource/outsource-share-dialog";
import {
  OUTSOURCE_QUEUE_FILTERS,
  isOutsourceOverdue,
  outsourceActionAvailability,
  outsourceQueueForStatus,
  outsourceStatusMeta,
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
    title: "ไม่มีงานรอ QC",
    description: "เมื่อนับรับของกลับแล้ว งานจะย้ายมารอหัวหน้าตัดสินที่คิวนี้",
  },
  done: {
    title: "ยังไม่มีประวัติงานจบ",
    description: "งานที่ QC ผ่านหรือไม่ผ่านจะแสดงเป็นประวัติที่นี่",
  },
};

export default function OutsourcePage() {
  const [queue, setQueue] = useState<OutsourceQueue>("send");

  // QC fail dialog
  const [qcFailTarget, setQcFailTarget] = useState<string | null>(null);
  const [qcFailNotes, setQcFailNotes] = useState("");

  // รับกลับร้านนอก = นับของก่อน (ใบตรวจรับ OUTSOURCE_RETURN — มตินับของ 2 จุด)
  // บันทึกใบเสร็จแล้วค่อย flip สถานะเป็น RECEIVED_BACK
  const [receiveTarget, setReceiveTarget] = useState<{
    id: string;
    orderId: string;
    description: string;
    quantity: number;
  } | null>(null);

  // แชร์ใบงานให้ร้านผ่าน LINE + แนบไฟล์ลาย (B14)
  const [shareTarget, setShareTarget] = useState<{
    id: string;
    description: string;
    quantity: number;
    expectedBackAt: Date | string | null;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  // รับส่งของ = ทีมผลิตขึ้นไป (ตรง productionUp ฝั่ง server) — role อื่นดูได้อย่างเดียว
  const canHandleGoods = !!me && permAllows(me.permissions, "manage_production");
  // ตัดสิน QC ต้องผ่านทั้ง productionUp และ supervise_operations ตาม middleware สองชั้นฝั่ง server
  const canJudgeQc =
    canHandleGoods && !!me && permAllows(me.permissions, "supervise_operations");
  // ยกเลิกใบร่างใช้ manage_settings ฝั่ง server (แยกจากสิทธิ์ตัดสิน QC เมื่อมี override รายคน)
  const canManageSettings = !!me && permAllows(me.permissions, "manage_settings");
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

  // รับของกลับ: เคยนับผ่านใบตรวจรับแล้ว (flip รอบก่อนพลาด เช่น เน็ตหลุด/ใบถูกคนอื่นขยับ)
  // → flip ตรงเลย ไม่เปิดฟอร์มบังคับนับซ้ำเป็นใบเบิ้ล · ยังไม่เคยนับ → เปิดใบตรวจรับตามปกติ
  async function handleReceiveBack(target: {
    id: string;
    orderId: string;
    description: string;
    quantity: number;
  }) {
    try {
      const receipts = await utils.goodsReceipt.listByOrder.fetch({ orderId: target.orderId });
      if (
        receipts.some(
          (r) => r.outsourceOrderId === target.id && r.receiptType === "OUTSOURCE_RETURN"
        )
      ) {
        updateStatus.mutate({ id: target.id, status: "RECEIVED_BACK" });
        return;
      }
    } catch {
      // อ่านประวัติใบตรวจไม่ได้ — ตกไปทางเปิดฟอร์มนับตามปกติ (ปลอดภัยกว่าข้าม)
    }
    setReceiveTarget(target);
  }

  // query หลักพังตอนโหลดแรก → error แยกจาก empty state
  // && !data: refetch เบื้องหลังล้มทั้งที่มี cache ห้ามถอนหน้า (dialog รับของ/แชร์ค้างอยู่)
  if (ordersError && !orders) return <QueryError onRetry={() => refetchOrders()} />;

  const allOrders = orders ?? [];
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
  const visibleOrders = allOrders
    .filter((order) => outsourceQueueForStatus(order.status) === queue)
    .sort((a, b) => Number(isOutsourceOverdue(b)) - Number(isOutsourceOverdue(a)));
  const currentQueue = OUTSOURCE_QUEUE_FILTERS.find((item) => item.value === queue)!;

  return (
    <div className="space-y-5">
      <PageHeader
        title="งานร้านนอก"
        description="เดินงานตามคิวเดียว: ยืนยันส่งร้าน → นับรับกลับ → QC"
        action={
          canManageSettings ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/vendors">
                <Settings2 className="h-4 w-4" />
                จัดการร้าน
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* หน้า ops ไม่มีค่าจ้าง/ทะเบียนร้าน — ให้คนหน้างานเห็นเฉพาะสิ่งที่ต้องทำต่อ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="รอส่งร้าน" value={queueCounts.send} icon={Send} caption="งาน" />
        <StatCard title="เลยกำหนดรับ" value={overdueCount} icon={AlertCircle} caption="งาน" />
        <StatCard title="รอ QC" value={queueCounts.qc} icon={PackageCheck} caption="งาน" />
      </div>

      <Section
        title={`${currentQueue.label} (${visibleOrders.length})`}
        description="แยกตามจังหวะงาน เพื่อให้แต่ละคนเห็นปุ่มที่ต้องทำต่อเพียงชุดเดียว"
        bordered
      >
        <div
          role="group"
          className="mb-4 flex flex-wrap gap-2"
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

        {loadingOrders ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : visibleOrders.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={QUEUE_EMPTY_COPY[queue].title}
            description={QUEUE_EMPTY_COPY[queue].description}
          />
        ) : (
          <ul className="space-y-3">
            {visibleOrders.map((o) => {
              const status = outsourceStatusMeta(o.status);
              const order = o.productionStep.production.order;
              const overdue = isOutsourceOverdue(o);
              const actions = outsourceActionAvailability(o.status, {
                canHandleGoods,
                canJudgeQc,
                canManageSettings,
              });
              const hasActions = Object.values(actions).some(Boolean);

              return (
                <li
                  key={o.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-medium text-slate-900 dark:text-white">
                        <Link
                          href={`/orders/${o.productionStep.production.orderId}`}
                          className="inline-flex min-h-11 touch-manipulation items-center text-blue-700 hover:underline sm:min-h-0 dark:text-blue-300"
                        >
                          {order.orderNumber}
                        </Link>{" "}
                        — {o.description}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {o.vendor.name} · {o.quantity} ชิ้น · {order.customer.name}
                      </p>
                    </div>
                    <Badge variant={status.variant} size="sm" className="shrink-0">
                      {status.label}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
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
                    <p className="mt-2 break-words text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium">ผล QC:</span> {o.qcNotes}
                    </p>
                  )}

                  {hasActions && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {actions.canMarkSent && (
                        <Button
                          size="sm"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: o.id, status: "SENT" })}
                        >
                          <Send className="h-4 w-4" />
                          ส่งของให้ร้านแล้ว
                        </Button>
                      )}
                      {actions.canReceiveBack && (
                        <Button
                          size="sm"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            handleReceiveBack({
                              id: o.id,
                              orderId: o.productionStep.production.orderId,
                              description: o.description,
                              quantity: o.quantity,
                            })
                          }
                        >
                          <PackageCheck className="h-4 w-4" />
                          รับของกลับแล้ว
                        </Button>
                      )}
                      {actions.canPassQc && (
                        <Button
                          size="sm"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ id: o.id, status: "QC_PASSED" })
                          }
                        >
                          <Check className="h-4 w-4" />
                          QC ผ่าน
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
                            setQcFailTarget(o.id);
                          }}
                        >
                          <X className="h-4 w-4" />
                          QC ไม่ผ่าน
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
                          <Share2 className="h-4 w-4" />
                          แชร์ให้ร้าน
                        </Button>
                      )}
                      {actions.canCancelDraft && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                          disabled={cancelDraft.isPending}
                          onClick={() => cancelDraft.mutate({ id: o.id })}
                        >
                          <X className="h-4 w-4" />
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
      </Section>

      {/* QC fail dialog — ต้องบอกเหตุผล (ใช้คุยกับร้าน + เปิดรอบส่งแก้) */}
      <Dialog
        open={qcFailTarget !== null}
        onOpenChange={(open) => !open && setQcFailTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QC ไม่ผ่าน</DialogTitle>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setQcFailTarget(null)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              disabled={!qcFailNotes || updateStatus.isPending}
              onClick={() =>
                qcFailTarget &&
                updateStatus.mutate({
                  id: qcFailTarget,
                  status: "QC_FAILED",
                  qcNotes: qcFailNotes,
                })
              }
              className="gap-1.5"
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              ยืนยัน QC ไม่ผ่าน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* รับกลับร้านนอก: นับของก่อน (ใบตรวจรับ) → บันทึกแล้วค่อย flip สถานะรับกลับ
          ถ้า flip พลาด (ใบถูกคนอื่นขยับ) ใบตรวจรับยังอยู่ — กด "รับของกลับแล้ว" ซ้ำได้ */}
      {/* แชร์ใบงานให้ร้าน (B14) — ลิงก์ public + ไฟล์ลาย */}
      {shareTarget && (
        <OutsourceShareDialog job={shareTarget} onClose={() => setShareTarget(null)} />
      )}

      {receiveTarget && (
        <GoodsReceiptDialog
          orderId={receiveTarget.orderId}
          receiptType="OUTSOURCE_RETURN"
          outsourceOrderId={receiveTarget.id}
          presetLines={[
            {
              description: receiveTarget.description,
              qtyExpected: receiveTarget.quantity,
            },
          ]}
          onCreated={() =>
            updateStatus.mutate({ id: receiveTarget.id, status: "RECEIVED_BACK" })
          }
          onClose={() => setReceiveTarget(null)}
        />
      )}
    </div>
  );
}
