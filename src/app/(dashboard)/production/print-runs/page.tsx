"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import {
  ArrowLeft,
  Printer,
  Film,
  Scissors,
  History,
  Check,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";

// จอช่างพิมพ์ DTF — รอบพิมพ์ฟิล์ม (FLOW-REDESIGN ก้อน 2)
// รวมหลายงานจากคิว (เฉพาะงานไฟล์พร้อม) ลงม้วนเดียว → พิมพ์จบทั้งม้วน → ตัดแยก+ติดป้ายเสร็จ
// จุดตัดแยกคือด่านบังคับกันฟิล์มสลับออเดอร์ — ขั้น DTF_PRINT ของงานสมาชิกถูกนับ/ปิดตอนนั้นเอง
// ฟิล์มพิมพ์เผื่อ (กรอกตอนปิดรอบ) เข้าคลังฟิล์มพร้อมรีด · ไม่มีเงินบนหน้านี้ (มติเลิกคิดต้นทุนต่องาน)

type PrintRun = RouterOutput["printRun"]["list"][number];
type QueueEntry = RouterOutput["printRun"]["queue"][number];

const RUN_STATUS_BADGE: Record<
  string,
  { label: string; variant: "warning" | "accent" | "success" | "default" }
> = {
  PRINTING: { label: "กำลังพิมพ์", variant: "warning" },
  PRINTED: { label: "รอตัดแยก+ติดป้าย", variant: "accent" },
  COMPLETED: { label: "เสร็จแล้ว", variant: "success" },
  CANCELLED: { label: "ยกเลิก", variant: "default" },
};

const runTotalQty = (run: PrintRun) => run.items.reduce((s, i) => s + i.qty, 0);

// chip กำหนดส่ง — แดงเมื่อเลยกำหนด (pattern เดียวกับ my-tasks)
function DeadlineChip({ deadline }: { deadline: Date | string | null }) {
  if (!deadline) return null;
  const overdue = new Date(deadline) < new Date();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        overdue
          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {overdue ? "เลยกำหนด " : "กำหนด "}
      {formatDate(deadline)}
    </span>
  );
}

// กล่อง section จอ ops (pattern TaskSection ใน my-tasks)
function BlockSection({
  icon: Icon,
  title,
  count,
  hint,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  count: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        {hint && <span className="hidden text-xs text-slate-400 sm:inline">{hint}</span>}
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

// invalidate ชุดเดียวกันทุก mutation บนหน้านี้ — คิว/รอบ/บอร์ดผลิต/งานของฉัน ต้องไม่ stale
function usePrintRunInvalidate() {
  const utils = trpc.useUtils();
  return [utils.printRun.queue, utils.printRun.list, utils.production.kanban, utils.task.myToday];
}

export default function PrintRunsPage() {
  const confirm = useConfirm();
  const queueQuery = trpc.printRun.queue.useQuery();
  const listQuery = trpc.printRun.list.useQuery();
  const invalidate = usePrintRunInvalidate();

  // งานที่เลือกเข้ารอบ: stepId → จำนวนที่จะพิมพ์รอบนี้
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [completing, setCompleting] = useState<PrintRun | null>(null);

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

  if (queueQuery.isLoading || listQuery.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="รอบพิมพ์ฟิล์ม DTF" description="รวมหลายงานลงม้วนเดียว แล้วกดเป็นจังหวะชุด" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  const queue = queueQuery.data ?? [];
  const runs = listQuery.data ?? [];
  const activeRuns = runs.filter((r) => r.status === "PRINTING" || r.status === "PRINTED");
  const historyRuns = runs.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");

  const pickedEntries = queue.filter((q) => picked[q.stepId] !== undefined);
  const pickedTotal = pickedEntries.reduce((s, q) => s + (picked[q.stepId] ?? 0), 0);
  const hasInvalidQty = pickedEntries.some((q) => {
    const qty = picked[q.stepId] ?? 0;
    if (!Number.isInteger(qty) || qty < 1) return true;
    return q.remaining > 0 && qty > q.remaining;
  });

  function togglePick(entry: QueueEntry) {
    setPicked((prev) => {
      const next = { ...prev };
      if (entry.stepId in next) delete next[entry.stepId];
      else next[entry.stepId] = entry.remaining > 0 ? entry.remaining : 1;
      return next;
    });
  }

  const busy = markPrinted.isPending || cancelRun.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        title="รอบพิมพ์ฟิล์ม DTF"
        description="รวมหลายงานลงม้วนเดียว → พิมพ์จบทั้งม้วน → ตัดแยก+ติดป้ายปิดรอบ"
        action={
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/production">
              <ArrowLeft className="h-4 w-4" />
              หน้าการผลิต
            </Link>
          </Button>
        }
      />

      {/* ── รอบค้าง — กำลังพิมพ์ / รอตัดแยก+ติดป้าย ── */}
      <BlockSection icon={Printer} title="รอบค้าง" count={activeRuns.length}>
        {/* query พัง (เน็ต/สิทธิ์) ต้องบอกตรงๆ + ปุ่มลองใหม่ — ห้ามโชว์ "ว่าง" หลอก */}
        {listQuery.isError ? (
          <QueryError onRetry={() => listQuery.refetch()} />
        ) : activeRuns.length === 0 ? (
          <EmptyState
            icon={Printer}
            title="ยังไม่มีรอบค้าง"
            description="เลือกงานจากคิวพิมพ์ด้านล่างเพื่อเปิดรอบพิมพ์ม้วนใหม่"
          />
        ) : (
          <div className="space-y-3 p-3">
            {activeRuns.map((run) => (
              <ActiveRunCard
                key={run.id}
                run={run}
                busy={busy}
                onMarkPrinted={() => markPrinted.mutate({ runId: run.id })}
                onCancel={() => handleCancel(run)}
                onComplete={() => setCompleting(run)}
              />
            ))}
          </div>
        )}
      </BlockSection>

      {/* ── คิวพิมพ์ฟิล์ม — เฉพาะงานไฟล์พร้อม เรียงตามกำหนดส่ง ── */}
      <BlockSection
        icon={Film}
        title="คิวพิมพ์ฟิล์ม"
        count={queue.length}
        hint="เฉพาะงานไฟล์พร้อม · เรียงตามกำหนดส่ง"
      >
        {queueQuery.isError ? (
          <QueryError onRetry={() => queueQuery.refetch()} />
        ) : queue.length === 0 ? (
          <EmptyState
            icon={Film}
            title="คิวพิมพ์ว่าง"
            description="งานขั้นพิมพ์ฟิล์ม DTF ที่แบบอนุมัติแล้วจะเข้าคิวที่นี่เอง"
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {queue.map((entry) => (
              <QueueRow
                key={entry.stepId}
                entry={entry}
                qty={picked[entry.stepId]}
                onToggle={() => togglePick(entry)}
                onQtyChange={(qty) =>
                  setPicked((prev) => ({ ...prev, [entry.stepId]: qty }))
                }
              />
            ))}
          </ul>
        )}
      </BlockSection>

      {/* ── ประวัติรอบ 7 วันล่าสุด ── */}
      <BlockSection icon={History} title="ประวัติรอบ (7 วันล่าสุด)" count={historyRuns.length}>
        {listQuery.isError ? (
          <QueryError onRetry={() => listQuery.refetch()} />
        ) : historyRuns.length === 0 ? (
          <EmptyState
            icon={History}
            title="ยังไม่มีประวัติรอบใน 7 วันล่าสุด"
            description="รอบที่ปิดเสร็จหรือยกเลิกแล้วจะมาแสดงที่นี่"
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {historyRuns.map((run) => {
              const badge = RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.CANCELLED;
              const extraTotal = run.items.reduce((s, i) => s + i.extraQty, 0);
              return (
                <li key={run.id} className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {run.runNumber}
                  </span>
                  <Badge variant={badge.variant} size="sm">
                    {badge.label}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {run.items.length} งาน · รวม {runTotalQty(run)} ชิ้น
                    {extraTotal > 0 && ` · เผื่อ ${extraTotal} ชิ้น`}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {formatDateTime(run.completedAt ?? run.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </BlockSection>

      {/* ── แถบเปิดรอบ sticky ล่างจอ — โผล่เมื่อเลือกงานแล้ว (pattern เดียวกับ orders/new) ── */}
      {pickedEntries.length > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-400">เข้ารอบพิมพ์ม้วนนี้</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
              เลือก {pickedEntries.length} งาน · รวม {pickedTotal} ชิ้น
            </p>
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="โน้ตรอบ เช่น ม้วนที่ 2 เครื่องซ้าย (ไม่บังคับ)"
            className="order-3 h-11 w-full sm:order-none sm:w-64"
          />
          <Button
            disabled={create.isPending || hasInvalidQty || pickedTotal < 1}
            onClick={() =>
              create.mutate({
                items: pickedEntries.map((q) => ({ stepId: q.stepId, qty: picked[q.stepId]! })),
                note: note.trim() || undefined,
              })
            }
            className="h-11 gap-1.5"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            เปิดรอบพิมพ์
          </Button>
        </div>
      )}

      {completing && (
        <CompleteRunDialog run={completing} onClose={() => setCompleting(null)} />
      )}
    </div>
  );
}

// ============================================================
// การ์ดรอบ active — PRINTING: พิมพ์จบทั้งม้วน/ยกเลิก · PRINTED: ตัดแยก+ติดป้ายเสร็จ
// ============================================================

function ActiveRunCard({
  run,
  busy,
  onMarkPrinted,
  onCancel,
  onComplete,
}: {
  run: PrintRun;
  busy: boolean;
  onMarkPrinted: () => void;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const badge = RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.PRINTING;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-slate-900 dark:text-white">
          {run.runNumber}
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="ml-auto text-xs tabular-nums text-slate-400">
          {run.items.length} งาน · รวม {runTotalQty(run)} ชิ้น
        </span>
      </div>
      {run.note && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{run.note}</p>
      )}

      <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
        {run.items.map((item) => (
          <li key={item.id} className="flex min-h-[44px] items-center gap-3 px-3 py-2">
            <span className="shrink-0 text-sm font-medium text-slate-900 dark:text-white">
              {item.order.orderNumber}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {item.order.title ?? ""}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">
              {item.qty} ชิ้น
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-slate-400">
        เปิดรอบโดย {run.createdBy.name} · {formatDateTime(run.createdAt)}
        {run.printedAt && ` · พิมพ์จบ ${formatDateTime(run.printedAt)}`}
      </p>

      <div className="mt-3 flex gap-2">
        {run.status === "PRINTING" ? (
          <>
            <Button disabled={busy} onClick={onMarkPrinted} className="h-11 flex-1 gap-1.5">
              <Printer className="h-4 w-4" />
              พิมพ์จบทั้งม้วน
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={onCancel}
              className="h-11 text-red-600 hover:text-red-700"
            >
              ยกเลิกรอบ
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={onComplete} className="h-11 w-full gap-1.5">
            <Scissors className="h-4 w-4" />
            ตัดแยก+ติดป้ายเสร็จ
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// แถวคิวพิมพ์ — กดทั้งแถวเพื่อเลือกเข้ารอบ · เลือกแล้วแก้จำนวนที่จะพิมพ์รอบนี้ได้
// ============================================================

function QueueRow({
  entry,
  qty,
  onToggle,
  onQtyChange,
}: {
  entry: QueueEntry;
  qty: number | undefined;
  onToggle: () => void;
  onQtyChange: (qty: number) => void;
}) {
  const selected = qty !== undefined;
  const cap = entry.remaining > 0 ? entry.remaining : undefined;
  const invalid =
    selected && (!Number.isInteger(qty) || qty < 1 || (cap !== undefined && qty > cap));
  return (
    <li
      onClick={onToggle}
      className={cn(
        "flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
        selected
          ? "bg-blue-50/60 dark:bg-blue-950/20"
          : "hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/50 dark:active:bg-slate-800"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          selected
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
          {entry.orderNumber}
          {entry.orderName && ` · ${entry.orderName}`}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {entry.customerName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <DeadlineChip deadline={entry.dueDate} />
          <span className="text-[11px] tabular-nums text-slate-400">
            {entry.qtyTotal > 0
              ? `พิมพ์แล้ว ${entry.qtyDone}/${entry.qtyTotal} · เหลือ ${entry.remaining}`
              : "ไม่ระบุจำนวน"}
          </span>
        </div>
      </div>
      {selected ? (
        // ช่องจำนวน — หยุด event ไม่ให้ไปสลับ checkbox ของแถว
        <div className="shrink-0 text-right" onClick={(e) => e.stopPropagation()}>
          <label className="mb-0.5 block text-[10px] text-slate-400">พิมพ์รอบนี้ (ชิ้น)</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={cap}
            value={qty}
            onChange={(e) => onQtyChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className={cn(
              "h-10 w-24 text-center tabular-nums",
              invalid && "border-red-300 focus-visible:ring-red-400"
            )}
          />
        </div>
      ) : (
        <span className="shrink-0 text-sm tabular-nums text-slate-500 dark:text-slate-400">
          {entry.remaining > 0 ? `${entry.remaining} ชิ้น` : "—"}
        </span>
      )}
    </li>
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
            ยืนยันว่าตัดแยกฟิล์มและติดป้ายครบทุกออเดอร์แล้ว — ขั้นพิมพ์ฟิล์มของงานในรอบจะถูกนับให้
            · ฟิล์มที่พิมพ์เผื่อจะเข้าคลังฟิล์มพร้อมรีดไว้ใช้รอบหน้า
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
                    <label className="mb-0.5 block text-[10px] text-slate-400">
                      ฟิล์มเผื่อ (ชิ้น)
                    </label>
                    <Input
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
                      className="h-10 w-24 text-center tabular-nums"
                    />
                  </div>
                </div>
                {extra.qty > 0 && (
                  <div className="mt-2">
                    <label className="mb-0.5 block text-[10px] text-slate-400">
                      ป้ายลาย — เขียนให้รู้ว่าฟิล์มม้วนไหนคือลายอะไร
                    </label>
                    <Input
                      value={extra.label}
                      maxLength={200}
                      onChange={(e) =>
                        setExtras((prev) => ({
                          ...prev,
                          [item.id]: { ...extra, label: e.target.value },
                        }))
                      }
                      placeholder={`เช่น โลโก้อกซ้าย 8cm ดำ (ว่าง = ลายงาน ${item.order.orderNumber})`}
                      className="h-10"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button disabled={complete.isPending} onClick={handleSubmit} className="gap-1.5">
            {complete.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Scissors className="h-4 w-4" />
            )}
            ตัดแยก+ติดป้ายเสร็จ{totalExtra > 0 && ` · เผื่อ ${totalExtra} ชิ้น`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
