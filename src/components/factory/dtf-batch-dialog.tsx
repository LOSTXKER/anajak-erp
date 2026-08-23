"use client";

import { useMemo, useState } from "react";
import { Film, Printer, Scissors, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type QueueEntry = RouterOutput["printRun"]["queue"][number] & {
  operationJobId?: string | null;
  expectedRevision?: number | null;
  operationRevision?: number | null;
  revision?: number | null;
  executionEnabled?: boolean;
};
type PrintRun = RouterOutput["printRun"]["list"][number];
type PrintRunItem = PrintRun["items"][number] & {
  operationJobId?: string | null;
  operationRevision?: number | null;
  productionStep: PrintRun["items"][number]["productionStep"] & {
    id?: string;
    revision?: number;
    executionEnabled?: boolean;
  };
};

type DtfQuantityLine = PrintRunItem["productionStep"]["quantityLines"][number];

function commandId() {
  return globalThis.crypto?.randomUUID?.() ?? `dtf-${Date.now()}-${Math.random()}`;
}

function operationId(entry: QueueEntry): string | null {
  if (entry.operationJobId) return entry.operationJobId;
  return entry.executionEnabled ? entry.stepId : null;
}

function operationRevision(entry: QueueEntry): number | null {
  return (
    entry.expectedRevision ??
    entry.operationRevision ??
    entry.revision ??
    null
  );
}

function runItemRevision(item: PrintRunItem): number | null {
  return (
    item.operationRevision ?? item.productionStep.revision ?? null
  );
}

function isV2Run(run: PrintRun): boolean {
  return run.items.some((raw) => {
    const item = raw as PrintRunItem;
    return Boolean(
      item.operationJobId || item.productionStep.executionEnabled,
    );
  });
}

function runHasCommand(
  run: PrintRun,
  command: "markPrinted" | "cancel" | "complete",
) {
  return run.availableCommands.includes(command);
}

function runLifecycleItems(run: PrintRun) {
  const items = run.items.map((raw) => {
    const item = raw as PrintRunItem;
    const expectedRevision = runItemRevision(item);
    return expectedRevision === null
      ? null
      : { itemId: item.id, expectedRevision };
  });
  return items.some((item) => item === null)
    ? null
    : (items as Array<{ itemId: string; expectedRevision: number }>);
}

function useDtfInvalidate() {
  const utils = trpc.useUtils();
  return async () => {
    await Promise.all([
      utils.printRun.queue.invalidate(),
      utils.printRun.list.invalidate(),
      utils.manufacturing.stationDispatch.invalidate(),
      utils.manufacturing.stationJob.invalidate(),
      utils.manufacturing.workOrder.invalidate(),
      utils.manufacturing.controlList.invalidate(),
      utils.manufacturing.workCenterLoad.invalidate(),
    ]);
  };
}

export function DtfBatchDialog({
  currentOperationId,
  onClose,
}: {
  currentOperationId: string;
  onClose: () => void;
}) {
  const invalidate = useDtfInvalidate();
  const queue = trpc.printRun.queue.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const runs = trpc.printRun.list.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [note, setNote] = useState("");
  const [completeRun, setCompleteRun] = useState<PrintRun | null>(null);
  const [lifecycleCommandIds] = useState(
    () => new Map<string, string>(),
  );

  function lifecycleCommandId(
    runId: string,
    action: "markPrinted" | "cancel",
    items: Array<{ itemId: string; expectedRevision: number }>,
  ) {
    const revisions = [...items]
      .sort((left, right) => left.itemId.localeCompare(right.itemId))
      .map((item) => `${item.itemId}:${item.expectedRevision}`)
      .join("|");
    const key = `${runId}:${action}:${revisions}`;
    const existing = lifecycleCommandIds.get(key);
    if (existing) return existing;
    const created = commandId();
    lifecycleCommandIds.set(key, created);
    return created;
  }

  const v2Queue = useMemo(
    () =>
      (queue.data ?? [])
        .map((entry) => entry as QueueEntry)
        .filter(
          (entry) =>
            operationId(entry) !== null && operationRevision(entry) !== null,
        ),
    [queue.data],
  );
  const activeRuns = useMemo(
    () =>
      (runs.data ?? []).filter(
        (run) =>
          isV2Run(run) &&
          (run.status === "PRINTING" || run.status === "PRINTED"),
      ),
    [runs.data],
  );

  const effectiveSelected = useMemo(() => {
    if (selectionTouched) return selected;
    const current = v2Queue.find(
      (entry) => operationId(entry) === currentOperationId,
    );
    return current ? { [currentOperationId]: current.remaining } : selected;
  }, [currentOperationId, selected, selectionTouched, v2Queue]);

  const create = trpc.printRun.create.useMutation({
    onSuccess: async (run) => {
      toast.success(`เปิดรอบ ${run.runNumber} แล้ว`);
      setSelected({});
      setSelectionTouched(false);
      setNote("");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const markPrinted = trpc.printRun.markPrinted.useMutation({
    onSuccess: async () => {
      toast.success("พิมพ์ฟิล์มจบแล้ว · รอตัดแยกและรายงานผล");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancel = trpc.printRun.cancel.useMutation({
    onSuccess: async () => {
      toast.success("ยกเลิกรอบแล้ว งานกลับเข้าคิว");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedEntries = v2Queue.filter((entry) => {
    const id = operationId(entry);
    return id ? effectiveSelected[id] !== undefined : false;
  });
  const invalidSelection = selectedEntries.some((entry) => {
    const id = operationId(entry)!;
    const qty = effectiveSelected[id] ?? 0;
    return qty < 1 || qty > entry.remaining;
  });

  function openBatch() {
    create.mutate({
      commandId: commandId(),
      items: selectedEntries.map((entry) => ({
        operationJobId: operationId(entry)!,
        expectedRevision: operationRevision(entry)!,
        qty: effectiveSelected[operationId(entry)!]!,
      })),
      note: note.trim() || undefined,
    });
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>รอบพิมพ์ DTF</DialogTitle>
            <DialogDescription>
              งานปัจจุบันถูกเลือกให้ก่อน เพิ่มงานจากคิวเดียวกันได้ แล้วรายงานดี/เสีย/พิมพ์ซ้ำต่อออเดอร์
            </DialogDescription>
          </DialogHeader>

          {(queue.isError && !queue.data) || (runs.isError && !runs.data) ? (
            <QueryError
              message="โหลดคิวหรือรอบพิมพ์ไม่สำเร็จ"
              onRetry={() => {
                void queue.refetch();
                void runs.refetch();
              }}
            />
          ) : queue.isLoading || runs.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-6">
              <section aria-labelledby="dtf-active-title">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-blue-600" />
                  <h3 id="dtf-active-title" className="font-semibold">
                    รอบที่กำลังทำ
                  </h3>
                </div>
                {activeRuns.length === 0 ? (
                  <p className="mt-3 rounded-lg bg-surface-muted px-4 py-3 text-sm text-muted">
                    ยังไม่มีรอบค้าง
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {activeRuns.map((run) => {
                      const revisionItems = runLifecycleItems(run);
                      const canCancel = runHasCommand(run, "cancel");
                      const canMarkPrinted = runHasCommand(
                        run,
                        "markPrinted",
                      );
                      const canComplete = runHasCommand(run, "complete");
                      return (
                        <li
                          key={run.id}
                          className="flex flex-col gap-3 rounded-lg border border-divider p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold">{run.runNumber}</p>
                            <p className="text-sm text-secondary">
                              {run.items.length} งาน · {run.items.reduce((sum, item) => sum + item.qty, 0)} ชิ้น · {run.status === "PRINTING" ? "กำลังพิมพ์" : "รอตัดแยก"}
                            </p>
                            {run.blockedReason ? (
                              <p role="status" className="mt-1 text-sm text-amber-700">
                                {run.blockedReason}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {run.status === "PRINTING" ? (
                              <>
                                {canCancel ? (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      revisionItems &&
                                      cancel.mutate({
                                        runId: run.id,
                                        commandId: lifecycleCommandId(
                                          run.id,
                                          "cancel",
                                          revisionItems,
                                        ),
                                        items: revisionItems,
                                      })
                                    }
                                    disabled={
                                      !revisionItems ||
                                      cancel.isPending ||
                                      markPrinted.isPending
                                    }
                                  >
                                    <XCircle /> ยกเลิกรอบ
                                  </Button>
                                ) : null}
                                {canMarkPrinted ? (
                                  <Button
                                    onClick={() =>
                                      revisionItems &&
                                      markPrinted.mutate({
                                        runId: run.id,
                                        commandId: lifecycleCommandId(
                                          run.id,
                                          "markPrinted",
                                          revisionItems,
                                        ),
                                        items: revisionItems,
                                      })
                                    }
                                    disabled={
                                      !revisionItems ||
                                      cancel.isPending ||
                                      markPrinted.isPending
                                    }
                                  >
                                    <Printer /> พิมพ์จบทั้งม้วน
                                  </Button>
                                ) : null}
                              </>
                            ) : canComplete ? (
                              <Button onClick={() => setCompleteRun(run)}>
                                <Scissors /> ตัดแยกและรายงานผล
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby="dtf-queue-title">
                <div className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-blue-600" />
                  <h3 id="dtf-queue-title" className="font-semibold">
                    เปิดรอบใหม่จากคิว
                  </h3>
                </div>
                {v2Queue.length === 0 ? (
                  <EmptyState
                    density="compact"
                    icon={Film}
                    title="ไม่มีงาน DTF ที่พร้อมเข้ารอบ"
                  />
                ) : (
                  <div className="mt-3 overflow-hidden rounded-lg border border-divider">
                    <ul className="divide-y divide-divider">
                      {v2Queue.map((entry) => {
                        const id = operationId(entry)!;
                        const checked = effectiveSelected[id] !== undefined;
                        return (
                          <li
                            key={id}
                            className="grid gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_8rem] sm:items-center"
                          >
                            <Checkbox
                              checked={checked}
                              onChange={(event) => {
                                setSelectionTouched(true);
                                setSelected((value) => {
                                  const next = { ...effectiveSelected, ...value };
                                  if (event.target.checked) next[id] = entry.remaining;
                                  else delete next[id];
                                  return next;
                                });
                              }}
                              aria-label={`เลือก ${entry.orderNumber}`}
                            />
                            <div className="min-w-0">
                              <p className="font-medium">
                                {entry.orderNumber} · {entry.orderName}
                              </p>
                              <p className="text-xs text-muted">
                                {entry.customerName} · เหลือ {entry.remaining} ชิ้น
                              </p>
                            </div>
                            <NumberInput
                              min={1}
                              max={entry.remaining}
                              integer
                              value={effectiveSelected[id] ?? entry.remaining}
                              onValueChange={(qty) => {
                                setSelectionTouched(true);
                                setSelected((value) => ({
                                  ...effectiveSelected,
                                  ...value,
                                  [id]: qty,
                                }));
                              }}
                              disabled={!checked}
                              aria-label={`จำนวนที่จะพิมพ์ ${entry.orderNumber}`}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <Field label="หมายเหตุรอบพิมพ์ (ถ้ามี)" className="mt-3">
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
              </section>
            </div>
          )}

          <DialogSubmitFooter
            pending={create.isPending}
            disabled={selectedEntries.length === 0 || invalidSelection}
            submitLabel={`เปิดรอบ ${selectedEntries.length} งาน`}
            pendingLabel="กำลังเปิดรอบ..."
            submitIcon={<Printer />}
            onCancel={onClose}
            onSubmit={openBatch}
          />
        </DialogContent>
      </Dialog>

      {completeRun ? (
        <CompleteDtfRunDialog
          run={completeRun}
          onClose={() => setCompleteRun(null)}
          onCompleted={async () => {
            setCompleteRun(null);
            await invalidate();
          }}
        />
      ) : null}
    </>
  );
}

type ItemResult = {
  reprint: number;
  extra: number;
  label: string;
  lines: Record<string, { good: number; scrap: number }>;
};

function defaultLineResults(item: PrintRunItem) {
  let unallocated = item.qty;
  return Object.fromEntries(
    item.productionStep.quantityLines.map((line) => {
      const remaining = Math.max(0, line.qtyPlanned - line.qtyGood);
      const good = Math.min(remaining, unallocated);
      unallocated -= good;
      return [line.id, { good, scrap: 0 }];
    }),
  );
}

function itemTotals(result: ItemResult) {
  return Object.values(result.lines).reduce(
    (total, line) => ({
      good: total.good + line.good,
      scrap: total.scrap + line.scrap,
    }),
    { good: 0, scrap: 0 },
  );
}

function quantityLineLabel(line: DtfQuantityLine) {
  return [
    line.description,
    line.color,
    line.size,
    line.printPosition,
  ]
    .filter(Boolean)
    .join(" · ");
}

function CompleteDtfRunDialog({
  run,
  onClose,
  onCompleted,
}: {
  run: PrintRun;
  onClose: () => void;
  onCompleted: () => Promise<void>;
}) {
  const [submitCommandId] = useState(commandId);
  const [results, setResults] = useState<Record<string, ItemResult>>(() =>
    Object.fromEntries(
      run.items.map((raw) => {
        const item = raw as PrintRunItem;
        return [
          item.id,
          {
            reprint: 0,
            extra: 0,
            label: "",
            lines: defaultLineResults(item),
          },
        ];
      }),
    ),
  );
  const complete = trpc.printRun.complete.useMutation({
    onSuccess: async () => {
      toast.success(`ปิดรอบ ${run.runNumber} แล้ว`);
      await onCompleted();
    },
    onError: (error) => toast.error(error.message),
  });
  const items = run.items.map((item) => item as PrintRunItem);
  const missingRevision = items.some((item) => runItemRevision(item) === null);
  const invalid = items.some((item) => {
    const value = results[item.id]!;
    const totals = itemTotals(value);
    return (
      item.productionStep.quantityLines.length === 0 ||
      Object.values(value.lines).some(
        (line) => line.good < 0 || line.scrap < 0,
      ) ||
      totals.good + totals.scrap <= 0 ||
      totals.good > item.qty ||
      value.reprint < 0 ||
      value.reprint > totals.scrap ||
      value.extra < 0
    );
  });

  function update(itemId: string, patch: Partial<ItemResult>) {
    setResults((value) => ({
      ...value,
      [itemId]: { ...value[itemId]!, ...patch },
    }));
  }

  function updateLine(
    itemId: string,
    lineId: string,
    patch: Partial<{ good: number; scrap: number }>,
  ) {
    setResults((value) => ({
      ...value,
      [itemId]: {
        ...value[itemId]!,
        lines: {
          ...value[itemId]!.lines,
          [lineId]: { ...value[itemId]!.lines[lineId]!, ...patch },
        },
      },
    }));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>ตัดแยกและรายงานผล · {run.runNumber}</DialogTitle>
          <DialogDescription>
            นับฟิล์มดี เสีย และจำนวนที่ต้องพิมพ์ซ้ำแยกทุกออเดอร์ก่อนปิดรอบ
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {items.map((item) => {
            const value = results[item.id]!;
            const totals = itemTotals(value);
            return (
              <fieldset key={item.id} className="rounded-lg border border-divider p-4">
                <legend className="px-1 font-semibold">
                  {item.order.orderNumber} · เป้ารอบนี้ {item.qty} ชิ้น
                </legend>
                <div className="mt-2 space-y-2">
                  {item.productionStep.quantityLines.map((line) => {
                    const lineResult = value.lines[line.id]!;
                    const lineRemaining = Math.max(0, line.qtyPlanned - line.qtyGood);
                    return (
                      <div
                        key={line.id}
                        className="grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-end"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-strong">
                            {quantityLineLabel(line) || "รายการผลิต"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            เหลือรับเป็นงานดี {lineRemaining.toLocaleString("th-TH")} ชิ้น
                          </p>
                        </div>
                        <Field label="ฟิล์มดี">
                          <NumberInput
                            min={0}
                            max={lineRemaining}
                            integer
                            value={lineResult.good}
                            onValueChange={(good) =>
                              updateLine(item.id, line.id, { good })
                            }
                          />
                        </Field>
                        <Field label="ฟิล์มเสีย">
                          <NumberInput
                            min={0}
                            integer
                            value={lineResult.scrap}
                            onValueChange={(scrap) => {
                              updateLine(item.id, line.id, { scrap });
                              if (value.reprint > totals.scrap - lineResult.scrap + scrap) {
                                update(item.id, {
                                  reprint: totals.scrap - lineResult.scrap + scrap,
                                });
                              }
                            }}
                          />
                        </Field>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-divider px-3 py-2 text-sm">
                    <p className="text-xs text-muted">รวมผลรอบนี้</p>
                    <p className="mt-1 font-semibold text-strong">
                      ดี {totals.good.toLocaleString("th-TH")} · เสีย {totals.scrap.toLocaleString("th-TH")}
                    </p>
                  </div>
                  <Field label="ต้องพิมพ์ซ้ำ">
                    <NumberInput
                      min={0}
                      max={totals.scrap}
                      integer
                      value={value.reprint}
                      onValueChange={(reprint) => update(item.id, { reprint })}
                    />
                  </Field>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <Field label="ฟิล์มเผื่อเข้าคลัง">
                    <NumberInput
                      min={0}
                      integer
                      value={value.extra}
                      onValueChange={(extra) => update(item.id, { extra })}
                    />
                  </Field>
                  <Field label="ป้ายฟิล์มเผื่อ">
                    <Input
                      value={value.label}
                      onChange={(event) => update(item.id, { label: event.target.value })}
                      disabled={value.extra === 0}
                    />
                  </Field>
                </div>
              </fieldset>
            );
          })}
        </div>
        {missingRevision ? (
          <p role="alert" className="text-sm text-red-600">
            โหลด revision ของ Operation Job ไม่ครบ กรุณาปิดแล้วเปิดรอบนี้ใหม่
          </p>
        ) : null}
        <DialogSubmitFooter
          pending={complete.isPending}
          disabled={missingRevision || invalid}
          submitLabel="ยืนยันตัดแยกและปิดรอบ"
          pendingLabel="กำลังปิดรอบ..."
          submitIcon={<Scissors />}
          onCancel={onClose}
          onSubmit={() =>
            complete.mutate({
              runId: run.id,
              commandId: submitCommandId,
              results: items.map((item) => ({
                itemId: item.id,
                expectedRevision: runItemRevision(item)!,
                qtyGood: itemTotals(results[item.id]!).good,
                qtyScrap: itemTotals(results[item.id]!).scrap,
                qtyReprint: results[item.id]!.reprint,
                quantityLines: item.productionStep.quantityLines.map((line) => ({
                  quantityLineId: line.id,
                  qtyGood: results[item.id]!.lines[line.id]!.good,
                  qtyScrap: results[item.id]!.lines[line.id]!.scrap,
                })).filter((line) => line.qtyGood + line.qtyScrap > 0),
              })),
              extras: items
                .map((item) => ({
                  itemId: item.id,
                  extraQty: results[item.id]!.extra,
                  label: results[item.id]!.label.trim() || undefined,
                }))
                .filter((item) => item.extraQty > 0),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
