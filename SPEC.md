# Anajak ERP — SPEC (อะไรคือ "เสร็จ")
> เกณฑ์ที่ต้องเป็นจริงถึงเรียกว่าเสร็จ · verify ด้วยรัน/เปิดดูจริงก่อนเคลม · กติกาเปลี่ยน = แก้ที่นี่ก่อนเขียนโค้ด
> `[x]` = ผ่าน audit/verify แล้ว (มีหลักฐาน file/commit) · `[ ]` = ยังเปิด · รายละเอียดการตรวจแต่ละรอบ (file:line · adversarial review) อยู่ใน git: `git show 61575af:SPEC.md`

## เป้าหมาย
ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak — ทีม 5 คน + เจ้าของ จัดการ ขาย → ออกแบบ/อนุมัติ → ผลิต/ส่งร้านนอก → QC → ส่ง → บิล/ภาษี/ลูกหนี้ ของลูกค้า B2B ครบวงจร · ออกเอกสารภาษีเต็มรูปเอง · เชื่อม Anajak Stock · โครงต้องรองรับออเดอร์จากเว็บสกรีน (ธรรมดา + custom) โดยไม่ทำทางแยก (เบสย้ำ 2026-09-02 · `AGENTS.md` §เป้าหมาย)

## 💰 กฎเหล็กข้อมูล (invariant — verified 2026-06-19 · ห้ามถอย)
- [x] **เงินทุก field = `Decimal(12,2)`** · คำนวณผ่าน `Prisma.Decimal` (`services/money.ts` round2 half-up) · แปลงเป็น number ที่ขอบเดียว `lib/prisma.ts` · aggregate `_sum` ต้องเรียก `aggToNumber` เอง
- [x] **เลขเอกสารรันต่อเนื่อง** `nextDocumentNumber()` (`services/document-number.ts`) ใน `$transaction` เดียวกับการสร้างเอกสาร · ทุกชนิด ORD/INV/REC/CN/DN/QT/BN/FR · import เอกสารเก่าต้อง seed lastNumber ก่อน
- [x] **สถานะออเดอร์เปลี่ยนผ่าน `transitionOrder()`** (`services/order-status.ts`) จุดเดียว — validate + optimistic lock + `OrderRevision` · direct write มีแค่ค่าเริ่มต้นตอน create
- [x] **การเงินหลายขั้น = `$transaction` + `SELECT FOR UPDATE`** (`services/billing.ts`) · เพดานสองขา `billedFloor` / `assertOrderTotalCoversBilled` · ใบเสร็จผูกงวดรับเงิน 1:1 (`forPaymentId @unique` · ยอดเท่าเงินรับ · `issueDate` = วันรับเงินจริง)
- [x] **ใบกำกับ/ใบวางบิล ยกเลิก-ออกใหม่เท่านั้น** ไม่มี `delete` · soft-void + guard กัน void ซ้ำ · CN/DN ผูกใบเดิม + เหตุผลบังคับ (ม.86/10) และหักยอดค้างจริงทุกทาง

## 🔐 ความปลอดภัย + สิทธิ์ (verified 2026-07-02 → 07-07)
- [x] คนนอกเข้าไม่ได้ — `src/proxy.ts` refresh session ทุก request · ยกเว้นเฉพาะหน้า public token (`/approve` `/upload` `/status` `/quote` `/job`) + `/api/mcp` (auth ด้วย key) · มี Proxy regression test
- [x] auth fail-closed (ไม่มี dev-OWNER fallback) · `requireRole` ครบทุก mutation · router public token 5 ตัวโดยเจตนา
- [x] **สิทธิ์รายคน (PERM)** `lib/permissions.ts` — role = ชุดสิทธิ์เริ่มต้น + override รายคน · มีผลทั้ง server/จอ/print/MCP key · OWNER active ≥ 1 เสมอ
- [x] role หน้างานไม่เห็นทุน/กำไร (`lib/roles.ts`) · Station/Factory DTO ไม่มีเงินโดยโครงสร้าง (explicit select/mapper)
- [x] security headers ทุก route · CI lint+typecheck+vitest ทุก push/PR · สำรองข้อมูล export JSON ในแอป (ตั้งค่า → สำรองข้อมูล)

## 📋 Flow หลัก — เกณฑ์เสร็จต่อ flow (verified E2E 2026-06-19 + Gate 2026-07-03)
- [x] **เปิดออเดอร์** `/orders/new` → เลข `ORD-YYMM-NNNN` + AuditLog · ประเภท READY_MADE / CUSTOM · เสื้อ 3 แหล่ง (FROM_STOCK / CUSTOM_MADE / CUSTOMER_PROVIDED) → ใบผลิตเสนอขั้นตามแหล่ง + เทคนิค · ฟอร์มเดียวใช้ทั้งสร้างและแก้ · ที่อยู่ผู้ติดต่อแยกจากที่อยู่จัดส่ง
- [x] **ยืนยันออเดอร์มีสต๊อก** → จอง Anajak Stock อัตโนมัติ + ด่านวงเงินเครดิต (`assertSalesWithinCreditLimit`) · จองพลาด → กระดิ่ง + retry
- [x] **ใบเสนอราคา** → ลูกค้ากดยอมรับผ่าน `/quote/<token>` → แปลงเป็นออเดอร์ (กันซ้ำ · ด่าน ACCEPTED/ไม่หมดอายุ) · VAT default 7% (marketplace ราคารวม VAT → 0)
- [x] **portal ลูกค้า (token · ไม่ต้อง login)**: อนุมัติแบบ `/approve/design` · สถานะ `/status` (ไม่รั่วราคา/ต้นทุน/internalStatus) · อัปโหลด `/upload` (signed · server เลือก path) · ใบงานร้านนอก `/job` (LINE-friendly · หมดอายุ 90 วัน · fail-closed)
- [x] **ม็อกอัพ**: หนึ่งเวอร์ชันหลายรูป (หน้า/หลัง/แขน + ตำแหน่งพิมพ์ต่อรูป) · ลูกค้าอนุมัติทั้งชุดครั้งเดียว · ไฟล์ที่เบราว์เซอร์แสดงไม่ได้ต้องแนบรูปตัวอย่าง · จัดการที่แท็บ "ม็อกอัพ & ไฟล์" ที่เดียว จอที่เหลืออ่านอย่างเดียวจาก component ชุดเดียว
- [x] **outsource** ผูกขั้นผลิต → OutsourceOrder (ล็อกแถว) SENT → RECEIVED_BACK → ตรวจรับ (ก่อน QC สุดท้าย) · เจ้าหน้าที่คุยร้านผ่าน LINE ด้วยลิงก์ `/job`
- [x] **ผลิต → QC → แพ็ก → พร้อมส่ง → ส่ง**: ผลิตครบทุกใบจึงเข้า QC · QC เชิงนับ bypass ไม่ได้ (guard ใน `$transaction` เดียวกับ transition) · ใบส่งครบจึง READY_TO_SHIP · delivery มี state machine + tracking ทุกสถานะ · แบ่งกล่องได้ · RETURNED → กระดิ่ง
- [x] **goods receipt + รอบพิมพ์ DTF (ฟิล์ม FR-) + คลังฟิล์ม** · `issueMaterials` atomic + อ่าน MaterialUsage กลับได้ · สินค้า soft-delete (`deletedAt`) เก็บประวัติ
- [x] **บิล → ชำระ → WHT 50ทวิ อัตโนมัติ** (นิติบุคคลหัก 3%) · ใบวางบิลรวม + ลูกหนี้ aging + dunning (cron mark OVERDUE · fail-closed `CRON_SECRET`) · REC รับเงินได้เฉพาะขายสดไม่มีใบเรียกเก็บ · CN ห้ามรับเงิน
- [x] **พิมพ์เอกสารจริง**: ใบกำกับ ม.86/4 (ต้นฉบับ + สำเนา · void มีลายน้ำ) · ใบเสนอ · ใบวางบิล · ใบสั่งงาน · ใบรายการสินค้า — A4 · light-only · grayscale-safe
- [x] **รายงานภาษีขายรายเดือน** `/billing/tax` export CSV (ฟอร์มสรรพากร พ.ศ. + template import PEAK) — มติตัด GL ยืนบนข้อนี้
- [x] **CRM ใช้จริง**: แก้ลูกค้าครบ field · บันทึกการคุย · pagination/ค้นหา · หน้า `/settings` ไม่มีฟอร์มปลอม · sidebar/ปุ่ม gate ตามสิทธิ์ตรง server
- [x] **เชื่อม Anajak Stock** (test/sync/issue/receive · ต้องตั้ง env จริง) + **MCP** `/api/mcp/[transport]` (agent key · เคารพสิทธิ์) + cron ปลดจองค้าง

## 🏭 Production V2 — ERP/MES หนึ่งข้อมูลจริง (โค้ด + migration ครบ 2026-08-22 · **ยังไม่ cutover**)
- [x] **แกน Manufacturing**: `Production` = Manufacturing Order · `ProductionStep` = Operation Job (คง ID/FK เดิม) · routing มี version + immutable หลัง release · dependency ขนาน · snapshot ตอน release · quantity line ต่อ สินค้า/สี/ไซซ์/จุดพิมพ์ · `OperationEvent` append-only · exception/rework ตรวจย้อนได้ · ทุก lane รวมที่ Final Pack เดียว
- [x] **command ปลอด retry**: `commandId` + `expectedRevision` · lock order ชุดเดียว · readiness/dependency/`availableCommands` คำนวณที่ server · เฉพาะ `qtyGood` เดินต่อ · reject ต้องมี disposition · rework ต้องตรวจซ้ำ
- [x] **บ้านละหน้าที่**: `/production` รายการทุกงาน — **ถอดออก 2026-09-02 รอออกแบบใหม่** (`ROADMAP.md` §A3 · รวมรอบพิมพ์/คลังฟิล์ม/คิวร้านนอก) · `/production/[id]` Control Record ของหัวหน้า (release/priority/assignment/exception/audit · ไม่มี start/report/complete แทนพนักงาน) · จอสถานีพนักงานลงมือ — **ถอดออก 2026-09-02 รอออกแบบใหม่** (`ROADMAP.md` §A2 · กติกาเดิมที่จอใหม่ต้องรักษา: งานปัจจุบัน + primary action เดียว · DTF เป็น batch · handoff ผู้ใช้กดเอง · scan เปิด context เท่านั้น) · `/factory` TV อ่านอย่างเดียว · Order/My Tasks = summary + deep link · route เก่า (`print-runs` `films` `/outsource`) redirect เข้าบ้าน canonical
- [x] **สูตรขั้นงานเป็นข้อมูล ไม่ใช่โค้ด**: seed สูตรมาตรฐาน Anajak (`prisma/seed.ts` · idempotent) + หน้าตั้งค่า `/settings/routings` (เวอร์ชันที่ใช้แล้วแก้ไม่ได้ → คัดลอกเป็นร่างใหม่ · `services/routing-template.ts` + test) · ขั้นไหนก็ส่งร้านนอกได้ (`executionMode` รายขั้น) · งานร้านนอกเดินขนานกับ DTF · "ตรวจของกลับจากร้าน" เป็นขั้นในสูตร แทนกฎเดิม "รีดร้อนรอร้านนอกทุกสายจบ" (เบสเคาะ 2026-09-01)
- [x] **หลังเปิดใบผลิต** นิยามสินค้า/สี/ไซซ์/จุดพิมพ์ + หลักฐานรับเสื้อบน Order เป็น read-only · Final Pack ครบจึง READY_TO_SHIP · การส่ง/tracking อยู่แท็บ Delivery (`ship_orders`) · generic `order.updateStatus` เขียนสถานะการผลิตไม่ได้เมื่อเปิด V2
- [ ] **PV2.8 cutover** — เบส walkthrough บทบาทหัวหน้า + พนักงานครบ flow บนฐาน demo → seed routing + work center ฐานจริง (additive) → backup → เปิด `PRODUCTION_V2_ENABLED` บน production ทีละขั้น (เบสอนุมัติทุกขั้น) → ลบ legacy UI + writer เก่า
  - ข้อควรรู้จากการซ้อม 2026-09-01: รายงานผลผลิตต้องแยกตาม quantity line (ยิงยอดรวมถูกปฏิเสธ) · ขั้น DTF เริ่มจากรอบพิมพ์ที่ผูกหลักฐาน ไม่เริ่มลอย ๆ → การซ้อมที่เหลือต้องกดในจอสถานีจริง ไม่ใช่ยิงสคริปต์ — **ค้างไว้จนกว่าจอสถานีใหม่จะเสร็จ** (จอเดิมถอดออก 2026-09-02)

## 🎨 UI ที่เบสเคาะแล้ว (ยึดทุกหน้าใหม่ · token/component/contract เต็ม → `docs/DESIGN.md`)
- [x] **minimal แบบ Notion/Vercel**: ผืนงาน near-white · การ์ดขาว edge บาง เงากลางชุดเดียว (`.card-surface`) · ธีมมืดไม่ดำสนิท ไล่ชั้นด้วยความสว่างจริง · น้ำเงิน Anajak `#3973b2` เฉพาะ primary/selected/focus · สีสถานะเฉพาะความหมายจริง · สีหมวดแบบ "ไอคอนสี ไม่มีกล่อง" (เบส 08-31) · เมนูซ้ายไม่มีสี
- [x] **ไม่มีระบบชื่องาน** (เบส 08-30) — ใบอ้างด้วยเลขที่ + ลูกค้า · สิ่งที่บอกว่า "ทำอะไร" = ชื่อรายการงาน (`OrderItem.description`) · คอลัมน์ `orders.title` / `quotations.title` ลบถาวรแล้ว · ห้ามกลับมา (ด่าน verify:ui)
- [x] ทุกหน้ามีคำอธิบาย 1 ประโยคใต้หัวข้อ (`PageShell`) · หนึ่งหน้า primary action เดียว · จุดโฟกัสชัดใน 3 วิ (งานเสี่ยง/ค้างมาก่อนสถิติสะสม) · HelpTip เฉพาะสูตร/กติกา ห้ามซ่อน warning/validation
- [x] **ตารางระดับบนสุดมีกล่องครอบ** (เบสกลับคำ 08-26 หลังเห็นของจริง) · หัวตารางโปร่ง sentence-case · body 14px · ตัวกรอง ≤ 5 = `FilterChip` ข้อความ + เส้นใต้ · เกิน 5 = `Select` · ตัวกรองประจำอยู่บน toolbar ไม่ซ่อนใน popover
- [x] แถบบนอยู่เหนือเฉพาะคอลัมน์เนื้อหา ขอบขวาตรงกัน · เมนูซ้ายสูงเต็มจอถือตรา หมวดแบบแบน · ปุ่มหุบ/กางอยู่ในแถวตรา (08-28) · มือถือ bottom nav 4 รายการ + "เพิ่มเติม"
- [x] **หน้าใบงาน** `/orders/[id]`: หัวใบมีแค่สถานะ + CTA · แถบขั้นตอนกว้างเท่าส่วนอื่น จุดมีเลข 1-4 เว้นสมมาตร เส้นต่อกัน (08-30) · แท็บภาพรวมเห็นลาย/ม็อกอัพทันที ประวัติลูกค้าบรรทัดเดียว (08-31) · แท็บ lazy + URL + Back
- [~] **`/production`** (ถอดออก 2026-09-02 รอออกแบบใหม่ — กติกาเดิมที่เคาะไว้ เผื่อจอใหม่ยึด): ตัวกรองเป็นสายพานขั้นงาน (ตัวเลขนำ ชื่อรอง + ลูกศร + ไอคอนรถบนขั้นร้านนอก · เก็บใน URL `?station=`) · ไม่มีช่องเรียงบนคอม · ตารางแบ่งกลุ่มตามกำหนดส่ง · คอลัมน์ "เส้นทางงาน" = แถบแบ่งช่วงย้อมสีตามสถานะ (เขียว/ส้ม/แดง/เทา) + "x/y ช่วง" (09-02)
- [x] ฟอนต์ Prompt เดียว · type roles 24/16/18/14/12/11 (11 เฉพาะ status/counter) · letter-spacing 0 กับไทย · เป้ากด 44px มือถือ/coarse · 36px desktop · 390px และ 1440px ไม่มี horizontal overflow · WCAG AA ทั้งสองธีม · reduced-motion · `transition: all` ห้าม
- [x] public/print: ครอบครัวเดียวกับหลังบ้าน แต่ light-only · A4 · grayscale-safe · ข้อความกฎหมาย/ยอด/ลำดับหน้าคงเดิม · จอทัชเห็น scrollbar ถาวร
- [x] **"ของจริง ไม่ใช่ mockup"** — ทุก UI อ่าน tRPC/service/permission ชุดเดิม · ไม่มีปุ่มหลอก/ตัวเลขเขียนค้าง · loading/error/retry/empty/สิทธิ์ แยกกันและซื่อสัตย์กับ server · interactive element ไม่ซ้อนกัน · dialog เปิดแบบ conditional mount

## 🚦 Gate ที่ยังเปิด
- [ ] **B6** นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน จากเอกสารพิมพ์จริง (open decision ค้างตั้งแต่ plan.md)
- [ ] **B16** walkthrough ของจริงกับทีม + นักบัญชีเห็นเอกสารเงินพิมพ์จริง 1 รอบ (audit ทำจากโค้ด — คะแนน UX เป็นสมมติฐานจนกว่าจะลองจริง)
- [ ] **console checklist** Supabase/Vercel → `docs/deploy-checklist.md` (ปิด public signup **ยังไม่ยืนยัน**)
- [ ] **PV2.8** cutover Production V2 (ด้านบน)

## 🚫 นอกขอบเขต (จงใจไม่ทำ — กัน scope creep · เหตุผลใน bestos `plan.md`)
GL/บัญชีแยกประเภท/งบการเงิน (นักบัญชี + PEAK) · job costing/ต้นทุนต่อออเดอร์ (เบส 06-12 — ห้ามเพิ่มช่องเงินใน flow ผลิต/outsource) · DTF auto-nesting (RIP ทำ) · online designer เต็มรูป (เว็บสกรีน = เลือก/อัปโหลด + ดีไซเนอร์ช่วย) · in-app chat (LINE) · ใบกำกับอย่างย่อ · time-clock/payroll (hr-platform-v2) · WMS/PR-PO-GRN (Anajak Stock) · mockup generator · CMMS · courier API booking · รายงาน ม.87(3)

## ✅ ด่านก่อนเคลมเสร็จ (ทุกงาน)
`npm run typecheck` · `npm run lint` (0 error) · `npm test` · `npm run verify:ui` (ห้ามปิด · แก้ค่าคาดหวังได้เฉพาะเมื่อบทบาท token เปลี่ยนจริงและอยู่คอมมิตเดียวกัน) · งาน UI เปิดจอจริง 1440 + 390 ทั้ง Light/Dark · `npm run build` ก่อนขึ้น main · งานที่แตะ DB ใช้ `verify:*` บนฐาน demo เท่านั้น
