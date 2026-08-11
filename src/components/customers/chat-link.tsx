import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** ห้องแชทของลูกค้า — กดแล้วเปิดแชทจริงในแท็บใหม่
 *  รับเฉพาะลิงก์ http/https (ฝั่ง server กันไว้อีกชั้น) — ไม่ยอมให้ href กลายเป็นสคริปต์
 *
 *  เดิมเป็น local function ในหน้า /orders ไม่ได้ export — พอหน้ารายละเอียดออเดอร์
 *  ต้องใช้บ้าง (เบสสั่ง 2026-08-11 ให้แท็บภาพรวมมีผู้ติดต่อ) ทางเลือกคือก๊อปวาง
 *  ซึ่งจะทำให้ด่านกัน href ที่ไม่ใช่ http/https มี 2 ชุด แล้ววันหนึ่งจะหลุดจากกัน
 *  → ยกมาเป็นของกลางแทน
 *
 *  stopPropagation: หน้ารายการต้องใช้ (ทั้งแถวกดได้ ไม่งั้นคลิกทะลุไปเปิดออเดอร์)
 *  หน้ารายละเอียดไม่ต้อง — ค่าเริ่มต้นจึงเป็น false ให้ผู้เรียกเปิดเอง */
export function ChatLink({
  name,
  url,
  stopPropagation = false,
  wrap = false,
  className,
}: {
  name?: string | null;
  url?: string | null;
  stopPropagation?: boolean;
  /** true = ปล่อยขึ้นบรรทัดใหม่แทนตัดจุดไข่ปลา — ใช้ตรงที่มีที่พอ (หน้ารายละเอียด)
   *  ชื่อห้องแชทเป็นภาษาไทยได้ และไทยไม่มีเว้นวรรค จุดไข่ปลาจะตัดกลางคำ/แยกสระเสมอ
   *  หน้ารายการยังต้องตัดอยู่ (อยู่ในเซลล์ตาราง ขึ้นบรรทัดใหม่แล้วแถวสูงไม่เท่ากัน) */
  wrap?: boolean;
  className?: string;
}) {
  if (!name && !url) return null;
  const safe = url && /^https?:\/\//i.test(url) ? url : null;
  const label = name || "เปิดแชท";
  const clamp = wrap ? "[overflow-wrap:anywhere]" : "truncate";

  if (!safe) {
    return (
      <p className={cn(clamp, "text-xs text-slate-500 dark:text-slate-400", className)}>
        {label}
      </p>
    );
  }

  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400",
        wrap ? "items-start" : "truncate",
        className,
      )}
    >
      <MessageCircle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
      <span className={clamp}>{label}</span>
    </a>
  );
}
