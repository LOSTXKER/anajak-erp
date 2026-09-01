"use client";

/* ชิ้นส่วนของหน้าใบสั่งผลิต — ลอกมาจาก production-v2-control-record.tsx ตัวจริง
   ทีละกอง เพื่อให้ช่อง "ของจริงตอนนี้" สูงและรกเท่าของจริงเป๊ะ
   (ของที่ไม่ได้กำลังเทียบ — Section · DataTable · StatusLabel · Alert · Button ·
   Input · EmptyState — import ตัวจริงทั้งหมด ไม่วาดใหม่) */

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  ExternalLink,
  Factory,
  History,
  Lock,
  PackageCheck,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { StatusLabel } from "@/components/ui/status-label";
import { cn } from "@/lib/utils";

import {
  SPECIALIZED_HINT,
  STATE_META,
  doneCount,
  linesOf,
  openExceptionCount,
  quantitySummary,
  type DensityException,
  type DensityOperation,
  type DensityQuantityLine,
  type DensityState,
  type DensityWorkOrder,
} from "./_data";

/* ────────────────────────────────────── แถบ "ข้อมูลอัปเดตล่าสุด" (บรรทัดบนสุด) */

export function FreshnessRow() {
  return (
    <div className="flex justify-end">
      <p className="text-xs text-muted">อัปเดตล่าสุด 12 วินาทีที่แล้ว</p>
    </div>
  );
}

/* ──────────────────────────────────────────── การ์ดข้อมูลใบ 5 ช่อง (ของเดิม) */

export function IdentityStrip({ workOrder }: { workOrder: DensityWorkOrder }) {
  const open = openExceptionCount(workOrder);
  const done = doneCount(workOrder);
  const percent =
    workOrder.operations.length === 0
      ? 0
      : Math.round((done / workOrder.operations.length) * 100);
  return (
    <Section>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <p className="text-xs text-muted">ออเดอร์</p>
          <span className="mt-1 inline-flex items-center gap-1 font-semibold text-strong">
            {workOrder.orderNumber} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </span>
          <p className="mt-1 text-sm text-secondary">{workOrder.customerName}</p>
        </div>
        <div>
          <p className="text-xs text-muted">กำหนดส่ง</p>
          <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-strong">
            <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
            {workOrder.deadline}
          </p>
          <p className="mt-1 text-xs text-muted">ความสำคัญ {workOrder.priorityLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted">ปัญหาที่ยังไม่จบ</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold tabular-nums",
              open > 0 ? "text-red-700 dark:text-red-300" : "text-strong",
            )}
          >
            {open.toLocaleString("th-TH")}
          </p>
          <p className="mt-1 text-xs text-muted">รายการ</p>
        </div>
        <div>
          <p className="text-xs text-muted">ความคืบหน้า</p>
          <div className="mt-1 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-2xl font-semibold tabular-nums text-strong">{percent}%</p>
              <p className="text-xs text-muted">
                {done}/{workOrder.operations.length} ขั้นเสร็จแล้ว
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────────────────────── ผังสายพานคู่ (R3 ที่เบสเลือกไว้แล้ว) */

function dotClass(state: DensityState) {
  switch (state) {
    case "COMPLETED":
      return "bg-green-600 dark:bg-green-400";
    case "RUNNING":
      return "bg-amber-500 ring-4 ring-amber-500/20";
    case "BLOCKED":
      return "bg-red-600/70 dark:bg-red-400/70";
    case "READY":
      return "bg-blue-600 dark:bg-blue-400";
    default:
      return "bg-border";
  }
}

function StationChip({
  operation,
  selected,
  onSelect,
}: {
  operation: DensityOperation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(operation.id)}
      aria-pressed={selected}
      aria-label={`${operation.name} · ${STATE_META[operation.state].label} · กดเพื่อดูรายละเอียดขั้นนี้`}
      className={cn(
        "card-surface w-44 shrink-0 rounded-xl p-3 text-left transition-shadow",
        selected && "ring-2 ring-blue-600 dark:ring-blue-400",
        operation.blockers.length > 0 && "ring-1 ring-red-500/40",
        operation.state === "PLANNED" && "opacity-70",
      )}
    >
      <span className="flex items-start gap-2">
        <span
          aria-hidden
          className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", dotClass(operation.state))}
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-sm font-medium text-strong">
            {operation.name}
          </span>
          <span className="block truncate text-xs text-muted">
            {STATE_META[operation.state].label}
            {operation.assignee ? ` · ${operation.assignee}` : ""}
          </span>
        </span>
      </span>
    </button>
  );
}

function Lane({
  title,
  operations,
  selectedId,
  onSelect,
  outsource = false,
}: {
  title: string;
  operations: DensityOperation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  outsource?: boolean;
}) {
  if (operations.length === 0) return null;
  return (
    <div>
      <p
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-xs font-medium",
          outsource ? "text-secondary" : "text-module-production-text",
        )}
      >
        {outsource ? <Truck className="h-3.5 w-3.5" aria-hidden /> : null}
        {title}
      </p>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-1.5">
          {operations.map((operation, index) => (
            <div key={operation.id} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-1 w-4 shrink-0 rounded-full",
                    operations[index - 1]!.state === "COMPLETED"
                      ? "bg-green-600/50 dark:bg-green-400/40"
                      : "bg-divider",
                  )}
                />
              ) : null}
              <StationChip
                operation={operation}
                selected={selectedId === operation.id}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FlowMap({
  workOrder,
  selectedId,
  onSelect,
  hint = "กดขั้นในผังเพื่อไปที่รายละเอียดข้างล่าง",
}: {
  workOrder: DensityWorkOrder;
  selectedId: string | null;
  onSelect: (id: string) => void;
  hint?: string;
}) {
  const inHouse = workOrder.operations.filter((step) => !step.outsourced);
  const outsourced = workOrder.operations.filter((step) => step.outsourced);
  const mergePoint = inHouse.find((step) =>
    step.waitsFor.some((name) =>
      outsourced.some((other) => other.name === name),
    ) || step.waitsFor.includes("ตรวจของกลับจากร้าน"),
  );
  const done = doneCount(workOrder);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusLabel
          label={`ผ่านแล้ว ${done}/${workOrder.operations.length} ขั้น`}
          tone={done === workOrder.operations.length ? "success" : "accent"}
        />
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <Lane
        title="สายเรา · ทำในโรงงาน"
        operations={inHouse}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {mergePoint && outsourced.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface-muted/60 px-3 py-2">
          <span aria-hidden className="text-base text-muted">
            ⤵
          </span>
          <p className="text-xs text-secondary">
            สองสายมาบรรจบที่{" "}
            <span className="font-medium text-strong">{mergePoint.name}</span> —
            เริ่มขั้นนี้ไม่ได้จนกว่างานจากร้านจะกลับมาและผ่านขั้นก่อนหน้าครบ
          </p>
        </div>
      ) : null}
      <Lane
        title="สายร้านนอก · ส่งออกไปทำข้างนอก"
        operations={outsourced}
        selectedId={selectedId}
        onSelect={onSelect}
        outsource
      />
    </div>
  );
}

/* ─────────────────────────── รายการขั้นงานใต้ผัง (ของเดิม — ตัวที่ซ้ำกับผัง) */

export function OperationList({
  workOrder,
  selectedId,
}: {
  workOrder: DensityWorkOrder;
  selectedId: string | null;
}) {
  return (
    <ol className="space-y-1">
      {workOrder.operations.map((operation) => {
        const meta = STATE_META[operation.state];
        const lines = linesOf(workOrder, operation.id);
        return (
          <li
            key={operation.id}
            className={cn(
              "relative grid gap-3 rounded-lg px-3 py-4 hover:bg-interactive-hover sm:grid-cols-[2rem_minmax(0,1fr)_auto]",
              selectedId === operation.id && "bg-interactive-pressed",
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold tabular-nums text-secondary">
              {operation.queue}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-semibold text-strong">{operation.name}</h3>
                <StatusLabel label={meta.label} tone={meta.tone} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {operation.workCenter}
                {operation.assignee ? ` · ${operation.assignee}` : " · ยังไม่มอบหมายคน"}
              </p>
              {operation.waitsFor.length > 0 ? (
                <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-xs text-secondary">
                  <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                  รับงานต่อจาก: {operation.waitsFor.join(", ")}
                </p>
              ) : null}
              {operation.blockers.map((blocker) => (
                <p
                  key={blocker}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300"
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {blocker}
                </p>
              ))}
            </div>
            <div className="sm:text-right">
              <p className="text-sm font-semibold tabular-nums text-strong">
                {quantitySummary(lines)}
              </p>
              <p className="mt-1 text-xs text-muted">{operation.timing}</p>
              <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                {operation.commands.includes("raiseException") ? (
                  <Button variant="outline" size="sm">
                    <AlertTriangle />
                    แจ้งปัญหา
                  </Button>
                ) : null}
              </div>
              <div className="mt-2 flex justify-start sm:justify-end">
                {operation.outsourced ? (
                  <Button variant="outline" size="sm">
                    <Truck />
                    เปิดใบสั่งร้านนอก
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────────────────────────── แผงลงมือทำ (คอลัมน์ขวา) */

export function WorkPanel({
  workOrder,
  operation,
  extra,
}: {
  workOrder: DensityWorkOrder;
  operation: DensityOperation | null;
  /** เนื้อหาเพิ่มท้ายแผง — ใช้ในแบบ B ที่ยกจำนวน/ปัญหา/ประวัติของขั้นมาไว้ที่นี่ */
  extra?: React.ReactNode;
}) {
  if (!operation) {
    return (
      <Section title="ลงมือทำ" icon={Factory} tone="production">
        <p className="text-sm text-secondary">กดขั้นงานในผังด้านบนเพื่อเปิดงานนั้นที่นี่</p>
      </Section>
    );
  }
  const meta = STATE_META[operation.state];
  const specialized = Object.keys(SPECIALIZED_HINT).find((key) =>
    operation.commands.includes(key),
  );
  const reportable = linesOf(workOrder, operation.id).filter(
    (line) => line.planned > line.good,
  );
  const canReport = operation.commands.includes("reportOutput") && reportable.length > 0;

  return (
    <Section title="ลงมือทำ" icon={Factory} tone="production" meta="ขั้นที่เลือกจากผังด้านบน">
      <div className="space-y-3">
        <div>
          <p className="text-base font-semibold text-strong">{operation.name}</p>
          <p className="text-xs text-muted">
            {operation.workCenter}
            {operation.assignee ? ` · ${operation.assignee}` : " · ยังไม่มอบหมายคน"}
          </p>
        </div>
        <StatusLabel label={meta.label} tone={meta.tone} />

        {operation.blockers.length > 0 ? (
          <Alert variant="error" title="มีปัญหาค้างอยู่">
            {operation.blockers.join(" · ")}
          </Alert>
        ) : null}

        {operation.commands.length === 0 ? (
          <p className="text-sm text-secondary">
            ยังทำอะไรกับขั้นนี้ไม่ได้ตอนนี้ — รอขั้นก่อนหน้า หรือยังไม่ได้ปล่อยงาน
          </p>
        ) : null}

        {specialized ? (
          <Alert variant="info" title="ขั้นนี้ทำที่จอสถานี">
            <span className="flex flex-wrap items-center gap-2">
              {SPECIALIZED_HINT[specialized]}
              <Link
                href="/factory/station"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดจอสถานี
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </span>
          </Alert>
        ) : null}

        {canReport ? (
          <div className="space-y-2">
            <p className="text-xs text-secondary">
              บันทึกจำนวนที่ทำได้{" "}
              <span className="text-muted">(แยกตามสี/ไซซ์ ตามที่ระบบบังคับ)</span>
            </p>
            <div className="space-y-2">
              {reportable.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
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
        ) : null}

        <div className="flex flex-wrap gap-2">
          {operation.commands.includes("startOperation") ? (
            <Button size="lg" className="min-h-14 flex-1 text-base">
              เริ่มงาน
            </Button>
          ) : null}
          {canReport ? (
            <Button size="lg" className="min-h-14 flex-1 text-base">
              บันทึกผลงาน
            </Button>
          ) : null}
          {operation.commands.includes("pauseOperation") ? (
            <Button variant="outline">พักงาน</Button>
          ) : null}
        </div>

        {operation.commands.includes("raiseException") ? (
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            แจ้งปัญหาของขั้นนี้ทำได้ที่ปุ่มในรายการข้างล่าง
          </p>
        ) : null}

        {extra}
      </div>
    </Section>
  );
}

/* ────────────────────────────────────────── ข้อมูลอ้างอิงที่ล็อกไว้ (ของเดิม) */

export function ReferenceControl({ workOrder }: { workOrder: DensityWorkOrder }) {
  return (
    <Section
      title="ข้อมูลอ้างอิงที่ล็อกไว้"
      icon={Lock}
      tone="system"
      meta="สำเนาที่ใช้กับใบสั่งผลิตนี้ จะไม่เปลี่ยนตามต้นฉบับภายหลัง"
      action={<ShieldCheck className="h-5 w-5 text-muted" aria-hidden />}
    >
      <ul className="space-y-3">
        {workOrder.reference.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary">{row.label}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                row.present
                  ? "text-green-700 dark:text-green-300"
                  : "text-amber-700 dark:text-amber-300",
              )}
            >
              {row.present ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              )}
              {row.present ? "เก็บสำเนาแล้ว" : "ยังไม่มีสำเนา"}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-divider pt-4 text-xs">
        <div>
          <dt className="text-muted">ปล่อยผลิตเมื่อ</dt>
          <dd className="mt-1 font-medium text-secondary">{workOrder.releasedAt}</dd>
        </div>
        <div>
          <dt className="text-muted">ฉบับข้อมูล</dt>
          <dd className="mt-1 font-medium tabular-nums text-secondary">
            {workOrder.revision.toLocaleString("th-TH")}
          </dd>
        </div>
      </dl>
    </Section>
  );
}

/* ───────────────────────────────────── จำนวนตามขั้นงาน (ตาราง 7 คอลัมน์ × ทุกขั้น) */

function QuantityTable({ lines }: { lines: readonly DensityQuantityLine[] }) {
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
            <DataTable.Td
              align="right"
              className="font-semibold tabular-nums text-green-700 dark:text-green-300"
            >
              {line.good.toLocaleString("th-TH")}
            </DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums text-red-700 dark:text-red-300">
              {line.scrap.toLocaleString("th-TH")}
            </DataTable.Td>
            <DataTable.Td
              align="right"
              className="tabular-nums text-amber-700 dark:text-amber-300"
            >
              {line.rework.toLocaleString("th-TH")}
            </DataTable.Td>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

export function QuantityLedger({ workOrder }: { workOrder: DensityWorkOrder }) {
  const groups = workOrder.operations
    .map((step) => ({ step, lines: linesOf(workOrder, step.id) }))
    .filter((group) => group.lines.length > 0);

  if (groups.length === 0) {
    return (
      <Section title="จำนวนตามรายการ" icon={PackageCheck} tone="product">
        <EmptyState
          density="compact"
          icon={PackageCheck}
          title="ยังไม่มีรายการจำนวน"
          description="รายการสินค้า สี ไซซ์ และตำแหน่งพิมพ์จะปรากฏเมื่อสร้างใบสั่งผลิต"
        />
      </Section>
    );
  }

  return (
    <Section
      title="จำนวนตามขั้นงาน"
      icon={ClipboardCheck}
      tone="production"
      meta="แต่ละกลุ่มเป็นยอดของขั้นงานและศูนย์งานนั้น ไม่ใช่ยอดรวมซ้ำของทั้งใบ"
      flush
    >
      <div className="divide-y divide-divider">
        {groups.map((group) => (
          <section key={group.step.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-surface-muted px-4 py-3 sm:px-5">
              <h3 className="font-semibold text-strong">{group.step.name}</h3>
              <p className="text-xs text-muted">ศูนย์งาน: {group.step.workCenter}</p>
            </div>
            <QuantityTable lines={group.lines} />
          </section>
        ))}
      </div>
    </Section>
  );
}

/** จำนวนของขั้นเดียว — ใช้ในแบบ B ที่ย้ายจำนวนเข้าไปอยู่กับขั้นที่เลือก */
export function QuantityForStep({
  workOrder,
  operation,
}: {
  workOrder: DensityWorkOrder;
  operation: DensityOperation;
}) {
  const lines = linesOf(workOrder, operation.id);
  if (lines.length === 0) {
    return <p className="text-xs text-muted">ขั้นนี้ไม่นับชิ้น</p>;
  }
  return (
    <ul className="space-y-1">
      {lines.map((line) => (
        <li
          key={line.id}
          className="flex items-center justify-between gap-3 border-b border-divider py-1.5 text-sm last:border-0"
        >
          <span className="text-secondary">
            {line.color} / {line.size}
            <span className="ml-2 text-xs text-muted">{line.printPosition}</span>
          </span>
          <span className="shrink-0 tabular-nums text-strong">
            <span className="text-green-700 dark:text-green-300">{line.good}</span>
            <span className="text-muted"> / {line.planned}</span>
            {line.scrap > 0 ? (
              <span className="ml-2 text-xs text-red-700 dark:text-red-300">
                เสีย {line.scrap}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────────────────────────────── ปัญหาและข้อยกเว้น (ของเดิม) */

function ExceptionCard({ item }: { item: DensityException }) {
  return (
    <li className="rounded-lg bg-surface-muted p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel label={item.severity.label} tone={item.severity.tone} />
            <StatusLabel label={item.status.label} tone={item.status.tone} />
          </div>
          <h3 className="mt-2 font-semibold text-strong">{item.title}</h3>
          <p className="mt-1 text-sm text-secondary">{item.description}</p>
        </div>
        <p className="text-xs text-muted">{item.createdAt}</p>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted">ขั้นงาน</dt>
          <dd className="mt-0.5 text-secondary">{item.stepName}</dd>
        </div>
        <div>
          <dt className="text-muted">ผู้รับผิดชอบ</dt>
          <dd className="mt-0.5 text-secondary">{item.owner}</dd>
        </div>
        {item.disposition ? (
          <div>
            <dt className="text-muted">แนวทาง</dt>
            <dd className="mt-0.5 text-secondary">{item.disposition}</dd>
          </div>
        ) : null}
        {item.resolution ? (
          <div>
            <dt className="text-muted">ผลการแก้ไข</dt>
            <dd className="mt-0.5 text-secondary">{item.resolution}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-divider pt-3">
        <Button variant="outline" size="sm">
          ตัดสิน QC
        </Button>
        <Button variant="outline" size="sm">
          กำหนดศูนย์งานแก้
        </Button>
        <Button variant="outline" size="sm">
          ปิดปัญหา
        </Button>
      </div>
    </li>
  );
}

export function ExceptionLedger({
  workOrder,
  bare = false,
}: {
  workOrder: DensityWorkOrder;
  /** true = ไม่ห่อ Section (ใช้ตอนอยู่ในแท็บที่มีหัวข้ออยู่แล้ว) */
  bare?: boolean;
}) {
  const body =
    workOrder.exceptions.length === 0 ? (
      <EmptyState
        density="compact"
        icon={ClipboardCheck}
        title="ไม่มีปัญหาที่บันทึกไว้"
        description="เมื่อหน้างานแจ้งปัญหา รายการจะอยู่ที่นี่พร้อมสถานะการแก้ไข"
      />
    ) : (
      <ul className="space-y-3">
        {workOrder.exceptions.map((item) => (
          <ExceptionCard key={item.id} item={item} />
        ))}
      </ul>
    );

  if (bare) return body;
  return (
    <Section title="ปัญหาและข้อยกเว้น" meta="ติดตามปัญหา แนวทางจัดการ และผลการแก้ไข">
      {body}
    </Section>
  );
}

/* ──────────────────────────────────────────────── ประวัติการทำงาน (ของเดิม) */

export function EventLedger({
  workOrder,
  bare = false,
  limit,
}: {
  workOrder: DensityWorkOrder;
  bare?: boolean;
  limit?: number;
}) {
  const events = limit ? workOrder.events.slice(0, limit) : workOrder.events;
  const body = (
    <>
      <ol className="space-y-4">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-strong">{event.label}</p>
                <span className="text-xs text-muted">{event.at}</span>
              </div>
              {event.stepName ? (
                <p className="mt-0.5 text-xs text-muted">{event.stepName}</p>
              ) : null}
              {event.good || event.scrap || event.rework ? (
                <p className="mt-1 text-xs text-secondary">
                  งานดี +{event.good} · เสีย +{event.scrap} · ส่งแก้ +{event.rework}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {limit && workOrder.events.length > limit ? (
        <p className="mt-4 text-xs text-muted">
          แสดง {limit} รายการล่าสุด จากทั้งหมด {workOrder.events.length} รายการ ·{" "}
          <span className="text-blue-600 dark:text-blue-400">ดูทั้งหมด</span>
        </p>
      ) : null}
    </>
  );

  if (bare) return body;
  return (
    <Section
      title="ประวัติการทำงาน"
      icon={History}
      tone="system"
      meta="บันทึกย้อนหลังที่เพิ่มต่อเนื่องและไม่แก้ทับ"
    >
      {body}
    </Section>
  );
}

/* ────────────────────────────── กล่องเส้นทางการผลิต (ผัง + รายการ) แบบของเดิม */

export function RouteSection({
  workOrder,
  selectedId,
  onSelect,
  withList = true,
}: {
  workOrder: DensityWorkOrder;
  selectedId: string | null;
  onSelect: (id: string) => void;
  withList?: boolean;
}) {
  return (
    <Section
      title="เส้นทางการผลิต"
      meta="สถานะและผลผลิตของทุกขั้น เรียงตามคิวที่หัวหน้ากำหนด"
      icon={Route}
      tone="production"
    >
      {workOrder.operations.length === 0 ? (
        <EmptyState
          density="compact"
          icon={Route}
          title="ยังไม่มีเส้นทางการผลิต"
          description="เลือกเส้นทางก่อนปล่อยใบสั่งผลิต"
        />
      ) : (
        <>
          <div className={cn(withList && "mb-4 border-b border-divider pb-4")}>
            <FlowMap
              workOrder={workOrder}
              selectedId={selectedId}
              onSelect={onSelect}
              hint={
                withList
                  ? "กดขั้นในผังเพื่อไปที่รายละเอียดข้างล่าง"
                  : "กดขั้นในผังเพื่อเปิดงานนั้นในแผงด้านขวา"
              }
            />
          </div>
          {withList ? (
            <OperationList workOrder={workOrder} selectedId={selectedId} />
          ) : null}
        </>
      )}
    </Section>
  );
}
