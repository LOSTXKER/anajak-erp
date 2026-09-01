"use client";

/* ============================================================
   ชิ้นส่วนที่สามทาง "รื้อใหม่" ใช้ร่วมกัน

   ของที่ไม่ได้กำลังเทียบ (ปุ่ม · ป้ายสถานะ · ตาราง · ช่องกรอก · กล่องเตือน)
   import ตัวจริงจาก src/components/ui ทั้งหมด — ที่เขียนเองในไฟล์นี้คือ "การจัดวาง"
   ซึ่งเป็นสิ่งที่กำลังเทียบ

   ปุ่มลงมือทุกปุ่มสร้างจากรายการคำสั่งที่ server อนุญาต (`commands`) แบบเดียวกับ
   ของจริง (production-v2-work-panel.tsx + production-v2-control-record.tsx):
   ไม่มีปุ่มที่ของจริงไม่มี และไม่ตัดปุ่มที่ของจริงมี — กติกา "เอาของมาให้ครบ"
   ============================================================ */

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Check,
  CirclePause,
  ExternalLink,
  RotateCcw,
  Truck,
  UserRoundCheck,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { StatusLabel } from "@/components/ui/status-label";
import { cn } from "@/lib/utils";

import {
  SPECIALIZED_HINT,
  STATE_META,
  doneCount,
  linesOf,
  openExceptionCount,
  totalQuantity,
  type DensityEvent,
  type DensityException,
  type DensityOperation,
  type DensityQuantityLine,
  type DensityState,
  type DensityWorkOrder,
} from "../work-order-density/_data";

/* ───────────────────────────────────────────── ตัวช่วยอ่านข้อมูล */

/** จุดสีบอกสถานะ — ชุดเดียวกับผังในใบงานจริงและแถบ "เส้นทางงาน" ในหน้ารวม */
export function stateDotClass(state: DensityState) {
  switch (state) {
    case "COMPLETED":
      return "bg-green-600 dark:bg-green-400";
    case "RUNNING":
      return "bg-amber-500 ring-4 ring-amber-500/20";
    case "BLOCKED":
      return "bg-red-600 dark:bg-red-400";
    case "READY":
      return "bg-blue-600 dark:bg-blue-400";
    default:
      return "bg-border";
  }
}

/** ระดับของขั้น = ยาวสุดจากจุดเริ่ม — ขั้นระดับเดียวกันคือขั้นที่เดินขนานกันได้ */
export function levelsOf(workOrder: DensityWorkOrder): DensityOperation[][] {
  const byName = new Map(workOrder.operations.map((step) => [step.name, step]));
  const level = new Map<string, number>();
  const resolve = (step: DensityOperation, trail: Set<string>): number => {
    const cached = level.get(step.id);
    if (cached !== undefined) return cached;
    if (trail.has(step.id)) return 0;
    trail.add(step.id);
    const parents = step.waitsFor
      .map((name) => byName.get(name))
      .filter((item): item is DensityOperation => Boolean(item));
    const value =
      parents.length === 0 ? 0 : Math.max(...parents.map((p) => resolve(p, trail))) + 1;
    level.set(step.id, value);
    return value;
  };
  for (const step of workOrder.operations) resolve(step, new Set());
  const groups: DensityOperation[][] = [];
  for (const step of workOrder.operations) {
    const index = level.get(step.id) ?? 0;
    groups[index] = [...(groups[index] ?? []), step];
  }
  return groups.filter(Boolean);
}

export function stepProblems(workOrder: DensityWorkOrder, step: DensityOperation) {
  return workOrder.exceptions.filter((item) => item.stepName === step.name);
}

export function stepEvents(workOrder: DensityWorkOrder, step: DensityOperation) {
  return workOrder.events.filter((event) => event.stepName === step.name);
}

/** เหตุการณ์ของ "ทั้งใบ" ที่ไม่ผูกกับขั้นไหน (ปล่อยผลิต ฯลฯ) */
export function orderEvents(workOrder: DensityWorkOrder) {
  return workOrder.events.filter((event) => event.stepName === null);
}

/** ปัญหาที่ยังบล็อกงานอยู่ — ของพวกนี้ต้องเห็นก่อนอย่างอื่นทุกแบบ */
export function blockingProblems(workOrder: DensityWorkOrder) {
  return workOrder.exceptions.filter((item) => item.status.tone === "danger");
}

export function reportableLines(workOrder: DensityWorkOrder, step: DensityOperation) {
  return linesOf(workOrder, step.id).filter((line) => line.planned > line.good);
}

export function firstActionable(workOrder: DensityWorkOrder) {
  return (
    workOrder.operations.find((step) => step.commands.length > 0) ??
    workOrder.operations[0] ??
    null
  );
}

/** ปุ่มหลักของขั้นนี้ — ลำดับเดียวกับแผงลงมือของจริง */
export function primaryOf(workOrder: DensityWorkOrder, step: DensityOperation) {
  const specialized = Object.keys(SPECIALIZED_HINT).find(
    (key) => key !== "manageOutsource" && step.commands.includes(key),
  );
  if (step.commands.includes("startOperation")) return { kind: "button" as const, label: "เริ่มงาน" };
  if (step.commands.includes("reportOutput") && reportableLines(workOrder, step).length > 0)
    return { kind: "button" as const, label: "บันทึกผลงาน" };
  if (step.commands.includes("completeOperation")) return { kind: "button" as const, label: "ปิดขั้นนี้" };
  if (specialized) return { kind: "station" as const, label: "ทำที่จอสถานี" };
  if (step.commands.includes("manageOutsource")) return { kind: "outsource" as const, label: "เปิดใบงานร้านนอก" };
  return null;
}

/* ─────────────────────────────────────────────── ชิ้นเล็กที่ใช้ทั่วไป */

export function StateDot({ state, className }: { state: DensityState; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", stateDotClass(state), className)}
    />
  );
}

export function Freshness({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted", className)}>อัปเดตล่าสุด 12 วินาทีที่แล้ว</p>;
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      role="progressbar"
      aria-label="ความคืบหน้าใบสั่งผลิต"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
    >
      <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** แถบแดงบนสุด — ปัญหาที่บล็อกงานต้องเห็นก่อนทุกอย่าง (ทุกแบบมีเหมือนกัน) */
export function BlockingBar({ workOrder }: { workOrder: DensityWorkOrder }) {
  const blocking = blockingProblems(workOrder);
  if (blocking.length === 0) return null;
  return (
    <div className="space-y-2">
      {blocking.map((item) => (
        <Alert key={item.id} variant="error" title={item.title}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {item.description} · ค้างที่ขั้น{" "}
              <span className="font-medium">{item.stepName}</span> ตั้งแต่ {item.createdAt}
            </span>
            <Button variant="outline" size="sm">
              <CheckCircle2 /> จัดการปัญหา
            </Button>
          </span>
        </Alert>
      ))}
    </div>
  );
}

/* ───────────────────────────────── ข้อเท็จจริงของใบ (แทนการ์ด 5 ช่องเดิม) */

export function OrderFacts({
  workOrder,
  layout = "inline",
}: {
  workOrder: DensityWorkOrder;
  /** inline = บรรทัดเดียวใต้หัว · stack = คอลัมน์ข้าง */
  layout?: "inline" | "stack";
}) {
  const open = openExceptionCount(workOrder);
  const done = doneCount(workOrder);
  const total = workOrder.operations.length;
  const qty = totalQuantity(workOrder).toLocaleString("th-TH");

  if (layout === "stack") {
    return (
      <dl className="space-y-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">ออเดอร์</dt>
          <dd className="text-right">
            <span className="inline-flex items-center gap-1 font-medium text-strong">
              {workOrder.orderNumber} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="block text-xs text-secondary">{workOrder.customerName}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">กำหนดส่ง</dt>
          <dd className="font-medium text-strong">{workOrder.deadline}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">ความสำคัญ</dt>
          <dd className="text-secondary">{workOrder.priorityLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">จำนวนทั้งใบ</dt>
          <dd className="tabular-nums text-secondary">{qty} ตัว</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">ปัญหาที่ยังไม่จบ</dt>
          <dd className={cn("tabular-nums", open > 0 ? "font-semibold text-red-700 dark:text-red-300" : "text-secondary")}>
            {open.toLocaleString("th-TH")} รายการ
          </dd>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">ความคืบหน้า</dt>
            <dd className="tabular-nums text-secondary">
              {done}/{total} ขั้น
            </dd>
          </div>
          <div className="mt-1.5">
            <ProgressBar done={done} total={total} />
          </div>
        </div>
      </dl>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
      <span className="text-secondary">
        กำหนดส่ง <span className="font-medium text-strong">{workOrder.deadline}</span>
      </span>
      <span className="text-secondary">ความสำคัญ {workOrder.priorityLabel}</span>
      <span className="tabular-nums text-secondary">{qty} ตัว</span>
      <span className={cn("tabular-nums", open > 0 ? "font-medium text-red-700 dark:text-red-300" : "text-secondary")}>
        ปัญหาค้าง {open.toLocaleString("th-TH")}
      </span>
      <span className="inline-flex min-w-40 items-center gap-2 text-secondary">
        <span className="shrink-0 tabular-nums">
          ผ่านแล้ว {done}/{total} ขั้น
        </span>
        <span className="min-w-0 flex-1">
          <ProgressBar done={done} total={total} />
        </span>
      </span>
    </div>
  );
}

/* ─────────────────────── รางย่อสองสาย — R3 ที่เบสเคาะ ย่อเหลือหนึ่งบรรทัด */

export function LaneChips({
  workOrder,
  selectedId,
  onSelect,
}: {
  workOrder: DensityWorkOrder;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const inHouse = workOrder.operations.filter((step) => !step.outsourced);
  const outsourced = workOrder.operations.filter((step) => step.outsourced);

  const lane = (title: string, steps: DensityOperation[], outsource: boolean) => {
    if (steps.length === 0) return null;
    return (
      <div className="flex min-w-max items-center gap-1.5">
        <span
          className={cn(
            "mr-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium",
            outsource ? "text-secondary" : "text-module-production-text",
          )}
        >
          {outsource ? <Truck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {title}
        </span>
        {steps.map((step, index) => (
          <span key={step.id} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-0.5 w-3 shrink-0 rounded-full",
                  steps[index - 1]!.state === "COMPLETED" ? "bg-green-600/50 dark:bg-green-400/40" : "bg-divider",
                )}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-pressed={selectedId === step.id}
              title={`${step.name} · ${STATE_META[step.state].label}`}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                selectedId === step.id
                  ? "border-blue-600 bg-interactive-selected text-interactive-selected-text dark:border-blue-400"
                  : "border-border bg-surface text-secondary hover:bg-interactive-hover hover:text-strong",
                step.blockers.length > 0 && selectedId !== step.id && "border-red-500/50",
              )}
            >
              <StateDot state={step.state} className="h-2 w-2" />
              <span className="max-w-36 truncate">{step.name}</span>
            </button>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max items-center gap-4">
        {lane("สายเรา", inHouse, false)}
        {outsourced.length > 0 ? (
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-divider" />
        ) : null}
        {lane("สายร้านนอก", outsourced, true)}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── ปุ่มลงมือของขั้น (จาก commands) */

export function StationHint({ step }: { step: DensityOperation }) {
  const specialized = Object.keys(SPECIALIZED_HINT).find((key) => step.commands.includes(key));
  if (!specialized) return null;
  const outsource = specialized === "manageOutsource";
  return (
    <Alert variant="info" title={outsource ? "ขั้นนี้ทำผ่านใบงานร้านนอก" : "ขั้นนี้ทำที่จอสถานี"}>
      <span className="flex flex-wrap items-center gap-2">
        {SPECIALIZED_HINT[specialized]}
        {!outsource ? (
          <Link
            href="/factory/station"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
          >
            เปิดจอสถานี
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </span>
    </Alert>
  );
}

export function QtyInputs({
  workOrder,
  step,
  columns = 1,
}: {
  workOrder: DensityWorkOrder;
  step: DensityOperation;
  columns?: 1 | 2;
}) {
  if (!step.commands.includes("reportOutput")) return null;
  const lines = reportableLines(workOrder, step);
  if (lines.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-secondary">
        บันทึกจำนวนที่ทำได้ <span className="text-muted">(แยกตามสี/ไซซ์ ตามที่ระบบบังคับ)</span>
      </p>
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {lines.map((line) => (
          <div key={line.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="min-w-0 flex-1 text-sm text-strong">
              {line.color} · {line.size}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {line.good}/{line.planned}
            </span>
            <Input
              className="w-20 shrink-0 text-right tabular-nums"
              inputMode="numeric"
              placeholder={String(line.planned - line.good)}
              aria-label={`จำนวนที่ทำได้ ${line.color} ไซซ์ ${line.size}`}
              readOnly
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ปุ่มของขั้นหนึ่ง — สร้างจาก `commands` เท่านั้น
 *  หลัก   = เริ่มงาน / บันทึกผลงาน / ปิดขั้นนี้ (ตามลำดับเดียวกับแผงลงมือจริง)
 *           หรือ "ทำที่จอสถานี" สำหรับขั้นที่ต้องมีหลักฐาน (ไม่ทำปุ่มปลอม)
 *  รอง    = พักงาน · มอบหมาย · จัดคิว · แจ้งปัญหา · เปิดใบงานร้านนอก
 *           (มอบหมาย/จัดคิว ขึ้นทุกขั้นที่ยังไม่เสร็จ — กติกา server สำหรับหัวหน้า)
 *
 *  ขนาด lg = ปุ่มหลักอยู่แถวของตัวเอง (ไม่งั้นบนจอ 375 ปุ่มหลักที่ยืดเต็มแถวถูกปุ่มรอง
 *  เบียดจนตัวหนังสือถูกตัด — เจอตอนเปิดดูเอง 2026-09-02) · ขนาด sm = แถวเดียวห่อบรรทัด
 */
export function StepButtons({
  workOrder,
  step,
  size = "sm",
  primary = true,
  secondary = true,
  className,
}: {
  workOrder: DensityWorkOrder;
  step: DensityOperation;
  size?: "sm" | "lg";
  /** false = ไม่วาดปุ่มหลัก (ใช้ในส่วนที่กางออกมา เพราะปุ่มหลักอยู่ที่แถวแล้ว) */
  primary?: boolean;
  /** false = เฉพาะปุ่มหลัก (ใช้ในแถวตารางที่แคบ) */
  secondary?: boolean;
  className?: string;
}) {
  const main = primaryOf(workOrder, step);
  const done = step.state === "COMPLETED";
  const big = size === "lg";

  if (done) {
    return primary ? <span className={cn("text-xs text-muted", className)}>ขั้นนี้ปิดแล้ว</span> : null;
  }

  const nothingYet = primary && !main && step.commands.length === 0;
  const outsourceAsPrimary = primary && main?.kind === "outsource";
  const outsourceAsSecondary = secondary && step.outsourced && main?.kind !== "outsource";

  const mainNodes = primary ? (
    <>
      {main?.kind === "button" ? (
        <Button size={big ? "lg" : "sm"} className={cn(big && "min-h-14 flex-1 text-base")}>
          {main.label}
        </Button>
      ) : null}
      {main?.kind === "station" ? (
        <Button
          asChild
          variant={big ? "default" : "outline"}
          size={big ? "lg" : "sm"}
          className={cn(big && "min-h-14 flex-1 text-base")}
        >
          <Link href="/factory/station">
            {main.label} <ExternalLink />
          </Link>
        </Button>
      ) : null}
      {outsourceAsPrimary ? (
        <Button variant={big ? "default" : "outline"} size={big ? "lg" : "sm"} className={cn(big && "min-h-14 flex-1 text-base")}>
          <Truck /> เปิดใบงานร้านนอก
        </Button>
      ) : null}
      {nothingYet ? (
        <span className={cn("text-secondary", big ? "text-sm" : "text-xs")}>
          {big ? "ยังทำอะไรกับขั้นนี้ไม่ได้ตอนนี้ — รอขั้นก่อนหน้า หรือยังไม่ได้ปล่อยงาน" : "รอขั้นก่อนหน้า"}
        </span>
      ) : null}
    </>
  ) : null;

  const pauseNode = step.commands.includes("pauseOperation") ? (
    <Button variant="outline" size={big ? "default" : "sm"} className={cn(big && "shrink-0")}>
      <CirclePause /> พักงาน
    </Button>
  ) : null;

  const secondaryNodes = secondary ? (
    <>
      {outsourceAsSecondary ? (
        <Button variant="outline" size="sm">
          <Truck /> เปิดใบงานร้านนอก
        </Button>
      ) : null}
      <Button variant="outline" size="sm">
        <UserRoundCheck /> มอบหมาย
      </Button>
      <Button variant="outline" size="sm">
        <CalendarClock /> จัดคิว
      </Button>
      {step.commands.includes("raiseException") ? (
        <Button variant="outline" size="sm">
          <AlertTriangle /> แจ้งปัญหา
        </Button>
      ) : null}
    </>
  ) : null;

  if (big) {
    return (
      <div className={cn("space-y-3", className)}>
        {primary && (main || nothingYet || pauseNode) ? (
          <div className="flex items-center gap-2">
            {mainNodes}
            {secondary ? pauseNode : null}
          </div>
        ) : null}
        {secondary ? <div className="flex flex-wrap items-center gap-2">{secondaryNodes}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {mainNodes}
      {secondary ? pauseNode : null}
      {secondaryNodes}
    </div>
  );
}

/* ───────────────────────────────────────────────── จำนวน (ตาราง 7 คอลัมน์) */

export function QtyTable({ lines }: { lines: readonly DensityQuantityLine[] }) {
  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.Th>รายการ</DataTable.Th>
          <DataTable.Th>สี / ไซซ์</DataTable.Th>
          <DataTable.Th>ตำแหน่งพิมพ์</DataTable.Th>
          <DataTable.Th align="right">เป้าหมาย</DataTable.Th>
          <DataTable.Th align="right">ดี</DataTable.Th>
          <DataTable.Th align="right">เสีย</DataTable.Th>
          <DataTable.Th align="right">ส่งแก้</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {lines.map((line) => (
          <DataTable.Row key={line.id}>
            <DataTable.Td>
              <p className="font-medium text-strong">{line.description}</p>
            </DataTable.Td>
            <DataTable.Td>
              {line.color} / {line.size}
            </DataTable.Td>
            <DataTable.Td>{line.printPosition}</DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums">
              {line.planned.toLocaleString("th-TH")}
            </DataTable.Td>
            <DataTable.Td align="right" className="font-semibold tabular-nums text-green-700 dark:text-green-300">
              {line.good.toLocaleString("th-TH")}
            </DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums text-red-700 dark:text-red-300">
              {line.scrap.toLocaleString("th-TH")}
            </DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums text-amber-700 dark:text-amber-300">
              {line.rework.toLocaleString("th-TH")}
            </DataTable.Td>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

/** จำนวนแบบย่อ — บรรทัดละสี/ไซซ์ (ใช้ในโหนดของราง) */
export function QtyMini({ lines }: { lines: readonly DensityQuantityLine[] }) {
  if (lines.length === 0) return <p className="text-xs text-muted">ขั้นนี้ไม่นับชิ้น</p>;
  return (
    <ul className="divide-y divide-divider">
      {lines.map((line) => (
        <li key={line.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="text-secondary">
            {line.color} / {line.size}
            <span className="ml-2 text-xs text-muted">{line.printPosition}</span>
          </span>
          <span className="shrink-0 tabular-nums text-strong">
            <span className="text-green-700 dark:text-green-300">{line.good}</span>
            <span className="text-muted"> / {line.planned}</span>
            {line.scrap > 0 ? (
              <span className="ml-2 text-xs text-red-700 dark:text-red-300">เสีย {line.scrap}</span>
            ) : null}
            {line.rework > 0 ? (
              <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">ส่งแก้ {line.rework}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────────────────────────────────────── ปัญหา */

export function ProblemCard({ item, compact = false }: { item: DensityException; compact?: boolean }) {
  const open = item.status.tone !== "success";
  return (
    <li className={cn("rounded-lg bg-surface-muted", compact ? "p-3" : "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel label={item.severity.label} tone={item.severity.tone} />
            <StatusLabel label={item.status.label} tone={item.status.tone} />
          </div>
          <p className={cn("mt-1.5 font-semibold text-strong", compact ? "text-sm" : "")}>{item.title}</p>
          <p className="mt-0.5 text-sm text-secondary">{item.description}</p>
        </div>
        <p className="text-xs text-muted">{item.createdAt}</p>
      </div>
      <dl className={cn("mt-2 grid gap-x-4 gap-y-1 text-xs", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
        {!compact ? (
          <div>
            <dt className="text-muted">ขั้นงาน</dt>
            <dd className="text-secondary">{item.stepName}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted">ผู้รับผิดชอบ</dt>
          <dd className="text-secondary">{item.owner}</dd>
        </div>
        {item.disposition ? (
          <div>
            <dt className="text-muted">แนวทาง</dt>
            <dd className="text-secondary">{item.disposition}</dd>
          </div>
        ) : null}
        {item.resolution ? (
          <div>
            <dt className="text-muted">ผลการแก้ไข</dt>
            <dd className="text-secondary">{item.resolution}</dd>
          </div>
        ) : null}
      </dl>
      {open ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-divider pt-3">
          {item.disposition ? (
            <Button variant="outline" size="sm">
              <CheckCircle2 /> ตัดสินของที่พักไว้
            </Button>
          ) : null}
          <Button variant="outline" size="sm">
            <RotateCcw /> วางแผนงานแก้
          </Button>
          <Button variant="outline" size="sm">
            <CheckCircle2 /> จัดการปัญหา
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/* ───────────────────────────────────────────────────────── ประวัติ */

export function EventList({
  events,
  limit,
  total,
  dense = false,
}: {
  events: readonly DensityEvent[];
  limit?: number;
  /** จำนวนทั้งหมด (ใช้เขียน "แสดง n จาก m") */
  total?: number;
  dense?: boolean;
}) {
  const shown = limit ? events.slice(0, limit) : events;
  if (events.length === 0) return <p className="text-xs text-muted">ยังไม่มีประวัติ</p>;
  return (
    <>
      <ol className={cn(dense ? "space-y-2" : "space-y-3")}>
        {shown.map((event) => {
          const hasQty = event.good || event.scrap || event.rework;
          return (
            <li key={event.id} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="text-sm font-medium text-strong">{event.label}</p>
                  <span className="text-xs text-muted">{event.at}</span>
                </div>
                {event.stepName && !dense ? (
                  <p className="text-xs text-muted">{event.stepName}</p>
                ) : null}
                {hasQty ? (
                  <p className="text-xs text-secondary">
                    งานดี +{event.good} · เสีย +{event.scrap} · ส่งแก้ +{event.rework}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {limit && (total ?? events.length) > limit ? (
        <p className="mt-3 text-xs text-muted">
          แสดง {limit} รายการล่าสุด จากทั้งหมด {total ?? events.length} ·{" "}
          <button type="button" className="text-blue-600 hover:underline dark:text-blue-400">
            ดูทั้งหมด
          </button>
        </p>
      ) : null}
    </>
  );
}

/* ─────────────────────────────────────────── ข้อมูลอ้างอิงที่ล็อกไว้ */

export function ReferenceRows({ workOrder, dense = false }: { workOrder: DensityWorkOrder; dense?: boolean }) {
  return (
    <div>
      <ul className={cn(dense ? "space-y-1.5" : "space-y-2.5")}>
        {workOrder.reference.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary">{row.label}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                row.present ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300",
              )}
            >
              {row.present ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {row.present ? "เก็บสำเนาแล้ว" : "ยังไม่มีสำเนา"}
            </span>
          </li>
        ))}
      </ul>
      <dl className={cn("grid grid-cols-2 gap-3 border-t border-divider text-xs", dense ? "mt-3 pt-3" : "mt-4 pt-4")}>
        <div>
          <dt className="text-muted">ปล่อยผลิตเมื่อ</dt>
          <dd className="mt-0.5 font-medium text-secondary">{workOrder.releasedAt}</dd>
        </div>
        <div>
          <dt className="text-muted">ฉบับข้อมูล</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-secondary">
            {workOrder.revision.toLocaleString("th-TH")}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ─────────────────────────────────── บรรทัดสรุปของขั้น (ใช้ซ้ำหลายแบบ) */

export function StepMeta({ step }: { step: DensityOperation }) {
  return (
    <span className="text-xs text-muted">
      {step.workCenter}
      {step.outsourced ? " · ส่งร้านนอก" : ""}
      {step.assignee ? ` · ${step.assignee}` : " · ยังไม่มอบหมายคน"}
    </span>
  );
}

export function StepStatus({ step }: { step: DensityOperation }) {
  const meta = STATE_META[step.state];
  const waiting =
    step.state === "PLANNED" && step.waitsFor.length > 0 ? `รอ ${step.waitsFor.join(", ")}` : undefined;
  return <StatusLabel label={meta.label} tone={meta.tone} sub={step.blockers[0] ?? waiting} />;
}
