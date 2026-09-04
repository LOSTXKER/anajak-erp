"use client";

/**
 * คำสั่งบนขั้นงานที่ใช้ร่วมกันทั้งใบผลิต `/production/[id]` และโหมดหน้างาน `/production/floor`
 * (โครง "หนึ่งโมดูล สองสายตา" — เบสเคาะ 2026-09-03: หัวหน้าทำครบจากใบผลิต · ช่างใช้หน้างาน · ปุ่มชุดเดียวกัน)
 *
 *   ProblemDialog — แจ้งปัญหาแบบกดเลือกเหตุ ไม่ต้องพิมพ์ (ข้อความลง reportStationProblem.reason ตรง ๆ)
 *   FixDialog     — หัวหน้าแก้ให้: ยอด · คน/ปลดปัญหา · พัก · คืนคิว · ผ่านแทน (ทุกอย่างวิ่งผ่าน controller → server เดิม)
 * ทั้งคู่รับเครื่องยนต์ (WorkOrderController) เป็น props — ไม่มี query ของตัวเอง
 */

import { useState } from "react";
import { ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import type { ProductionStep } from "@/components/production/types";
import type { WorkOrderController } from "@/components/production/work-order-controller";
import { stepLabel } from "@/components/production/work-order-pieces";
import { PROBLEM_REASON_MIN_LENGTH, STATION_PROBLEM_REASONS, composeProblemReason } from "@/lib/station-desk";
import { buildFixCommands, type FixCommand } from "@/lib/step-fix-commands";
import { cn, formatDateTime } from "@/lib/utils";

/* ───────────────────────── แจ้งปัญหาแบบกดเลือก ───────────────────────── */

export function ProblemDialog({ open, onClose, step, c }: { open: boolean; onClose: () => void; step: ProductionStep; c: WorkOrderController }) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const other = reason === "other";
  const text = composeProblemReason(reason, detail);
  const ready = text.length >= PROBLEM_REASON_MIN_LENGTH;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>แจ้งปัญหา — {stepLabel(step)}</DialogTitle>
          <DialogDescription>เลือกเรื่องที่เจอ งานนี้จะหยุดไว้และแจ้งหัวหน้าทันที</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {[...STATION_PROBLEM_REASONS, "other"].map((r) => {
            const label = r === "other" ? "อื่น ๆ (พิมพ์บอก)" : r;
            const on = reason === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => setReason(r)}
                className={cn(
                  "min-h-14 px-4 text-left text-base font-medium transition-colors",
                  RADIUS.inner,
                  on ? "bg-interactive-selected text-strong ring-2 ring-inset ring-blue-600 dark:ring-blue-400" : cn(SUNK_PANEL, "text-strong hover:bg-interactive-hover"),
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={other ? "พิมพ์สั้น ๆ ว่าเจออะไร (อย่างน้อย 3 ตัวอักษร)" : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"} rows={2} />
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={onClose} disabled={c.reportProblem.isPending}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={!ready || c.reportProblem.isPending}
            onClick={() => c.reportProblem.mutate({ stepId: step.id, reason: text }, { onSuccess: onClose })}
          >
            {c.reportProblem.isPending ? "กำลังแจ้ง…" : "แจ้งหัวหน้า"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── หัวหน้าแก้ให้ ───────────────────────── */

/** รายการ "แก้ให้" ผูกกับเครื่องยนต์ของใบ — กติกาอยู่ lib/step-fix-commands (ทดสอบแยกได้) */
export function fixCommands(step: ProductionStep, c: WorkOrderController): FixCommand[] {
  return buildFixCommands(step, {
    openQty: c.openQty,
    openManagerEdit: (s) => c.openEdit(s, "manager"),
    setStatus: (s, status) => void c.handleSupervisorStatus(s, status),
  });
}

export function FixDialog({ open, onClose, step, c }: { open: boolean; onClose: () => void; step: ProductionStep; c: WorkOrderController }) {
  const rows = fixCommands(step, c);
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>แก้ให้ — {stepLabel(step)}</DialogTitle>
          <DialogDescription>
            {step.assignedTo ? `ผู้รับผิดชอบตอนนี้ ${step.assignedTo.name}` : "ยังไม่มีคนรับขั้นนี้"}
            {step.startedAt ? ` · เริ่ม ${formatDateTime(step.startedAt)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-divider">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                disabled={!row.enabled}
                onClick={() => {
                  onClose();
                  row.run();
                }}
                className="flex w-full items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-interactive-hover disabled:opacity-60 disabled:hover:bg-transparent"
              >
                <Wrench className={cn("mt-0.5 h-5 w-5 shrink-0", row.danger ? "text-red-600 dark:text-red-400" : "text-muted")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-base font-medium", row.danger ? "text-red-700 dark:text-red-300" : "text-strong")}>{row.label}</span>
                  <span className="block text-sm text-secondary">{row.enabled ? row.desc : row.why}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className={cn("flex items-start gap-2 border p-3 text-sm", TINT.info, RADIUS.inner)}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>ทุกอย่างที่หัวหน้าแก้ ระบบจดชื่อและเวลาไว้ในประวัติการใช้งาน</span>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={onClose}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
