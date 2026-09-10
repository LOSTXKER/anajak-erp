# Anajak ERP

ระบบหลังบ้านของโรงงานสกรีนเสื้อ Anajak — ออเดอร์ · ใบเสนอราคา · ออกแบบ/อนุมัติแบบ · การผลิตและงานส่งร้านนอก · QC · จัดส่ง · บิล/เอกสารภาษี/ลูกหนี้ · เชื่อมระบบคลัง Anajak Stock

Next.js 16 · React 19 · tRPC · Prisma (PostgreSQL บน Supabase) · Tailwind CSS 4

## รันบนเครื่อง
1. Node 24 (ตรงกับ CI) + npm → `npm ci`
2. คัดลอก `.env.example` เป็น `.env` แล้วเติมค่า (Supabase + PostgreSQL)
3. `npm run dev` → http://localhost:3000

- ฐานข้อมูลใหม่: `npm run db:migrate` → `npm run db:seed` (master data) → สร้างเจ้าของคนแรกด้วย `scripts/create-owner.ts`
- ฐานทดลองในเครื่อง (Docker): `npm run db:seed:demo` แล้ว `npm run dev:demo` — ดู `docs/local-demo-data.md`
- ด่านก่อน commit: `npm run typecheck && npm run lint && npm test && npm run verify:ui`

## กติกาและเอกสาร
- กติกาการทำงาน · โครงสร้าง · คำสั่ง → `AGENTS.md`
- อะไรคือ "เสร็จ" → `SPEC.md` · งานค้าง → `ROADMAP.md` · สถานะล่าสุด → `PROGRESS.md` · ดีไซน์ → `PRODUCT.md` + `DESIGN.md`
