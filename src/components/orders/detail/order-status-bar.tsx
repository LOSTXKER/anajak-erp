"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { INTERNAL_STATUS_LABELS, CUSTOMER_STATUS_COLORS } from "@/lib/order-status";
import {
  findOffPathAnchor,
  railStepState,
  type RailStepState,
  type StatusRevisionLike,
} from "@/lib/order-status-rail";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FOCUS_INSET, RADIUS } from "@/components/ui/tokens";

/* ============================================================
   แถบสถานะ = "ราง" ขั้นต่อกัน (เบสเคาะแบบ A จาก 3 ตัวอย่าง 2026-08-11)

   ของเดิมเป็นป้าย 11 อันในกริด น้ำหนักเท่ากันหมดและไม่มีอะไรเชื่อมกัน
   ตาจึงอ่านไม่ออกว่าอะไรมาก่อนมาหลัง — เบส: "อยากได้เป็นสถานะต่อๆกัน"
   ตอนนี้เป็นจุดเรียงต่อด้วยเส้น อ่านซ้าย→ขวาเป็นเส้นทางงานจริง ป้ายอยู่ใต้จุด

   กติกาที่ตั้งใจ (อย่าเปลี่ยนโดยไม่ถามเบส):
   - **อ่านอย่างเดียว** ไม่ใช่ปุ่มกดเปลี่ยนสถานะ — การเดินสถานะอยู่ที่แถบ "ขั้นต่อไป"
     ที่เดียว (UX4.9 เสียงเดียว) ถ้าทำรางกดได้ จะมี 2 ทางที่ทำเรื่องเดียวกันแต่
     ด่าน readiness ไม่เท่ากัน
   - **ห้าม truncate ป้ายไทย** — ไทยไม่มีเว้นวรรค ellipsis จะตัดกลางคำ/แยกสระ
     ที่แคบให้ขึ้นบรรทัดใหม่หรือเลื่อนรางแทน
   - จอแคบ: รางเลื่อนแนวนอน + เลื่อนขั้นปัจจุบันมาไว้กลางให้เอง (ไม่งั้นเปิดมา
     เห็นแต่ขั้นแรกๆ ซึ่งเป็นอดีตทั้งหมด) · ไม่ใช้ breakpoint — ปล่อยให้ min-width
     ของขั้นตัดสินเองว่าพื้นที่พอไหม จึงถูกทั้งบนมือถือและตอนการ์ดโดนบีบ
   - พักงาน/ยกเลิก **ไม่แทรกเป็นขั้นที่ 12** — สองตัวนี้ไม่ใช่ขั้นของสายงาน
     แต่รางยังชี้ "ค้างที่ขั้นไหน" ได้จากประวัติ (order-status-rail.ts)
   ============================================================ */

const NODE_SIZE = "h-[18px] w-[18px]";

interface OrderStatusBarProps {
  flowSteps: string[];
  currentStepIndex: number;
  internalStatus: string;
  customerStatus: string;
  /** ประวัติออเดอร์ — ใช้หาว่างานพัก/ยกเลิกค้างไว้ที่ขั้นไหน (ไม่มีก็ยังทำงานได้ แค่ไม่ชี้ขั้น) */
  revisions?: StatusRevisionLike[];
  /** เวลา+เหตุผลที่ยกเลิก (มีเฉพาะใบที่ยกเลิก — พักงานไม่มีช่องเก็บเหตุผลในฐานข้อมูล) */
  cancelledAt?: Date | string | null;
  cancelledReason?: string | null;
  /** ด่านที่ยังไม่ผ่าน ทำให้งานเดินต่อไม่ได้ — โผล่เฉพาะตอนติดจริง (nextStepBlockers)
   *  เดิมข้อความนี้อยู่บนแถบ "ขั้นต่อไป" ที่เบสสั่งถอดออก 2026-08-11 · ต้องมีที่อยู่
   *  ไม่งั้นปุ่มหายไปเฉยๆ โดยไม่บอกเหตุผล = คนไม่รู้ว่าต้องแก้อะไรถึงจะไปต่อได้ */
  blockers?: string[];
}

export function OrderStatusBar({
  flowSteps,
  currentStepIndex,
  internalStatus,
  customerStatus,
  revisions,
  cancelledAt,
  cancelledReason,
  blockers = [],
}: OrderStatusBarProps) {
  const railRef = useRef<HTMLOListElement>(null);

  const isCancelled = internalStatus === "CANCELLED";
  const isOnHold = internalStatus === "ON_HOLD";
  const isOffPath = currentStepIndex < 0;

  const label = (status: string) =>
    (INTERNAL_STATUS_LABELS as Record<string, string>)[status] ?? status;

  const currentLabel = label(internalStatus);

  // งานหลุดเส้นทาง (พัก/ยกเลิก) → ยืมตำแหน่งของขั้นที่ค้างไว้มาไฮไลต์
  const offPathAnchor = isOffPath
    ? findOffPathAnchor({ internalStatus, flowSteps, revisions })
    : null;
  const anchorIndex = isOffPath ? (offPathAnchor?.index ?? -1) : currentStepIndex;

  const tone = isCancelled ? "cancel" : isOnHold ? "hold" : "normal";

  // จุดหัวแถบ: ปกติใช้สีตามสถานะฝั่งลูกค้า (ภาษาเดียวกับป้ายสถานะที่อื่นทั้งเว็บ)
  const headDot = isCancelled
    ? "bg-red-500"
    : isOnHold
      ? "bg-amber-500"
      : ((CUSTOMER_STATUS_COLORS as Record<string, { dot: string }>)[customerStatus]?.dot ??
        "bg-blue-500");

  // บรรทัดหมายเหตุ — โผล่เฉพาะตอนไม่ปกติ จึงไม่กินความสูงในเคสทั่วไป
  // เหตุผลมีจริงเฉพาะการยกเลิก (Order.cancelledReason) · พักงานบอกได้แค่ว่าพักตั้งแต่เมื่อไหร่
  const noteParts: string[] = [];
  if (isCancelled) {
    const when = cancelledAt ?? offPathAnchor?.at;
    noteParts.push(when ? `ยกเลิก ${formatDate(when)}` : "ยกเลิกแล้ว");
    if (cancelledReason?.trim()) noteParts.push(cancelledReason.trim());
  } else if (isOnHold && offPathAnchor) {
    noteParts.push(`พักงานตั้งแต่ ${formatDate(offPathAnchor.at)}`);
    noteParts.push(`เดินต่อจาก ${label(offPathAnchor.status)}`);
  }
  const note = noteParts.join(" — ");

  // เปิดหน้ามาต้องเห็นขั้นที่ยืนอยู่ทันที ถึงรางจะยาวเกินจอ
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const node = rail.querySelector<HTMLLIElement>('[data-state="current"]');
    if (!node) return;
    if (rail.scrollWidth <= rail.clientWidth + 1) return;
    rail.scrollLeft = node.offsetLeft - rail.clientWidth / 2 + node.offsetWidth / 2;
  }, [anchorIndex, flowSteps.length]);

  const stepStateLabel: Record<RailStepState, string> = {
    done: "เสร็จสิ้น",
    current: isCancelled ? "หยุดที่ขั้นนี้" : isOnHold ? "ค้างที่ขั้นนี้" : "กำลังดำเนินการ",
    todo: "รอดำเนินการ",
    skipped: "ไม่ได้ทำต่อ",
  };

  return (
    <div className="border-y border-divider py-3.5">
      {/* หัวแถบ ("สถานะตอนนี้ / กำลังผลิต / ขั้น 6/11") ถูกตัดออกตอนงานปกติ — เบสสั่ง 2026-08-11
          เพราะรางบอกซ้ำอยู่แล้ว (ขั้นที่ยืนอยู่เป็นตัวหนาน้ำเงิน + ตำแหน่งบนรางบอกความคืบหน้า)
          แต่ **พักงาน/ยกเลิกไม่มีจุดบนราง** ถ้าตัดด้วยจะกลายเป็นงานพักดูเหมือนงานปกติ
          จึงเหลือบรรทัดเดียวไว้เฉพาะสถานะนอกเส้นทาง (โผล่เฉพาะตอนไม่ปกติ = ไม่กินที่ในเคสทั่วไป) */}
      {isOffPath && (
        <div className="mb-3 flex min-h-[22px] flex-wrap items-center gap-2">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", headDot)} aria-hidden="true" />
          <span
            className={cn(
              "text-sm font-semibold",
              isCancelled
                ? "text-red-700 dark:text-red-300"
                : "text-amber-800 dark:text-amber-300",
            )}
          >
            {currentLabel}
          </span>
          {offPathAnchor && (
            <Badge variant={isCancelled ? "destructive" : "warning"} size="sm" className="shrink-0">
              {isCancelled ? "หยุดที่" : "ค้างที่"} {label(offPathAnchor.status)}
            </Badge>
          )}
        </div>
      )}

      {anchorIndex >= 0 && (
        <span
          className="sr-only"
          role="progressbar"
          aria-label="ความคืบหน้าคำสั่งซื้อ"
          aria-valuenow={anchorIndex + 1}
          aria-valuemin={1}
          aria-valuemax={flowSteps.length}
          aria-valuetext={`${currentLabel} ขั้น ${anchorIndex + 1} จาก ${flowSteps.length}`}
        />
      )}

      {/* ราง: ทุกขั้นกว้างเท่ากันและอย่างน้อย 84px — พื้นที่ไม่พอเมื่อไหร่ก็เลื่อนแทนบีบป้าย */}
      <ol
        ref={railRef}
        aria-label="เส้นทางสถานะออเดอร์ เลื่อนซ้ายขวาเพื่อดูทุกขั้น"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- รางที่เลื่อนได้ต้องรับโฟกัสเพื่อให้ผู้ใช้คีย์บอร์ดดูทุกขั้นได้ (WCAG 2.1.1)
        tabIndex={0}
        className={cn("flex overflow-x-auto pb-0.5", RADIUS.item, FOCUS_INSET)}
      >
        {flowSteps.map((step, i) => {
          const st = railStepState({ index: i, anchorIndex, cancelled: isCancelled });
          const isFirst = i === 0;

          return (
            <li
              key={step}
              data-state={st}
              aria-current={st === "current" ? "step" : undefined}
              aria-label={`${label(step)}: ${stepStateLabel[st]}`}
              className={cn(
                "relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5 px-0.5",
                // เส้นเชื่อมไปยังขั้นก่อนหน้า — วาดจากกึ่งกลางขั้นนี้ย้อนไปกึ่งกลางขั้นก่อน
                "before:absolute before:top-2 before:-left-1/2 before:right-1/2 before:h-0.5 before:content-['']",
                isFirst && "before:hidden",
                st === "done" || st === "current"
                  ? tone === "hold"
                    ? "before:bg-amber-400 dark:before:bg-amber-600"
                    : tone === "cancel"
                      ? "before:bg-slate-300 dark:before:bg-slate-700"
                      : "before:bg-blue-400 dark:before:bg-blue-700"
                  : "before:bg-slate-200 dark:before:bg-slate-800",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-[1] flex shrink-0 items-center justify-center rounded-full",
                  NODE_SIZE,
                  st === "done" &&
                    (tone === "cancel"
                      ? "bg-slate-600 text-white dark:bg-slate-700"
                      : tone === "hold"
                        ? "bg-amber-700 text-white"
                        : "bg-blue-600 text-white"),
                  st === "current" &&
                    (tone === "cancel"
                      ? "bg-red-600 ring-[3px] ring-red-100 dark:ring-red-500/25"
                      : tone === "hold"
                        ? "bg-amber-500 ring-[3px] ring-amber-100 dark:ring-amber-500/25"
                        : "bg-blue-600 ring-[3px] ring-blue-100 dark:bg-blue-500 dark:ring-blue-500/25"),
                  (st === "todo" || st === "skipped") &&
                    "border-2 border-border bg-bg",
                )}
              >
                {st === "done" && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  // ห้าม truncate — ป้ายไทยยาวให้ขึ้นบรรทัดใหม่
                  "text-center text-2xs [overflow-wrap:anywhere]",
                  st === "current" &&
                    (tone === "cancel"
                      ? "font-semibold text-red-700 dark:text-red-300"
                      : tone === "hold"
                        ? "font-semibold text-amber-700 dark:text-amber-300"
                        : "font-semibold text-blue-700 dark:text-blue-300"),
                  st === "done" && "text-secondary",
                  st === "todo" && "text-muted",
                  st === "skipped" && "text-muted line-through",
                )}
              >
                {label(step)}
              </span>
            </li>
          );
        })}
      </ol>

      {note && (
        <p
          className={cn(
            "mt-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed [overflow-wrap:anywhere]",
            isCancelled
              ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
          )}
        >
          {note}
        </p>
      )}

      {blockers.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/40">
          <p className="font-medium text-amber-800 dark:text-amber-200">ยังไปต่อไม่ได้ — ติด:</p>
          <ul className="mt-1 space-y-1">
            {blockers.map((b) => (
              <li
                key={b}
                className="flex items-start gap-1.5 text-secondary [overflow-wrap:anywhere]"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOffPath && !offPathAnchor && (
        <p className="mt-2.5 text-xs text-secondary">
          สถานะ &quot;{currentLabel}&quot; อยู่นอกเส้นทางหลักของงานชนิดนี้
        </p>
      )}
    </div>
  );
}
