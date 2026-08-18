# Job runner smoke — repo นี้รับงานจากคิว bestos ได้

เอกสารสั้นๆ ยืนยันว่า repo `anajak-erp` รับงานจากระบบจัดการเจ้าของ (**bestos**) ผ่านคิวได้จริง

- **ใครสั่ง** — เบส (เจ้าของ) สั่งงานผ่าน bestos → คิวส่งใบงานให้ agent มาทำใน repo นี้
- **branch แยกเสมอ** — ทุกงานรันบน branch ที่ระบบสร้างให้ (`hermes/job-<id>-*`) · agent ไม่สลับ/สร้าง branch เอง
- **ห้ามแตะ main** — ไม่ merge ไม่ push main · `prisma/migrations`, `.env*`, `.github/`, `vercel.json` แตะไม่ได้
- **ห้ามแตะ DB / deploy** — ไม่รัน migrate / seed / db push ไม่ deploy ไม่ลบข้อมูล
- **ผลกลับเป็น branch** — agent commit เอง (ข้อความไทยสั้นๆ) แล้วระบบ push branch ให้เบสตรวจ/merge เอง
- **ก่อนส่ง** — รัน `npm run typecheck` และ `npm test` ให้ผ่านก่อนเสมอ
- **กติกาเต็ม** — ดู `AGENTS.md` (permission 3 ชั้น) + `PROGRESS.md` (สถานะสด) ก่อนเริ่มทุกครั้ง
