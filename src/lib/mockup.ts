// ม็อกอัพ = ไฟล์ชั้น 2 (APPROVAL) ตาม src/lib/file-layers.ts — แบบที่ส่งให้ลูกค้าตัดสิน
// และเป็นภาพเดียวที่ฝ่ายผลิตใช้อ้างอิงหน้างาน · เก็บใน DesignVersion (+ DesignVersionFile)
//
// ไฟล์นี้คือ "สูตรอ่านม็อกอัพ" ชุดเดียวของทั้งระบบ — หน้าออเดอร์ หน้าผลิต station ใบสั่งผลิต
// และลิงก์ลูกค้าต้องเรียกจากที่นี่ ห้ามคำนวณเองซ้ำ ไม่งั้นแต่ละจอโชว์คนละรูป
//
// กติกาที่ยกมาจาก schema: `DesignVersion.fileUrl` = รูปปก และมีเสมอ ส่วน `files` เพิ่งมี
// ตั้งแต่ migration 20260822052000 → เวอร์ชันเก่าทั้งหมด `files` ว่าง จึงต้องถอยไปใช้รูปปก

import { isImageUrl } from "@/lib/utils";
import { PRINT_POSITIONS } from "@/types/order-form";

export const MOCKUP_LABEL = "ม็อกอัพ";

/** จำนวนรูปต่อเวอร์ชัน — กันอัปรัวจนหน้าอนุมัติลูกค้าโหลดไม่ไหว (หน้า/หลัง/แขน 2 ข้าง/ปก/กระเป๋า + เผื่อ) */
export const MOCKUP_MAX_FILES_PER_VERSION = 12;

export interface MockupFileLike {
  fileUrl: string;
  thumbnailUrl?: string | null;
  position?: string | null;
  caption?: string | null;
}

export interface MockupVersionLike {
  fileUrl: string;
  thumbnailUrl?: string | null;
  files?: readonly MockupFileLike[] | null;
}

export interface MockupImage {
  /** ไฟล์ต้นฉบับที่ให้กดเปิด/ดาวน์โหลด (อาจเป็น .ai/.psd ที่เปิดในเบราว์เซอร์ไม่ได้) */
  fileUrl: string;
  /** รูปที่แสดงได้จริง — null = ไม่มีรูปให้ดู ต้อง fallback เป็นไอคอนไฟล์ */
  previewUrl: string | null;
  position: string | null;
  positionLabel: string | null;
  caption: string | null;
}

export function mockupPositionLabel(position: string | null | undefined): string | null {
  if (!position) return null;
  return PRINT_POSITIONS[position] ?? null;
}

/** รูปที่เอาไปแสดงได้จริงของไฟล์หนึ่งชิ้น — .ai/.psd ต้องพึ่ง thumbnail ที่ดีไซเนอร์แนบมา */
export function mockupPreviewUrl(file: MockupFileLike): string | null {
  if (file.thumbnailUrl && isImageUrl(file.thumbnailUrl)) return file.thumbnailUrl;
  if (isImageUrl(file.fileUrl)) return file.fileUrl;
  return null;
}

/**
 * รูปทั้งชุดของเวอร์ชันหนึ่ง เรียงตามที่ดีไซเนอร์จัดไว้
 *
 * เวอร์ชันเก่า (ก่อนมี DesignVersionFile) `files` ว่าง → คืนรูปปกใบเดียว เพื่อให้ทุกจอ
 * แสดงของเดิมได้เหมือนก่อนโดยไม่ต้อง backfill ฐานข้อมูล
 */
export function mockupImages(version: MockupVersionLike): MockupImage[] {
  const files = version.files ?? [];
  const source: MockupFileLike[] =
    files.length > 0
      ? [...files]
      : [{ fileUrl: version.fileUrl, thumbnailUrl: version.thumbnailUrl ?? null }];

  return source.map((file) => ({
    fileUrl: file.fileUrl,
    previewUrl: mockupPreviewUrl(file),
    position: file.position ?? null,
    positionLabel: mockupPositionLabel(file.position),
    caption: file.caption ?? null,
  }));
}

/** รูปเดียวสำหรับแถวรายการ/การ์ด — รูปแรกที่แสดงได้จริง ไม่มีเลยคืน null */
export function mockupCoverImage(version: MockupVersionLike): string | null {
  return mockupImages(version).find((img) => img.previewUrl)?.previewUrl ?? null;
}

/** จำนวนรูปในชุด — ใช้บอก "ดูครบ 3 ด้าน" บนหน้าจอ */
export function mockupImageCount(version: MockupVersionLike): number {
  return mockupImages(version).length;
}

/**
 * ไฟล์ที่ต้องแนบรูปตัวอย่างเพิ่ม — ไฟล์งาน .ai/.psd ลูกค้าเปิดบนมือถือไม่ได้
 * ส่งลิงก์ไปแล้วลูกค้าต้องตัดสินทั้งที่มองไม่เห็นแบบ (audit ข้อ 15)
 */
export function mockupFilesNeedingPreview(files: readonly MockupFileLike[]): number[] {
  return files.reduce<number[]>((acc, file, index) => {
    if (!mockupPreviewUrl(file)) acc.push(index);
    return acc;
  }, []);
}

/** ชุดนี้พร้อมส่งให้ลูกค้าไหม — ต้องมีอย่างน้อย 1 ไฟล์ และทุกไฟล์ต้องมีรูปให้ดู */
export function canSubmitMockupSet(files: readonly MockupFileLike[]): boolean {
  return files.length > 0 && mockupFilesNeedingPreview(files).length === 0;
}
