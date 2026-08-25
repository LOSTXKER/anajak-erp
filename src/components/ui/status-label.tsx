import { cn } from "@/lib/utils";

/* ============================================================
   ป้ายสถานะ — ภาษาเดียวของทั้งเว็บ (เบสสั่ง "ทำหมดเลย" 2026-08-01)

   ก่อนหน้านี้เว็บพูดสองภาษา: หน้า /orders เป็น "จุดสี + ข้อความ" (เบสเคาะเอง)
   แต่อีก 8 หน้าเป็นแคปซูลพื้นสี (<Badge>) — สลับหน้าแล้วรู้สึกว่าคนละระบบ
   ซ้ำร้ายแคปซูลยังมี 2 ขนาดปนกัน (size md สูงกว่า sm อยู่ 4px)

   ตัวนี้คือแบบ "จุดสี + ข้อความ" ที่เบสเคาะ ยกมาเป็นของกลางให้ทุกหน้าใช้

   หลักการสี: สถานะปลายทาง (จบ/ยกเลิก/ค้างจ่าย) ย้อมข้อความให้สะดุดตาตอนสแกน
   ส่วนสถานะระหว่างทางคงข้อความเทาเข้ม ปล่อยให้จุดสีเป็นตัวบอก —
   ถ้าย้อมทุกสถานะ ตารางจะกลายเป็นรุ้งจนหาของสำคัญไม่เจอ
   ============================================================ */

export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger";

const DOT: Record<StatusTone, string> = {
  neutral: "bg-slate-500 dark:bg-slate-400",
  accent: "bg-blue-500",
  success: "bg-green-600 dark:bg-green-400",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

/** โทนที่ย้อมข้อความด้วย — เฉพาะปลายทางที่ต้องสะดุดตา */
const EMPHASIS_TEXT: Partial<Record<StatusTone, string>> = {
  success: "text-green-700 dark:text-green-300",
  danger: "text-red-700 dark:text-red-300",
};

export function StatusLabel({
  label,
  tone = "neutral",
  sub,
  emphasize,
  className,
  subClassName,
}: {
  label: React.ReactNode;
  tone?: StatusTone;
  /** บรรทัดรองใต้สถานะ เช่นสถานะภายใน — ซ่อนเองถ้าซ้ำกับบรรทัดบน */
  sub?: React.ReactNode;
  /** ย้อมข้อความตามโทน — ใช้กับสถานะปลายทาง (จบ/ยกเลิก/เกินกำหนด) */
  emphasize?: boolean;
  className?: string;
  /** ปรับบรรทัดรองเฉพาะบริบท เช่น row ที่เปลี่ยนพื้นตอน hover */
  subClassName?: string;
}) {
  const showSub = sub != null && sub !== "" && sub !== label;
  return (
    <div className={cn("flex flex-col leading-tight", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
          emphasize
            ? (EMPHASIS_TEXT[tone] ?? "text-secondary")
            : "text-secondary",
        )}
      >
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone])} />
        {label}
      </span>
      {showSub && (
        <span className={cn("pl-3 text-2xs text-muted", subClassName)}>
          {sub}
        </span>
      )}
    </div>
  );
}

/** แปลง variant ของ <Badge> เดิมเป็นโทนของป้ายสถานะ — ให้หน้าที่ย้ายมาไม่ต้องคิดใหม่ */
export function toneFromBadgeVariant(variant?: string | null): StatusTone {
  switch (variant) {
    case "success":
      return "success";
    case "warning":
    case "orange":
      return "warning";
    case "destructive":
      return "danger";
    case "accent":
    case "purple":
    case "indigo":
      return "accent";
    default:
      return "neutral";
  }
}
