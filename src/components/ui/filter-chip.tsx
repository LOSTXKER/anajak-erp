import * as React from "react";
import { cn } from "@/lib/utils";
import { FOCUS_INSET } from "./tokens";
import { CONTROL_MIN_H } from "./control-size";

interface FilterChipProps {
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
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        CONTROL_MIN_H,
        "-mb-px inline-flex touch-manipulation items-center gap-1.5 whitespace-nowrap border-0 border-b-2 bg-transparent px-1 py-1 text-xs transition-colors",
        FOCUS_INSET,
        selected
          ? "border-slate-900 font-semibold text-strong dark:border-white"
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
