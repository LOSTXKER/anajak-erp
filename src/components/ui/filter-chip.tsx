import * as React from "react";
import { cn } from "@/lib/utils";
import { ACTIVE_UNDERLINE, FOCUS_INSET } from "./tokens";
import { CONTROL_MIN_H } from "./control-size";

/* `aria-label`/`title` ส่งผ่านได้ (2026-08-31) — ชิปที่มีตัวเลขเกาะอยู่ข้างใน
   ต้องบอกความหมายเต็มให้ screen reader ได้ เช่น "ต้องจัดการ · 4 งาน · กดเพื่อกรอง"
   ไม่งั้นคนที่ใช้เสียงอ่านจะได้ยินแค่ "ต้องจัดการ 4" ซึ่งไม่รู้ว่ากดแล้วเกิดอะไร */
interface FilterChipProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "type"> {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** ไอคอนความหมายของตัวกรอง แสดงเหมือนเดิมทั้งสองสถานะ */
  icon?: React.ReactNode;
  className?: string;
  /** คง prop ไว้ให้ caller เดิมใช้ต่อได้; filter แบบ minimal ไม่มีผิวแยกชั้นแล้ว */
  surface?: "muted" | "raised";
}

export function FilterChip({
  selected,
  onClick,
  children,
  icon,
  className,
  surface,
  ...rest
}: FilterChipProps) {
  // ดึงออกจาก rest เพื่อไม่ให้ไหลลง <button> เป็น attribute ที่ DOM ไม่รู้จัก
  // (สูตรเดียวกับ controlShapeClass ใน tokens.ts ที่คง prop ไว้ให้ caller เดิม)
  void surface;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      {...rest}
      className={cn(
        CONTROL_MIN_H,
        "-mb-px inline-flex touch-manipulation items-center gap-1.5 whitespace-nowrap border-0 border-b-2 bg-transparent px-1 py-1 text-xs transition-colors",
        FOCUS_INSET,
        selected
          ? ACTIVE_UNDERLINE
          : "border-transparent font-medium text-muted hover:text-secondary active:text-strong",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
        >
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
