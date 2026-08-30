"use client";

import { useEffect, useRef } from "react";
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

/* วงกลมโตขึ้นจาก 18px เป็น 24px ตอนใส่ตัวเลขข้างใน (เบสสั่ง 2026-08-30
   "แต่ละจุดขอเป็น 1 2 3 4 ในวงกลมจุด") — 18px ใส่เลขแล้วอ่านไม่ออก
   ค่านี้ผูกกับอีก 3 ที่ในไฟล์ ซึ่งเขียนเป็นเลขตรง ๆ เพราะ Tailwind ต่อคลาสจากตัวแปร
   ไม่ได้ (ต้องเป็น literal ตอน build) — แก้ขนาดวงเมื่อไหร่ต้องไล่แก้ทั้งสามที่:
     · `top-[11px]` ของเส้นเชื่อม = รัศมี 12 ลบครึ่งความหนาเส้น 1
     · `right-[12px]` / `left-[12px]` = รัศมี ใช้บอกว่าเส้นจบตรงขอบวงของขั้นหัว-ท้าย
     · `flex-[0.5_1_12px]` = รัศมี ใช้ให้ระยะระหว่างจุดเท่ากันทุกช่วง */
const NODE_SIZE = "h-6 w-6";

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
    /* ไม่มีเส้นแบ่งเลย (เบสสั่ง 2026-08-30 "ไม่ต้องมีเส้นแบ่ง") — ส่วนบนของใบงาน
       แยกกลุ่มด้วยระยะห่างอย่างเดียว · เส้นเดียวที่เหลือในย่านนี้คือเส้นใต้แถบแท็บ
       ซึ่งเป็นของแถบแท็บเอง · เดิมเป็น border-y แล้วลดเหลือ border-t มาก่อนหน้านี้ */
    <div className="pb-1 pt-1">
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

      {/* ราง: ช่วงระหว่างจุดกว้างเท่ากันทุกช่วง — พื้นที่ไม่พอเมื่อไหร่ก็เลื่อนแทนบีบป้าย */}
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
          const isLast = i === flowSteps.length - 1;
          // สถานะของขั้นถัดไป — ใช้ระบายครึ่งขวาของเส้นที่พาดไปหาขั้นนั้น
          const stNext = isLast
            ? null
            : railStepState({ index: i + 1, anchorIndex, cancelled: isCancelled });

          return (
            <li
              key={step}
              data-state={st}
              aria-current={st === "current" ? "step" : undefined}
              aria-label={`${label(step)}: ${stepStateLabel[st]}`}
              className={cn(
                "relative flex flex-col gap-1.5 px-0.5",
                /* ระยะระหว่างจุดต้องเท่ากันทุกช่วง (เบสสั่ง 2026-08-30 "ความห่างแต่ละ
                   node ให้มันห่างสมมาตรหน่อย") — จุดหัว/ท้ายชิดขอบราง จุดกลางอยู่กึ่งกลาง
                   ช่องของตัวเอง ถ้าให้ทุกช่องกว้างเท่ากันหมด ช่วงแรกกับช่วงท้ายจะกว้าง
                   เป็น 1.5 เท่าของช่วงกลางทันที

                   สูตร: ช่องหัว/ท้าย = ครึ่งช่อง + รัศมีจุด (`flex: .5 1 9px`)
                   → จุดหัวอยู่ที่ 9px จากขอบซ้าย · จุดท้ายที่ 9px จากขอบขวา
                   · จุดที่เหลือเว้นเท่ากันหมดพอดี (พิสูจน์ด้วยการวัดจริงบนจอ 1440) */
                isFirst || isLast ? "min-w-[56px] flex-[0.5_1_12px]" : "min-w-[84px] flex-1",
                // ขอบนอกของขั้นหัว-ท้ายต้องไม่มี padding ไม่งั้นจุดยังเหลื่อมการ์ดข้างล่าง 2px
                isFirst ? "items-start pl-0" : isLast ? "items-end pr-0" : "items-center",

                /* เส้นเชื่อมแตกเป็นสองครึ่งในตัวขั้นเอง (before = ครึ่งซ้าย · after = ครึ่งขวา)
                   แทนการลากข้ามช่องด้วย -left-1/2 แบบเดิม — เพราะช่องหัว/ท้ายกว้างไม่เท่า
                   ช่องกลางแล้ว การอ้างเป็น % ของตัวเองจะไปไม่ถึง/เลยจุดของขั้นข้างเคียง
                   ครึ่งซ้ายของขั้นนี้กับครึ่งขวาของขั้นก่อนหน้ามาชนกันพอดีที่เส้นแบ่งช่อง */
                "before:absolute before:top-[11px] before:h-0.5 before:content-['']",
                "after:absolute after:top-[11px] after:h-0.5 after:content-['']",
                isFirst ? "before:hidden" : "before:left-0",
                isLast ? "before:right-[12px]" : "before:right-1/2",
                isLast ? "after:hidden" : "after:right-0",
                isFirst ? "after:left-[12px]" : "after:left-1/2",

                // ครึ่งซ้ายระบายตามสถานะของขั้นนี้ · ครึ่งขวาตามสถานะของขั้นถัดไป
                // (ผลลัพธ์บนจอเหมือนเดิมเป๊ะ: เส้นช่วง k→k+1 ใช้สีของขั้น k+1 ทั้งเส้น)
                st === "done" || st === "current"
                  ? tone === "hold"
                    ? "before:bg-amber-400 dark:before:bg-amber-600"
                    : tone === "cancel"
                      ? "before:bg-slate-300 dark:before:bg-slate-700"
                      : "before:bg-blue-400 dark:before:bg-blue-700"
                  : "before:bg-slate-200 dark:before:bg-slate-800",
                stNext === "done" || stNext === "current"
                  ? tone === "hold"
                    ? "after:bg-amber-400 dark:after:bg-amber-600"
                    : tone === "cancel"
                      ? "after:bg-slate-300 dark:after:bg-slate-700"
                      : "after:bg-blue-400 dark:after:bg-blue-700"
                  : "after:bg-slate-200 dark:after:bg-slate-800",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-[1] flex shrink-0 items-center justify-center rounded-full",
                  // เลขในวงกลมต้องความกว้างเท่ากันทุกตัว ไม่งั้น 1 กับ 11 ดูไม่อยู่กลางวง
                  "text-2xs font-semibold tabular-nums leading-none",
                  NODE_SIZE,
                  st === "done" &&
                    (tone === "cancel"
                      ? "bg-slate-600 text-white dark:bg-slate-700"
                      : tone === "hold"
                        ? "bg-amber-700 text-white"
                        : "bg-blue-600 text-white"),
                  st === "current" &&
                    (tone === "cancel"
                      ? "bg-red-600 text-white ring-[3px] ring-red-100 dark:ring-red-500/25"
                      : tone === "hold"
                        ? "bg-amber-500 text-white ring-[3px] ring-amber-100 dark:ring-amber-500/25"
                        : "bg-blue-600 text-white ring-[3px] ring-blue-100 dark:bg-blue-500 dark:ring-blue-500/25"),
                  (st === "todo" || st === "skipped") &&
                    "border-2 border-border bg-bg text-muted",
                )}
              >
                {/* เลขขั้นอยู่ในวงทุกสถานะ (เบสสั่ง) — เดิมขั้นที่ผ่านแล้วเป็นเครื่องหมายถูก
                    ตอนนี้บอก "ผ่านแล้ว" ด้วยวงทึบ + เส้นเชื่อมที่ติดสีแทน · ข้อดีคือ
                    สั่งงานทางโทรศัพท์อ้างเลขขั้นได้ ("งานอยู่ขั้น 6") */}
                {i + 1}
              </span>
              <span
                className={cn(
                  // ห้าม truncate — ป้ายไทยยาวให้ขึ้นบรรทัดใหม่
                  "text-2xs [overflow-wrap:anywhere]",
                  isFirst ? "text-left" : isLast ? "text-right" : "text-center",
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
