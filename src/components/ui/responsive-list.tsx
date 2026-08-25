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
  /** ปุ่มพาไปต่อใน empty state ปริยาย (ใช้เมื่อไม่ได้ส่ง emptyState เอง) — กัน list ว่างกลายเป็นทางตัน */
  emptyAction?: ReactNode;
  loadingState?: ReactNode;
  pagination?: ReactNode;
  label?: string;
}

/* โครงร่างต้องรูปทรงเดียวกับของจริง ไม่งั้นจอกระโดดตอนข้อมูลมาถึง (UI-2026 เฟส 4)
   ของเดิมเป็นแถบสูง 80px 4 ก้อนบนจอที่เป็นตารางแถวเตี้ยกว่านั้น
   69px = ความสูงแถวจริงที่วัดจากทะเบียนออเดอร์หลังปรับบันไดตัวอักษร */
function DefaultLoadingState() {
  return (
    <div role="status" aria-label="กำลังโหลดข้อมูล">
      <span className="sr-only">กำลังโหลดข้อมูล</span>
      <div className="border-b border-border py-2">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex h-[69px] items-center gap-4 border-b border-divider"
        >
          <Skeleton className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="hidden h-4 w-20 sm:block" />
        </div>
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
  emptyAction,
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
        <EmptyState
          icon={Inbox}
          title={`ยังไม่มี${label}`}
          description="ข้อมูลจะปรากฏที่นี่เมื่อมีรายการ"
          action={emptyAction}
        />
      )
    );
  }

  return (
    <div
      className={cn("min-w-0", className)}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {/* ที่ md sidebar กิน 256px ทำให้พื้นที่เนื้อหาจริงแคบกว่ามือถือแนวนอน
          จึงคง card ถึงก่อน lg แล้วค่อยสลับเป็น table */}
      <div className="hidden lg:block">{renderDesktop(resolvedItems)}</div>
      <div className="lg:hidden">{renderMobile(resolvedItems)}</div>
      {pagination}
    </div>
  );
}
