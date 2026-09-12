"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, Scissors } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { QueryError } from "@/components/ui/query-error";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  operationsBack,
  operationsHref,
  type OperationsOrigin,
} from "./operations-navigation";

type Run = RouterOutput["printRun"]["list"][number];
const RUN_LABEL: Record<string, string> = {
  PRINTING: "กำลังพิมพ์",
  PRINTED: "รอตัดแยกและติดป้าย",
  COMPLETED: "ตัดแยกเสร็จแล้ว",
  CANCELLED: "ยกเลิกรอบแล้ว",
};

export function PrintRunsPage({
  origin,
  runNumber,
}: {
  origin?: OperationsOrigin;
  runNumber?: string;
}) {
  const me = trpc.user.me.useQuery();
  const queue = trpc.printRun.queue.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const runs = trpc.printRun.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const sync = async () => {
    await Promise.all([
      utils.printRun.queue.invalidate(),
      utils.printRun.list.invalidate(),
      utils.filmStock.list.invalidate(),
      utils.production.getById.invalidate(),
      utils.production.kanban.invalidate(),
      utils.factory.stationQueue.invalidate(),
      utils.factory.board.invalidate(),
    ]);
  };
  const create = trpc.printRun.create.useMutation({
    onSuccess: async () => {
      setSelected({});
      setNote("");
      await sync();
      toast.success("เปิดรอบพิมพ์แล้ว — พิมพ์เสร็จทั้งม้วนจึงกดยืนยัน");
    },
  });
  const canOperate = permAllows(me.data?.permissions, "manage_production");
  const fresh =
    !!queue.data &&
    !queue.isFetching &&
    !queue.isError &&
    !!me.data &&
    !me.isError;
  const items = Object.entries(selected).map(([stepId, qty]) => ({
    stepId,
    qty: Number(qty),
  }));
  const openedRun = runs.data?.find((run) => run.runNumber === runNumber);
  const invalid = items.some((item) => {
    const row = queue.data?.find((entry) => entry.stepId === item.stepId);
    return (
      !row ||
      row.executionEnabled ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > row.remaining
    );
  });
  return (
    <PageShell
      title="รอบพิมพ์ DTF"
      icon={Printer}
      back={operationsBack(origin)}
      action={
        <Button asChild variant="outline">
          <Link href={operationsHref("/production/films", origin)}>
            คลังฟิล์มพร้อมรีด
          </Link>
        </Button>
      }
      loading={me.isPending}
      error={
        me.isError
          ? { message: "โหลดสิทธิ์ไม่สำเร็จ", onRetry: () => void me.refetch() }
          : null
      }
    >
      {runNumber && (
        <Section title="รอบที่เลือก" surface="plain">
          {runs.isPending ? (
            <p role="status">กำลังโหลดรอบพิมพ์…</p>
          ) : openedRun ? (
            <PrintRunCard
              run={openedRun}
              enabled={!runs.isFetching && !runs.isError && !me.isError}
              onChanged={sync}
            />
          ) : !runs.isError ? (
            <p className="text-secondary">
              ไม่พบรอบนี้ในรายการล่าสุด ตรวจรอบที่กำลังทำและประวัติด้านล่าง
            </p>
          ) : null}
        </Section>
      )}
      <Section
        title="เลือกงานรวมเข้าม้วน"
        surface="plain"
        description="เลือกจากงานที่ไฟล์พร้อม ระบุจำนวนที่จะพิมพ์รอบนี้ แล้วจัดวางไฟล์ในโปรแกรมเครื่องพิมพ์"
      >
        {queue.isError && (
          <QueryError
            message="โหลดคิวพิมพ์ไม่สำเร็จ"
            onRetry={() => void queue.refetch()}
          />
        )}
        {queue.isPending ? (
          <p role="status">กำลังโหลดคิวพิมพ์…</p>
        ) : queue.data?.length === 0 ? (
          <p className="py-6 text-secondary">
            ไม่มีงานพร้อมเข้ารอบ ตรวจไฟล์อนุมัติและขั้นก่อนหน้าจากใบผลิต
          </p>
        ) : (
          <div className="divide-y divide-divider">
            {queue.data?.map((job) => (
              <div
                key={job.stepId}
                className="flex flex-wrap items-center gap-3 py-4"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-blue-600"
                  aria-label={`เลือก ${job.orderNumber}`}
                  checked={selected[job.stepId] !== undefined}
                  disabled={
                    !canOperate ||
                    !fresh ||
                    create.isPending ||
                    job.executionEnabled
                  }
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = { ...current };
                      if (event.target.checked)
                        next[job.stepId] = String(job.remaining);
                      else delete next[job.stepId];
                      return next;
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/production/${job.productionId}`}
                    className="font-semibold text-strong underline-offset-4 hover:underline"
                  >
                    {job.orderNumber}
                  </Link>
                  <p className="text-sm text-secondary">
                    {job.customerName} · เหลือ {job.remaining} ชิ้น{" "}
                    {job.dueDate ? `· ส่ง ${formatDate(job.dueDate)}` : ""}
                  </p>
                  {job.executionEnabled && (
                    <p className="text-xs text-muted">
                      งานนี้ใช้ Production V2 ซึ่งยังไม่เปิดในรอบนี้
                    </p>
                  )}
                </div>
                {job.design?.fileUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={job.design.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      เปิดไฟล์พิมพ์ v{job.design.versionNumber}
                    </a>
                  </Button>
                )}
                {selected[job.stepId] !== undefined && (
                  <Field label="พิมพ์รอบนี้">
                    <Input
                      type="number"
                      min={1}
                      max={job.remaining}
                      step={1}
                      className="w-28"
                      aria-label={`จำนวนพิมพ์ ${job.orderNumber}`}
                      value={selected[job.stepId]}
                      disabled={create.isPending}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [job.stepId]: event.target.value,
                        }))
                      }
                    />
                  </Field>
                )}
              </div>
            ))}
          </div>
        )}
        {canOperate && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="หมายเหตุรอบพิมพ์">
              <Input
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                placeholder="เช่น เครื่อง 1 / ม้วนเช้า"
                disabled={create.isPending}
              />
            </Field>
            <Button
              disabled={!fresh || create.isPending || !items.length || invalid}
              onClick={() =>
                create.mutate({ items, note: note.trim() || undefined })
              }
            >
              {create.isPending
                ? "กำลังเปิดรอบ…"
                : `เปิดรอบพิมพ์${items.length ? ` ${items.length} งาน` : ""}`}
            </Button>
          </div>
        )}
        {invalid && (
          <Alert variant="warning" className="mt-3">
            งานหรือจำนวนในคิวเปลี่ยนแล้ว ตรวจจำนวนหรือเลือกงานใหม่ก่อนเปิดรอบ
          </Alert>
        )}
        {create.isError && (
          <Alert variant="error" className="mt-3">
            {create.error.message} ข้อมูลที่เลือกยังอยู่
          </Alert>
        )}
      </Section>
      <Section title="รอบที่กำลังทำและประวัติ 7 วัน" surface="plain">
        {runs.isError && (
          <QueryError
            message="โหลดรอบพิมพ์ไม่สำเร็จ"
            onRetry={() => void runs.refetch()}
          />
        )}
        {runs.isPending ? (
          <p role="status">กำลังโหลดรอบพิมพ์…</p>
        ) : runs.data?.length === 0 ? (
          <p className="py-4 text-secondary">ยังไม่มีรอบพิมพ์</p>
        ) : (
          <div className="space-y-5">
            {runs.data
              ?.filter((run) => run.id !== openedRun?.id)
              .map((run) => (
                <PrintRunCard
                  key={run.id}
                  run={run}
                  enabled={!runs.isFetching && !runs.isError && !me.isError}
                  onChanged={sync}
                />
              ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}

function PrintRunCard({
  run,
  enabled,
  onChanged,
}: {
  run: Run;
  enabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const [extras, setExtras] = useState<
    Record<string, { qty: string; label: string }>
  >({});
  const printed = trpc.printRun.markPrinted.useMutation({
    onSuccess: onChanged,
  });
  const complete = trpc.printRun.complete.useMutation({
    onSuccess: async () => {
      setExtras({});
      await onChanged();
      toast.success(
        "ตัดแยกเสร็จแล้ว — บันทึกจำนวนงานและฟิล์มเผื่อเข้าคลังแล้ว",
      );
    },
  });
  const cancel = trpc.printRun.cancel.useMutation({ onSuccess: onChanged });
  const busy = printed.isPending || complete.isPending || cancel.isPending;
  const legacy = run.items.every(
    (item) => !item.productionStep.executionEnabled,
  );
  const can = (command: Run["availableCommands"][number]) =>
    enabled && !busy && legacy && run.availableCommands.includes(command);
  const error = printed.error || complete.error || cancel.error;
  const invalidExtra = Object.values(extras).some(
    (extra) => !Number.isInteger(Number(extra.qty)) || Number(extra.qty) < 0,
  );
  return (
    <article
      id={`print-run-${run.id}`}
      className="scroll-mt-20 border-b border-divider pb-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-strong">{run.runNumber}</h3>
          <p className="text-sm text-secondary">
            {RUN_LABEL[run.status] || run.status} · {run.createdBy.name} ·{" "}
            {formatDate(run.createdAt)}
          </p>
        </div>
        <span className="text-sm tabular-nums">
          {run.items.reduce((sum, item) => sum + item.qty, 0)} ชิ้น /{" "}
          {run.items.length} งาน
        </span>
      </div>
      {run.note && <p className="mt-2 text-sm text-secondary">{run.note}</p>}
      <div className="mt-3 divide-y divide-divider">
        {run.items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-strong">
                {item.order.orderNumber} · {item.qty} ชิ้น
              </p>
              <p className="text-xs text-muted">
                ฟิล์มเผื่อที่เข้าคลังแล้ว {item.extraQty} ชิ้น
              </p>
            </div>
            {run.status === "PRINTED" &&
              legacy &&
              run.availableCommands.includes("complete") && (
                <>
                  <Field label={`ฟิล์มเผื่อ ${item.order.orderNumber}`}>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="w-24"
                      value={extras[item.id]?.qty ?? "0"}
                      disabled={busy}
                      onChange={(event) =>
                        setExtras((current) => ({
                          ...current,
                          [item.id]: {
                            label: current[item.id]?.label ?? "",
                            qty: event.target.value,
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label="ป้ายคลังฟิล์ม">
                    <Input
                      value={extras[item.id]?.label ?? ""}
                      maxLength={200}
                      placeholder={`ลายงาน ${item.order.orderNumber}`}
                      disabled={busy}
                      onChange={(event) =>
                        setExtras((current) => ({
                          ...current,
                          [item.id]: {
                            qty: current[item.id]?.qty ?? "0",
                            label: event.target.value,
                          },
                        }))
                      }
                    />
                  </Field>
                </>
              )}
          </div>
        ))}
      </div>
      {run.blockedReason && (
        <Alert variant="warning" className="mt-3">
          {run.blockedReason}
        </Alert>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {run.availableCommands.includes("markPrinted") && (
          <Button
            disabled={!can("markPrinted")}
            onClick={() => printed.mutate({ runId: run.id })}
          >
            พิมพ์จบทั้งม้วนแล้ว
          </Button>
        )}
        {run.availableCommands.includes("complete") && (
          <Button
            disabled={!can("complete") || invalidExtra}
            onClick={async () => {
              if (
                await confirm({
                  title: "ตัดแยกและติดป้ายครบแล้ว?",
                  description: `ยืนยันฟิล์ม ${run.items.length} งานตรงกับออเดอร์ ระบบจะบันทึกจำนวนผ่านขั้นพิมพ์และเก็บฟิล์มเผื่อเข้าคลัง`,
                  confirmText: "ยืนยันตัดแยกครบ",
                })
              )
                complete.mutate({
                  runId: run.id,
                  extras: Object.entries(extras).map(([itemId, value]) => ({
                    itemId,
                    extraQty: Number(value.qty),
                    label: value.label.trim() || undefined,
                  })),
                });
            }}
          >
            <Scissors /> ตัดแยกและติดป้ายครบแล้ว
          </Button>
        )}
        {run.availableCommands.includes("cancel") && (
          <Button
            variant="outline"
            disabled={!can("cancel")}
            onClick={async () => {
              if (
                await confirm({
                  title: "ยกเลิกรอบพิมพ์นี้?",
                  description:
                    "งานทั้งหมดจะกลับเข้าคิวพิมพ์ ใช้เมื่อยังไม่พิมพ์จบทั้งม้วน",
                  confirmText: "ยกเลิกรอบพิมพ์",
                  destructive: true,
                })
              )
                cancel.mutate({ runId: run.id });
            }}
          >
            ยกเลิกรอบ
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="error" className="mt-3">
          {error.message} กรุณาตรวจข้อมูลล่าสุดแล้วลองใหม่
        </Alert>
      )}
    </article>
  );
}
