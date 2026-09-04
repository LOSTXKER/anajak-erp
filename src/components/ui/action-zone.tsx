import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RADIUS, SUNK_PANEL } from "./tokens";

/* ============================================================
   ActionZone — โซนลงมือมีพื้นของตัวเอง (เพิ่ม 2026-09-02 · จัดใหม่ 2026-09-03 เบสเคาะ A จาก /proto/action-zone)

   ปุ่มหลักที่ลอยปนอยู่ท้ายข้อความเทา = ตาหาไม่เจอว่า "กดตรงไหน"
   ActionZone ให้พื้นจม (SUNK_PANEL) แยกโซน "ลงมือ" ออกจากโซน "อ่าน"

   โครง (เบสทัก 09-03 "CTA ดูเยอะ อัดกัน · คำอธิบายบีบซ้าย"):
     แถวบน  = ประโยคสถานะเต็มแถว (ไอคอน + ข้อความ) — ไม่ถูกปุ่มบีบอีก
     แถวล่าง = ปุ่มหลัก 1 ตัว (น้ำเงิน) ตามด้วยปุ่มรองแบบ ghost/outline และ `menu` ("เพิ่มเติม") ชิดขวา
   กติกา: หนึ่งโซนมี primary action เดียว และ **ไม่วางปุ่มที่กดไม่ได้** — ลงมือไม่ได้ให้ประโยคสถานะบอกแทน
   ============================================================ */

export type ActionZoneTone = "neutral" | "info" | "error" | "success";

const ICON_INK: Record<ActionZoneTone, string> = {
  neutral: "text-muted",
  info: "text-blue-600 dark:text-blue-400",
  error: "text-red-600 dark:text-red-400",
  success: "text-green-600 dark:text-green-400",
};

interface ActionZoneProps {
  children?: ReactNode;
  /** ประโยคบอกสถานะ/เงื่อนไขของการลงมือ เช่น "รอของกลับจากร้านนอกก่อน" — อยู่แถวบนเสมอ */
  note?: ReactNode;
  /** ไอคอนหน้าประโยคสถานะ (รอ / ทำ / ติด / เสร็จ) */
  icon?: LucideIcon;
  tone?: ActionZoneTone;
  /** เมนู "เพิ่มเติม" — ชิดขวาของแถวปุ่ม (คำสั่งที่นาน ๆ ใช้) */
  menu?: ReactNode;
  /** โซนบนจอทัช — สูงขึ้นและปุ่มเต็มความกว้าง */
  touch?: boolean;
  className?: string;
}

export function ActionZone({ children, note, icon: Icon, tone = "neutral", menu, touch = false, className }: ActionZoneProps) {
  const hasButtons = Boolean(children) || Boolean(menu);
  return (
    <div className={cn("flex flex-col gap-3", SUNK_PANEL, RADIUS.surface, touch ? "p-4" : "p-3", className)}>
      {note ? (
        <p className={cn("flex min-w-0 items-start gap-2", touch ? "text-base" : "text-sm", tone === "neutral" ? "text-secondary" : "text-strong")}>
          {Icon ? <Icon className={cn("shrink-0", touch ? "mt-1 h-5 w-5" : "mt-0.5 h-4 w-4", ICON_INK[tone])} aria-hidden="true" /> : null}
          <span className="min-w-0">{note}</span>
        </p>
      ) : null}
      {hasButtons ? (
        <div className={cn("flex flex-wrap items-center gap-2", touch && "[&>*]:flex-1")}>
          {children}
          {menu ? <span className={cn(!touch && "ml-auto")}>{menu}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
