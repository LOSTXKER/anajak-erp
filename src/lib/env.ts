import { z } from "zod";

// ตรวจ env ตอนบูต (Gate B15) — fail-fast ถ้าตัวแปรที่ระบบขาดไม่ได้หาย/ผิดรูป
// เดิมโค้ดอ่าน process.env.X! กระจายหลายจุด — ตั้งค่าผิดจะพังตอน request แรกแบบงงๆ
// (เช่น service role key หาย → /api/files 500 ทุกไฟล์) · ที่นี่รวมตรวจครั้งเดียวตอน start
// เรียกจาก src/instrumentation.ts (เฉพาะ nodejs runtime)

// ขาดไม่ได้ — ระบบทำงานไม่ได้เลยถ้าไม่มี
const requiredEnv = z.object({
  DATABASE_URL: z.string().min(1, "ต้องมี (Prisma ต่อ DB)"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("ต้องเป็น URL (Supabase)"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "ต้องมี (auth ฝั่ง client)"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "ต้องมี (ออก signed URL ไฟล์)"),
});

// ควรมีบน production (ไม่ถึงกับบูตไม่ขึ้น — แค่เตือน)
const RECOMMENDED_PROD = ["NEXT_PUBLIC_APP_URL", "CRON_SECRET"] as const;

export function validateEnv(): void {
  const parsed = requiredEnv.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[env] ตัวแปรสภาพแวดล้อมที่จำเป็นไม่ครบ/ไม่ถูกต้อง:\n${lines}\nดูรายการเต็มใน .env.example`
    );
  }
  if (process.env.NODE_ENV === "production") {
    const missing = RECOMMENDED_PROD.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.warn(`[env] แนะนำตั้งบน production (ยังทำงานได้แต่ฟีเจอร์บางส่วนจะจำกัด): ${missing.join(", ")}`);
    }
  }
}
