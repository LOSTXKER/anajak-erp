import { CalendarClock } from "lucide-react";
import { InfoChip, type InfoChipTone } from "./info-chip";

/* ============================================================
   DueTag — กำหนดส่งที่หนักตามความรีบ (เพิ่ม 2026-09-02)

   กำหนดส่งคือข้อมูลที่หัวหน้าตัดสินลำดับงานจากมันมากที่สุด แต่เดิมเป็น
   "ส่ง: อีก 6 วัน · 5 ก.ย." ตัวเทาเท่ากับทุกอย่าง — DueTag ให้ป้ายเดียวที่
   สี/น้ำหนักเปลี่ยนตามความรีบ (สูตรเดียวกับ DueBadge/dueText ที่ใช้ทั่วเว็บ):

     เลยกำหนด  → error (แดง) ตัวหนา "เลยกำหนด 2 วัน"
     วันนี้     → warning (ส้ม) ตัวหนา "ส่งวันนี้"
     พรุ่งนี้   → warning "ส่งพรุ่งนี้"
     ≤ 7 วัน   → neutral "อีก 5 วัน"
     ไกลกว่า   → neutral "ส่ง 12 ก.ย."
     ไม่กำหนด  → neutral จาง "ยังไม่กำหนดส่ง"
   ============================================================ */

interface DueTagProps {
  /** ระยะถึงกำหนดส่งเป็นวัน · ติดลบ = เลยกำหนด · null = ยังไม่กำหนด */
  dueInDays: number | null;
  /** วันที่แบบสั้น เช่น "5 ก.ย." — ต่อท้ายเมื่อไม่ใช่วันนี้/พรุ่งนี้ */
  dateLabel?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function dueTagContent(dueInDays: number | null, dateLabel?: string | null): {
  text: string;
  tone: InfoChipTone;
  strong: boolean;
} {
  if (dueInDays === null) return { text: "ยังไม่กำหนดส่ง", tone: "neutral", strong: false };
  if (dueInDays < 0) {
    return {
      text: `เลยกำหนด ${Math.abs(dueInDays)} วัน${dateLabel ? ` (${dateLabel})` : ""}`,
      tone: "error",
      strong: true,
    };
  }
  if (dueInDays === 0) return { text: "ส่งวันนี้", tone: "warning", strong: true };
  if (dueInDays === 1) return { text: "ส่งพรุ่งนี้", tone: "warning", strong: false };
  if (dueInDays <= 7) {
    return {
      text: `อีก ${dueInDays} วัน${dateLabel ? ` (${dateLabel})` : ""}`,
      tone: "neutral",
      strong: false,
    };
  }
  return { text: dateLabel ? `ส่ง ${dateLabel}` : `อีก ${dueInDays} วัน`, tone: "neutral", strong: false };
}

export function DueTag({ dueInDays, dateLabel, size = "md", className }: DueTagProps) {
  const { text, tone, strong } = dueTagContent(dueInDays, dateLabel);
  return (
    <InfoChip icon={CalendarClock} tone={tone} strong={strong} size={size} className={className}>
      {text}
    </InfoChip>
  );
}
