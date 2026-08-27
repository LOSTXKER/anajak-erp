import { Skeleton } from "@/components/ui/skeleton";

/* ============================================================
   โครงร่างของหน้ารายการ — รูปเดียวของทั้งระบบ (UI-2026 เฟส 4 · เบสสั่ง 2026-08-26)

   ก่อนหน้านี้แต่ละหน้าเขียนเอง ได้ 3 แบบที่ไม่ตรงกับของจริงสักแบบ:
     · แผ่นเทาก้อนเดียวสูง 384px (15 หน้า) — ของจริงเป็นตารางหลายแถว
     · แถบสูง 80px 4 ก้อน — ของจริงแถวเตี้ยกว่านั้น
     · Suspense fallback เป็นกล่องเปล่าไม่มีโครงเลย
   ผลคือพอข้อมูลมาถึง ความสูงเปลี่ยนกะทันหันแล้วจอกระโดด

   ความสูงแถว 75px วัดจากทะเบียนออเดอร์จริง (เดิม 69px · ขยับตอนแถวหายใจขึ้น
   ในเฟส 10 "นุ่มเต็มที่" 2026-08-26 — เซลล์ py 12 → 16px)
   ⚠️ ถ้าความหนาแน่นเปลี่ยนอีก ต้องวัดจากของจริงแล้วแก้ที่นี่ที่เดียว
   ไม่งั้นพอข้อมูลมาถึง ความสูงจะกระโดดเท่ากับส่วนต่าง × จำนวนแถว
   ============================================================ */

/** แถวเดียวของตาราง — หัวข้อ + บรรทัดรอง + คอลัมน์ขวา
 *  px-6 = ระยะขอบเดียวกับเซลล์จริงของ DataTable ไม่งั้นพอข้อมูลมาถึงเนื้อหาจะเลื่อนข้าง */
function SkeletonRow() {
  return (
    <div className="flex h-[75px] items-center gap-4 border-b border-divider px-6 last:border-b-0">
      <Skeleton className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="hidden h-4 w-24 sm:block" />
      <Skeleton className="hidden h-4 w-20 sm:block" />
    </div>
  );
}

/** เฉพาะส่วนตาราง — ใช้เป็น loadingState ของ ResponsiveList
 *  ⚠️ ต้องอยู่ในการ์ดเหมือนตารางจริง (เฟส 6 คืนกล่องครอบ) ไม่งั้นตอนข้อมูลมาถึง
 *  กล่องโผล่ขึ้นมาพร้อมกัน = จอกระโดดทุกครั้งที่เปิดหน้ารายการ */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card-surface overflow-hidden rounded-2xl" role="status" aria-label="กำลังโหลดข้อมูล">
      <span className="sr-only">กำลังโหลดข้อมูล</span>
      <div className="border-b border-divider bg-transparent px-6 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}

/** ทั้งหน้า — หัวหน้า + แถบเครื่องมือ + ตาราง · ใช้ใน loading.tsx และ Suspense fallback */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="กำลังเปิดหน้า">
      <span className="sr-only">กำลังเปิดหน้า</span>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0" />
          <div className="space-y-2 pt-0.5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>

      <ListSkeleton rows={rows} />
    </div>
  );
}
