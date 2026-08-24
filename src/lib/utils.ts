import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// โซนเวลาไทย — ปักที่เดียวให้วันที่ render เท่ากันทุกเครื่อง: server ที่ไม่ใช่เวลาไทย
// format ต่างจาก browser ได้ (คลาดวัน 1 วัน + hydration mismatch) · จุด format
// เฉพาะทางที่ไม่ใช้ helper กลางให้ส่ง timeZone: BANGKOK_TZ เอง
// (ปี พ.ศ. ของฟอร์มสรรพากรอยู่ lib/sales-tax-report.ts — pin แยกและมี test แล้ว)
export const BANGKOK_TZ = "Asia/Bangkok";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** เงินแบบทศนิยม 2 ตำแหน่งเสมอ (หน้าลูกค้า/เอกสาร) — เดิม const baht ก๊อปซ้ำหลายหน้า */
export function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: BANGKOK_TZ,
  }).format(new Date(date));
}

/** วันที่แบบสั้นไม่มีปี (ชิปกำหนดส่ง/จอโรงงาน) */
export function formatDateShort(date: Date | string | number): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: "short",
    day: "numeric",
    timeZone: BANGKOK_TZ,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BANGKOK_TZ,
  }).format(new Date(date));
}

/** เวลาอย่างเดียว ชม.:นาที (จอโรงงาน/คิวงาน) */
export function formatTime(date: Date | string | number): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BANGKOK_TZ,
  }).format(new Date(date));
}

// ไฟล์แบบที่ browser แสดงเป็นรูปได้ — .ai/.psd/.pdf อัปโหลดได้แต่ render <img> ตรงๆ จะแตก
// ใช้กันรูปแตกในหน้า approve ลูกค้า / Job Ticket / thumbnail ลายพิมพ์
export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // demo/local preview และภาพที่สร้างใน browser อาจเป็น data URL ที่เปิดใน <img> ได้จริง
  // รับเฉพาะ MIME รูปที่ระบบรองรับ ไม่เหมารวม data:* ชนิดอื่นเป็นรูป
  if (/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml|avif)(?:;[^,]*)?,/i.test(url)) {
    return true;
  }
  try {
    const pathname = new URL(url, "http://x").pathname;
    return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(pathname);
  } catch {
    return false;
  }
}

// เลขเอกสารทั้งหมดย้ายไป src/server/services/document-number.ts (DocumentSequence —
// รันต่อเนื่องใน transaction, ห้ามสุ่ม) — ไฟล์นี้เหลือเฉพาะ util ที่ client ใช้ร่วม
