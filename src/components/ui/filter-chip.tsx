import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON } from "./tokens";
import { CONTROL_MIN_H } from "./control-size";

interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  /** muted = ตัวเลือกในกลุ่ม/overlay · raised = ตัวกรองที่ยืนบนผืนหน้า */
  surface?: "muted" | "raised";
}

export function FilterChip({
  selected,
  onClick,
  children,
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
        "inline-flex touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.98]",
        FOCUS_BUTTON,
        selected
          // "กรองอยู่" = ฟ้าอ่อนชุด ACTIVE_FILTER ทั้งระบบ — น้ำเงินทึบสงวนให้ปุ่มหลัก
          ? "border-transparent bg-interactive-selected text-interactive-selected-text"
          : surface === "raised"
            ? "border-border bg-surface text-secondary shadow-sm hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong"
            : "border-transparent bg-surface-muted text-secondary hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong",
        className,
      )}
    >
      <Check
        aria-hidden="true"
        className={cn("h-3.5 w-3.5 shrink-0", !selected && "invisible")}
        // คง inline fallback ไว้ด้วย: dev CSS แบบ incremental บางรอบเคยโหลด class
        // ก่อน utility `invisible` ทำให้ชิปที่ไม่ได้เลือกยังเห็นเครื่องหมายถูกทุกอัน
        style={selected ? undefined : { visibility: "hidden" }}
      />
      {children}
    </button>
  );
}
