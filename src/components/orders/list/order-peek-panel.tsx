"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Banknote,
  Calendar,
  Factory,
  ImageOff,
  MessageCircle,
  PackageCheck,
  Phone,
  Tag,
  X,
} from "lucide-react";
import { safeChatUrl } from "@/components/customers/chat-link";
import { c, DueTag, Rw, StatusPill, statusLabel } from "@/components/kit/kit";
import { MockupPill, ProblemCallout } from "@/components/orders/orders-ui";
import { customerLines, orderListCover, type OrderListRow } from "@/components/orders/list/orders-table";
import { describeOrderAttention } from "@/lib/home-orders";
import { isAttentionStatus } from "@/lib/order-progress";
import { getFlowSteps, ORDER_TYPE_UI_LABELS } from "@/lib/order-status";
import { formatBaht, formatDateCompact } from "@/lib/utils";

/* ============================================================
   ดูย่อออเดอร์ — ต้นแบบ peekHTML() ทีละชิ้น (รื้อ 2026-09-15)

   แผงสูงเต็มจอจากขวา: ม็อกอัพ + สถานะอนุมัติ · ลูกค้า · ต้องจัดการ · กำหนดส่ง/จำนวน/ยอด ·
   อยู่ขั้นไหนของเส้นทาง · ใบผลิต/โทร/แชท · ↑↓ ไล่ใบ · Esc ปิด
   เป็นที่ "ดู" ไม่ใช่ที่ลงมือ — เดินสถานะ/แก้ข้อมูลอยู่ในหน้าใบเต็ม · ข้อมูลทั้งหมดมาจากแถวของ order.list
   ============================================================ */

export function OrderPeekPanel({
  order,
  canSeeMoney,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: {
  order: OrderListRow;
  canSeeMoney: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [now] = useState(() => new Date());

  // เปลี่ยนใบ = โฟกัสมาที่แผง ให้คีย์บอร์ด/เครื่องอ่านหน้าจออยู่กับใบที่เพิ่งเปิด
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [order.id]);

  const cover = orderListCover(order);
  const design = order.designs[0];
  const problem = describeOrderAttention(order.progress);
  const flow = getFlowSteps(order.orderType);
  const index = flow.indexOf(order.internalStatus);
  const { currentStep, stepsDone, stepsTotal, dueInDays } = order.progress;
  const { title, person } = customerLines(order);
  const tech = order.printLabel ?? (order.orderType === "READY_MADE" ? ORDER_TYPE_UI_LABELS.READY_MADE : null);
  const who2 = [person, order.description?.trim() || null, tech].filter(Boolean).join(" · ");
  const phone = order.customer?.phone?.trim();
  const chatUrl = safeChatUrl(order.customer?.chatUrl);
  const chatName = order.customer?.chatName?.trim() || (chatUrl ? "เปิดแชท" : null);
  const active = isAttentionStatus(order.internalStatus);

  return (
    <aside ref={panelRef} tabIndex={-1} aria-label={`ดูย่อ ${order.orderNumber}`} className={c("peek")}>
      <div className={c("ph")}>
        <button type="button" className={c("x")} onClick={onClose} aria-label="ปิดดูย่อ">
          <X aria-hidden="true" />
        </button>
        <span className={c("mono")}>{order.orderNumber}</span>
        <StatusPill status={order.internalStatus} />
        <span className={c("pnav")}>
          <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label="ใบก่อนหน้า">
            <ArrowUp aria-hidden="true" />
          </button>
          <button type="button" onClick={onNext} disabled={!hasNext} aria-label="ใบถัดไป">
            <ArrowDown aria-hidden="true" />
          </button>
        </span>
      </div>

      <div className={c("pb")}>
        <div className={c("canvas")}>
          {design ? (
            <>
              <span className={c("ver chip gray")}>v{design.versionNumber}</span>
              <span className={c("ap")}>
                <MockupPill design={design} now={now} />
              </span>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={`ม็อกอัพ ${order.orderNumber}`} />
              ) : (
                <div className={c("e")}>
                  <ImageOff aria-hidden="true" />
                  <span>เวอร์ชันนี้ไม่มีรูปตัวอย่าง</span>
                </div>
              )}
            </>
          ) : (
            <div className={c("e")}>
              <ImageOff aria-hidden="true" />
              <span>{order.orderType === "CUSTOM" ? "ยังไม่มีม็อกอัพ" : "งานสำเร็จรูป ไม่ต้องมีแบบ"}</span>
            </div>
          )}
        </div>

        <div>
          <h2>
            {title}
            {order.priority === "URGENT" ? <span className={c("chip bad")}>เร่งด่วน</span> : null}
          </h2>
          {who2 ? <div className={c("who2")}>{who2}</div> : null}
        </div>

        {problem ? <ProblemCallout problem={problem} progress={order.progress} /> : null}

        <div className={c("facts")}>
          <div className={c("fact")}>
            <span className={c("k")}>
              <Calendar aria-hidden="true" />
              กำหนดส่ง
            </span>
            <span className={c("v")}>{order.deadline ? formatDateCompact(order.deadline) : "—"}</span>
            {active && order.deadline && dueInDays !== null && dueInDays <= 2 ? (
              <span>
                <DueTag status={order.internalStatus} deadline={order.deadline} dueInDays={dueInDays} />
              </span>
            ) : null}
          </div>
          <div className={c("fact")}>
            <span className={c("k")}>
              <PackageCheck aria-hidden="true" />
              จำนวน
            </span>
            <span className={c("v")}>
              {order.quantity.toLocaleString("th-TH")}
              <small>ตัว</small>
            </span>
          </div>
          {canSeeMoney ? (
            <div className={c("fact")}>
              <span className={c("k")}>
                <Banknote aria-hidden="true" />
                ยอดรวม
              </span>
              <span className={c("v mono")}>{formatBaht(order.totalAmount ?? 0)}</span>
            </div>
          ) : (
            <div className={c("fact")}>
              <span className={c("k")}>
                <Tag aria-hidden="true" />
                วิธีพิมพ์
              </span>
              <span className={c("v")}>{tech ?? "—"}</span>
            </div>
          )}
        </div>

        <div
          className={c("mini")}
          role="img"
          aria-label={index >= 0 ? `ขั้น ${index + 1} จาก ${flow.length} ${statusLabel(order.internalStatus)}` : statusLabel(order.internalStatus)}
        >
          {flow.map((status, position) => (
            <i key={status} className={c(index >= 0 && position < index ? "d" : position === index ? "c" : null)} />
          ))}
          <small>
            {index >= 0 ? `ขั้น ${index + 1}/${flow.length} · ${statusLabel(order.internalStatus)}` : statusLabel(order.internalStatus)}
          </small>
        </div>

        <div className={c("rows")}>
          {order.production ? (
            <Rw
              href={`/orders/${order.id}?tab=production`}
              icon={Factory}
              tone="warn"
              title={order.production.workOrderNumber ?? "ใบผลิต"}
              sub={
                stepsTotal === 0
                  ? "ยังไม่มีขั้นผลิต"
                  : `${stepsDone}/${stepsTotal} ขั้นเสร็จ${currentStep ? ` · กำลัง${currentStep.label}` : ""}`
              }
            />
          ) : null}
          {phone ? (
            <Rw href={`tel:${phone.replace(/[^\d+]/g, "")}`} icon={Phone} title={phone} sub={person ?? "ผู้ติดต่อ"} arrow="external" />
          ) : null}
          {chatName ? (
            <Rw href={chatUrl ?? undefined} icon={MessageCircle} tone="lineapp" title={chatName} sub="ห้องแชท LINE" arrow="external" />
          ) : null}
        </div>
      </div>

      <div className={c("pf")}>
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> ใบถัดไป · <kbd>Esc</kbd> ปิด
        </span>
        <Link href={`/orders/${order.id}`} className={c("btn primary sm")}>
          เปิดออเดอร์
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
