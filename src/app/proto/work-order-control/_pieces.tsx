"use client";

/* ชิ้นส่วนที่ทุกแบบใช้ร่วมกัน — หัวใบงาน · แถวขั้นงาน · ช่องกรอกจำนวนแยกสี/ไซซ์
   ใช้ component จริงของเว็บทั้งหมด (Section · DataTable · StatusLabel · Button · Badge) */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { StatusLabel } from "@/components/ui/status-label";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { AlertTriangle, CirclePause, Lock, Truck } from "lucide-react";

import {
  PROTO_WORK_ORDER,
  STATE_LABELS,
  STATE_TONES,
  primaryAction,
  progressOf,
  quantityTotals,
  type ProtoOperation,
} from "./_data";

/* ------------------------------------------------------------- หัวใบงาน */

export function WorkOrderHeader() {
  const { done, total } = progressOf(PROTO_WORK_ORDER.operations);
  return (
    <Section>
      <div className="flex flex-wrap items-start gap-4">
        <MockupThumbnail cover={PROTO_WORK_ORDER.mockupUrl} alt="ม็อกอัพงาน" size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tabular-nums text-strong">
              {PROTO_WORK_ORDER.workOrderNumber}
            </h2>
            {PROTO_WORK_ORDER.priority === "URGENT" ? (
              <Badge variant="destructive" size="sm">ด่วน</Badge>
            ) : null}
            <Badge variant="secondary" size="sm">{PROTO_WORK_ORDER.state}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-secondary">
            {PROTO_WORK_ORDER.orderNumber} · {PROTO_WORK_ORDER.customerName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            กำหนดส่ง {PROTO_WORK_ORDER.deadline} ·{" "}
            {PROTO_WORK_ORDER.totalQuantity.toLocaleString("th-TH")} ตัว · ผ่านแล้ว {done}/{total} ขั้น
          </p>
        </div>
      </div>
    </Section>
  );
}

/* --------------------------------------------------- ป้ายสถานะของขั้นงาน */

export function OperationStatus({ operation }: { operation: ProtoOperation }) {
  const waiting =
    operation.state === "PLANNED" && operation.waitsFor.length > 0
      ? `รอ ${operation.waitsFor.length} ขั้นก่อนหน้า`
      : null;
  return (
    <StatusLabel
      label={STATE_LABELS[operation.state]}
      tone={STATE_TONES[operation.state]}
      sub={operation.problem ?? waiting ?? undefined}
    />
  );
}

export function OperationMeta({ operation }: { operation: ProtoOperation }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
      <span>{operation.workCenter}</span>
      {operation.outsourced ? (
        <span className="inline-flex items-center gap-1 text-secondary">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          ส่งร้านนอก
        </span>
      ) : null}
      <span>{operation.assignee ? `ผู้รับผิดชอบ ${operation.assignee}` : "ยังไม่มีผู้รับผิดชอบ"}</span>
    </span>
  );
}

/* ------------------------------------------- ช่องกรอกจำนวนแยกสี/ไซซ์ */

export function QuantityGrid({
  operation,
  compact = false,
}: {
  operation: ProtoOperation;
  compact?: boolean;
}) {
  if (operation.quantities.length === 0) {
    return (
      <p className="text-xs text-muted">
        ขั้นนี้ไม่ต้องนับชิ้น — กดปิดขั้นเมื่อทำเสร็จ
      </p>
    );
  }
  const totals = quantityTotals(operation);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-secondary">
          บันทึกจำนวนแยกตามสี/ไซซ์ <span className="text-muted">(ระบบบังคับ ไม่รับยอดรวม)</span>
        </span>
        <span className="tabular-nums text-muted">
          ทำแล้ว {totals.good}/{totals.planned} · เหลือ {totals.remaining}
        </span>
      </div>
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        {operation.quantities.map((line) => {
          const remaining = line.planned - line.good;
          return (
            <div
              key={line.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border px-3 py-2",
                remaining === 0 && "opacity-55",
              )}
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
                defaultValue={remaining > 0 ? String(remaining) : ""}
                placeholder="0"
                aria-label={`จำนวนที่ทำได้ ${line.color} ไซซ์ ${line.size}`}
                disabled={remaining === 0}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------- ปุ่มลงมือของขั้นงาน */

export function OperationActions({
  operation,
  size = "sm",
  full = false,
}: {
  operation: ProtoOperation;
  size?: "sm" | "lg";
  full?: boolean;
}) {
  const primary = primaryAction(operation);

  if (operation.state === "COMPLETED") {
    return <span className="text-xs text-muted">ปิดแล้ว</span>;
  }
  if (operation.state === "PLANNED") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        ยังไม่ถึงคิว
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", full && "w-full")}>
      {primary ? (
        <Button
          size={size === "lg" ? "lg" : "sm"}
          className={cn(size === "lg" && "min-h-14 flex-1 text-base")}
        >
          {primary}
        </Button>
      ) : null}
      {operation.state === "RUNNING" ? (
        <Button variant="outline" size={size === "lg" ? "default" : "sm"}>
          <CirclePause />
          พักงาน
        </Button>
      ) : null}
      <Button variant="outline" size={size === "lg" ? "default" : "sm"}>
        <AlertTriangle />
        แจ้งปัญหา
      </Button>
    </div>
  );
}

/* ----------------------------------------------- ตารางขั้นงาน (ของเดิม) */

export function OperationTable({
  onSelect,
  selectedId,
  withActions = false,
}: {
  onSelect?: (operation: ProtoOperation) => void;
  selectedId?: string | null;
  withActions?: boolean;
}) {
  return (
    <>
      {/* จอแคบ (จอทัชหน้างาน/มือถือ) เป็นการ์ด — ตารางสี่คอลัมน์บีบแล้วอ่านไม่ออก
          กติกาเดียวกับหน้ารายการอื่นของเว็บที่ใช้ ResponsiveList */}
      <ul className="space-y-2 lg:hidden">
        {PROTO_WORK_ORDER.operations.map((operation) => {
          const totals = quantityTotals(operation);
          const selected = selectedId === operation.id;
          return (
            <li key={operation.id}>
              {/* การ์ดเป็น div ไม่ใช่ button — ข้างในมีปุ่มลงมืออยู่แล้ว ปุ่มซ้อนปุ่มเป็น HTML ที่ผิด
                  ส่วนที่กดเพื่อ "เลือกขั้น" จึงเป็นปุ่มเฉพาะหัวการ์ด */}
              <div
                className={cn(
                  "card-surface rounded-2xl p-3",
                  selected && "ring-2 ring-blue-600 dark:ring-blue-400",
                )}
              >
                <button
                  type="button"
                  onClick={onSelect ? () => onSelect(operation) : undefined}
                  disabled={!onSelect}
                  className={cn(
                    "block w-full text-left",
                    onSelect ? FOCUS_BUTTON : "cursor-default",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-strong">{operation.name}</span>
                      <OperationMeta operation={operation} />
                    </span>
                    {totals.planned > 0 ? (
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {totals.good}/{totals.planned}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2 block">
                    <OperationStatus operation={operation} />
                  </span>
                </button>
                {withActions ? (
                  <div className="mt-3 border-t border-divider pt-3">
                    <OperationActions operation={operation} />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden lg:block">
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ขั้นงาน</DataTable.Th>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.Th align="right">จำนวน</DataTable.Th>
          {withActions ? <DataTable.Th>ลงมือ</DataTable.Th> : null}
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {PROTO_WORK_ORDER.operations.map((operation) => {
          const totals = quantityTotals(operation);
          const selected = selectedId === operation.id;
          return (
            <DataTable.Row
              key={operation.id}
              onClick={onSelect ? () => onSelect(operation) : undefined}
              className={cn(selected && "bg-interactive-pressed")}
            >
              <DataTable.Td className="min-w-52">
                <span className="block text-sm font-medium text-strong">{operation.name}</span>
                <OperationMeta operation={operation} />
              </DataTable.Td>
              <DataTable.Td className="min-w-40">
                <OperationStatus operation={operation} />
              </DataTable.Td>
              <DataTable.Td align="right" className="tabular-nums">
                {totals.planned > 0 ? (
                  <span className="text-sm text-secondary">
                    {totals.good}/{totals.planned}
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </DataTable.Td>
              {withActions ? (
                <DataTable.Td className="min-w-56">
                  <OperationActions operation={operation} />
                </DataTable.Td>
              ) : null}
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
      </div>
    </>
  );
}
