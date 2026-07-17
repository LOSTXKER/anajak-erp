"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SPOILAGE_RATE_PCT } from "@/lib/production-steps";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Shirt, Check, Loader2, AlertTriangle, PackageOpen, Undo2 } from "lucide-react";
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
  canUpdateStep: boolean;
}

const lineLabel = (l: GarmentLine) =>
  `${l.productName} · ${l.size}${l.color ? `/${l.color}` : ""}`;

export function GarmentPickCard({ productionId, steps, canUpdateStep }: GarmentPickCardProps) {
  const [showIssue, setShowIssue] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const { data } = trpc.production.garmentPick.useQuery({ productionId });

  if (!data || data.lines.length === 0) return null;

  const pickStep = steps.find((s) => s.stepType === "GARMENT_PICK");
  const outstanding = data.lines.reduce((s, l) => s + (l.issued - l.returned), 0);
  const needMore = data.lines.some((l) => l.issued - l.returned < l.needed);

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <Shirt className="h-4 w-4" />
          เสื้อจากสต๊อค
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data.configured && (
          <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — เบิก/คืนผ่านระบบไม่ได้ (Settings → Stock)
          </p>
        )}
        {data.problems.length > 0 && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{data.problems.join(" · ")}</span>
          </p>
        )}
        {data.lines.map((l) => {
          const net = l.issued - l.returned;
          const done = net >= l.needed;
          return (
            <div
              key={l.sku}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {lineLabel(l)}
                </p>
                <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  ต้องใช้ {l.needed} · เบิกแล้ว {l.issued}
                  {l.returned > 0 && ` · คืนแล้ว ${l.returned}`}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                  done
                    ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {done && <Check className="h-3 w-3" />}
                {done ? "ครบ" : `ขาด ${l.needed - net}`}
              </span>
            </div>
          );
        })}
        {/* ปุ่มปิดขั้น GARMENT_PICK อยู่การ์ดนี้ที่เดียว (steps list ไม่มีปุ่มเร็ว) —
            เป็นแถวเต็มความกว้างท้ายการ์ด มือถือเป้านิ้ว 44px ไม่ซุกมุม header (UX4) */}
        {canUpdateStep && data.configured && ((pickStep && needMore) || outstanding > 0) && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            {pickStep && needMore && (
              <Button className="w-full gap-1.5 sm:w-auto" onClick={() => setShowIssue(true)}>
                <PackageOpen className="h-4 w-4" />
                เบิกเสื้อ
              </Button>
            )}
            {outstanding > 0 && (
              <Button
                variant="outline"
                className="w-full gap-1.5 sm:w-auto"
                onClick={() => setShowReturn(true)}
              >
                <Undo2 className="h-4 w-4" />
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
    </Card>
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
          {lines.map((l) => {
            const remaining = Math.max(0, l.needed - (l.issued - l.returned));
            return (
              <div key={l.sku} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {lineLabel(l)}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    ต้องใช้ {l.needed} · ยังขาด {remaining}
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={qty[l.sku] ?? 0}
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
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={total <= 0 || issue.isPending}
            onClick={() =>
              issue.mutate({
                productionId,
                stepId,
                idempotencyKey,
                lines: lines
                  .map((l) => ({ sku: l.sku, qty: qty[l.sku] ?? 0 }))
                  .filter((l) => l.qty > 0),
              })
            }
            className="gap-1.5"
          >
            {issue.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PackageOpen className="h-4 w-4" />
            )}
            เบิก {total} ตัว
          </Button>
        </DialogFooter>
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

  const returnable = lines.filter((l) => l.issued - l.returned > 0);
  const total = returnable.reduce((s, l) => s + (qty[l.sku] ?? 0), 0);
  const overLimit = returnable.some((l) => (qty[l.sku] ?? 0) > l.issued - l.returned);

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
          {returnable.map((l) => {
            const max = l.issued - l.returned;
            const over = (qty[l.sku] ?? 0) > max;
            return (
              <div key={l.sku} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {lineLabel(l)}
                  </p>
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      over ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    คืนได้ไม่เกิน {max}
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  value={qty[l.sku] ?? 0}
                  onChange={(e) =>
                    setQty((prev) => ({
                      ...prev,
                      [l.sku]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className={cn(
                    "h-10 w-24 text-center tabular-nums",
                    over && "border-red-300 focus-visible:ring-red-400"
                  )}
                />
              </div>
            );
          })}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="หมายเหตุ (ถ้ามี) เช่น เหลือจากเผื่อเสีย"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={total <= 0 || overLimit || ret.isPending}
            onClick={() =>
              ret.mutate({
                productionId,
                idempotencyKey,
                note: note || undefined,
                lines: returnable
                  .map((l) => ({ sku: l.sku, qty: qty[l.sku] ?? 0 }))
                  .filter((l) => l.qty > 0),
              })
            }
            className="gap-1.5"
          >
            {ret.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" />
            )}
            คืน {total} ตัว
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
