"use client";

import { Fragment, useState, type ReactNode } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Select } from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import {
  QC_DEFECT_REASONS,
  QC_DEFECT_REASON_LABELS,
  qcReasonLabel,
  type QcDefectReason,
} from "@/lib/qc";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Plus,
  ScanLine,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ImageRemoveButton } from "@/components/ui/image-remove-button";
import { Alert } from "@/components/ui/alert";
import { DASHED_INTERACTIVE, TINT } from "@/components/ui/tokens";
import { c, Rw, StateBox, SubHead } from "@/components/orders/orders-ui";

// ส่วน "ตรวจนับ QC" ท้ายการ์ด "ของที่ต้องพร้อมก่อนผลิต" ในแท็บงานผลิต — นับของจุดที่ 2 ก่อนแพ็ค (FLOW-REDESIGN ก้อน 3)
// นับจริง "ดีกี่ตัว เสียกี่ตัว" · ของดีสะสมครบยอด→เข้าแพ็ก (ของเสียจากเสื้อเผื่อ
// บันทึกเป็นสถิติ) · ของดียังไม่ครบและมีเสีย→ถอยกลับผลิต/พักรอของตามเสื้อสำรอง
// หน้าตาตามต้นแบบ tabProduction() (รื้อ 2026-09-15): เส้นคั่น + หัวย่อย + ช่องสถานะ · ผลรายรอบพับไว้
// วางใน .cb ของการ์ดแม่ ไม่มีกรอบของตัวเอง · หน้าแม่ไม่วางส่วนนี้เมื่อเปิด Production V2

type QcContext = RouterOutput["qc"]["context"];
type QcRound = RouterOutput["qc"]["listByOrder"][number];
type ManufacturingQuantityLine = {
  id: string;
  description: string | null;
  size: string | null;
  color: string | null;
  printPosition: string | null;
  qtyPlanned: number;
  qtyGood: number;
};

interface OrderQcSectionProps {
  orderId: string;
  internalStatus: string;
  // ตรง server qc.create (OWNER/MANAGER/PRODUCTION_STAFF) — role อื่นเห็นประวัติแต่ไม่มีปุ่ม
  // ไม่งั้น UX โกหก: แถบขั้นต่อไปพา SALES มากรอกฟอร์มที่บันทึกแล้ว FORBIDDEN แน่นอน
  canCount: boolean;
}

// สถานะที่ยังไม่ถึงด่านตรวจ — ไม่มีผลตรวจแปลว่า "ยังไม่ถึง" · เลยด่านไปแล้วแต่ไม่มีผล = ไม่มีบันทึกในระบบ
const BEFORE_QC = new Set([
  "DRAFT",
  "INQUIRY",
  "CONFIRMED",
  "DESIGNING",
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
  "PRODUCING",
]);

function defectLine(d: QcRound["defects"][number]) {
  return [
    `${d.qty} ตัว`,
    qcReasonLabel(d.reason),
    d.size ? `ไซส์ ${d.size}${d.color ? `/${d.color}` : ""}` : null,
    d.printLabel ? `ลาย ${d.printLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function OrderQcSection({ orderId, internalStatus, canCount }: OrderQcSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const isQualityCheck = internalStatus === "QUALITY_CHECK";
  const { data: records, isLoading, isError, refetch } = trpc.qc.listByOrder.useQuery({ orderId });

  const rounds = records ?? [];
  const totalGood = rounds.reduce((s, r) => s + r.qtyGood, 0);
  const totalDefect = rounds.reduce((s, r) => s + r.qtyDefect, 0);
  // เรียง checkedAt desc — ตัวแรกคือรอบล่าสุด
  const latest = rounds[0];
  const latestReasons =
    latest && latest.qtyDefect > 0
      ? [...new Set(latest.defects.map((d) => qcReasonLabel(d.reason)))].join("/")
      : null;

  const action = isQualityCheck ? (
    canCount ? (
      <button type="button" className={c("btn primary sm")} onClick={() => setDialogOpen(true)}>
        <ScanLine aria-hidden="true" />
        ตรวจนับ
      </button>
    ) : (
      <span className={c("chip gray")}>รอทีมผลิตนับของ</span>
    )
  ) : undefined;

  let summary: ReactNode;
  if (isLoading && !records) {
    summary = <span className={c("sk skrow")} aria-hidden="true" />;
  } else if (isError && !records) {
    summary = (
      <StateBox
        tone="bad"
        icon={AlertTriangle}
        action={
          <button type="button" className={c("btn sm")} onClick={() => void refetch()}>
            ลองใหม่
          </button>
        }
      >
        โหลดประวัติ QC ไม่สำเร็จ
      </StateBox>
    );
  } else if (!latest) {
    summary = isQualityCheck ? (
      <StateBox tone="on" icon={ShieldCheck}>
        ยังไม่มีผลตรวจ — นับจริงก่อนแพ็ค: ดีกี่ตัว เสียกี่ตัว
      </StateBox>
    ) : (
      <StateBox icon={ShieldCheck}>
        {BEFORE_QC.has(internalStatus) ? "ยังไม่ถึงขั้นตรวจ" : "ไม่มีผลตรวจ QC ในระบบ"}
      </StateBox>
    );
  } else {
    summary = (
      <StateBox
        tone={isQualityCheck ? "on" : latest.qtyDefect > 0 ? "warn" : "good"}
        icon={isQualityCheck ? ShieldCheck : CheckCircle2}
      >
        นับแล้ว ดี {totalGood.toLocaleString("th-TH")} ตัว
        {` · เสีย ${totalDefect.toLocaleString("th-TH")} ตัว`}
        {` · ${rounds.length} รอบ`}
        {latestReasons ? ` · รอบล่าสุดเสีย: ${latestReasons}` : ""}
      </StateBox>
    );
  }

  return (
    <>
      <div className={c("hr")} />
      <SubHead icon={ShieldCheck} tone="good" title="ตรวจนับ QC" right={action} />
      {summary}

      {rounds.length > 0 ? (
        <details className={c("more")}>
          <summary>
            <ChevronRight aria-hidden="true" />
            ผลตรวจรายรอบ
          </summary>
          <div className={c("rows top")}>
            {rounds.map((r, idx) => (
              <Fragment key={r.id}>
                <Rw
                  icon={r.qtyDefect > 0 ? AlertTriangle : CheckCircle2}
                  tone={r.qtyDefect > 0 ? "bad" : "good"}
                  title={
                    <>
                      ตรวจรอบที่ {rounds.length - idx}{" "}
                      <span className={c("soft")}>
                        ดี {r.qtyGood} · เสีย {r.qtyDefect}
                      </span>
                    </>
                  }
                  sub={[formatDate(r.checkedAt), r.checkedBy.name, r.notes].filter(Boolean).join(" · ")}
                  right={
                    r.qtyDefect > 0 ? (
                      <span className={c("chip bad")}>เสีย {r.qtyDefect}</span>
                    ) : (
                      <span className={c("chip good")}>ดีล้วน</span>
                    )
                  }
                />
                {r.defects.map((d) => (
                  <div key={d.id} className={c("state bad")}>
                    <span className={c("grow")}>
                      {defectLine(d)}
                      {d.note ? <small style={{ display: "block", color: "var(--ink-2)" }}>{d.note}</small> : null}
                    </span>
                    {d.photoUrls.length > 0 ? (
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {d.photoUrls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className={c("thumb")}>
                            {/* ใช้ image element ตรง — รูปเสิร์ฟผ่าน /api/files (เช็ค session)
                                next/image optimizer fetch ฝั่ง server ไม่มี cookie จะ 401 */}
                            <img src={url} alt="รูปของเสีย" loading="lazy" decoding="async" />
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </details>
      ) : null}

      {dialogOpen && <QcCountDialog orderId={orderId} onClose={() => setDialogOpen(false)} />}
    </>
  );
}

// ============================================================
// Dialog นับจริง — โหลดบริบท (ยอดคาด/ลาย/เสื้อสำรอง) ก่อนเปิดฟอร์ม
// export ให้หน้า /production ใช้ตัวเดียวกัน (Gate B4: ปุ่มผ่านด่านตรวจ = เปิดใบนับ ไม่ใช่ข้ามด่าน)
// ============================================================

export function QcCountDialog({
  orderId,
  operationJobId,
  expectedRevision,
  operationRemaining,
  quantityLines,
  onClose,
  onCreated,
}: {
  orderId: string;
  operationJobId?: string;
  expectedRevision?: number;
  operationRemaining?: number;
  quantityLines?: readonly ManufacturingQuantityLine[];
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { data: context, isLoading, isError, refetch } = trpc.qc.context.useQuery(
    { orderId },
    { gcTime: 0, staleTime: 0 }
  );

  if (isError) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>นับจริง: ดีกี่ตัว เสียกี่ตัว</DialogTitle>
          </DialogHeader>
          <QueryError
            message="โหลดรายการสำหรับ QC ไม่สำเร็จ"
            onRetry={() => void refetch()}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (isLoading || !context) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>นับจริง: ดีกี่ตัว เสียกี่ตัว</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <QcCountForm
      orderId={orderId}
      context={context}
      operationJobId={operationJobId}
      expectedRevision={expectedRevision}
      operationRemaining={operationRemaining}
      quantityLines={quantityLines}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

const NONE = "__NONE__";

interface DefectRow {
  quantityLineId: string;
  qty: number;
  size: string; // "" = ไม่ระบุ
  color: string;
  printLabel: string; // "" = ไม่ระบุ
  reason: QcDefectReason | "";
  disposition: "HOLD" | "REWORK" | "SCRAP" | "";
  photoUrls: string[];
  note: string;
}

function QcCountForm({
  orderId,
  context,
  operationJobId,
  expectedRevision,
  operationRemaining,
  quantityLines,
  onClose,
  onCreated,
}: {
  orderId: string;
  context: QcContext;
  operationJobId?: string;
  expectedRevision?: number;
  operationRemaining?: number;
  quantityLines?: readonly ManufacturingQuantityLine[];
  onClose: () => void;
  onCreated?: () => void;
}) {
  // default = เหลือที่ยังไม่ผ่านตรวจ (ดีล้วนกดบันทึกเดียวจบ — ห้ามเพิ่มงานกรอกหน้างาน)
  const remaining = Math.max(
    0,
    operationJobId
      ? (operationRemaining ?? context.totalExpected - context.checkedGood)
      : context.totalExpected - context.checkedGood,
  );
  const [legacyQtyGood, setLegacyQtyGood] = useState(remaining);
  const [goodByLine, setGoodByLine] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (quantityLines ?? []).map((line) => [
        line.id,
        Math.max(0, line.qtyPlanned - line.qtyGood),
      ]),
    ),
  );
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [notes, setNotes] = useState("");
  // คง key เดิมตลอดฟอร์ม: network/response fail แล้วกดซ้ำต้องได้ผลเดิม ไม่เพิ่มยอด QC
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const sizes = [...new Set(context.lines.map((l) => l.size).filter(Boolean))] as string[];

  const utils = trpc.useUtils();
  const create = useMutationWithInvalidation(trpc.qc.create, {
    invalidate: [
      utils.qc.listByOrder,
      utils.qc.context,
      utils.order.getById,
      utils.production.getById,
      utils.production.kanban,
      utils.factory.stationContext,
      utils.factory.stationQueue,
      utils.task.myToday,
      utils.manufacturing.stationDispatch,
      utils.manufacturing.stationJob,
      utils.manufacturing.workOrder,
      utils.manufacturing.controlList,
    ],
    // toast ต้องบอกผลจริงตาม flags จาก server (qc.ts) — พักรอของ/งานแก้เปิดหรือไม่/
    // เข้าแพ็คหรือยังเหลือตรวจ ห้ามเดาเองจากแค่จำนวนเสีย
    onSuccess: (data: {
      qtyDefect: number;
      spareAvailable: number;
      movedToPacking: boolean;
      heldForStock: boolean;
      reworkOpened: boolean;
    }) => {
      if (operationJobId) {
        if (data.qtyDefect > 0) {
          toast.warning(`บันทึก QC แล้ว · ไม่ผ่าน ${data.qtyDefect} ตัว`, {
            description: "รายการ Hold/Rework ถูกหยุดไว้ให้หัวหน้าจัดการก่อนเดินต่อ",
          });
        } else {
          toast.success(`บันทึก QC ผ่าน ${qtyGood} ตัวแล้ว`);
        }
      } else if (data.heldForStock) {
        toast.warning("เสื้อสำรองไม่พอ — งานพักรอของ คุยลูกค้าก่อน", {
          description: `ของเสีย ${data.qtyDefect} ตัว · เสื้อสำรองเหลือ ${data.spareAvailable} ตัว — แจ้งแอดมินแล้ว`,
        });
      } else if (data.movedToPacking) {
        toast.success("QC ผ่านครบ — งานเข้าคิวแพ็คแล้ว", {
          description:
            data.qtyDefect > 0
              ? `พบของเสีย ${data.qtyDefect} ตัวจากของนอกยอดสั่ง/เสื้อเผื่อ และบันทึกสถิติไว้แล้ว`
              : undefined,
        });
      } else if (data.qtyDefect > 0 && data.reworkOpened) {
        toast.warning(`QC พบของเสีย ${data.qtyDefect} ตัว — ถอยกลับผลิต เปิดขั้นงานแก้แล้ว`, {
          description: `เสื้อสำรองเหลือ ${data.spareAvailable} ตัว`,
        });
      } else if (data.qtyDefect > 0) {
        toast.warning(
          `QC พบของเสีย ${data.qtyDefect} ตัว — ถอยกลับผลิตแล้ว แต่ยังไม่มีใบผลิต`,
          { description: "ไปเปิดใบผลิตงานแก้ที่หน้าการผลิต" }
        );
      } else {
        // ดีบางส่วน — งานค้างที่ด่านตรวจ รอตรวจส่วนที่เหลือ
        toast.success(`บันทึกแล้ว — ยังเหลือตรวจอีก ${Math.max(0, remaining - qtyGood)} ตัว`);
      }
      // success คือจบรอบตรวจนี้แล้ว; ถ้าผิวยังคง mount อยู่ รอบถัดไปต้องเป็น key ใหม่
      // ส่วน error ไม่ reset เพื่อให้ network/response retry ใช้ key เดิม
      setIdempotencyKey(crypto.randomUUID());
      onCreated?.();
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    },
  });

  function defectQtyForLine(rows: readonly DefectRow[], quantityLineId: string) {
    return rows.reduce(
      (sum, defect) =>
        sum + (defect.quantityLineId === quantityLineId ? defect.qty : 0),
      0,
    );
  }

  function syncGoodWithDefects(
    previous: readonly DefectRow[],
    next: readonly DefectRow[],
  ) {
    if (!operationJobId) return;
    setGoodByLine((current) =>
      Object.fromEntries(
        (quantityLines ?? []).map((line) => {
          const lineRemaining = Math.max(0, line.qtyPlanned - line.qtyGood);
          const previousMaximum = Math.max(
            0,
            lineRemaining - defectQtyForLine(previous, line.id),
          );
          const nextMaximum = Math.max(
            0,
            lineRemaining - defectQtyForLine(next, line.id),
          );
          const currentGood = current[line.id] ?? 0;
          return [
            line.id,
            currentGood === previousMaximum
              ? nextMaximum
              : Math.min(currentGood, nextMaximum),
          ];
        }),
      ),
    );
  }

  const update = (idx: number, patch: Partial<DefectRow>) => {
    const next = defects.map((defect, index) =>
      index === idx ? { ...defect, ...patch } : defect,
    );
    syncGoodWithDefects(defects, next);
    setDefects(next);
  };
  const removeRow = (idx: number) => {
    const next = defects.filter((_, index) => index !== idx);
    syncGoodWithDefects(defects, next);
    setDefects(next);
  };
  const addRow = () =>
    setDefects((prev) => [
      ...prev,
      {
        quantityLineId: "",
        qty: 1,
        size: "",
        color: "",
        printLabel: "",
        reason: "",
        disposition: "",
        photoUrls: [],
        note: "",
      },
    ]);

  const qtyDefectTotal = defects.reduce((s, d) => s + d.qty, 0);
  const qtyGood = operationJobId
    ? Object.values(goodByLine).reduce((sum, value) => sum + value, 0)
    : legacyQtyGood;
  const missingReason = defects.some(
    (d) =>
      d.qty <= 0 ||
      !d.reason ||
      (operationJobId ? !d.disposition || !d.quantityLineId : false),
  );
  const lineGoodOverLimit = (quantityLines ?? []).some(
    (line) => {
      const lineRemaining = Math.max(0, line.qtyPlanned - line.qtyGood);
      const lineGood = goodByLine[line.id] ?? 0;
      return (
        lineGood < 0 ||
        lineGood + defectQtyForLine(defects, line.id) > lineRemaining
      );
    },
  );
  const qtyGoodOverLimit = qtyGood > remaining || lineGoodOverLimit;
  const missingV2Lines = Boolean(
    operationJobId &&
      qtyGood > 0 &&
      (!quantityLines || quantityLines.length === 0),
  );
  const canSave =
    !missingReason &&
    !qtyGoodOverLimit &&
    !missingV2Lines &&
    qtyGood + qtyDefectTotal > 0;

  function allocateGoodToLines() {
    return (quantityLines ?? [])
      .map((line) => ({
        quantityLineId: line.id,
        qtyGood: goodByLine[line.id] ?? 0,
      }))
      .filter((line) => line.qtyGood > 0);
  }

  function handleSave() {
    create.mutate({
      orderId,
      idempotencyKey,
      operationJobId,
      expectedRevision,
      qtyGood,
      quantityLines: operationJobId ? allocateGoodToLines() : undefined,
      notes: notes || undefined,
      defects: defects.map((d) => ({
        quantityLineId: d.quantityLineId || undefined,
        qty: d.qty,
        size: d.size || undefined,
        color: d.color || undefined,
        printLabel: d.printLabel || undefined,
        reason: d.reason as QcDefectReason,
        disposition: d.disposition || undefined,
        photoUrls: d.photoUrls,
        note: d.note || undefined,
      })),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>นับจริง: ดีกี่ตัว เสียกี่ตัว</DialogTitle>
          <DialogDescription>
            ยอดงาน {context.totalExpected} ตัว · เสื้อสำรองเบิกเผื่อไว้ {context.spareAvailable} ตัว
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* นับดีครบยอดไปแล้ว (เช่น ของตีกลับหลังส่ง) — บอกทางเดินจริง ไม่ปล่อยเจอฟอร์มตัน:
              นับดีเพิ่มโดนกันนับเกิน · เดินหน้าใช้ปุ่มเปลี่ยนสถานะ (มีผลตรวจแล้วระบบให้ผ่าน) */}
          {context.totalExpected > 0 && remaining === 0 && (
            <Alert variant="info" icon={CheckCircle2} className="px-3 py-2 text-xs">
              นับดีครบยอดงานไปแล้ว — บันทึกรอบนี้เพื่อเก็บสถิติของเสียจากเสื้อเผื่อ
              แล้วระบบจะพางานเข้าแพ็ก
            </Alert>
          )}
          {/* ของดี — default เหลือที่ยังไม่ผ่านตรวจ นับตรงกดบันทึกได้เลย */}
          {operationJobId ? (
            <section aria-labelledby="qc-good-lines-title" className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="qc-good-lines-title" className="text-sm font-medium text-strong">
                  ของดีตามรายการ
                </h3>
                <p className="text-xs tabular-nums text-muted">
                  รวม {qtyGood.toLocaleString("th-TH")} ตัว
                </p>
              </div>
              {(quantityLines ?? []).map((line) => {
                const lineRemaining = Math.max(0, line.qtyPlanned - line.qtyGood);
                const lineDefect = defectQtyForLine(defects, line.id);
                const lineGoodMaximum = Math.max(0, lineRemaining - lineDefect);
                const value = goodByLine[line.id] ?? 0;
                const invalid = value < 0 || value + lineDefect > lineRemaining;
                return (
                  <div
                    key={line.id}
                    className="grid gap-3 rounded-lg border border-divider p-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-strong">
                        {[line.description, line.color, line.size, line.printPosition]
                          .filter(Boolean)
                          .join(" · ") || "รายการผลิต"}
                      </p>
                      <p className={cn("mt-0.5 text-xs", invalid ? "text-red-700" : "text-muted")}>
                        {invalid
                          ? `ของดีและไม่ผ่านรวมกันเกิน ${lineRemaining.toLocaleString("th-TH")} ตัว`
                          : lineDefect > 0
                            ? `ไม่ผ่าน ${lineDefect.toLocaleString("th-TH")} · ของดีได้ไม่เกิน ${lineGoodMaximum.toLocaleString("th-TH")}`
                            : `เหลือตรวจ ${lineRemaining.toLocaleString("th-TH")} ตัว`}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`qc-good-line-${line.id}`} className="text-xs text-muted">
                        ผ่าน
                      </label>
                      <Input
                        id={`qc-good-line-${line.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={lineGoodMaximum}
                        value={value}
                        aria-invalid={invalid || undefined}
                        onChange={(event) =>
                          setGoodByLine((current) => ({
                            ...current,
                            [line.id]: Math.max(
                              0,
                              Math.floor(Number(event.target.value) || 0),
                            ),
                          }))
                        }
                        className="text-center text-base tabular-nums"
                      />
                    </div>
                  </div>
                );
              })}
              {missingV2Lines ? (
                <Alert variant="error">ไม่พบรายการจำนวนของ Operation Job นี้</Alert>
              ) : null}
            </section>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-strong">ของดี (ตัว)</p>
                <p id="qc-good-remaining" className="text-xs tabular-nums text-muted">
                  {qtyGoodOverLimit
                    ? `กรอกเกินยอดที่เหลือ — นับของดีได้ไม่เกิน ${remaining} ตัว`
                    : `เหลือที่ยังไม่ผ่านตรวจ ${remaining} ตัว`}
                </p>
              </div>
              <Input
                aria-label="จำนวนของดีที่ตรวจในรอบนี้"
                aria-describedby="qc-good-remaining"
                type="number"
                inputMode="numeric"
                min={0}
                max={remaining}
                value={qtyGood}
                aria-invalid={qtyGoodOverLimit || undefined}
                onChange={(event) =>
                  setLegacyQtyGood(
                    Math.max(0, Math.floor(Number(event.target.value) || 0)),
                  )
                }
                className="w-24 text-center text-base tabular-nums"
              />
            </div>
          )}

          {/* ของเสีย — default ว่าง เพิ่มเฉพาะตอนเจอจริง */}
          {defects.map((d, idx) => (
            <div
              key={idx}
              className={cn(TINT.warning, "space-y-2 rounded-lg border p-3")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-strong">
                  ของเสีย #{idx + 1}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(idx)}
                  className="text-amber-700 hover:bg-red-50 hover:text-red-600 dark:text-amber-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  aria-label="ลบแถวของเสีย"
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor={`qc-defect-qty-${idx}`} className="text-xs text-muted">จำนวน (ตัว)</label>
                  <Input
                    id={`qc-defect-qty-${idx}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={d.qty}
                    onChange={(e) =>
                      update(idx, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                    }
                    className="text-center text-base tabular-nums"
                  />
                </div>
                {operationJobId ? (
                  <div className="space-y-1">
                    <label htmlFor={`qc-defect-line-${idx}`} className="text-xs text-muted">
                      รายการที่ไม่ผ่าน
                    </label>
                    <Select
                      id={`qc-defect-line-${idx}`}
                      value={d.quantityLineId}
                      onChange={(event) => {
                        const line = quantityLines?.find(
                          (item) => item.id === event.target.value,
                        );
                        update(idx, {
                          quantityLineId: event.target.value,
                          size: line?.size ?? "",
                          color: line?.color ?? "",
                          printLabel: line?.printPosition ?? "",
                        });
                      }}
                      className={cn(!d.quantityLineId && "border-amber-400")}
                      placeholder="เลือกสินค้า / สี / ไซซ์ / จุดพิมพ์"
                    >
                      {(quantityLines ?? []).map((line) => (
                        <option key={line.id} value={line.id}>
                          {[line.description, line.color, line.size, line.printPosition]
                            .filter(Boolean)
                            .join(" · ") || "รายการผลิต"}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label htmlFor={`qc-defect-size-${idx}`} className="text-xs text-muted">ไซส์</label>
                    <Select value={d.size === "" ? NONE : d.size}
                      onChange={(e) => update(idx, { size: e.target.value === NONE ? "" : e.target.value })} id={`qc-defect-size-${idx}`}>
                        <option value={NONE}>ไม่ระบุ</option>
                        {sizes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                  </div>
                )}
                {!operationJobId && context.printLabels.length > 0 && (
                  <div className="space-y-1">
                    <label htmlFor={`qc-defect-print-${idx}`} className="text-xs text-muted">ลาย</label>
                    <Select value={d.printLabel === "" ? NONE : d.printLabel}
                      onChange={(e) => update(idx, { printLabel: e.target.value === NONE ? "" : e.target.value })} id={`qc-defect-print-${idx}`}>
                        <option value={NONE}>ไม่ระบุ</option>
                        {context.printLabels.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </Select>
                  </div>
                )}
                <div
                  className={cn(
                    "space-y-1",
                    (operationJobId || context.printLabels.length === 0) && "col-span-2"
                  )}
                >
                  <label htmlFor={`qc-defect-reason-${idx}`} className="text-xs text-muted">สาเหตุ</label>
                  <Select value={d.reason || undefined}
                    onChange={(e) => update(idx, { reason: e.target.value as QcDefectReason })} id={`qc-defect-reason-${idx}`}
                      className={cn("", !d.reason && "border-amber-400")} placeholder="เลือกสาเหตุ">
                      {QC_DEFECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {QC_DEFECT_REASON_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                </div>
                {operationJobId ? (
                  <div className="col-span-2 space-y-1">
                    <label
                      htmlFor={`qc-defect-disposition-${idx}`}
                      className="text-xs text-muted"
                    >
                      งานที่ไม่ผ่านต้องไปทางไหน
                    </label>
                    <Select
                      id={`qc-defect-disposition-${idx}`}
                      value={d.disposition || undefined}
                      onChange={(event) =>
                        update(idx, {
                          disposition: event.target.value as
                            | "HOLD"
                            | "REWORK"
                            | "SCRAP",
                        })
                      }
                      className={cn(!d.disposition && "border-amber-400")}
                      placeholder="เลือกการจัดการ"
                    >
                      <option value="HOLD">พักไว้ให้หัวหน้าตัดสินใจ</option>
                      <option value="REWORK">ส่งกลับแก้และตรวจซ้ำ</option>
                      <option value="SCRAP">ตัดเป็นของเสีย</option>
                    </Select>
                  </div>
                ) : null}
              </div>

              {/* รูปจุดเสีย — แนบได้หลายรูป */}
              <div className="space-y-2">
                <p className="text-xs text-muted">รูปจุดเสีย (ถ้ามี)</p>
                {d.photoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {d.photoUrls.map((url) => (
                      <div key={url} className="group relative h-16 w-16">
                        <img
                          src={url}
                          alt="รูปของเสีย"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full rounded-lg object-cover"
                        />
                        <ImageRemoveButton
                          onClick={() =>
                            update(idx, { photoUrls: d.photoUrls.filter((u) => u !== url) })
                          }
                          label="ลบรูปของเสีย"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <FileUpload
                  bucket="designs"
                  pathPrefix={`qc/${orderId}`}
                  accept="image/*"
                  onUploaded={(url) => update(idx, { photoUrls: [...d.photoUrls, url] })}
                  onError={(msg) => toast.error(msg)}
                />
              </div>

              <Input
                value={d.note}
                onChange={(e) => update(idx, { note: e.target.value })}
                placeholder="หมายเหตุ เช่น จุดไหนของตัวเสื้อ"
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            className={cn(DASHED_INTERACTIVE, "h-11 w-full gap-1.5 text-sm")}
          >
            <Plus />
            เพิ่มของเสีย
          </Button>

          {/* แถบเตือนผลที่จะเกิดก่อนกด — คนกดต้องรู้ว่างานจะไปทางไหน (ตรรกะเดียวกับ server) */}
          {operationJobId ? (
            qtyDefectTotal > 0 ? (
              <Alert variant="warning" icon={AlertTriangle} className="px-3 py-2 text-xs">
                ของที่ไม่ผ่านทุกบรรทัดจะเดินตามทางที่เลือกไว้ ของดีเท่านั้นที่ส่งต่อได้
              </Alert>
            ) : qtyGood > 0 ? (
              <Alert variant="success" icon={CheckCircle2} className="px-3 py-2 text-xs">
                บันทึกของดี {qtyGood} ตัวเข้ายอดผ่าน QC
              </Alert>
            ) : null
          ) : context.totalExpected > 0 && qtyGood >= remaining ? (
            <Alert variant="success" icon={CheckCircle2} className="px-3 py-2 text-xs">
              ของดีสะสมครบยอด — งานจะเข้าคิวแพ็ก
              {qtyDefectTotal > 0
                ? ` และบันทึกของเสียจากของเผื่อ ${qtyDefectTotal} ตัวไว้ในสถิติ`
                : ""}
            </Alert>
          ) : qtyDefectTotal > 0 ? (
            context.spareAvailable < qtyDefectTotal ? (
              <Alert variant="error" icon={AlertTriangle} className="px-3 py-2 text-xs">
                เสื้อสำรองไม่พอ (เหลือ {context.spareAvailable}/{qtyDefectTotal} ตัว) —
                บันทึกแล้วงานจะพักรอของ คุยลูกค้า/สั่งเสื้อเพิ่มก่อน
              </Alert>
            ) : (
              <Alert variant="warning" icon={AlertTriangle} className="px-3 py-2 text-xs">
                บันทึกแล้วงานจะถอยกลับผลิต + เปิดขั้นงานแก้อัตโนมัติ
              </Alert>
            )
          ) : qtyGood > 0 ? (
            <Alert variant="neutral" icon={CheckCircle2} className="px-3 py-2 text-xs">
              ดีบางส่วน — บันทึกแล้วงานยังอยู่ด่านตรวจ เหลือตรวจอีก {remaining - qtyGood} ตัว
            </Alert>
          ) : null}

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="หมายเหตุรอบตรวจ (ถ้ามี)"
          />
        </div>

        <DialogSubmitFooter
          pending={create.isPending}
          disabled={!canSave}
          submitLabel={`บันทึก ดี ${qtyGood} · เสีย ${qtyDefectTotal}`}
          submitIcon={<ClipboardCheck />}
          onCancel={onClose}
          onSubmit={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}
