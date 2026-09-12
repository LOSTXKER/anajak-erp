"use client";

import { useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import {
  outsourceActionAvailability,
  outsourceQueueForStatus,
  outsourceStatusMeta,
  OUTSOURCE_QUEUE_FILTERS,
} from "@/lib/outsource-ui";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { QueryError } from "@/components/ui/query-error";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Textarea } from "@/components/ui/textarea";
import { operationsBack, type OperationsOrigin } from "./operations-navigation";

type Job = RouterOutput["outsource"]["listOrders"][number];

export function OutsourcePage({
  productionId,
  origin,
}: {
  productionId?: string;
  origin?: OperationsOrigin;
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const me = trpc.user.me.useQuery();
  const jobs = trpc.outsource.listOrders.useQuery(
    {},
    { refetchInterval: 30_000 },
  );
  const utils = trpc.useUtils();
  const sync = async () => {
    await Promise.all([
      utils.outsource.listOrders.invalidate(),
      utils.production.getById.invalidate(),
      utils.production.kanban.invalidate(),
      utils.goodsReceipt.listByOrder.invalidate(),
      utils.factory.stationQueue.invalidate(),
      utils.factory.board.invalidate(),
      utils.order.getById.invalidate(),
    ]);
  };
  const visible = jobs.data?.filter(
    (job) =>
      (!productionId || job.productionStep.productionId === productionId) &&
      (filter === "all" || outsourceQueueForStatus(job.status) === filter) &&
      `${job.vendor.name} ${job.description} ${job.productionStep.production.order.orderNumber}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <PageShell title="งานร้านนอก" icon={Truck} back={operationsBack(origin)}>
      <Section
        surface="plain"
        description="สร้างใบร้านนอกจากขั้นในใบผลิต แล้วส่งของ ตรวจนับรับกลับ และให้หัวหน้ายืนยันผลตรวจรับที่นี่"
      >
        {productionId && (
          <Button asChild variant="outline" size="sm" className="mb-4">
            <Link href="/production/outsource">ดูงานร้านนอกทุกใบผลิต</Link>
          </Button>
        )}
        <Field label="ค้นหาออเดอร์ ร้าน หรือรายละเอียด">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-lg"
          />
        </Field>
        <div className="my-4 flex flex-wrap gap-2" aria-label="กรองงานร้านนอก">
          {[{ value: "all", label: "ทั้งหมด" }, ...OUTSOURCE_QUEUE_FILTERS].map(
            (item) => (
              <Button
                key={item.value}
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ),
          )}
        </div>
        {me.isError && (
          <QueryError
            message="โหลดสิทธิ์ไม่สำเร็จ"
            onRetry={() => void me.refetch()}
          />
        )}
        {jobs.isError && (
          <QueryError
            message="โหลดงานร้านนอกไม่สำเร็จ"
            onRetry={() => void jobs.refetch()}
          />
        )}
        {jobs.isPending ? (
          <p role="status">กำลังโหลดงานร้านนอก…</p>
        ) : visible?.length === 0 ? (
          <p className="py-6 text-secondary">ไม่มีใบงานในรายการนี้</p>
        ) : (
          <div className="space-y-6">
            {visible?.map((job) => (
              <OutsourceJobCard
                key={job.id}
                job={job}
                enabled={
                  !jobs.isFetching && !jobs.isError && !!me.data && !me.isError
                }
                canCount={permAllows(me.data?.permissions, "manage_delivery")}
                onChanged={sync}
              />
            ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}

function OutsourceJobCard({
  job,
  enabled,
  canCount,
  onChanged,
}: {
  job: Job;
  enabled: boolean;
  canCount: boolean;
  onChanged: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [qc, setQc] = useState<"QC_PASSED" | "QC_FAILED" | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const order = job.productionStep.production.order;
  const orderId = job.productionStep.production.orderId;
  const action = outsourceActionAvailability(job.availableCommands, {
    enabled: enabled && !job.executionEnabled,
  });
  const receipts = trpc.goodsReceipt.listByOrder.useQuery(
    { orderId },
    {
      enabled:
        !job.executionEnabled &&
        (action.canReceiveBack || job.status === "RECEIVED_BACK"),
    },
  );
  const existingReceipt = receipts.data?.some(
    (receipt) =>
      receipt.outsourceOrderId === job.id &&
      receipt.receiptType === "OUTSOURCE_RETURN",
  );
  const receivedGood =
    receipts.data
      ?.filter(
        (receipt) =>
          receipt.outsourceOrderId === job.id &&
          receipt.receiptType === "OUTSOURCE_RETURN",
      )
      .reduce(
        (sum, receipt) =>
          sum +
          receipt.lines.reduce(
            (count, line) => count + line.qtyCounted - line.defectQty,
            0,
          ),
        0,
      ) ?? 0;
  const receiptFresh =
    !!receipts.data && !receipts.isFetching && !receipts.isError;
  const update = trpc.outsource.updateOrderStatus.useMutation({
    onSuccess: async () => {
      setQc(null);
      await onChanged();
      toast.success("อัปเดตงานร้านนอกแล้ว");
    },
  });
  const cancel = trpc.outsource.cancelDraftOrder.useMutation({
    onSuccess: onChanged,
  });
  const share = trpc.outsourceShare.generateLink.useMutation({
    onSuccess: ({ token }) =>
      setShareUrl(`${window.location.origin}/job/${token}`),
  });
  const busy = update.isPending || cancel.isPending || share.isPending;
  const error = update.error || cancel.error || share.error;
  return (
    <article className="border-b border-divider pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/production/${job.productionStep.productionId}`}
            className="text-lg font-semibold text-strong hover:underline"
          >
            {order.orderNumber}
          </Link>
          <p className="text-sm text-secondary">
            {order.customer.name} · {job.vendor.name}
          </p>
        </div>
        <span className="font-medium text-strong">
          {outsourceStatusMeta(job.status).label}
        </span>
      </div>
      <p className="mt-3 text-sm text-strong">
        {job.description} · {job.quantity} ชิ้น
      </p>
      <p className="mt-1 text-xs text-muted">
        {job.sentAt ? `ส่ง ${formatDate(job.sentAt)} · ` : ""}
        {job.expectedBackAt
          ? `นัดรับ ${formatDate(job.expectedBackAt)}`
          : "ยังไม่ระบุนัดรับกลับ"}
        {job.receivedAt ? ` · รับกลับ ${formatDate(job.receivedAt)}` : ""}
      </p>
      {job.qcNotes && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
          ผลตรวจรับ: {job.qcNotes}
        </p>
      )}
      {job.status === "RECEIVED_BACK" && receipts.data && (
        <p className="mt-3 text-sm font-medium text-strong">
          ของดีตามใบตรวจนับ {receivedGood} / {job.quantity} ชิ้น
          {receivedGood < job.quantity
            ? ` · ยังขาด ${job.quantity - receivedGood} ชิ้น บันทึกของที่รับเพิ่มหรือแจ้งไม่ผ่านตามจริง`
            : " · พร้อมให้หัวหน้าตัดสินผลตรวจรับ"}
        </p>
      )}
      {job.blockedReason && (
        <Alert variant="warning" className="mt-3">
          {job.blockedReason}
        </Alert>
      )}
      {job.executionEnabled && (
        <Alert className="mt-3">
          ใบนี้ใช้ Production V2 ซึ่งยังไม่เปิดในรอบนี้
        </Alert>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {action.canMarkSent && (
          <Button
            disabled={busy}
            onClick={async () => {
              if (
                await confirm({
                  title: `ส่งของให้ ${job.vendor.name} แล้ว?`,
                  description: `${job.description} จำนวน ${job.quantity} ชิ้น การยืนยันนี้บันทึกว่าของออกจากโรงงานแล้ว`,
                  confirmText: "ยืนยันส่งร้านแล้ว",
                })
              )
                update.mutate({ id: job.id, status: "SENT" });
            }}
          >
            ยืนยันส่งร้านแล้ว
          </Button>
        )}
        {action.canReceiveBack && canCount && (
          <Button
            disabled={busy || receipts.isFetching || receipts.isError}
            onClick={() => setReceiptOpen(true)}
          >
            ตรวจนับของรับกลับ
          </Button>
        )}
        {action.canReceiveBack && !canCount && (
          <p className="text-sm text-secondary">
            ให้ผู้มีสิทธิ์รับของเข้าบันทึกใบตรวจนับก่อนยืนยันรับกลับ
          </p>
        )}
        {action.canReceiveBack && existingReceipt && (
          <Button
            disabled={busy || receipts.isFetching || receipts.isError}
            variant="outline"
            onClick={() =>
              update.mutate({ id: job.id, status: "RECEIVED_BACK" })
            }
          >
            ยืนยันรับกลับตามใบตรวจนับ
          </Button>
        )}
        {job.status === "RECEIVED_BACK" &&
          enabled &&
          !job.executionEnabled &&
          canCount && (
            <Button
              variant="outline"
              disabled={busy || !receiptFresh}
              onClick={() => setReceiptOpen(true)}
            >
              บันทึกของที่รับเพิ่ม
            </Button>
          )}
        {action.canPassQc && (
          <Button
            disabled={busy || !receiptFresh || receivedGood < job.quantity}
            onClick={() => setQc("QC_PASSED")}
          >
            ตรวจรับผ่านครบ {job.quantity} ชิ้น
          </Button>
        )}
        {action.canFailQc && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setQc("QC_FAILED")}
          >
            ตรวจรับไม่ผ่าน
          </Button>
        )}
        {action.canShare && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (
                await confirm({
                  title: "สร้างลิงก์ใบงานให้ร้านนอก?",
                  description:
                    "ลิงก์ใหม่ใช้ดูงานได้ 90 วัน หากเคยมีลิงก์เก่าของใบนี้ ลิงก์เก่าจะใช้ไม่ได้",
                  confirmText: "สร้างลิงก์",
                })
              )
                share.mutate({ outsourceOrderId: job.id });
            }}
          >
            ลิงก์ใบงานให้ร้าน
          </Button>
        )}
        {action.canCancelDraft && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              if (
                await confirm({
                  title: "ยกเลิกใบร่างนี้?",
                  description:
                    "ใช้เฉพาะใบที่ยังไม่ส่งของจริง ใบร่างนี้จะถูกนำออกจากขั้นผลิต",
                  confirmText: "ยกเลิกร่าง",
                  destructive: true,
                })
              )
                cancel.mutate({ id: job.id });
            }}
          >
            ยกเลิกร่าง
          </Button>
        )}
      </div>
      {receipts.isError && (
        <QueryError
          message="โหลดหลักฐานรับกลับไม่สำเร็จ"
          onRetry={() => void receipts.refetch()}
        />
      )}
      {shareUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            readOnly
            value={shareUrl}
            aria-label="ลิงก์ใบงานร้านนอก"
            className="max-w-xl"
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("คัดลอกลิงก์แล้ว");
              } catch {
                toast.error("คัดลอกไม่สำเร็จ เลือกและคัดลอกจากช่องลิงก์ได้");
              }
            }}
          >
            คัดลอก
          </Button>
          <Button variant="outline" asChild>
            <a href={shareUrl} target="_blank" rel="noreferrer">
              เปิดใบงาน
            </a>
          </Button>
        </div>
      )}
      {error && (
        <Alert variant="error" className="mt-3">
          {error.message}
        </Alert>
      )}
      {receiptOpen && (
        <GoodsReceiptDialog
          orderId={orderId}
          receiptType="OUTSOURCE_RETURN"
          description={
            job.status === "RECEIVED_BACK"
              ? "นับเฉพาะของที่รับเพิ่มรอบนี้ ไม่นับซ้ำใบก่อน ยอดของดีจะรวมกับใบรับเดิมให้หัวหน้าตรวจรับ"
              : "นับเฉพาะของที่รับกลับรอบนี้ ไม่นับซ้ำใบก่อน เมื่อบันทึกแล้วใบงานจะเป็นรับกลับแล้ว รอหัวหน้าตรวจรับ"
          }
          outsourceOrderId={job.id}
          presetLines={[
            {
              description: job.description,
              qtyExpected: Math.max(0, job.quantity - receivedGood),
            },
          ]}
          onClose={() => setReceiptOpen(false)}
          onCreated={() => {
            void onChanged();
            if (job.status !== "RECEIVED_BACK")
              update.mutate({ id: job.id, status: "RECEIVED_BACK" });
          }}
        />
      )}
      {qc && (
        <OutsourceQcDialog
          job={job}
          status={qc}
          pending={update.isPending}
          error={update.error?.message}
          onClose={() => setQc(null)}
          onSubmit={(qcNotes) =>
            update.mutate({ id: job.id, status: qc, qcNotes })
          }
        />
      )}
    </article>
  );
}

function OutsourceQcDialog({
  job,
  status,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  job: Job;
  status: "QC_PASSED" | "QC_FAILED";
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const passed = status === "QC_PASSED";
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {passed ? "ยืนยันตรวจรับผ่าน" : "บันทึกตรวจรับไม่ผ่าน"}
          </DialogTitle>
          <DialogDescription>
            {job.vendor.name} · {job.description} · {job.quantity} ชิ้น{" "}
            {passed
              ? "การผ่านจะนับจำนวนเข้าขั้นผลิต ส่วน QC สุดท้ายของออเดอร์ยังเป็นอีกด่าน"
              : "ขั้นผลิตจะติดปัญหา ให้หัวหน้าจัดการส่งใหม่หรือแก้ไขตามของจริง"}
          </DialogDescription>
        </DialogHeader>
        <Field label="ผลตรวจและหมายเหตุ">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={pending}
            rows={3}
          />
        </Field>
        {error && <Alert variant="error">{error}</Alert>}
        <DialogSubmitFooter
          pending={pending}
          submitLabel={passed ? "ยืนยันตรวจรับผ่าน" : "ยืนยันไม่ผ่าน"}
          disabled={!passed && !note.trim()}
          onCancel={onClose}
          onSubmit={() => onSubmit(note.trim())}
        />
      </DialogContent>
    </Dialog>
  );
}
