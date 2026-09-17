import { createContext, useContext, type HTMLAttributes, type ReactNode } from "react";
import { Inbox, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  /** แถบค้นหา/ตัวกรองของรายการนี้ — ส่งมาแล้ววางไว้ "ในการ์ดเดียวกับตาราง" แบบหน้าออเดอร์ (ชุด kit · 2026-09-17)
   *  ทุกสถานะ (โหลด/ว่าง/พัง/มีข้อมูล) ยังเห็นแถบนี้ในการ์ดเดิม จอไม่กระโดด */
  toolbar?: ReactNode;
  /** ตอนนี้กรอง/ค้นอยู่ไหม — แต่ละหน้านับตัวกรองของตัวเองไม่เหมือนกัน ตัวกลางเดาแทนไม่ได้
   *  จริง = กล่องว่างพูดว่า "ไม่พบตามตัวกรองนี้" แทน "ยังไม่มี…" และไม่ต้องให้หน้าเขียนเองซ้ำ */
  filtered?: boolean;
  /** ล้างตัวกรองและคำค้นของหน้านี้ — ไม่ส่งมา = ไม่ขึ้นปุ่ม
   *  หน้าที่ล้างได้ไม่หมด (เช่นงวดที่ต้องเลือกเสมอ) ให้ส่งเฉพาะตอนที่กดแล้วล้างได้จริง */
  onClearFilters?: () => void;
  /** บรรทัดรองตอนกรองแล้วไม่เจอ — ใส่คำช่วยเฉพาะหน้า เช่นค้นด้วยอะไรได้บ้าง */
  filteredDescription?: string;
}

/** ตาราง/การ์ดที่อยู่ในการ์ดของ ResponsiveList แล้ว ไม่ต้องวาดกรอบซ้อน (DataTable.Root อ่านค่านี้) */
const InListCard = createContext(false);
export const useInListCard = () => useContext(InListCard);

/* ทุกสถานะของหน้ารายการต้องมีกรอบเดียวกัน (แก้ 2026-08-26 หลังคืนกล่องครอบตาราง)
   ก่อนหน้านี้ตอนมีข้อมูล = ตารางในการ์ด · ตอนโหลด/ว่าง/พัง = เนื้อหาลอยบนผืนหน้า
   พอข้อมูลมาถึง กล่องโผล่ขึ้นมาพร้อมกัน จอจึงกระโดดทุกครั้งที่เปิดหน้ารายการ
   โครงร่างตอนโหลดใช้ ListSkeleton ตัวเดียวกับ loading.tsx แล้ว (เดิมมีสองสูตร
   ที่ความสูงแถวไม่ตรงกัน ซึ่งเป็นปัญหาเดียวกับที่เฟส 4 ตั้งใจแก้) */
function ListStateFrame({ children, toolbar }: { children: ReactNode; toolbar?: ReactNode }) {
  return (
    <div className="card-surface overflow-hidden rounded-2xl">
      {toolbar ? <div className="px-4.5 pb-2.5 pt-3.5">{toolbar}</div> : null}
      <div className={toolbar ? "border-t border-divider/60" : undefined}>{children}</div>
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
  toolbar,
  filtered = false,
  onClearFilters,
  filteredDescription,
  className,
  ...props
}: ResponsiveListProps<T>) {
  if (isError && (!items || items.length === 0)) {
    return (
      <ListStateFrame toolbar={toolbar}>
        <QueryError message={errorMessage} onRetry={onRetry} />
      </ListStateFrame>
    );
  }

  // ListSkeleton ห่อการ์ดมาให้แล้ว จึงไม่ต้องซ้อน ListStateFrame อีกชั้น
  if (isLoading && (!items || items.length === 0)) {
    if (toolbar) {
      return (
        <ListStateFrame toolbar={toolbar}>
          <div className="[&_.card-surface]:rounded-none [&_.card-surface]:border-0">{loadingState ?? <ListSkeleton />}</div>
        </ListStateFrame>
      );
    }
    return loadingState ?? <ListSkeleton />;
  }

  const resolvedItems = items ?? [];
  if (resolvedItems.length === 0) {
    /* กรองแล้วไม่เจอเคยเป็นทางตัน: จอว่างไม่มีปุ่มล้าง ต้องไล่ปิดตัวกรองทีละตัวเอง
       กล่องนี้จึงอยู่ที่ตัวกลาง หน้าไม่ต้องเขียนคำว่า "ไม่พบตามเงื่อนไข" ของใครของมัน */
    return (
      <ListStateFrame toolbar={toolbar}>
        {filtered ? (
          <EmptyState
            icon={SearchX}
            title={`ไม่พบ${label}ตามตัวกรองนี้`}
            description={filteredDescription ?? "ลองแก้คำค้นหรือขยายตัวกรอง แล้วดูอีกครั้ง"}
            action={
              onClearFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                  ล้างตัวกรองและคำค้น
                </Button>
              ) : undefined
            }
          />
        ) : (
          emptyState ?? (
            <EmptyState
              icon={Inbox}
              title={`ยังไม่มี${label}`}
              description="ข้อมูลจะปรากฏที่นี่เมื่อมีรายการ"
              action={emptyAction}
            />
          )
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
      {isError && (
        <Alert
          variant="warning"
          title="อัปเดตรายการไม่สำเร็จ"
          className="mb-3"
          action={onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>ลองใหม่</Button> : undefined}
        >
          {errorMessage ? <p>{errorMessage}</p> : null}
          <p>กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า รายการอาจไม่ตรงกับตัวกรองหรือหน้าที่เลือก</p>
        </Alert>
      )}
      {toolbar ? (
        <div className="card-surface overflow-hidden rounded-2xl">
          <div className="px-4.5 pb-2.5 pt-3.5">{toolbar}</div>
          <InListCard.Provider value>
            <div className="hidden border-t border-divider/60 lg:block">{renderDesktop(resolvedItems)}</div>
            <div className="px-3.5 pb-3.5 lg:hidden">{renderMobile(resolvedItems)}</div>
          </InListCard.Provider>
          {pagination}
        </div>
      ) : (
        <>
      {/* ที่ md sidebar กิน 256px ทำให้พื้นที่เนื้อหาจริงแคบกว่ามือถือแนวนอน
          จึงคง card ถึงก่อน lg แล้วค่อยสลับเป็น table */}
      <div className="hidden lg:block">{renderDesktop(resolvedItems)}</div>
      <div className="lg:hidden">{renderMobile(resolvedItems)}</div>
          {pagination}
        </>
      )}
    </div>
  );
}
