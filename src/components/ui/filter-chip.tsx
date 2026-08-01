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
      className={cn(CONTROL_MIN_H, "touch-manipulation whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors", FOCUS_BUTTON,
        selected
          ? "bg-blue-600 text-white dark:bg-blue-500"
          : "bg-white text-slate-600 hairline-ring hover:bg-slate-50 hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}
