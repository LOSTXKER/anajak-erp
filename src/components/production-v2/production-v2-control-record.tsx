"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  ExternalLink,
  History,
  PackageCheck,
  Play,
  RotateCcw,
  Route,
  ShieldCheck,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  oldestSuccessfulUpdate,
  ProductionFreshness,
} from "@/components/production/production-freshness";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { StatusLabel } from "@/components/ui/status-label";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  dispositionLabel,
  exceptionSeverityMeta,
  exceptionStatusMeta,
  operationEventLabel,
  operationStatusMeta,
  progressPercent,
  quantitySummary,
  reworkStatusMeta,
  workOrderStatusMeta,
} from "./manufacturing-presenter";
import {
  CreateOutsourceOrderAction,
  DecideQcDispositionAction,
  OperationControlActions,
  PlanReworkAction,
  ReleaseReworkAction,
  ResolveExceptionAction,
} from "./production-v2-control-actions";

type WorkOrder = RouterOutput["manufacturing"]["workOrder"];
type Operation = WorkOrder["operations"][number];
type QuantityLine = WorkOrder["quantityLines"][number];
type ProductionException = WorkOrder["exceptions"][number];
type ReworkCase = WorkOrder["reworkCases"][number];
type OperationEvent = WorkOrder["events"][number];

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "ต่ำ",
  NORMAL: "ปกติ",
  HIGH: "สูง",
  URGENT: "ด่วนมาก",
};

function hasSnapshot(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function ControlProgress({ operations }: { operations: readonly Operation[] }) {
  const completed = operations.filter((operation) => operation.state === "COMPLETED").length;
  const percent = progressPercent(completed, operations.length);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums text-strong">{percent}%</p>
        <p className="text-xs text-muted">{completed}/{operations.length} ขั้นเสร็จแล้ว</p>
      </div>
      <div role="progressbar" aria-label="ความคืบหน้าใบสั่งผลิต" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function IdentityStrip({ workOrder }: { workOrder: WorkOrder }) {
  const openExceptions = workOrder.exceptions.filter((item) => item.state === "OPEN" || item.state === "ACKNOWLEDGED").length;
  return (
    <Section>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <p className="text-xs text-muted">ออเดอร์</p>
          <Link href={`/orders/${workOrder.order.id}`} className="mt-1 inline-flex items-center gap-1 font-semibold text-strong hover:underline">
            {workOrder.order.orderNumber} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <p className="mt-1 text-sm text-secondary">{workOrder.order.customerName}</p>
        </div>
        <div>
          <p className="text-xs text-muted">กำหนดส่ง</p>
          <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-strong">
            <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
            {workOrder.order.deadline ? formatDate(workOrder.order.deadline) : "ยังไม่ระบุ"}
          </p>
          <p className="mt-1 text-xs text-muted">ความสำคัญ {PRIORITY_LABEL[workOrder.order.priority] ?? workOrder.order.priority}</p>
        </div>
        <div>
          <p className="text-xs text-muted">ปัญหาที่ยังไม่จบ</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${openExceptions > 0 ? "text-red-700 dark:text-red-300" : "text-strong"}`}>
            {openExceptions.toLocaleString("th-TH")}
          </p>
          <p className="mt-1 text-xs text-muted">รายการ</p>
        </div>
        <div>
          <p className="text-xs text-muted">ความคืบหน้า</p>
          <div className="mt-1"><ControlProgress operations={workOrder.operations} /></div>
        </div>
      </div>
    </Section>
  );
}

function OperationLedger({
  workOrder,
  stale,
}: {
  workOrder: WorkOrder;
  stale: boolean;
}) {
  const operationsById = new Map(workOrder.operations.map((operation) => [operation.id, operation]));
  const dependenciesBySuccessor = new Map<string, string[]>();
  for (const dependency of workOrder.dependencies) {
    const current = dependenciesBySuccessor.get(dependency.successorStepId) ?? [];
    current.push(dependency.predecessorStepId);
    dependenciesBySuccessor.set(dependency.successorStepId, current);
  }

  return (
    <Section title="เส้นทางการผลิต" meta="สถานะและผลผลิตของทุกขั้น เรียงตามคิวที่หัวหน้ากำหนด" action={<Route className="h-5 w-5 text-muted" aria-hidden />}>
      {workOrder.operations.length === 0 ? (
        <EmptyState density="compact" icon={Route} title="ยังไม่มีเส้นทางการผลิต" description="เลือกเส้นทางก่อนปล่อยใบสั่งผลิต" />
      ) : (
        <ol className="space-y-1">
          {workOrder.operations.map((operation, index) => {
            const status = operationStatusMeta(operation.state);
            const queueNumber = operation.dispatchSequence ?? index + 1;
            const dependencies = (dependenciesBySuccessor.get(operation.id) ?? []).map(
              (id) => operationsById.get(id)?.name ?? "ขั้นงานจากใบผลิตที่เกี่ยวข้อง",
            );
            return (
              <li key={operation.id} className="relative grid gap-3 rounded-lg px-3 py-4 hover:bg-interactive-hover sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold tabular-nums text-secondary" aria-label={`คิวที่ ${queueNumber}`}>{queueNumber}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-semibold text-strong">{operation.name}</h3>
                    <StatusLabel label={status.label} tone={status.tone} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {operation.workCenter?.name ?? "ยังไม่ระบุศูนย์งาน"}
                    {operation.resource ? ` · ${operation.resource.name}` : ""}
                    {operation.assignee ? ` · ${operation.assignee.name}` : " · ยังไม่มอบหมายคน"}
                  </p>
                  {dependencies.length > 0 ? (
                    <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-xs text-secondary">
                      <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                      รับงานต่อจาก: {dependencies.join(", ")}
                    </p>
                  ) : null}
                  {operation.blockers.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {operation.blockers.map((blocker) => (
                        <p
                          key={blocker.id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {blocker.title}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="sm:text-right">
                  <p className="text-sm font-semibold tabular-nums text-strong">
                    {quantitySummary(operation.quantities)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {operation.completedAt
                      ? `จบ ${formatDateTime(operation.completedAt)}`
                      : operation.startedAt
                        ? `เริ่ม ${formatDateTime(operation.startedAt)}`
                        : operation.plannedStartAt
                          ? `วางไว้ ${formatDate(operation.plannedStartAt)}`
                          : "ยังไม่กำหนดเวลา"}
                  </p>
                  <OperationControlActions operation={operation} stale={stale} />
                  <div className="mt-2 flex justify-start sm:justify-end">
                    <CreateOutsourceOrderAction
                      workOrder={workOrder}
                      operation={operation}
                      stale={stale}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

function ReferenceControl({ workOrder }: { workOrder: WorkOrder }) {
  const rows = [
    { label: "เส้นทางและลำดับงาน", present: hasSnapshot(workOrder.routingSnapshot) },
    { label: "คำสั่งการผลิต", present: hasSnapshot(workOrder.instructionSnapshot) },
    { label: "แบบที่อนุมัติ", present: hasSnapshot(workOrder.approvedMockupSnapshot) },
  ];
  return (
    <Section
      title="ข้อมูลอ้างอิงที่ล็อกไว้"
      meta="สำเนาที่ใช้กับใบสั่งผลิตนี้ จะไม่เปลี่ยนตามต้นฉบับภายหลัง"
      action={<ShieldCheck className="h-5 w-5 text-muted" aria-hidden />}
    >
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary">{row.label}</span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${row.present ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}
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
          <dd className="mt-1 font-medium text-secondary">
            {workOrder.releasedAt
              ? formatDateTime(workOrder.releasedAt)
              : "ยังไม่ปล่อยผลิต"}
          </dd>
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

function QuantityLedger({
  lines,
  operations,
}: {
  lines: readonly QuantityLine[];
  operations: readonly Operation[];
}) {
  if (lines.length === 0) {
    return (
      <Section title="จำนวนตามรายการ">
        <EmptyState
          density="compact"
          icon={PackageCheck}
          title="ยังไม่มีรายการจำนวน"
          description="รายการสินค้า สี ไซซ์ และตำแหน่งพิมพ์จะปรากฏเมื่อสร้างใบสั่งผลิต"
        />
      </Section>
    );
  }

  const remainingByOperation = new Map<string, QuantityLine[]>();
  for (const line of lines) {
    const current = remainingByOperation.get(line.productionStepId) ?? [];
    current.push(line);
    remainingByOperation.set(line.productionStepId, current);
  }
  const groups: Array<{
    id: string;
    operation: Operation | null;
    lines: QuantityLine[];
  }> = [];
  for (const operation of operations) {
    const operationLines = remainingByOperation.get(operation.id);
    if (!operationLines?.length) continue;
    remainingByOperation.delete(operation.id);
    groups.push({ id: operation.id, operation, lines: operationLines });
  }
  for (const [operationId, operationLines] of remainingByOperation) {
    groups.push({ id: operationId, operation: null, lines: operationLines });
  }

  return (
    <Section
      title="จำนวนตามขั้นงาน"
      meta="แต่ละกลุ่มเป็นยอดของขั้นงานและศูนย์งานนั้น ไม่ใช่ยอดรวมซ้ำของทั้งใบ"
      flush
    >
      <div className="divide-y divide-divider">
        {groups.map((group) => {
          const headingId = `quantity-operation-${group.id}`;
          return (
            <section key={group.id} aria-labelledby={headingId}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-surface-muted px-4 py-3 sm:px-5">
                <h3 id={headingId} className="font-semibold text-strong">
                  {group.operation?.name ?? "ขั้นงานที่ไม่พบในเส้นทางปัจจุบัน"}
                </h3>
                <p className="text-xs text-muted">
                  ศูนย์งาน: {group.operation?.workCenter?.name ?? "ยังไม่ระบุ"}
                </p>
              </div>
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
                  {group.lines.map((line) => (
                    <DataTable.Row key={line.id}>
                      <DataTable.Td>
                        <p className="font-medium text-strong">
                          {line.description ?? line.sku ?? "รายการผลิต"}
                        </p>
                        {line.sku && line.description ? (
                          <p className="text-xs text-muted">{line.sku}</p>
                        ) : null}
                      </DataTable.Td>
                      <DataTable.Td>
                        {[line.color, line.size].filter(Boolean).join(" / ") || "—"}
                      </DataTable.Td>
                      <DataTable.Td>{line.printPosition ?? "—"}</DataTable.Td>
                      <DataTable.Td align="right" className="tabular-nums">
                        {line.qtyPlanned.toLocaleString("th-TH")}
                      </DataTable.Td>
                      <DataTable.Td
                        align="right"
                        className="font-semibold tabular-nums text-green-700 dark:text-green-300"
                      >
                        {line.qtyGood.toLocaleString("th-TH")}
                      </DataTable.Td>
                      <DataTable.Td
                        align="right"
                        className="tabular-nums text-red-700 dark:text-red-300"
                      >
                        {line.qtyScrap.toLocaleString("th-TH")}
                      </DataTable.Td>
                      <DataTable.Td
                        align="right"
                        className="tabular-nums text-amber-700 dark:text-amber-300"
                      >
                        {line.qtyRework.toLocaleString("th-TH")}
                      </DataTable.Td>
                    </DataTable.Row>
                  ))}
                </DataTable.Body>
              </DataTable.Root>
            </section>
          );
        })}
      </div>
    </Section>
  );
}

function ExceptionLedger({
  workOrder,
  exceptions,
  operationsById,
  operationNames,
  centers,
  centersState,
  stale,
}: {
  workOrder: WorkOrder;
  exceptions: readonly ProductionException[];
  operationsById: Map<string, Operation>;
  operationNames: Map<string, string>;
  centers: RouterOutput["manufacturing"]["workCenterLoad"];
  centersState: "loading" | "ready" | "error";
  stale: boolean;
}) {
  if (exceptions.length === 0) {
    return (
      <Section title="ปัญหาและข้อยกเว้น">
        <EmptyState
          density="compact"
          icon={ClipboardCheck}
          title="ไม่มีปัญหาที่บันทึกไว้"
          description="เมื่อหน้างานแจ้งปัญหา รายการจะอยู่ที่นี่พร้อมสถานะการแก้ไข"
        />
      </Section>
    );
  }
  return (
    <Section
      title="ปัญหาและข้อยกเว้น"
      meta="ติดตามปัญหา แนวทางจัดการ และผลการแก้ไข"
    >
      <ul className="space-y-3">
        {exceptions.map((item) => {
          const severity = exceptionSeverityMeta(item.severity);
          const state = exceptionStatusMeta(item.state);
          const disposition = dispositionLabel(item.disposition);
          const operation = item.productionStepId
            ? operationsById.get(item.productionStepId)
            : undefined;
          const canPlanRework = (
            item.availableCommands as readonly string[]
          ).includes("planRework");
          const reworkCentersUnavailable =
            canPlanRework && centersState !== "ready";
          return (
            <li key={item.id} className="rounded-lg bg-surface-muted p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusLabel label={severity.label} tone={severity.tone} />
                    <StatusLabel label={state.label} tone={state.tone} />
                  </div>
                  <h3 className="mt-2 font-semibold text-strong">{item.title}</h3>
                  {item.description ? (
                    <p className="mt-1 text-sm text-secondary">{item.description}</p>
                  ) : null}
                </div>
                <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted">ขั้นงาน</dt>
                  <dd className="mt-0.5 text-secondary">
                    {item.productionStepId
                      ? operationNames.get(item.productionStepId) ?? "งานที่เกี่ยวข้อง"
                      : "ทั้งใบสั่งผลิต"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">ผู้รับผิดชอบ</dt>
                  <dd className="mt-0.5 text-secondary">
                    {item.ownerId ? "มอบหมายแล้ว" : "ยังไม่ได้มอบหมาย"}
                  </dd>
                </div>
                {disposition ? (
                  <div>
                    <dt className="text-muted">แนวทาง</dt>
                    <dd className="mt-0.5 text-secondary">{disposition}</dd>
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
                <DecideQcDispositionAction
                  workOrder={workOrder}
                  exception={item}
                  stale={stale}
                />
                {operation && reworkCentersUnavailable ? (
                  <div className="flex flex-col items-end gap-1">
                    <Button variant="outline" size="sm" disabled>
                      <RotateCcw />
                      {centersState === "loading"
                        ? "กำลังโหลดศูนย์งาน…"
                        : "กำหนดศูนย์งานแก้"}
                    </Button>
                    <p className="max-w-xs text-right text-xs text-amber-700 dark:text-amber-300">
                      {centersState === "loading"
                        ? "รอข้อมูลศูนย์งานก่อนวางแผนงานแก้"
                        : "โหลดศูนย์งานไม่สำเร็จ กดลองใหม่ด้านบนก่อนวางแผนงานแก้"}
                    </p>
                  </div>
                ) : operation ? (
                  <PlanReworkAction
                    workOrder={workOrder}
                    operation={operation}
                    exception={item}
                    centers={centers}
                    stale={stale}
                  />
                ) : null}
                <ResolveExceptionAction exception={item} stale={stale} />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ReworkLedger({
  cases,
  centerNames,
  operationNames,
  stale,
}: {
  cases: readonly ReworkCase[];
  centerNames: Map<string, string>;
  operationNames: Map<string, string>;
  stale: boolean;
}) {
  if (cases.length === 0) return null;
  return (
    <Section
      title="งานส่งแก้"
      meta="ทุกชิ้นที่ส่งแก้ต้องกลับมาตรวจซ้ำก่อนนับเป็นงานดี"
      action={<RotateCcw className="h-5 w-5 text-muted" aria-hidden />}
    >
      <ul className="space-y-3">
        {cases.map((item) => {
          const state = reworkStatusMeta(item.state);
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <StatusLabel label={state.label} tone={state.tone} />
                <p className="mt-2 font-medium text-strong">{item.reason}</p>
                <p className="mt-1 text-xs text-muted">
                  จาก{" "}
                  {item.sourceOperationId
                    ? operationNames.get(item.sourceOperationId) ?? "ขั้นงานเดิม"
                    : "ผลตรวจคุณภาพ"}{" "}
                  → {centerNames.get(item.targetWorkCenterId) ?? "ศูนย์งานที่กำหนด"}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-lg font-semibold tabular-nums text-strong">
                  {item.qty.toLocaleString("th-TH")} ชิ้น
                </p>
                <p className="text-xs text-muted">
                  {item.requiresReinspection ? "ต้องตรวจซ้ำ" : "ไม่ต้องตรวจซ้ำ"}
                </p>
                <div className="mt-3">
                  <ReleaseReworkAction rework={item} stale={stale} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function EventLedger({
  events,
  operationNames,
}: {
  events: readonly OperationEvent[];
  operationNames: Map<string, string>;
}) {
  if (events.length === 0) {
    return (
      <Section title="ประวัติการทำงาน">
        <EmptyState density="compact" icon={History} title="ยังไม่มีประวัติ" />
      </Section>
    );
  }
  return (
    <Section
      title="ประวัติการทำงาน"
      meta="บันทึกย้อนหลังที่เพิ่มต่อเนื่องและไม่แก้ทับ"
    >
      <ol className="space-y-4">
        {events.map((event) => {
          const hasQty =
            event.qtyGoodDelta !== 0 ||
            event.qtyScrapDelta !== 0 ||
            event.qtyReworkDelta !== 0;
          return (
            <li key={event.id} className="flex gap-3">
              <div
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-strong">
                    {operationEventLabel(event.eventType)}
                  </p>
                  <time
                    className="text-xs text-muted"
                    dateTime={new Date(event.occurredAt).toISOString()}
                  >
                    {formatDateTime(event.occurredAt)}
                  </time>
                </div>
                {event.productionStepId ? (
                  <p className="mt-0.5 text-xs text-muted">
                    {operationNames.get(event.productionStepId) ?? "ขั้นงานที่เกี่ยวข้อง"}
                  </p>
                ) : null}
                {hasQty ? (
                  <p className="mt-1 text-xs text-secondary">
                    งานดี +{event.qtyGoodDelta} · เสีย +{event.qtyScrapDelta} · ส่งแก้ +
                    {event.qtyReworkDelta}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function ProductionV2ControlRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const confirm = useConfirm();
  const utils = trpc.useUtils();
  const query = trpc.manufacturing.workOrder.useQuery(
    { workOrderId: id },
    {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const centersQuery = trpc.manufacturing.workCenterLoad.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const release = useMutationWithInvalidation(trpc.manufacturing.releaseWorkOrder, {
    invalidate: [
      utils.manufacturing.workOrder,
      utils.manufacturing.controlList,
      utils.manufacturing.workCenterLoad,
    ],
    onSuccess: () => toast.success("ปล่อยใบสั่งผลิตแล้ว"),
  });
  const workOrder = query.data;
  const status = workOrder ? workOrderStatusMeta(workOrder.state) : null;
  const operationNames = useMemo(
    () =>
      new Map(
        (workOrder?.operations ?? []).map((operation) => [
          operation.id,
          operation.name,
        ]),
      ),
    [workOrder],
  );
  const operationsById = useMemo(
    () =>
      new Map(
        (workOrder?.operations ?? []).map((operation) => [operation.id, operation]),
      ),
    [workOrder],
  );
  const centerNames = useMemo(
    () =>
      new Map(
        (centersQuery.data ?? []).map((center) => [
          center.workCenter.id,
          center.workCenter.name,
        ]),
      ),
    [centersQuery.data],
  );
  const centersState = centersQuery.isError
    ? "error"
    : centersQuery.isLoading && !centersQuery.data
      ? "loading"
      : "ready";
  const stale = query.isError && Boolean(workOrder);
  const notFound = query.error?.data?.code === "NOT_FOUND";
  const canRelease = Boolean(
    workOrder &&
      (workOrder.availableCommands as readonly string[]).includes("releaseWorkOrder"),
  );

  async function releaseWorkOrder() {
    if (!workOrder || !canRelease) return;
    const accepted = await confirm({
      title: "ปล่อยใบสั่งผลิตนี้?",
      description: "ระบบจะเก็บเส้นทาง คำสั่ง และแบบอนุมัติชุดนี้ไว้กับใบสั่งผลิต หลังปล่อยแล้วจะย้อนกลับเป็นร่างไม่ได้",
      confirmText: "ปล่อยผลิต",
    });
    if (!accepted) return;
    release.mutate({
      workOrderId: workOrder.id,
      commandId: crypto.randomUUID(),
      expectedRevision: workOrder.revision,
    });
  }

  return (
    <PageShell
      title={workOrder?.workOrderNumber ?? "ใบสั่งผลิต"}
      description={
        workOrder
          ? `${workOrder.order.orderNumber} · ${workOrder.order.customerName}`
          : "ข้อมูลควบคุมการผลิต"
      }
      back={{ href: "/production", label: "กลับไปรายการผลิต" }}
      titleBadge={
        status ? <StatusLabel label={status.label} tone={status.tone} /> : undefined
      }
      action={
        workOrder ? (
          <>
            <Button asChild variant="outline">
              <Link href={`/orders/${workOrder.order.id}`}>
                เปิดออเดอร์ <ExternalLink />
              </Link>
            </Button>
            {canRelease ? (
              <Button
                onClick={() => void releaseWorkOrder()}
                disabled={release.isPending || stale}
              >
                <Play /> {release.isPending ? "กำลังปล่อย…" : "ปล่อยผลิต"}
              </Button>
            ) : null}
          </>
        ) : undefined
      }
      loading={query.isLoading && !workOrder}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-lg" />
          <ListPageSkeleton />
        </div>
      }
      error={
        query.isError && !workOrder && !notFound
          ? {
              message: "โหลดใบสั่งผลิตไม่สำเร็จ",
              onRetry: () => query.refetch(),
            }
          : null
      }
    >
      {notFound ? (
        <RecordNotFound
          what="ใบสั่งผลิตนี้"
          backHref="/production"
          backLabel="กลับไปรายการผลิต"
        />
      ) : workOrder ? (
        <div className="space-y-5">
          <div className="flex justify-end">
            <ProductionFreshness
              updatedAt={oldestSuccessfulUpdate(
                query.dataUpdatedAt,
                centersQuery.dataUpdatedAt,
              )}
              isFetching={
                (query.isFetching && !query.isLoading) ||
                (centersQuery.isFetching && !centersQuery.isLoading)
              }
              stale={stale || (centersQuery.isError && Boolean(centersQuery.data))}
            />
          </div>
          {stale ? (
            <Alert variant="warning" title="ข้อมูลล่าสุดอาจยังไม่ครบ">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  กำลังแสดงข้อมูลที่โหลดไว้ ปิดการแก้ไขชั่วคราวจนกว่าจะเชื่อมต่อได้
                </span>
                <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
                  ลองใหม่
                </Button>
              </span>
            </Alert>
          ) : null}
          {centersQuery.isError ? (
            <Alert variant="warning" title="โหลดศูนย์งานไม่สำเร็จ">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  ดูข้อมูลใบผลิตต่อได้ แต่การวางแผนงานแก้ถูกปิดไว้จนกว่าจะโหลดศูนย์งานสำเร็จ
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void centersQuery.refetch()}
                  disabled={centersQuery.isFetching}
                >
                  {centersQuery.isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
                </Button>
              </span>
            </Alert>
          ) : null}
          {workOrder.state === "DRAFT" && workOrder.releaseBlockers.length > 0 ? (
            <Alert variant="warning" title="ยังปล่อยผลิตไม่ได้">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {workOrder.releaseBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <IdentityStrip workOrder={workOrder} />
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <OperationLedger
              workOrder={workOrder}
              stale={stale}
            />
            <ReferenceControl workOrder={workOrder} />
          </div>
          <QuantityLedger
            lines={workOrder.quantityLines}
            operations={workOrder.operations}
          />
          <ExceptionLedger
            workOrder={workOrder}
            exceptions={workOrder.exceptions}
            operationsById={operationsById}
            operationNames={operationNames}
            centers={centersQuery.data ?? []}
            centersState={centersState}
            stale={stale}
          />
          <ReworkLedger
            cases={workOrder.reworkCases}
            centerNames={centerNames}
            operationNames={operationNames}
            stale={stale}
          />
          <EventLedger events={workOrder.events} operationNames={operationNames} />
        </div>
      ) : null}
    </PageShell>
  );
}
