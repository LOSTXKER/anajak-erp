import type { ReactNode } from "react";
import { Store, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { Section } from "@/components/ui/section";
import type { ProductionStep } from "./types";
import { missingStandards, workOrderStandards } from "@/lib/work-order-standards";
import { cn, formatDate } from "@/lib/utils";
import type { WorkOrderController } from "./work-order-controller";
import { activeOutsource, daysFromNow, stepLabel } from "./work-order-pieces";

export const checklistAnchor = (stepId: string) => `work-order-checklist-${stepId}`;

export function ticksMissing(step: ProductionStep): number {
  return missingStandards(step.stepType, step.checks.map((t) => t.itemKey)).length;
}

/* ───────────────────────── ขวา: เช็คลิสต์ของขั้นที่ยืนอยู่ ───────────────────────── */

/** เช็คลิสต์ของขั้น — ชื่อการ์ด "เช็คลิสต์" (ชื่อขั้นอยู่ที่ตารางซ้ายแล้ว) · ขั้นคู่ค่อยใส่ชื่อขั้นให้แยกกันออก */
export function ChecklistCard({ step, c, nowMs, showStepName = false, assignAction }: { step: ProductionStep; c: WorkOrderController; nowMs: number; showStepName?: boolean; assignAction?: ReactNode }) {
  const standards = workOrderStandards(step.stepType);
  const done = step.status === "COMPLETED";
  const halted = step.status === "FAILED" || step.status === "ON_HOLD";
  const outsource = activeOutsource(step);
  const ticked = new Map(step.checks.map((t) => [t.itemKey, t.checkedBy.name]));
  const checkedCount = standards.filter((label) => ticked.has(label)).length;
  const missing = done || halted ? 0 : ticksMissing(step);
  const canTick = c.canUpdateStep && c.canOwnOrSupervise(step) && !done && !halted;
  return (
    <Section title={showStepName ? stepLabel(step) : "เช็คลิสต์"} action={missing > 0 ? <InfoChip size="sm" tone="warning">ติ๊กอีก {missing} ข้อ</InfoChip> : undefined}>
      <div className="space-y-4">
        {/* ใครทำขั้นนี้ + ปุ่มเปลี่ยนคนทำ อยู่บรรทัดเดียวกัน (เบสสั่ง 2026-09-10) — เดิมปุ่มมอบหมาย
            ซ่อนอยู่ในเมนู ⋯ บนหัวใบ ทั้งที่ข้อมูล "ผู้ทำ" อยู่ตรงนี้ */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FactList columns={1} className="min-w-0 flex-1">
            <Fact size="sm" icon={UserRound} label="ผู้ทำ" value={step.assignedTo?.name ?? "ยังไม่มีคนรับ"} tone={step.assignedTo ? "default" : "muted"} />
          </FactList>
          {assignAction}
        </div>
        {outsource ? (
          <FactList columns={1} className="border-t border-divider pt-4">
            <Fact icon={Store} label="ร้านนอก" value={outsource.vendor.name} />
            <Fact size="sm" label="งานที่ส่ง" value={outsource.description || stepLabel(step)} sub={`${outsource.quantity.toLocaleString("th-TH")} ตัว`} />
            <Fact size="sm" label="วันที่ส่ง" value={outsource.sentAt ? formatDate(outsource.sentAt) : "ยังไม่บันทึกวันส่ง"} tone={outsource.sentAt ? "default" : "muted"} />
            <Fact
              size="sm"
              label="นัดรับกลับ"
              value={<DueTag dueInDays={daysFromNow(outsource.expectedBackAt, nowMs)} dateLabel={outsource.expectedBackAt ? formatDate(outsource.expectedBackAt) : "ยังไม่นัด"} size="sm" />}
            />
            {outsource.notes ? <Fact size="sm" label="หมายเหตุร้านนอก" value={<span className="[overflow-wrap:anywhere]">{outsource.notes}</span>} /> : null}
          </FactList>
        ) : null}
        {standards.length > 0 ? (
          <ul className="divide-y divide-divider border-t border-divider">
            {standards.map((label) => {
              const on = ticked.has(label);
              const who = ticked.get(label);
              return (
                <li key={label}>
                  <label className={cn("flex min-h-11 items-start gap-3 py-3 text-sm", canTick ? "cursor-pointer" : "cursor-default")}>
                    <Checkbox
                      checked={on}
                      disabled={!canTick || c.tickPending}
                      onChange={(e) => c.tickStandard(step.id, label, e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0"
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className={cn("block leading-relaxed", on ? "text-secondary" : "font-medium text-strong")}>{label}</span>
                      {who ? <span className="block text-xs text-muted">ติ๊กโดย {who}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
        {done && checkedCount < standards.length ? (
          <p className="text-sm text-secondary">ขั้นนี้ปิดแล้ว มีผลตรวจบันทึกไว้ {checkedCount}/{standards.length} ข้อ</p>
        ) : null}
      </div>
    </Section>
  );
}
