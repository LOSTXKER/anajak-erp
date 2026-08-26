import type { HTMLAttributes, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { ListSkeleton } from "@/components/ui/page-skeleton";
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

/* ทุกสถานะของหน้ารายการต้องมีกรอบเดียวกัน (แก้ 2026-08-26 หลังคืนกล่องครอบตาราง)
   ก่อนหน้านี้ตอนมีข้อมูล = ตารางในการ์ด · ตอนโหลด/ว่าง/พัง = เนื้อหาลอยบนผืนหน้า
   พอข้อมูลมาถึง กล่องโผล่ขึ้นมาพร้อมกัน จอจึงกระโดดทุกครั้งที่เปิดหน้ารายการ
   โครงร่างตอนโหลดใช้ ListSkeleton ตัวเดียวกับ loading.tsx แล้ว (เดิมมีสองสูตร
   ที่ความสูงแถวไม่ตรงกัน ซึ่งเป็นปัญหาเดียวกับที่เฟส 4 ตั้งใจแก้) */
function ListStateFrame({ children }: { children: ReactNode }) {
  return <div className="card-surface overflow-hidden rounded-lg">{children}</div>;
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
    return (
      <ListStateFrame>
        <QueryError message={errorMessage} onRetry={onRetry} />
      </ListStateFrame>
    );
  }

  // ListSkeleton ห่อการ์ดมาให้แล้ว จึงไม่ต้องซ้อน ListStateFrame อีกชั้น
  if (isLoading && (!items || items.length === 0)) {
    return loadingState ?? <ListSkeleton />;
  }

  const resolvedItems = items ?? [];
  if (resolvedItems.length === 0) {
    return (
      <ListStateFrame>
        {emptyState ?? (
          <EmptyState
            icon={Inbox}
            title={`ยังไม่มี${label}`}
            description="ข้อมูลจะปรากฏที่นี่เมื่อมีรายการ"
            action={emptyAction}
          />
        )}
      </ListStateFrame>
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
