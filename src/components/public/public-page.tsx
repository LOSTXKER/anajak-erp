import { Spinner } from "@/components/ui/spinner";
import { VISUAL_TONE_CLASSES, type VisualTone } from "@/lib/visual-tone";
import { cn } from "@/lib/utils";

/* โครงหน้า public (ลิงก์ลูกค้า/ร้านนอก) — แหล่งเดียวของ กล่องครอบ + header + footer
   เดิม 5 หน้า (quote/status/upload/approve/job) ก๊อปโครงกันเองแล้วเพี้ยน:
   ระยะห่างคนละค่า (space-y-5 py-6 vs space-y-6 py-8) · 3 หน้า hardcode "Anajak Print"
   ขณะหน้า status ใช้ brandName รองรับ blind ship · footer ซ่อนตอน blind ship มีแค่หน้าเดียว */

export function PublicPageShell({
  icon,
  title = "Anajak Print",
  subtitle,
  footer,
  hideFooter = false,
  tone = "brand",
  children,
}: {
  /** ไอคอนหัวหน้า — ส่งมาพร้อมสไตล์ เช่น <FileText className="h-6 w-6 text-blue-600" /> */
  icon: React.ReactNode;
  /** ชื่อบนหัว — หน้า status ส่ง brandName (blind ship) · หน้า job ส่ง "ใบงานผลิต" */
  title?: string;
  subtitle: React.ReactNode;
  /** แทน footer มาตรฐาน "Powered by ..." ด้วยข้อความอื่น */
  footer?: React.ReactNode;
  /** ซ่อน footer ทั้งแถบ (blind ship — ห้ามโผล่ชื่อร้าน) */
  hideFooter?: boolean;
  tone?: VisualTone;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg px-4 py-5 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="card-surface relative overflow-hidden rounded-2xl p-5 sm:p-6">
          <div className={cn("absolute inset-x-0 top-0 h-1", VISUAL_TONE_CLASSES[tone].solid)} aria-hidden="true" />
          <div className="flex items-start gap-4">
            <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-white shadow-sm [&_svg]:h-5.5 [&_svg]:w-5.5 [&_svg]:text-white", VISUAL_TONE_CLASSES[tone].solid)} aria-hidden="true">
              {icon}
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-strong sm:text-2xl">{title}</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted">{subtitle}</p>
            </div>
          </div>
        </header>
        {children}
        {!hideFooter && (
          <footer className="text-center text-xs text-slate-400">
            {footer ?? "Powered by Anajak Print ERP"}
          </footer>
        )}
      </div>
    </div>
  );
}

/** จอโหลดเต็มหน้าก่อนข้อมูล token มา — คู่กับ PublicLinkError (เดิมก๊อป 5 สำเนา) */
export function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="flex items-center gap-2 text-muted">
        <Spinner size="lg" />
        <span>กำลังโหลด...</span>
      </div>
    </div>
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
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-slate-800">{children}</span>
    </div>
  );
}
