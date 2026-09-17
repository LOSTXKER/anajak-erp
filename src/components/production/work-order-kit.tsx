"use client";

/**
 * /production/[id] บนชุดหน้าตากลาง — ต้นแบบ mockup-production-calm-2026-09-15 (เบสสั่งลงจริง 2026-09-16)
 *
 * แถบแจ้งเตือนทุกชนิดอยู่บนสุด · หัวใบ (รูปม็อกอัพ เลขใบ ความสำคัญ | ใบสั่งงาน · ถัดไป · ⋯) · เส้นงานไม่มีกรอบ/คำใต้ขั้น
 * แท็บ ขั้นตอน = การ์ดขั้น (ลายคู่ตำแหน่ง + ยอดต่อไซซ์ + ปุ่มของขั้นท้ายการ์ด) | เช็คลิสต์ · ข้อมูลออเดอร์ · แท็บ ประวัติขั้นงาน (เบสขอแยกแท็บ 09-16)
 * แท็บ สินค้า = สินค้า/ไซซ์ + ลายพร้อมรูป · ม็อกอัพอนุมัติ · วัตถุดิบ (ของเดิม)
 *
 * กติกาทั้งหมดมาจาก useWorkOrderController ชุดเดิม (ปุ่มลงมือ ติ๊ก ยอด ย้อนขั้น พัก ส่ง QC) — ไม่มีทางลัดสถานะใหม่
 * ขั้นพิมพ์ DTF ปิดจากหน้า "พิมพ์ DTF" (กดพิมพ์เสร็จหลายใบพร้อมกัน) ตามความจริงหน้าเครื่องที่เบสตอบ 09-16
 */

import { Suspense, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Ellipsis,
  Flag,
  Flame,
  History,
  ImageOff,
  ListChecks,
  Pause,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Send,
  Undo2,
  Shirt,
  StickyNote,
  TriangleAlert,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { c, CardHead, Callout, DueTag, PriorityChip, Prop, Thumb } from "@/components/kit/kit";
import { KitTabs } from "@/components/kit/tabs";
import { MaterialUsage } from "@/components/material-usage";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { GarmentReceiveInline } from "@/components/production/garment-receive-inline";
import { printTypesForProductionStep } from "@/components/production/production-design-card";
import { ProblemDialog } from "@/components/production/step-command-dialogs";
import { stationHeatLabel } from "@/components/factory/station-garment-preview";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { orderMockupCover } from "@/lib/mockup";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import { permAllows } from "@/lib/permissions";
import { currentProductionProblemReason, latestPlainProductionNote } from "@/lib/production-problem";
import { FLOW_OWNED_STEP_TYPES, isOutsourceStep } from "@/lib/production-steps";
import { formatDateShort, formatDateTime, isImageUrl } from "@/lib/utils";
import { currentRailNode, railNodesOf } from "@/lib/work-order-rail";
import { routeWaitingOn } from "@/lib/work-order-route";
import { workOrderStandards } from "@/lib/work-order-standards";
import { PRINT_POSITIONS, PRINT_TYPES, PRODUCT_TYPES } from "@/types/order-form";
import { useWorkOrderController, type WorkOrderController } from "./work-order-controller";
import { checklistAnchor, ticksMissing } from "./work-order-checklist";
import { activeOutsource, daysFromNow, dtfUnavailableReason, outsourceReceiptCandidates, outsourceStepReason, stepLabel, viewOf } from "./work-order-pieces";
import { pieceRowsOf, pieceTableAnchor } from "./work-order-quantities";

export const DTF_PAGE_HREF = "/production/print-runs";

type Order = ProductionDetail["order"];

function focusFirst(anchor: string, selector: string) {
  const el = document.querySelector<HTMLElement>(`#${anchor} ${selector}`) ?? document.getElementById(anchor);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus?.();
}

/** ปุ่ม "ถัดไป" พาไปสิ่งที่ต้องทำก่อน: ติ๊กที่ยังว่าง → ช่องยอดแถวแรก → การ์ดของขั้น */
function focusWhatIsBlocking(stepId: string) {
  const el =
    document.querySelector<HTMLElement>(`#${checklistAnchor(stepId)} input[type=checkbox]:not(:checked)`) ??
    document.querySelector<HTMLElement>(`#${pieceTableAnchor(stepId)} input`) ??
    document.getElementById(pieceTableAnchor(stepId)) ??
    document.getElementById(checklistAnchor(stepId));
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus?.();
}

const CHIP_TONE = { success: "good", info: "blue", warning: "warn", error: "bad", neutral: "gray" } as const;

function stepIcon(step: ProductionStep): LucideIcon {
  if (activeOutsource(step) || isOutsourceStep(step.stepType)) return Truck;
  if (step.stepType === "HEAT_PRESS") return Flame;
  if (step.stepType === "DTF_PRINT") return Printer;
  if (step.stepType === "GARMENT_PICK" || step.stepType === "GARMENT_RECEIVE") return Shirt;
  return Wrench;
}

function durationText(from: Date | string | null | undefined, to: Date | string | null | undefined): string | null {
  if (!from || !to) return null;
  const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  if (hours < 24) return `${hours < 1 ? hours.toFixed(1) : Math.round(hours * 10) / 10} ชม.`;
  return `${Math.round(hours / 24)} วัน`;
}

/* ───────────────────────── ลายที่ต้องทำ (รูปลาย + ตำแหน่ง + ขนาด) ───────────────────────── */

type ArtLine = { key: string; image: string | null; tech: string; position: string; size: string | null; note: string | null; qty: number };

function artLinesOf(order: Order, stepType?: string): ArtLine[] {
  const allowed = printTypesForProductionStep(stepType);
  if (allowed && allowed.length === 0) return [];
  const lines = new Map<string, ArtLine>();
  for (const item of order.items) {
    const itemQty = item.products.reduce((sum, product) => sum + (product.totalQuantity ?? 0), 0);
    for (const print of item.prints) {
      if (allowed && !allowed.includes(print.printType)) continue;
      const image = [print.artwork?.imageUrl, print.designImageUrl].find((url) => isImageUrl(url)) ?? null;
      const size =
        print.width && print.height ? `${print.width} × ${print.height} ซม.` : print.printSize && print.printSize !== "CUSTOM" ? print.printSize : null;
      const heat = stationHeatLabel(
        print.artwork
          ? { tempC: print.artwork.heatTempC, pressSec: print.artwork.heatPressSec, pressure: print.artwork.heatPressure }
          : null,
      );
      const note = [print.designNote?.trim() || null, stepType === "HEAT_PRESS" ? heat : null].filter(Boolean).join(" · ") || null;
      const key = `${print.position}|${print.printType}|${image ?? ""}|${size ?? ""}`;
      const existing = lines.get(key);
      if (existing) existing.qty += itemQty;
      else
        lines.set(key, {
          key,
          image,
          tech: PRINT_TYPES[print.printType] ?? print.printType,
          position: PRINT_POSITIONS[print.position] ?? print.position,
          size,
          note,
          qty: itemQty,
        });
    }
  }
  return [...lines.values()];
}

function ArtList({ lines, withQty = false }: { lines: ArtLine[]; withQty?: boolean }) {
  if (lines.length === 0) return null;
  return (
    <ul className={c("arts", withQty && "one")} aria-label="ลายและตำแหน่ง">
      {lines.map((line) => (
        <li key={line.key}>
          {line.image ? (
            <a href={line.image} target="_blank" rel="noreferrer" className={c("aimg")} aria-label={`ดูลาย${line.position}เต็มจอ`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- รูปลายจากคลัง/ไฟล์ที่อัปโหลด */}
              <img src={line.image} alt="" loading="lazy" decoding="async" />
            </a>
          ) : (
            <span className={c("aimg")} aria-hidden="true">
              <ImageOff />
            </span>
          )}
          <span className={c("atx")}>
            <span className={c("at")}>
              <b>{line.tech}</b>
              <span className={c("chip gray")}>{line.position}</span>
            </span>
            {line.size ? <span className={c("asz")}>{line.size}</span> : null}
            {line.note ? <small>{line.note}</small> : null}
          </span>
          {withQty ? <span className={c("aq")}>{line.qty.toLocaleString("th-TH")} ตัว</span> : null}
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── ตารางยอดต่อไซซ์ ───────────────────────── */

type RowQty = { done: number; waste: number };

function PieceTable({ step, order, c: ctl }: { step: ProductionStep; order: Order; c: WorkOrderController }) {
  const rows = pieceRowsOf(order);
  const counting = step.qtyTotal !== null && step.qtyTotal > 0;
  const editable =
    counting &&
    ctl.canUpdateStep &&
    ctl.canOwnOrSupervise(step) &&
    step.status !== "COMPLETED" &&
    step.status !== "FAILED" &&
    !FLOW_OWNED_STEP_TYPES.has(step.stepType) &&
    !activeOutsource(step);
  const saved = useMemo(() => {
    const map: Record<string, RowQty> = {};
    for (const q of step.quantities) if (q.sourceOrderItemVariantId) map[q.sourceOrderItemVariantId] = { done: q.qtyGood, waste: q.qtyScrap };
    return map;
  }, [step.quantities]);
  const [draft, setDraft] = useState<Record<string, RowQty>>({});
  const valueOf = (key: string): RowQty => draft[key] ?? saved[key] ?? { done: 0, waste: 0 };
  const variantRows = rows.filter((row) => row.variantId);
  const showQty = editable || step.quantities.length > 0;
  const dirty = variantRows.some((row) => {
    const d = draft[row.key];
    if (!d) return false;
    const s = saved[row.key] ?? { done: 0, waste: 0 };
    return d.done !== s.done || d.waste !== s.waste;
  });
  const total = rows.reduce((sum, row) => sum + row.qty, 0);
  const doneSum = variantRows.reduce((sum, row) => sum + valueOf(row.key).done, 0);
  const wasteSum = variantRows.reduce((sum, row) => sum + valueOf(row.key).waste, 0);
  const setRow = (key: string, patch: Partial<RowQty>) => setDraft((d) => ({ ...d, [key]: { ...valueOf(key), ...patch } }));
  const fillAll = () => setDraft(Object.fromEntries(variantRows.map((row) => [row.key, { done: row.qty, waste: 0 }])));
  const save = () => ctl.savePieceQty(step.id, variantRows.map((row) => ({ variantId: row.variantId!, ...valueOf(row.key) })));
  const parse = (value: string, max: number) => Math.max(0, Math.min(max, parseInt(value.replace(/\D/g, "") || "0", 10)));

  if (rows.length === 0) return null;
  return (
    <>
      {editable ? (
        <div className={c("qbar")}>
          <span className={c("t", dirty && "dirty")} aria-live="polite">
            {dirty ? "ยังไม่บันทึก" : ""}
          </span>
          {variantRows.length > 0 ? (
            <button type="button" className={c("btn sm")} onClick={fillAll} disabled={ctl.piecePending}>
              ใส่ครบทุกไซซ์
            </button>
          ) : (
            <button type="button" className={c("btn sm")} onClick={() => ctl.openQty(step.id)}>
              บันทึกยอด
            </button>
          )}
          {dirty ? (
            <button type="button" className={c("btn sm primary")} onClick={save} disabled={ctl.piecePending}>
              บันทึกยอด
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={c("item")} id={pieceTableAnchor(step.id)} role="region" aria-label={`ยอดต่อไซซ์ ขั้น${stepLabel(step)}`}>
        <div className={c("tblw")}>
          <table className={c("tbl")}>
            <caption className={c("sr")}>ยอดต่อไซซ์ ขั้น{stepLabel(step)}</caption>
            <colgroup>
              <col />
              <col className={c("c-ord")} />
              {showQty ? <col className={c("c-in")} /> : null}
              {showQty ? <col className={c("c-in")} /> : null}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">ไซซ์</th>
                <th scope="col" className={c("num")}>สั่ง</th>
                {showQty ? <th scope="col" className={c("num inh")}>ทำแล้ว</th> : null}
                {showQty ? <th scope="col" className={c("num inh")}>เสีย</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const value = valueOf(row.key);
                const label = [row.product, row.color, row.size].filter(Boolean).join(" ");
                const canEdit = editable && Boolean(row.variantId);
                return (
                  <tr key={row.key}>
                    <td className={c("sz")}>
                      <b>{row.size ?? "ไม่ระบุ"}</b>
                      {row.color && row.color !== row.productColor ? <small> {row.color}</small> : null}
                    </td>
                    <td className={c("num")}>{row.qty.toLocaleString("th-TH")}</td>
                    {showQty ? (
                      <td className={c("inp")}>
                        <input
                          className={c("qin", value.done === row.qty && "full", value.done === 0 && "zero")}
                          inputMode="numeric"
                          value={row.variantId ? value.done : "—"}
                          disabled={!canEdit || ctl.piecePending}
                          onChange={(event) => setRow(row.key, { done: parse(event.target.value, row.qty) })}
                          onFocus={(event) => event.target.select()}
                          aria-label={`ทำแล้ว ${label}`}
                        />
                      </td>
                    ) : null}
                    {showQty ? (
                      <td className={c("inp")}>
                        <input
                          className={c("qin", value.waste === 0 && "zero")}
                          style={value.waste > 0 ? ({ color: "var(--warn)" } as CSSProperties) : undefined}
                          inputMode="numeric"
                          value={row.variantId ? value.waste : "—"}
                          disabled={!canEdit || ctl.piecePending}
                          onChange={(event) => setRow(row.key, { waste: parse(event.target.value, row.qty) })}
                          onFocus={(event) => event.target.select()}
                          aria-label={`เสีย ${label}`}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className={c("lbl")}>รวมทั้งใบ</td>
                <td className={c("num")}>{total.toLocaleString("th-TH")}</td>
                {showQty ? <td className={c("num inh")}>{doneSum.toLocaleString("th-TH")}</td> : null}
                {showQty ? <td className={c("num inh", wasteSum > 0 && "warn")}>{wasteSum.toLocaleString("th-TH")}</td> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── เส้นงาน ───────────────────────── */

function WorkRail({ labels, currentIndex, allDone, stopped }: { labels: string[]; currentIndex: number; allDone: boolean; stopped: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const index = allDone ? labels.length - 1 : currentIndex;
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth + 1) return;
    const node = wrap.querySelector<HTMLElement>('[aria-current="step"]');
    if (node) wrap.scrollLeft = node.offsetLeft - wrap.clientWidth / 2 + node.offsetWidth / 2;
  }, [index, labels.length]);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- รางที่เลื่อนได้ต้องรับโฟกัสให้ผู้ใช้คีย์บอร์ดดูทุกขั้นได้
    <div ref={wrapRef} className={c("stepsw")} tabIndex={0} role="group" aria-label="เส้นทางงานของใบนี้">
      <ol className={c("steps")} style={{ "--n": labels.length, "--i": Math.max(0, index) } as CSSProperties}>
        {labels.map((label, position) => {
          const done = allDone || position < currentIndex;
          const cur = !allDone && position === currentIndex;
          return (
            <li
              key={`${label}-${position}`}
              className={c("step", done ? "done" : cur ? (stopped ? "stop" : "cur") : null)}
              style={{ "--k": position } as CSSProperties}
              aria-current={cur ? "step" : undefined}
              aria-label={`${label}: ${done ? "ผ่านแล้ว" : cur ? (stopped ? "ติดปัญหา" : "ขั้นที่ทำอยู่") : "ยังไม่ถึง"}`}
            >
              <span className={c("c")} aria-hidden="true">
                {done ? <Check /> : position + 1}
              </span>
              <span className={c("lb")} aria-hidden="true">
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ───────────────────────── การ์ดขวา ───────────────────────── */

function ChecklistCard({ step, c: ctl, assign }: { step: ProductionStep; c: WorkOrderController; assign: ReactNode }) {
  const standards = workOrderStandards(step.stepType);
  const done = step.status === "COMPLETED";
  const halted = step.status === "FAILED" || step.status === "ON_HOLD";
  const ticked = new Map(step.checks.map((check) => [check.itemKey, check.checkedBy.name]));
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
          missing > 0 ? (
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

function OrderInfoCard({ order, production, c: ctl }: { order: Order; production: ProductionDetail; c: WorkOrderController }) {
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

function historyOf(steps: readonly ProductionStep[]): HistoryEvent[] {
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

function HistoryCard({ steps }: { steps: readonly ProductionStep[] }) {
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

/* ───────────────────────── แท็บสินค้า ───────────────────────── */

function ItemsTab({ order, production, c: ctl }: { order: Order; production: ProductionDetail; c: WorkOrderController }) {
  const approved = order.designs[0] ?? null;
  const mockup = approved ? orderMockupCover(order) : null;
  const products = order.items.flatMap((item) => item.products);
  return (
    <>
      <div className={c("two")}>
        <section className={c("card")} aria-labelledby="wo-items-h">
          <CardHead icon={Shirt} id="wo-items-h" title="สินค้าในใบนี้" />
          <div className={c("cb")}>
            <div className={c("stack")}>
              {products.map((product) => {
                const name = product.description || PRODUCT_TYPES[product.productType ?? ""] || "สินค้า";
                return (
                  <div key={product.id} className={c("item")}>
                    <div className={c("item-head")}>
                      <b>{name}</b>
                      <span className={c("chip gray")}>{(product.totalQuantity ?? 0).toLocaleString("th-TH")} ตัว</span>
                      {product.fabricColor ? <span className={c("chip line")}>{product.fabricColor}</span> : null}
                    </div>
                    {product.variants.length > 0 ? (
                      <div className={c("sizes")}>
                        {product.variants.map((variant) => (
                          <span key={variant.id}>
                            {[variant.color !== product.fabricColor ? variant.color : null, variant.size].filter(Boolean).join(" ") || "ไม่ระบุ"}
                            <b>{variant.quantity.toLocaleString("th-TH")}</b>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className={c("hr")} />
              <div className={c("sub-h")}>
                <h3>งานพิมพ์/ปัก</h3>
              </div>
              <ArtList lines={artLinesOf(order)} withQty />
            </div>
          </div>
        </section>
        <section className={c("card")} aria-labelledby="wo-mock-h">
          <CardHead
            icon={ClipboardCheck}
            tone="violet"
            id="wo-mock-h"
            title="ม็อกอัพ"
            right={approved ? <span className={c("chip good")}>อนุมัติ v{approved.versionNumber}</span> : <span className={c("chip warn")}>ยังไม่มี</span>}
          />
          <div className={c("cb")}>
            <div className={c("canvas")}>
              {mockup ? (
                <a href={mockup} target="_blank" rel="noreferrer" aria-label="เปิดม็อกอัพเต็มจอ">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ไฟล์ม็อกอัพที่อัปโหลด */}
                  <img src={mockup} alt={`ม็อกอัพ ${order.orderNumber}`} />
                </a>
              ) : (
                <span className={c("e")}>
                  <ImageOff aria-hidden="true" />
                  ยังไม่มีม็อกอัพที่อนุมัติ
                </span>
              )}
            </div>
            {approved?.approvedAt ? <p className={c("caption")}>อนุมัติ {formatDateShort(approved.approvedAt)}</p> : null}
          </div>
        </section>
      </div>
      <div className={c("embed")}>
        <MaterialUsage productionId={production.id} orderNumber={order.orderNumber} showCosts={ctl.canSeeCost} readOnly={!ctl.canUpdateStep} embedded />
      </div>
    </>
  );
}

/* ───────────────────────── หน้า ───────────────────────── */

function WorkOrderKit({ id }: { id: string }) {
  const ctl = useWorkOrderController(id);
  const scannedMockup = Number(useSearchParams().get("mockup") ?? "");
  return <WorkOrderKitView c={ctl} scannedMockup={scannedMockup} />;
}

export function WorkOrderKitView({ c: ctl, scannedMockup = Number.NaN }: { c: WorkOrderController; scannedMockup?: number }) {
  const { production, order, me, productionQuery, meQuery, workflowSteps, nowById } = ctl;
  const [problemStep, setProblemStep] = useState<ProductionStep | null>(null);
  const [fixReceiveOpen, setFixReceiveOpen] = useState(false);
  const [tab, setTab] = useState<"steps" | "items" | "history">("steps");

  const approvedMockup = order?.designs[0]?.versionNumber ?? null;
  const stalePaper = Number.isFinite(scannedMockup) && scannedMockup > 0 && approvedMockup !== null && scannedMockup < approvedMockup;

  const nodes = railNodesOf(workflowSteps);
  const openNodeIndex = currentRailNode(nodes);
  const allDone = workflowSteps.length > 0 && openNodeIndex < 0;
  const currentNodeIndex = openNodeIndex < 0 ? nodes.length - 1 : openNodeIndex;
  const currentNode = nodes[currentNodeIndex] ?? [];
  const openInNode = currentNode.filter((s) => s.status !== "COMPLETED");
  const actionable = openInNode.filter((s) => nowById.get(s.id)?.action && !activeOutsource(s));
  const notWaiting = openInNode.filter((s) => routeWaitingOn(s, workflowSteps).length === 0);
  const current = actionable[0] ?? notWaiting.find((s) => !activeOutsource(s)) ?? notWaiting[0] ?? openInNode[0] ?? currentNode[currentNode.length - 1] ?? null;
  const pairedOpen = openInNode.filter((s) => s !== current);
  const railLabels = nodes.map((node, i) => {
    const label = node.map(stepLabel).join(" + ");
    return nodes.some((o, j) => j !== i && o.map(stepLabel).join(" + ") === label) ? `${label} ${i + 1}` : label;
  });
  const hasVariantRows = order ? pieceRowsOf(order).some((r) => r.variantId) : false;
  const canManageStep = ctl.canSuperviseStep && ctl.hasProductionPermission;
  const stopped = !allDone && !!current && (current.status === "FAILED" || current.status === "ON_HOLD");

  /** เหตุที่ขั้นนี้ยังลงมือไม่ได้ — แสดงเฉพาะตอนไม่มีปุ่มให้กดเลย (ติ๊ก/ยอดไม่ครบมีป้ายในเช็คลิสต์และปุ่มพาไปอยู่แล้ว) */
  function blockReason(step: ProductionStep): string | null {
    const outsource = activeOutsource(step);
    if (ctl.writeDataStale) return "โหลดข้อมูลล่าสุดก่อนลงมือ";
    if (!ctl.hasProductionPermission) return "บัญชีนี้ดูงานได้ ให้ทีมผลิตหรือหัวหน้าเป็นผู้บันทึก";
    if (step.status === "ON_HOLD" || step.status === "FAILED") return null;
    if (outsource) {
      const receipts = outsourceReceiptCandidates(step);
      if (receipts.length > 0 && !permAllows(me?.permissions, "manage_delivery")) return "ให้ผู้มีสิทธิ์รับของเข้าเป็นผู้บันทึกหลักฐานรับกลับ";
      if (receipts.length === 0) return outsourceStepReason(step);
      return null;
    }
    const waiting = routeWaitingOn(step, workflowSteps).map(stepLabel);
    if (waiting.length > 0 && !nowById.get(step.id)?.action) return `รอ ${waiting.length === 1 ? waiting[0] : `${waiting.length} ขั้นก่อนหน้า`}`;
    if (!ctl.canUpdateStep) return "ออเดอร์ยังไม่อยู่ในสถานะกำลังผลิต";
    if (step.assignedTo && !ctl.canOwnOrSupervise(step)) return `งานของ ${step.assignedTo.name}`;
    return null;
  }

  function actionFor(step: ProductionStep): ReactNode {
    if (step.stepType === "GARMENT_RECEIVE") return null;
    const outsource = activeOutsource(step);
    if (outsource) {
      const receipts = outsourceReceiptCandidates(step);
      if (!ctl.canUpdateStep || !ctl.canOwnOrSupervise(step) || !permAllows(me?.permissions, "manage_delivery") || receipts.length === 0) return null;
      return receipts.map((receipt) => (
        <div key={receipt.id} className={c("receipt")}>
          <span className={c("tx")}>
            <b>
              {receipt.vendor.name} · {receipt.quantity.toLocaleString("th-TH")} ตัว
            </b>
            <small>ใบส่งร้าน {formatDateTime(receipt.createdAt)}</small>
          </span>
          <button type="button" className={c("btn primary")} onClick={() => ctl.openOutsourceReturn(step.id, receipt.id)}>
            <ClipboardCheck aria-hidden="true" />
            บันทึกหลักฐานรับกลับ
          </button>
        </div>
      ));
    }
    if (step.stepType === "DTF_PRINT" && step.status !== "COMPLETED" && step.status !== "FAILED" && step.status !== "ON_HOLD" && !dtfUnavailableReason(step)?.startsWith("อยู่ในรอบ")) {
      return ctl.canUpdateStep && ctl.hasProductionPermission ? (
        <Link href={DTF_PAGE_HREF} className={c("btn primary")}>
          <Printer aria-hidden="true" />
          ไปหน้าพิมพ์ DTF
        </Link>
      ) : null;
    }
    const now = nowById.get(step.id);
    const closes = now?.action === "complete" || now?.action === "record-qty" || now?.action === "quick-pass";
    if (closes && step.status !== "COMPLETED") {
      if (ticksMissing(step) > 0) {
        return (
          <button type="button" className={c("btn primary")} aria-disabled onClick={() => focusFirst(checklistAnchor(step.id), "input[type=checkbox]:not(:checked)")}>
            <Check aria-hidden="true" />
            ปิดขั้นนี้
          </button>
        );
      }
      if (hasVariantRows && step.qtyTotal && (step.qtyDone ?? 0) < step.qtyTotal) {
        return (
          <button type="button" className={c("btn primary")} aria-disabled onClick={() => focusFirst(pieceTableAnchor(step.id), "input")}>
            <Check aria-hidden="true" />
            ปิดขั้นนี้
          </button>
        );
      }
    }
    return ctl.primaryButton(step, now, { kit: true });
  }

  // ฟังก์ชันวาด (ไม่ใช่ component ซ้อน) — ไม่งั้นตารางยอดถูกสร้างใหม่ทุกครั้งที่ข้อมูลรีเฟรช และยอดที่พิมพ์ค้างหาย
  function renderStepFooter(step: ProductionStep) {
    const action = actionFor(step);
    const canReport = ctl.canUpdateStep && ctl.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED";
    const reason = step.status !== "COMPLETED" && !action ? blockReason(step) : null;
    if (activeOutsource(step) && action) return <>{action}</>;
    if (!action && !canReport && !reason) return null;
    return (
      <div className={c("stepfoot")}>
        <span className={c("why")}>{reason}</span>
        {canReport ? (
          <button type="button" className={c("btn")} onClick={() => setProblemStep(step)}>
            <Flag aria-hidden="true" />
            แจ้งปัญหาขั้นนี้
          </button>
        ) : null}
        {action}
      </div>
    );
  }

  function assignAction(step: ProductionStep) {
    if (!canManageStep || step.status === "COMPLETED") return null;
    return (
      <button type="button" className={c("btn sm")} onClick={() => ctl.openEdit(step, "manager")}>
        <UserRound aria-hidden="true" />
        {step.assignedTo ? "เปลี่ยนคนทำ" : "มอบหมาย"}
      </button>
    );
  }

  function renderStepCard(step: ProductionStep) {
    if (!order || !production) return null;
    const view = viewOf(step, nowById.get(step.id));
    const outsource = activeOutsource(step);
    const counting = step.qtyTotal !== null && step.qtyTotal > 0;
    const Icon = stepIcon(step);
    const iconTone = view.state === "blocked" ? "bad" : view.state === "held" || outsource ? "warn" : "blue";
    return (
      <section className={c("card stepcard")} aria-labelledby={`st-${step.id}`}>
        <CardHead
          icon={Icon}
          tone={iconTone}
          id={`st-${step.id}`}
          title={
            <>
              {stepLabel(step)}
              {counting ? (
                <small>
                  {" "}
                  {(step.qtyDone ?? 0).toLocaleString("th-TH")} / {step.qtyTotal!.toLocaleString("th-TH")} ตัว
                </small>
              ) : null}
            </>
          }
          right={<span className={c("chip", CHIP_TONE[view.chip])}>{outsource ? "อยู่ร้านนอก" : view.label}</span>}
        />
        <div className={c("cb")}>
          {outsource ? (
            <dl className={c("props")} style={{ marginBottom: 16 }}>
              <Prop label="ร้าน">{outsource.vendor.name}</Prop>
              <Prop label="นัดรับกลับ" none={!outsource.expectedBackAt}>
                {outsource.expectedBackAt ? (
                  <DueTag status="PRODUCING" deadline={outsource.expectedBackAt} dueInDays={daysFromNow(outsource.expectedBackAt, ctl.nowMs)} small={false} />
                ) : (
                  "ยังไม่นัด"
                )}
              </Prop>
              <Prop label="งานที่ส่ง">
                {outsource.description || stepLabel(step)}
                <small>
                  {outsource.quantity.toLocaleString("th-TH")} ตัว{outsource.sentAt ? ` · ส่ง ${formatDateShort(outsource.sentAt)}` : ""}
                </small>
              </Prop>
              {outsource.notes ? <Prop label="หมายเหตุร้าน">{outsource.notes}</Prop> : null}
            </dl>
          ) : null}
          {step.stepType === "GARMENT_PICK" ? (
            <div className={c("embed")}>
              <GarmentPickCard
                productionId={production.id}
                steps={workflowSteps}
                stepId={step.id}
                canIssueGarments={ctl.canUpdateStep && ctl.canOwnOrSupervise(step)}
                canReturnGarments={ctl.canSuperviseStep && ctl.hasProductionPermission && !ctl.writeDataStale}
                primaryTask
              />
            </div>
          ) : step.stepType === "GARMENT_RECEIVE" ? (
            <div className={c("embed")}>
              <GarmentReceiveInline
                orderId={order.id}
                productionStepId={step.id}
                canRecord={ctl.canUpdateStep && ctl.canOwnOrSupervise(step) && step.status !== "COMPLETED" && step.status !== "FAILED"}
                canCorrect={ctl.canSuperviseStep && ctl.hasProductionPermission && step.status === "COMPLETED"}
              />
            </div>
          ) : (
            <>
              <ArtList lines={artLinesOf(order, step.stepType)} />
              <PieceTable key={step.id} step={step} order={order} c={ctl} />
            </>
          )}
        </div>
        {renderStepFooter(step)}
      </section>
    );
  }

  const qcAction = production && ctl.canUpdateStep && allDone && (ctl.readyForQcViaPaper || ctl.legacyPackagingReadyForQc) ? (ctl.readyForQcViaPaper ? "paper" : "legacy") : null;
  const nextLabel = railLabels[currentNodeIndex + 1] ?? null;
  const flatIndex = current ? workflowSteps.indexOf(current) : workflowSteps.length;
  const reopenTarget = allDone
    ? (workflowSteps[workflowSteps.length - 1] ?? null)
    : ([...workflowSteps.slice(0, flatIndex)].reverse().find((s) => s.status === "COMPLETED") ?? null);
  /* ย้อนกลับเป็นปุ่มจริงบนหัวใบเมื่อย้อนได้ (เบสสั่ง 2026-09-18 "จะได้กดได้ง่ายๆ")
     ย้อนไม่ได้ = คงเป็นรายการจางในเมนู ⋯ พร้อมเหตุผล (ไม่โชว์ปุ่มที่กดแล้ว server ปฏิเสธ — B8)

     ด่านต้องตรงกับ server ทุกข้อ (production.reopenStep + assertStepReopenable):
     ปิดด้วยปุ่มเท่านั้น · ไม่มีใบส่งร้าน/รอบพิมพ์ผูก · ขั้นหลังจากนั้นยังไม่มีใครเริ่ม ·
     ออเดอร์ยังอยู่ระหว่างผลิต (ใช้ ctl.canUpdateStep ตัวเดียวกับปุ่มลงมือ ไม่เขียนกฎสถานะใหม่)
     นับขั้นพี่น้องจากทั้งใบ (production.steps) เหมือน server ไม่ใช่เฉพาะขั้นที่อยู่บนราง
     (ใบตรวจรับนับไม่ได้ฝั่งนี้ — แต่ขั้นที่มีใบตรวจรับเป็นชนิดที่ flow เป็นเจ้าของอยู่แล้ว)

     ปิดขั้นสุดท้ายแล้ว server เดินออเดอร์ไป "ตรวจคุณภาพ" ให้เอง (finalizeProductionIfComplete)
     ปุ่มจึงหายเองตอนนั้น — ทางย้อนของสถานะนั้นอยู่ที่หัวใบออเดอร์ (QC → กำลังผลิต) */
  const allStepsOfSheet = production?.steps ?? [];
  const reopenBlockedReason: string | null = !reopenTarget
    ? "ยังไม่มีขั้นที่ปิดให้ย้อน"
    : reopenTarget.status !== "COMPLETED"
      ? "ขั้นนี้ยังไม่ได้ปิด"
      : FLOW_OWNED_STEP_TYPES.has(reopenTarget.stepType) ||
          reopenTarget.outsourceOrders.length > 0 ||
          reopenTarget.printRunItems.length > 0
        ? "ปิดผ่านหลักฐานของระบบ"
        : allStepsOfSheet.some((s) => s.sortOrder > reopenTarget.sortOrder && s.status !== "PENDING")
          ? "ขั้นถัดไปเริ่มทำแล้ว"
          : !ctl.canUpdateStep
            ? "ออเดอร์ยังไม่อยู่ในสถานะกำลังผลิต"
            : null;
  const canReopenNow = canManageStep && !!reopenTarget && reopenBlockedReason === null;
  const receiveStep = workflowSteps.find((step) => step.stepType === "GARMENT_RECEIVE") ?? null;
  const sendQc = () =>
    production && (qcAction === "paper" ? ctl.sendToQc.mutate({ productionId: production.id }) : ctl.legacyFinalize.mutate({ productionId: production.id }));

  const printHref = order && production ? `/print/job-ticket/${order.id}?production=${production.id}` : "#";

  return (
    <>
      <PageShell
        title={order?.orderNumber ?? "ใบผลิต"}
        header={<div className="sr-only">{order?.orderNumber ?? "ใบผลิต"}</div>}
        loading={productionQuery.isLoading || meQuery.isLoading}
        skeleton={
          <div className={c("tokens page mfg")} role="status" aria-label="กำลังโหลดใบผลิต">
            <span className={c("sk")} style={{ height: 64, width: "50%" }} />
            <span className={c("sk")} style={{ height: 72 }} />
            <div className={c("two")}>
              <span className={c("sk")} style={{ height: 420 }} />
              <span className={c("sk")} style={{ height: 420 }} />
            </div>
          </div>
        }
        error={
          meQuery.isError && !me
            ? { message: "โหลดสิทธิ์การผลิตไม่สำเร็จ", onRetry: () => meQuery.refetch() }
            : productionQuery.isError && !production && !ctl.notFound
              ? { message: "โหลดใบผลิตไม่สำเร็จ", onRetry: () => productionQuery.refetch() }
              : null
        }
      >
        {ctl.notFound || !production || !order ? (
          <RecordNotFound what="ใบผลิตนี้" backHref="/production" backLabel="กลับหน้าการผลิต" />
        ) : (
          <div className={c("tokens page mfg")}>
            {ctl.writeDataStale || stalePaper || ctl.problemSteps.length > 0 ? (
              <div className={c("alerts")}>
                {ctl.problemSteps.map((step) => (
                  <Callout
                    key={step.id}
                    tone={step.status === "ON_HOLD" ? undefined : "danger"}
                    icon={step.status === "ON_HOLD" ? Pause : TriangleAlert}
                    role="alert"
                    action={
                      canManageStep ? (
                        <button type="button" className={c("btn sm")} onClick={() => ctl.openEdit(step, "manager")}>
                          จัดการ
                        </button>
                      ) : undefined
                    }
                  >
                    <b>
                      {stepLabel(step)}
                      {STEP_STATUS_LABELS[step.status === "ON_HOLD" ? "ON_HOLD" : "FAILED"]}
                    </b>{" "}
                    — {currentProductionProblemReason(step) ?? step.notes ?? "ยังไม่ระบุเหตุ"}
                    {step.assignedTo ? <span className={c("whoinline")}> ผู้ทำ {step.assignedTo.name}</span> : null}
                  </Callout>
                ))}
                {stalePaper ? (
                  <Callout
                    tone="danger"
                    icon={Printer}
                    role="alert"
                    action={
                      <a href={printHref} target="_blank" rel="noreferrer" className={c("btn sm")}>
                        พิมพ์ใบใหม่
                      </a>
                    }
                  >
                    <b>กระดาษที่สแกนเป็นฉบับเก่า</b> — บนกระดาษม็อกอัพ v{scannedMockup} · ตอนนี้ v{approvedMockup}
                  </Callout>
                ) : null}
                {ctl.writeDataStale ? (
                  <Callout
                    icon={RefreshCw}
                    role="alert"
                    action={
                      <button type="button" className={c("btn sm")} onClick={() => void productionQuery.refetch()}>
                        โหลดใหม่
                      </button>
                    }
                  >
                    <b>ข้อมูลล่าสุดอาจยังไม่ครบ</b> กำลังแสดงข้อมูลเดิมที่โหลดไว้
                  </Callout>
                ) : null}
              </div>
            ) : null}

            <nav className={c("crumbs")} aria-label="ตำแหน่ง">
              <Link href="/production">การผลิต</Link>
              <ChevronRight aria-hidden="true" />
              <span>{order.orderNumber}</span>
            </nav>

            <div className={c("dhead")}>
              <div className={c("idrow")}>
                <Thumb cover={orderMockupCover(order)} alt={`ม็อกอัพ ${order.orderNumber}`} lg />
                <div className={c("h1row")}>
                  <h1>{order.orderNumber}</h1>
                  {allDone ? <span className={c("chip good lg")}>ครบทุกขั้น</span> : <PriorityChip priority={order.priority} lg />}
                </div>
              </div>
              <div className={c("acts")}>
                <a href={printHref} target="_blank" rel="noreferrer" className={c("btn")} aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)">
                  <Printer aria-hidden="true" />
                  <span className={c("lbl")}>ใบสั่งงาน</span>
                </a>
                {canReopenNow && reopenTarget ? (
                  <button
                    type="button"
                    className={c("btn")}
                    onClick={() => void ctl.handleReopen(reopenTarget)}
                    disabled={ctl.reopenPending}
                    aria-label={`ย้อนกลับ: ${stepLabel(reopenTarget)}`}
                  >
                    <Undo2 aria-hidden="true" />
                    <span className={c("lbl")}>ย้อนกลับ: {stepLabel(reopenTarget)}</span>
                  </button>
                ) : null}
                {qcAction ? (
                  <button type="button" className={c("btn primary")} onClick={sendQc} disabled={ctl.sendToQc.isPending || ctl.legacyFinalize.isPending}>
                    <Send aria-hidden="true" />
                    ส่งเข้า QC
                  </button>
                ) : current && !allDone && nextLabel ? (
                  <button type="button" className={c("btn next")} aria-disabled onClick={() => focusWhatIsBlocking(current.id)} title="กดเพื่อไปสิ่งที่ต้องทำก่อน">
                    <span>ถัดไป: {nextLabel}</span>
                  </button>
                ) : null}
                {current ? (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" className={c("btn icon")} aria-label="คำสั่งเพิ่มเติม">
                        <Ellipsis aria-hidden="true" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end" sideOffset={6} className={c("tokens dmenu")}>
                        <DropdownMenu.Item
                          className={c("mi")}
                          disabled={!canManageStep || current.status === "COMPLETED" || current.status === "FAILED"}
                          onSelect={() => void ctl.handleSupervisorStatus(current, current.status === "ON_HOLD" ? "PENDING" : "ON_HOLD")}
                        >
                          <Pause aria-hidden="true" />
                          {current.status === "ON_HOLD" ? "คืนขั้นนี้กลับคิว" : "พักขั้นนี้ไว้ก่อน"}
                          {!canManageStep ? <small>หัวหน้าเท่านั้น</small> : null}
                        </DropdownMenu.Item>
                        {receiveStep ? (
                          <DropdownMenu.Item className={c("mi")} disabled={!canManageStep} onSelect={() => setFixReceiveOpen(true)}>
                            <ClipboardCheck aria-hidden="true" />
                            แก้ยอดตรวจรับเสื้อ
                            {!canManageStep ? <small>หัวหน้าเท่านั้น</small> : null}
                          </DropdownMenu.Item>
                        ) : null}
                        {!canReopenNow ? (
                          <DropdownMenu.Item className={c("mi danger")} disabled>
                            <RotateCcw aria-hidden="true" />
                            {reopenTarget ? `ย้อนกลับไป ${stepLabel(reopenTarget)}` : "ย้อนกลับขั้นก่อน"}
                            {!canManageStep ? <small>หัวหน้าเท่านั้น</small> : <small>{reopenBlockedReason}</small>}
                          </DropdownMenu.Item>
                        ) : null}
                        <DropdownMenu.Separator className={c("sep")} />
                        <DropdownMenu.Item asChild className={c("mi")}>
                          <Link href={`/orders/${order.id}?tab=history`}>
                            <History aria-hidden="true" />
                            ประวัติออเดอร์
                          </Link>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                ) : null}
              </div>
            </div>

            {workflowSteps.length > 0 ? (
              <WorkRail labels={railLabels} currentIndex={currentNodeIndex} allDone={allDone} stopped={stopped} />
            ) : null}

            <KitTabs
              label="ส่วนของใบผลิต"
              idPrefix="wo"
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "steps", label: "ขั้นตอน", pending: ctl.problemSteps.length > 0 },
                { key: "items", label: "สินค้า" },
                { key: "history", label: "ประวัติขั้นงาน" },
              ]}
            />

            <div className={c("tabpanel")} role="tabpanel" id={`wo-panel-${tab}`} aria-labelledby={`wo-tab-${tab}`}>
              {tab === "history" ? (
                <HistoryCard steps={workflowSteps} />
              ) : tab === "items" ? (
                <ItemsTab order={order} production={production} c={ctl} />
              ) : workflowSteps.length === 0 ? (
                <section className={c("card")}>
                  <div className={c("empty flat")}>
                    <span className={c("ring")} aria-hidden="true">
                      <Wrench />
                    </span>
                    <b>ใบผลิตนี้ยังไม่มีขั้นตอน</b>
                  </div>
                </section>
              ) : (
                <div className={c("two")}>
                  <div className={c("stack")}>
                    {allDone || !current ? (
                      <section className={c("card stepcard")} aria-labelledby="wo-done-h">
                        <CardHead icon={CircleCheck} tone="good" id="wo-done-h" title="ครบทุกขั้นในใบนี้แล้ว" />
                        <div className={c("cb")}>
                          <div className={c("facts")}>
                            <div className={c("fact good")}>
                              <span className={c("k")}>ทำแล้ว</span>
                              <span className={c("v")}>
                                {ctl.totalQty.toLocaleString("th-TH")} <small>ตัว</small>
                              </span>
                            </div>
                            <div className={c("fact")}>
                              <span className={c("k")}>สถานะออเดอร์</span>
                              <span className={c("v")} style={{ fontSize: 15 }}>
                                {INTERNAL_STATUS_LABELS[order.internalStatus] ?? order.internalStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={c("stepfoot")}>
                          <span className={c("why")} />
                          {qcAction ? (
                            <button type="button" className={c("btn primary")} onClick={sendQc} disabled={ctl.sendToQc.isPending || ctl.legacyFinalize.isPending}>
                              <Send aria-hidden="true" />
                              ส่งเข้า QC
                            </button>
                          ) : (
                            <Link href={`/orders/${order.id}?tab=${order.internalStatus === "QUALITY_CHECK" ? "production" : "delivery"}`} className={c("btn")}>
                              เปิดออเดอร์
                              <ChevronRight aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </section>
                    ) : (
                      [current, ...pairedOpen].map((step) => <div key={step.id}>{renderStepCard(step)}</div>)
                    )}
                  </div>
                  <div className={c("stack sticky")}>
                    {!allDone && current
                      ? [current, ...pairedOpen].map((step) => (
                          <ChecklistCard key={step.id} step={step} c={ctl} assign={assignAction(step)} />
                        ))
                      : null}
                    <OrderInfoCard order={order} production={production} c={ctl} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageShell>
      {problemStep ? <ProblemDialog open onClose={() => setProblemStep(null)} step={problemStep} c={ctl} /> : null}
      {fixReceiveOpen && order && receiveStep ? (
        <Dialog open onOpenChange={(open) => !open && setFixReceiveOpen(false)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>แก้ยอดตรวจรับเสื้อลูกค้า</DialogTitle>
              <DialogDescription>กรอกยอดที่ถูกต้อง ระบบออกใบส่วนต่างและเปิดขั้นกลับให้ถ้ายอดยังไม่ครบ</DialogDescription>
            </DialogHeader>
            <GarmentReceiveInline orderId={order.id} productionStepId={receiveStep.id} canRecord={false} canCorrect startCorrecting />
          </DialogContent>
        </Dialog>
      ) : null}
      {ctl.dialogs}
    </>
  );
}

export function WorkOrderKitPage({ id }: { id: string }) {
  return (
    <Suspense fallback={null}>
      <WorkOrderKit id={id} />
    </Suspense>
  );
}
