"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { Loader2, Check } from "lucide-react";
import type { ProductionStep } from "./types";

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
  step: ProductionStep;
  busy: boolean;
  onSubmit: (payload: { status: "COMPLETED" } | { qtyDone: number }) => void;
  onClose: () => void;
}) {
  const total = step.qtyTotal ?? 0;
  const done = step.qtyDone ?? 0;
  const remaining = Math.max(0, total - done);
  const [value, setValue] = useState<string>(String(remaining));

  const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
  // จำนวนทำเพิ่มรอบนี้ clamp ไม่เกินที่เหลือ — server ไม่ validate เพดาน qtyDone
  // (zod มีแค่ min(0)) จอนี้จึงเป็นด่านเดียวที่กันเลขเกิน
  const added = Math.min(remaining, Math.max(0, Math.floor(Number(value) || 0)));
  const newDone = done + added;
  const willComplete = added === remaining && remaining > 0;

  function handleConfirm() {
    if (added <= 0) return;
    onSubmit(willComplete ? { status: "COMPLETED" } : { qtyDone: newDone });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* มือถือ: แผ่นติดขอบล่าง (นิ้วโป้งถึง) · จอใหญ่: dialog กลางจอปกติ ·
          กัน autofocus — คีย์บอร์ดมือถือเด้งทับปุ่มยืนยันที่ติดขอบล่าง (เคสหลัก
          "ครบ→ยืนยัน" ไม่ต้องพิมพ์เลย · คีย์บอร์ดเปิดเมื่อช่างแตะช่องเองเท่านั้น) */}
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="bottom-0 left-0 right-0 top-auto max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-5 data-[state=closed]:slide-out-to-bottom-10 data-[state=open]:slide-in-from-bottom-10 sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:p-6"
      >
        <div className="space-y-1">
          <DialogTitle>{stepName}</DialogTitle>
          <DialogDescription>
            ทำแล้ว <span className="font-semibold tabular-nums">{done}/{total}</span> ตัว
            — รอบนี้ทำเพิ่มกี่ตัว?
          </DialogDescription>
        </div>

        <div className="space-y-3">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={remaining}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            // แตะช่องแล้วเลขเดิมถูก select ทั้งก้อน — พิมพ์ใหม่แทนที่ทันที (กัน "50"→"5010")
            onFocus={(e) => e.currentTarget.select()}
            className="h-14 text-center text-2xl font-bold tabular-nums"
          />
          {!willComplete && (
            <button
              type="button"
              onClick={() => setValue(String(remaining))}
              className="min-h-11 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50"
            >
              ครบที่เหลือ ({remaining} ตัว)
            </button>
          )}
          <p className="text-center text-sm text-slate-500">
            รวมเป็น{" "}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
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
            disabled={busy || added <= 0}
            className="h-11 flex-[2] gap-1.5"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {willComplete ? "เสร็จครบ — ปิดขั้นนี้" : `บันทึก ${newDone}/${total}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
