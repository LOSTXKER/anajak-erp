"use client";

/* ============================================================
   B+ · จอสถานีของหัวหน้า — ขัดหน้าตาแล้ว (รอบสอง)

   รอบแรก (2026-09-02) เบสตำหนิว่า "อะไรๆ ก็ทำเป็น text ธรรมดา ดูธรรมดาไป" → ฉันใส่กล่องสี
   4 ช่องคนละสีหมวด + วงกลมเลขคิวสีทึบ → เบสตีกลับ **"งานแบบชุ้ยมาก ธีมสีอะไรก็ไม่เข้ากับเว็บเลย"**
   สิ่งที่ผิด: เอาสีหมวด (น้ำเงิน/เขียว/เหลือง) มาเป็นพื้นกล่องในหน้าเดียวกันจนเป็นพรมสี ทั้งที่กติกา
   DESIGN.md บอกว่าสีหมวดเป็น cue บนไอคอนเท่านั้น สีสถานะใช้เฉพาะความหมายจริง และน้ำเงิน
   สงวนให้ primary/selected

   รอบนี้ยึดภาษาสีของเว็บจริง:
   · กล่องตัวเลข = พื้นจม `bg-surface-muted` ไอคอนสีหมวดผลิต ตัวเลขใหญ่สีเข้ม — แดงเฉพาะ
     "ปัญหาค้าง" ตอนมีเรื่องจริง (สีสถานะตามความหมาย)
   · วงกลมเลขคิว = แบบเดียวกับรายการขั้นของหน้าจริง (พื้นจม ตัวเลขเทา) สถานะบอกด้วยจุด
     `StatusLabel` ตัวจริง ไม่ระบายวงกลม
   · ขั้นที่เลือก = พื้นฟ้าอ่อน `INTERACTIVE_SELECTED` + ขีดน้ำเงินริมซ้าย (สูตรเดียวกับเมนูซ้าย)
   · โซนลงมือ = พื้นจม + เส้นขอบ ไม่มีสี
   โครงสามคอลัมน์และตำแหน่งของทุกชิ้นเท่า B — ต่างกันแค่ลำดับความสำคัญที่มองเห็นได้
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Factory,
  History,
  Lock,
  PackageCheck,
  Route,
  Truck,
  UserRound,
  Zap,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { StatusLabel } from "@/components/ui/status-label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FOCUS_BUTTON, INTERACTIVE_SELECTED, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { VISUAL_TONE_CLASSES } from "@/lib/visual-tone";
import { cn } from "@/lib/utils";

import {
  STATE_META,
  doneCount,
  linesOf,
  openExceptionCount,
  totalQuantity,
  type DensityOperation,
  type DensityWorkOrder,
} from "../work-order-density/_data";
import {
  BlockingBar,
  EventList,
  Freshness,
  LaneChips,
  ProblemCard,
  ProgressBar,
  QtyInputs,
  QtyTable,
  ReferenceRows,
  StationHint,
  StepButtons,
  firstActionable,
  stepEvents,
  stepProblems,
} from "./_shared";

const MARK = VISUAL_TONE_CLASSES.production.mark;

/* ───────────────────────────── วงกลมเลขคิว — สูตรเดียวกับรายการขั้นของหน้าจริง */

function QueueCircle({ step, size = "sm" }: { step: DensityOperation; size?: "sm" | "lg" }) {
  const done = step.state === "COMPLETED";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
        SUNK_PANEL,
        size === "lg" ? "h-10 w-10 text-sm text-strong" : "h-7 w-7 text-xs text-secondary",
        done && "text-green-700 dark:text-green-300",
      )}
    >
      {done ? <Check className={size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"} strokeWidth={2.5} /> : step.queue}
    </span>
  );
}

function GroupLabel({ icon: Icon, children }: { icon: typeof History; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
      <Icon className={cn("h-3.5 w-3.5", MARK)} aria-hidden="true" />
      {children}
    </p>
  );
}

/* ───────────────────────────── คอลัมน์ขวา: ตัวเลข 4 ช่องบนพื้นจม + ออเดอร์ */

function priorityBadge(label: string) {
  if (label === "ด่วนมาก") return <Badge variant="destructive" size="sm">{label}</Badge>;
  if (label === "สูง") return <Badge variant="warning" size="sm">{label}</Badge>;
  return <Badge size="sm">{label}</Badge>;
}

function FactCell({
  icon: Icon,
  label,
  value,
  unit,
  danger = false,
  children,
}: {
  icon: typeof History;
  label: string;
  value: string;
  unit?: string;
  /** สีสถานะตามความหมายจริงเท่านั้น — ใช้กับปัญหาค้างตอนมีเรื่อง */
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("px-3 py-3", RADIUS.inner, SUNK_PANEL)}>
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", danger ? "text-red-600 dark:text-red-400" : MARK)} aria-hidden="true" />
        {label}
      </dt>
      <dd className={cn("mt-1 text-lg font-semibold tabular-nums", danger ? "text-red-700 dark:text-red-300" : "text-strong")}>
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted">{unit}</span> : null}
      </dd>
      {children ? <dd className="mt-1.5">{children}</dd> : null}
    </div>
  );
}

function FactCells({ workOrder }: { workOrder: DensityWorkOrder }) {
  const open = openExceptionCount(workOrder);
  const done = doneCount(workOrder);
  const total = workOrder.operations.length;
  const firstStep = workOrder.operations[0];
  const variants = firstStep ? linesOf(workOrder, firstStep.id).length : 0;
  return (
    <dl className="grid grid-cols-2 gap-2">
      <FactCell icon={CalendarDays} label="กำหนดส่ง" value={workOrder.deadline}>
        {priorityBadge(workOrder.priorityLabel)}
      </FactCell>
      <FactCell icon={AlertTriangle} label="ปัญหาค้าง" value={open.toLocaleString("th-TH")} unit="รายการ" danger={open > 0}>
        <span className={cn("text-xs", open > 0 ? "text-red-700 dark:text-red-300" : "text-muted")}>
          {open > 0 ? "ยังไม่จบ ต้องจัดการ" : "ไม่มีเรื่องค้าง"}
        </span>
      </FactCell>
      <FactCell icon={Route} label="ผ่านแล้ว" value={`${done}/${total}`} unit="ขั้น">
        <ProgressBar done={done} total={total} />
      </FactCell>
      <FactCell icon={PackageCheck} label="จำนวนทั้งใบ" value={totalQuantity(workOrder).toLocaleString("th-TH")} unit="ตัว">
        <span className="text-xs text-muted">{variants > 0 ? `${variants} สี/ไซซ์` : "ไม่นับชิ้น"}</span>
      </FactCell>
    </dl>
  );
}

function OrderLine({ workOrder }: { workOrder: DensityWorkOrder }) {
  return (
    <Link
      href="/orders"
      className={cn("flex items-center justify-between gap-3 rounded-md py-1", FOCUS_BUTTON)}
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted">ออเดอร์</span>
        <span className="block truncate text-sm font-medium text-strong">
          {workOrder.orderNumber} · {workOrder.customerName}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    </Link>
  );
}

/* ───────────────────────────── คอลัมน์ซ้าย: บันไดขั้นงานบนราง */

function StepperList({
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
  const done = doneCount(workOrder);

  const lane = (title: string, steps: DensityOperation[], outsource: boolean) => {
    if (steps.length === 0) return null;
    return (
      <div className="py-2">
        <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-xs font-medium text-muted">
          {outsource ? (
            <Truck className={cn("h-3.5 w-3.5", MARK)} aria-hidden="true" />
          ) : (
            <Factory className={cn("h-3.5 w-3.5", MARK)} aria-hidden="true" />
          )}
          {title}
        </p>
        <ol className="relative">
          {/* รางเส้นตั้งร้อยวงกลมเลขคิว — บอกว่าเป็นลำดับ ไม่ใช่รายการลอย ๆ */}
          <span aria-hidden="true" className="absolute bottom-4 left-[1.875rem] top-4 w-px bg-divider" />
          {steps.map((step) => {
            const selected = selectedId === step.id;
            const meta = STATE_META[step.state];
            const lines = linesOf(workOrder, step.id);
            const planned = lines.reduce((sum, line) => sum + line.planned, 0);
            const good = lines.reduce((sum, line) => sum + line.good, 0);
            const percent = planned > 0 ? Math.round((good / planned) * 100) : 0;
            return (
              <li key={step.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-pressed={selected}
                  className={cn(
                    "relative flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                    FOCUS_BUTTON,
                    selected
                      ? cn(
                          INTERACTIVE_SELECTED,
                          "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-blue-600 before:content-[''] dark:before:bg-blue-400",
                        )
                      : "hover:bg-interactive-hover",
                  )}
                >
                  <QueueCircle step={step} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", selected ? "" : "text-strong")}>
                      {step.name}
                    </span>
                    <span className="mt-0.5 block">
                      <StatusLabel label={meta.label} tone={meta.tone} sub={step.assignee ?? undefined} />
                    </span>
                    {step.blockers.map((blocker) => (
                      <span key={blocker} className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {blocker}
                      </span>
                    ))}
                    {planned > 0 ? (
                      <span className="mt-1.5 block">
                        <span className="flex items-center justify-between text-xs tabular-nums text-muted">
                          <span>
                            {good}/{planned} ตัว
                          </span>
                          <span>{percent}%</span>
                        </span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-muted">
                          <span className="block h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${percent}%` }} />
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  return (
    <div className="divide-y divide-divider">
      {lane("สายเรา · ทำในโรงงาน", inHouse, false)}
      {lane("สายร้านนอก", outsourced, true)}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-xs text-muted">ผ่านแล้ว</span>
        <span className="text-sm font-semibold tabular-nums text-strong">
          {done}/{workOrder.operations.length} ขั้น
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────── คอลัมน์กลาง: หัวขั้น + โซนลงมือ + แท็บ */

function FocusHeader({ step }: { step: DensityOperation }) {
  const meta = STATE_META[step.state];
  return (
    <div className="flex items-start gap-3">
      <QueueCircle step={step} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-strong">{step.name}</h2>
          <StatusLabel label={meta.label} tone={meta.tone} emphasize />
          {step.outsourced ? (
            <Badge size="sm">
              <Truck className="h-3 w-3" aria-hidden="true" /> ร้านนอก
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
          <span className="inline-flex items-center gap-1">
            <Factory className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            {step.workCenter}
          </span>
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            {step.assignee ?? "ยังไม่มอบหมายคน"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            {step.timing}
          </span>
        </div>
        {step.waitsFor.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-secondary">
            <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            รับงานต่อจาก
            {step.waitsFor.map((name) => (
              <Badge key={name} size="sm">
                {name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionZone({ workOrder, step }: { workOrder: DensityWorkOrder; step: DensityOperation }) {
  const idle = step.commands.length === 0 && step.state !== "COMPLETED";
  return (
    <div className={cn("space-y-3 p-4 ring-1 ring-inset ring-border", RADIUS.inner, SUNK_PANEL)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Zap className={cn("h-3.5 w-3.5", MARK)} aria-hidden="true" />
        ลงมือกับขั้นนี้
      </p>
      {step.blockers.length > 0 ? (
        <Alert variant="error" title="มีปัญหาค้างอยู่">
          {step.blockers.join(" · ")}
        </Alert>
      ) : null}
      <StationHint step={step} />
      {idle ? (
        <p className="flex items-start gap-2 text-sm text-secondary">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>
            ยังทำอะไรกับขั้นนี้ไม่ได้ตอนนี้
            {step.waitsFor.length > 0 ? (
              <span className="text-muted"> — รอ {step.waitsFor.join(", ")} เสร็จก่อน</span>
            ) : null}
          </span>
        </p>
      ) : null}
      <QtyInputs workOrder={workOrder} step={step} columns={2} />
      <StepButtons workOrder={workOrder} step={step} size="lg" primary={!idle} />
    </div>
  );
}

function StepTabs({ workOrder, step }: { workOrder: DensityWorkOrder; step: DensityOperation }) {
  const lines = linesOf(workOrder, step.id);
  const problems = stepProblems(workOrder, step);
  const open = problems.filter((item) => item.status.tone !== "success").length;
  const events = stepEvents(workOrder, step);
  return (
    <Tabs defaultValue={open > 0 ? "problems" : "qty"}>
      <div className="border-b border-divider">
        <TabsList>
          <TabsTrigger value="qty">
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            จำนวน ({lines.length})
          </TabsTrigger>
          <TabsTrigger
            value="problems"
            hasPending={open > 0}
            aria-label={`ปัญหา ${problems.length} รายการ${open > 0 ? " · มีที่ยังไม่จบ" : ""}`}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ปัญหา ({problems.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4" aria-hidden="true" />
            ประวัติ ({events.length})
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="qty" className="pt-4">
        {lines.length === 0 ? (
          <p className="text-sm text-muted">ขั้นนี้ไม่นับชิ้น — กดปิดขั้นเมื่อทำเสร็จ</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-divider">
            <QtyTable lines={lines} />
          </div>
        )}
      </TabsContent>
      <TabsContent value="problems" className="pt-4">
        {problems.length === 0 ? (
          <p className="text-sm text-muted">ไม่มีปัญหาที่ขั้นนี้</p>
        ) : (
          <ul className="space-y-3">
            {problems.map((item) => (
              <ProblemCard key={item.id} item={item} compact />
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="history" className="pt-4">
        <EventList events={events} dense />
      </TabsContent>
    </Tabs>
  );
}

/* ───────────────────────────────────────────────────── ทั้งหน้า */

export function StationPolishedVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const [id, setId] = useState<string | null>(firstActionable(workOrder)?.id ?? null);
  const step = workOrder.operations.find((item) => item.id === id) ?? null;

  return (
    <div className="space-y-4">
      <BlockingBar workOrder={workOrder} />

      <div className="xl:hidden">
        <Section>
          <LaneChips workOrder={workOrder} selectedId={id} onSelect={setId} />
        </Section>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <Section title="ขั้นงาน" compact flush className="hidden xl:block" meta={`${workOrder.operations.length} ขั้น · กดเพื่อเปิดในแผงกลาง`}>
          <StepperList workOrder={workOrder} selectedId={id} onSelect={setId} />
        </Section>

        {step ? (
          <Section>
            <div className="space-y-5">
              <FocusHeader step={step} />
              <ActionZone workOrder={workOrder} step={step} />
              <StepTabs workOrder={workOrder} step={step} />
            </div>
          </Section>
        ) : (
          <Section title="ลงมือทำ" icon={Factory} tone="production">
            <p className="text-sm text-secondary">เลือกขั้นงานทางซ้ายเพื่อเปิดงานนั้นที่นี่</p>
          </Section>
        )}

        <Section title="ใบนี้" compact action={<Freshness />}>
          <FactCells workOrder={workOrder} />
          <div className="mt-3 border-t border-divider pt-3">
            <OrderLine workOrder={workOrder} />
          </div>
          <div className="mt-3 border-t border-divider pt-4">
            <GroupLabel icon={Lock}>ข้อมูลอ้างอิงที่ล็อกไว้</GroupLabel>
            <ReferenceRows workOrder={workOrder} dense />
          </div>
          <div className="mt-4 border-t border-divider pt-4">
            <GroupLabel icon={History}>ประวัติทั้งใบ</GroupLabel>
            <EventList events={workOrder.events} limit={5} dense />
          </div>
        </Section>
      </div>
    </div>
  );
}
