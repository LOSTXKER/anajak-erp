"use client";

import { cn } from "@/lib/utils";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

/* ============================================================
   แถบเส้นทางงาน + ตัวกรอง — ภาษาเดียวใช้ได้ทุกหน้าที่มี "งานกองอยู่ช่วงไหน"

   ยกไส้ในมาจาก `orders/order-status-flow-bar.tsx` (เบสเคาะแบบ C 2026-08-01)
   เพื่อให้หน้าออเดอร์กับหน้าผลิตใช้หน้าตาชุดเดียวกันจริง — เดิมหน้าผลิตเขียนแถบ
   ของตัวเองขึ้นใหม่ ซึ่งซ้ำแนวคิดแต่หน้าตาไม่ตรงกัน (เบสทัก 2026-08-15)

   ตัวนี้ไม่รู้จัก InternalStatus หรือสายการผลิต — caller แปลงข้อมูลของตัวเอง
   มาเป็น item แล้วส่งเข้ามา (สถานะออเดอร์อยู่ได้ค่าเดียว ส่วนงานผลิตอยู่ได้
   หลายสายพร้อมกัน — คนละมิติ ยัดเข้า component เดียวจะได้ของที่มี if เต็มไปหมด)

   อ่านซ้ายไปขวาเป็นเส้นทางงานจริง · จอกว้างเป็นแถวเดียวมีแถบสัดส่วน ·
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
  return (
    <button
      type="button"
      aria-label={`${fullLabel} · ${item.count} งาน`}
      aria-pressed={isOn}
      title={`${fullLabel} · ${item.count} งาน`}
      onClick={onPress}
      className={cn(
        "flex min-h-11 items-center justify-between gap-2 border-b-2 bg-transparent px-1 py-2 text-left transition-colors",
        FOCUS_BUTTON,
        isOn ? "border-slate-900 text-strong dark:border-white" : "border-transparent",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-xs leading-tight",
          isOn
            ? "font-semibold text-strong"
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
                ? "text-strong"
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
                  ? "text-strong"
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
  max,
}: {
  item: FlowFilterItem;
  isOn: boolean;
  onPress: () => void;
  /** มีค่า = อยู่ในเส้นทางและต้องวาดแถบสัดส่วน · ไม่มีค่า = อยู่นอกเส้นทาง */
  max?: number;
}) {
  const fullLabel = item.fullLabel ?? item.label;
  const inFlow = max !== undefined;
  const ratioMax = max ?? 1;

  return (
    <button
      type="button"
      aria-label={`${fullLabel} · ${item.count} งาน`}
      aria-pressed={isOn}
      title={`${fullLabel} · ${item.count} งาน`}
      onClick={onPress}
      className={cn(
        "group border-b-2 px-1 py-1.5 text-center transition-colors",
        FOCUS_BUTTON,
        isOn
          ? "border-slate-900 text-strong dark:border-white"
          : "border-transparent hover:text-strong active:text-strong",
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
              ? "text-strong"
              : "text-slate-900 dark:text-white",
        )}
      >
        {displayCount(item.count)}
      </span>
      <span
        className={cn(
          "mt-1 max-w-full text-2xs leading-tight",
          inFlow ? "block truncate" : "inline-flex items-center gap-1",
          isOn
            ? "font-semibold text-strong"
            : "text-slate-500 group-hover:text-secondary group-active:text-secondary dark:text-slate-400 dark:group-hover:text-secondary dark:group-active:text-secondary",
        )}
      >
        {inFlow ? null : (
          <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.dotClass)} />
        )}
        <span className="truncate">{item.label}</span>
      </span>
      {item.alert !== undefined && item.alert > 0 && (
        <span className="mt-1 block">
          <AlertBadge value={item.alert} isOn={isOn} />
        </span>
      )}
      {inFlow ? (
        <span
          className={cn(
            "mt-1.5 block h-1 overflow-hidden rounded-full",
            item.count === 0 ? "bg-transparent" : "bg-slate-200 dark:bg-white/10",
          )}
        >
          <span
            className={cn("block h-full rounded-full", item.dotClass)}
            style={{ width: `${Math.round((item.count / ratioMax) * 100)}%` }}
          />
        </span>
      ) : null}
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
  // แถบสัดส่วนเทียบกับรายการที่มีงานเยอะสุด — บอก "กองอยู่ตรงไหน" โดยไม่ต้องอ่านเลข
  const max = Math.max(1, ...items.map((item) => item.count));
  const columns = { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` };
  const toggle = (key: string) => onSelect(selected === key ? "" : key);

  return (
    <div className={cn("@container transition-opacity duration-200", isLoading && "opacity-60")}>
      {/* ── เส้นทางงาน (พื้นที่กว้างพอ) ── */}
      <div role="group" aria-label={ariaLabel} className="hidden border-y border-divider py-3 @4xl:block">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {groups && groups.length > 0 && (
              <div className="grid gap-1.5" style={columns}>
                {groups.map((group) => (
                  <p
                    key={group.label}
                    style={{ gridColumn: `span ${group.keys.length}` }}
                    className="border-b-2 border-slate-100 pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400"
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
                  max={max}
                />
              ))}
            </div>
          </div>

          {aside && aside.items.length > 0 && (
            <div
              role="group"
              aria-label={aside.ariaLabel}
              className="w-44 shrink-0 border-l border-slate-100 pl-3 dark:border-slate-800"
            >
              <p className="border-b-2 border-slate-100 pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
