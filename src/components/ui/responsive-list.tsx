import type { HTMLAttributes, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ResponsiveListView = "mobile" | "desktop";

export interface ResponsiveListProps<T>
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: readonly T[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  renderDesktop: (items: readonly T[]) => ReactNode;
  renderMobile: (items: readonly T[]) => ReactNode;
  emptyState?: ReactNode;
  loadingState?: ReactNode;
  pagination?: ReactNode;
  label?: string;
}

function DefaultLoadingState() {
  return (
    <div role="status" aria-label="กำลังโหลดข้อมูล" className="space-y-3 py-2">
      <span className="sr-only">กำลังโหลดข้อมูล</span>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function ResponsiveList<T>({
  items,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  renderDesktop,
  renderMobile,
  emptyState,
  loadingState,
  pagination,
  label = "รายการ",
  className,
  ...props
}: ResponsiveListProps<T>) {
  if (isError && (!items || items.length === 0)) {
    return <QueryError message={errorMessage} onRetry={onRetry} />;
  }

  if (isLoading && (!items || items.length === 0)) {
    return loadingState ?? <DefaultLoadingState />;
  }

  const resolvedItems = items ?? [];
  if (resolvedItems.length === 0) {
    return (
      emptyState ?? (
        <EmptyState icon={Inbox} title={`ยังไม่มี${label}`} description="ข้อมูลจะปรากฏที่นี่เมื่อมีรายการ" />
      )
    );
  }

  return (
    <div
      className={cn("min-w-0", className)}
      aria-busy={isLoading || undefined}
      {...props}
    >
      <div className="hidden sm:block">{renderDesktop(resolvedItems)}</div>
      <div className="sm:hidden">{renderMobile(resolvedItems)}</div>
      {pagination}
    </div>
  );
}
