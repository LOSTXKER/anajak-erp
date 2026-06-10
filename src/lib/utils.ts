import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// ไฟล์แบบที่ browser แสดงเป็นรูปได้ — .ai/.psd/.pdf อัปโหลดได้แต่ render <img> ตรงๆ จะแตก
// ใช้กันรูปแตกในหน้า approve ลูกค้า / Job Ticket / thumbnail ลายพิมพ์
export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const pathname = new URL(url, "http://x").pathname;
    return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(pathname);
  } catch {
    return false;
  }
}

// เลขเอกสารทั้งหมดย้ายไป src/server/services/document-number.ts (DocumentSequence —
// รันต่อเนื่องใน transaction, ห้ามสุ่ม) — ไฟล์นี้เหลือเฉพาะ util ที่ client ใช้ร่วม
