"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { validateStepQtyInput } from "@/lib/step-qty-input";
import { Loader2, Check } from "lucide-react";
import { DASHED_INTERACTIVE, FOCUS_FIELD_INVALID } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// bottom sheet ปิดขั้นแบบนับจำนวน (UX1) — ช่างบอก "ทำเพิ่มกี่ตัว" ใน 2 แตะ
// default = ที่เหลือทั้งหมด (กดยืนยันเลย = ปิดขั้น) · กรอกน้อยกว่า = บันทึกบางส่วน
// ยิง updateStep เดิมเท่านั้น: ครบ → {status: COMPLETED} (server snap จำนวนให้เอง)
// · บางส่วน → {qtyDone} (server เริ่มขั้นให้เองถ้ายัง PENDING) — ไม่มีทางลัด status ใหม่
export function StepQtySheet({
  step,
  busy,
  onSubmit,
  onClose,
}: {
  // ใช้แค่ 4 field นี้ — รับได้ทั้ง ProductionStep (หน้าใบผลิต UX1) และ KanbanStep (บอร์ด UX8)
  step: {
    qtyTotal: number | null;
    qtyDone: number | null;
    customStepName: string | null;
    stepType: string;
  };
  busy: boolean;
  onSubmit: (payload: { status: "COMPLETED" } | { qtyDone: number }) => void;
  onClose: () => void;
}) {
  const total = step.qtyTotal ?? 0;
  const done = step.qtyDone ?? 0;
  const remaining = Math.max(0, total - done);
  const [value, setValue] = useState<string>(String(remaining));
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionId = useId();
  const errorId = useId();

  const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
  // ห้าม clamp เลขเกินเงียบๆ: คนทำต้องเห็นและแก้ตัวเลขก่อนปิดขั้น
  // ไม่งั้นกรอก 99 ทั้งที่ทำ 9 ตัว จอจะแปลเป็น "ครบ" แล้วปิดงานผิด
  const validation = validateStepQtyInput(value, remaining);
  const added = validation.added;
  const newDone = done + added;
  const willComplete = validation.error === null && added === remaining && remaining > 0;

  function handleConfirm() {
    if (validation.error !== null) return;
    onSubmit(willComplete ? { status: "COMPLETED" } : { qtyDone: newDone });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* มือถือ: แผ่นติดขอบล่าง (นิ้วโป้งถึง) · จอใหญ่: dialog กลางจอปกติ ·
          โฟกัสหัวเรื่องแทน input — คีย์บอร์ดมือถือไม่เด้งทับปุ่มยืนยันที่ติดขอบล่าง
          (เคสหลัก "ครบ→ยืนยัน" ไม่ต้องพิมพ์เลย · คีย์บอร์ดเปิดเมื่อช่างแตะช่องเองเท่านั้น) */}
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
        className="bottom-0 left-0 right-0 top-auto max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-5 data-[state=closed]:slide-out-to-bottom-10 data-[state=open]:slide-in-from-bottom-10 sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:p-6"
      >
        <div className="space-y-1">
          <DialogTitle ref={titleRef} tabIndex={-1}>{stepName}</DialogTitle>
          <DialogDescription id={descriptionId}>
            ทำแล้ว <span className="font-semibold tabular-nums">{done}/{total}</span> ตัว
            — รอบนี้ทำเพิ่มกี่ตัว?
          </DialogDescription>
        </div>

        <div className="space-y-3">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={remaining}
            step={1}
            value={value}
            aria-label={`จำนวนที่ทำเพิ่มสำหรับ ${stepName}`}
            aria-invalid={validation.error !== null || undefined}
            aria-describedby={
              validation.error === null ? descriptionId : `${descriptionId} ${errorId}`
            }
            onChange={(e) => setValue(e.target.value)}
            // แตะช่องแล้วเลขเดิมถูก select ทั้งก้อน — พิมพ์ใหม่แทนที่ทันที (กัน "50"→"5010")
            onFocus={(e) => e.currentTarget.select()}
            className={cn(
              "h-14 text-center text-2xl font-semibold tabular-nums",
              validation.error !== null && cn("border-red-300", FOCUS_FIELD_INVALID),
            )}
          />
          {validation.error !== null && (
            <p
              id={errorId}
              role="alert"
              className="text-center text-sm font-medium text-red-700 dark:text-red-300"
            >
              {validation.error}
            </p>
          )}
          {!willComplete && (
            <button
              type="button"
              onClick={() => setValue(String(remaining))}
              className={cn(DASHED_INTERACTIVE, "min-h-11 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed dark:text-slate-300 dark:hover:bg-interactive-hover dark:hover:text-strong dark:active:bg-interactive-pressed")}
            >
              ครบที่เหลือ ({remaining} ตัว)
            </button>
          )}
          <p className="text-center text-sm text-muted">
            รวมเป็น{" "}
            <span className="font-semibold tabular-nums text-strong">
              {newDone}/{total}
            </span>
            {willComplete && (
              <span className="font-medium text-green-600 dark:text-green-400">
                {" "}
                — ครบ ขั้นนี้จะปิด
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 flex-1">
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || validation.error !== null}
            aria-busy={busy || undefined}
            className="h-11 flex-[2] gap-1.5"
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {busy
              ? "กำลังบันทึก..."
              : willComplete
                ? "เสร็จครบ — ปิดขั้นนี้"
                : `บันทึก ${newDone}/${total}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
