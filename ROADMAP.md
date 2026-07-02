# Anajak ERP — Roadmap & ใบงาน build

> สร้าง 2026-06-10 โดย Nami (bestos) · แผนเต็ม+ที่มา: ใน repo bestos (sibling) → `records/projects/anajak-erp/` (plan.md + _survey-2026-06-10.md) · path เต็มต่างตามเครื่อง (Win `D:/dev/ai-agent2` · Mac `~/dev/Git/bestos`) — อย่า hardcode
> เบสเคาะแล้ว: ซ่อมต่อบนโครงเดิม · DB ว่างรื้อ schema ได้อิสระ · ผู้ใช้ = พนักงาน 5 คน + เบส + ลูกค้า · ภาษีเต็มรูป (ERP ออกใบกำกับเอง) + หัก ณ ที่จ่าย 2 ขา · เว็บ 5 นาที = ทีหลัง

## กติกา build (ผูกทุก phase — ห้ามข้าม)
1. เพดานจริง ~1-2 โมดูลเล็ก/เดือน — อย่ารับปากเกิน · ทุกไตรมาส prune backlog ที่ยังไม่เริ่มทิ้งครึ่ง
2. เปิด "gate บังคับ" ทีละตัว (รูปก่อนส่ง → ค่อยเพิ่มตัวถัดไป) — เปิดพร้อมกันพนักงาน bypass ข้อมูลกลายเป็นขยะ
3. manual field/CSV ก่อน API เสมอ (courier/บัญชี/stock-link)
4. ~~โซ่ต้นทุนห้ามสลับ: film log + outsource AP → job costing → ค่อย margin guard~~ **ยกเลิกทั้งโซ่ (เบสเคาะ 2026-06-12): ไม่คิดต้นทุนต่องานในระบบนี้** — ต้นทุนเหมา (หมึก 1 ขวดพิมพ์ได้หลายตัว) เบสคิดกำไรขาดทุนรายเดือนในระบบบัญชี · ห้ามเพิ่มช่องเงิน/ต้นทุนใน flow ผลิต-outsource อีก
5. **ไม่ build บัญชีแยกประเภท (GL)** — ERP ออกเอกสารขาย/ใบกำกับ/50ทวิ + export มาตรฐาน (CSV/Excel) ให้นักบัญชี · ยังไม่ผูก FlowAccount/PEAK (เบสเคาะ: ทำมาตรฐานก่อน)
6. surgical: แตะเฉพาะที่ใบงานสั่ง · โครงเดิมดี (order module/status machine/token approval) — ต่อยอด อย่ารื้อ
7. **refactor = targeted ไม่ big-bang** — ห้ามรื้อทั้ง codebase รอบเดียว (ไม่มี test คุ้มกัน) · ลำดับ: test แกนก่อน → refactor เฉพาะส่วนที่กำลังแตะ → boy-scout rule (แตะไฟล์ไหน เก็บกวาดไฟล์นั้น)
8. **UI ใหม่ผ่าน design system ไม่ใช่ไล่ทาสีทีละหน้า** — วางมาตรฐานกลางครั้งเดียว (P1.0) ทุกหน้าที่แตะหลังจากนั้นขึ้นมาตรฐานใหม่ทันที · ห้าม redesign หน้าที่ยังไม่มีงาน functional ไปแตะ (จะได้ไม่ทำซ้ำตอน P2-P3 เปลี่ยนหน้านั้นอยู่ดี)

---

## 🚦 แผนแนวทางใหม่ 2026-07-02 — เส้นทางสู่ go-live (จาก audit ใหญ่ 47 agents · adversarial verify 26/28 CONFIRMED)
> **ที่มา**: เบสสั่ง audit ว่า "ดีพอตามมาตรฐาน ERP โรงงานสกรีนหรือยัง" → รายงานเต็ม: bestos `records/projects/anajak-erp/audit-2026-07-02.md` (+ detail 10 ไฟล์ใน `_audit-2026-07-02/`)
> **คำตอบ**: ครึ่ง ops ดีพอ-เกินมาตรฐาน SaaS (74-85/100) · ครึ่งเงิน+ภาษียังไม่พร้อมใช้จริง (55-70) · โครงพื้นฐาน production (CI/backup/monitoring/rate-limit) = 0
> **ลำดับนี้ทับลำดับ P1-P4 เดิมชั่วคราวจนถึง go-live** · ทุกข้อ verify แล้วมี file:line ในรายงาน · ⚠️ 5 คำถามท้ายรายงานต้องให้เบสเคาะก่อนแตะข้อที่เกี่ยว

### Gate A — เงินห้ามผิด ✅ จบทั้งก้อน 2026-07-02 (+ adversarial review 16 findings แก้ครบ)
- [x] A1 `billing.recordPayment` จำกัดชนิดใบ — CN ห้ามรับเงิน · **REC รับได้เฉพาะขายสดตรง** (ออเดอร์ไม่มีใบเรียกเก็บ — review จับว่า block ทื่อๆ จะฆ่า flow ขายสด) + ซ่อนปุ่ม UI ตรงเงื่อนไข + REC/CN ไม่เก็บ dueDate + overdue sweep กรองเฉพาะใบเรียกเก็บ (กัน OVERDUE ปลอม)
- [x] A2 gate ต้นทุน/กำไรตาม role — `order.getById` ตัด costEntries/totalCost/profitMargin (FINANCE เท่านั้น) + payments (FINANCE+SALES) + **ทุน outsource/step ในใบผลิต** (review จับรั่วเพิ่ม) · `billing.listByOrder` gate role + การ์ดบิลซ่อนจากช่าง/กราฟิก · ปุ่มรับเงิน/void ตรง moneyRecorder · นิยาม role กลาง `lib/roles.ts`
- [x] A3 state machine ใบเสนอ — `lib/quotation-status.ts` (+test) · update/updateItems ล็อกแก้เฉพาะร่าง (conditional write + FOR UPDATE กัน race) · updateStatus validate transition + expectedStatus (กันจอค้างทับการยืนยันลูกค้า) + ดึงกลับร่างล้าง sentAt/acceptedAt + กันส่งใบหมดอายุ · ปุ่ม "ดึงกลับเป็นร่าง" (SENT/ACCEPTED มี confirm/REJECTED/EXPIRED — ปิด quick win #1 + ทางตัน ACCEPTED)
- [x] A4 ต้นทุนเข้า `$transaction` — service กลาง `services/order-cost.ts` (lock+recalc) ใช้ทั้ง cost router + **production step + outsource QC** (review จับ: 2 จุดหลังเขียน costEntry แต่ไม่เคย recalc → totalCost drift)

### Gate B — ก่อนใช้จริง (go-live gate · เรียงตามเจ็บ)
- [x] B1 **ใบลดหนี้/เพิ่มหนี้ครบองค์กฎหมาย** ✅ 2026-07-02 (+review 21 findings แก้ครบ): schema originalInvoiceId+adjustmentReason (migration `20260702150000` **⏳ เบสยัง apply ไม่ได้ — DB ต่อไม่ถึงจากเครื่อง**) · CN หักยอดค้างจริงทุกจุด (aging/ใบวางบิล/ทวง/MCP/เพดานรับเงิน/refund) · สถานะใบเดิมขยับเอง (ออก/void CN · คง OVERDUE · paidAt สมมาตร) · ใบพิมพ์ครบ ม.86/10 เป็น "มูลค่า" ฐานภาษี + หัก CN/DN ก่อนหน้า · CN สองความหมาย: อ้างใบเรียกเก็บ=ลดยอดค้าง · อ้างใบเสร็จ=คู่คืนเงิน (เพดานใบเสร็จรู้ linkage — ไม่ block ใบกำกับงวดถัดไป)
- [x] B2 **VAT default 7%** ✅ 2026-07-02 — ออเดอร์ default 7 (ฟอร์ม+server) · ช่องทาง marketplace ราคารวม VAT สลับ default เป็น 0 อัตโนมัติ (ไม่ทับค่าที่พิมพ์เอง) · ฟอร์มใบเสนอมีปุ่มลัด "VAT 7%"
- [ ] B3 **tax point จ้างทำของ**: nudge/auto-draft ใบเสร็จ+ใบกำกับหลัง recordPayment ทุกงวด + field `issueDate` (ม.78/1(1) — ผูก Payment↔REC ปิดเรื่องบันทึกซ้ำถาวร)
- [ ] B4 ปิดทาง bypass QC: ปุ่ม "ผ่าน→แพ็ค" ต้องมี QcRecord ก่อน (server guard ที่ order.updateStatus QUALITY_CHECK→PACKING · production/page.tsx:74,526-537) + ปุ่ม "รับของกลับ" บอร์ดเลนบังคับใบตรวจนับแบบเดียวกับหน้า /outsource
- [ ] B5 **รายงานภาษีขายรายเดือน export CSV** (เลขที่/วันที่/ผู้ซื้อ+เลขภาษี+สาขา/ฐาน/VAT รวม CN-DN + ธง void) ✅ เบสเคาะ: นักบัญชีใช้ **PEAK + ระบบเขียนเอง** → ทำ 2 format: CSV ตรง template import PEAK + CSV มาตรฐาน
- [ ] B6 **นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน** ก่อนออกใบจริง (open decision ค้าง — พิมพ์ตัวอย่างจริงให้ดู)
- [ ] B7 CRM ใช้ได้จริง: ฟอร์มแก้ลูกค้า (ต่อ `customer.update` ที่มีแล้ว) + ปุ่มบันทึกการคุย (`addCommunicationLog`) + pagination /customers (เกิน 50 รายมองไม่เห็น)
- [ ] B8 หน้า /settings หลัก: ถอดฟอร์มปลอม 4 section ทิ้ง (ปุ่มบันทึกโกหก — BLOCKER ความเชื่อใจ) · ตั้งค่าที่จำเป็นจริงค่อยทำเป็นชิ้นๆ (% มัดจำ/เพดานส่วนลด/ฟรีแก้แบบ)
- [ ] B9 เพดานสองขา: update/updateItems/updateFees เตือน/กันลดยอดต่ำกว่าบิลที่ออกแล้ว (หนี้เก่าข้อ 2)
- [ ] B10 ถอด ON_HOLD จาก EDITABLE_STATUSES (แก้ผ่านใบแก้ไข/CO ตามกติกาเดิม · order-status.ts:278-284)
- [ ] B11 `issueMaterials` ห่อ atomic + endpoint list MaterialUsage + `product.delete` → soft-delete (ประวัติเบิกหายถาวร · stock-sync.ts:104-160, product.ts:166-177)
- [ ] B12 sidebar/ปุ่มกรอง role ทั้งระบบ (เมนูเงินไม่โชว์ช่าง — server ปลอดภัยแล้ว เหลือ UI) + หน้า print เอกสารเงิน gate role
- [ ] B13 delivery: เขียน trackingNumber ทุกสถานะ (ตอนนี้หายเงียบถ้ากรอกตอน PREPARING · delivery.ts:271-273) + state machine ใบส่ง (เลียน outsource)
- [ ] B14 ใบส่งของร้านนอกแบบ **LINE-friendly** (✅ เบสเคาะ: คุยกับร้านผ่าน LINE) — หน้าสรุปใบ outsource แชร์เป็นรูป/ลิงก์เข้า LINE ได้ (จำนวน×ไซซ์/ลาย/กำหนดรับ) + ช่องแนบไฟล์ลายบนใบ outsource · ไม่ต้อง build ใบพิมพ์กระดาษเต็มรูป
- [ ] B15 **โครงพื้นฐาน production**: CI ขั้นต่ำ (lint+tsc+vitest) · ลบ lockfile ซ้ำ (pnpm-lock vs package-lock) · rate-limit public token endpoints 9 ตัว + security headers (next.config ว่าง) · Supabase audit จริง (bucket private/RLS/PITR+backup — เอกสารภาษีต้องอยู่ครบ 5 ปี) · env validate ตอน boot
- [ ] B16 **walkthrough ของจริงกับทีม + พิมพ์เอกสารเงินให้นักบัญชีดู** (audit รอบนี้รีวิวจากโค้ด ไม่ได้เปิดจอจริง — UX คะแนนถือเป็นสมมติฐานจนกว่าจะลองจริง)

### Gate C — หลังใช้จริง ~1 เดือน (calibrate จากข้อมูลจริงก่อน build)
- [ ] C1 pricing engine ใบเสนอ (qty break × เทคนิค × ตำแหน่ง + ราคาต่อลูกค้า — ระหว่างรอ: mount useMarginEstimate ในฟอร์มใบเสนอ = quick win)
- [ ] C2 stale sweep (ใบเสนอ SENT/แบบรอลูกค้า/INQUIRY/outsource เลยกำหนด ค้างเกิน N วัน → กระดิ่ง — โครง cron+notification พร้อมแล้ว)
- [ ] C3 global search ⌘K ค้นข้อมูลจริง (order.list มี search ฝั่ง server แล้ว เหลือต่อท่อ palette)
- [ ] C4 Owner Pulse drill-down (/orders รับ URL param filter) + คอลัมน์กำหนดส่ง/sort deadline ใน orders list + mobile card
- [ ] C5 UX ops: หน้าใบผลิตโชว์ภาพลาย+ตารางไซซ์ (ช่างไม่ต้องเปิด order detail) · ปิดขั้นตอน 1-2 แตะ (เลิก dialog 5 แตะ) · จอ print-runs ลิงก์ไฟล์ลาย
- [ ] C6 LINE OA notify (P3 เดิม — ระหว่างนี้ template ก๊อปส่ง + ถอดช่อง LINE token ปลอมออกจาก settings)

### Quick wins คั่นระหว่าง Gate (ต่อปุ่มให้ backend ที่มีอยู่ — ชิ้นละ ≤ ครึ่งวัน)
ปุ่ม "ดึงกลับเป็นร่าง" ใบเสนอ SENT · ปุ่มร่างทวงหนี้บนหน้า aging (dunning มีแล้วแต่เรียกได้ทาง MCP เท่านั้น) · ปุ่ม UI recordRefund · ตารางบิลกดได้+filter+pagination (router รองรับหมดแล้ว) · แก้เลข "ค้างชำระ" /billing ให้สูตรเดียวกับ aging · เมนู "งานออกแบบ" เลิกชี้หน้า stub · จับ isError 17 หน้าที่เงียบ (ขัด DESIGN.md เอง)

### Refactor targeted (ทำตอนแตะไฟล์นั้นตามกติกา 7 — ห้าม big-bang)
ย้าย logic เงินจาก router ลง services + test: recordPayment/void (เงินก้อนใหญ่สุดไม่มี unit test) · ด่านปิดงานวางบิลครบ (order.ts:801-818) · convertToOrder (193 บรรทัด) · production.updateStep (208 บรรทัด) — รวมของซ้ำ: INVOICE_TYPE_LABELS (6 ไฟล์ป้ายไม่ตรง) · FINANCE_ROLES (~20 จุด/5 ไฟล์) · ลบ dead export สูตรเงินเก่าไม่มี VAT (lib/pricing.ts:119-141) — schema: index FK ~20 ตัว (ทำพร้อม migration ถัดไป) · test กลุ่ม stock/ผลิต (garment-pick/goods-receipt/qc/print-run = 0 test ทั้งกลุ่ม)

---

## 🔴 P0 — ฐานราก (ทำก่อนทุกอย่าง · ห้าม deploy/ใช้จริงจนจบ P0)

### P0.1 Auth จริง + RBAC
- [ ] แก้ `src/server/trpc.ts:26-28` — lookup user ด้วย `supabaseId` (ตอนนี้ใช้ `id` = ไม่มีวัน match)
- [ ] **ตัด dev-OWNER fallback ทิ้งทั้งหมด** (`getDevUserId`, fallback ใน `createContext`/`isAuthed`/`requireRole` — trpc.ts:13-20,38-39,53,58,68,75) → ไม่มี session = UNAUTHORIZED
- [ ] login จริง (`src/app/(auth)/login/page.tsx` ตอนนี้เป็น TODO redirect) — Supabase signInWithPassword + signOut (user-menu logout ตอนนี้เป็นปุ่มหลอก)
- [ ] สร้าง `src/middleware.ts` กัน route (dashboard)/(portal) + เช็ค session ใน layout
- [ ] หน้า invite/จัดการ user (6 คน) ผูก supabaseId ↔ User + Role
- [ ] ไล่ `requireRole` ให้ครบทุก mutation (ตอนนี้มีแค่ ~6/90 procedures) ตามตาราง role ใน `Anajak-Print-Features.md` §7
- [ ] public procedures (design.getByToken/approveByToken) — เพิ่ม token expiry + กันตัดสินซ้ำฝั่ง server

### P0.2 เงินถูกต้อง
- [ ] Float → `Decimal` ทุก field เงินใน `prisma/schema.prisma` (54 จุด) + ปรับโค้ดคำนวณ (DB ว่าง — push ใหม่ได้เลย)
- [ ] แก้บั๊ก platformFee: `src/server/routers/order.ts:394` (create ไม่รวม) vs `:728,:793` (update รวม) vs UI `orders/new/page.tsx:196` — เลือกสูตรเดียว ใช้ทุกที่
- [ ] `billing.recordPayment` (billing.ts:118-179) — รวม 4 writes เป็น `$transaction` เดียว (รวม voidInvoice/recordRefund ด้วย)
- [ ] **เลขเอกสารรันต่อเนื่อง** — สร้าง model `DocumentSequence` (ต่อชนิดเอกสาร/เดือน, กันชนใน transaction) แทนสุ่ม 4 หลักใน `src/lib/utils.ts:39-87` — บังคับตามกฎหมายใบกำกับภาษี
- [ ] enforce status transition ที่ชั้น server กลาง — ปิดทาง `production.create` (production.ts:51-54) และ `design.upload/processDesignApproval` เขียน internalStatus ตรงข้าม `isValidTransition`
- [ ] status guard ของ `order.updateFees`/`order.update` (ตอนนี้แก้เงินได้แม้ COMPLETED/CANCELLED)

### P0.3 วินัยฐานข้อมูล
- [ ] เริ่ม `prisma migrate` + baseline (ตอนนี้ migrations ว่าง ใช้ db push อย่างเดียว = ย้อนกลับไม่ได้)
- [ ] แก้ `prisma/seed.ts` ให้ตรง schema ปัจจุบัน (ตอนนี้พังจริง: Notification.channel/body/sentAt ไม่มีแล้ว · OrderItem fields ย้ายไป OrderItemProduct แล้ว) + แยก master data จริง (ServiceCatalog 26 รายการ) ออกจาก demo data
- [ ] ใส่ index ที่ hot paths: Order.customerId/internalStatus/createdAt, Invoice.paymentStatus, ProductionStep.assignedToId

### P0.4 ออกแบบเผื่ออนาคต (เบาๆ ไม่ over)
- [ ] tax-point rule ลง design: order line จำแนก ขายสินค้า/จ้างทำของ + ใบกำกับออก**ทุกงวดรับเงินรวมมัดจำ** (โครงรอ P1 build แต่ schema ต้องเผื่อตั้งแต่ตอนแตะ Decimal)
- [ ] แยก business logic แกน (pricing/status/เลขเอกสาร) เป็น function ใน `src/server/services/` ที่ tRPC เรียก — เผื่อ order-intake API + MCP (P4) เรียกซ้ำได้

### P0.5 จัดระเบียบโค้ด (เบสสั่งเพิ่ม 2026-06-10 — targeted refactor)
- [ ] **test แกนก่อน refactor** — vitest + test ครอบ: pricing ทุกเส้นทาง (รวม platformFee) · status transition · เลขเอกสาร · payment/void/refund (ตอนนี้ 0 tests — นี่คือเกราะของทุก refactor หลังจากนี้)
- [ ] ลบ dead code ที่ survey ชี้: `size-matrix.tsx` (กลับมาใช้จริงใน P1.12 — ถ้า rewrite ง่ายกว่าก็ลบ), `useOrderDraft` (hooks ไม่ถูกใช้), BrandProfile/rfmScore (คง schema แต่ mark รอ P3), `/quotations/[id]/edit` dead link, empty dirs `api/sync/*` + `products/new`, `(portal)` ว่าง (จะถูกใช้จริง P3)
- [ ] แก้ payment-method mismatch (`order-billing-section.tsx` ส่ง TRANSFER/PROMPTPAY แต่ labels ใช้ BANK_TRANSFER/QR_CODE) — รวม enum/labels ไว้ที่เดียว
- [ ] แตกไฟล์ยักษ์ที่กำลังจะแตะอยู่แล้ว: `orders/new/page.tsx` (875 บรรทัด) แยกเป็น component/hook ตามหน้าที่ — ทำตอน P1.12 แตะ multi-size อยู่แล้ว ไม่แตกล่วงหน้า
- [ ] ตั้ง lint/format ให้เข้ม + รันผ่านทั้ง repo (eslint config มีแล้ว — เพิ่ม rule กัน pattern ที่เจอ: silent catch, window.prompt/confirm)
- [ ] เอกสาร `docs/ARCHITECTURE.md` สั้นๆ: โครง router/service/lib ใครทำอะไร — กัน AI session ใหม่วางของผิดที่

**เกณฑ์จบ P0:** คนนอกเปิดเว็บแล้วเข้าไม่ได้ · ทีม 6 คน login จริงได้ตาม role · ยอดเงินทดสอบตรงทุกเส้นทาง (รวม platformFee) · มี migration history · seed รันผ่าน

---

## P1 — เอกสาร + การเงินไทย + งานรายวัน (สรุป — รายละเอียด: plan.md ใน bestos)
**P1.0 Design System + UI มาตรฐานใหม่ (เบสสั่ง 2026-06-10 — ทำเป็นงานแรกของ P1):** design tokens (สี/ฟอนต์/spacing/radius — ฐาน Tailwind 4 + shadcn ที่มีอยู่) · component มาตรฐาน (table/form/dialog/status badge/empty state) · เลิก `window.prompt/confirm` ทั้งระบบ → dialog จริง · **mobile-first สำหรับหน้า ops** (task queue/production — พนักงานใช้มือถือหน้างาน) · หน้าใหม่+หน้าที่แตะใน P1-P3 ใช้มาตรฐานนี้ทันที · ปิดท้าย P1 มีรอบเก็บตกหน้าเก่าที่เหลือ — เกณฑ์: ดูเป็นระบบเดียวกันทุกหน้า ใช้บนมือถือได้จริง ·
PDF ครบชุด (ใบเสนอ/แจ้งหนี้/เสร็จ+**ใบกำกับเต็มรูป ม.86/4** · ยกเลิก-ออกใหม่ห้ามลบ · ใบลดหนี้-เพิ่มหนี้) · **Job Ticket ใบสั่งงานหน้างาน+QR** · WHT ขารับ (ทะเบียน 50ทวิ + reconcile 97/3) · มัดจำตาม payment terms + overdue cron · **ใบวางบิล + ลูกหนี้ aging + เช็ค credit limit** · approval gate ส่วนลด/void · **ปฏิทินภาระงาน+เช็คทันไหม (เบา)** · **ราคาต่อลูกค้า + quote expiry + แก้ใบเสนอ** · **task queue "งานของฉันวันนี้"** · notification จริงจาก event · multi-size matrix · รายงานภาษีขาย export CSV/Excel
**เพิ่มเข้า P1 (เบสอนุมัติ 2026-06-11 จากผล audit flow ทั้งระบบ):** แพ็คเก็บตกหน้างาน — ขั้นตอนผลิต DTF/DTG จริง (เดิม enum เป็นชุดโรงเย็บ) + โชว์ลายอนุมัติบน order detail/Job Ticket + แจ้งกระดิ่งเมื่อลูกค้าตัดสินแบบ + ด่านปิดงานต้องวางบิลครบ · **Outsource UI ทั้งก้อนดึงจาก P2 มาทำเลย** (silkscreen ส่งร้านนอก 100% แต่ระบบใช้ไม่ได้จริง) — ส่วน AP vendor/WHT ขาจ่าย ยังอยู่ P2 ตามเดิม
## 🏭 FLOW-REDESIGN — รื้อทั้งระบบตามผังใหม่ (เบสเคาะครบ 2026-06-12 · แบบเต็ม: `docs/flow-redesign-2026-06-12.html`)
> เบสสั่ง: "มองมุมโรงงาน วาด flow ก่อน" → ศึกษา 5 มุม + ตอบคำถาม 10 ข้อ → เคาะครบ · **งานชุดนี้มาก่อน P1 ที่เหลือ** (WHT เลื่อนไปทำพร้อมก้อน 3 ขาเงิน)
> มติผูกพัน: outsource ส่งก่อนเสมอ · นับของ 2 จุด (ของเข้า/QC) · ห้ามเพิ่มงานกรอกหน้างาน · การสั่งซื้ออยู่ Stock ที่เดียว · ยอดจองโชว์ในแอป Stock · ต้นทุน = เรตตั้งครั้งเดียวคูณอัตโนมัติ (ไม่ใช่ตามจริงต่อชิ้น)

**ก้อน 1 — กระดูกสันหลัง: ด่านพร้อมผลิต + เตรียมของ + เชื่อมสต๊อคจริง (✅ จบทั้งก้อน 2026-06-12 — ทดสอบ flow จอง→เบิก→คืน ข้ามแอปจริงผ่านครบ ดู PROGRESS):**
- [x] **ฝั่ง Stock** (repo `../anajaktshirt-stock`): แก้ `POST /api/erp/movements` variant-aware + `$transaction` + กันติดลบ + `RETURN` + `orderRef` ราย line + idempotency key — service กลาง `erp-stock-service.ts` · SQL applied + verify 13/13 (2026-06-12)
- [x] **ฝั่ง Stock**: ตาราง `stock_reservations` + endpoint จอง-ปลดจอง + `GET /stock` คืน reservedQty/availableQty + โชว์ยอดจองหน้า /stock · products คืน `variant.lastCost` (2026-06-12)
- [x] **ฝั่ง ERP**: ยืนยันออเดอร์ FROM_STOCK → จองรายไซส์-สีอัตโนมัติ (ปลดจองตอนยกเลิก/ปิดงาน + จองใหม่ตอนแก้รายการ + ปุ่มจองใหม่) · ใบเบิก (ISSUE+orderRef ตัดยอดจอง) ผูกขั้น GARMENT_PICK · ใบคืนเศษ (RETURN) — เสื้อโรงเย็บ→PO/GRN ทำฝั่ง Stock ตามมติ (ERP มีใบตรวจรับรองรับขารับ · ปุ่มลัดจาก ERP = รอบเก็บตก)
- [x] **ฝั่ง ERP**: ด่านพร้อมผลิต (เงินตามเทอม ✓ + แบบอนุมัติ ✓ + ของครบ ✓) — คิว /production แยกกอง "ติดอะไร รอใคร" ช่างไม่เห็น · soft-gate หัวหน้าข้ามได้ (จงใจ)
- [x] **ฝั่ง ERP**: ใบตรวจรับของเข้า (นับจริงต่อไซส์ + รูป + ตำหนิ — mobile-first) เสื้อลูกค้า/เสื้อโรงเย็บ/รับกลับร้านนอก + ใบคืนของลูกค้า (กระทบยอดรับ-คืน) · ขาด/เกินกระดิ่งแอดมินทันที
- [x] **ฝั่ง ERP**: ProductionStep มี qtyDone/qtyTotal (บอก "บางส่วน" ได้) + ใบส่งร้านนอกแบ่งส่งหลายรอบ (ขั้นปิดเมื่อทุกใบตัดสิน+จำนวนครบ)

**ก้อน 2 — หน้าเครื่อง:** รอบพิมพ์ฟิล์ม (รวมหลายออเดอร์ กดเสร็จเป็นชุด) + จุดตัดแยกฟิล์ม + คลังฟิล์มพร้อมรีด (พิมพ์เผื่อ ติดป้ายลาย/ลูกค้า) + คิวรีด gate ฟิล์ม∧เสื้อ + จอเช้า 5 บทบาท + 5 ตัวเลขเจ้าของ + เรตต้นทุนกลาง (Settings ~5 ช่อง → กำไรขั้นต้นอัตโนมัติตอนตีราคา + เตือนเมื่อทุนซื้อเบี่ยง >10% — เบสเคาะ "เอาก็ได้ ถ้าทำได้จริงไม่งง" · การสั่งซื้ออยู่ Stock ที่เดียว ERP มีปุ่มลัด)
**ก้อน 3 — ขาออก + เงิน:** QC เชิงนับ (เสีย×ไซส์×ลาย×สาเหตุ×รูป) + เผื่อเสีย default 3% + แพ็คนับยืนยัน + รายการต่อกล่อง + blind ship + แบ่งส่ง + **WHT ขารับ 3% + ทะเบียน 50ทวิ** (ของเดิมใน P1) + UI แนบสลิปโอน (evidenceUrl มี API แล้ว)
**ก้อน 4 — ขอบลูกค้า (ภาค 2 `docs/flow-redesign-part2-2026-06-12.html`):** ไฟล์ 3 ชั้น (ดิบ/แบบอนุมัติ/ไฟล์พิมพ์ — ห้ามไฟล์ลอย) + ลิงก์อัปโหลดต่อออเดอร์ส่งใน LINE + ปุ่มแอดมินแนบแทนลูกค้า (attachment.create มี API ขาด UI) + **คลังลายต่อลูกค้า + สเปกติดลาย** (→ สั่งซ้ำ 1 คลิกเต็มรูป — duplicate มีแล้ว) + preflight DTF 3 เช็ค + นับรอบแก้แบบ (**เบสเคาะ: ฟรี 2 รอบ เกินคิด 100 บาท/รอบ** — เด้งเป็นรายการอัตโนมัติ) + ลิงก์ยืนยันใบเสนอ (ก๊อป token pattern จาก design) + **portal ขั้น 1: ลิงก์สถานะต่อออเดอร์/ต่อลูกค้า** (customerStatus พร้อมแล้ว · เบสเคาะ: โชว์เฉพาะส่วนของลูกค้า — สถานะ/กำหนดส่ง/แบบอนุมัติ/เอกสารของเขา/พัสดุ ห้ามมีข้อมูลภายใน) + size matrix (P1.12 เดิม) + Storage เปลี่ยน public URL → signed URL
**ก้อน 5 — MCP เฟสแรก (เบสเคาะ: ไม่รีบ — ทำตามลำดับ):** embed ใน Next.js (`app/api/mcp/[transport]` + vercel/mcp-handler เรียก services ตรง — P0.4 ปูไว้แล้ว) · AgentApiKey model (key ต่อ agent ผูก Role เดิม + audit ทุก call) · เครื่องมือ read-only 4 ตัว: สถานะออเดอร์ (dual view) / คิววันนี้+งานเสี่ยงสาย / ลูกหนี้+ร่างทวง (ร่างให้คนส่ง) / เช็คสต๊อค · **ห้ามมี**: เปลี่ยนสถานะ/เงิน/ลบ · เฟสสอง: draft order จากแชท (DRAFT/INQUIRY เท่านั้น คนยืนยันใน UI)
**ก้อน 6 — โฉมใหม่:** UI ทั้งระบบ (ทำภาพให้เบสเลือกก่อน) + ทางลัดงานชิ้นเดียว + ใบแก้ไขออเดอร์ (change order — อนุมัติแล้วล็อก แก้ผ่านใบแก้ไขเท่านั้น)

**เพิ่มเข้า P1 (เบสเคาะ 2026-06-12 — รื้อโมดูลผลิตตามความจริงโรงงาน):** ✅ ทำแล้ว 2026-06-12 — เบสชี้ "การผลิตเอาไปใช้จริงไม่ได้" + ให้ความจริงใหม่: **ทำเองมีแค่ DTF** (พิมพ์ฟิล์ม→รีดร้อน 2 ขั้น) · DTG/สกรีน/ปัก/Sublimation/ตัดเย็บใหม่/ป้ายคอเย็บติด = **outsource ทั้งหมด กด "ผ่านรวด" ปิดขั้นได้โดยไม่ต้องเปิดใบส่งร้าน/ไม่กรอกเงิน** → ใบผลิตเป็น "สายงานต่อเลน": เตรียมเสื้อ (เบิกสต๊อค/ตรวจรับเสื้อลูกค้า) · ตัดเย็บ (เลนแยก outsource) · เลนต่อเทคนิคพิมพ์ · ป้ายคอ (งอกเองจาก add-on) · แพ็ค (โผล่เมื่อสายอื่นเสร็จ) — ตัวแนะนำอ่านครบ 3 อย่าง: วิธีพิมพ์+แหล่งเสื้อ+add-on · หน้า /production = แท็บต่อเทคนิค + บอร์ดเลน (เบสเคาะ "เอาทั้งสองแบบ") · **มติใหญ่: เลิกคิดต้นทุนต่องานทั้งระบบ** (ดูกติกา 4)
**เพิ่มเข้า P1 (เบสเคาะ 2026-06-11 — redesign การเปิดงาน):** ✅ **ฟอร์มเปิดงานโหมดเดียว + ไม่ถามชนิดออเดอร์** (ทำแล้ว 2026-06-11) — เบสชี้: 2 โหมด (สอบถาม/ระบุครบ) + คำถาม สำเร็จรูป/custom ทำให้ใช้ยาก ไม่มีจุดโฟกัส → ยุบเหลือฟอร์มเดียว เปิดงานได้ด้วยลูกค้า+ชื่องาน · ระบบ **derive ชนิดออเดอร์จากเนื้อรายการเอง** (มีรายการ+ไม่มีลายพิมพ์=สำเร็จรูป · นอกนั้น=custom · re-derive ตอนแก้รายการเฉพาะช่วง DRAFT/INQUIRY) + **ภาษีต่อรายการ** (มีลาย=จ้างทำของ · ไม่มี=ขายสินค้า — ออเดอร์ผสมถูกกฎหมายกว่าเหมาทั้งใบ) · ด่านชดเชยฝั่ง server: ยืนยันออเดอร์ต้องมีรายการ · การ์ด "ขั้นถัดไป" บนหน้าออเดอร์ (`src/lib/order-next-step.ts`) บอกจุดโฟกัสเดียวต่อสถานะ · **เบสเคาะเพิ่มรอบสอง: บังคับแค่ลูกค้าช่องเดียว** — ชื่องาน/รายละเอียดไม่บังคับ (ชื่อว่าง = server ตั้งให้จากรายการแรกหรือชื่อลูกค้า+วันที่) + ถอดจำนวนโดยประมาณออกจากฟอร์ม

## P2 — ผลิต + สต๊อค
per-item tracking + นับชิ้น + ของเสีย/reprint log (รหัสสาเหตุ) · ~~outsource UI ครบ~~ (ทำแล้ว 2026-06-11 — ดึงขึ้น P1) + **AP vendor + WHT ขาจ่าย 3% + 50ทวิ + ภงด.53 export** (ภาษี/จ่ายร้านนอก — คนละเรื่องกับต้นทุนต่องาน แต่ทบทวนขอบเขตกับเบสก่อนเริ่ม) · ~~film usage log DTF → job costing~~ (**ตัดทิ้ง — เบสเคาะ 2026-06-12 เลิกคิดต้นทุนต่องาน** ดูกติกา 4) · จอง/ตัดสต๊อค READY_MADE + receiveFinished UI + sync cron (verify ท่อ Stock API ก่อน — key ปัจจุบัน placeholder) · ใบแพ็ค+ป้ายกล่อง+นับยืนยัน + **blind shipping** (เบสยืนยันมี reseller) · รูปก่อนส่ง (gate แรก) · เคลม/งานแก้เวอร์ชันเล็ก · **รับเข้าเสื้อลูกค้า (เบสยืนยัน "ส่งมาบ่อย" — ความสำคัญสูง)** · ปุ่ม clone สั่งซ้ำ

## P3 — ฝั่งลูกค้า
Customer portal (สถานะ/ประวัติ/เอกสาร/อนุมัติ/สั่งซ้ำ) · LINE OA notify+ทวงหนี้+WIP photo · CRM เต็ม (แก้ลูกค้า/comm log/follow-up/RFM) · revision quota + คิดเงินเกินโควตา + lock หลังอนุมัติ · strike-off gate (ตัวอย่างจริง opt-in) · preflight ไฟล์ (DPI/พื้นโปร่ง) · analytics ลึก

## P4 — เชื่อมโลก
Order-intake API → เว็บสกรีน 5 นาที · MCP server (เคารพ RBAC) · ฟอร์มเก็บไซซ์ลูกค้าองค์กร (เวอร์ชันเบา) · e-Tax provider / FlowAccount API / courier API เมื่อ volume ถึง

## จงใจไม่ทำ (อย่าหยิบกลับมา — เหตุผลใน plan.md)
GL/งบการเงิน · **job costing/ต้นทุนต่อออเดอร์ (เบสเคาะ 2026-06-12 — ต้นทุนเหมา คิดกำไรขาดทุนรายเดือนในระบบบัญชี · "มันสร้างความยุ่งยาก อันนั้นเป็นหน้าที่ของระบบบัญชี")** · DTF auto-nesting (RIP ทำแล้ว) · in-app chat (ลูกค้าอยู่ LINE) · online designer · ใบกำกับอย่างย่อ · time-clock/payroll (hr-platform-v2) · WMS/PR-PO-GRN (Anajak Stock) · mockup generator · CMMS เต็ม · QR scan-to-update เต็ม · courier API booking
