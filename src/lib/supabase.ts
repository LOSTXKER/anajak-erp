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

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return proxyFileUrl(bucket, path);
}
