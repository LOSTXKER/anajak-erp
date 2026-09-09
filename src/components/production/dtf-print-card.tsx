"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import { Section } from "@/components/ui/section";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoChip } from "@/components/ui/info-chip";

type Run = RouterOutput["printRun"]["list"][number];

/** รอบพิมพ์ใช้หลักฐานเดียวกันทั้งใบผลิตและหน้างาน; หนึ่งรอบรวมหลายออเดอร์ได้ */
export function DtfPrintCard({ stepId, canOperate }: { stepId: string; canOperate: boolean }) {
  const queue = trpc.printRun.queue.useQuery(undefined, { refetchOnWindowFocus: true });
  const runs = trpc.printRun.list.useQuery(undefined, { refetchOnWindowFocus: true });
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [batchOpen, setBatchOpen] = useState(false);
  const invalidate = [utils.printRun.queue, utils.printRun.list, utils.production.getById, utils.production.kanban, utils.factory.stationQueue, utils.order.getById];
  const create = useMutationWithInvalidation(trpc.printRun.create, {
    invalidate,
    onSuccess: () => { setSelected({}); setBatchOpen(false); toast.success("เปิดรอบพิมพ์แล้ว"); },
    onError: (err: { message: string }) => toast.error("เปิดรอบพิมพ์ไม่สำเร็จ", { description: err.message }),
  });
  if ((queue.isLoading && !queue.data) || (runs.isLoading && !runs.data)) return <Skeleton className="h-40 rounded-xl" />;
  if (queue.isError || runs.isError) return <QueryError message="โหลดรอบพิมพ์ไม่สำเร็จ" onRetry={() => { void queue.refetch(); void runs.refetch(); }} />;
  const current = queue.data?.find((entry) => entry.stepId === stepId && !entry.executionEnabled);
  const related = (runs.data ?? []).filter((run) => run.items.some((item) => item.productionStep.id === stepId));
  const active = related.filter((run) => run.status === "PRINTING" || run.status === "PRINTED");
  const available = (queue.data ?? []).filter((entry) => !entry.executionEnabled && entry.remaining > 0 && (batchOpen || entry.stepId === stepId));
  const qtyFor = (id: string, remaining: number) => selected[id] ?? (id === stepId ? remaining : 0);
  const chosen = available.map((entry) => ({ stepId: entry.stepId, qty: qtyFor(entry.stepId, entry.remaining) })).filter((entry) => entry.qty > 0);
  const invalidQty = available.some((entry) => {
    const qty = qtyFor(entry.stepId, entry.remaining);
    return !Number.isInteger(qty) || qty < 0 || qty > entry.remaining;
  });
  return (
    <Section title="พิมพ์ฟิล์ม DTF" icon={Printer}>
      <div className="space-y-4">
        {active.map((run) => <PrintRunControls key={run.id} run={run} canOperate={canOperate} />)}
        {current && canOperate ? (
          <div className="space-y-3">
            {available.map((entry) => (
              <div key={entry.stepId} className="flex flex-wrap items-center gap-3 border-b border-divider py-3">
                {batchOpen ? <Checkbox aria-label={`รวม ${entry.orderNumber} ในรอบพิมพ์`} checked={qtyFor(entry.stepId, entry.remaining) > 0} onChange={(event) => setSelected((value) => ({ ...value, [entry.stepId]: event.target.checked ? entry.remaining : 0 }))} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-strong">{entry.orderNumber}</p>
                  <p className="text-xs text-secondary">เหลือพิมพ์ {entry.remaining} ชุด {entry.design ? `แบบ v${entry.design.versionNumber}` : "ยังไม่มีแบบอนุมัติ"}</p>
                </div>
                <NumberInput integer min={0} max={entry.remaining} value={qtyFor(entry.stepId, entry.remaining)} onValueChange={(value) => setSelected((previous) => ({ ...previous, [entry.stepId]: value }))} aria-label={`จำนวนพิมพ์ ${entry.orderNumber}`} className="h-11 w-24 text-right" disabled={create.isPending} />
              </div>
            ))}
            {invalidQty ? <p role="alert" className="text-sm text-secondary">จำนวนพิมพ์ต้องไม่ติดลบและไม่เกินยอดคงเหลือของแต่ละงาน</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => create.mutate({ items: chosen })} disabled={create.isPending || chosen.length === 0 || invalidQty}>เปิดรอบพิมพ์ {chosen.reduce((sum, entry) => sum + entry.qty, 0)} ชุด</Button>
              <Button variant="outline" onClick={() => setBatchOpen((value) => !value)} disabled={create.isPending}>{batchOpen ? "เฉพาะใบนี้" : "รวมงานอื่นในรอบ"}</Button>
            </div>
          </div>
        ) : active.length === 0 ? <p className="text-sm text-secondary">{canOperate ? "ยังไม่มีงานพร้อมเข้ารอบพิมพ์ — ตรวจแบบอนุมัติและขั้นก่อนหน้า" : "รอผู้รับผิดชอบบันทึกรอบพิมพ์"}</p> : null}
        {related.filter((run) => run.status === "COMPLETED").map((run) => (
          <p key={run.id} className="text-sm text-secondary">{run.runNumber} · ตัดแยกแล้ว {run.items.filter((item) => item.productionStep.id === stepId).reduce((sum, item) => sum + (item.resultReportedAt ? item.qtyGood : item.qty), 0)} ชุด</p>
        ))}
      </div>
    </Section>
  );
}

function PrintRunControls({ run, canOperate }: { run: Run; canOperate: boolean }) {
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const [scrap, setScrap] = useState<Record<string, number>>({});
  const invalidate = [utils.printRun.queue, utils.printRun.list, utils.production.getById, utils.production.kanban, utils.factory.stationQueue, utils.order.getById];
  const onError = (err: { message: string }) => toast.error("บันทึกรอบพิมพ์ไม่สำเร็จ", { description: err.message });
  const printed = useMutationWithInvalidation(trpc.printRun.markPrinted, { invalidate, onError, onSuccess: () => toast.success("พิมพ์จบแล้ว — รอตัดแยกและตรวจฟิล์ม") });
  const complete = useMutationWithInvalidation(trpc.printRun.complete, { invalidate, onError, onSuccess: () => toast.success("บันทึกฟิล์มที่ใช้ได้แล้ว — จำนวนที่เสียกลับเข้าคิวพิมพ์") });
  const cancel = useMutationWithInvalidation(trpc.printRun.cancel, { invalidate, onError, onSuccess: () => toast.success("ยกเลิกรอบและคืนงานเข้าคิวแล้ว") });
  const busy = printed.isPending || complete.isPending || cancel.isPending;
  const legacy = run.items.every((item) => !item.productionStep.executionEnabled);
  const allowed = canOperate && legacy && (run.availableCommands.includes("markPrinted") || run.availableCommands.includes("complete"));
  const canCancel = canOperate && legacy && run.availableCommands.includes("cancel");
  const invalidScrap = run.items.some((item) => {
    const qty = scrap[item.id] ?? 0;
    return !Number.isInteger(qty) || qty < 0 || qty > item.qty;
  });
  return (
    <div className="space-y-3 border-b border-divider pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-strong">{run.runNumber}</p>
        <InfoChip tone="info">{run.status === "PRINTING" ? "กำลังพิมพ์" : "รอตัดแยก"}</InfoChip>
      </div>
      {run.items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium text-strong">{item.order.orderNumber}</p><p className="text-xs text-secondary">พิมพ์ {item.qty} ชุด{run.status === "PRINTED" && (scrap[item.id] ?? 0) >= 0 && (scrap[item.id] ?? 0) <= item.qty ? ` · ตรวจนับดี ${item.qty - (scrap[item.id] ?? 0)} ชุด` : ""}</p></div>
          {run.status === "PRINTED" ? <label htmlFor={`film-scrap-${item.id}`} className="flex items-center gap-2 text-sm">เสีย<NumberInput id={`film-scrap-${item.id}`} integer min={0} max={item.qty} value={scrap[item.id] ?? 0} onValueChange={(value) => setScrap((previous) => ({ ...previous, [item.id]: value }))} className="h-11 w-24 text-right" aria-label={`ฟิล์มเสีย ${item.order.orderNumber}`} disabled={!allowed || busy} /></label> : null}
        </div>
      ))}
      {run.blockedReason ? <p className="text-sm text-secondary">{run.blockedReason}</p> : null}
      {invalidScrap ? <p role="alert" className="text-sm text-secondary">จำนวนฟิล์มเสียต้องอยู่ระหว่าง 0 ถึงจำนวนที่พิมพ์ของแต่ละงาน</p> : null}
      {allowed || canCancel ? (
        <div className="flex flex-wrap gap-2">
          {allowed ? (run.status === "PRINTING" ? <Button onClick={() => printed.mutate({ runId: run.id })} disabled={busy || !run.availableCommands.includes("markPrinted")}>พิมพ์จบทั้งม้วน</Button> : <Button disabled={busy || invalidScrap || !run.availableCommands.includes("complete")} onClick={async () => {
            if (!await confirm({ title: "ตัดแยกและติดป้ายครบแล้ว?", description: "ยืนยันจำนวนฟิล์มที่ใช้ได้ของทุกงานในรอบ — ฟิล์มเสียจะกลับไปรอพิมพ์ใหม่", confirmText: "ยืนยันฟิล์มพร้อมรีด" })) return;
            complete.mutate({ runId: run.id, legacyResults: run.items.map((item) => ({ itemId: item.id, qtyGood: item.qty - (scrap[item.id] ?? 0), qtyScrap: scrap[item.id] ?? 0 })) });
          }}>ตัดแยกและติดป้ายแล้ว</Button>) : null}
          {canCancel ? <Button variant="outline" disabled={busy} onClick={async () => {
            if (await confirm({ title: "ยกเลิกรอบพิมพ์นี้?", description: "งานทั้งหมดในรอบจะกลับเข้าคิว ใช้เมื่อยังไม่มีฟิล์มที่นำไปใช้งาน", confirmText: "ยกเลิกรอบ" })) cancel.mutate({ runId: run.id });
          }}>ยกเลิกรอบ</Button> : null}
        </div>
      ) : null}
    </div>
  );
}
