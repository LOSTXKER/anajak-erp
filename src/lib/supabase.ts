import { createBrowserClient } from "@supabase/ssr";
import { proxyFileUrl } from "@/lib/file-urls";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Upload a file to Supabase Storage and return the proxy URL.
 *
 * คืน `/api/files/<bucket>/<path>` (ไม่ใช่ public URL) — ค่านี้คือรูปแบบเดียว
 * ที่เก็บลง DB ได้ (ดู src/lib/file-urls.ts) เปิดไฟล์ผ่าน /api/files ซึ่งเช็คสิทธิ์
 * แล้ว redirect ไป signed URL — bucket จะถูกปิดเป็น private
 *
 * @param bucket  - Storage bucket name (e.g. "designs")
 * @param path    - Path within the bucket (e.g. "orders/abc123/v1.png")
 * @param file    - The File object to upload
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const supabase = createClient();

  // upsert ต้องเป็น false — x-upsert ทำให้ storage-api เดินเส้นทางที่ต้องมีสิทธิ์
  // UPDATE ซึ่ง RLS จงใจไม่ให้ (เขียนทับ=0 เพื่อหลักฐานแบบที่อนุมัติ) จะโดนปัดทั้งก้อน
  // ชื่อไฟล์สุ่มไม่ซ้ำอยู่แล้ว (ทุก callsite ใช้ timestamp+random) ไม่มีเหตุต้อง upsert
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return proxyFileUrl(bucket, path);
}

/**
 * อัปไฟล์ผ่าน "signed upload URL" — สำหรับลูกค้าที่ไม่มี account/session
 * (ก้อน 4 ชิ้น 3 — ลิงก์อัปโหลดลูกค้า). server ออก token + path มาให้ (service role)
 * → ใช้ anon client อัปได้โดยไม่ต้อง login (token เป็นใบเบิกทางต่อไฟล์เดียว)
 * คืน proxy URL เหมือน uploadFile — แต่ฝั่งลูกค้าไม่ได้เอาไปเก็บ DB เอง (server ทำใน confirm)
 */
export async function uploadToCustomerSignedUrl(
  bucket: string,
  path: string,
  token: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type || undefined,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return proxyFileUrl(bucket, path);
}
