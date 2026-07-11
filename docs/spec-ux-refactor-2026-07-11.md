# SPEC — UX Refactor UX0–UX3

> เบสเคาะ 2026-07-11 จาก audit โค้ดครบ 45 หน้า + เปิดจอจริง 18 รูปแบบ desktop/mobile · งานนี้ทับเฉพาะการนำเสนอและทางเดินงาน ไม่เปลี่ยน business logic เงิน ภาษี สถานะ หรือเอกสารพิมพ์

## เป้าหมาย

ทำให้พนักงานรู้ว่า “ต้องทำอะไรต่อ” ภายใน 3 วินาที และทำงานประจำวันบนมือถือได้โดยไม่ลากตารางแนวนอนหรือเจอปุ่มที่กดแล้วถูกปฏิเสธ โดยคงทิศหน้าตาปัจจุบันไว้

## ขอบเขตตายตัว

- ไม่มี schema migration และไม่มี dependency ใหม่
- intake ใหม่เริ่มจาก Order/Inquiry ทางเดียว; ใบเสนอเดิมและ public URL เดิมยังอ่าน/แก้ได้
- UI อ่าน effective permission ชุดเดียวกับ server; ไม่มี action ที่กรอกจนเสร็จแล้วค่อย FORBIDDEN
- เงิน/ภาษี/status/document number ยังใช้ service และ invariant เดิมทั้งหมด
- refactor mega-component เฉพาะส่วนที่ flow นี้แตะ และต้องดึง pure decision logic พร้อม test ก่อน

## UX0 — Foundation

- Mobile control/touch target ≥44px, input font 16px; desktop control 36px/body 14px; metadata ≥12px
- primitives: `Field`, viewport-safe Dialog/Sheet, `ResponsiveList`, query state, `CapabilityGate`
- navigation registry เดียวสำหรับ Sidebar/Command Palette + exact/longest-match
- skip link, main landmark, `aria-current`, table header scope, live query error, reduced motion
- public token routes forced light; error state มีทางติดต่อ/กลับไปขอ link ใหม่
- jsx-a11y เปิด warning ระหว่าง migration และยกเป็น errorเมื่อไม่มี violation

## UX1 — Entry and focus

- `/home`: `supervise_operations` → `/`; role อื่น → `/my-tasks`; login ไป `/home`
- `/my-tasks`: “ต้องทำก่อน”, “งานของฉัน”, “คิวทีม”; dedupe ต่อ entity/action; overdue/blocked ก่อน; preview จำกัดและมีดูทั้งหมด
- `/production`: supervisor เห็น command center ก่อน; operator เห็นงานที่ถือ+ขั้นถัดไปก่อน
- KPI ทุกใบ deep-link ไป list ที่มี filter ตรงเลข พร้อม URL state; global search หา order/customer/quotation/invoice ตาม permission
- navigation มี `/factory` เฉพาะผู้มีสิทธิ์ดูแลการผลิต

## UX2 — Daily flows

- `/quotations/new` redirect `/orders/new?next=quote`; quotation ใหม่สร้างจาก order ที่มี `orderId`
- `/orders/new` จอแรก: ลูกค้า, ข้อความจากแชท, รูปแนบ, กำหนดส่ง, เปิดงาน; LINE/title default; urgency/note ใน “เพิ่มเติม”; items/pricing เป็นขั้นเลือกทำต่อ; ไม่มีปุ่ม draft ซ้ำ
- `/orders/[id]`: current+next ก่อน full timeline; mobile context strip; 4 primary tabs `overview|production|delivery|money`; `files|history` อยู่เมนูรองแต่ deep link เดิมใช้ได้; URL เป็น tab source เดียวหลัง permission load
- `/production/[id]`: action primary มาจากชนิดขั้น; outsource primary เฉพาะขั้นร้านนอกโดยโครงสร้าง
- Orders/Customers/Quotations/Billing/Aging/Billing Notes: desktop table + mobile card ไม่มี horizontal scroll
- Customer detail: เปิดงาน/โทร/LINE/email/บันทึกการคุย; create เป็น quick-create ก่อน tax/credit details

## UX3 — Dead ends and targeted refactor

- Billing row เปิด `/orders/:id?tab=money`; มี print + state-appropriate actions
- `quotation.updateDraft` บันทึก header+items transaction เดียว; `quotation.prepareShare` transition+คืน share URL ใน action เดียว; คำบนปุ่มเป็น “คัดลอก/แชร์ใบเสนอ”
- Product price ใช้ local draft แล้ว save on blur/button; Sync dialog ใช้ reducer/state machine + dialog กลาง
- Outsource เหลือส่งร้าน/รับกลับ/QC; vendor registry ไป Settings; shared outsource UI-action helper
- Analytics เหลือ trends/reports; audit log ไป System
- refactor order: quotation atomic → Sync state → order tab source → nav registry → responsive lists → outsource helper → item composer → Billing → Delivery/customer forms

## Interface ที่ต้องคง/เพิ่ม

- list URL: `q`, `status`, `sort`, `page`; Orders เพิ่ม `attention=overdue|due-soon|stuck`
- order tabs: `overview|production|delivery|money|files|history`
- tRPC: `search.global`, `quotation.updateDraft`, `quotation.prepareShare`
- shared types: navigation item, responsive-list view, field state, production step UI action

## Preview gate

ก่อนขยาย pattern ไปหน้าที่เหลือ ต้องเปิดข้อมูลจริง 4 หน้า `/my-tasks`, `/orders/new`, `/orders/[id]`, `/production/[id]` ที่ mobile+desktop และยืนยัน:

1. จุดโฟกัส/primary CTA เดียวชัด
2. ไม่มี horizontal scroll
3. action มือถือ ≥44px
4. keyboard/Escape/focus return ทำงาน
5. console ไม่มี error

## Acceptance

- viewport 320/375/640/768/1024/1440, landscape และ zoom 200%
- keyboard-only, reduced motion, system dark, public forced-light
- 6 role + permission override อย่างน้อยหนึ่งชุด
- flows: inquiry→items→share quote→accept; operator work→qty→complete ใน 1–2 แตะ; accountant list→money/print/void; KPI→exact list→back retains filter; public link dark-mode/error recovery
- core mobile listsไม่มี horizontal scroll; touch action ≥44px; a11y lint 0 error; UI permission ตรง server; query errorไม่เป็น empty; quotation ไม่มี partial save; console 0 error; unit test เดิมไม่ถอย

