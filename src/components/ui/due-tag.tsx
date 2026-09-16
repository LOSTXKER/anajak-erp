import { CalendarClock } from "lucide-react";
import { c } from "@/components/kit/kit";
import type { InfoChipTone } from "./info-chip";

/* ============================================================
   DueTag — กำหนดส่งที่หนักตามความรีบ (เพิ่ม 2026-09-02)

   กำหนดส่งคือข้อมูลที่หัวหน้าตัดสินลำดับงานจากมันมากที่สุด ป้ายเดียวที่
   สี/น้ำหนักเปลี่ยนตามความรีบ (สูตรเดียวกับ DueBadge/dueText ที่ใช้ทั่วเว็บ):

     เลยกำหนด  → แดง ตัวหนา "เลยกำหนด 2 วัน"
     วันนี้     → ส้ม ตัวหนา "ส่งวันนี้"
     พรุ่งนี้   → ส้ม "ส่งพรุ่งนี้"
     ≤ 7 วัน   → เทา "อีก 5 วัน"
     ไกลกว่า   → เทา "ส่ง 12 ก.ย."
     ไม่กำหนด  → เทา "ยังไม่กำหนดส่ง"

   หน้าตาใช้ `.due` ของชุดกลาง (kit.module.css) ชุดเดียวกับหน้าออเดอร์/ใบผลิต
   (รวมเป็นสไตล์เดียว 2026-09-17 — เดิมหน้าเก่าวาดเองด้วย InfoChip)
   ============================================================ */

interface DueTagProps {
  dueInDays: number | null;
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

const DUE_CLASS: Record<InfoChipTone, string> = {
  neutral: "n",
  info: "n",
  warning: "warn",
  error: "bad",
  success: "n",
};

export function DueTag({ dueInDays, dateLabel, size = "md", className }: DueTagProps) {
  const { text, tone } = dueTagContent(dueInDays, dateLabel);
  return (
    <span className={[c("due", DUE_CLASS[tone]), size === "lg" ? "text-sm" : "", className ?? ""].filter(Boolean).join(" ")}>
      <CalendarClock aria-hidden="true" />
      {text}
    </span>
  );
}
