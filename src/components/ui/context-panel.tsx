import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Info, Lightbulb, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  neutral: { icon: Info, shell: "bg-surface-muted text-secondary", mark: "bg-surface text-strong" },
  info: { icon: Lightbulb, shell: "bg-blue-50 text-blue-950 dark:bg-blue-950/35 dark:text-blue-100", mark: "bg-blue-600 text-white" },
  assurance: { icon: ShieldCheck, shell: "bg-green-50 text-green-950 dark:bg-green-950/35 dark:text-green-100", mark: "bg-green-600 text-white" },
} as const;

export function ContextPanel({
  title,
  children,
  tone = "neutral",
  icon,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  tone?: keyof typeof TONE;
  icon?: LucideIcon;
  className?: string;
}) {
  const config = TONE[tone];
  const Icon = icon ?? config.icon;

  return (
    <aside className={cn("flex gap-3 rounded-2xl p-4", config.shell, className)}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", config.mark)} aria-hidden="true">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 pt-0.5 text-sm leading-relaxed">
        {title && <p className="font-semibold text-current">{title}</p>}
        <div className={cn(title && "mt-0.5")}>{children}</div>
      </div>
    </aside>
  );
}
