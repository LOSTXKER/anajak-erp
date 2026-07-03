// ระบบ URL ไฟล์ (FLOW-REDESIGN ก้อน 4 — signed URL)
//
// กติกาเดียวทั้งระบบ: DB เก็บไฟล์เป็น "proxy URL" รูปแบบ `/api/files/<bucket>/<path>` เท่านั้น
// - ห้ามเก็บ public URL ของ Supabase (bucket จะถูกปิดเป็น private — URL ตาย)
// - ห้ามเก็บ signed URL (มีวันหมดอายุ — กด save ฟอร์มทีเดียว URL ตายฝัง DB ถาวร)
// proxy URL เสถียรถาวร: /api/files/[...path] เช็คสิทธิ์แล้ว redirect ไป signed URL อายุสั้นทุกครั้งที่เปิด
//
// normalizeFileUrl ต้องถูกเรียกที่ "ทางเข้าเขียน DB ทุกจุด" (zod transform ใน router) เพราะ
// ฟอร์มแก้รายการออเดอร์ echo URL จาก read กลับเข้า mutation ทั้งก้อน (order-mapping.ts)

export const FILE_PROXY_PREFIX = "/api/files/";

/** bucket ที่อนุญาตให้เสิร์ฟผ่าน proxy — มี bucket เดียวทั้งระบบ */
export const ALLOWED_FILE_BUCKETS = ["designs"] as const;

export function proxyFileUrl(bucket: string, path: string): string {
  return `${FILE_PROXY_PREFIX}${bucket}/${path}`;
}

/** แยก bucket/path จาก proxy URL (รับทั้ง relative และ absolute · ตัด query ทิ้ง) — ไม่ใช่ proxy URL คืน null */
export function parseProxyFileUrl(
  url: string | null | undefined
): { bucket: string; path: string } | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url, "http://x").pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(FILE_PROXY_PREFIX)) return null;
  const rest = pathname.slice(FILE_PROXY_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash === rest.length - 1) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

// public:  https://<host>/storage/v1/object/public/<bucket>/<path>
// signed:  https://<host>/storage/v1/object/sign/<bucket>/<path>?token=...
// host-agnostic — ย้าย Supabase project แล้วข้อมูลเก่ายัง normalize ได้
const SUPABASE_OBJECT_RE = /^\/storage\/v1\/object\/(?:public|sign)\/(.+)$/;

/**
 * แปลง URL ไฟล์ทุกหน้าตาให้เป็นรูปแบบเก็บลง DB (proxy URL ไม่มี query):
 * - Supabase public/signed URL → `/api/files/<bucket>/<path>`
 * - proxy URL (relative/absolute, มี ?t= ติดมา) → proxy URL เปล่า
 * - อื่นๆ (URL นอกระบบ/ค่าขยะ เช่น Product.imageUrl กรอกมือ) → คืนค่าเดิมไม่แตะ
 */
export function normalizeFileUrl(url: string): string {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url, "http://x");
  } catch {
    return url;
  }
  const supabaseMatch = parsed.pathname.match(SUPABASE_OBJECT_RE);
  if (supabaseMatch) {
    return `${FILE_PROXY_PREFIX}${supabaseMatch[1]}`;
  }
  if (parsed.pathname.startsWith(FILE_PROXY_PREFIX)) {
    return parsed.pathname;
  }
  return url;
}

/**
 * แปะ token ให้ proxy URL สำหรับหน้า public (ลูกค้าไม่มี session —
 * proxy ใช้ token นี้เช็คว่าไฟล์เป็นของลูกค้ารายนี้จริง) · URL นอกระบบคืนค่าเดิม
 * paramName: "t" = approval token (design), "s" = status token (ลิงก์สถานะ ก้อน 4),
 * "os" = share token ใบงานร้านนอก (B14)
 */
export function withFileToken(
  url: string | null | undefined,
  token: string,
  paramName: "t" | "s" | "os" = "t"
): string | null {
  if (!url) return null;
  const normalized = normalizeFileUrl(url);
  if (!normalized.startsWith(FILE_PROXY_PREFIX)) return url;
  return `${normalized}?${paramName}=${encodeURIComponent(token)}`;
}

/**
 * decode percent-encoding แบบไม่ throw — ค่าใน DB อาจ encoded (ผ่าน normalizeFileUrl
 * ที่คืน URL.pathname) ขณะที่ Next decode path param ให้แล้ว — ต้อง decode ทั้งสองฝั่ง
 * ก่อนเทียบ ไม่งั้น path ที่มีช่องว่าง/อักขระพิเศษเทียบไม่เท่าทั้งที่เป็นไฟล์เดียวกัน
 */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * นามสกุลไฟล์ปลอดภัยสำหรับตั้งชื่อ object ใน storage — ASCII ล้วน
 * (ชื่อไฟล์ผู้ใช้ เช่น "FINAL ARTWORK" ไม่มีจุด → split จะได้ทั้งชื่อมีช่องว่าง
 * หลุดเข้า path แล้วทำให้การเทียบสิทธิ์ฝั่ง proxy เพี้ยน)
 */
export function safeFileExt(fileName: string): string {
  const raw = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  return raw.replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase() || "bin";
}
