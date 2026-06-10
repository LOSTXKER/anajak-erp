# PROGRESS — สถานะสด (อัปเดตทุก session)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: อัปเดตไฟล์นี้ก่อนปิด

## ตอนนี้
- **Phase: P0 — ฐานราก · P0.1–P0.4 เสร็จแล้ว ✅** (2026-06-10)
- งานถัดไป: **P0.5 จัดระเบียบโค้ด** ตาม checklist ใน `ROADMAP.md` (vitest + test แกน pricing/status/เลขเอกสาร/payment → ลบ dead code ที่ survey ชี้ → payment-method enum mismatch → lint เข้ม → docs/ARCHITECTURE.md) — **test แกนก่อน เป็นเกราะของ refactor ทุกตัวหลังจากนี้**
- ลำดับใน P0: ~~P0.1 Auth~~ → ~~P0.2 เงิน~~ → ~~P0.3 ฐานข้อมูล~~ → ~~P0.4 เผื่ออนาคต~~ → P0.5 จัดระเบียบโค้ด

## เสร็จแล้ว
- 2026-06-10 — **P0.3 วินัยฐานข้อมูล**: เริ่ม `prisma migrate` แล้ว — baseline `0_init` จาก DB ปัจจุบัน (mark applied) + migration `add_hot_path_indexes` (Order.customerId/internalStatus/createdAt · Invoice.paymentStatus · ProductionStep.assignedToId) · **เลิก db push ตั้งแต่บัดนี้ — ใช้ `npx prisma migrate dev` เท่านั้น** · seed.ts เขียนใหม่ = master data เท่านั้น (ServiceCatalog 25 — idempotent ไม่ทับราคาที่ผู้ใช้แก้ ไม่แตะ PackagingOption/Pattern ที่ผู้ใช้จัดการเองใน UI) รันผ่านจริง · **ล้างข้อมูลทดสอบหมดแล้ว (เบสยืนยัน)**: orders 10/invoices 3/payments 7/quotations 2/customers 5/vendors demo 2/notifications/auditLogs/user ปลอม 5/DocumentSequence — เหลือของจริง: user เบส 1 · products 9 + variants 760 (Stock sync) · ServiceCatalog 25 · Pattern 1 · PackagingOption 5 · Settings 2
- 2026-06-10 — **P0.4 เสร็จโดยงาน P0.2** (ไม่มีงานเพิ่ม): schema เผื่อ tax-point แล้ว (enum TaxLineType บน OrderItem — GOODS/HIRE_OF_WORK ตั้งอัตโนมัติตาม orderType) · business logic แกนแยกเป็น `src/server/services/` แล้ว (pricing/order-status/document-number/money) — tRPC router เป็นผิวตามกติกา
- 2026-06-10 — **P0.2 เงินถูกต้อง ครบ 6 ใบงาน + แก้ findings จาก review** (รายละเอียดเต็มดู commit d55369c):
  - Float→Decimal(12,2) 44 field + result extension แปลงเป็น number ตอนอ่าน (`src/lib/prisma.ts`) + ตาข่าย superjson + aggregate ใช้ `aggToNumber`
  - platformFee สูตร A ทุกที่ (ไม่เข้ายอดบิล/ฐาน VAT — เงินที่ marketplace หักจากร้าน)
  - billing $transaction + SELECT FOR UPDATE + Decimal เป๊ะ · อุดบั๊ก void ซ้ำ/refund หลัง void
  - DocumentSequence เลขรันต่อเนื่องต่อชนิด/เดือน (เวลาไทย) ใน tx เดียวกับเอกสาร
  - status ผ่าน `transitionOrder` จุดเดียว + machine เพิ่ม DESIGNING→DESIGN_APPROVED, CONFIRMED→PRODUCTION_QUEUE (CUSTOM)
  - guard เงินหลัง COMPLETED/CANCELLED + discount เกินยอดโดนปฏิเสธชั้น service
  - verify จริง `scripts/verify-p02.ts` 35/35 + adversarial review 5 มิติแก้ครบ
- 2026-06-10 — **P0.1 Auth จริง + RBAC ทั้งระบบ** — verify จริงผ่าน HTTP ทุกเคส (ดู commit d39e451/871b4f1)
- 2026-06-10 — แผน P0-P4 + ใบงาน (`ROADMAP.md`) · retrofit repo

## ติดอยู่ / รอตัดสิน
- (ว่าง)

## ข้อเท็จจริงที่ session ใหม่ต้องรู้
- **บัญชี OWNER ของเบส**: hongtaeswatht@gmail.com (user เดียวในระบบตอนนี้) · สร้างพนักงานที่ Settings → Users · bootstrap เครื่องใหม่: `node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]`
- **DB สะอาดแล้ว**: ไม่มีข้อมูลทดสอบ ไม่มี order/customer ใดๆ — เลขเอกสารจะเริ่ม 0001 เมื่อสร้างเอกสารแรกของเดือน · ปัญหา "เลขเก่าชน sequence" หมดไปแล้ว (ลบเอกสารเก่าหมด)
- **migration ใช้จริงแล้ว**: `npx prisma migrate dev` เท่านั้น ห้าม db push · history: `0_init` (baseline) → `add_hot_path_indexes`
- **กติกาเงิน/สถานะหลัง P0.2** (ผูกทุกงานต่อจากนี้): mutation แตะยอดเงิน → ผ่าน `src/server/services/pricing.ts` · สูตร preview client (`lib/pricing.ts calculateOrderSummary`) ต้อง mirror server · field เงินจาก Prisma เป็น number แล้ว **ยกเว้น aggregate ต้อง `aggToNumber`** · status → `transitionOrder` เท่านั้น · เลขเอกสาร → `nextDocumentNumber(tx, type)` ใน tx เดียวกับเอกสาร
- **ของที่จงใจยังไม่ทำ + ใบงานรองรับ** (อย่าทำซ้ำ/อย่าแก้เงียบ):
  - billing.create ยังไม่กันบิลรวมเกินยอดออเดอร์ → P1 (มัดจำ/ใบวางบิล)
  - platformFee → CostEntry/margin อัตโนมัติ → P2 job costing (โซ่ต้นทุน กติกา 4)
  - attachment.create ไม่ validate entityType/entityId → P0.5 · sidebar โชว์เมนูทุก role → P1.0 · outsource/stock-sync scope ราย assignment → P2 · convertToOrder TOCTOU แคบ → optional
  - review เสริม 2 มิติ (pricing-formula/decimal-boundary ละเอียด) ยังไม่ได้รันซ้ำ (ติด session limit ตอนนั้น) — ครอบคลุมโดยมิติอื่น+empirical แล้วเป็นส่วนใหญ่
- scripts ที่มี: `create-owner.ts` (bootstrap) · `verify-p02.ts` (ทดสอบเส้นทางเงิน 35 เคส — สร้างข้อมูล [P0.2-VERIFY] จริงใน DB ถ้ารัน อย่ารันบน DB ที่ใช้งานจริงแล้ว) · `migrate-order-items.ts` (เก่า — เก็บกวาดตอน P0.5)
