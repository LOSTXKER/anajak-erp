"use client";

import { useId, useState } from "react";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { OUTSOURCE_STATUS_LABELS, OUTSOURCE_ACTIVE_STATUSES } from "@/lib/outsource-ui";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { Button } from "@/components/ui/button";
import { InfoChip } from "@/components/ui/info-chip";
import { QueryError } from "@/components/ui/query-error";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { StepOutsourceDialog } from "./step-outsource-dialog";
import type { ProductionStep } from "./types";

type Job = RouterOutput["outsource"]["listOrders"][number];
type Receipt = RouterOutput["goodsReceipt"]["listByOrder"][number];

/** ใบร้านนอกอยู่ในขั้นงานเดิม: สร้างใบ → ส่งจริง → นับรับทีละรอบ → ตรวจคุณภาพ */
export function OutsourceStepCard({ step, orderId, canCreate, enabled = true, canCancelDraft = enabled }: {
  step: ProductionStep;
  orderId: string;
  canCreate: boolean;
  enabled?: boolean;
  canCancelDraft?: boolean;
}) {
  const jobs = trpc.outsource.listOrders.useQuery({ productionStepId: step.id }, { refetchOnWindowFocus: true });
  const receipts = trpc.goodsReceipt.listByOrder.useQuery({ orderId }, { refetchOnWindowFocus: true });
  const [creating, setCreating] = useState(false);
  if (jobs.isLoading || receipts.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (jobs.isError || receipts.isError) return <QueryError message="โหลดใบส่งร้านและหลักฐานรับกลับไม่สำเร็จ" onRetry={() => { void jobs.refetch(); void receipts.refetch(); }} />;
  const rows = jobs.data ?? [];
  const outstanding = rows.filter((job) => OUTSOURCE_ACTIVE_STATUSES.includes(job.status)).reduce((sum, job) => sum + job.quantity, 0);
  const remaining = step.qtyTotal === null ? null : Math.max(0, step.qtyTotal - step.qtyDone - outstanding);
  const allowCreate = canCreate && enabled && ["PENDING", "IN_PROGRESS"].includes(step.status) && (remaining === null || remaining > 0);
  return (
    <Section title="งานร้านนอก" icon={Truck}>
      <div className="space-y-5">
        {rows.length === 0 ? <p className="text-sm text-secondary">ยังไม่มีใบส่งร้านของขั้นนี้</p> : null}
        {rows.map((job) => <OutsourceJob key={job.id} job={job} receipts={receipts.data ?? []} orderId={orderId} enabled={enabled && !jobs.isFetching && !receipts.isFetching} canCancelDraft={canCancelDraft && !jobs.isFetching && !receipts.isFetching} nowMs={jobs.dataUpdatedAt} />)}
        {allowCreate ? <Button variant={rows.length ? "outline" : "default"} onClick={() => setCreating(true)}>สร้างใบส่งร้าน{remaining !== null ? ` — เหลือ ${remaining} ตัว` : ""}</Button> : null}
      </div>
      {creating ? <StepOutsourceDialog step={step} onClose={() => setCreating(false)} /> : null}
    </Section>
  );
}

function OutsourceJob({ job, receipts, orderId, enabled, canCancelDraft, nowMs }: { job: Job; receipts: Receipt[]; orderId: string; enabled: boolean; canCancelDraft: boolean; nowMs: number }) {
  const utils = trpc.useUtils();
  const noteId = useId();
  const confirm = useConfirm();
  const [receiving, setReceiving] = useState(false);
  const [qcNote, setQcNote] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const invalidate = [utils.outsource.listOrders, utils.production.getById, utils.production.getByOrderId, utils.production.kanban, utils.factory.stationQueue, utils.order.getById, utils.goodsReceipt.listByOrder];
  const update = useMutationWithInvalidation(trpc.outsource.updateOrderStatus, {
    invalidate,
    onSuccess: () => { setQcNote(""); toast.success("บันทึกสถานะงานร้านนอกแล้ว"); },
    onError: (error: { message: string }) => toast.error("บันทึกไม่สำเร็จ", { description: error.message }),
  });
  const cancel = useMutationWithInvalidation(trpc.outsource.cancelDraftOrder, { invalidate, onSuccess: () => toast.success("ยกเลิกใบที่ยังไม่ส่งแล้ว") });
  const generateLink = trpc.outsourceShare.generateLink.useMutation();
  const evidence = receipts.filter((receipt) => receipt.receiptType === "OUTSOURCE_RETURN" && receipt.outsourceOrderId === job.id);
  const counted = evidence.flatMap((receipt) => receipt.lines).reduce((sum, line) => sum + line.qtyCounted, 0);
  const defective = evidence.flatMap((receipt) => receipt.lines).reduce((sum, line) => sum + line.defectQty, 0);
  const remaining = Math.max(0, job.quantity - counted);
  const usable = Math.min(job.quantity, Math.max(0, counted - defective));
  const needsRework = Math.max(0, job.quantity - usable);
  const passedPartially = job.status === "QC_PASSED" && needsRework > 0;
  const can = (command: Job["availableCommands"][number]) => (command === "cancelDraft" ? canCancelDraft : enabled) && job.availableCommands.includes(command);
  const busy = update.isPending || cancel.isPending || sharing;
  const receiveStage = ["SENT", "IN_PROGRESS", "COMPLETED"].includes(job.status);
  const overdue = receiveStage && job.expectedBackAt && new Date(job.expectedBackAt).getTime() < nowMs;
  const isDone = job.status === "QC_PASSED" || job.status === "QC_FAILED";

  async function copyJobLink() {
    setSharing(true);
    try {
      const existing = await utils.outsourceShare.getLink.fetch({ outsourceOrderId: job.id });
      const link = existing.token && existing.expiresAt && new Date(existing.expiresAt).getTime() > Date.now()
        ? existing
        : await generateLink.mutateAsync({ outsourceOrderId: job.id });
      const url = `${window.location.origin}/job/${link.token}`;
      setShareLink(url);
      try { await navigator.clipboard.writeText(url); toast.success("คัดลอกลิงก์ใบงานแล้ว"); }
      catch { toast.info("เปิดลิงก์ใบงานด้านล่างเพื่อคัดลอกได้"); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "สร้างลิงก์ไม่สำเร็จ"); }
    finally { setSharing(false); }
  }

  return (
    <div className="space-y-3 border-b border-divider pb-5 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><p className="text-base font-semibold text-strong">{job.vendor.name}</p><p className="break-words text-sm text-secondary">{job.description}</p></div>
        <InfoChip tone={passedPartially ? "warning" : job.status === "QC_PASSED" ? "success" : job.status === "QC_FAILED" ? "error" : job.status === "RECEIVED_BACK" ? "warning" : "neutral"}>{passedPartially ? "รับผ่านบางส่วน" : OUTSOURCE_STATUS_LABELS[job.status]}</InfoChip>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div><dt className="text-secondary">จำนวนในใบ</dt><dd className="font-semibold tabular-nums text-strong">{job.quantity} ตัว</dd></div>
        <div><dt className="text-secondary">รับกลับแล้ว</dt><dd className="font-semibold tabular-nums text-strong">{counted} ตัว{defective > 0 ? ` / ตำหนิ ${defective}` : ""}</dd></div>
        {job.status === "RECEIVED_BACK" || passedPartially ? <>
          <div><dt className="text-secondary">{passedPartially ? "รับผ่านแล้ว" : "ของดีที่รับผ่านได้"}</dt><dd className="font-semibold tabular-nums text-strong">{usable} ตัว</dd></div>
          {needsRework > 0 ? <div><dt className="text-secondary">ต้องแก้</dt><dd className="font-semibold tabular-nums text-strong">{needsRework} ตัว</dd></div> : null}
        </> : null}
        {job.expectedBackAt ? <div><dt className="text-secondary">นัดรับกลับ</dt><dd className="font-medium text-strong">{formatDate(job.expectedBackAt)}</dd></div> : null}
      </dl>
      {overdue ? <InfoChip tone="warning">เลยนัดรับกลับ — ต้องติดตามร้าน</InfoChip> : null}
      {receiveStage && remaining > 0 && counted > 0 ? <p className="text-sm text-secondary">รับบางส่วนแล้ว ยังรออีก {remaining} ตัว</p> : null}
      {job.qcNotes ? <p className="break-words text-sm text-secondary">ผลตรวจ: {job.qcNotes}</p> : null}
      {job.blockedReason ? <p className="text-sm text-secondary">{job.blockedReason}</p> : null}
      {job.status === "RECEIVED_BACK" && can("failQc") ? (
        <label htmlFor={noteId} className="block space-y-1 text-sm text-secondary">ผลตรวจ / เหตุผลที่ไม่ผ่าน<Textarea id={noteId} value={qcNote} onChange={(event) => setQcNote(event.target.value)} placeholder="เช่น ปักสลับตำแหน่ง 2 ตัว" disabled={busy} /></label>
      ) : null}
      {job.status === "RECEIVED_BACK" && needsRework > 0 ? <p className="text-sm text-secondary">{usable > 0 ? `รับเฉพาะของดี ${usable} ตัว แล้วเปิดใบส่งแก้ส่วนที่เหลือ ${needsRework} ตัว` : "ยังไม่มีของดีให้รับผ่าน ให้บันทึกไม่ผ่านและเปิดใบส่งแก้"}</p> : null}
      <div className="flex flex-wrap gap-2">
        {can("markSent") ? <Button disabled={busy} onClick={() => update.mutate({ id: job.id, status: "SENT" })}>ส่งของให้ร้านแล้ว</Button> : null}
        {can("receiveBack") && remaining > 0 ? <Button disabled={busy} onClick={() => setReceiving(true)}>นับของรับกลับ{counted > 0 ? "เพิ่ม" : ""}</Button> : null}
        {can("receiveBack") && remaining === 0 ? <Button disabled={busy} onClick={() => update.mutate({ id: job.id, status: "RECEIVED_BACK" })}>รับครบแล้ว ส่งตรวจคุณภาพ</Button> : null}
        {can("passQc") && usable > 0 ? <Button disabled={busy} onClick={() => update.mutate({ id: job.id, status: "QC_PASSED", acceptGoodQuantity: usable, qcNotes: qcNote || undefined })}>{needsRework > 0 ? "ยืนยันรับเฉพาะของดี" : "ตรวจรับผ่าน"} {usable} ตัว</Button> : null}
        {can("failQc") ? <Button variant="outline" disabled={busy || qcNote.trim().length < 3} onClick={async () => {
          if (await confirm({ title: "ตรวจรับงานร้านนอกไม่ผ่าน?", description: "ใบนี้จะจบด้วยผลไม่ผ่าน ขั้นยังค้างให้เปิดใบส่งแก้รอบใหม่", confirmText: "ยืนยันไม่ผ่าน" })) update.mutate({ id: job.id, status: "QC_FAILED", qcNotes: qcNote.trim() });
        }}>{usable > 0 ? "ไม่ผ่านทั้งใบ" : "ตรวจรับไม่ผ่าน"}</Button> : null}
        {can("share") && !isDone ? <Button variant="outline" disabled={busy} onClick={() => void copyJobLink()}>คัดลอกใบงานให้ร้าน</Button> : null}
        {can("cancelDraft") ? <Button variant="ghost" disabled={busy} onClick={async () => {
          if (await confirm({ title: "ยกเลิกใบส่งร้านนี้?", description: "ใช้เฉพาะใบที่ยังไม่ได้ส่งของจริง", confirmText: "ยกเลิกใบ" })) cancel.mutate({ id: job.id });
        }}>ยกเลิกใบร่าง</Button> : null}
      </div>
      {shareLink ? <a className="block break-all text-sm text-brand-primary underline" href={shareLink} target="_blank" rel="noreferrer">เปิดใบงานสำหรับร้าน</a> : null}
      {receiving ? <GoodsReceiptDialog
        orderId={orderId} receiptType="OUTSOURCE_RETURN" outsourceOrderId={job.id}
        presetLines={[{ description: job.description, qtyExpected: remaining }]}
        onCreated={() => { void utils.goodsReceipt.listByOrder.invalidate({ orderId }); }}
        onClose={() => setReceiving(false)}
      /> : null}
    </div>
  );
}
