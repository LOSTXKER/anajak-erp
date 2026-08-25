import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  density?: "default" | "compact";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  density = "default",
}: EmptyStateProps) {
  const compact = density === "compact";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-6" : "px-6 py-16",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-slate-100 text-muted dark:bg-slate-800",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.5} />
      </div>
      <p
        className={cn(
          "text-sm font-medium text-strong",
          compact ? "mt-3" : "mt-4",
        )}
      >
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className={compact ? "mt-4" : "mt-5"}>{action}</div>}
    </div>
  );
}
