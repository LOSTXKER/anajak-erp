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
import { STATION_PROBLEM_REASONS } from "@/lib/station-desk";
import { cn, formatDateTime } from "@/lib/utils";

/* ───────────────────────── แจ้งปัญหาแบบกดเลือก ───────────────────────── */

export function ProblemDialog({ open, onClose, step, c }: { open: boolean; onClose: () => void; step: ProductionStep; c: WorkOrderController }) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const other = reason === "other";
  const text = other ? detail.trim() : reason ? `${reason}${detail.trim() ? ` — ${detail.trim()}` : ""}` : "";
  const ready = text.length >= 3;
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

type FixRow = { key: string; label: string; desc: string; enabled: boolean; why?: string; danger?: boolean; run: () => void };

export function FixDialog({ open, onClose, step, c }: { open: boolean; onClose: () => void; step: ProductionStep; c: WorkOrderController }) {
  const done = step.status === "COMPLETED";
  const stuck = step.status === "FAILED" || step.status === "ON_HOLD";
  const live = step.status === "PENDING" || step.status === "IN_PROGRESS";
  const serviceOwned = ["GARMENT_PICK", "GARMENT_RECEIVE", "DTF_PRINT"].includes(step.stepType);
  const rows: FixRow[] = [
    {
      key: "qty",
      label: "แก้ยอดที่บันทึก",
      desc: "นับผิดหรือกดเลขผิด — ใส่ยอดที่ถูกแทน",
      enabled: live && !!step.qtyTotal && !serviceOwned,
      why: done ? "ขั้นปิดแล้ว" : serviceOwned ? "ขั้นนี้แก้ยอดผ่านเมนูเฉพาะ (เบิก/ตรวจรับ/รอบพิมพ์)" : !step.qtyTotal ? "ขั้นนี้ไม่นับตัว" : undefined,
      run: () => c.openQty(step.id),
    },
    {
      key: "assign",
      label: stuck ? "ปลดปัญหา / เปลี่ยนคนทำ" : "เปลี่ยนคนทำ",
      desc: stuck ? "บอกวิธีที่แก้แล้ว หรือย้ายงานให้คนอื่น" : "ย้ายให้คนอื่น หรือปลดชื่อคนที่กดรับงานผิด",
      enabled: !done,
      why: done ? "ขั้นปิดแล้ว" : undefined,
      run: () => c.openEdit(step, "manager"),
    },
    {
      key: "hold",
      label: "พักงานนี้ไว้ก่อน",
      desc: "เอาออกจากคิวชั่วคราว ช่างจะไม่เห็นในคิวพร้อมทำ",
      enabled: live && !serviceOwned,
      why: !live ? "พักได้เฉพาะขั้นที่รอ/กำลังทำ" : serviceOwned ? "ขั้นนี้เดินผ่านเมนูเฉพาะ" : undefined,
      run: () => void c.handleSupervisorStatus(step, "ON_HOLD"),
    },
    {
      key: "requeue",
      label: "คืนกลับคิวพร้อมทำ",
      desc: "ช่างกดเริ่มผิดใบ — เอากลับเป็นรอทำ",
      enabled: step.status === "IN_PROGRESS" && !serviceOwned,
      why: step.status !== "IN_PROGRESS" ? "ใช้กับขั้นที่กำลังทำเท่านั้น" : serviceOwned ? "ขั้นนี้เดินผ่านเมนูเฉพาะ" : undefined,
      run: () => void c.handleSupervisorStatus(step, "PENDING"),
    },
    {
      key: "skip",
      label: "ผ่านขั้นนี้แทนช่าง",
      desc: "ทำแล้วจริงแต่ไม่ได้กดในระบบ — ปิดขั้นให้ในชื่อหัวหน้า",
      enabled: live && !serviceOwned,
      why: !live ? "ผ่านได้เฉพาะขั้นที่รอ/กำลังทำ" : serviceOwned ? "ขั้นนี้ปิดผ่านเมนูเฉพาะเท่านั้น" : undefined,
      danger: true,
      run: () => void c.handleSupervisorStatus(step, "COMPLETED"),
    },
    {
      key: "reopen",
      label: "ย้อนขั้นที่ปิดแล้วกลับ",
      desc: "ช่างกดปิดผิด — เปิดขั้นกลับมาทำต่อ",
      enabled: false,
      why: "ระบบยังไม่รองรับ — ขั้นที่ปิดแล้วแก้ย้อนหลังไม่ได้ (จดไว้ทำเพิ่ม)",
      run: () => undefined,
    },
  ];
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
