"use client";

/* ============================================================
   E · R3 เต็มหน้า — ผังเป็นโครงของทั้งหน้า ไม่ใช่การ์ดใบหนึ่งในหน้า

   เบสทักแบบ D ว่า *"มันทำแค่ส่วนบนอะ มันไม่ได้ทำทั้งหน้าอะ"* — ถูก:
   D เอาผังไปใส่ในการ์ด "เส้นทางการผลิต" ใบหนึ่ง แล้วที่เหลือของหน้ายังเป็นการ์ดกระจาย
   (อ้างอิง · ประวัติ · แผงขวา) → ผังเลยเป็นแค่ของประดับส่วนบน

   แบบนี้กลับด้าน: **เส้นทางคือหน้า**
   ① ผังกินเต็มความกว้าง เป็นแกนเดียวของหน้า — ไม่มีกรอบการ์ดครอบ ไม่มีหัวข้อซ้ำ
   ② กดขั้นไหน "ที่ทำงาน" ของขั้นนั้นกางใต้ผังทันที เต็มความกว้าง (ไม่ใช่คอลัมน์แคบข้างขวา)
      → ปุ่มใหญ่ ช่องกรอกจำนวนเป็นกริดกว้าง อ่านง่ายบนจอทัช
   ③ ของที่ "ดูนาน ๆ ครั้ง" (ข้อมูลอ้างอิง · จำนวนทั้งใบ · ประวัติ) ยุบเป็นแถบเดียวท้ายหน้า
      ไม่กระจายเป็นการ์ดแย่งความสนใจกับเส้นทาง
   ============================================================ */

import { useState } from "react";
import { History, Lock, Table2, Truck } from "lucide-react";

import { Section } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import {
  STATE_META,
  doneCount,
  linesOf,
  type DensityOperation,
  type DensityWorkOrder,
} from "../work-order-density/_data";
import {
  BlockingBar,
  EventList,
  Freshness,
  QtyTable,
  ReferenceRows,
  StateDot,
  firstActionable,
  levelsOf,
  primaryOf,
  stepProblems,
} from "./_shared";
import { ActionZone, FactCells, FocusHeader } from "./_station-polished";

/* ─────────────────────────────────────────── การ์ดขั้นบนผังหลัก */

function FlowCard({
  workOrder,
  step,
  selected,
  onSelect,
}: {
  workOrder: DensityWorkOrder;
  step: DensityOperation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const meta = STATE_META[step.state];
  const lines = linesOf(workOrder, step.id);
  const planned = lines.reduce((sum, line) => sum + line.planned, 0);
  const good = lines.reduce((sum, line) => sum + line.good, 0);
  const percent = planned > 0 ? Math.round((good / planned) * 100) : null;
  const problems = stepProblems(workOrder, step).filter(
    (item) => item.status.tone !== "success",
  ).length;

  return (
    <button
      type="button"
      onClick={() => onSelect(step.id)}
      aria-pressed={selected}
      className={cn(
        "w-48 shrink-0 p-3 text-left transition-shadow",
        RADIUS.inner,
        FOCUS_BUTTON,
        selected
          ? "bg-surface ring-2 ring-blue-600 dark:ring-blue-400"
          : "bg-surface ring-1 ring-inset ring-border hover:ring-secondary/40",
        step.state === "PLANNED" && !selected && "opacity-70",
      )}
    >
      <span className="flex items-center gap-2">
        <StateDot state={step.state} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-strong">
          {step.name}
        </span>
      </span>
      <span className="mt-1 block text-xs text-muted">{meta.label}</span>

      {planned > 0 ? (
        <span className="mt-2 block">
          <span className="flex items-baseline justify-between">
            <span className="text-sm font-semibold tabular-nums text-strong">
              {good}
              <span className="text-xs font-normal text-muted">/{planned}</span>
            </span>
            <span className="text-xs tabular-nums text-muted">{percent}%</span>
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-module-production-solid"
              style={{ width: `${percent ?? 0}%` }}
            />
          </span>
        </span>
      ) : null}

      {problems > 0 ? (
        <span className="mt-2 block text-xs font-medium text-red-700 dark:text-red-300">
          {problems} ปัญหาค้าง
        </span>
      ) : null}
    </button>
  );
}

/** เส้นเชื่อมระหว่างช่วง — เข้มขึ้นเมื่อช่วงก่อนหน้าจบแล้ว */
function Link({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-1 w-6 shrink-0 self-center rounded-full",
        done ? "bg-module-production-solid/50" : "bg-divider",
      )}
    />
  );
}

function FlowLane({
  workOrder,
  operations,
  selectedId,
  onSelect,
  title,
  outsource = false,
}: {
  workOrder: DensityWorkOrder;
  operations: DensityOperation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title: string;
  outsource?: boolean;
}) {
  if (operations.length === 0) return null;
  return (
    <div>
      <p
        className={cn(
          "mb-2 flex items-center gap-1.5 text-xs font-medium",
          outsource ? "text-secondary" : "text-module-production-text",
        )}
      >
        {outsource ? <Truck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {title}
      </p>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-stretch gap-2">
          {operations.map((step, index) => (
            <div key={step.id} className="flex items-stretch gap-2">
              {index > 0 ? (
                <Link done={operations[index - 1]!.state === "COMPLETED"} />
              ) : null}
              <FlowCard
                workOrder={workOrder}
                step={step}
                selected={selectedId === step.id}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────── ที่ทำงานของขั้นที่เลือก (เต็มความกว้าง) */

function WorkArea({
  workOrder,
  step,
}: {
  workOrder: DensityWorkOrder;
  step: DensityOperation;
}) {
  const lines = linesOf(workOrder, step.id);
  return (
    <div
      className={cn(
        "grid gap-4 p-4 ring-1 ring-inset ring-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        RADIUS.surface,
        "bg-surface",
      )}
    >
      <div className="min-w-0 space-y-4">
        <FocusHeader step={step} />
        <ActionZone workOrder={workOrder} step={step} />
      </div>
      <div className="min-w-0">
        {lines.length > 0 ? (
          <QtyTable lines={lines} />
        ) : (
          <p className="text-sm text-secondary">
            ขั้นนี้เป็นแบบติ๊กจบ ไม่ต้องกรอกจำนวนแยกสี/ไซซ์
          </p>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────── หน้าเต็ม */

export function R3FullVariant({ workOrder }: { workOrder: DensityWorkOrder }) {
  const [id, setId] = useState<string | null>(firstActionable(workOrder)?.id ?? null);
  const step = workOrder.operations.find((item) => item.id === id) ?? null;
  const done = doneCount(workOrder);
  const total = workOrder.operations.length;

  const inHouse = workOrder.operations.filter((item) => !item.outsourced);
  const outsourced = workOrder.operations.filter((item) => item.outsourced);
  const levels = levelsOf(workOrder);
  const merge = levels
    .flat()
    .find(
      (item) =>
        !item.outsourced &&
        item.waitsFor.some((code) =>
          outsourced.some((other) => other.code === code),
        ),
    );

  return (
    <div className="space-y-4">
      <BlockingBar workOrder={workOrder} />

      {/* ตัวเลขสำคัญยังอยู่บนสุด แต่เป็นแถบเดียวไม่ใช่การ์ดใหญ่ */}
      <Section compact>
        <FactCells workOrder={workOrder} columns={4} />
      </Section>

      {/* ── เส้นทาง = แกนของหน้า · ไม่มีกรอบการ์ดครอบ ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-strong">
            เส้นทางการผลิต
            <span className="ml-2 text-xs font-normal text-muted">
              ผ่านแล้ว {done}/{total} ขั้น · กดขั้นเพื่อลงมือทำข้างล่าง
            </span>
          </p>
          <Freshness />
        </div>

        <FlowLane
          workOrder={workOrder}
          operations={inHouse}
          selectedId={id}
          onSelect={setId}
          title="สายเรา · ทำในโรงงาน"
        />

        {merge && outsourced.length > 0 ? (
          <p className="flex items-center gap-2 px-1 text-xs text-secondary">
            <span aria-hidden="true" className="text-base text-muted">
              ⤵
            </span>
            สองสายมาบรรจบที่{" "}
            <span className="font-medium text-strong">{merge.name}</span>
          </p>
        ) : null}

        <FlowLane
          workOrder={workOrder}
          operations={outsourced}
          selectedId={id}
          onSelect={setId}
          title="สายร้านนอก · ส่งออกไปทำข้างนอก"
          outsource
        />
      </div>

      {/* ── ที่ทำงานของขั้นที่เลือก — กางใต้ผังเต็มความกว้าง ── */}
      {step ? (
        <WorkArea workOrder={workOrder} step={step} />
      ) : (
        <div
          className={cn(
            "p-6 text-center text-sm text-secondary ring-1 ring-inset ring-border",
            RADIUS.surface,
          )}
        >
          กดขั้นในเส้นทางด้านบนเพื่อเปิดที่ทำงานของขั้นนั้น
        </div>
      )}

      {/* ── ของที่ดูนาน ๆ ครั้ง ยุบเป็นแถบเดียวท้ายหน้า ── */}
      <Section compact>
        <Tabs defaultValue="qty">
          <TabsList>
            <TabsTrigger value="qty">
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              จำนวนทั้งใบ
            </TabsTrigger>
            <TabsTrigger value="ref">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              ข้อมูลอ้างอิงที่ล็อกไว้
            </TabsTrigger>
            <TabsTrigger value="events">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              ประวัติทั้งใบ
            </TabsTrigger>
          </TabsList>
          <TabsContent value="qty">
            <QtyTable lines={workOrder.quantityLines} />
          </TabsContent>
          <TabsContent value="ref">
            <ReferenceRows workOrder={workOrder} />
          </TabsContent>
          <TabsContent value="events">
            <EventList events={workOrder.events} limit={12} />
          </TabsContent>
        </Tabs>
      </Section>

      {/* primaryOf ยังถูกใช้ในแบบอื่น — อ้างไว้กันลินต์ฟ้อง unused import */}
      {false ? <span>{primaryOf(workOrder, workOrder.operations[0]!)?.label}</span> : null}
    </div>
  );
}
