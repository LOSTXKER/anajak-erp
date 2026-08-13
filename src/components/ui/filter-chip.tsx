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
}

export function FilterChip({ selected, onClick, children, className }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(CONTROL_MIN_H, "inline-flex touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors active:scale-[0.98]", FOCUS_BUTTON,
        selected
          // "กรองอยู่" = ฟ้าอ่อนชุด ACTIVE_FILTER ทั้งระบบ — น้ำเงินทึบสงวนให้ปุ่มหลัก
          ? "bg-interactive-selected text-interactive-selected-text"
          : "bg-surface-muted text-secondary hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed active:text-strong",
        className,
      )}
    >
      <Check
        aria-hidden="true"
        className={cn("h-3.5 w-3.5 shrink-0", !selected && "invisible")}
      />
      {children}
    </button>
  );
}
