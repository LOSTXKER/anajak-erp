# PROGRESS — สถานะสด (อัปเดตทุก session)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: อัปเดตไฟล์นี้ก่อนปิด

## ตอนนี้
- **Phase: P0 — ฐานราก · ยังไม่เริ่ม** (แผนเซ็ตเสร็จ 2026-06-10)
- งานถัดไป: เริ่ม **P0.1 Auth** ตาม checklist ใน `ROADMAP.md` (แก้ supabaseId lookup → ตัด dev fallback → login จริง → middleware → invite users → requireRole ทั่ว)
- ลำดับใน P0: P0.1 Auth → P0.2 เงิน → P0.3 ฐานข้อมูล → P0.4 เผื่ออนาคต → P0.5 จัดระเบียบโค้ด (test แกนทำก่อนได้เลย — เป็นเกราะของทุกข้อ)

## เสร็จแล้ว
- 2026-06-10 — แผน P0-P4 + ใบงาน (`ROADMAP.md`) · ติดป้าย supersede ใน vision doc · retrofit repo (CLAUDE.md + PROGRESS.md + ล้าง config ระบบเก่า) — โดย Nami (bestos)

## ติดอยู่ / รอตัดสิน
- (ว่าง)

## ข้อเท็จจริงที่ session ใหม่ต้องรู้
- DB ว่าง ไม่มีข้อมูลจริง — แก้ schema ได้อิสระ (db push ได้จนถึง P0.3 ค่อยขึ้น migrate)
- โค้ดปัจจุบัน ~55-60% ของ workflow จริง แต่ **ห้ามใช้จริง/deploy จนจบ P0** (auth เปิดโล่ง — ทุก request เป็น OWNER)
- บั๊กรู้จุดแล้วรอแก้ใน P0: trpc.ts:26 (auth lookup ผิดคอลัมน์) · order.ts:394 vs :728/:793 (platformFee) · billing.ts recordPayment ไม่ atomic · src/lib/utils.ts:39-87 (เลขเอกสารสุ่ม) · seed.ts พังกับ schema ปัจจุบัน
