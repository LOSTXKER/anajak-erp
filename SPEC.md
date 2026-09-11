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
- [x] **บ้านละหน้าที่**: `/production` คิวหัวหน้า; `/production/[id]` ดูและลงมือตามสิทธิ์; `/production/floor` งานของพนักงาน; `/factory` TV อ่านอย่างเดียว. ปุ่ม/สิทธิ์ใช้ controller และ readiness เดิม; DTF ผ่าน batch, handoff ผู้ใช้กดเอง, scan เปิด context เท่านั้น. Order/My Tasks ใช้ summary และ deep link ไปงานจริง
- [x] **สูตรขั้นงานเป็นข้อมูล ไม่ใช่โค้ด**: seed สูตรมาตรฐาน Anajak (`prisma/seed.ts` · idempotent) + หน้าตั้งค่า `/settings/routings` (เวอร์ชันที่ใช้แล้วแก้ไม่ได้ → คัดลอกเป็นร่างใหม่ · `services/routing-template.ts` + test) · ขั้นไหนก็ส่งร้านนอกได้ (`executionMode` รายขั้น) · งานร้านนอกเดินขนานกับ DTF · "ตรวจของกลับจากร้าน" เป็นขั้นในสูตร แทนกฎเดิม "รีดร้อนรอร้านนอกทุกสายจบ" (เบสเคาะ 2026-09-01)
- [x] **หลังเปิดใบผลิต** นิยามสินค้า/สี/ไซซ์/จุดพิมพ์ + หลักฐานรับเสื้อบน Order เป็น read-only · Final Pack ครบจึง READY_TO_SHIP · การส่ง/tracking อยู่แท็บ Delivery (`ship_orders`) · generic `order.updateStatus` เขียนสถานะการผลิตไม่ได้เมื่อเปิด V2
- [ ] **PV2.8 cutover** — เบส walkthrough บทบาทหัวหน้า + พนักงานครบ flow บนฐาน demo → seed routing + work center ฐานจริง (additive) → backup → เปิด `PRODUCTION_V2_ENABLED` บน production ทีละขั้น (เบสอนุมัติทุกขั้น) → ลบ legacy UI + writer เก่า
  - ข้อควรรู้จากการซ้อม 2026-09-01: รายงานผลผลิตต้องแยกตาม quantity line (ยิงยอดรวมถูกปฏิเสธ) · ขั้น DTF เริ่มจากรอบพิมพ์ที่ผูกหลักฐาน ไม่เริ่มลอย ๆ → การซ้อมที่เหลือต้องกดในจอสถานีจริง ไม่ใช่ยิงสคริปต์ — สถานะการซ้อมล่าสุดดู PROGRESS.md

## 🎨 UI และการปรับใหม่
- **A16 (2026-09-11 · เบสสั่งเริ่ม refactor และรื้อ UI ทุกหน้าทุกส่วน):** อนุญาตตรวจและปรับการนำเสนอ โครงหน้า component กลาง และกฎหน้าตาที่ขัดการใช้งานบน branch ตาม ROADMAP โดยใช้ `/Users/lostxker/dev/Git/bestos-brain/global-skills/ui-guidance/SKILL.md` ฉบับปัจจุบัน. กฎหน้าตารุ่นก่อนเป็นหลักฐานของทิศเดิม ไม่ใช่ข้อห้ามปรับในงานนี้; ทิศที่ต้องเทียบให้แสดงหน้าลองบน component จริง. คำช่วยที่จำเป็นต่อการตัดสินใจ ลงมือ หรือแก้ผิดต้องเห็นตรงจุดใช้; ไม่บังคับคำโปรยทุกหน้า ไม่ซ่อนคำช่วยเพียงเพราะเป็นข้อความคงที่ และแต่ละรายการอิสระมีคำสั่งหลักของตัวเองได้. คงกฎเงิน สถานะ สิทธิ์ query/command หลักฐาน เอกสารพิมพ์ และทางกู้คืนเดิม. ด่านข้อมูล/การเข้าถึงยังบังคับ; heuristic หน้าตาให้คำเตือนเพื่อทบทวน ไม่ใช้จำนวนจุด/ความยาว/ชื่อคลาสตัดสินคุณภาพ. การแก้ token/contract ต้องปรับการตรวจที่เกี่ยวในชุดเดียวกันและลองภารกิจจริงก่อนรับงาน; การอนุญาตนี้ไม่ใช่อนุมัติขึ้นเว็บจริง.

### เกณฑ์การใช้งานที่ต้องคงไว้
- UI ใช้ tRPC/service/permission ชุดเดิม; loading/error/retry/empty/สิทธิ์แยกกัน ข้อมูลสรุปยังไม่มาไม่แสดงเลข 0 และ background error ไม่ทิ้งข้อมูลที่โหลดแล้ว. ทางค้นหาว่างล้างตัวกรองได้; แท็บ/ค้นหา/เรียง/แบ่งหน้าคง URL, Back และข้อมูลที่ยังไม่บันทึก
- ใบอ้างด้วยเลขที่และลูกค้า; สิ่งที่ทำคือรายการงาน (`OrderItem.description`). ไม่คืนคอลัมน์ `orders.title` / `quotations.title` ที่ถอดออกแล้ว
- `/production` เป็นตารางต่อเนื่อง ไม่มีหัวแบ่งสถานะหรือกำหนดส่งในตาราง (A10–A11). ตัวกรองอยู่นอกตาราง สถานะ/ปัญหาอยู่ในแถว; มือถือรวมบริบทใบ/กำหนดส่ง/ขั้นไว้ใกล้กันและเลื่อนเฉพาะตาราง. ปัญหา = FAILED/ON_HOLD/ตรวจรับร้านไม่ผ่าน/ไม่ผ่านด่านเปิดใบ ไม่เหมารวมแค่เลยกำหนดหรือรอขั้นก่อน
- หัวหน้าดู วางแผน ลงมือ แก้ปัญหา และมอบหมายจาก `/production/[id]` ได้ครบตามสิทธิ์. พนักงานใช้ `/production/floor`; ปุ่มและ dialog อ่าน controller ชุดเดียวกัน. แยกการเลือกดูขั้นจากการเริ่มทำและแยกพร้อมทำจากกำลังทำ; งานคู่มีข้อมูลและคำสั่งของแต่ละขั้น
- ใบผลิตแสดงสินค้า/รูป/ลายครั้งเดียวต่อกลุ่มและยอดต่อไซซ์. `OperationQuantity` แถว VARIANT เก็บทำแล้ว/เสีย ยอดขั้นเป็นผลรวม; เช็คลิสต์ `ProductionStepCheck` เก็บผู้ติ๊กและเวลา; ปิดขั้นผ่าน `updateStep` ต้องผ่านเช็คลิสต์ฝั่ง server. ขั้นร้านนอก/รอบพิมพ์/ใบตรวจรับคง flow หลักฐานเฉพาะ; ขั้นอื่นปิดด้วยปุ่มรวมขั้นที่เดิมจดกระดาษ ไม่ตีความว่าขั้นเก่าที่ปิดแล้วมีผู้ติ๊กครบเอง
- ปุ่มลงมืออยู่ใกล้ข้อมูลที่เปลี่ยน (A14); หากยังไปต่อไม่ได้ต้องเห็นเหตุและทางไปทำสิ่งที่ขาด. เมนูรองเก็บงานที่ใช้น้อยและคงทางพักขั้น/ย้อนกลับ/ดูประวัติ; ส่งเข้า QC ได้เมื่อทุกขั้นปิดครบ. `pairWithPrevious` คงการจับคู่จากสูตรและกล่องเปิดใบ; `production.reopenStep` เฉพาะหัวหน้า ขั้นปิดด้วยปุ่ม และขั้นถัดไปยังไม่เริ่ม
- GARMENT_RECEIVE รับไม่ครบแล้วบันทึกได้ ยอดเหลือรอรอบหน้า; ใช้ `goodsReceipt.context/create/confirmCustomerGarmentEvidence` พร้อม idempotency/สิทธิ์เดิม. ใบผลิตนับในกล่องขั้น (A14.3); หน้าออเดอร์/สถานีใช้กล่องใบตรวจรับเดิมได้
- แก้ยอดตรวจรับผิด (A15) = หัวหน้ากรอกยอดถูกต่อไซซ์และเหตุผลผ่าน `goodsReceipt.correctCustomerGarment`. ออกหลักฐานส่วนต่างจริง (เกินเป็นใบคืน ขาดเป็นใบรับเพิ่ม); ยอดครบคงปิด ไม่ครบกลับ IN_PROGRESS; audit เก็บเหตุผลและแถวที่แก้. การคืนปกติหลังเปิดใบผลิตยังถูกกันตามเดิม
- `production.create` ไม่ปิด GARMENT_RECEIVE ให้เองแม้มีใบรับครบอยู่ก่อน (A13); ต้องยืนยันหลักฐานโดยผู้ใช้. ขณะทำใบตรวจรับจริงนับครบทุกไซซ์ `goods-receipt` ยังปิดขั้นได้ตามเดิม โดยไม่บังคับกดซ้ำ
- ใบสั่งงานพิมพ์จาก production ที่ถูกต้อง; คงวันพิมพ์/เวอร์ชันม็อกอัพและ QR `?mockup=n` พร้อมแจ้งเมื่อเปิดใบเก่า. ต้องแยกหลักฐาน “ถือว่าผ่าน” ของข้อมูลเก่าจากผลทำจริง ไม่เขียนประวัติขึ้นเอง
- Prompt และ semantic tokens เป็นชุดปัจจุบัน; ปรับร่วมกันได้ใน A16. ข้อความไทยไม่ตัดสระ/วรรณยุกต์, mobile input 16px, เป้ากด mobile/coarse 44px และ desktop 36px, WCAG AA ทั้งสองธีม, keyboard/focus/reduced-motion และไม่ซ้อน interactive elements
- public/print ใช้ light-only; เอกสาร A4 อ่านขาวดำได้ คงข้อความกฎหมาย/ยอด/ลำดับหน้า/สิทธิ์/blind-ship. การเปลี่ยนหน้าตาไม่เปลี่ยนข้อมูลที่แต่ละบทบาทเห็น

## 🚦 Gate ที่ยังเปิด
- [ ] **B6** นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน จากเอกสารพิมพ์จริง (open decision ค้างตั้งแต่ plan.md)
- [ ] **B16** walkthrough ของจริงกับทีม + นักบัญชีเห็นเอกสารเงินพิมพ์จริง 1 รอบ (audit ทำจากโค้ด — คะแนน UX เป็นสมมติฐานจนกว่าจะลองจริง)
- [ ] **console checklist** Supabase/Vercel → `docs/deploy-checklist.md` (ปิด public signup **ยังไม่ยืนยัน**)
- [ ] **PV2.8** cutover Production V2 (ด้านบน)

## 🚫 นอกขอบเขต (จงใจไม่ทำ — กัน scope creep · เหตุผลใน bestos `plan.md`)
GL/บัญชีแยกประเภท/งบการเงิน (นักบัญชี + PEAK) · job costing/ต้นทุนต่อออเดอร์ (เบส 06-12 — ห้ามเพิ่มช่องเงินใน flow ผลิต/outsource) · DTF auto-nesting (RIP ทำ) · online designer เต็มรูป (เว็บสกรีน = เลือก/อัปโหลด + ดีไซเนอร์ช่วย) · in-app chat (LINE) · ใบกำกับอย่างย่อ · time-clock/payroll (hr-platform-v2) · WMS/PR-PO-GRN (Anajak Stock) · mockup generator · CMMS · courier API booking · รายงาน ม.87(3)

## ✅ ด่านก่อนเคลมเสร็จ (ทุกงาน)
`npm run typecheck` · `npm run lint` (0 error) · `npm test` · `npm run verify:ui` (คงด่านข้อมูล/การเข้าถึง; เมื่อเปลี่ยน contract ที่อนุมัติ ให้ปรับข้อคาดหวังที่เกี่ยวและตรวจพฤติกรรมในชุดเดียวกัน; heuristic หน้าตาเป็นคำเตือน) · งาน UI เปิดจอจริง 1440 + 390 ทั้ง Light/Dark · `npm run build` ก่อนขึ้น main · งานที่แตะ DB ใช้ `verify:*` บนฐาน demo เท่านั้น
