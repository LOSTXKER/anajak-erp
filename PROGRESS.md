# PROGRESS — สถานะสด (อัปเดตทุก session)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: อัปเดตไฟล์นี้ก่อนปิด

## ตอนนี้
- **Phase: P0 — ฐานราก · P0.1 Auth เสร็จแล้ว ✅** (2026-06-10)
- งานถัดไป: **P0.2 เงินถูกต้อง** ตาม checklist ใน `ROADMAP.md` (Float→Decimal 54 จุด → แก้ platformFee สูตรเดียว → recordPayment/void/refund เป็น `$transaction` → DocumentSequence แทนเลขสุ่ม → enforce status transition ชั้น server กลาง → status guard ของ order.updateFees/update)
- ลำดับใน P0: ~~P0.1 Auth~~ → P0.2 เงิน → P0.3 ฐานข้อมูล → P0.4 เผื่ออนาคต → P0.5 จัดระเบียบโค้ด

## เสร็จแล้ว
- 2026-06-10 — **P0.1 Auth จริง + RBAC ทั้งระบบ**: supabaseId lookup + ตัด dev-OWNER fallback ทิ้งหมด (ไม่มี session = 401) · login/logout จริงผ่าน Supabase · `src/middleware.ts` กันทุก route (ยกเว้น /api/* ที่ tRPC กันเอง + /approve/* token-based) + layout guard ชั้นสอง · user router + หน้า Settings → Users (สร้างพนักงาน/เปลี่ยน role/ปิดบัญชี+ban Supabase/รีเซ็ตรหัส — OWNER เท่านั้น) · requireRole ครบทุก mutation ใน 19 routers · token อนุมัติแบบ: expiry 30 วัน + ตายทันทีเมื่อ upload version ใหม่ + กันตัดสินซ้ำ/กลับคำ + phase guard (ดึงสถานะออเดอร์ที่ผลิตแล้วถอยกลับไม่ได้ — ทั้ง upload/approve/approveByToken) · ownership checks: notification markRead scope ตัวเอง, attachment ลบได้เฉพาะของตัวเอง (ยกเว้น OWNER/MANAGER), production step auto-claim งานว่าง + ห้ามแตะงานคนอื่น/ต้นทุน · ผ่าน adversarial review (31 agents, 25 confirmed findings) — แก้ critical/high/medium ใน scope ครบ · **verify จริงผ่าน HTTP ทุกเคส** (login, 401, FORBIDDEN ตาม role, auto-claim, phase guards, token double-decision)
- 2026-06-10 — แผน P0-P4 + ใบงาน (`ROADMAP.md`) · ติดป้าย supersede ใน vision doc · retrofit repo (CLAUDE.md + PROGRESS.md)

## ติดอยู่ / รอตัดสิน
- (ว่าง)

## ข้อเท็จจริงที่ session ใหม่ต้องรู้
- **บัญชี OWNER ของเบส**: hongtaeswatht@gmail.com — login ได้แล้ว · เปลี่ยนรหัสผ่านที่ Settings → Users → รีเซ็ตรหัส
- bootstrap OWNER คนแรก (เครื่อง/DB ใหม่): `node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]` (รันซ้ำได้)
- **DB ไม่ได้ว่างสนิท**: มี user เก่าจาก seed เดิม (login ไม่ได้ — supabaseId ไม่ผูกกับ Supabase จริง) + orders เก่าค้างราว 3 ใบ → ล้างตอน P0.3 พร้อมแก้ seed
- ยังใช้ `db push` (เลิกตอน P0.3 ตามแผน) — schema เพิ่ม `DesignVersion.tokenExpiresAt` แล้ว
- **requireRole matrix สรุป**: เงินเข้า-ออกจริง (recordPayment/void/refund) = OWNER+ACCOUNTANT · เปิดบิล/markOverdue/อ่านการเงินระดับระบบ = +MANAGER · order/quotation/delivery/customer = +SALES (SALES ห้ามแตะ creditLimit) · production/stock/delivery-status = +PRODUCTION_STAFF (เฉพาะงานที่ assign + auto-claim step ว่าง · QC outsource = manager ขึ้นไป) · master data = OWNER/MANAGER (+DESIGNER แพทเทิร์น/design upload · +SALES quick-add pattern) · จัดการ user = OWNER เท่านั้น · analytics.dashboard ส่ง field เงินเป็น null ให้ role ที่ไม่ใช่ OWNER/MANAGER/ACCOUNTANT
- **review findings ที่จงใจเลื่อน** (มีใบงานรองรับแล้ว — อย่าทำซ้ำ):
  - production.create / processDesignApproval ยัง set internalStatus ตรง → ปิดโดยใบงาน P0.2 "enforce status transition ชั้น server กลาง"
  - attachment.create ไม่ validate entityType/entityId ว่าชี้ของจริง → เก็บตอน P0.5
  - outsource/stock-sync ยังไม่ scope ตาม assignment ราย production → รอ P2 per-item tracking
  - sidebar ยังโชว์เมนูทุก role (หน้า billing/analytics มี guard ในหน้าแล้ว) → P1.0 design system
  - billing.create คง MANAGER ไว้ (กว้างกว่าตาราง §7 นิดหน่อย — ตัดสินใจคงไว้เพราะทีมเล็ก)
  - quotation.convertToOrder มี TOCTOU window แคบ (double-click) → optional hardening ใช้ updateMany conditional แบบ approveByToken
- บั๊กรู้จุดรอแก้ P0.2: platformFee สูตรไม่ตรงกัน (order.ts create vs update vs UI) · billing เงินหลายขั้นตอนไม่ atomic · เลขเอกสารสุ่ม (`src/lib/utils.ts:39-87`) · seed.ts พังกับ schema ปัจจุบัน (P0.3)
