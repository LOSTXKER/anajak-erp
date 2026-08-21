"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import {
  PrintRunsPageView,
  PRINT_RUN_CONTROL_H,
  type PrintRun,
  type QueueEntry,
} from "@/components/production/print-runs-page-view";
import { ProductionModuleNav } from "@/components/production/production-module-nav";
import { cn } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { splitPrintRunsByStage } from "@/lib/print-run-workspace";
import { Scissors } from "lucide-react";

// จอช่างพิมพ์ DTF — รอบพิมพ์ฟิล์ม (FLOW-REDESIGN ก้อน 2)
// รวมหลายงานจากคิว (เฉพาะงานไฟล์พร้อม) ลงม้วนเดียว → พิมพ์จบทั้งม้วน → ตัดแยก+ติดป้ายเสร็จ
// จุดตัดแยกคือด่านบังคับกันฟิล์มสลับออเดอร์ — ขั้น DTF_PRINT ของงานสมาชิกถูกนับ/ปิดตอนนั้นเอง
// ฟิล์มพิมพ์เผื่อ (กรอกตอนปิดรอบ) เข้าคลังฟิล์มพร้อมรีด · ไม่มีเงินบนหน้านี้ (มติเลิกคิดต้นทุนต่องาน)

// invalidate ชุดเดียวกันทุก mutation บนหน้านี้ — คิว/รอบ/บอร์ดผลิต/งานของฉัน ต้องไม่ stale
function usePrintRunInvalidate() {
  const utils = trpc.useUtils();
  return [
    utils.printRun.queue,
    utils.printRun.list,
    utils.production.kanban,
    utils.factory.stationQueue,
    utils.task.myToday,
  ];
}

export function PrintRunsScreen({
  surface = "erp",
  focusStepId = null,
}: {
  surface?: "erp" | "station";
  focusStepId?: string | null;
}) {
  const confirm = useConfirm();
  const queueQuery = trpc.printRun.queue.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const listQuery = trpc.printRun.list.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const invalidate = usePrintRunInvalidate();
  // B8: ปุ่มสั่งงาน (เปิดรอบ/พิมพ์จบ/ยกเลิก/ตัดแยก) เฉพาะคนมีสิทธิ์ผลิต — role อื่นเห็นคิวอ่านอย่างเดียว
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const permissionStale = meQuery.isError && Boolean(me);
  const canManage =
    !permissionStale && permAllows(me?.permissions, "manage_production");

  // งานที่เลือกเข้ารอบ: stepId → จำนวนที่จะพิมพ์รอบนี้
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [completing, setCompleting] = useState<PrintRun | null>(null);
  const actionNoteRef = useRef<HTMLInputElement>(null);
  const handledFocusStepRef = useRef<string | null>(null);

  const create = useMutationWithInvalidation(trpc.printRun.create, {
    invalidate,
    onSuccess: (run: { runNumber: string; items: unknown[] }) => {
      toast.success(`เปิดรอบพิมพ์ ${run.runNumber} แล้ว`, {
        description: `${run.items.length} งานเข้ารอบ — จัดวางในโปรแกรมเครื่องแล้วเริ่มพิมพ์ได้เลย`,
      });
      setPicked({});
      setNote("");
    },
    onError: (err: { message?: string }) =>
      toast.error("เปิดรอบพิมพ์ไม่สำเร็จ", { description: err.message }),
  });
  const markPrinted = useMutationWithInvalidation(trpc.printRun.markPrinted, {
    invalidate,
    onSuccess: () =>
      toast.success("บันทึกพิมพ์จบทั้งม้วนแล้ว", {
        description: "ขั้นต่อไป: ตัดแยกฟิล์ม+ติดป้ายแยกออเดอร์ แล้วกดปิดรอบ",
      }),
    onError: (err: { message?: string }) =>
      toast.error("บันทึกไม่สำเร็จ", { description: err.message }),
  });
  const cancelRun = useMutationWithInvalidation(trpc.printRun.cancel, {
    invalidate,
    onSuccess: () => toast.success("ยกเลิกรอบแล้ว — งานคืนกลับเข้าคิวพิมพ์"),
    onError: (err: { message?: string }) =>
      toast.error("ยกเลิกรอบไม่สำเร็จ", { description: err.message }),
  });

  async function handleCancel(run: PrintRun) {
    const ok = await confirm({
      title: `ยกเลิกรอบ ${run.runNumber}?`,
      description:
        "งานทั้งหมดในรอบจะคืนกลับเข้าคิวพิมพ์ — ใช้เมื่อยังไม่ได้เริ่มพิมพ์จริงเท่านั้น",
      confirmText: "ยกเลิกรอบ",
      destructive: true,
    });
    if (!ok) return;
    cancelRun.mutate({ runId: run.id });
  }

  const queue = queueQuery.data ?? [];
  const runs = listQuery.data ?? [];
  const { printingRuns, printedRuns, historyRuns } = splitPrintRunsByStage(runs);
  const completableRun =
    canManage && !listQuery.isError && completing
      ? runs.find((run) => run.id === completing.id && run.status === "PRINTED" && !run.blockedReason) ?? null
      : null;

  const pickedEntries = queue.filter((q) => picked[q.stepId] !== undefined);
  const pickedTotal = pickedEntries.reduce((s, q) => s + (picked[q.stepId] ?? 0), 0);
  const hasInvalidQty = pickedEntries.some((q) => {
    const qty = picked[q.stepId] ?? 0;
    if (!Number.isInteger(qty) || qty < 1) return true;
    return q.remaining > 0 && qty > q.remaining;
  });

  useEffect(() => {
    if (
      !focusStepId ||
      queueQuery.isLoading ||
      handledFocusStepRef.current === focusStepId
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>("[data-print-run-queue-row]"),
      ).find(
        (candidate) =>
          candidate.getAttribute("data-print-run-queue-row") === focusStepId,
      );
      const target = row?.querySelector<HTMLElement>("button");
      if (target) {
        handledFocusStepRef.current = focusStepId;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "center" });
        return;
      }
      const heading = document.querySelector<HTMLElement>("main h1");
      if (heading) {
        handledFocusStepRef.current = focusStepId;
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusStepId, queueQuery.dataUpdatedAt, queueQuery.isLoading]);

  function togglePick(entry: QueueEntry) {
    setPicked((prev) => {
      const next = { ...prev };
      if (entry.stepId in next) delete next[entry.stepId];
      else next[entry.stepId] = entry.remaining > 0 ? entry.remaining : 1;
      return next;
    });
  }

  function focusRunAction() {
    actionNoteRef.current?.focus();
    actionNoteRef.current?.scrollIntoView({ block: "nearest" });
  }

  const busy = markPrinted.isPending || cancelRun.isPending;

  return (
    <PageShell
      title="รอบพิมพ์ฟิล์ม DTF"
      description="เปิดรอบจากคิว → พิมพ์ → ตัดแยกและติดป้าย"
      headerChildren={surface === "erp" ? <ProductionModuleNav /> : undefined}
      titleBadge={
        me && !canManage ? (
          <Badge variant="outline" size="sm">
            ดูอย่างเดียว
          </Badge>
        ) : undefined
      }
      loading={queueQuery.isLoading || listQuery.isLoading || meQuery.isLoading}
      error={
        meQuery.isError && !me
          ? {
              message: "โหลดสิทธิ์การผลิตไม่สำเร็จ",
              onRetry: () => meQuery.refetch(),
            }
          : null
      }
      skeleton={
        <div className="space-y-6">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,4fr)_minmax(0,6fr)] xl:grid-cols-[minmax(22rem,5fr)_minmax(0,7fr)]">
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
            <Skeleton className="h-72 rounded-2xl" />
          </div>
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      }
    >
      {permissionStale && (
        <Alert variant="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>โหลดสิทธิ์ล่าสุดไม่สำเร็จ — ปิดปุ่มจัดการรอบพิมพ์ไว้ชั่วคราว</span>
            <Button variant="outline" size="sm" onClick={() => void meQuery.refetch()}>
              ลองใหม่
            </Button>
          </span>
        </Alert>
      )}

      <PrintRunsPageView
        queue={queue}
        printingRuns={printingRuns}
        printedRuns={printedRuns}
        historyRuns={historyRuns}
        canManage={canManage}
        canManageQueue={canManage && !queueQuery.isError}
        canManageRuns={canManage && !listQuery.isError}
        queueError={queueQuery.isError && !queueQuery.data}
        listError={listQuery.isError && !listQuery.data}
        queueStale={queueQuery.isError && Boolean(queueQuery.data)}
        listStale={listQuery.isError && Boolean(listQuery.data)}
        onRetryQueue={() => queueQuery.refetch()}
        onRetryList={() => listQuery.refetch()}
        actionNoteRef={actionNoteRef}
        selection={{
          picked,
          entries: pickedEntries,
          total: pickedTotal,
          hasInvalidQty,
          note,
          createPending: create.isPending,
          onNoteChange: setNote,
          onCreate: () =>
            create.mutate({
              items: pickedEntries.map((q) => ({
                stepId: q.stepId,
                qty: picked[q.stepId]!,
              })),
              note: note.trim() || undefined,
            }),
          onToggle: togglePick,
          onFocusAction: focusRunAction,
          onQtyChange: (entry, qty) =>
            setPicked((prev) => ({ ...prev, [entry.stepId]: qty })),
        }}
        runActions={{
          busy,
          onMarkPrinted: (run) => markPrinted.mutate({ runId: run.id }),
          onCancel: handleCancel,
          onComplete: setCompleting,
        }}
        stationMode={surface === "station"}
      />

      {completableRun && (
        <CompleteRunDialog run={completableRun} onClose={() => setCompleting(null)} />
      )}
    </PageShell>
  );
}

// ============================================================
// Dialog ตัดแยก+ติดป้ายเสร็จ — ปิดขั้นพิมพ์ของทุกงานในรอบ + ฟิล์มเผื่อเข้าคลัง (optional)
// ============================================================

function CompleteRunDialog({ run, onClose }: { run: PrintRun; onClose: () => void }) {
  const [extras, setExtras] = useState<Record<string, { qty: number; label: string }>>(() =>
    Object.fromEntries(run.items.map((i) => [i.id, { qty: 0, label: "" }]))
  );
  const invalidate = usePrintRunInvalidate();
  const complete = useMutationWithInvalidation(trpc.printRun.complete, {
    invalidate,
    onSuccess: () => {
      toast.success(`ปิดรอบ ${run.runNumber} แล้ว`, {
        description: "นับขั้นพิมพ์ฟิล์มของทุกงานในรอบให้แล้ว — ฟิล์มเผื่อเข้าคลังฟิล์มพร้อมรีด",
      });
      onClose();
    },
    onError: (err: { message?: string }) =>
      toast.error("ปิดรอบไม่สำเร็จ", { description: err.message }),
  });

  const totalExtra = run.items.reduce((s, i) => s + (extras[i.id]?.qty ?? 0), 0);

  function handleSubmit() {
    const extraList = run.items
      .map((i) => ({
        itemId: i.id,
        extraQty: extras[i.id]?.qty ?? 0,
        label: extras[i.id]?.label.trim() || undefined,
      }))
      .filter((e) => e.extraQty > 0);
    complete.mutate({
      runId: run.id,
      extras: extraList.length > 0 ? extraList : undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ตัดแยก+ติดป้ายเสร็จ — {run.runNumber}</DialogTitle>
          <DialogDescription>
            กดยืนยันแล้ว: ขั้นพิมพ์ฟิล์มของทุกงานในรอบจะถูกนับให้ · ฟิล์มเผื่อเข้าคลังฟิล์มพร้อมรีด
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {run.items.map((item) => {
            const extra = extras[item.id] ?? { qty: 0, label: "" };
            return (
              <div
                key={item.id}
                className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {item.order.orderNumber}
                      {item.order.title && ` · ${item.order.title}`}
                    </p>
                    <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      พิมพ์ในรอบนี้ {item.qty} ชิ้น
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <label htmlFor={`print-extra-qty-${item.id}`} className="mb-0.5 block text-xs text-muted">
                      ฟิล์มเผื่อ (ชิ้น)
                    </label>
                    <Input
                      id={`print-extra-qty-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={extra.qty}
                      onChange={(e) =>
                        setExtras((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...extra,
                            qty: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          },
                        }))
                      }
                      className={cn(
                        PRINT_RUN_CONTROL_H,
                        "w-24 text-center tabular-nums",
                      )}
                    />
                  </div>
                </div>
                {extra.qty > 0 && (
                  <div className="mt-2">
                    <label htmlFor={`print-extra-label-${item.id}`} className="mb-0.5 block text-xs text-muted">
                      ป้ายลาย
                    </label>
                    <Input
                      id={`print-extra-label-${item.id}`}
                      value={extra.label}
                      maxLength={200}
                      onChange={(e) =>
                        setExtras((prev) => ({
                          ...prev,
                          [item.id]: { ...extra, label: e.target.value },
                        }))
                      }
                      placeholder={`เช่น โลโก้อกซ้าย 8cm ดำ (ว่าง = ลายงาน ${item.order.orderNumber})`}
                      className={PRINT_RUN_CONTROL_H}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogSubmitFooter
          pending={complete.isPending}
          pendingLabel="กำลังปิดรอบ..."
          submitLabel={
            <>ตัดแยก+ติดป้ายเสร็จ{totalExtra > 0 && ` · เผื่อ ${totalExtra} ชิ้น`}</>
          }
          submitIcon={<Scissors />}
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
