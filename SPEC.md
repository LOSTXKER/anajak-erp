# Anajak ERP — SPEC (อะไรคือ "เสร็จ")
> เกณฑ์ที่ต้องเป็นจริงถึงเรียกว่าเสร็จ · AI verify ทุกข้อก่อนเคลม done ด้วยรัน/เปิดดูจริง (type check ผ่าน ≠ ใช้งานได้) · เปลี่ยน spec = แก้ที่นี่ก่อนเขียนโค้ด
> สถานะ `[x]` = audit โค้ดจริง 2026-06-19 ยืนยันผ่าน (มี file:line อ้างอิง) · `[ ]` = ยังไม่ verify / gate ที่ต้องปิดก่อน deploy · งานต่อ trace กลับ `ROADMAP.md`

## เป้าหมาย
ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak — ให้ทีม 5 คน+เจ้าของ จัดการ ขาย→ผลิต→outsource→ส่ง→ออกบิล/ภาษี ของลูกค้า B2B (เครดิตเทอม) ครบวงจร ออกเอกสารภาษีเต็มรูปเอง + เชื่อม Anajak Stock · **ห้าม deploy/ใช้จริงจนจบ P0** (ROADMAP.md:18)

## 🔐 P0 deploy-gate — ต้องผ่าน 5 ข้อก่อนใช้จริง (ROADMAP.md:54 · plan.md:116)
- [ ] **คนนอกเปิดเว็บแล้วเข้าไม่ได้** — มี `src/middleware.ts` กั้น route + layout เช็ค session ⚠️ _survey 06-10 ว่ายังไม่มี middleware → ตรวจปัจจุบัน_
- [ ] **ทีม 6 คน login จริงได้ตาม role** — Supabase `signInWithPassword`/`signOut` จริง (login page เคยเป็น TODO redirect · logout เคยเป็นปุ่มหลอก · survey 06-10) ⚠️ ตรวจปัจจุบัน
- [ ] **auth context ถูก** — `src/server/trpc.ts` lookup user ด้วย `supabaseId` (ไม่ใช่ `id`) + **ตัด dev-OWNER fallback ทิ้ง** (ไม่มี session = UNAUTHORIZED) ⚠️ survey 06-10 ว่า fallback ทำให้ทุก request เป็น OWNER → ตรวจ `trpc.ts` ปัจจุบัน **(gate อันตรายสุด)**
- [ ] **`requireRole` ครบทุก mutation ที่ควรจำกัด** (survey 06-10 ว่ามีแค่ ~6/90) ตามตาราง role `Anajak-Print-Features.md §7`
- [x] **ยอดเงินทดสอบตรงทุกเส้นทาง** — invariant การเงินผ่าน (ดู §💰) · ⚠️ เหลือ verify บั๊ก `platformFee` create(order.ts:394)↔update(:728,:793)↔UI ใช้สูตรเดียวกันไหม
- [ ] **มี migration history** — เริ่ม `prisma migrate` + baseline (เลิก `db push` · survey 06-10 ว่า migrations ว่าง) · index hot paths (Order.customerId/internalStatus/createdAt · Invoice.paymentStatus)
- [ ] **`prisma/seed.ts` รันผ่าน** — แก้ให้ตรง schema ปัจจุบัน (survey 06-10 ว่าพัง: Notification.channel/body/sentAt, OrderItem fields ย้าย) + แยก master data (ServiceCatalog 26) ออกจาก demo
- [ ] **test แกนก่อน refactor** — vitest ครอบ pricing(+platformFee)/status transition/เลขเอกสาร/payment-void-refund (เกราะของทุก refactor)

## 💰 ความถูกต้องข้อมูล (invariant — verified audit 2026-06-19 ผ่านทั้ง 5)
- [x] **เงิน = Decimal(12,2) ทุก field เงิน ไม่มี Float** — Order/Invoice/Payment/WhtCertificate/OrderItem* ประกาศ `@db.Decimal(12,2)` · คำนวณผ่าน `Prisma.Decimal` (`money.ts` round2 half-up) · Decimal→number ที่ขอบเดียว (`lib/prisma.ts:16-82`) · Float ที่เหลือเป็น non-money มี comment กำกับ (profitMargin %, quantity, width/height) · ⚠️ sharp-edge: aggregate `_sum` ต้องเรียก `aggToNumber` เอง (money.ts:23)
- [x] **เลขเอกสารรันต่อเนื่อง ไม่สุ่ม** — `nextDocumentNumber()` (`document-number.ts:46-55`) upsert+increment บน `DocumentSequence` (unique [docType,period]) ใน `$transaction` เดียวกับ create · ทุกชนิด (ORD/INV-D/INV-F/REC/CN/DN/QT/BN/FR) · ⚠️ ถ้า import เอกสารเก่าต้อง seed lastNumber ก่อน
- [x] **status เปลี่ยนผ่าน `isValidTransition` ที่ server เท่านั้น** — `transitionOrder()` (`order-status.ts:38-92`) จุดเดียว: บังคับ valid + optimistic-lock กัน race + บันทึก `OrderRevision` · direct write `internalStatus` มีแค่ตอน create (documented) · ⚠️ ตรวจ `production.create`/`design.upload` ว่าไม่เขียน status ข้าม transition (P0.2)
- [x] **การเงินหลายขั้น = `$transaction` + row-lock** — billing create/recordPayment/voidInvoice/recordRefund ห่อ tx + `SELECT FOR UPDATE` (lockInvoiceRow/lockOrderRow) กันทะลุเพดานวางบิล/บันทึกซ้ำ (`billing.ts`)
- [x] **ใบกำกับ/ใบวางบิล ยกเลิก-ออกใหม่ ห้ามลบ** — ไม่มี `invoice.delete`/`billingNote.delete` ในโค้ด · ยกเลิก = soft-void (`isVoided`+`voidedReason`+`VOIDED`) + guard กัน void ซ้ำ + totalSpent หัก/คืนสมมาตร (`billing.ts:341-432`)

## 📋 Flow หลัก — เกณฑ์เสร็จต่อ flow (verified E2E audit 2026-06-19 · service+router+UI ครบ)
- [x] **สร้างออเดอร์** /orders/new → เลข `ORD-YYMM-NNNN` รัน + AuditLog (`order.ts:393-672`)
- [x] **ออเดอร์ CUSTOM 3 แหล่งเสื้อ** (FROM_STOCK/CUSTOM_MADE/CUSTOMER_PROVIDED) → ใบผลิตเสนอ step อัตโนมัติตามแหล่ง+printType (`production-steps.ts:221-252` + unit test)
- [x] **ยืนยันออเดอร์ READY_MADE/มีสต็อก** → จองสต๊อก Anajak Stock อัตโนมัติ + ด่านวงเงินเครดิต `assertSalesWithinCreditLimit` · จองพลาด → กระดิ่ง+retry (`stock-reservation.ts`)
- [x] **ใบเสนอราคา → แปลงเป็นออเดอร์** (กันซ้ำ) ผ่านลิงก์ public `/quote/<token>` accept→convert + ด่าน ACCEPTED/ไม่หมดอายุ (`quotation.ts:341-440`)
- [x] **customer portal (ไม่ต้อง login · token):** อนุมัติแบบ `/approve/design/<token>` · ติดตามสถานะ `/status/<token>` (read-only, ไม่รั่วราคา/ต้นทุน/internalStatus · `customer-status.ts:40-193`) · อัปโหลดไฟล์ `/upload/<token>` (signed, server เลือก path) ⚠️ P0.1: เพิ่ม token expiry + กันตัดสินซ้ำฝั่ง server
- [x] **outsource** ผูกขั้นผลิต → OutsourceOrder + step IN_PROGRESS (ล็อกแถว) → SENT→RECEIVED_BACK→QC (`outsource.ts:131-244`)
- [x] **ผลิต→QC→แพ็ค→ส่ง** → ออเดอร์เด้ง "จัดส่งแล้ว" เมื่อทุกใบส่งครบ+จำนวนครบ (แบ่งกล่องได้) · RETURNED → กระดิ่ง (`production.ts`/`qc.ts`/`delivery.ts`)
- [x] **goods receipt + print run (ฟิล์ม FR-) + คลังฟิล์ม** (`goods-receipt.ts`/`print-run.ts`/`film-stock.ts`) ⚠️ verify กันฟิล์มติดลบ (FilmStock.qty Int "ห้ามติดลบ")
- [x] **ออกบิล→ชำระ→WHT 50ทวิ อัตโนมัติ** เลขรัน + เพดานยอด (ใบแจ้งหนี้รวม ≤ ยอดออเดอร์) + นิติบุคคลหัก 3% สร้าง WhtCertificate (`billing.ts:86-339`)
- [x] **พิมพ์เอกสารภาษีจริง** ใบกำกับ ม.86/4 (ต้นฉบับ+สำเนา · void มีลายน้ำ) + quotation/billing-note/job-ticket/packing-list (`(print)/print/*`)
- [x] **วางบิลรวม + ลูกหนี้ aging + dunning** cron mark OVERDUE รายวัน (fail-closed CRON_SECRET · `billing-note.ts`/`overdue.ts`/`dunning.ts` + test)
- [x] **เชื่อม Anajak Stock + MCP** stockSync (test/sync/issue/receive) + `/api/mcp/[transport]` + cron ปลดจองค้าง ⚠️ ต้องตั้ง env เชื่อม Stock จริงถึง sync ได้

## 🚫 นอกขอบเขต (จงใจไม่ทำในรอบนี้ — กัน scope creep · ROADMAP.md:92-93 + plan.md)
- **GL/บัญชีแยกประเภท/งบการเงิน** — นักบัญชี+FlowAccount/PEAK ทำ · ERP ออกแค่เอกสารขาย/ใบกำกับ/50ทวิ + export CSV/Excel
- **job costing/ต้นทุนต่อออเดอร์** — เบสเคาะ 06-12: ต้นทุนเหมา คิดกำไรขาดทุนรายเดือนในระบบบัญชี · **ห้ามเพิ่มช่องเงิน/ต้นทุนใน flow ผลิต-outsource**
- **DTF auto-nesting** (RIP ทำ) · **online designer** (ลูกค้าคาดหวังดีไซเนอร์ช่วย) · **time-clock/payroll** (hr-platform-v2) · **WMS เต็ม/PR-PO-GRN** (Anajak Stock · ERP เชื่อมผ่าน /api/erp/*)
- **in-app chat** (LINE) · **ใบกำกับอย่างย่อ** (B2B เคลม VAT ไม่ได้) · mockup generator · CMMS · courier API booking · รายงาน ม.87(3) (อยู่ Anajak Stock)

## หมายเหตุขอบเขต (กันสับสน P0 vs P1+)
- **ภาษีเต็มรูป + WHT 2 ขา:** ขารับอยู่ P1 · ขาจ่าย outsource 3%+ภงด.53 อยู่ P2 (`ROADMAP.md:60,75,84`) · P0 ทำแค่ **tax-point rule ลง design + เผื่อ schema ตอนแตะ Decimal**
- **WHT ขาจ่าย/AP vendor** — เบสสั่ง "ทบทวนขอบเขตกับเบสก่อนเริ่ม" (plan.md:22) ไม่ใช่ทำเงียบ
- **Open decision:** ERP ออกใบกำกับเอง แต่ต้องให้นักบัญชีรีวิว template + เลขรันก่อนใช้กับลูกค้าจริง (plan.md:110)
