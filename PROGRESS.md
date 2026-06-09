# PROGRESS — สถานะสด (อัปเดตทุก session)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: อัปเดตไฟล์นี้ก่อนปิด

## ตอนนี้
- **Phase: P0 — ฐานราก · P0.2 เงินถูกต้อง เสร็จแล้ว ✅** (2026-06-10)
- งานถัดไป: **P0.3 วินัยฐานข้อมูล** ตาม checklist ใน `ROADMAP.md` (เริ่ม `prisma migrate` + baseline จาก DB ปัจจุบัน · แก้ seed.ts · ล้างข้อมูลทดสอบ · ใส่ index hot paths)
- ลำดับใน P0: ~~P0.1 Auth~~ → ~~P0.2 เงิน~~ → P0.3 ฐานข้อมูล → P0.4 เผื่ออนาคต → P0.5 จัดระเบียบโค้ด

## เสร็จแล้ว
- 2026-06-10 — **P0.2 เงินถูกต้อง ครบ 6 ใบงาน + แก้ findings จาก review**:
  - **Float→Decimal(12,2) 44 field เงิน** ใน schema (คง Float เฉพาะ non-money 10 ตัว: rfmScore/profitMargin%/width/height/reorderPoint/quantity×2/ratings×3) + **push ลง DB จริงแล้ว** (เบสอนุญาต — cast สะอาด ไม่มีค่าเสีย ตรวจ live DB แล้ว) · ชั้นแปลงอยู่ `src/lib/prisma.ts` result extension (Decimal→number ตอนอ่าน รวม nested relations — โค้ดชั้นบนใช้ number เหมือนเดิม) · aggregate ไม่ผ่าน extension ต้องแปลงด้วย `aggToNumber` ทุกจุด (ทำครบแล้ว: analytics/billing/cost/order.stats) · ตาข่าย wire `src/lib/superjson.ts` (Decimal หลุดมา → ส่งเป็น number)
  - **services ใหม่ `src/server/services/`** (ตามกติกา business logic แกน): `money.ts` (D/round2/moneyInput/aggToNumber) · `pricing.ts` (priceOrderItems + computeOrderTotals + computeQuotationTotals — Decimal ภายใน ปัด 2 ตำแหน่ง half-up + กัน discount ติดลบ/เกินยอด) · `document-number.ts` (DocumentSequence) · `order-status.ts` (transitionOrder + processDesignApproval)
  - **platformFee สูตร A ทุกที่**: ไม่บวกเข้า totalAmount/ฐาน VAT (= เงินที่ marketplace หักจากยอดโอน เก็บบน Order เป็นข้อมูล) — แก้ updateItems/updateFees ที่เคยบวก (บั๊กยอดแกว่ง) + UI หน้า new/edit dialog ใช้ `calculateOrderSummary` (lib/pricing.ts — ต้อง mirror สูตร server เสมอ)
  - **เลขเอกสารรันต่อเนื่อง**: model `DocumentSequence` (ต่อชนิด/เดือน YYMM เวลาไทย) upsert atomic ใน transaction เดียวกับเอกสารเสมอ — ครบ ORDER/QUOTATION/INVOICE ทุกชนิด · พิสูจน์กับ DB จริง: เลขต่อเนื่อง + rollback คืนเลขไม่เกิดรู
  - **billing เป็น $transaction + SELECT FOR UPDATE** ทั้ง recordPayment/voidInvoice/recordRefund · เทียบยอดด้วย Decimal เป๊ะ (เลิก epsilon 0.01) · อุดบั๊ก: void ซ้ำได้ / refund หลัง void ปลุกสถานะ+หัก totalSpent ซ้ำ (จ่าย→void→refund เคยทำ totalSpent ติดลบเต็มยอดบิล) / บิล total ติดลบ
  - **status ผ่าน `transitionOrder` จุดเดียว** (validate isValidTransition + กัน race + revision): order.updateStatus, production.create (auto-hop ผ่าน PRODUCTION_QUEUE เมื่อ UI กดจาก CONFIRMED/DESIGN_APPROVED), design.upload/approve/approveByToken (อยู่ใน tx เดียวกับผลตัดสินแล้ว) · machine เพิ่ม 2 ทาง: DESIGNING→DESIGN_APPROVED (ลูกค้าอนุมัติผ่าน token) + CONFIRMED→PRODUCTION_QUEUE สำหรับ CUSTOM (ลูกค้ามีไฟล์มาเอง ข้ามออกแบบ)
  - **guard เงินหลังจบงาน**: order.update แตะ discount/platformFee/taxRate ไม่ได้เมื่อ COMPLETED/CANCELLED (field อื่นยังได้) · updateFees โดนบล็อกทั้งก้อน · order.update แก้บั๊ก recalc ใช้ discount เก่า · quotation.update recompute ยอดเมื่อ discount/tax เปลี่ยน · convertToOrder map ภาษีใบเสนอราคา (บาท→อนุมาน taxRate) ภาษีไม่หายตอนแก้ออเดอร์ทีหลัง
  - **verify จริงครบ**: `scripts/verify-p02.ts` ผ่าน 35/35 กับ DB จริง (สูตร A, เลขต่อเนื่อง, จ่าย/จ่ายเกิน/void/refund/หักซ้ำ, guards, design flow, aggregate เป็น number) + HTTP smoke (เด้ง /login + API 401) + tsc ผ่านทั้ง repo · adversarial review 5 มิติ (14 agents) — confirmed findings แก้ครบ
- 2026-06-10 — **P0.1 Auth จริง + RBAC ทั้งระบบ** (รายละเอียดดู git log d39e451/871b4f1) — verify จริงผ่าน HTTP ทุกเคส
- 2026-06-10 — แผน P0-P4 + ใบงาน (`ROADMAP.md`) · ติดป้าย supersede ใน vision doc · retrofit repo

## ติดอยู่ / รอตัดสิน
- (ว่าง)

## ข้อเท็จจริงที่ session ใหม่ต้องรู้
- **บัญชี OWNER ของเบส**: hongtaeswatht@gmail.com — เปลี่ยนรหัสที่ Settings → Users → รีเซ็ตรหัส · bootstrap OWNER ใหม่: `node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]`
- **DB ถูก push schema P0.2 แล้ว** (Decimal + DocumentSequence + TaxLineType) — P0.3 ให้ baseline migration จาก DB ปัจจุบัน (`prisma migrate diff`) **ห้ามคิดว่า DB ยังสถานะเก่า** · ข้อมูลใน DB: orders เก่า 4 ใบ (2602×3, 2603×1) + บิล PAID 1 + variants 760 แถวจาก stock sync + **ข้อมูลทดสอบ [P0.2-VERIFY] จาก verify script** (ลูกค้า 1 + orders 4 + quotations 2) — ล้างทั้งหมดตอน P0.3 พร้อมแก้ seed
- **กติกาเงินหลัง P0.2**: mutation ที่แตะยอดเงิน ต้องผ่าน `src/server/services/pricing.ts` เท่านั้น · สูตร client preview (`lib/pricing.ts calculateOrderSummary`) ต้อง mirror server เสมอ · field เงินที่อ่านจาก Prisma เป็น number แล้ว (extension) **ยกเว้น aggregate/_sum ต้อง `aggToNumber`** · status เปลี่ยนผ่าน `transitionOrder` เท่านั้น · เลขเอกสารผ่าน `nextDocumentNumber(tx, type)` ใน transaction เดียวกับเอกสารเสมอ
- **ข้อจำกัดที่รู้แล้ว + แผนรองรับ**:
  - ถ้าเก็บข้อมูลเก่าไว้เกิน P0.3: ต้อง seed `document_sequences.lastNumber = MAX(เลขเดิม)` ต่อ (docType, เดือน) — retry แก้เลขชนในเดือนเดียวกันไม่ได้ (rollback คืนเลข — พิสูจน์แล้ว) · ตอนนี้เดือน 2606 ไม่มีเลขเก่า ไม่มีทางชน
  - item เก่าของ READY_MADE ได้ taxLineType=HIRE_OF_WORK จาก default (ควรเป็น GOODS) — หายไปเองถ้าล้าง P0.3
  - billing.create ยังไม่ validate ยอดบิลรวมเกินยอดออเดอร์ (pre-existing) — เข้าใบงาน P1 (มัดจำ/ใบวางบิล) อย่าแก้เงียบ
  - platformFee → ต้นทุน/margin อัตโนมัติ (CostEntry PLATFORM_FEE) จงใจยังไม่ทำ — รอ P2 job costing ตามโซ่ต้นทุน กติกา build ข้อ 4
  - review 2 มิติ (pricing-formula ละเอียด, decimal-boundary ละเอียด) ตายเพราะ session limit — ครอบคลุมโดยมิติอื่น+empirical test แล้วเป็นส่วนใหญ่ ถ้าอยากเก็บตกให้รันใหม่หลังโควต้ารีเซ็ต
- **review findings ที่จงใจเลื่อน** (มีใบงานรองรับ — อย่าทำซ้ำ): attachment.create ไม่ validate entityType/entityId → P0.5 · outsource/stock-sync ยังไม่ scope ตาม assignment → P2 · sidebar โชว์เมนูทุก role → P1.0 · quotation.convertToOrder TOCTOU แคบ (double-click) → optional
- seed.ts ยังพังกับ schema ปัจจุบัน (ของเดิมตั้งแต่ก่อน P0.2 — ไม่ได้พังเพิ่ม) → แก้ตอน P0.3
