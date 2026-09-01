"use client";

/* ============================================================
   สามทาง "รื้อใหม่จากศูนย์" ของหน้าใบสั่งผลิต — คนละวิธีคิด ไม่ใช่คนละการจัดวาง

   A · ตารางเดียว        — ใบสั่งผลิตคือตารางของขั้น หนึ่งขั้น = หนึ่งแถว กดแถวกางของของขั้นนั้น
   B · จอสถานีของหัวหน้า — เลือกซ้าย ทำงานกลาง ข้อมูลใบอยู่ขวา จบในจอเดียว
   C · รางเดียว          — อ่านจากบนลงล่างเป็นเรื่องเล่า ของทุกชิ้นเกาะอยู่กับขั้นของมัน ไม่มีกองแยก

   "ของจริงตอนนี้" ยืมจากหน้าลองรอบก่อน (work-order-density) เพื่อให้เทียบกับของเดิมได้
   ทุกแบบมีของครบเท่าของจริง — ที่ย้ายไปอยู่ไหนเขียนไว้ในหน้าเทียบ (page.tsx → WHERE_THINGS_GO)
   ============================================================ */

import { Fragment, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Factory,
  History,
  Lock,
  PackageCheck,
  Route,
  Truck,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FOCUS_BUTTON, INTERACTIVE_SELECTED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import {
  STATE_META,
  doneCount,
  linesOf,
  quantitySummary,
  type DensityOperation,
  type DensityWorkOrder,
} from "../work-order-density/_data";
import { CurrentVariant } from "../work-order-density/_variants";
import {
  BlockingBar,
  EventList,
  Freshness,
  LaneChips,
  OrderFacts,
  ProblemCard,
  QtyInputs,
  QtyMini,
  QtyTable,
  ReferenceRows,
  StateDot,
  StationHint,
  StepButtons,
  StepMeta,
  StepStatus,
  firstActionable,
  levelsOf,
  orderEvents,
  stepEvents,
  stepProblems,
} from "./_shared";

const ACTIVE_STATES = new Set(["READY", "RUNNING", "BLOCKED"]);

function GroupLabel({ icon: Icon, children }: { icon: typeof History; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════ A · ตารางเดียว — หนึ่งขั้น = หนึ่งแถว */

/** ของของขั้นที่กางออกมาใต้แถว — จำนวน · ปุ่มรอง · ปัญหา · ประวัติ ของขั้นนั้นเท่านั้น */
function StepDrawer({ workOrder, step }: { workOrder: DensityWorkOrder; step: DensityOperation }) {
  const lines = linesOf(workOrder, step.id);
  const problems = stepProblems(workOrder, step);
  const events = stepEvents(workOrder, step);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
      <div className="space-y-4">
        <StationHint step={step} />
        <QtyInputs workOrder={workOrder} step={step} columns={2} />
        <StepButtons workOrder={workOrder} step={step} primary={false} />
        <div>
          <GroupLabel icon={ClipboardCheck}>จำนวนของขั้นนี้</GroupLabel>
          {lines.length === 0 ? (
            <p className="text-xs text-muted">ขั้นนี้ไม่นับชิ้น — กดปิดขั้นเมื่อทำเสร็จ</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-divider bg-surface">
              <QtyTable lines={lines} />
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <GroupLabel icon={AlertTriangle}>ปัญหาของขั้นนี้</GroupLabel>
          {problems.length === 0 ? (
            <p className="text-xs text-muted">ไม่มีปัญหาที่ขั้นนี้</p>
          ) : (
            <ul className="space-y-2">
              {problems.map((item) => (
                <ProblemCard key={item.id} item={item} compact />
              ))}
            </ul>
          )}
        </div>
        <div>
          <GroupLabel icon={History}>ประวัติของขั้นนี้</GroupLabel>
          <EventList events={events} limit={4} dense />
        </div>
      </div>
    </div>
  );
}

export function TableVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const [openId, setOpenId] = useState<string | null>(firstActionable(workOrder)?.id ?? null);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  return (
    <div className="space-y-4">
      <BlockingBar workOrder={workOrder} />

      {/* หัวใบ = บรรทัดข้อเท็จจริง + รางย่อสองสาย (R3 ที่เบสเคาะ ย่อเหลือหนึ่งบรรทัด) */}
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <OrderFacts workOrder={workOrder} />
          <Freshness />
        </div>
        <div className="mt-3 border-t border-divider pt-3">
          <LaneChips workOrder={workOrder} selectedId={openId} onSelect={setOpenId} />
        </div>
      </Section>

      <Section
        title="ขั้นงาน"
        icon={Route}
        tone="production"
        meta="หนึ่งขั้น = หนึ่งแถว · กดแถวเพื่อกางจำนวน ปัญหา ประวัติ และปุ่มของขั้นนั้น"
        flush
      >
        {/* จอกว้าง — ตาราง */}
        <div className="hidden lg:block">
          <DataTable.Root bordered={false}>
            <DataTable.Head>
              <tr>
                <DataTable.Th className="w-14">คิว</DataTable.Th>
                <DataTable.Th>ขั้นงาน</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th align="right">จำนวน</DataTable.Th>
                <DataTable.Th>เวลา</DataTable.Th>
                <DataTable.Th>ลงมือ</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {workOrder.operations.map((step) => {
                const open = openId === step.id;
                const lines = linesOf(workOrder, step.id);
                return (
                  <Fragment key={step.id}>
                    <DataTable.Row
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("a,button,input")) return;
                        toggle(step.id);
                      }}
                      className={cn("cursor-pointer", open && "bg-interactive-pressed")}
                    >
                      <DataTable.Td>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold tabular-nums text-secondary">
                          {step.queue}
                        </span>
                      </DataTable.Td>
                      <DataTable.Td className="min-w-56">
                        <button
                          type="button"
                          onClick={() => toggle(step.id)}
                          aria-expanded={open}
                          className={cn("flex items-start gap-2 rounded-md text-left", FOCUS_BUTTON)}
                        >
                          <StateDot state={step.state} className="mt-1.5" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-medium text-strong">
                              {step.name}
                              {step.outsourced ? (
                                <Truck className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                              ) : null}
                              <ChevronDown
                                className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")}
                                aria-hidden="true"
                              />
                            </span>
                            <StepMeta step={step} />
                          </span>
                        </button>
                        {step.waitsFor.length > 0 ? (
                          <p className="mt-1 inline-flex flex-wrap items-center gap-1 pl-4.5 text-xs text-secondary">
                            <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                            รับงานต่อจาก: {step.waitsFor.join(", ")}
                          </p>
                        ) : null}
                        {step.blockers.map((blocker) => (
                          <p
                            key={blocker}
                            className="mt-1 inline-flex items-center gap-1.5 pl-4.5 text-xs font-medium text-red-700 dark:text-red-300"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {blocker}
                          </p>
                        ))}
                      </DataTable.Td>
                      <DataTable.Td className="min-w-32">
                        <StepStatus step={step} />
                      </DataTable.Td>
                      <DataTable.Td align="right" className="whitespace-nowrap tabular-nums">
                        <span className="font-medium text-strong">{quantitySummary(lines)}</span>
                        {lines.length > 0 ? (
                          <span className="block text-xs text-muted">{lines.length} สี/ไซซ์</span>
                        ) : null}
                      </DataTable.Td>
                      <DataTable.Td className="whitespace-nowrap text-xs text-muted">{step.timing}</DataTable.Td>
                      <DataTable.Td className="min-w-40">
                        <StepButtons workOrder={workOrder} step={step} secondary={false} />
                      </DataTable.Td>
                    </DataTable.Row>
                    {open ? (
                      <tr className="bg-surface-muted/60">
                        <td colSpan={6} className="px-5 py-4">
                          <StepDrawer workOrder={workOrder} step={step} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        </div>

        {/* จอแคบ — การ์ดเรียง (ตารางหกคอลัมน์บีบแล้วอ่านไม่ออก) */}
        <ul className="space-y-2 p-3 lg:hidden">
          {workOrder.operations.map((step) => {
            const open = openId === step.id;
            const lines = linesOf(workOrder, step.id);
            return (
              <li
                key={step.id}
                className={cn("rounded-lg border border-border bg-surface p-3", open && "ring-2 ring-blue-600 dark:ring-blue-400")}
              >
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  aria-expanded={open}
                  className={cn("block w-full rounded-md text-left", FOCUS_BUTTON)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-start gap-2">
                      <StateDot state={step.state} className="mt-1.5" />
                      <span className="min-w-0">
                        <span className="block font-medium text-strong">
                          {step.queue}. {step.name}
                        </span>
                        <StepMeta step={step} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                      {quantitySummary(lines)}
                      <span className="block">{step.timing}</span>
                    </span>
                  </span>
                  <span className="mt-2 block">
                    <StepStatus step={step} />
                  </span>
                </button>
                <div className="mt-3 border-t border-divider pt-3">
                  <StepButtons workOrder={workOrder} step={step} secondary={false} />
                </div>
                {open ? (
                  <div className="mt-3 border-t border-divider pt-3">
                    <StepDrawer workOrder={workOrder} step={step} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ของทั้งใบที่ไม่ผูกกับขั้นไหน — สองกล่องเล็กเคียงกัน ไม่ใช่กองท้ายหน้า */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="ข้อมูลอ้างอิงที่ล็อกไว้" icon={Lock} tone="system" compact>
          <ReferenceRows workOrder={workOrder} dense />
        </Section>
        <Section title="ประวัติทั้งใบ" icon={History} tone="system" compact>
          <EventList events={workOrder.events} limit={3} dense />
        </Section>
      </div>
    </div>
  );
}

/* ══════════════════════════════════ B · จอสถานีของหัวหน้า — สามคอลัมน์จบในจอเดียว */

function StepList({
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
      <div>
        <p
          className={cn(
            "flex items-center gap-1.5 px-4 pb-1.5 pt-3 text-xs font-medium",
            outsource ? "text-secondary" : "text-module-production-text",
          )}
        >
          {outsource ? <Truck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {title}
        </p>
        <ol>
          {steps.map((step) => {
            const selected = selectedId === step.id;
            const lines = linesOf(workOrder, step.id);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors",
                    FOCUS_BUTTON,
                    selected ? INTERACTIVE_SELECTED : "hover:bg-interactive-hover",
                  )}
                >
                  <StateDot state={step.state} className="mt-1.5" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", selected ? "" : "text-strong")}>
                      {step.name}
                    </span>
                    <span className={cn("block text-xs", selected ? "opacity-80" : "text-muted")}>
                      {STATE_META[step.state].label}
                      {step.assignee ? ` · ${step.assignee}` : ""}
                    </span>
                    {step.blockers.map((blocker) => (
                      <span key={blocker} className="block text-xs font-medium text-red-700 dark:text-red-300">
                        {blocker}
                      </span>
                    ))}
                  </span>
                  {lines.length > 0 ? (
                    <span className={cn("shrink-0 text-xs tabular-nums", selected ? "opacity-80" : "text-muted")}>
                      {quantitySummary(lines).replace(" ตัว", "")}
                    </span>
                  ) : null}
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
      <p className="px-4 py-3 text-xs tabular-nums text-muted">
        ผ่านแล้ว {done}/{workOrder.operations.length} ขั้น
      </p>
    </div>
  );
}

function Workspace({ workOrder, step }: { workOrder: DensityWorkOrder; step: DensityOperation }) {
  const lines = linesOf(workOrder, step.id);
  const problems = stepProblems(workOrder, step);
  const open = problems.filter((item) => item.status.tone !== "success").length;
  const events = stepEvents(workOrder, step);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>{step.timing}</span>
        {step.waitsFor.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            รับงานต่อจาก: {step.waitsFor.join(", ")}
          </span>
        ) : null}
      </div>

      {step.blockers.length > 0 ? (
        <Alert variant="error" title="มีปัญหาค้างอยู่">
          {step.blockers.join(" · ")}
        </Alert>
      ) : null}
      <StationHint step={step} />
      <QtyInputs workOrder={workOrder} step={step} columns={2} />
      <StepButtons workOrder={workOrder} step={step} size="lg" />

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
    </div>
  );
}

export function StationVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const [id, setId] = useState<string | null>(firstActionable(workOrder)?.id ?? null);
  const step = workOrder.operations.find((item) => item.id === id) ?? null;

  return (
    <div className="space-y-4">
      <BlockingBar workOrder={workOrder} />

      {/* จอแคบ: รายการซ้ายกลายเป็นชิปแถวเดียวข้างบน */}
      <div className="xl:hidden">
        <Section>
          <LaneChips workOrder={workOrder} selectedId={id} onSelect={setId} />
        </Section>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <Section
          title="ขั้นงาน"
          compact
          flush
          className="hidden xl:block"
          meta={`${workOrder.operations.length} ขั้น · กดเพื่อเปิดในแผงกลาง`}
        >
          <StepList workOrder={workOrder} selectedId={id} onSelect={setId} />
        </Section>

        {step ? (
          <Section
            title={step.name}
            icon={Factory}
            tone="production"
            meta={<StepMeta step={step} />}
            action={<StepStatus step={step} />}
          >
            <Workspace workOrder={workOrder} step={step} />
          </Section>
        ) : (
          <Section title="ลงมือทำ" icon={Factory} tone="production">
            <p className="text-sm text-secondary">เลือกขั้นงานทางซ้ายเพื่อเปิดงานนั้นที่นี่</p>
          </Section>
        )}

        <Section title="ใบนี้" compact>
          <OrderFacts workOrder={workOrder} layout="stack" />
          <div className="mt-4 border-t border-divider pt-4">
            <GroupLabel icon={Lock}>ข้อมูลอ้างอิงที่ล็อกไว้</GroupLabel>
            <ReferenceRows workOrder={workOrder} dense />
          </div>
          <div className="mt-4 border-t border-divider pt-4">
            <GroupLabel icon={History}>ประวัติทั้งใบ</GroupLabel>
            <EventList events={workOrder.events} limit={5} dense />
          </div>
          <Freshness className="mt-4" />
        </Section>
      </div>
    </div>
  );
}

/* ════════════════════════════ C · รางเดียว — ทุกอย่างเกาะอยู่กับขั้นของมัน */

function groupState(group: DensityOperation[]) {
  if (group.every((step) => step.state === "COMPLETED")) return "done" as const;
  if (group.some((step) => step.state === "BLOCKED")) return "blocked" as const;
  if (group.some((step) => step.state === "RUNNING")) return "running" as const;
  if (group.some((step) => step.state === "READY")) return "ready" as const;
  return "planned" as const;
}

function railDot(state: ReturnType<typeof groupState>) {
  switch (state) {
    case "done":
      return "bg-green-600 dark:bg-green-400";
    case "blocked":
      return "bg-red-600 dark:bg-red-400";
    case "running":
      return "bg-amber-500 ring-4 ring-amber-500/20";
    case "ready":
      return "bg-blue-600 dark:bg-blue-400";
    default:
      return "bg-surface ring-2 ring-divider";
  }
}

function RailRow({
  dot,
  lineDone,
  last = false,
  children,
}: {
  dot: React.ReactNode;
  lineDone: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="relative flex w-6 shrink-0 flex-col items-center">
        <span className="mt-2.5">{dot}</span>
        {!last ? (
          <span
            aria-hidden="true"
            className={cn("w-1 flex-1 rounded-full", lineDone ? "bg-green-600/60 dark:bg-green-400/50" : "bg-divider")}
          />
        ) : null}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-5")}>{children}</div>
    </li>
  );
}

function StepNode({
  workOrder,
  step,
  open,
  onToggle,
}: {
  workOrder: DensityWorkOrder;
  step: DensityOperation;
  open: boolean;
  onToggle: () => void;
}) {
  const lines = linesOf(workOrder, step.id);
  const problems = stepProblems(workOrder, step);
  const events = stepEvents(workOrder, step);
  const meta = STATE_META[step.state];
  return (
    <div
      className={cn(
        "card-surface rounded-xl",
        step.outsourced && "border border-dashed border-border",
        step.state === "PLANNED" && !open && "opacity-75",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn("flex w-full items-start gap-2 rounded-xl p-3 text-left", FOCUS_BUTTON)}
      >
        <StateDot state={step.state} className="mt-1.5" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-strong">
              {step.queue}. {step.name}
            </span>
            {step.outsourced ? (
              <span className="inline-flex items-center gap-1 text-xs text-secondary">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" /> ร้านนอก
              </span>
            ) : null}
            <span className="text-xs text-secondary">{meta.label}</span>
          </span>
          <span className="mt-0.5 block">
            <StepMeta step={step} />
          </span>
          {step.blockers.map((blocker) => (
            <span
              key={blocker}
              className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {blocker}
            </span>
          ))}
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums text-muted">
          <span className="block font-medium text-strong">{quantitySummary(lines)}</span>
          <span className="block">{step.timing}</span>
        </span>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-divider px-3 pb-3 pt-3">
          {step.waitsFor.length > 0 ? (
            <p className="inline-flex flex-wrap items-center gap-1 text-xs text-secondary">
              <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              รับงานต่อจาก: {step.waitsFor.join(", ")}
            </p>
          ) : null}
          <StationHint step={step} />
          <QtyInputs workOrder={workOrder} step={step} columns={2} />
          <StepButtons workOrder={workOrder} step={step} size="lg" />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <GroupLabel icon={ClipboardCheck}>จำนวน</GroupLabel>
              <QtyMini lines={lines} />
            </div>
            <div className="space-y-4">
              {problems.length > 0 ? (
                <div>
                  <GroupLabel icon={AlertTriangle}>ปัญหาที่ขั้นนี้</GroupLabel>
                  <ul className="space-y-2">
                    {problems.map((item) => (
                      <ProblemCard key={item.id} item={item} compact />
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <GroupLabel icon={History}>ประวัติที่ขั้นนี้</GroupLabel>
                <EventList events={events} limit={4} dense />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RailVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set(workOrder.operations.filter((step) => ACTIVE_STATES.has(step.state)).map((step) => step.id)),
  );
  const [startOpen, setStartOpen] = useState(false);
  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const groups = levelsOf(workOrder);
  const outsourcedNames = new Set(workOrder.operations.filter((step) => step.outsourced).map((step) => step.name));
  const mergeStep = workOrder.operations.find(
    (step) => !step.outsourced && step.waitsFor.some((name) => outsourcedNames.has(name)),
  );
  const allDone = doneCount(workOrder) === workOrder.operations.length;
  const startEvents = orderEvents(workOrder);

  return (
    <div className="space-y-4">
      <BlockingBar workOrder={workOrder} />

      <Section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <OrderFacts workOrder={workOrder} />
          <Freshness />
        </div>
      </Section>

      <Section
        title="เส้นทางของใบนี้"
        icon={Route}
        tone="production"
        meta="อ่านจากบนลงล่าง — จำนวน ปัญหา ประวัติ และปุ่มของขั้นไหน อยู่ในกล่องของขั้นนั้น · ขั้นที่ยังไม่ถึงคิวพับไว้"
      >
        <ol>
          {/* โหนดแรก = ปล่อยผลิต — ของ "ทั้งใบ" (ออเดอร์ · ข้อมูลอ้างอิง · ประวัติของใบ) อยู่ที่นี่ */}
          <RailRow
            dot={
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-600 dark:bg-green-400">
                <Check className="h-2.5 w-2.5 text-white dark:text-black" aria-hidden="true" strokeWidth={3} />
              </span>
            }
            lineDone
          >
            <div className="rounded-xl border border-divider">
              <button
                type="button"
                onClick={() => setStartOpen((value) => !value)}
                aria-expanded={startOpen}
                className={cn("flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left", FOCUS_BUTTON)}
              >
                <span>
                  <span className="font-medium text-strong">ปล่อยผลิต</span>
                  <span className="ml-2 text-xs text-muted">{workOrder.releasedAt}</span>
                  <span className="block text-xs text-secondary">
                    {workOrder.orderNumber} · {workOrder.customerName} · ฉบับข้อมูล {workOrder.revision}
                  </span>
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-muted transition-transform", startOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              {startOpen ? (
                <div className="grid gap-4 border-t border-divider p-3 md:grid-cols-2">
                  <div>
                    <GroupLabel icon={Lock}>ข้อมูลอ้างอิงที่ล็อกไว้</GroupLabel>
                    <ReferenceRows workOrder={workOrder} dense />
                  </div>
                  <div>
                    <GroupLabel icon={History}>ประวัติของทั้งใบ</GroupLabel>
                    <EventList events={startEvents} dense />
                  </div>
                </div>
              ) : null}
            </div>
          </RailRow>

          {groups.map((group, index) => {
            const state = groupState(group);
            const parallel = group.length > 1;
            const hasMerge = mergeStep ? group.some((step) => step.id === mergeStep.id) : false;
            return (
              <RailRow
                key={index}
                dot={<span aria-hidden="true" className={cn("block h-3.5 w-3.5 rounded-full", railDot(state))} />}
                lineDone={state === "done"}
              >
                {parallel ? (
                  <p className="mb-1.5 text-xs font-medium text-muted">เดินพร้อมกันได้ {group.length} ขั้น</p>
                ) : null}
                {hasMerge ? (
                  <p className="mb-1.5 flex items-center gap-2 rounded-lg bg-surface-muted/60 px-3 py-2 text-xs text-secondary">
                    <span aria-hidden="true" className="text-base text-muted">
                      ⤵
                    </span>
                    สองสายมาบรรจบที่{" "}
                    <span className="font-medium text-strong">{mergeStep?.name}</span> — เริ่มไม่ได้จนกว่างานจากร้านจะกลับมาและผ่านขั้นก่อนหน้าครบ
                  </p>
                ) : null}
                <div className={cn("grid gap-2", parallel && "md:grid-cols-2")}>
                  {group.map((step) => (
                    <StepNode
                      key={step.id}
                      workOrder={workOrder}
                      step={step}
                      open={openIds.has(step.id)}
                      onToggle={() => toggle(step.id)}
                    />
                  ))}
                </div>
              </RailRow>
            );
          })}

          <RailRow
            dot={
              <span
                aria-hidden="true"
                className={cn(
                  "block h-3.5 w-3.5 rounded-full",
                  allDone ? "bg-green-600 dark:bg-green-400" : "bg-surface ring-2 ring-divider",
                )}
              />
            }
            lineDone={allDone}
            last
          >
            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="font-medium text-strong">ส่งมอบ</p>
              <p className="text-xs text-muted">
                กำหนดส่ง {workOrder.deadline} · {allDone ? "ผ่านครบทุกขั้นแล้ว" : "รอครบทุกขั้น"}
              </p>
            </div>
          </RailRow>
        </ol>
      </Section>
    </div>
  );
}

export const VARIANT_COMPONENTS = {
  current: CurrentVariant,
  table: TableVariant,
  station: StationVariant,
  rail: RailVariant,
} as const;

export type WorkOrderRebuildVariant = keyof typeof VARIANT_COMPONENTS;
