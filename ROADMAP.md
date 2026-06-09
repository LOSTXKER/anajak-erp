# Anajak ERP — Roadmap & ใบงาน build

> สร้าง 2026-06-10 โดย Nami (bestos) · แผนเต็ม+ที่มา: `D:/dev/ai-agent2/records/projects/anajak-erp/` (plan.md + _survey-2026-06-10.md)
> เบสเคาะแล้ว: ซ่อมต่อบนโครงเดิม · DB ว่างรื้อ schema ได้อิสระ · ผู้ใช้ = พนักงาน 5 คน + เบส + ลูกค้า · ภาษีเต็มรูป (ERP ออกใบกำกับเอง) + หัก ณ ที่จ่าย 2 ขา · เว็บ 5 นาที = ทีหลัง

## กติกา build (ผูกทุก phase — ห้ามข้าม)
1. เพดานจริง ~1-2 โมดูลเล็ก/เดือน — อย่ารับปากเกิน · ทุกไตรมาส prune backlog ที่ยังไม่เริ่มทิ้งครึ่ง
2. เปิด "gate บังคับ" ทีละตัว (รูปก่อนส่ง → ค่อยเพิ่มตัวถัดไป) — เปิดพร้อมกันพนักงาน bypass ข้อมูลกลายเป็นขยะ
3. manual field/CSV ก่อน API เสมอ (courier/บัญชี/stock-link)
4. โซ่ต้นทุนห้ามสลับ: film log + outsource AP → job costing → ค่อย margin guard
5. **ไม่ build บัญชีแยกประเภท (GL)** — ERP ออกเอกสารขาย/ใบกำกับ/50ทวิ + export มาตรฐาน (CSV/Excel) ให้นักบัญชี · ยังไม่ผูก FlowAccount/PEAK (เบสเคาะ: ทำมาตรฐานก่อน)
6. surgical: แตะเฉพาะที่ใบงานสั่ง · โครงเดิมดี (order module/status machine/token approval) — ต่อยอด อย่ารื้อ

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

**เกณฑ์จบ P0:** คนนอกเปิดเว็บแล้วเข้าไม่ได้ · ทีม 6 คน login จริงได้ตาม role · ยอดเงินทดสอบตรงทุกเส้นทาง (รวม platformFee) · มี migration history · seed รันผ่าน

---

## P1 — เอกสาร + การเงินไทย + งานรายวัน (สรุป — รายละเอียด: plan.md ใน bestos)
PDF ครบชุด (ใบเสนอ/แจ้งหนี้/เสร็จ+**ใบกำกับเต็มรูป ม.86/4** · ยกเลิก-ออกใหม่ห้ามลบ · ใบลดหนี้-เพิ่มหนี้) · **Job Ticket ใบสั่งงานหน้างาน+QR** · WHT ขารับ (ทะเบียน 50ทวิ + reconcile 97/3) · มัดจำตาม payment terms + overdue cron · **ใบวางบิล + ลูกหนี้ aging + เช็ค credit limit** · approval gate ส่วนลด/void · **ปฏิทินภาระงาน+เช็คทันไหม (เบา)** · **ราคาต่อลูกค้า + quote expiry + แก้ใบเสนอ** · **task queue "งานของฉันวันนี้"** · notification จริงจาก event · multi-size matrix · รายงานภาษีขาย export CSV/Excel

## P2 — ผลิต + สต๊อค + ต้นทุนจริง
per-item tracking + นับชิ้น + ของเสีย/reprint log (รหัสสาเหตุ) · outsource UI ครบ + **AP vendor + WHT ขาจ่าย 3% + 50ทวิ + ภงด.53 export** · **film usage log DTF → job costing** (ลำดับบังคับ) · จอง/ตัดสต๊อค READY_MADE + receiveFinished UI + sync cron (verify ท่อ Stock API ก่อน — key ปัจจุบัน placeholder) · ใบแพ็ค+ป้ายกล่อง+นับยืนยัน + **blind shipping** (เบสยืนยันมี reseller) · รูปก่อนส่ง (gate แรก) · เคลม/งานแก้เวอร์ชันเล็ก · **รับเข้าเสื้อลูกค้า (เบสยืนยัน "ส่งมาบ่อย" — ความสำคัญสูง)** · ปุ่ม clone สั่งซ้ำ

## P3 — ฝั่งลูกค้า
Customer portal (สถานะ/ประวัติ/เอกสาร/อนุมัติ/สั่งซ้ำ) · LINE OA notify+ทวงหนี้+WIP photo · CRM เต็ม (แก้ลูกค้า/comm log/follow-up/RFM) · revision quota + คิดเงินเกินโควตา + lock หลังอนุมัติ · strike-off gate (ตัวอย่างจริง opt-in) · preflight ไฟล์ (DPI/พื้นโปร่ง) · analytics ลึก

## P4 — เชื่อมโลก
Order-intake API → เว็บสกรีน 5 นาที · MCP server (เคารพ RBAC) · ฟอร์มเก็บไซซ์ลูกค้าองค์กร (เวอร์ชันเบา) · e-Tax provider / FlowAccount API / courier API เมื่อ volume ถึง

## จงใจไม่ทำ (อย่าหยิบกลับมา — เหตุผลใน plan.md)
GL/งบการเงิน · DTF auto-nesting (RIP ทำแล้ว) · in-app chat (ลูกค้าอยู่ LINE) · online designer · ใบกำกับอย่างย่อ · time-clock/payroll (hr-platform-v2) · WMS/PR-PO-GRN (Anajak Stock) · mockup generator · CMMS เต็ม · QR scan-to-update เต็ม · courier API booking
