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
        "whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-colors",
        selected
          ? "bg-blue-600 text-white"
          : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800",
        className,
      )}
    >
      {children}
    </button>
  );
}
