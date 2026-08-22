"use client";

import type { ComponentType, ReactNode, RefObject } from "react";
import type { RouterOutput } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Alert } from "@/components/ui/alert";
import { formatDate, formatDateTime, cn, isImageUrl } from "@/lib/utils";
import { FOCUS_BUTTON, FOCUS_FIELD_INVALID, FOCUS_INSET, TINT } from "@/components/ui/tokens";
import {
  Printer,
  Film,
  Scissors,
  History,
  Check,
  Loader2,
  Clock,
  AlertTriangle,
  ImageOff,
} from "lucide-react";

export type PrintRun = RouterOutput["printRun"]["list"][number];
export type QueueEntry = RouterOutput["printRun"]["queue"][number];

const RUN_STATUS_BADGE: Record<
  string,
  { label: string; variant: "warning" | "accent" | "success" | "default" }
> = {
  PRINTING: { label: "กำลังพิมพ์", variant: "warning" },
  PRINTED: { label: "รอตัดแยก+ติดป้าย", variant: "accent" },
  COMPLETED: { label: "เสร็จแล้ว", variant: "success" },
  CANCELLED: { label: "ยกเลิก", variant: "default" },
};

const runTotalQty = (run: PrintRun) => run.items.reduce((sum, item) => sum + item.qty, 0);
export const PRINT_RUN_CONTROL_H = "h-11 min-h-11 sm:h-11 sm:min-h-11";

function DeadlineChip({ deadline }: { deadline: Date | string | null }) {
  if (!deadline) return null;
  const overdue = new Date(deadline) < new Date();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        overdue
          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {overdue ? "เลยกำหนด " : "กำหนด "}
      {formatDate(deadline)}
    </span>
  );
}

function DesignThumb({
  design,
  size = "md",
}: {
  design: { versionNumber: number; fileUrl: string; thumbnailUrl: string | null } | null;
  size?: "md" | "sm";
}) {
  if (!design) return null;
  const img = [design.thumbnailUrl, design.fileUrl].find(isImageUrl) ?? null;
  const box = size === "md" ? "h-14 w-14" : "h-11 w-11";
  return (
    <a
      href={design.fileUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`เปิดไฟล์ลาย v${design.versionNumber}`}
      title={`เปิดไฟล์ลาย v${design.versionNumber}`}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-divider transition-opacity hover:opacity-90",
        FOCUS_BUTTON,
      )}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={`ลาย v${design.versionNumber}`}
          loading="lazy"
          decoding="async"
          className={cn(box, "bg-white object-contain")}
        />
      ) : (
        <div className={cn(box, "flex items-center justify-center bg-slate-50 text-slate-300 dark:bg-slate-800")}>
          <ImageOff className="h-4 w-4" />
        </div>
      )}
      <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-2xs font-semibold tabular-nums text-white">
        v{design.versionNumber}
      </span>
    </a>
  );
}

function BlockSection({
  icon: Icon,
  title,
  count,
  hint,
  stage,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  count: number;
  hint?: string;
  stage?: "printing" | "printed";
  children: ReactNode;
}) {
  return (
    <section
      data-print-run-stage={stage}
      className="card-surface overflow-clip rounded-lg"
    >
      <div className="flex items-center gap-2 border-b border-divider px-4 py-3">
        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-strong">{title}</h2>
        {hint && <span className="hidden text-xs text-muted xl:inline">{hint}</span>}
        <span className="ml-auto rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium tabular-nums text-secondary">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function StaleDataWarning({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="status"
      className={cn(TINT.warning, "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs")}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">ข้อมูลเดิมยังแสดงอยู่ แต่อาจไม่ใช่สถานะล่าสุด</span>
      <Button variant="ghost" size="sm" onClick={onRetry} className="shrink-0">
        ลองใหม่
      </Button>
    </div>
  );
}

type PrintRunSelectionView = {
  picked: Readonly<Record<string, number>>;
  entries: readonly QueueEntry[];
  total: number;
  hasInvalidQty: boolean;
  note: string;
  createPending: boolean;
  onNoteChange: (value: string) => void;
  onCreate: () => void;
  onToggle: (entry: QueueEntry) => void;
  onFocusAction: () => void;
  onQtyChange: (entry: QueueEntry, qty: number) => void;
};

type PrintRunActionsView = {
  busy: boolean;
  onMarkPrinted: (run: PrintRun) => void;
  onCancel: (run: PrintRun) => void;
  onComplete: (run: PrintRun) => void;
};

export function PrintRunsPageView({
  queue,
  printingRuns,
  printedRuns,
  historyRuns,
  canManage,
  canManageQueue = canManage,
  canManageRuns = canManage,
  queueError,
  listError,
  queueStale = false,
  listStale = false,
  onRetryQueue,
  onRetryList,
  actionNoteRef,
  selection,
  runActions,
  stationMode = false,
}: {
  queue: readonly QueueEntry[];
  printingRuns: readonly PrintRun[];
  printedRuns: readonly PrintRun[];
  historyRuns: readonly PrintRun[];
  canManage: boolean;
  canManageQueue?: boolean;
  canManageRuns?: boolean;
  queueError: boolean;
  listError: boolean;
  queueStale?: boolean;
  listStale?: boolean;
  onRetryQueue: () => void;
  onRetryList: () => void;
  actionNoteRef: RefObject<HTMLInputElement | null>;
  selection: PrintRunSelectionView;
  runActions: PrintRunActionsView;
  stationMode?: boolean;
}) {
  return (
    <>
      <div
        data-print-run-workspace=""
        className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,4fr)_minmax(0,6fr)] xl:grid-cols-[minmax(22rem,5fr)_minmax(0,7fr)]"
      >
        {/* ลำดับ DOM ตั้งใจให้ตรงทางเดินหน้างานบนมือถือ: พิมพ์ → ตัดแยก → คิว */}
        <div data-print-run-stages="" className="space-y-4">
          {listError ? (
            <BlockSection icon={Printer} title="รอบพิมพ์ที่กำลังเดิน" count={0}>
              <QueryError onRetry={onRetryList} />
            </BlockSection>
          ) : (
            <>
              {listStale && <StaleDataWarning onRetry={onRetryList} />}
              <RunStageSection
                stage="printing"
                runs={printingRuns}
                busy={runActions.busy}
                canManage={canManageRuns}
                onMarkPrinted={runActions.onMarkPrinted}
                onCancel={runActions.onCancel}
                onComplete={runActions.onComplete}
              />
              <RunStageSection
                stage="printed"
                runs={printedRuns}
                busy={runActions.busy}
                canManage={canManageRuns}
                onMarkPrinted={runActions.onMarkPrinted}
                onCancel={runActions.onCancel}
                onComplete={runActions.onComplete}
              />
            </>
          )}
        </div>

        {/* คิวคงลำดับกำหนดส่งจาก service — ไม่เรียงซ้ำใน client */}
        <div data-print-run-queue="">
          <BlockSection
            icon={Film}
            title="คิวพิมพ์ฟิล์ม"
            count={queue.length}
            hint="เฉพาะงานไฟล์พร้อม · เรียงตามกำหนดส่ง"
          >
            {queueStale && <StaleDataWarning onRetry={onRetryQueue} />}
            {queueError ? (
              <QueryError onRetry={onRetryQueue} />
            ) : queue.length === 0 ? (
              <EmptyState
                icon={Film}
                title="คิวพิมพ์ว่าง"
                description="งานขั้นพิมพ์ฟิล์ม DTF ที่แบบอนุมัติแล้วจะเข้าคิวที่นี่เอง"
                density="compact"
              />
            ) : (
              <>
                {/* อยู่ก่อน list เพื่อให้ sticky ตามช่างทันที แม้เลือกแถวล่างของคิวยาว */}
                {canManageQueue && selection.entries.length > 0 && (
                  <div
                    data-print-run-selection-bar=""
                    className={cn(
                      "card-surface sticky z-20 m-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-3 backdrop-blur",
                      // Station header มีทั้งแถวชื่อจอและแถบเลือกสถานี (~124px)
                      // จึงต้องเกาะใต้ header ไม่ถูก z-30 บังตอนคิวยาว
                      stationMode ? "top-32" : "top-3",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">เข้ารอบพิมพ์ม้วนนี้</p>
                      <p
                        aria-live="polite"
                        aria-atomic="true"
                        className="text-sm font-semibold tabular-nums text-strong"
                      >
                        เลือก {selection.entries.length} งาน · รวม {selection.total} ชิ้น
                      </p>
                    </div>
                    <Input
                      ref={actionNoteRef}
                      value={selection.note}
                      onChange={(event) => selection.onNoteChange(event.target.value)}
                      maxLength={500}
                      aria-label="โน้ตรอบพิมพ์"
                      placeholder="โน้ตรอบ เช่น ม้วนที่ 2 เครื่องซ้าย (ไม่บังคับ)"
                      className={cn(
                        PRINT_RUN_CONTROL_H,
                        "order-3 w-full sm:order-none sm:w-64",
                      )}
                    />
                    <Button
                      disabled={
                        selection.createPending ||
                        selection.hasInvalidQty ||
                        selection.total < 1
                      }
                      aria-busy={selection.createPending || undefined}
                      onClick={selection.onCreate}
                      className={cn(PRINT_RUN_CONTROL_H, "gap-1.5")}
                    >
                      {selection.createPending ? (
                        <>
                          <Loader2
                            aria-hidden="true"
                            className="animate-spin motion-reduce:animate-none"
                          />
                          กำลังเปิดรอบ…
                        </>
                      ) : (
                        <>
                          <Printer />
                          เปิดรอบพิมพ์
                        </>
                      )}
                    </Button>
                  </div>
                )}
                <ul data-print-run-queue-list="" className="divide-y divide-divider">
                  {queue.map((entry) => (
                    <QueueRow
                      key={entry.stepId}
                      entry={entry}
                      canManage={canManageQueue}
                      qty={selection.picked[entry.stepId]}
                      onToggle={() => selection.onToggle(entry)}
                      onFocusAction={selection.onFocusAction}
                      onQtyChange={(qty) => selection.onQtyChange(entry, qty)}
                    />
                  ))}
                </ul>
              </>
            )}
          </BlockSection>
        </div>
      </div>

      <div data-print-run-history="">
        <BlockSection icon={History} title="ประวัติ 7 วัน" count={historyRuns.length}>
          {listError ? (
            <QueryError onRetry={onRetryList} />
          ) : historyRuns.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">
              ยังไม่มีรอบที่ปิดเสร็จหรือยกเลิกใน 7 วันล่าสุด
            </p>
          ) : (
            <ul className="divide-y divide-divider">
              {historyRuns.map((run) => {
                const badge = RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.CANCELLED;
                const extraTotal = run.items.reduce((sum, item) => sum + item.extraQty, 0);
                return (
                  <li key={run.id} className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="text-sm font-medium text-strong">{run.runNumber}</span>
                    <Badge variant={badge.variant} size="sm">
                      {badge.label}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-xs tabular-nums text-muted">
                      {run.items.length} งาน · รวม {runTotalQty(run)} ชิ้น
                      {extraTotal > 0 && ` · เผื่อ ${extraTotal} ชิ้น`}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {formatDateTime(run.completedAt ?? run.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </BlockSection>
      </div>
    </>
  );
}

function RunStageSection({
  stage,
  runs,
  busy,
  canManage,
  onMarkPrinted,
  onCancel,
  onComplete,
}: {
  stage: "printing" | "printed";
  runs: readonly PrintRun[];
  busy: boolean;
  canManage: boolean;
  onMarkPrinted: (run: PrintRun) => void;
  onCancel: (run: PrintRun) => void;
  onComplete: (run: PrintRun) => void;
}) {
  const printing = stage === "printing";
  return (
    <BlockSection
      stage={stage}
      icon={printing ? Printer : Scissors}
      title={printing ? "กำลังพิมพ์" : "รอตัดแยก + ติดป้าย"}
      count={runs.length}
    >
      {runs.length === 0 ? (
        <div className="flex min-h-16 items-center gap-3 px-4 py-4">
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              printing ? "bg-slate-300 dark:bg-slate-700" : "bg-blue-200 dark:bg-blue-900",
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-strong">
              {printing ? "ตอนนี้เครื่องยังไม่มีรอบพิมพ์" : "ไม่มีรอบที่รอตัดแยก"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {printing
                ? "เลือกงานจากคิวเพื่อเปิดรอบม้วนใหม่"
                : "รอบที่กดพิมพ์จบจะย้ายมาอยู่ตรงนี้"}
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-divider">
          {runs.map((run) => (
            <ActiveRunCard
              key={run.id}
              run={run}
              busy={busy}
              canManage={canManage}
              onMarkPrinted={() => onMarkPrinted(run)}
              onCancel={() => onCancel(run)}
              onComplete={() => onComplete(run)}
            />
          ))}
        </div>
      )}
    </BlockSection>
  );
}

function ActiveRunCard({
  run,
  busy,
  onMarkPrinted,
  onCancel,
  onComplete,
  canManage,
}: {
  run: PrintRun;
  busy: boolean;
  onMarkPrinted: () => void;
  onCancel: () => void;
  onComplete: () => void;
  canManage: boolean;
}) {
  const badge = RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.PRINTING;
  const canAdvance = canManage && !run.blockedReason;
  const canCancelForRecovery = canManage && run.status === "PRINTING";
  return (
    <article className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-strong">{run.runNumber}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="ml-auto text-xs tabular-nums text-muted">
          {run.items.length} งาน · รวม {runTotalQty(run)} ชิ้น
        </span>
      </div>
      {run.note && <p className="mt-1 text-xs text-muted">{run.note}</p>}

      {run.blockedReason && (
        <Alert variant="error" icon={AlertTriangle} className="mt-3 rounded-lg px-3 py-2">
          <span>{run.blockedReason} — กลับไปตรวจสถานะออเดอร์ก่อน</span>
        </Alert>
      )}

      <ul className="mt-3 divide-y divide-divider overflow-hidden rounded-xl bg-surface-muted">
        {run.items.map((item) => (
          <li
            key={item.id}
            className="grid min-h-[60px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
          >
            <DesignThumb design={item.order.designs[0] ?? null} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-strong">{item.order.orderNumber}</p>
              {item.order.title && <p className="truncate text-xs text-muted">{item.order.title}</p>}
            </div>
            <span className="shrink-0 text-sm tabular-nums text-secondary">{item.qty} ชิ้น</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted">
        เปิดรอบโดย {run.createdBy.name} · {formatDateTime(run.createdAt)}
        {run.printedAt && ` · พิมพ์จบ ${formatDateTime(run.printedAt)}`}
      </p>

      {(canAdvance || canCancelForRecovery) && (
        <div className="mt-3 flex flex-col gap-2 xl:flex-row">
          {run.status === "PRINTING" ? (
            <>
              {canAdvance && (
                <Button
                  disabled={busy}
                  onClick={onMarkPrinted}
                  className={cn(PRINT_RUN_CONTROL_H, "flex-1 gap-1.5")}
                >
                  <Printer />
                  พิมพ์จบทั้งม้วน
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={onCancel}
                className={cn(
                  PRINT_RUN_CONTROL_H,
                  !canAdvance && "w-full",
                  "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
                )}
              >
                ยกเลิกรอบ
              </Button>
            </>
          ) : canAdvance ? (
            <Button
              disabled={busy}
              onClick={onComplete}
              className={cn(PRINT_RUN_CONTROL_H, "w-full gap-1.5")}
            >
              <Scissors />
              ตัดแยก+ติดป้ายเสร็จ
            </Button>
          ) : null}
        </div>
      )}
    </article>
  );
}

function QueueRow({
  entry,
  qty,
  onToggle,
  onFocusAction,
  onQtyChange,
  canManage,
}: {
  entry: QueueEntry;
  qty: number | undefined;
  onToggle: () => void;
  onFocusAction: () => void;
  onQtyChange: (qty: number) => void;
  canManage: boolean;
}) {
  const selected = canManage && qty !== undefined;
  const cap = entry.remaining > 0 ? entry.remaining : undefined;
  const invalid =
    selected && (!Number.isInteger(qty) || qty < 1 || (cap !== undefined && qty > cap));
  const invalidMessage = invalid
    ? cap !== undefined
      ? `ใส่จำนวน 1–${cap} ชิ้น`
      : "ใส่จำนวนอย่างน้อย 1 ชิ้น"
    : null;
  const errorId = `print-run-qty-error-${entry.stepId}`;
  const details = (
    <div className="min-w-0 flex-1 text-left">
      <p className="truncate text-sm font-medium text-strong">
        {entry.orderNumber}
        {entry.orderName && ` · ${entry.orderName}`}
      </p>
      <p className="truncate text-xs text-muted">{entry.customerName}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <DeadlineChip deadline={entry.dueDate} />
        <span className="text-xs tabular-nums text-muted">
          {entry.qtyTotal > 0
            ? `พิมพ์แล้ว ${entry.qtyDone}/${entry.qtyTotal} · เหลือ ${entry.remaining}`
            : "ไม่ระบุจำนวน"}
        </span>
      </div>
    </div>
  );
  return (
    <li
      data-print-run-queue-row={entry.stepId}
      className={cn(
        "relative grid min-h-[80px] grid-cols-[auto_minmax(0,1fr)_auto] items-center transition-colors",
        selected ? "bg-interactive-selected" : "",
      )}
    >
      <div className="py-3 pl-4">
        <DesignThumb design={entry.design} />
      </div>
      {canManage ? (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          aria-label={`${selected ? "นำออกจาก" : "เพิ่มเข้า"}รอบพิมพ์ ${entry.orderNumber}`}
          className={cn(
            "flex min-h-[80px] min-w-0 items-center gap-3 px-3 py-3 text-left hover:bg-interactive-hover active:bg-interactive-pressed",
            FOCUS_INSET,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-border-strong bg-surface",
            )}
          >
            {selected && <Check className="h-3.5 w-3.5" />}
          </span>
          {details}
        </button>
      ) : (
        <div className="flex min-h-[80px] min-w-0 items-center px-3 py-3">{details}</div>
      )}
      {selected ? (
        <div className="col-span-2 col-start-2 flex items-end justify-between gap-3 px-3 pb-3 sm:col-span-1 sm:col-start-3 sm:block sm:px-4 sm:py-3 sm:text-right">
          <label htmlFor={`print-run-qty-${entry.stepId}`} className="mb-0.5 block text-xs text-muted">
            พิมพ์รอบนี้ (ชิ้น)
          </label>
          <div>
            <Input
              id={`print-run-qty-${entry.stepId}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={cap}
              value={qty}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? errorId : undefined}
              onChange={(event) =>
                onQtyChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))
              }
              className={cn(
                PRINT_RUN_CONTROL_H,
                "w-24 text-center tabular-nums",
                invalid && cn("border-red-300", FOCUS_FIELD_INVALID),
              )}
            />
            {invalidMessage && (
              <p id={errorId} role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
                {invalidMessage}
              </p>
            )}
          </div>
        </div>
      ) : (
        <span className="shrink-0 py-3 pr-4 text-sm tabular-nums text-muted">
          {entry.remaining > 0 ? `${entry.remaining} ชิ้น` : "—"}
        </span>
      )}
      {selected && (
        <button
          type="button"
          onClick={onFocusAction}
          className={cn(
            FOCUS_BUTTON,
            "sr-only focus:not-sr-only focus:absolute focus:bottom-3 focus:right-3 focus:z-30 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-strong",
          )}
        >
          ไปที่แถบเปิดรอบ
        </button>
      )}
    </li>
  );
}
