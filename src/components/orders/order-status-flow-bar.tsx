"use client";

import { cn } from "@/lib/utils";
import {
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_COLORS,
  INTERNAL_STATUS_EXCEPTIONS,
  INTERNAL_STATUS_STAGES,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

/* ============================================================
   แถบเส้นทางงานเหนือตาราง (เบสเคาะแบบ C 2026-08-01)

   อ่านซ้ายไปขวาเป็นเส้นทางงานจริง: รับงาน → ออกแบบ → ผลิต → ส่งของ → ปิดงาน
   ตอบคำถาม "ตอนนี้งานกองอยู่ช่วงไหนของสายการผลิต" ได้ในตาเดียว —
   ซึ่งการ์ดเรียงตารางรอบก่อนตอบไม่ได้ เพราะสายตาต้องไล่อ่านทีละใบ

   ที่มา: รอบก่อนเป็นการ์ดตาราง 14 ใบ 3 แถว — 11 ใบเป็นเลข 0 แต่กินที่เท่าใบที่มีงานจริง
   แถวสุดท้ายเหลือ 4 ใบไม่เต็มแถว และการ์ดกว้าง 300px มีแค่ชื่อกับเลข ช่องว่างเวิ้งว้าง
   แบบนี้สูง ~95px (จาก ~210px)

   จอแคบสลับเป็นการ์ดเรียง 2 คอลัมน์เอง — หลายช่องในแนวนอนบนมือถือแคบจนกดไม่ถูก
   (วัดจากความกว้างพื้นที่จริงด้วย @container ไม่ใช่ความกว้างหน้าต่าง)

   รอบดูจอจริง 2026-08-02: พักงาน/ยกเลิกไม่ใช่ขั้นถัดไปของ flow จึงแยกเป็น
   "นอกเส้นทาง" แต่ยังคงเป็นปุ่มกรองครบ · สถานะเลขศูนย์ใช้ขีดและไม่วาดแถบ
   เพื่อลดเสียงรบกวน โดยชื่อเต็มยังอยู่ใน aria-label/title
   ============================================================ */

function dotFor(status: InternalStatus) {
  const c = INTERNAL_STATUS_COLORS[status];
  if (!c) return "bg-slate-400";
  if (c.text.includes("green")) return "bg-green-500";
  if (c.text.includes("red")) return "bg-red-500";
  if (c.text.includes("amber") || c.text.includes("yellow")) return "bg-amber-500";
  if (c.text.includes("blue")) return "bg-blue-500";
  return "bg-slate-400";
}

const FLOW_STATUS_ORDER = INTERNAL_STATUS_STAGES.flatMap(
  (s) => s.statuses,
) as InternalStatus[];

const COMPACT_STATUS_LABELS: Partial<Record<InternalStatus, string>> = {
  CONFIRMED: "ยืนยัน",
  DESIGNING: "ออกแบบ",
  DESIGN_APPROVED: "อนุมัติ",
  PRODUCTION_QUEUE: "รอผลิต",
  PRODUCING: "ผลิต",
  QUALITY_CHECK: "ตรวจงาน",
  PACKING: "แพ็ค",
  READY_TO_SHIP: "พร้อมส่ง",
  SHIPPED: "ส่งแล้ว",
  COMPLETED: "เสร็จ",
};

function compactLabelFor(status: InternalStatus) {
  return COMPACT_STATUS_LABELS[status] ?? INTERNAL_STATUS_LABELS[status];
}

function displayCount(count: number) {
  return count === 0 ? "—" : count;
}

function MobileStatusButton({
  status,
  count,
  isOn,
  onPress,
}: {
  status: InternalStatus;
  count: number;
  isOn: boolean;
  onPress: () => void;
}) {
  const fullLabel = INTERNAL_STATUS_LABELS[status];
  return (
    <button
      type="button"
      aria-label={`${fullLabel} · ${count} งาน`}
      aria-pressed={isOn}
      title={`${fullLabel} · ${count} งาน`}
      onClick={onPress}
      className={cn(
        "card-surface flex min-h-11 items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left",
        FOCUS_BUTTON,
        isOn &&
          "bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-xs leading-tight",
          isOn
            ? "font-medium text-blue-700 dark:text-blue-300"
            : count === 0
              ? "text-slate-500 dark:text-slate-400"
              : "text-slate-600 dark:text-slate-400",
        )}
      >
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotFor(status))}
        />
        <span className="truncate">{compactLabelFor(status)}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-base font-semibold leading-none tabular-nums",
          count === 0
            ? "font-normal text-slate-500 dark:text-slate-400"
            : isOn
              ? "text-blue-700 dark:text-blue-300"
              : "text-slate-900 dark:text-white",
        )}
      >
        {displayCount(count)}
      </span>
    </button>
  );
}

function DesktopStatusButton({
  status,
  count,
  isOn,
  onPress,
  max,
}: {
  status: InternalStatus;
  count: number;
  isOn: boolean;
  onPress: () => void;
  /** มีค่า = สถานะใน flow และต้องวาดแถบสัดส่วน · ไม่มีค่า = สถานะนอกเส้นทาง */
  max?: number;
}) {
  const fullLabel = INTERNAL_STATUS_LABELS[status];
  const isFlowStatus = max !== undefined;
  const ratioMax = max ?? 1;

  return (
    <button
      type="button"
      aria-label={`${fullLabel} · ${count} งาน`}
      aria-pressed={isOn}
      title={`${fullLabel} · ${count} งาน`}
      onClick={onPress}
      className={cn(
        "rounded-lg px-1 py-1.5 text-center transition-colors",
        FOCUS_BUTTON,
        isOn
          ? "bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
      )}
    >
      <span
        className={cn(
          "block text-lg font-semibold leading-none tabular-nums",
          count === 0
            ? "font-normal text-slate-500 dark:text-slate-400"
            : isOn
              ? "text-blue-700 dark:text-blue-300"
              : "text-slate-900 dark:text-white",
        )}
      >
        {displayCount(count)}
      </span>
      <span
        className={cn(
          "mt-1 max-w-full text-2xs leading-tight",
          isFlowStatus ? "block truncate" : "inline-flex items-center gap-1",
          isOn
            ? "font-medium text-blue-700 dark:text-blue-300"
            : "text-slate-500 dark:text-slate-400",
        )}
      >
        {isFlowStatus ? null : (
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotFor(status))}
          />
        )}
        <span className="truncate">{compactLabelFor(status)}</span>
      </span>
      {isFlowStatus ? (
        <span
          className={cn(
            "mt-1.5 block h-1 overflow-hidden rounded-full",
            count === 0 ? "bg-transparent" : "bg-slate-200 dark:bg-white/10",
          )}
        >
          <span
            className={cn("block h-full rounded-full", dotFor(status))}
            style={{ width: `${Math.round((count / ratioMax) * 100)}%` }}
          />
        </span>
      ) : null}
    </button>
  );
}

export function OrderStatusFlowBar({
  counts,
  selected,
  onSelect,
  isLoading,
}: {
  /** จำนวนงานต่อสถานะ — นับจากตัวกรองอื่นที่เปิดอยู่ แต่ไม่รวมตัวสถานะเอง */
  counts: Record<string, number> | undefined;
  selected: string;
  onSelect: (status: string) => void;
  isLoading?: boolean;
}) {
  const countOf = (s: InternalStatus) => counts?.[s] ?? 0;
  // แถบสัดส่วนเทียบกับสถานะที่มีงานเยอะสุด — บอก "กองอยู่ตรงไหน" โดยไม่ต้องอ่านเลข
  const max = Math.max(1, ...FLOW_STATUS_ORDER.map(countOf));
  const columns = {
    gridTemplateColumns: `repeat(${FLOW_STATUS_ORDER.length}, minmax(0, 1fr))`,
  };

  return (
    <div className={cn("@container", isLoading && "opacity-60")}>
      {/* ── เส้นทางงาน (พื้นที่กว้างพอ) ── */}
      <div
        role="group"
        aria-label="กรองตามสถานะงาน"
        className="card-surface hidden rounded-2xl px-3 py-3 @4xl:block"
      >
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="grid gap-1.5" style={columns}>
              {INTERNAL_STATUS_STAGES.map((stage) => (
                <p
                  key={stage.label}
                  style={{ gridColumn: `span ${stage.statuses.length}` }}
                  className="border-b-2 border-slate-100 pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400"
                >
                  {stage.label}
                </p>
              ))}
            </div>

            <div className="mt-2 grid gap-1.5" style={columns}>
              {FLOW_STATUS_ORDER.map((status) => (
                <DesktopStatusButton
                  key={status}
                  status={status}
                  count={countOf(status)}
                  isOn={selected === status}
                  onPress={() => onSelect(selected === status ? "" : status)}
                  max={max}
                />
              ))}
            </div>
          </div>

          <div
            role="group"
            aria-label="สถานะนอกเส้นทางงาน"
            className="w-44 shrink-0 border-l border-slate-100 pl-3 dark:border-slate-800"
          >
            <p className="border-b-2 border-slate-100 pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              นอกเส้นทาง
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {INTERNAL_STATUS_EXCEPTIONS.map((status) => (
                <DesktopStatusButton
                  key={status}
                  status={status}
                  count={countOf(status)}
                  isOn={selected === status}
                  onPress={() => onSelect(selected === status ? "" : status)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── จอแคบ: การ์ดเรียง 2 คอลัมน์ + แยกสถานะนอกเส้นทาง ── */}
      <div className="space-y-3 @4xl:hidden">
        <div
          role="group"
          aria-label="กรองตามสถานะในเส้นทางงาน"
          className="grid grid-cols-2 gap-2"
        >
          {FLOW_STATUS_ORDER.map((status) => (
            <MobileStatusButton
              key={status}
              status={status}
              count={countOf(status)}
              isOn={selected === status}
              onPress={() => onSelect(selected === status ? "" : status)}
            />
          ))}
        </div>
        <div role="group" aria-label="สถานะนอกเส้นทางงาน">
          <p className="mb-2 px-1 text-2xs font-medium text-slate-500 dark:text-slate-400">
            นอกเส้นทาง
          </p>
          <div className="grid grid-cols-2 gap-2">
            {INTERNAL_STATUS_EXCEPTIONS.map((status) => (
              <MobileStatusButton
                key={status}
                status={status}
                count={countOf(status)}
                isOn={selected === status}
                onPress={() => onSelect(selected === status ? "" : status)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
