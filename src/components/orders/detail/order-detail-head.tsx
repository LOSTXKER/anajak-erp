"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { InternalStatus } from "@prisma/client";
import { c, PriorityChip, StatusPill, statusLabel, Thumb } from "@/components/kit/kit";
import { findOffPathAnchor, type StatusRevisionLike } from "@/lib/order-status-rail";
import { formatDateCompact } from "@/lib/utils";

/* ============================================================
   หัวใบออเดอร์ + รางสถานะ — ต้นแบบ detailPage() ส่วน .dhead และ .steps

   หัวใบยืนบนผืนหน้า ไม่มีกรอบ (เบสสั่ง 08-30): รูปม็อกอัพ · เลขที่ · สถานะ · ความเร่งด่วน อยู่แนวกลางเดียวกับปุ่มขวา
   เบสถอดบรรทัดลูกค้า/ผู้ติดต่อ/ชื่องาน และป้าย "ลูกค้าเห็น" (09-15) — ข้อมูลเหล่านั้นอยู่ในภาพรวมแล้ว
   รางสถานะอ่านอย่างเดียว ทุกขั้นกว้างเท่ากันเต็มแถว ขั้นที่ยืนอยู่ต่างแค่ขอบวงและตัวหนา (ไม่เป็นแคปซูล · เบส 09-15)
   พัก/ยกเลิกยืมตำแหน่งขั้นที่ค้างจากประวัติ
   ============================================================ */

export function OrderDetailHead({
  orderNumber,
  cover,
  internalStatus,
  priority,
  actions,
}: {
  orderNumber: string;
  cover: string | null;
  internalStatus: InternalStatus;
  priority: string;
  actions?: ReactNode;
}) {
  return (
    <div className={c("dhead")} data-order-head="">
      <div className={c("idrow")}>
        <Thumb cover={cover} alt={`ม็อกอัพ ${orderNumber}`} lg />
        <div className={c("h1row")}>
          <h1>{orderNumber}</h1>
          <StatusPill status={internalStatus} lg />
          <PriorityChip priority={priority} lg />
        </div>
      </div>
      {actions ? <div className={c("acts")}>{actions}</div> : null}
    </div>
  );
}

/** รางสถานะ (ต้นแบบ .steps) — จุดเลขเรียงตามเส้นทางงาน */
export function OrderStatusSteps({
  flowSteps,
  currentStepIndex,
  internalStatus,
  revisions,
  cancelledAt,
  cancelledReason,
}: {
  flowSteps: string[];
  currentStepIndex: number;
  internalStatus: string;
  revisions?: StatusRevisionLike[];
  cancelledAt?: Date | string | null;
  cancelledReason?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const isCancelled = internalStatus === "CANCELLED";
  const isOnHold = internalStatus === "ON_HOLD";
  const offPath = currentStepIndex < 0;
  const anchor = offPath ? findOffPathAnchor({ internalStatus, flowSteps, revisions }) : null;
  const index = offPath ? (anchor?.index ?? -1) : currentStepIndex;
  const mode = isCancelled ? "stop" : isOnHold ? "hold" : "cur";

  // พัก/ยกเลิก: รายละเอียดไม่ขึ้นบนราง (ป้ายบนสุดของหน้าบอกแล้ว) แต่คงไว้ให้โปรแกรมอ่านหน้าจอ
  const offPathDetail =
    mode === "hold" && anchor
      ? `พักตั้งแต่ ${formatDateCompact(anchor.at)} · ค้างที่ ${statusLabel(anchor.status)}`
      : mode === "stop"
        ? [
            (cancelledAt ?? anchor?.at) ? `ยกเลิก ${formatDateCompact((cancelledAt ?? anchor?.at)!)}` : "ยกเลิกแล้ว",
            cancelledReason?.trim() || null,
          ]
            .filter(Boolean)
            .join(" · ")
        : null;

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
        {/* เส้นสีวิ่งเส้นเดียวจากขั้นแรกถึงขั้นที่ยืนอยู่ (เบส 09-15) — ตำแหน่งคำนวณจาก --n/--i ใน CSS */}
        <ol className={c("steps")} style={{ "--n": flowSteps.length, "--i": Math.max(0, index) } as CSSProperties}>
          {flowSteps.map((step, position) =>
            position === index ? (
              <li key={step} className={c("step", mode)} aria-current="step" style={{ "--k": position } as CSSProperties}>
                <span className={c("c")}>{position + 1}</span>
                <span className={c("lb")}>
                  {mode === "hold" ? "พักงาน" : mode === "stop" ? "ยกเลิก" : statusLabel(step)}
                  {offPathDetail ? <span className={c("sr")}> · {offPathDetail}</span> : null}
                </span>
              </li>
            ) : (
              <li
                key={step}
                className={c("step", position < index && "done")}
                style={{ "--k": position } as CSSProperties}
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
