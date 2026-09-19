"use client";

/** การ์ดคอลัมน์ขวาและแท็บประวัติของใบผลิต — เช็คลิสต์ · ข้อมูลออเดอร์ · ประวัติขั้นงาน */

import type { ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, History, ListChecks, ReceiptText, StickyNote, UserRound } from "lucide-react";

import { c, CardHead, Callout, DueTag, Prop } from "@/components/kit/kit";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { currentProductionProblemReason, latestPlainProductionNote } from "@/lib/production-problem";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import { formatDateTime } from "@/lib/utils";
import { workOrderStandards } from "@/lib/work-order-standards";
import { checklistAnchor, ticksMissing } from "./work-order-anchors";
import { daysFromNow, stepLabel } from "./work-order-pieces";
import type { WorkOrderController } from "./work-order-controller";

type Order = ProductionDetail["order"];

export function ChecklistCard({ step, ctl, assign }: { step: ProductionStep; ctl: WorkOrderController; assign: ReactNode }) {
  const standards = workOrderStandards(step.stepType);
  const done = step.status === "COMPLETED";
  const halted = step.status === "FAILED" || step.status === "ON_HOLD";
  const ticked = new Map(step.checks.map((check) => [check.itemKey, check.checkedBy.name]));
  const checkedCount = standards.filter((label) => ticked.has(label)).length;
  const missing = done || halted ? 0 : ticksMissing(step);
  const canTick = ctl.canUpdateStep && ctl.canOwnOrSupervise(step) && !done && !halted;
  const owner = step.assignedTo?.name ?? null;
  return (
    <section className={c("card")} aria-labelledby={`ck-${step.id}`} id={checklistAnchor(step.id)}>
      <CardHead
        icon={ListChecks}
        id={`ck-${step.id}`}
        title="เช็คลิสต์"
        right={
          // ขั้นที่ปิดแล้วบอกตามหลักฐานที่จดไว้จริง ไม่เติมให้เองว่า "ครบ"
          done ? (
            <span className={c("chip gray")}>
              บันทึกไว้ {checkedCount}/{standards.length} ข้อ
            </span>
          ) : missing > 0 ? (
            <span className={c("chip warn")}>ติ๊กอีก {missing} ข้อ</span>
          ) : standards.length > 0 && !halted ? (
            <span className={c("chip good")}>
              <Check aria-hidden="true" />
              ครบ
            </span>
          ) : null
        }
      />
      <div className={c("cb")}>
        <div className={c("whorow")}>
          <span className={c("av")} aria-hidden="true">
            {owner ? owner.replace(/^[เแโใไ]/, "").slice(0, 1) : <UserRound />}
          </span>
          <span className={c("tx")}>
            <small>ผู้ทำ</small>
            <b>{owner ?? "ยังไม่มีคนรับ"}</b>
          </span>
          {assign}
        </div>
        {standards.length > 0 ? (
          <ul className={c("checks")}>
            {standards.map((label, index) => {
              const on = ticked.has(label);
              const id = `ck-${step.id}-${index}`;
              return (
                <li key={label} className={c(on ? "on" : "miss")}>
                  <label htmlFor={id}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={on}
                      disabled={!canTick || ctl.tickPending}
                      onChange={(event) => ctl.tickStandard(step.id, label, event.target.checked)}
                    />
                    <span className={c("tx")} title={on ? `ติ๊กโดย ${ticked.get(label)}` : undefined}>
                      {label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export function OrderInfoCard({ order, production, ctl }: { order: Order; production: ProductionDetail; ctl: WorkOrderController }) {
  const approved = order.designs[0] ?? null;
  const note = production.notes ? latestPlainProductionNote(production.notes) : null;
  return (
    <section className={c("card")} aria-labelledby="wo-order-h">
      <CardHead icon={ReceiptText} id="wo-order-h" title="ข้อมูลออเดอร์" />
      <div className={c("cb")}>
        <div className={c("oprops")}>
          <Link href={`/orders/${order.id}`} className={c("preview")}>
            <span className={c("tx")}>
              <b>{order.customer?.name ?? "ไม่ระบุลูกค้า"}</b>
            </span>
            <span className={c("go")}>
              เปิด
              <ChevronRight aria-hidden="true" />
            </span>
          </Link>
          <dl className={c("props")}>
            <Prop label="กำหนดส่ง">
              <DueTag status={order.internalStatus} deadline={order.deadline} dueInDays={daysFromNow(order.deadline, ctl.nowMs)} small={false} />
            </Prop>
            <Prop label="จำนวนทั้งใบ">{ctl.totalQty.toLocaleString("th-TH")} ตัว</Prop>
            <Prop label="ม็อกอัพอนุมัติ" none={!approved}>
              {approved ? `v${approved.versionNumber}` : "ยังไม่มี"}
            </Prop>
            <Prop label="สถานะออเดอร์">{INTERNAL_STATUS_LABELS[order.internalStatus] ?? order.internalStatus}</Prop>
          </dl>
          {note ? (
            <Callout icon={StickyNote} role="note">
              {note}
            </Callout>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type HistoryEvent = { key: string; tone: "good" | "blue" | "bad"; title: string; sub: string; at: Date; meta: string | null };

function durationText(from: Date | string | null | undefined, to: Date | string | null | undefined): string | null {
  if (!from || !to) return null;
  const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  if (hours < 24) return `${hours < 1 ? hours.toFixed(1) : Math.round(hours * 10) / 10} ชม.`;
  return `${Math.round(hours / 24)} วัน`;
}

export function historyOf(steps: readonly ProductionStep[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (const step of steps) {
    const who = step.assignedTo?.name;
    if (step.completedAt) {
      events.push({
        key: `${step.id}-done`,
        tone: "good",
        title: stepLabel(step),
        sub: who ? `ปิดโดย ${who}` : "ปิดขั้นแล้ว",
        at: new Date(step.completedAt),
        meta: durationText(step.startedAt, step.completedAt),
      });
    } else if (step.status === "FAILED" || step.status === "ON_HOLD") {
      events.push({
        key: `${step.id}-problem`,
        tone: "bad",
        title: `${stepLabel(step)} · ${STEP_STATUS_LABELS[step.status === "FAILED" ? "FAILED" : "ON_HOLD"]}`,
        sub: currentProductionProblemReason(step) ?? (who ? `ผู้ทำ ${who}` : ""),
        at: new Date(step.startedAt ?? Date.now()),
        meta: null,
      });
    } else if (step.startedAt) {
      events.push({
        key: `${step.id}-start`,
        tone: "blue",
        title: `${stepLabel(step)} · เริ่มทำ`,
        sub: who ? `โดย ${who}` : "",
        at: new Date(step.startedAt),
        meta: null,
      });
    }
    for (const outsource of step.outsourceOrders) {
      if (!outsource.sentAt) continue;
      events.push({
        key: `${outsource.id}-sent`,
        tone: "blue",
        title: `${stepLabel(step)} · ส่ง${outsource.vendor.name}`,
        sub: `${outsource.quantity.toLocaleString("th-TH")} ตัว`,
        at: new Date(outsource.sentAt),
        meta: null,
      });
    }
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function HistoryCard({ steps }: { steps: readonly ProductionStep[] }) {
  const events = historyOf(steps);
  return (
    <section className={c("card")} aria-labelledby="wo-hist-h">
      <CardHead icon={History} id="wo-hist-h" title="ประวัติขั้นงาน" />
      <div className={c("cb")}>
        {events.length === 0 ? <p className={c("mempty")}>ยังไม่มีขั้นที่เริ่มทำ</p> : null}
        <ol className={c("hist")}>
          {events.map((event) => (
            <li key={event.key}>
              <span className={c("d", event.tone)} aria-hidden="true" />
              <span className={c("tx")}>
                {event.title}
                {event.sub ? <small>{event.sub}</small> : null}
              </span>
              <span className={c("m")}>
                {event.meta ? <b>{event.meta}</b> : null}
                {formatDateTime(event.at)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
