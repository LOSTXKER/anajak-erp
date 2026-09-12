# Anajak ERP — SPEC (อะไรคือ "เสร็จ")
> ข้อกำหนดถาวรและเกณฑ์ยอมรับ · ภาพรวมและผู้ใช้ดู [README.md](README.md) · งาน ผลตรวจ และข้อที่ยังไม่ยืนยันดู [ROADMAP.md](ROADMAP.md)
> เอกสารนี้ไม่รับรองว่าแต่ละข้อผ่านการตรวจในรุ่นปัจจุบัน; ตรวจพฤติกรรมที่เกี่ยวก่อนเคลมเสร็จ

## เป้าหมาย
ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak — ทีม 5 คน + เจ้าของ จัดการ ขาย → ออกแบบ/อนุมัติ → ผลิต/ส่งร้านนอก → QC → ส่ง → บิล/ภาษี/ลูกหนี้ ของลูกค้า B2B ครบวงจร · ออกเอกสารภาษีเต็มรูปเอง · เชื่อม Anajak Stock · โครงต้องรองรับออเดอร์จากเว็บสกรีน (ธรรมดา + custom) โดยไม่ทำทางแยก (เบสย้ำ 2026-09-02)

## 💰 กฎเหล็กข้อมูล
- **เงินทุก field = `Decimal(12,2)`** · คำนวณผ่าน `Prisma.Decimal` (`services/money.ts` round2 half-up) · แปลงเป็น number ที่ขอบเดียว `lib/prisma.ts` · aggregate `_sum` ต้องเรียก `aggToNumber` เอง
- **เลขเอกสารรันต่อเนื่อง** `nextDocumentNumber()` (`services/document-number.ts`) ใน `$transaction` เดียวกับการสร้างเอกสาร · ทุกชนิด ORD/INV/REC/CN/DN/QT/BN/FR · import เอกสารเก่าต้อง seed lastNumber ก่อน
- **สถานะออเดอร์เปลี่ยนผ่าน `transitionOrder()`** (`services/order-status.ts`) จุดเดียว — validate + optimistic lock + `OrderRevision` · direct write มีแค่ค่าเริ่มต้นตอน create
- **การเงินหลายขั้น = `$transaction` + `SELECT FOR UPDATE`** (`src/server/services/billing-payment.ts` และ `src/server/routers/billing.ts`) · เพดานสองขา `billedFloor` / `assertOrderTotalCoversBilled` · ใบเสร็จผูกงวดรับเงิน 1:1 (`forPaymentId @unique` · ยอดเท่าเงินรับ · `issueDate` = วันรับเงินจริง)
- **สูตรยอดออเดอร์**: `total = max(0, items + fees - discount + tax)`; `platformFee` ไม่เข้ายอดหรือฐาน VAT เพราะเป็นเงินที่ marketplace หักจากร้าน. สูตรเขียนอยู่ `src/server/services/pricing.ts`; preview ที่ `src/lib/pricing.ts` ต้องให้ผลตรงกัน
- **ใบกำกับ/ใบวางบิล ยกเลิก-ออกใหม่เท่านั้น** ไม่มี `delete` · soft-void + guard กัน void ซ้ำ · CN/DN ผูกใบเดิม + เหตุผลบังคับ (ม.86/10) และหักยอดค้างจริงทุกทาง
- **การเก็บเอกสารภาษี**: คงเอกสารครบ 5 ปีตามข้อกำหนดโครงการเดิม และต้องกู้คืนข้อมูลพร้อมไฟล์ได้; วิธีสำรองและขอบเขตของ export อยู่ README

## 🔐 ความปลอดภัย + สิทธิ์
- คนนอกเข้าไม่ได้ — `src/proxy.ts` refresh session ทุก request · ยกเว้นเฉพาะหน้า public token (`/approve` `/upload` `/status` `/quote` `/job`) + `/api/mcp` (auth ด้วย key) · มี Proxy regression test
- auth fail-closed (ไม่มี dev-OWNER fallback) · `requireRole` ครบทุก mutation · router public token 5 ตัวโดยเจตนา
- **สิทธิ์รายคน (PERM)** `lib/permissions.ts` — role = ชุดสิทธิ์เริ่มต้น + override รายคน · มีผลทั้ง server/จอ/print/MCP key · OWNER active ≥ 1 เสมอ
- role หน้างานไม่เห็นทุน/กำไร (`lib/roles.ts`) · Station/Factory DTO ไม่มีเงินโดยโครงสร้าง (explicit select/mapper)
- security headers ทุก route · CI lint+typecheck+vitest เมื่อ push main และทุก PR · สำรองข้อมูล export JSON ในแอป (ตั้งค่า → สำรองข้อมูล)

## 📋 Flow หลัก — เกณฑ์เสร็จต่อ flow
- **เปิดออเดอร์** `/orders/new` → เลข `ORD-YYMM-NNNN` + AuditLog · ประเภท READY_MADE / CUSTOM · เสื้อ 3 แหล่ง (FROM_STOCK / CUSTOM_MADE / CUSTOMER_PROVIDED) → ใบผลิตเสนอขั้นตามแหล่ง + เทคนิค · ฟอร์มเดียวใช้ทั้งสร้างและแก้ · ที่อยู่ผู้ติดต่อแยกจากที่อยู่จัดส่ง
- **ยืนยันออเดอร์มีสต๊อก** → จอง Anajak Stock อัตโนมัติ + ด่านวงเงินเครดิต (`assertSalesWithinCreditLimit`) · จองพลาด → กระดิ่ง + retry
- **ใบเสนอราคา** → ลูกค้ากดยอมรับผ่าน `/quote/<token>` → แปลงเป็นออเดอร์ (กันซ้ำ · ด่าน ACCEPTED/ไม่หมดอายุ) · VAT default 7% (marketplace ราคารวม VAT → 0)
- **portal ลูกค้า (token · ไม่ต้อง login)**: อนุมัติแบบ `/approve/design` · สถานะ `/status` (ไม่รั่วราคา/ต้นทุน/internalStatus) · อัปโหลด `/upload` (signed · server เลือก path) · ใบงานร้านนอก `/job` (LINE-friendly · หมดอายุ 90 วัน · fail-closed)
- **ม็อกอัพ**: หนึ่งเวอร์ชันหลายรูป (หน้า/หลัง/แขน + ตำแหน่งพิมพ์ต่อรูป) · ลูกค้าอนุมัติทั้งชุดครั้งเดียว · ไฟล์ที่เบราว์เซอร์แสดงไม่ได้ต้องแนบรูปตัวอย่าง · จัดการที่แท็บ "ม็อกอัพ & ไฟล์" ที่เดียว จอที่เหลืออ่านอย่างเดียวจาก component ชุดเดียว
- **outsource** ผูกขั้นผลิต → OutsourceOrder (ล็อกแถว) SENT → RECEIVED_BACK → ตรวจรับ (ก่อน QC สุดท้าย) · เจ้าหน้าที่คุยร้านผ่าน LINE ด้วยลิงก์ `/job`
- **ผลิต → QC → แพ็ก → พร้อมส่ง → ส่ง**: ผลิตครบทุกใบจึงเข้า QC · QC เชิงนับ bypass ไม่ได้ (guard ใน `$transaction` เดียวกับ transition) · ใบส่งครบจึง READY_TO_SHIP · delivery มี state machine + tracking ทุกสถานะ · แบ่งกล่องได้ · RETURNED → กระดิ่ง
- **goods receipt + รอบพิมพ์ DTF (ฟิล์ม FR-) + คลังฟิล์ม** · `issueMaterials` atomic + อ่าน MaterialUsage กลับได้ · สินค้า soft-delete (`deletedAt`) เก็บประวัติ
- **บิล → ชำระ → WHT 50ทวิ อัตโนมัติ** (นิติบุคคลหัก 3%) · ใบวางบิลรวม + ลูกหนี้ aging + dunning (cron mark OVERDUE · fail-closed `CRON_SECRET`) · REC รับเงินได้เฉพาะขายสดไม่มีใบเรียกเก็บ · CN ห้ามรับเงิน
- **พิมพ์เอกสารจริง**: ใบกำกับ ม.86/4 (ต้นฉบับ + สำเนา · void มีลายน้ำ) · ใบเสนอ · ใบวางบิล · ใบสั่งงาน · ใบรายการสินค้า — A4 · light-only · grayscale-safe
- **รายงานภาษีขายรายเดือน** `/billing/tax` export CSV (ฟอร์มสรรพากร พ.ศ. + template import PEAK) — มติตัด GL ยืนบนข้อนี้
- **CRM ใช้จริง**: แก้ลูกค้าครบ field · บันทึกการคุย · pagination/ค้นหา · หน้า `/settings` ไม่มีฟอร์มปลอม · sidebar/ปุ่ม gate ตามสิทธิ์ตรง server
- **เชื่อม Anajak Stock** (test/sync/issue/receive · ตั้งค่าที่ Settings → Stock; ใช้ env เป็น fallback) + **MCP** `/api/mcp/[transport]` (agent key · เคารพสิทธิ์) + cron ปลดจองค้าง

## 🏭 Production V2 — ERP/MES หนึ่งข้อมูลจริง
- **แกน Manufacturing**: `Production` = Manufacturing Order · `ProductionStep` = Operation Job (คง ID/FK เดิม) · routing มี version + immutable หลัง release · dependency ขนาน · snapshot ตอน release · quantity line ต่อ สินค้า/สี/ไซซ์/จุดพิมพ์ · `OperationEvent` append-only · exception/rework ตรวจย้อนได้ · ทุก lane รวมที่ Final Pack เดียว
- **command ปลอด retry**: `commandId` + `expectedRevision` · lock order ชุดเดียว · readiness/dependency/`availableCommands` คำนวณที่ server · เฉพาะ `qtyGood` เดินต่อ · reject ต้องมี disposition · rework ต้องตรวจซ้ำ
- **บ้านละหน้าที่**: `/production` คิวหัวหน้า; `/production/[id]` ดูและลงมือตามสิทธิ์; `/production/floor` งานของพนักงาน; `/factory` TV อ่านอย่างเดียว. ปุ่ม/สิทธิ์ใช้ controller และ readiness เดิม; DTF ผ่าน batch, handoff ผู้ใช้กดเอง, scan เปิด context เท่านั้น. Order/My Tasks ใช้ summary และ deep link ไปงานจริง
- **สูตรขั้นงานเป็นข้อมูล ไม่ใช่โค้ด**: seed สูตรมาตรฐาน Anajak (`prisma/seed.ts` · idempotent) + หน้าตั้งค่า `/settings/routings` (เวอร์ชันที่ใช้แล้วแก้ไม่ได้ → คัดลอกเป็นร่างใหม่ · `services/routing-template.ts` + test) · ขั้นไหนก็ส่งร้านนอกได้ (`executionMode` รายขั้น) · งานร้านนอกเดินขนานกับ DTF · "ตรวจของกลับจากร้าน" เป็นขั้นในสูตร แทนกฎเดิม "รีดร้อนรอร้านนอกทุกสายจบ" (เบสเคาะ 2026-09-01)
- **หลังเปิดใบผลิต** นิยามสินค้า/สี/ไซซ์/จุดพิมพ์ + หลักฐานรับเสื้อบน Order เป็น read-only. Writer ต้องอ่าน ownership หลัง topology/order lock เพื่อไม่ใช้ snapshot เก่า. Final Pack ครบทุก enabled operation จึง READY_TO_SHIP; การส่ง/tracking ใช้ Delivery (`ship_orders`). `order.updateStatus` ต้องตรวจ ownership ของ record หลัง lock และปฏิเสธสถานะผลิต/พัก/ยกเลิกที่มีเจ้าของ flow แม้ flag ปิด; SHIPPED → COMPLETED ยังผ่าน state machine และด่านวางบิล
- **Snapshot และจำนวน**: routing/instruction/approved mockup ถูกตรึงเมื่อ release; dependency ต้องผ่าน cycle validation และทุก lane มี Final Pack terminal เดียว. quantity แยกสินค้า/สี/ไซซ์/ตำแหน่งพิมพ์ planned/good/scrap/rework. DTF commit ตรวจสมาชิกและ revision ครบทั้งรอบ รายงานต่อ quantity line; standard time ยังไม่มีให้แสดง “ยังไม่ประเมิน”
- **เปิดใช้จริง (PV2.8)**: ซ้อมหัวหน้าและพนักงานบนฐาน demo ผ่านจอสถานีจริงครบ flow รวม DTF ที่ผูกรอบพิมพ์และ quantity line → ระบุฐานเป้าหมาย/backup → seed routing + work center แบบ additive → เปิด `PRODUCTION_V2_ENABLED` ทีละขั้นและตรวจผล → ถอน legacy UI/writer ตามช่วง rollout ที่อนุมัติ. เบสอนุมัติแต่ละขั้น; งานจัดเอกสาร/หน้าตาไม่เปิด flag หรือ apply migration. สถานะการซ้อมและ cutover อยู่ ROADMAP

## 🎨 UI และการใช้งาน
ทิศภาพและชิ้นส่วนจริงอยู่ [DESIGN.md](DESIGN.md); งานที่อนุมัติอยู่ ROADMAP. ใช้ ui-guidance กับงาน UI: คำช่วยที่จำเป็นต่อการตัดสินใจ ลงมือ หรือแก้ผิดต้องอยู่ตรงจุดใช้; แต่ละรายการอิสระมีคำสั่งหลักของตัวเองได้. การปรับหน้าตาคงเงิน สถานะ สิทธิ์ query/command หลักฐาน เอกสารพิมพ์ และทางกู้คืน. การเปลี่ยน token/contract ต้องแก้การตรวจที่เกี่ยวและลองภารกิจจริงในชุดเดียวกัน; heuristic ด้านหน้าตาเป็นคำเตือนให้ทบทวน ไม่ใช้จำนวนจุด/ความยาว/ชื่อคลาสตัดสินคุณภาพ

### เกณฑ์การใช้งานที่ต้องคงไว้
- UI ใช้ tRPC/service/permission ชุดเดิม; loading/error/retry/empty/สิทธิ์แยกกัน ข้อมูลสรุปยังไม่มาไม่แสดงเลข 0 และ background error ไม่ทิ้งข้อมูลที่โหลดแล้ว. ทางค้นหาว่างล้างตัวกรองได้; แท็บ/ค้นหา/เรียง/แบ่งหน้าคง URL, Back และข้อมูลที่ยังไม่บันทึก
- เปิดรายละเอียดใหม่เริ่มบนสุดของพื้นที่งาน; Back คืนตำแหน่งรายการหลังข้อมูลโหลดครบโดยไม่แย่งการเลื่อนของผู้ใช้. การสลับแท็บคงค่าที่ยังไม่บันทึก; ล้างเฉพาะค่าของ request ที่ server ยืนยันแล้ว ไม่ให้ค่าที่บันทึกค้างทับข้อมูลจากการอ่านรอบใหม่
- ราคาสินค้าที่แก้อัตโนมัติเมื่อออกจากช่อง: ค่าว่างไม่ใช่ 0, Esc ทิ้งเฉพาะค่าที่ยังไม่ส่ง, pending/error อยู่ตรงช่อง และคำเตือนออกหน้าต้องไม่อ้างว่ายกเลิก request ที่ส่งแล้วได้. ใบเสนอราคาแสดงยอดที่บันทึกไว้; เมื่อผลรวมรายการต่างจากยอดก่อนส่วนลด/ภาษีให้บอกความต่าง ไม่สร้างชื่อค่าบริการหรือแก้ยอดเอง
- ใบอ้างด้วยเลขที่และลูกค้า; สิ่งที่ทำคือรายการงาน (`OrderItem.description`). ไม่คืนคอลัมน์ `orders.title` / `quotations.title` ที่ถอดออกแล้ว
- `/production` เป็นตารางต่อเนื่อง ไม่มีหัวแบ่งสถานะหรือกำหนดส่งในตาราง (A10–A11). ตัวกรองอยู่นอกตาราง สถานะ/ปัญหาอยู่ในแถว; มือถือรวมบริบทใบ/กำหนดส่ง/ขั้นไว้ใกล้กันและเลื่อนเฉพาะตาราง. ปัญหา = FAILED/ON_HOLD/ตรวจรับร้านไม่ผ่าน/ไม่ผ่านด่านเปิดใบ ไม่เหมารวมแค่เลยกำหนดหรือรอขั้นก่อน
- หัวหน้าดู วางแผน ลงมือ แก้ปัญหา และมอบหมายจาก `/production/[id]` ได้ครบตามสิทธิ์. พนักงานใช้ `/production/floor`; ปุ่มและ dialog อ่าน controller ชุดเดียวกัน. แยกการเลือกดูขั้นจากการเริ่มทำและแยกพร้อมทำจากกำลังทำ; งานคู่มีข้อมูลและคำสั่งของแต่ละขั้น
- ใบผลิตแสดงสินค้า/รูป/ลายครั้งเดียวต่อกลุ่มและยอดต่อไซซ์. `OperationQuantity` แถว VARIANT เก็บทำแล้ว/เสีย ยอดขั้นเป็นผลรวม; เช็คลิสต์ `ProductionStepCheck` เก็บผู้ติ๊กและเวลา; ปิดขั้นผ่าน `updateStep` ต้องผ่านเช็คลิสต์ฝั่ง server. ขั้นร้านนอก/รอบพิมพ์/ใบตรวจรับคง flow หลักฐานเฉพาะ; ขั้นอื่นปิดด้วยปุ่มรวมขั้นที่เดิมจดกระดาษ ไม่ตีความว่าขั้นเก่าที่ปิดแล้วมีผู้ติ๊กครบเอง
- ปุ่มลงมืออยู่ใกล้ข้อมูลที่เปลี่ยน (A14); หากยังไปต่อไม่ได้ต้องเห็นเหตุและทางไปทำสิ่งที่ขาด. เมนูรองเก็บงานที่ใช้น้อยและคงทางพักขั้น/ย้อนกลับ/ดูประวัติ; ส่งเข้า QC ได้เมื่อทุกขั้นปิดครบ. `pairWithPrevious` คงการจับคู่จากสูตรและกล่องเปิดใบ; `production.reopenStep` เฉพาะหัวหน้า ขั้นปิดด้วยปุ่ม และขั้นถัดไปยังไม่เริ่ม
- GARMENT_RECEIVE รับไม่ครบแล้วบันทึกได้ ยอดเหลือรอรอบหน้า; ใช้ `goodsReceipt.context/create/confirmCustomerGarmentEvidence` พร้อม idempotency/สิทธิ์เดิม. ใบผลิตนับในกล่องขั้น (A14.3); หน้าออเดอร์/สถานีใช้กล่องใบตรวจรับเดิมได้
- แก้ยอดตรวจรับผิด (A15) = หัวหน้ากรอกยอดถูกต่อไซซ์และเหตุผลผ่าน `goodsReceipt.correctCustomerGarment`. ออกหลักฐานส่วนต่างจริง (เกินเป็นใบคืน ขาดเป็นใบรับเพิ่ม); ยอดครบคงปิด ไม่ครบกลับ IN_PROGRESS; audit เก็บเหตุผลและแถวที่แก้. การคืนปกติหลังเปิดใบผลิตยังถูกกันตามเดิม
- `production.create` ไม่ปิด GARMENT_RECEIVE ให้เองแม้มีใบรับครบอยู่ก่อน (A13); ต้องยืนยันหลักฐานโดยผู้ใช้. ขณะทำใบตรวจรับจริงนับครบทุกไซซ์ `goods-receipt` ยังปิดขั้นได้ตามเดิม โดยไม่บังคับกดซ้ำ
- ใบสั่งงานพิมพ์จาก production ที่ถูกต้อง; คงวันพิมพ์/เวอร์ชันม็อกอัพและ QR `?mockup=n` พร้อมแจ้งเมื่อเปิดใบเก่า. ต้องแยกหลักฐาน “ถือว่าผ่าน” ของข้อมูลเก่าจากผลทำจริง ไม่เขียนประวัติขึ้นเอง
- Prompt และ semantic tokens เป็นชุดปัจจุบัน; ปรับร่วมกันได้ตามขอบเขตที่อนุมัติ. ข้อความไทยไม่ตัดสระ/วรรณยุกต์, mobile input 16px, เป้ากด mobile/coarse 44px และ desktop 36px, WCAG AA ทั้งสองธีม, keyboard/focus/reduced-motion และไม่ซ้อน interactive elements
- การนำทาง Sidebar/Command Palette ใช้ registry `src/lib/navigation.ts` และสิทธิ์เดียวกัน; active route เลือก exact/longest match. เมนูย่อมี accessible name; deep link/Back คงงานเดิม. การออกจากฟอร์มผ่าน `requestAppNavigation` ต้องเคารพข้อมูลที่ยังไม่บันทึก
- Query แยก initial loading/error/empty จาก background error/stale และ success; error มี retry/การประกาศที่ทำงานจริง. Skeleton ใกล้โครงจริงและสถิติใช้ loading จนมีค่า. `useListPageState`/`usePageClamp` คงค้นหา/ตัวกรอง/เลขหน้าใน URL และกลับหน้า 1 เมื่อผลลดเหลือ pages=0
- ฟอร์มมี label และ error/help เชื่อม control ด้วย aria; pending กันส่งซ้ำและแสดงกำลังทำ/aria-busy; success อิง server. `NumberInput`/`MoneyInput` แยกว่างจาก 0; วันที่ใช้ Asia/Bangkok. แท็บ lazy และใช้ keepMounted เมื่อจำเป็นรักษาฟอร์ม. ใช้ `useConfirm`/`usePromptText` แทน window.confirm/prompt
- Dialog มี title/description ตามงาน, gutter/max-height/body scroll, Escape/focus trap และคืน focus ที่เหมาะ; คำสั่งจำเป็นไม่พึ่ง hover. คำช่วยเสริมเปิดด้วย keyboard/tap ได้; validation/สิทธิ์/ผลสำคัญไม่ซ่อนใน tooltip. Dashboard มี skip link ไป `main-content`
- ตรวจ 390/1440px และ 1024px เมื่องานทัชเกี่ยว; document ไม่ล้นแนวนอน ตารางเลื่อนภายในได้พร้อมสื่อว่ามีคอลัมน์ต่อ. สีต้องมีข้อความ/สัญลักษณ์ประกอบ; micro 11px ใช้เฉพาะ status/counter มีบริบท ไม่ใช้กับ label/คำช่วย/action. ปุ่ม/การลากที่แสดงต้องทำงานจริง ไม่เติมตัวเลข/owner/เวลา/ความจุที่ไม่มีแหล่งข้อมูล

### ม็อกอัพและไฟล์ที่ใช้ร่วมกัน
- `DesignVersion`/`DesignVersionFile` คง ID/token/audit contract. แท็บม็อกอัพและไฟล์ของออเดอร์เป็นบ้านจัดการเดียว; `src/components/mockup/` มี `MockupPanel` จัดการ, `MockupGallery` อ่าน, `MockupThumbnail` รูปปก และ `OrderMockupHandoff` พาไปบ้านจริง. ใบผลิต/สถานีอ่านอย่างเดียว ไม่เปิด writer อัปโหลดหรืออนุมัติซ้ำ
- อ่านภาพผ่าน `src/lib/mockup.ts`: `mockupImages`/`mockupCoverImage`/`orderMockupCover`. ข้อมูลเก่า `files` ว่าง fallback `fileUrl` โดยไม่ backfill จาก UI; รูปลายที่ใช้ช่วยจำออเดอร์ต้องไม่อ้างว่าเป็นแบบอนุมัติ. ไม่มีม็อกอัพบอกตามจริง
- ไฟล์ที่ browser ดูไม่ได้ต้องแนบรูปตัวอย่างก่อนส่งลูกค้า; router design ใส่ approval token ให้ภาพทุกไฟล์ผ่าน `withFileToken` (`src/lib/file-urls.ts`) และ `/api/files` ตรวจสิทธิ์เดิม. สถานีคง “ห้ามวางตำแหน่งจากภาพนี้”; ลิงก์/กระดาษรุ่นเก่าต้องบอกว่าไม่ใช่แบบล่าสุด

### คิวผลิต สถานี และหลักฐานหน้างาน
- readiness/waitingOn/availableCommands/blockedReason/กำหนดส่ง/จำนวนที่ทำได้อ่าน controller/service เดิม. `src/components/production/work-order-controller.tsx` ใช้ร่วมใบผลิตและ floor; presentation ไม่สร้าง lifecycle หรือกฎคู่ขนาน. กดเลือกดูขั้นไม่ใช่เริ่มงาน. จำนวนภาพรวม `/production` ไม่ขึ้นกับผลกรอง
- `GARMENT_PICK` ผ่าน Stock; `GARMENT_RECEIVE` ผ่าน Goods Receipt evidence; DTF ผ่าน Print Run/batch; `HEAT_PRESS` คง `evaluateHeatPressGate`. QC และ Final Pack ใช้ขั้นตอนเฉพาะและเป็นคนละด่าน; `PACKAGING` เก่าเก็บอ่านเท่านั้น ไม่เสนอขั้นใหม่และ recovery กลับเข้า QC
- พนักงานทำงานของตน/ยังไม่มอบหมาย; `supervise_operations` ควบคุมข้าม owner. Mutation fail-closed จนรู้สิทธิ์และข้อมูลที่ใช้เขียนไม่ stale. การตัดสิน QC ร้านนอกต้องมี `manage_production` และ `supervise_operations`; ใบตรวจรับของกลับเป็นหลักฐานคนละอย่างกับการผ่าน QC/ปิดขั้น. Mark-ready ต้องมี `manage_production` และ `update_order_status_production`; การสร้างใบส่ง/ยืนยันส่งยึด `ship_orders` ตาม router delivery
- แจ้งปัญหาให้ server derive work center/source จาก step; คง transaction/lock/audit/notification. การแก้ยอด/ย้อนขั้นใช้คำสั่งที่ระบุใน SPEC และหลักฐานจริง ไม่ set status เพื่อทำให้จอดูง่าย
- Scan/QR เปิดบริบทเท่านั้น ไม่ claim/start/complete/pack; หลายใบผลิตให้เลือก record. Handoff ผู้ใช้เลือกเอง คง exact order/production context ไม่เดาสถานี. `factory.stationQueueContext` อ่าน snapshot ไม่มีเงินของ record ตรง ไม่พึ่งคิวรวม `take: 200`; หลัง mutation ต้อง sync ก่อนเสนอทางต่อและไม่พา Back ไปขั้นเก่าผิดบริบท
- คิวสดคง polling/focus/reconnect ตาม query; TV เก็บ snapshot ล่าสุดและแจ้ง stale เมื่ออ่านพลาดหรือข้อมูลเก่ากว่า 2 นาที. `/factory` อ่านอย่างเดียว ไม่มี mutation/link/button ลงมือ. Order/My Tasks สรุปและ deep link ไป record จริง
- Worklist/ใบผลิต/print run/film/outsource ไม่เพิ่มราคา/ค่าจ้าง/ยอดออเดอร์. Station/TV DTO ไม่ส่งหรือ render เงินแม้ OWNER, ไม่ mount MaterialUsage หรือส่ง shipping cost; ส่วน recovery วัตถุดิบเดิมใน ERP ยังต้องมี `see_finance`

### Public และเอกสารพิมพ์
- Public/print ใช้ light-only. Public token ใช้ `src/components/public/public-page.tsx` และข้อมูลตามสิทธิ์ token; blind-ship ไม่เปิดแบรนด์/ตัวตนร้าน. `PublicLinkError` แยก network failure จาก token เสีย/หมดอายุ มี retry/ช่องทางติดต่อที่ใช้ได้จริงโดยไม่เปิดข้อมูลภายใน
- Print ใช้ `src/components/print/print-document.tsx` และ `DocHeader` ร่วมกัน: A4, อ่านขาวดำได้, คงข้อความกฎหมาย/ยอด/ต้นฉบับ-สำเนา/ลายน้ำยกเลิก/ลำดับหน้า/สิทธิ์/blind-ship. ตรวจ quotation, invoice, billing-note, job-ticket, packing-list จริงก่อนรับการเปลี่ยน primitive พิมพ์; ไม่กวาดค่าหน้าจอมาทับ surface กระดาษ

## 🚦 เกณฑ์ก่อนเปิดใช้งานจริง
- **B6** นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน จากเอกสารพิมพ์จริง
- **B16** walkthrough ของจริงกับทีม + นักบัญชีเห็นเอกสารเงินพิมพ์จริง 1 รอบ (audit ทำจากโค้ด — คะแนน UX เป็นสมมติฐานจนกว่าจะลองจริง)
- **console checklist** Supabase/Vercel → [README.md](README.md#ตรวจสภาพแวดล้อมก่อนขึ้นใช้จริง); ผลตรวจรวมการปิด public signup และส่วนที่ยังไม่ยืนยันดู ROADMAP
- **PV2.8** cutover Production V2 (ด้านบน)

## 🚫 นอกขอบเขต
GL/บัญชีแยกประเภท/งบการเงิน (นักบัญชี + PEAK) · job costing/ต้นทุนต่อออเดอร์ (เบส 06-12 — ห้ามเพิ่มช่องเงินใน flow ผลิต/outsource) · DTF auto-nesting (RIP ทำ) · online designer เต็มรูป (เว็บสกรีน = เลือก/อัปโหลด + ดีไซเนอร์ช่วย) · in-app chat (LINE) · ใบกำกับอย่างย่อ · time-clock/payroll (hr-platform-v2) · WMS/PR-PO-GRN (Anajak Stock) · mockup generator · CMMS · courier API booking · รายงาน ม.87(3)

ไม่ทำ anomaly detection, capacity planning เต็ม (ใช้ปฏิทินภาระงานเบา) หรือ Block reuse/BOM เต็ม (ไม่มีงานทำบล็อกในบ้าน)

## รองรับเว็บสกรีนเสื้อและระบบอื่น
ออเดอร์จาก `anajak-print-web` ทั้งธรรมดาและ custom ต้องใช้ order/garment source/design version/approval token/payment terms เดียวกับหน้าร้าน; ไฟล์เข้า pipeline เดิม สูตรราคาเป็น service เรียกซ้ำได้ ไม่เพิ่มสถานะหรือ flow แยก. MCP/API ใช้สิทธิ์เดียวกับแอป. งานเชื่อมต่อที่ยังไม่ทำอยู่ ROADMAP

## ✅ ด่านก่อนเคลมเสร็จ (ทุกงาน)
`npm run typecheck` · `npm run lint` (0 error) · `npm test` · `npm run verify:ui` (คงด่านข้อมูล/การเข้าถึง; เมื่อเปลี่ยน contract ที่อนุมัติ ให้ปรับข้อคาดหวังที่เกี่ยวและตรวจพฤติกรรมในชุดเดียวกัน; heuristic หน้าตาเป็นคำเตือน) · งาน UI เปิดจอจริง 1440 + 390 ทั้ง Light/Dark · `npm run build` ก่อนขึ้น main · งานที่แตะ DB ใช้ `verify:*` บนฐาน demo เท่านั้น

ลองทางสำเร็จและทางติดขัดที่เกี่ยว; flow หลักให้ผู้ตรวจที่ไม่ได้ออกแบบลองโดยไม่บอกตำแหน่งปุ่ม. บันทึกหน้า/บทบาท/สิ่งที่ลอง/ผล/ส่วนที่ยังไม่ตรวจใน ROADMAP. Typecheck/build/screenshot อย่างเดียวไม่ยืนยันว่าผู้ใช้ทำงานจบได้
