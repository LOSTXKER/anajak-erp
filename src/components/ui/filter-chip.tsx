import * as React from "react";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON, RADIUS } from "./tokens";
import { CONTROL_MIN_H } from "./control-size";

interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** ไอคอนความหมายตอนยังไม่เลือก; เมื่อเลือกจะเปลี่ยนเป็น Check ในช่องเดิม */
  icon?: React.ReactNode;
  className?: string;
  /** muted = ตัวเลือกในกลุ่ม/overlay · raised = ตัวกรองที่ยืนบนผืนหน้า */
  surface?: "muted" | "raised";
}

export function FilterChip({
  selected,
  onClick,
  children,
  icon,
  className,
  surface = "muted",
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        CONTROL_MIN_H,
        "inline-flex touch-manipulation items-center gap-1.5 whitespace-nowrap border px-3 py-1 text-xs transition-colors active:scale-[0.98]",
        RADIUS.item,
        FOCUS_BUTTON,
        selected
          // สถานะเลือกใช้พื้น + เส้น + น้ำหนักข้อความ ไม่พึ่ง Check หรือสีอย่างเดียว
          ? "border-blue-200 bg-interactive-selected font-semibold text-interactive-selected-text dark:border-blue-800"
          : surface === "raised"
            ? "border-border bg-surface font-medium text-secondary hover:border-border-strong hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong"
            : "border-border bg-transparent font-medium text-secondary hover:border-border-strong hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong",
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
