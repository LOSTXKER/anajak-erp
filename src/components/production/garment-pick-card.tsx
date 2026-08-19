"use client";

import { useState, type ComponentPropsWithoutRef } from "react";
import { trpc } from "@/lib/trpc";
import { SPOILAGE_RATE_PCT } from "@/lib/production-steps";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { cn } from "@/lib/utils";
import { FOCUS_FIELD_INVALID, TINT } from "@/components/ui/tokens";
import { Shirt, Check, AlertTriangle, PackageOpen, RefreshCw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { ProductionStep } from "./types";

// ใบเบิกเสื้อ + ใบคืนเศษ ผูกขั้น GARMENT_PICK (FLOW-REDESIGN ก้อน 1)
// — ไม่มีเงินบนการ์ดนี้ (มติเลิกคิดต้นทุนต่องาน) · mobile-first: ช่างใช้มือถือหน้างาน

interface GarmentLine {
  sku: string;
  productName: string;
  size: string;
  color: string | null;
  needed: number;
  issued: number;
  returned: number;
}

interface GarmentPickCardProps {
  productionId: string;
  steps: ProductionStep[];
  canIssueGarments: boolean;
  // คืนเศษเป็น recovery ที่ตั้งใจให้ทำได้จาก ERP หลังพัก/ยกเลิก แต่ Station ต้อง fail-closed
  canReturnGarments: boolean;
  /** ขั้น GARMENT_PICK ที่กำลังดูใน navigator; ไม่ส่งค่ายังคงใช้ขั้นแรกเพื่อรองรับ Station เดิม */
  stepId?: string;
  /** ใบเก่าที่ไม่มี GARMENT_PICK: ตัวเลขเป็นหลักฐานที่บันทึกไว้ ไม่ใช่คำตัดสินของจริง */
  legacyReadinessUnknown?: boolean;
  /** วางใน workspace/disclosure ที่มี surface เป็นเจ้าของอยู่แล้ว เพื่อไม่สร้าง Card ซ้อน */
  embedded?: boolean;
  /** ขั้นเบิกเสื้อเป็นงานปัจจุบัน จึงใช้ชื่อ action และปุ่มหลักที่เด่นกว่าการ์ดอ้างอิง */
  primaryTask?: boolean;
}

const lineLabel = (l: GarmentLine) =>
  `${l.productName} · ${l.size}${l.color ? `/${l.color}` : ""}`;

function GarmentSurface({
  embedded,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section"> & { embedded: boolean }) {
  if (embedded) {
    return (
      <section className={className} {...props}>
        {children}
      </section>
    );
  }

  return (
    <Card className={className} {...props}>
      {children}
    </Card>
  );
}

export function GarmentPickCard({
  productionId,
  steps,
  canIssueGarments,
  canReturnGarments,
  stepId,
  legacyReadinessUnknown = false,
  embedded = false,
  primaryTask = false,
}: GarmentPickCardProps) {
  const [showIssue, setShowIssue] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const garmentPickQuery = trpc.production.garmentPick.useQuery({ productionId });

  if (garmentPickQuery.isLoading) {
    return (
      <GarmentSurface
        embedded={embedded}
        role="status"
        aria-busy="true"
        className={cn(
          "flex items-center gap-2 text-sm text-muted",
          embedded ? "py-2" : "p-4",
        )}
      >
        <Spinner size="sm" />
        กำลังโหลดข้อมูลเสื้อจากสต๊อค...
      </GarmentSurface>
    );
  }

  if (garmentPickQuery.isError && !garmentPickQuery.data) {
    return (
      <GarmentSurface embedded={embedded} className={cn(!embedded && "p-4")}>
        <div className={cn(TINT.error, "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2")}>
          <p role="alert" className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            โหลดข้อมูลเสื้อจากสต๊อคไม่สำเร็จ
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void garmentPickQuery.refetch()}
            className="gap-1.5"
          >
            <RefreshCw aria-hidden="true" />
            ลองใหม่
          </Button>
        </div>
      </GarmentSurface>
    );
  }

  const data = garmentPickQuery.data;

  if (!data || data.lines.length === 0) {
    if (!legacyReadinessUnknown && !primaryTask) return null;

    return (
      <GarmentSurface embedded={embedded} aria-labelledby="production-garment-title">
        <CardHeader className={cn("pb-3", embedded && "p-0 pb-3")}>
          <h2
            id="production-garment-title"
            className={cn(
              "flex items-center gap-2 font-semibold tracking-tight text-strong",
              embedded && primaryTask ? "text-2xl" : "text-base",
            )}
          >
            <Shirt className="h-4 w-4" />
            {primaryTask ? "เบิกเสื้อจากสต๊อค" : "เสื้อจากสต๊อค"}
          </h2>
        </CardHeader>
        <CardContent className={cn(embedded && "p-0")}>
          <div className={cn(TINT.warning, "rounded-lg border px-3 py-2")}>
            <p className="text-sm font-medium">ไม่มีรายการเสื้อที่ตรวจยอดจากสต๊อคได้</p>
            <p className="mt-1 text-xs">
              {legacyReadinessUnknown
                ? "ใบเก่านี้ไม่มี SKU เชื่อมสต๊อค ให้ตรวจเสื้อจริงตามใบสั่งงานก่อนเริ่มรีด"
                : "ยังไม่มีรายการเสื้อที่เชื่อมกับสต๊อค ให้ตรวจข้อมูลออเดอร์ก่อนเบิก"}
            </p>
          </div>
        </CardContent>
      </GarmentSurface>
    );
  }

  const pickStep = stepId
    ? steps.find((step) => step.id === stepId && step.stepType === "GARMENT_PICK")
    : steps.find((step) => step.stepType === "GARMENT_PICK");
  const outstanding = data.lines.reduce((s, l) => s + (l.issued - l.returned), 0);
  const totalNeeded = data.lines.reduce((sum, line) => sum + line.needed, 0);
  const fulfilledQty = data.lines.reduce(
    (sum, line) =>
      sum + Math.min(line.needed, Math.max(0, line.issued - line.returned)),
    0,
  );
  const missingQty = data.lines.reduce(
    (sum, line) =>
      sum + Math.max(0, line.needed - (line.issued - line.returned)),
    0,
  );
  const needMore = data.lines.some((l) => l.issued - l.returned < l.needed);

  return (
    <GarmentSurface embedded={embedded} aria-labelledby="production-garment-title">
      <CardHeader className={cn("pb-3", embedded && "p-0 pb-3")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="production-garment-title"
              className={cn(
                "flex items-center gap-2 font-semibold tracking-tight text-strong",
                embedded && primaryTask ? "text-2xl" : "text-lg",
              )}
            >
              <Shirt className="h-5 w-5 text-secondary" />
              {primaryTask ? "เบิกเสื้อจากสต๊อค" : "เสื้อจากสต๊อค"}
            </h2>
            {primaryTask ? (
              <p className="mt-1 text-sm text-muted">
                ตรวจรุ่น สี และไซส์ให้ตรง ก่อนเบิกออกจากสต๊อค
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium tabular-nums",
              needMore
                ? "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                : "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-200",
            )}
          >
            {needMore ? `ยังขาด ${missingQty} ตัว` : `ครบ ${fulfilledQty}/${totalNeeded} ตัว`}
          </span>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-3", embedded && "p-0")}>
        {!data.configured && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — เบิก/คืนผ่านระบบไม่ได้ (Settings → Stock)
          </p>
        )}
        {data.problems.length > 0 && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{data.problems.join(" · ")}</span>
          </p>
        )}
        {data.lines.map((l) => {
          const net = l.issued - l.returned;
          const done = net >= l.needed;
          const missing = Math.max(0, l.needed - net);
          return (
            <div
              key={l.sku}
              className="grid gap-4 rounded-xl bg-surface-muted p-4 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words font-semibold text-strong">
                    {l.productName}
                  </p>
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ครบ
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  ไซส์ {l.size}{l.color ? ` · สี ${l.color}` : ""}
                </p>
              </div>
              <dl className="grid grid-cols-3 divide-x divide-divider text-center tabular-nums">
                <div className="px-2 first:pl-0">
                  <dt className="text-xs text-muted">ต้องใช้</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-strong">{l.needed}</dd>
                </div>
                <div className="px-2">
                  <dt className="text-xs text-muted">
                    {legacyReadinessUnknown ? "ระบบบันทึก" : "เบิกสุทธิ"}
                  </dt>
                  <dd className="mt-0.5 text-lg font-semibold text-strong">{net}</dd>
                </div>
                <div className="px-2 last:pr-0">
                  <dt className="text-xs text-muted">
                    {legacyReadinessUnknown ? "ยังไม่บันทึก" : "ยังขาด"}
                  </dt>
                  <dd
                    className={cn(
                      "mt-0.5 text-lg font-semibold",
                      missing > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300",
                    )}
                  >
                    {missing}
                  </dd>
                </div>
              </dl>
              {l.returned > 0 ? (
                <p className="text-xs tabular-nums text-muted sm:col-span-2">
                  เบิกทั้งหมด {l.issued} · คืนแล้ว {l.returned}
                </p>
              ) : null}
            </div>
          );
        })}
        {/* ปุ่มปิดขั้น GARMENT_PICK อยู่การ์ดนี้ที่เดียว (steps list ไม่มีปุ่มเร็ว) —
            เป็นแถวเต็มความกว้างท้ายการ์ด มือถือเป้านิ้ว 44px ไม่ซุกมุม header (UX4) */}
        {data.configured &&
          ((canIssueGarments && pickStep && needMore) ||
            (canReturnGarments && outstanding > 0)) && (
          <div className="flex flex-col gap-2 border-t border-divider pt-4 sm:flex-row">
            {canIssueGarments && pickStep && needMore && (
              <Button
                size={primaryTask ? "lg" : "default"}
                className={cn("w-full gap-1.5 sm:w-auto", primaryTask && "sm:min-w-56")}
                onClick={() => setShowIssue(true)}
              >
                <PackageOpen />
                {primaryTask ? `เบิกเสื้อที่ยังขาด ${missingQty} ตัว` : "เบิกเสื้อ"}
              </Button>
            )}
            {canReturnGarments && outstanding > 0 && (
              <Button
                variant="outline"
                className="w-full gap-1.5 sm:w-auto"
                onClick={() => setShowReturn(true)}
              >
                <Undo2 />
                คืนเศษ
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {showIssue && pickStep && (
        <IssueGarmentsDialog
          productionId={productionId}
          stepId={pickStep.id}
          lines={data.lines}
          onClose={() => setShowIssue(false)}
        />
      )}
      {showReturn && (
        <ReturnGarmentsDialog
          productionId={productionId}
          lines={data.lines}
          onClose={() => setShowReturn(false)}
        />
      )}
    </GarmentSurface>
  );
}

// ============================================================
// Dialog เบิกเสื้อ — default จำนวน = ที่ยังขาด · เบิกเผื่อเสียเกินได้ (Stock กันของไม่พอเอง)
// ============================================================

function useGarmentInvalidate() {
  const utils = trpc.useUtils();
  return [
    utils.production.garmentPick,
    utils.production.getById,
    utils.production.getByOrderId,
    utils.factory.stationQueue,
    utils.order.getById,
  ];
}

function IssueGarmentsDialog({
  productionId,
  stepId,
  lines,
  onClose,
}: {
  productionId: string;
  stepId: string;
  lines: GarmentLine[];
  onClose: () => void;
}) {
  // key เดียวต่อการเปิด dialog — กดซ้ำ/เน็ตสะดุดแล้วลองใหม่ ไม่ตัดสต๊อคซ้ำ
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  // default = ที่ยังขาด + เผื่อเสีย 3% ของทั้งงาน (มติเบส: ค่าเริ่ม 3% แก้ได้ต่องาน
  // เศษเหลือคืนผ่านใบคืนเศษ) — เบิกรอบแรกได้เผื่อเลย ไม่ต้องคิดเลขเอง
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      lines.map((l) => {
        const target = Math.ceil(l.needed * (1 + SPOILAGE_RATE_PCT / 100));
        return [l.sku, Math.max(0, target - (l.issued - l.returned))];
      })
    )
  );
  const invalidate = useGarmentInvalidate();
  const issue = useMutationWithInvalidation(trpc.production.issueGarments, {
    invalidate,
    onSuccess: (r: { docNumber: string; issuedQty: number; stepCompleted: boolean }) => {
      toast.success(`เบิกเสื้อแล้ว ${r.issuedQty} ตัว`, {
        description: `เอกสาร ${r.docNumber}${r.stepCompleted ? " · ขั้นเบิกเสื้อปิดให้แล้ว" : ""}`,
      });
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error("เบิกเสื้อไม่สำเร็จ", { description: err.message });
    },
  });

  const total = lines.reduce((s, l) => s + (qty[l.sku] ?? 0), 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เบิกเสื้อจากสต๊อค</DialogTitle>
          <DialogDescription>
            ระบบตัดยอดจองของออเดอร์นี้ให้อัตโนมัติ — ตัวเลขตั้งต้นรวมเผื่อเสีย{" "}
            {SPOILAGE_RATE_PCT}% แล้ว (แก้ได้ · เศษเหลือคืนผ่านปุ่มคืนเศษ)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {lines.map((l, index) => {
            const remaining = Math.max(0, l.needed - (l.issued - l.returned));
            const helpId = `issue-garment-${index}-help`;
            return (
              <div key={l.sku} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {lineLabel(l)}
                  </p>
                  <p id={helpId} className="text-xs tabular-nums text-muted">
                    ต้องใช้ {l.needed} · ยังขาด {remaining}
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={qty[l.sku] ?? 0}
                  aria-label={`จำนวนเสื้อที่จะเบิก ${lineLabel(l)}`}
                  aria-describedby={helpId}
                  onChange={(e) =>
                    setQty((prev) => ({
                      ...prev,
                      [l.sku]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className="h-10 w-24 text-center tabular-nums"
                />
              </div>
            );
          })}
        </div>
        <DialogSubmitFooter
          pending={issue.isPending}
          disabled={total <= 0}
          pendingLabel="กำลังเบิก..."
          submitLabel={`เบิก ${total} ตัว`}
          submitIcon={<PackageOpen />}
          onCancel={onClose}
          onSubmit={() =>
            issue.mutate({
              productionId,
              stepId,
              idempotencyKey,
              lines: lines
                .map((l) => ({ sku: l.sku, qty: qty[l.sku] ?? 0 }))
                .filter((l) => l.qty > 0),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Dialog คืนเศษ — คืนได้ไม่เกินยอดเบิกค้าง (server กันซ้ำอีกชั้น)
// ============================================================

function ReturnGarmentsDialog({
  productionId,
  lines,
  onClose,
}: {
  productionId: string;
  lines: GarmentLine[];
  onClose: () => void;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.sku, 0]))
  );
  const [note, setNote] = useState("");
  const invalidate = useGarmentInvalidate();
  const ret = useMutationWithInvalidation(trpc.production.returnGarments, {
    invalidate,
    onSuccess: (r: { docNumber: string; returnedQty: number }) => {
      toast.success(`คืนเศษเข้าสต๊อคแล้ว ${r.returnedQty} ตัว`, {
        description: `เอกสาร ${r.docNumber}`,
      });
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error("คืนเศษไม่สำเร็จ", { description: err.message });
    },
  });

  const surplusOf = (line: GarmentLine) =>
    Math.max(0, line.issued - line.returned - line.needed);
  const returnable = lines.filter((line) => surplusOf(line) > 0);
  const total = returnable.reduce((s, l) => s + (qty[l.sku] ?? 0), 0);
  const overLimit = returnable.some((line) => (qty[line.sku] ?? 0) > surplusOf(line));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>คืนเศษเข้าสต๊อค</DialogTitle>
          <DialogDescription>
            เสื้อที่เบิกเผื่อแล้วเหลือ — คืนกลับเข้าสต๊อคให้ตัวเลขตรงของจริง
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {returnable.map((l, index) => {
            const max = surplusOf(l);
            const over = (qty[l.sku] ?? 0) > max;
            const helpId = `return-garment-${index}-help`;
            return (
              <div key={l.sku} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {lineLabel(l)}
                  </p>
                  <p
                    id={helpId}
                    aria-live="polite"
                    className={cn(
                      "text-xs tabular-nums",
                      over ? "text-red-600 dark:text-red-400" : "text-muted"
                    )}
                  >
                    {over
                      ? `กรอกเกินเศษที่คืนได้ — คืนได้ไม่เกิน ${max}`
                      : `เศษที่คืนได้ ${max}`}
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  value={qty[l.sku] ?? 0}
                  aria-label={`จำนวนเสื้อที่จะคืน ${lineLabel(l)}`}
                  aria-describedby={helpId}
                  aria-invalid={over || undefined}
                  onChange={(e) =>
                    setQty((prev) => ({
                      ...prev,
                      [l.sku]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className={cn(
                    "h-10 w-24 text-center tabular-nums",
                    over && cn("border-red-300", FOCUS_FIELD_INVALID)
                  )}
                />
              </div>
            );
          })}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="หมายเหตุการคืนเศษ"
            rows={2}
            placeholder="หมายเหตุ (ถ้ามี) เช่น เหลือจากเผื่อเสีย"
          />
        </div>
        <DialogSubmitFooter
          pending={ret.isPending}
          disabled={total <= 0 || overLimit}
          pendingLabel="กำลังคืน..."
          submitLabel={`คืน ${total} ตัว`}
          submitIcon={<Undo2 />}
          onCancel={onClose}
          onSubmit={() =>
            ret.mutate({
              productionId,
              idempotencyKey,
              note: note || undefined,
              lines: returnable
                .map((l) => ({ sku: l.sku, qty: qty[l.sku] ?? 0 }))
                .filter((l) => l.qty > 0),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
