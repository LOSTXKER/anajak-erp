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

// หน้าตาของเงินย้ายไป lib/format.ts (ไฟล์เปล่าไม่มี dependency — service ฝั่ง server เรียกได้)
// re-export ไว้ที่เดิมเพื่อไม่ต้องไล่แก้ import ของหน้าที่ session อื่นถืออยู่
export { formatAmount, formatBaht, formatBahtRounded } from "./format";

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

/** วันที่แบบย่อมีปี 2 หลัก เช่น "14 ก.ย. 69" — หน้าออเดอร์ตามต้นแบบรอบ 2 (2026-09-14) */
export function formatDateCompact(date: Date | string | number): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: BANGKOK_TZ,
  }).format(new Date(date));
}

/** วันที่ตัวเลข DD/MM/พ.ศ. เช่น "18/09/2569" — ไฟล์ที่ดาวน์โหลด (CSV) ที่ Excel ต้องอ่านเป็นวันที่ได้
 *  ตั้งใจให้ต่างจากวันที่บนจอ ("18 ก.ย. 2569"): บนจอไว้ให้คนอ่าน ในไฟล์ไว้ให้โปรแกรมอ่าน
 *  เดิม CSV เรียก toLocaleDateString("th-TH") เปล่า ๆ ซึ่งยึดเขตเวลาของเครื่องที่กดโหลด —
 *  กดจากเครื่องที่ไม่ได้ตั้งเวลาไทย ออเดอร์ที่เปิดหัวค่ำจะเลื่อนไปอีกวันในไฟล์
 *  ระบุปฏิทิน buddhist ไว้ตรง ๆ (ไม่พึ่งค่าปริยายของ th-TH เหมือน helper ตัวอื่น) เพราะปีที่เป็น
 *  ตัวเลขล้วนไม่มีอะไรบอกศักราช ถ้าหลุดเป็น ค.ศ. คนอ่านไฟล์จะไม่ทันสังเกต */
export function formatDateNumeric(date: Date | string | number): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: BANGKOK_TZ,
  }).format(new Date(date));
}

/** วันที่เต็มมีชื่อวัน เช่น "วันศุกร์ที่ 18 กันยายน 2569" — หัวหน้าแรก/หัวกลุ่มวันในแท็บประวัติ
 *  เดิม longDate (home-view) เขียน locale "th-TH-u-ca-buddhist" ส่วน dayLabel (order-revisions)
 *  เขียน "th-TH" — ตรวจแล้วทั้งคู่ resolve เป็นปฏิทิน buddhist ให้ปี พ.ศ. เท่ากัน จึงรวมเป็นตัวเดียว */
export function formatDateFull(date: Date | string | number): string {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
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

/** จำนวนวันที่ผ่านมาเป็นคำ — แยกออกมาให้หน้าที่นับวันเองด้วยปฏิทินไทย
 *  (differenceInBangkokDays) ใช้ถ้อยคำชุดเดียวกันได้ โดยไม่ต้องรับวิธีนับของ timeAgo ไปด้วย */
export function daysAgoText(days: number): string {
  if (days <= 0) return "วันนี้";
  if (days < 7) return `${days.toLocaleString("th-TH")} วันก่อน`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks.toLocaleString("th-TH")} สัปดาห์ก่อน`;
  return `${Math.floor(days / 30).toLocaleString("th-TH")} เดือนก่อน`;
}

/** "ผ่านมานานแค่ไหน" ของทั้งเว็บ — ถ้อยคำชุด "…ก่อน" ตามต้นแบบ (เดิมหน้าแจ้งเตือนเขียน "…ที่แล้ว")
 *  นับเป็นช่วง 24 ชม. จากมิลลิวินาที ไม่ใช่วันตามปฏิทิน · หน้าที่ต้องการวันตามปฏิทินไทย
 *  ให้นับเองด้วย differenceInBangkokDays แล้วส่งเข้า daysAgoText */
export function timeAgo(date: Date | string | number, now: number = Date.now()): string {
  const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "เมื่อสักครู่";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีก่อน`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงก่อน`;
  return daysAgoText(Math.floor(hours / 24));
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
