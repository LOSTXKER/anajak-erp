import { cn } from "@/lib/utils";

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
      className={cn(
        "whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
        selected
          ? "bg-blue-600 text-white dark:bg-blue-500"
          : "bg-white text-slate-600 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] hover:bg-slate-50 hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300 dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.08)] dark:hover:bg-white/10 dark:hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}
