"use client";

import { cn } from "@/lib/utils";
import {
  ACTIVE_UNDERLINE,
  FOCUS_BUTTON,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  RADIUS,
} from "@/components/ui/tokens";

/* ============================================================
   แถบเส้นทางงาน + ตัวกรอง — ภาษาเดียวใช้ได้ทุกหน้าที่มี "งานกองอยู่ช่วงไหน"

   ยกไส้ในมาจาก `orders/order-status-flow-bar.tsx` (เบสเคาะแบบ C 2026-08-01)
   เพื่อให้หน้าออเดอร์กับหน้าผลิตใช้หน้าตาชุดเดียวกันจริง — เดิมหน้าผลิตเขียนแถบ
   ของตัวเองขึ้นใหม่ ซึ่งซ้ำแนวคิดแต่หน้าตาไม่ตรงกัน (เบสทัก 2026-08-15)

   ตัวนี้ไม่รู้จัก InternalStatus หรือสายการผลิต — caller แปลงข้อมูลของตัวเอง
   มาเป็น item แล้วส่งเข้ามา (สถานะออเดอร์อยู่ได้ค่าเดียว ส่วนงานผลิตอยู่ได้
   หลายสายพร้อมกัน — คนละมิติ ยัดเข้า component เดียวจะได้ของที่มี if เต็มไปหมด)

   อ่านซ้ายไปขวาเป็นเส้นทางงานจริง · จอกว้างเป็นแถวเดียวมีจุดสีบอกประเภท ·
   จอแคบสลับเป็นการ์ด 2 คอลัมน์ (วัดจากพื้นที่จริงด้วย @container ไม่ใช่ขนาดหน้าต่าง)
   ============================================================ */

export type FlowFilterItem = {
  key: string;
  /** ป้ายสั้นบนปุ่ม */
  label: string;
  /** ป้ายเต็มสำหรับ aria-label/title — ไม่ส่ง = ใช้ label */
  fullLabel?: string;
  count: number;
  /** คลาสสีจุดนำหน้า เช่น "bg-blue-500" */
  dotClass: string;
  /** ตัวเลขที่ต้องเตือน (เช่น งานเลยกำหนดในสายนี้) — ไม่ส่ง = ไม่มีป้าย */
  alert?: number;
};

export type FlowFilterGroup = { label: string; keys: string[] };

function displayCount(count: number) {
  return count === 0 ? "—" : count;
}

function filterActionLabel(fullLabel: string, count: number, isOn: boolean) {
  const action = isOn ? "เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง" : "กดเพื่อกรอง";
  return `${fullLabel} · ${count} งาน · ${action}`;
}

function AlertBadge({ value, isOn }: { value: number; isOn: boolean }) {
  if (value <= 0) return null;
  return (
    <span
      className={cn(
        "ml-1 inline-flex shrink-0 items-center rounded-full px-1.5 text-2xs font-semibold tabular-nums",
        isOn ? "bg-surface text-red-700 dark:text-red-700" : "bg-red-700 text-white",
      )}
    >
      เลย {value}
    </span>
  );
}

function MobileItemButton({
  item,
  isOn,
  onPress,
}: {
  item: FlowFilterItem;
  isOn: boolean;
  onPress: () => void;
}) {
  const fullLabel = item.fullLabel ?? item.label;
  const actionLabel = filterActionLabel(fullLabel, item.count, isOn);
  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-pressed={isOn}
      title={actionLabel}
      onClick={onPress}
      className={cn(
        RADIUS.item,
        "flex min-h-11 cursor-pointer items-center justify-between gap-2 border-b-2 bg-transparent px-1 py-2 text-left transition-colors",
        FOCUS_BUTTON,
        isOn
          ? cn(ACTIVE_UNDERLINE, "hover:bg-interactive-hover active:bg-interactive-pressed")
          : cn("border-transparent", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-xs leading-tight",
          isOn
            ? "font-semibold text-blue-700 dark:text-blue-400"
            : item.count === 0
              ? "text-slate-500 dark:text-slate-400"
              : "text-slate-600 dark:text-slate-400",
        )}
      >
        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.dotClass)} />
        <span className="truncate">{item.label}</span>
      </span>
      {item.alert === undefined ? (
        <span
          className={cn(
            "shrink-0 text-base font-semibold leading-none tabular-nums",
            item.count === 0
              ? "font-normal text-slate-500 dark:text-slate-400"
              : isOn
                ? "text-blue-700 dark:text-blue-400"
                : "text-slate-900 dark:text-white",
          )}
        >
          {displayCount(item.count)}
        </span>
      ) : (
        <span className="flex shrink-0 items-center">
          <span
            className={cn(
              "text-base font-semibold leading-none tabular-nums",
              item.count === 0
                ? "font-normal text-slate-500 dark:text-slate-400"
                : isOn
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-slate-900 dark:text-white",
            )}
          >
            {displayCount(item.count)}
          </span>
          <AlertBadge value={item.alert} isOn={isOn} />
        </span>
      )}
    </button>
  );
}

function DesktopItemButton({
  item,
  isOn,
  onPress,
}: {
  item: FlowFilterItem;
  isOn: boolean;
  onPress: () => void;
}) {
  const fullLabel = item.fullLabel ?? item.label;
  const actionLabel = filterActionLabel(fullLabel, item.count, isOn);

  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-pressed={isOn}
      title={actionLabel}
      onClick={onPress}
      className={cn(
        RADIUS.item,
        "group cursor-pointer border-b-2 px-1 py-1.5 text-center transition-colors",
        FOCUS_BUTTON,
        isOn
          ? cn(ACTIVE_UNDERLINE, "hover:bg-interactive-hover active:bg-interactive-pressed")
          : cn("border-transparent", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
      )}
    >
      <span
        className={cn(
          "block text-lg font-semibold leading-none tabular-nums",
          item.count === 0
            ? cn(
                "font-normal text-slate-500 dark:text-slate-400",
                !isOn &&
                  "group-hover:text-secondary group-active:text-secondary dark:group-hover:text-secondary dark:group-active:text-secondary",
              )
            : isOn
              ? "text-blue-700 dark:text-blue-400"
              : "text-slate-900 dark:text-white",
        )}
      >
        {displayCount(item.count)}
      </span>
      <span
        className={cn(
          "mt-1 inline-flex max-w-full items-center justify-center gap-1.5 text-2xs leading-tight",
          isOn
            ? "font-semibold text-blue-700 dark:text-blue-400"
            : "text-slate-500 group-hover:text-secondary group-active:text-secondary dark:text-slate-400 dark:group-hover:text-secondary dark:group-active:text-secondary",
        )}
      >
        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.dotClass)} />
        <span className="truncate">{item.label}</span>
      </span>
      {item.alert !== undefined && item.alert > 0 && (
        <span className="mt-1 block">
          <AlertBadge value={item.alert} isOn={isOn} />
        </span>
      )}
    </button>
  );
}

export function FlowFilterBar({
  items,
  groups,
  aside,
  selected,
  onSelect,
  isLoading,
  ariaLabel,
  mobileAriaLabel,
}: {
  /** รายการในเส้นทางงาน เรียงซ้ายไปขวาตามลำดับจริง */
  items: readonly FlowFilterItem[];
  /** หัวช่วงเหนือรายการ (จอกว้าง) — ไม่ส่ง = ไม่มีหัวช่วง */
  groups?: readonly FlowFilterGroup[];
  /** กลุ่มนอกเส้นทาง เช่น พักงาน/ยกเลิก */
  aside?: { label: string; ariaLabel: string; items: readonly FlowFilterItem[] };
  selected: string;
  onSelect: (key: string) => void;
  isLoading?: boolean;
  ariaLabel: string;
  /** aria-label ของกลุ่มบนจอแคบ — ไม่ส่ง = ใช้ ariaLabel */
  mobileAriaLabel?: string;
}) {
  const columns = { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` };
  const toggle = (key: string) => onSelect(selected === key ? "" : key);

  return (
    <div className={cn("@container transition-opacity duration-200", isLoading && "opacity-60")}>
      <p className="mb-2 px-1 text-2xs text-muted @4xl:text-right">
        กดสถานะเพื่อกรอง · กดซ้ำเพื่อล้างตัวกรอง
      </p>

      {/* ── เส้นทางงาน (พื้นที่กว้างพอ) ── */}
      <div role="group" aria-label={ariaLabel} className="hidden @4xl:block">
        <div className="flex gap-5">
          <div className="min-w-0 flex-1">
            {groups && groups.length > 0 && (
              <div className="grid gap-1.5" style={columns}>
                {groups.map((group) => (
                  <p
                    key={group.label}
                    style={{ gridColumn: `span ${group.keys.length}` }}
                    className="border-b border-divider pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    {group.label}
                  </p>
                ))}
              </div>
            )}

            <div className={cn(groups && groups.length > 0 && "mt-2", "grid gap-1.5")} style={columns}>
              {items.map((item) => (
                <DesktopItemButton
                  key={item.key}
                  item={item}
                  isOn={selected === item.key}
                  onPress={() => toggle(item.key)}
                />
              ))}
            </div>
          </div>

          {aside && aside.items.length > 0 && (
            <div
              role="group"
              aria-label={aside.ariaLabel}
              className="w-44 shrink-0"
            >
              <p className="border-b border-divider pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {aside.label}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {aside.items.map((item) => (
                  <DesktopItemButton
                    key={item.key}
                    item={item}
                    isOn={selected === item.key}
                    onPress={() => toggle(item.key)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── จอแคบ: การ์ดเรียง 2 คอลัมน์ ── */}
      <div className="space-y-3 @4xl:hidden">
        <div role="group" aria-label={mobileAriaLabel ?? ariaLabel} className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <MobileItemButton
              key={item.key}
              item={item}
              isOn={selected === item.key}
              onPress={() => toggle(item.key)}
            />
          ))}
        </div>
        {aside && aside.items.length > 0 && (
          <div role="group" aria-label={aside.ariaLabel}>
            <p className="mb-2 px-1 text-2xs font-medium text-slate-500 dark:text-slate-400">
              {aside.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {aside.items.map((item) => (
                <MobileItemButton
                  key={item.key}
                  item={item}
                  isOn={selected === item.key}
                  onPress={() => toggle(item.key)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
