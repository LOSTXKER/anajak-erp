import type { NextConfig } from "next";

// Security headers (Gate B15) — ใส่ทุก route · ป้องกัน clickjacking / MIME sniff / รั่ว referrer
// หมายเหตุ: ยังไม่ตั้ง Content-Security-Policy (ต้องไล่ทดสอบ inline script/style ของ Next +
// รูปจาก Supabase signed URL ก่อน ไม่งั้น break ทั้งแอป) — จดเป็น follow-up ใน ROADMAP B15
const securityHeaders = [
  // บังคับ HTTPS 2 ปี (มีผลบน production HTTPS เท่านั้น — localhost ไม่กระทบ)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // ห้ามฝังหน้าใน iframe (กัน clickjacking) — หน้า public /job /status เปิดตรง ไม่ต้องถูกฝัง
  { key: "X-Frame-Options", value: "DENY" },
  // ห้าม browser เดา MIME (กันไฟล์แนบถูกตีความเป็น script)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // ส่ง referrer เฉพาะ origin ข้ามเว็บ (กัน token ใน path/query รั่วผ่าน Referer)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // ปิดสิทธิ์อุปกรณ์ที่แอปไม่ใช้
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
