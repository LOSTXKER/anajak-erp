"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import type { CustomerStatus, InternalStatus } from "@prisma/client";
import { c, PriorityChip, StatusPill, statusLabel, Thumb } from "@/components/orders/orders-ui";
import { CUSTOMER_STATUS_LABELS } from "@/lib/order-status";
import { findOffPathAnchor, type StatusRevisionLike } from "@/lib/order-status-rail";
import { formatDateCompact } from "@/lib/utils";

/* ============================================================
   หัวใบออเดอร์ + รางสถานะ — ต้นแบบ detailPage() ส่วน .dhead และ .steps (รื้อ 2026-09-15)

   หัวใบยืนบนผืนหน้า ไม่มีกรอบ (เบสสั่ง 08-30): รูปม็อกอัพ · เลขที่ · สถานะ · ความเร่งด่วน · สถานะที่ลูกค้าเห็น
   บรรทัดรอง ลูกค้า (กดไปหน้าลูกค้า) · ผู้ติดต่อ · ชื่องาน · ปุ่มทางขวามาจากหน้าแม่ (ใบสั่งงาน/ลิงก์ลูกค้า/ขั้นต่อไป/⋯)
   รางสถานะอ่านอย่างเดียว ขั้นที่ยืนอยู่เป็นแคปซูลบอกอยู่มากี่วัน/ใครทำ · พัก/ยกเลิกยืมตำแหน่งขั้นที่ค้างจากประวัติ
   ============================================================ */

/** ชื่องานยาวไม่ขึ้นหัวใบ (อยู่การ์ดม็อกอัพแล้ว) */
const HEAD_DESCRIPTION_MAX = 60;

export function OrderDetailHead({
  orderNumber,
  cover,
  internalStatus,
  customerStatus,
  priority,
  customer,
  description,
  actions,
}: {
  orderNumber: string;
  cover: string | null;
  internalStatus: InternalStatus;
  customerStatus: CustomerStatus;
  priority: string;
  customer: { id: string; name: string; company: string | null } | null;
  description: string | null;
  actions?: ReactNode;
}) {
  const shortDescription =
    description && description.trim().length <= HEAD_DESCRIPTION_MAX ? description.trim() : null;
  const company = customer?.company?.trim() || null;
  const title = company || customer?.name || null;
  const person = company && customer?.name && customer.name !== company ? customer.name : null;

  return (
    <div className={c("dhead")} data-order-head="">
      <div className={c("idrow")}>
        <Thumb cover={cover} alt={`ม็อกอัพ ${orderNumber}`} lg />
        <div>
          <div className={c("h1row")}>
            <h1>{orderNumber}</h1>
            <StatusPill status={internalStatus} lg />
            <PriorityChip priority={priority} lg />
            <span className={c("chip line")}>ลูกค้าเห็น · {CUSTOMER_STATUS_LABELS[customerStatus]}</span>
          </div>
          {customer || shortDescription ? (
            <p className={c("sub")}>
              {customer && title ? <Link href={`/customers/${customer.id}`}>{title}</Link> : null}
              {person ? (
                <>
                  <span className={c("sep")} aria-hidden="true">
                    ·
                  </span>
                  <span>{person}</span>
                </>
              ) : null}
              {shortDescription ? (
                <>
                  <span className={c("sep")} aria-hidden="true">
                    ·
                  </span>
                  <span>{shortDescription}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className={c("acts")}>{actions}</div> : null}
    </div>
  );
}

/** รางสถานะ (ต้นแบบ .steps) — จุดเลขเรียงตามเส้นทางงาน ขั้นที่ยืนอยู่เป็นแคปซูล */
export function OrderStatusSteps({
  flowSteps,
  currentStepIndex,
  internalStatus,
  revisions,
  cancelledAt,
  cancelledReason,
  currentDetail,
}: {
  flowSteps: string[];
  currentStepIndex: number;
  internalStatus: string;
  revisions?: StatusRevisionLike[];
  cancelledAt?: Date | string | null;
  cancelledReason?: string | null;
  /** บรรทัดเล็กในแคปซูลของขั้นปัจจุบัน เช่น "อยู่ขั้นนี้ 4 วัน · นนท์" */
  currentDetail?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const isCancelled = internalStatus === "CANCELLED";
  const isOnHold = internalStatus === "ON_HOLD";
  const offPath = currentStepIndex < 0;
  const anchor = offPath ? findOffPathAnchor({ internalStatus, flowSteps, revisions }) : null;
  const index = offPath ? (anchor?.index ?? -1) : currentStepIndex;
  const mode = isCancelled ? "stop" : isOnHold ? "hold" : "cur";

  const capsuleDetail =
    mode === "hold" && anchor
      ? `พักตั้งแต่ ${formatDateCompact(anchor.at)} · ค้างที่ ${statusLabel(anchor.status)}`
      : mode === "stop"
        ? [
            (cancelledAt ?? anchor?.at) ? `ยกเลิก ${formatDateCompact((cancelledAt ?? anchor?.at)!)}` : "ยกเลิกแล้ว",
            cancelledReason?.trim() || null,
          ]
            .filter(Boolean)
            .join(" · ")
        : currentDetail;

  // จอแคบรางยาวเกินจอ — เปิดมาต้องเห็นขั้นที่ยืนอยู่ ไม่ใช่ขั้นแรก ๆ ที่ผ่านไปแล้ว
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth + 1) return;
    const node = wrap.querySelector<HTMLElement>('[aria-current="step"]');
    if (node) wrap.scrollLeft = node.offsetLeft - wrap.clientWidth / 2 + node.offsetWidth / 2;
  }, [index, flowSteps.length]);

  return (
    <div>
      <div
        ref={wrapRef}
        className={c("stepsw")}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- รางที่เลื่อนได้ต้องรับโฟกัสให้ผู้ใช้คีย์บอร์ดดูทุกขั้นได้ (WCAG 2.1.1)
        tabIndex={0}
        role="group"
        aria-label="เส้นทางสถานะออเดอร์"
      >
        <ol className={c("steps")}>
          {flowSteps.map((step, position) =>
            position === index ? (
              <li key={step} className={c("step", mode)} aria-current="step">
                <span className={c("c")}>{position + 1}</span>
                <span className={c("lb")}>
                  {mode === "hold" ? "พักงาน" : mode === "stop" ? "ยกเลิก" : statusLabel(step)}
                  {capsuleDetail ? <small>{capsuleDetail}</small> : null}
                </span>
              </li>
            ) : (
              <li
                key={step}
                className={c("step", position < index && "done")}
                aria-label={`${statusLabel(step)}: ${position < index ? "ผ่านแล้ว" : "ยังไม่ถึง"}`}
              >
                <span className={c("c")} aria-hidden="true">
                  {position + 1}
                </span>
                <span className={c("lb")} aria-hidden="true">
                  {statusLabel(step)}
                </span>
              </li>
            ),
          )}
        </ol>
      </div>
      {offPath && index < 0 ? (
        <p className={c("caption steps-note")}>
          {statusLabel(internalStatus)} · หาขั้นที่ค้างไว้จากประวัติไม่เจอ
        </p>
      ) : null}
    </div>
  );
}
