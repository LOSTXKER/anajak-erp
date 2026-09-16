import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";


/* โครงหน้า public (ลิงก์ลูกค้า/ร้านนอก) — แหล่งเดียวของ กล่องครอบ + header + footer
   เดิม 5 หน้า (quote/status/upload/approve/job) ก๊อปโครงกันเองแล้วเพี้ยน:
   ระยะห่างคนละค่า (space-y-5 py-6 vs space-y-6 py-8) · 3 หน้า hardcode "Anajak Print"
   ขณะหน้า status ใช้ brandName รองรับ blind ship · footer ซ่อนตอน blind ship มีแค่หน้าเดียว

   โครงหัวตามต้นแบบที่เบสเคาะ (pubHead · 2026-09-16):
     แถวบน = แถบแบรนด์เล็ก (ตรา + ชื่อร้าน + บรรทัดบอกว่าลิงก์นี้ทำอะไรได้) + ชิปชนิดหน้าชิดขวา
     แล้วค่อยเป็น h1 ของ "เนื้อหา" (ชื่องาน/เลขใบ) กับบรรทัดรอง
   ก่อนหน้านี้ h1 เป็นชื่อแบรนด์ทุกหน้า ลูกค้าเปิดลิงก์มาจึงไม่รู้ว่ากำลังดูใบไหน */

const DEFAULT_FOOTER = "ลิงก์นี้เห็นเฉพาะงานของคุณ ไม่เห็นข้อมูลลูกค้ารายอื่น";

export function PublicPageShell({
  icon,
  pageLabel,
  brandNote,
  title,
  subtitle,
  footer,
  hideFooter = false,
  // ค่าปริยายตามหลัง hideFooter — blind ship แปลว่า "ห้ามโผล่ตัวตนร้าน" ทั้งชุด
  // ถ้าปล่อยให้ default เป็น false ใครลืมส่ง prop ก็ทำแบรนด์หลุดได้เงียบ ๆ
  hideBrandMark = hideFooter,
  // ด้วยเหตุผลเดียวกัน ชื่อร้านก็ตามหลังตรา — ปิดแบรนด์แล้วไม่ส่งชื่อมา = ไม่พิมพ์อะไรเลย
  brandName = hideBrandMark ? "" : "Anajak Print",
  children,
}: {
  /** ไอคอนหัวหน้า — ส่ง Lucide มาโดยไม่ใส่สี; shell กำหนดขนาดและ neutral tone */
  icon: React.ReactNode;
  /** ชิปบอกว่าหน้านี้คืออะไร เช่น "สถานะงาน" · "ใบเสนอราคา" (ต้นแบบ: .chip.line ชิดขวา) */
  pageLabel?: React.ReactNode;
  /** บรรทัดเล็กใต้ชื่อร้าน — บอกสิ่งที่ทำได้จากลิงก์นี้ เช่น "กดรับหรือขอแก้ได้จากหน้านี้เลย" */
  brandNote?: React.ReactNode;
  /** ชื่อร้านบนแถบแบรนด์ — หน้า status ส่ง brandName ของออเดอร์ (blind ship) */
  brandName?: string;
  /** h1 ของเนื้อหา — ชื่องาน/เลขใบ ไม่ใช่ชื่อแบรนด์ */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** แทนข้อความท้ายหน้ามาตรฐาน (ขอบเขตของลิงก์) ด้วยข้อความอื่น */
  footer?: React.ReactNode;
  /** โหมดปิดตัวตนร้าน (blind ship) — ซ่อนตราและไม่พิมพ์ชื่อร้าน
   *  ข้อความท้ายหน้าไม่มีชื่อแบรนด์แล้ว จึงยังโชว์ได้ทุกกรณี (คำช่วยบอกขอบเขตลิงก์)
   *  ชื่อ prop เดิมคงไว้ — หน้า status ส่ง hideFooter={d.isBlindShip} และด่าน verify:ui ผูกกับบรรทัดนั้น */
  hideFooter?: boolean;
  /** ซ่อนตราสัญลักษณ์ด้วย — ใช้คู่กับ hideFooter ตอน blind ship
   *  ปกติแถบแบรนด์ใส่ตราน้ำเงินไว้ เพราะหน้าพวกนี้คือที่เดียวที่ลูกค้าเห็นแบรนด์เรา
   *  (เบสทัก 2026-08-26 "อย่าลืมสีฟ้าที่เป็น asset เรา" — หัวหน้าลูกค้าเคยเป็นเทาล้วน) */
  hideBrandMark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg px-4 pb-14 pt-4 sm:pt-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-4.5 flex items-center gap-2.5 border-b border-divider pb-3.5">
          <span
            className={
              hideBrandMark
                ? "shrink-0 text-secondary [&_svg]:h-5 [&_svg]:w-5"
                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white [&_svg]:h-4 [&_svg]:w-4"
            }
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            {brandName ? (
              <p className="truncate text-sm font-semibold text-strong">{brandName}</p>
            ) : null}
            {brandNote ? (
              <p className="text-xs leading-relaxed text-muted">{brandNote}</p>
            ) : null}
          </div>
          {pageLabel ? (
            <Badge variant="outline" className="ml-auto shrink-0">{pageLabel}</Badge>
          ) : null}
        </header>
        <h1 className="break-words text-2xl font-semibold text-strong [overflow-wrap:anywhere]">{title}</h1>
        {subtitle ? (
          <div className="mt-1.5 break-words text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">{subtitle}</div>
        ) : null}
        <div className="mt-4 space-y-3.5">{children}</div>
        <p className="mt-3 text-center text-xs text-muted">{footer ?? DEFAULT_FOOTER}</p>
      </div>
    </main>
  );
}

/** จอโหลดก่อนข้อมูล token มา — คู่กับ PublicLinkError (เดิมก๊อป 5 สำเนา)
 *
 *  เดิมเป็นสปินเนอร์กลางจอ แล้วพอข้อมูลมาถึงเนื้อหาเด้งไปชิดบน = จอกระโดดทุกครั้ง
 *  (UI-2026 · เบสสั่ง 2026-08-26) ตอนนี้ใช้โครงเดียวกับ PublicPageShell เป๊ะ
 *  (แถบแบรนด์ + ชิป + h1 + บรรทัดรอง — แก้ shell แล้วต้องแก้ที่นี่ด้วยทุกครั้ง)
 *  คงชื่อฟังก์ชันเดิมไว้เพื่อไม่ต้องไล่แก้ 5 หน้าที่เรียกใช้ */
export function FullScreenLoading() {
  return (
    <main className="min-h-screen bg-bg px-4 pb-14 pt-4 sm:pt-6" aria-busy="true" aria-label="กำลังโหลด">
      <span className="sr-only" role="status">กำลังโหลด</span>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4.5 flex items-center gap-2.5 border-b border-divider pb-3.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28 max-w-full" />
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
          <Skeleton className="h-5.5 w-20 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-4 space-y-3.5">
          {[0, 1].map((index) => (
            <div key={index} className="card-surface space-y-3 rounded-2xl p-4.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
