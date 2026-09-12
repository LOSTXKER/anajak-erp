import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";


/* โครงหน้า public (ลิงก์ลูกค้า/ร้านนอก) — แหล่งเดียวของ กล่องครอบ + header + footer
   เดิม 5 หน้า (quote/status/upload/approve/job) ก๊อปโครงกันเองแล้วเพี้ยน:
   ระยะห่างคนละค่า (space-y-5 py-6 vs space-y-6 py-8) · 3 หน้า hardcode "Anajak Print"
   ขณะหน้า status ใช้ brandName รองรับ blind ship · footer ซ่อนตอน blind ship มีแค่หน้าเดียว */

export function PublicPageShell({
  icon,
  title = "Anajak Print",
  heading,
  subtitle,
  footer,
  hideFooter = false,
  // ค่าปริยายตามหลัง hideFooter — blind ship แปลว่า "ห้ามโผล่ตัวตนร้าน" ทั้งชุด
  // ถ้าปล่อยให้ default เป็น false ใครลืมส่ง prop ก็ทำแบรนด์หลุดได้เงียบ ๆ
  hideBrandMark = hideFooter,
  children,
}: {
  /** ไอคอนหัวหน้า — ส่ง Lucide มาโดยไม่ใส่สี; shell กำหนดขนาดและ neutral tone */
  icon: React.ReactNode;
  /** ชื่อบนหัว — หน้า status ส่ง brandName (blind ship) · หน้า job ส่ง "ใบงานผลิต" */
  title?: string;
  /** ภารกิจเป็นหัวข้อหลัก โดยยังคงชื่อกิจการที่เจ้าของลิงก์กำหนด */
  heading?: string;
  subtitle: React.ReactNode;
  /** แทน footer มาตรฐาน "Powered by ..." ด้วยข้อความอื่น */
  footer?: React.ReactNode;
  /** ซ่อน footer ทั้งแถบ (blind ship — ห้ามโผล่ชื่อร้าน) */
  hideFooter?: boolean;
  /** ซ่อนตราสัญลักษณ์ด้วย — ใช้คู่กับ hideFooter ตอน blind ship
   *  ปกติหัวการ์ดใส่ตราน้ำเงินไว้ เพราะหน้าพวกนี้คือที่เดียวที่ลูกค้าเห็นแบรนด์เรา
   *  (เบสทัก 2026-08-26 "อย่าลืมสีฟ้าที่เป็น asset เรา" — หัวหน้าลูกค้าเคยเป็นเทาล้วน) */
  hideBrandMark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg px-4 py-5 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="card-surface rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span
              className={
                hideBrandMark
                  ? "mt-1 shrink-0 text-secondary [&_svg]:h-5 [&_svg]:w-5"
                  : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white [&_svg]:h-5 [&_svg]:w-5"
              }
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="min-w-0">
              {heading && <p className="mb-1 text-sm font-medium text-secondary">{title}</p>}
              <h1 className="break-words text-2xl font-semibold text-strong [overflow-wrap:anywhere]">{heading ?? title}</h1>
              <div className="mt-1 break-words text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">{subtitle}</div>
            </div>
          </div>
        </header>
        {children}
        {!hideFooter && (
          <footer className="text-center text-xs text-muted">
            {footer ?? "Powered by Anajak Print ERP"}
          </footer>
        )}
      </div>
    </main>
  );
}

export function PublicRefreshNotice({ onRetry, refreshing = false }: { onRetry: () => void; refreshing?: boolean }) {
  return (
    <Alert variant="warning">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm">อัปเดตข้อมูลไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดไว้ ลองโหลดอีกครั้งเพื่อใช้งานต่อ</p>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={refreshing}>{refreshing ? "กำลังลองใหม่…" : "ลองโหลดอีกครั้ง"}</Button>
      </div>
    </Alert>
  );
}

/** จอโหลดก่อนข้อมูล token มา — คู่กับ PublicLinkError (เดิมก๊อป 5 สำเนา)
 *
 *  เดิมเป็นสปินเนอร์กลางจอ แล้วพอข้อมูลมาถึงเนื้อหาเด้งไปชิดบน = จอกระโดดทุกครั้ง
 *  (UI-2026 · เบสสั่ง 2026-08-26) ตอนนี้ใช้โครงเดียวกับ PublicPageShell เป๊ะ
 *  คงชื่อฟังก์ชันเดิมไว้เพื่อไม่ต้องไล่แก้ 5 หน้าที่เรียกใช้ */
export function FullScreenLoading() {
  return (
    <main className="min-h-screen bg-bg px-4 py-5 sm:py-10" aria-busy="true" aria-label="กำลังโหลด">
      <span className="sr-only" role="status">กำลังโหลด</span>
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="card-surface rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-1 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-56 max-w-full" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
        </div>
        {[0, 1].map((index) => (
          <div key={index} className="card-surface space-y-3 rounded-2xl p-5 sm:p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </main>
  );
}

/** แถว label–value ในการ์ดข้อมูลออเดอร์ (เดิมก๊อปกัน 4 หน้า สีตัวหนังสือเริ่มไม่ตรง) */
export function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-strong [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}
