import { z } from "zod";
import { normalizeFileUrl } from "@/lib/file-urls";

export const byIdInput = z.object({ id: z.string() });

// URL ไฟล์ทุกตัวที่เข้าทาง mutation ต้อง normalize เป็น proxy URL ก่อนลง DB —
// ฟอร์มแก้รายการ echo URL จากฝั่งอ่านกลับมาทั้งก้อน ถ้าไม่ normalize ที่ทางเข้า
// signed/public URL จะฝังลง DB (ดูเหตุผลเต็มใน src/lib/file-urls.ts)
export const fileUrlSchema = z.string().transform(normalizeFileUrl);
export const fileUrlArraySchema = z.array(fileUrlSchema);

export const paginationInput = z.object({
  page: z.number().default(1),
  limit: z.number().default(20),
});

export const searchInput = z.object({
  search: z.string().optional(),
});

export const paginatedSearchInput = paginationInput.merge(searchInput);
