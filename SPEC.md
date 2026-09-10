# Anajak ERP — SPEC
> สิ่งที่ต้องจริงถึงเรียกว่าเสร็จ · AI verify ข้อที่เกี่ยวก่อนเคลม done · เปลี่ยน spec = แก้ที่นี่ก่อนเขียนโค้ด
> `[x]` = มีโค้ด/เทสต์รองรับแล้ว ห้ามถอย · `[ ]` = ยังเปิด (งานอยู่ `ROADMAP.md`) · หลักฐานรายรอบเดิม `git show 42c408a:SPEC.md` · สัญญาหน้าผลิตฉบับเต็ม `git show 42c408a:docs/production-contract.md`

## เป้าหมาย
ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak ให้ทีม ~5 คน + เจ้าของทำงานครบวงจรในระบบเดียว: ขาย → ออกแบบ/อนุมัติ → ผลิต/ส่งร้านนอก → QC → ส่ง → บิล/ภาษี/ลูกหนี้ ของลูกค้า B2B · ออกเอกสารภาษีเต็มรูปและหัก ณ ที่จ่ายเอง · เชื่อม Anajak Stock · รองรับออเดอร์จากเว็บสกรีน (ธรรมดา + custom) โดยไม่ทำทางแยก · ซ่อมต่อบนโครงเดิม ไม่รื้อ (กรอบที่เบสเคาะ 2026-06-10 · เป้าหมาย 4 ข้อใน `AGENTS.md`)

## เกณฑ์เสร็จ

### เงินและเอกสารภาษี
- [x] เงินทุกช่อง `Decimal(12,2)` · คำนวณ Decimal + `round2` half-up (`src/server/services/money.ts`) · แปลงเป็น number ที่ขอบเดียว `src/lib/prisma.ts` · aggregate ใช้ `aggToNumber`
- [x] ยอดออเดอร์ = สูตร A (`src/server/services/pricing.ts`): `totalAmount = max(0, subtotalBeforeTax + taxAmount)` · `platformFee` ไม่เข้ายอดและฐาน VAT · preview ฝั่ง client `src/lib/pricing.ts` ให้ผลเท่ากัน (test คู่) · VAT ค่าเริ่มต้น 7% (ช่องทาง marketplace ราคารวม VAT → 0)
- [x] เลขเอกสาร `PREFIX-YYMM-NNNN` (เดือนตาม Asia/Bangkok) รันต่อเนื่องผ่าน `nextDocumentNumber()` ใน transaction เดียวกับการสร้าง ทุกชนิดใน `src/server/services/document-number.ts`
- [x] สถานะออเดอร์เปลี่ยนผ่าน `transitionOrder()` จุดเดียว: validate + optimistic lock + `OrderRevision` · เขียนตรงได้แค่ค่าเริ่มต้นตอนสร้าง
- [x] เงินหลายขั้น `$transaction` + `FOR UPDATE` (`src/server/routers/billing.ts`) · เพดานสองขา `billedFloor` / `assertOrderTotalCoversBilled` (`src/server/services/payment-plan.ts`) · ใบเสร็จผูกงวดรับเงิน 1:1 (`forPaymentId @unique`) ยอด = เงินที่รับจริงของงวด (เงินสด + WHT) · ออกทุกงวดรวมมัดจำ (จ้างทำของ) · วันที่ = วันเงินเข้าจริง (ม.78/1)
- [x] ใบกำกับ/ใบวางบิลไม่มีลบ: void + เหตุผลบังคับ แล้วออกใหม่ · กัน void ซ้ำ (`assertVoidableInvoice`) · CN/DN ผูกใบเดิม + เหตุผล (ม.86/10) และหักยอดค้างจริง · FK `onDelete: Restrict` · ข้อมูลคู่สัญญาเป็นสำเนา ณ วันออก (ม.86/4)
- [x] ลูกค้านิติบุคคลหัก 3% = บันทึกเงินสด + `whtAmount` → ทะเบียน 50ทวิ อัตโนมัติ · REC รับเงินได้เฉพาะขายสดที่ไม่มีใบเรียกเก็บ · CN ห้ามรับเงิน
- [x] เอกสารพิมพ์ `src/app/(print)/print/` (ใบกำกับ ม.86/4 ต้นฉบับ + สำเนา · void มีลายน้ำ · ใบเสนอ · ใบวางบิล · ใบสั่งงาน · ใบรายการสินค้า) A4 light-only grayscale-safe · ปรับหน้าตาได้ แต่ข้อความกฎหมาย/ยอด/ลำดับหน้าต้องคงเดิม (template ภาษียังรอนักบัญชีรีวิว B6) · รายงานภาษีขาย `/billing/tax` export CSV (ฟอร์มสรรพากร + template PEAK)

### ความปลอดภัยและสิทธิ์
- [x] `src/proxy.ts` refresh session ทุก request · ยกเว้นเฉพาะ 5 prefix ใน `src/lib/public-routes.ts` + `/api/mcp` · `/api/*` ไม่ถูก redirect · มี `src/proxy.test.ts`
- [x] auth fail-closed (Supabase ล่ม = ไม่มี session ไม่ใช่ OWNER) · สิทธิ์รายคน `src/lib/permissions.ts` (role = ค่าเริ่มต้น + override รายคน) มีผลทั้ง server/จอ/print/MCP · `manage_users` OWNER เท่านั้น · ลด role/ปิดบัญชี OWNER คนสุดท้ายไม่ได้ (`assertAnotherActiveOwner`)
- [x] Supabase auth user ≠ พนักงาน: `createContext` (`src/server/trpc.ts`) ให้ userId เฉพาะเมื่อเจอแถว `User` ที่ `isActive` · `/api/files` ปฏิเสธ session ที่ไม่มีแถว `User` active ก่อนออก signed URL — route ใหม่ห้ามเช็คแค่ session (ยังไม่มีเทสต์ · public signup ของ Supabase ยังไม่ยืนยันว่าปิด)
- [x] สิทธิ์งานผลิต: ไม่มี `manage_production` = อ่านอย่างเดียว · ตัดสินตรวจรับของร้านนอก (QC_PASSED/QC_FAILED) ต้องมี `manage_production` + `supervise_operations` · ยืนยันพร้อมส่งต้องมี `update_order_status_production` · สร้างใบส่ง/tracking = `ship_orders`
- [x] ทุน/กำไรไม่ถึงฝ่ายขาย/ช่าง (`src/lib/roles.ts`) · DTO ของสถานี/โรงงาน/หน้างานไม่มีเงินโดยโครงสร้าง แม้ role เป็น OWNER · ต้นทุนวัตถุดิบในใบผลิตเห็นเฉพาะสิทธิ์ `see_finance`
- [x] ไฟล์อยู่ bucket private `designs` อ่านผ่าน `/api/files` → signed URL สั้น · อัปโหลด `upsert: false` · ตรวจซ้ำได้ด้วย `npm run verify:supabase` (อ่านอย่างเดียว · อ่าน Supabase จริงตาม `.env`)
- [x] cron `/api/cron/overdue` + `/api/cron/stock-reservations` (`vercel.json`) fail-closed ด้วย `CRON_SECRET` · MCP `/api/mcp/[transport]` tool อ่านอย่างเดียว 4 ตัว (`src/lib/mcp/tools/`) auth ด้วยกุญแจที่เก็บเป็น sha256 เคารพสิทธิ์ผู้ถือ
- [x] security headers ทุก route (`next.config.ts` · ยังไม่มี CSP) · CI lint + typecheck + test ทุก push main/PR · สำรองข้อมูล = export JSON ทั้งฐานในแอป (OWNER · ไฟล์ใน bucket ไม่อยู่ใน export)

### ขาย → ออกแบบ → บิล
- [x] เปิดออเดอร์ `/orders/new` → เลข ORD + AuditLog · READY_MADE / CUSTOM · เสื้อ 3 แหล่ง FROM_STOCK / CUSTOM_MADE / CUSTOMER_PROVIDED · ฟอร์มเดียวสร้างและแก้ · ที่อยู่ผู้ติดต่อแยกจากที่อยู่จัดส่ง
- [x] ยืนยันออเดอร์ที่มีสต๊อก → จอง Anajak Stock อัตโนมัติ + ด่านวงเงิน `assertSalesWithinCreditLimit` · จองพลาด → แจ้งเตือน + retry · cron ปลดจองค้าง
- [x] ใบเสนอราคา → ลูกค้ายอมรับที่ `/quote/<token>` → แปลงเป็นออเดอร์ (กันซ้ำ · ต้อง ACCEPTED และยังไม่หมดอายุ)
- [x] ลิงก์ token ไม่ต้อง login: `/approve/design` อนุมัติแบบ · `/status` (ไม่รั่วราคา/ต้นทุน/สถานะภายใน) · `/upload` (signed · server เลือก path) · `/job` ใบงานร้านนอก (หมดอายุ 90 วัน · fail-closed)
- [x] ม็อกอัพ: หนึ่งเวอร์ชันหลายรูป ลูกค้าอนุมัติทั้งชุด · จัดการที่แท็บ "ม็อกอัพ & ไฟล์" ของออเดอร์ที่เดียว จออื่นอ่านอย่างเดียว · component ชุดเดียว `src/components/mockup/` + สูตรอ่าน `src/lib/mockup.ts` (เวอร์ชันเก่าที่ `files` ว่างใช้ `fileUrl`) · ไฟล์ที่เบราว์เซอร์แสดงไม่ได้ต้องแนบรูปตัวอย่าง (`canSubmitMockupSet`) · ทุกรูปติด token (`withFileToken`)
- [x] บิล → รับเงิน → 50ทวิ · ใบวางบิลรวม + ลูกหนี้ aging + dunning (cron ตั้ง OVERDUE) · CRM แก้ลูกค้า/บันทึกการคุย/ค้นหา · สินค้า soft-delete (`deletedAt`)
- [x] ไม่มีระบบชื่องาน (เบส 2026-08-30): อ้างด้วยเลขที่ + ลูกค้า · "ทำอะไร" = `OrderItem.description` · `orders.title` / `quotations.title` ลบถาวร (verify:ui ตรวจ)

### การผลิต (เว็บจริงใช้ใบผลิตแบบเดิม · V2 ปิด)
- [x] หนึ่งโมดูล สองสายตา (เบสเคาะ 2026-09-03): หัวหน้าทำครบจาก `/production` + `/production/[id]` · ช่าง (`PRODUCTION_STAFF` ไม่มีสิทธิ์หัวหน้า · `src/lib/production-surface.ts`) ถูกพาไป `/production/floor` · `/station` redirect พก query · `/factory` TV ไม่มีลิงก์/ปุ่ม/mutation · ห้ามถอดปุ่มลงมือออกจากใบผลิต (เบสท้วง 2026-09-03 "หัวหน้าต้องดูจอ 2 ที่ ยุ่งยาก")
- [x] `/production` ตารางต่อเนื่อง ตัวกรอง/ค้นหา/เรียงเก็บใน URL (เบสเคาะ 2026-09-09) · "ติดปัญหา" = ขั้น FAILED / ON_HOLD / ตรวจรับของร้านไม่ผ่าน / คิวที่ยังไม่ผ่านด่านพร้อมผลิต — ไม่นับแค่เลยกำหนดหรือรอขั้นก่อน (`src/lib/production-desk.ts`) · ตัวเลขสรุปและชิปขั้นงานนับจากทั้งกระดาน ไม่ใช่รายการที่กรองแล้ว (`deskSummary`) · ห้ามใส่ยอดเงิน/สถิติรายเดือนในแถบนี้
- [x] ใบผลิตแบบฟอร์ม (เบสเคาะ 2026-09-08): ราง `OrderStatusBar` + แท็บ ขั้นตอน/สินค้า · ทุกขั้นปิดด้วยปุ่ม · ปิดขั้น (`updateStep` → COMPLETED) ได้เมื่อติ๊กข้อกำหนดครบ — ด่านอยู่ server · ผลติ๊กเก็บ `ProductionStepCheck` (itemKey = ข้อความข้อกำหนด แก้ข้อความ = ข้อใหม่) · ช่างติ๊กได้เฉพาะขั้นของตน/ขั้นที่ยังไม่มีเจ้าของ · (เบสเคาะ 2026-09-10) ปุ่มของขั้น + "แจ้งปัญหาขั้นนี้" อยู่ท้ายกล่องขั้น · มอบหมายอยู่กล่องเช็คลิสต์ · หัวใบ = "ถัดไป: <ขั้น>" (aria-disabled กดแล้วพาไปสิ่งที่ต้องทำก่อน) + ประโยคใต้รางบอกเหตุผลเสมอ (`blockReason`) · เมนู ⋯ เหลือ พักขั้น/ย้อนกลับ/ประวัติ/แก้ยอดตรวจรับ
- [x] ขั้นที่ปิดผ่าน flow อื่น (เบิก/ตรวจรับ/รอบพิมพ์/ร้านนอก) ใช้หลักฐานของ flow นั้นแทนการติ๊ก และห้ามแสดงว่าติ๊กเมื่อไม่มีผลบันทึก
- [x] ยอดต่อแถว (ไซซ์/สี) เก็บ `OperationQuantity` แถว VARIANT · ยอดรวมขั้น = ผลบวก · ดีกับเสียแยกกัน ห้ามเติมดีให้ครบเอง (`reportPieceQty` กติกาเดียวกับ `updateStep`) · ปิดขั้นที่ลงมือเองได้เมื่อทุกไซซ์ ดี + เสีย = ยอดของแถว (`assertStepQuantitiesCounted` · `src/server/services/work-order-form.ts`)
- [x] ย้อนขั้น `production.reopenStep`: สิทธิ์ `supervise_operations` · เฉพาะขั้นที่ปิดแล้วและไม่ใช่ขั้นที่ปิดผ่านหลักฐานระบบ (FLOW_OWNED) · ไม่มีใบส่งร้าน/ใบตรวจรับ/รอบพิมพ์ผูก · ขั้นถัดไปยังไม่มีใครเริ่ม (`assertStepReopenable` ใน `src/server/services/work-order-form.ts`) · ออเดอร์ต้อง PRODUCING · กลับ IN_PROGRESS คงยอด/ผลติ๊ก + audit
- [x] ช่องคู่: `RoutingOperation.pairWithPrevious` → `ProductionStep.pairWithPrevious` ตอนเปิดใบ · รางรวมเป็นช่องเดียว (`src/lib/work-order-rail.ts`)
- [x] `production.sendToQc` รับเฉพาะใบที่ทุกขั้นใน workflow COMPLETED — ไม่ปิดขั้นค้าง ไม่แต่งยอด · ใบ V2 ถูกปฏิเสธ (ต้องผ่านคำสั่ง Manufacturing) · ออเดอร์เข้า QC เมื่อใบผลิตทุกใบจบ · QUALITY_CHECK → PACKING ตรวจหลักฐานนับ QC (`assertQcReadyForPacking`) ใน `$transaction` เดียวกับ transition
- [x] ตรวจรับเสื้อลูกค้า (เบสเคาะ 2026-09-10): `production.create` สร้างขั้นเป็น "รอทำ" เสมอ ยกเว้นใบตรวจรับที่นับครบหน้างานปิดขั้นให้เอง · รับไม่ครบบันทึกได้ ขั้นยังไม่ปิด · แก้ยอดที่นับผิด = `goodsReceipt.correctCustomerGarment` (หัวหน้า + เหตุผลบังคับ) ออกใบส่วนต่างจริง (เกิน = ใบคืน · ขาด = ใบรับเพิ่ม) แล้วขั้นเดินตามยอด · กดซ้ำ key เดิมไม่ออกใบซ้ำ · ใบคืนหลังเปิดใบผลิตถูกกันยกเว้นคำสั่งนี้ · ออเดอร์ที่มีเจ้าของผลิต V2 รับเสื้อจากใบผลิตแบบเดิมไม่ได้
- [x] เสื้อลูกค้ายังไม่ตรวจรับ = ไม่ผ่านด่านพร้อมผลิต (`src/server/services/production-readiness.ts`) · หลักฐานรับขาดกั้นงานที่พึ่งเสื้อและ QC · จำนวนรับกายภาพ ≠ จำนวนใช้ผลิตได้ (ตำหนิไม่ปล่อยงาน) · `CUSTOMER_RETURN.defectQty` = ตำหนิที่คืนจริง ใบรับใหม่ห้ามเปลี่ยนความหมายใบคืนเก่า · เบิก/คืนสต๊อก atomic
- [x] DTF/ร้านนอก: รวมหลายงานต่อรอบพิมพ์ (เลข FR) · นับเฉพาะฟิล์มดี ฟิล์มเสียต้องพิมพ์เพิ่ม · ใบส่งร้าน สร้าง/ส่งจริง/รับหลายรอบ/ตรวจรับ แยกกัน · รับบางส่วนห้ามนับครบ ของเสียห้ามนับเป็นดี · ส่งร้านแล้วห้ามลงยอดหรือพิมพ์ซ้ำจากทางทำเอง · หัวหน้าส่ง DTF/รีด/CUSTOM ให้ร้านแทนได้เฉพาะยอดค้าง หลังยกเลิก/ปิดรอบพิมพ์ที่ค้าง · ขั้นเบิก/รับเสื้อส่งร้านแทนไม่ได้ (ต้องใช้เอกสารวัตถุดิบ) · รับครบแต่มีเสีย = ยืนยันเฉพาะดีแล้วเปิดใบส่งแก้ส่วนที่เหลือ (`src/server/routers/outsource.ts` · `outsource.fallback.test.ts`) · ตรวจรับของร้านอยู่ก่อน QC สุดท้าย
- [x] รีดร้อน (ใบผลิตแบบเดิม) เริ่มได้เมื่อฟิล์มพิมพ์เสร็จ + เตรียมเสื้อจบ + งานร้านนอกทุกสายจบ ("งานร้านนอกไปก่อนเสมอ") — ด่านที่ server `evaluateHeatPressGate` (`src/lib/production-steps.ts` · `production.updateStep`) · V2 ใช้ขั้น `RETURN_QC` แทน (§Production V2)
- [x] หลังผลิตมีลำดับเดียว: ผลิต → QC → แพ็ก → พร้อมส่ง · QC กับแพ็กคนละด่าน · `PACKAGING` มีไว้อ่านใบเก่า ห้ามสร้างเป็น ProductionStep ใหม่ · QC/แพ็กระบุสินค้า/สี/ไซซ์ ห้ามนับดีซ้ำไซซ์เดิม · งานแก้หนึ่งชุดต่อรอบ นับเฉพาะที่เสีย · ผลนับรายไซซ์และรอบรับคืนเก็บใน `OrderRevision` (`src/server/services/qc-ledger.ts`)
- [x] จัดส่ง: ใบส่งครบจึง READY_TO_SHIP · แบ่งกล่องได้ · รับคืนผูกใบส่ง + จำนวนจริง เปิด QC เฉพาะที่คืน · ใบส่งทดแทนมีเพดานยอดรวมและไม่ลบประวัติใบเดิม · ข้อมูลเก่าที่แยก variant ไม่ได้ → กั้นให้ผู้ดูแลจัดรายการ ไม่เดาจำนวน · QC เก่าที่มีแต่ยอดรวม → ต้องนับใหม่หนึ่งครั้ง
- [x] "แจ้งปัญหา" = คำสั่งที่ server (`reportStationProblem` รับแค่ขั้น + เหตุผล · server หา work center เอง) · ปลดผ่าน `resolveStationProblem` · คิวหน้างาน: งานติดอยู่คนละกลุ่มพร้อมเหตุจริง · ช่างเห็นเฉพาะงานของตน/ยังไม่มีคนรับ · `supervise_operations` เห็นข้ามคน (`src/lib/station-desk.ts`)
- [x] scan/QR เปิดบริบทออเดอร์เท่านั้น ไม่ claim/เริ่ม/จบเอง · ม็อกอัพบนจอหน้างานเป็นข้อมูลรองพร้อมข้อความ "ห้ามวางตำแหน่งจากภาพนี้" · คิวสด poll 30 วินาที · TV เตือนเมื่อ refresh ไม่สำเร็จเกิน 2 นาทีและคงข้อมูลเดิม
- [x] ใบสั่งงานกระดาษ `/print/job-ticket/[id]?production=` พิมพ์ม็อกอัพเวอร์ชันที่อนุมัติ + QR พก `?mockup=n` · สแกนใบที่เวอร์ชันเก่ากว่าอนุมัติล่าสุด = ใบผลิตขึ้นเตือนแดงพร้อมปุ่มพิมพ์ใหม่ (`src/components/production/work-order-page.tsx` stalePaper) — คงไว้แม้เลิก "กระดาษเป็นหลัก" (ROADMAP A5)
- [x] ยอดร่างในใบผลิตกัน refresh / ปิดแท็บ / ลิงก์ / เมนูในแอป (`src/lib/work-order-draft-guard.ts`)
- [ ] ยอดร่างรอด Back/Forward แบบ SPA (ยังไม่มีเทสต์)

### Production V2 (โค้ด + migration ครบ 2026-08-22 · ยังไม่ cutover)
- [x] `Production` = Manufacturing Order · `ProductionStep` = Operation Job (คง ID/FK เดิม) · RoutingVersion แก้ไม่ได้หลัง RELEASED · snapshot ตอน release · dependency ผ่าน cycle validation · ทุก lane รวมที่ Final Pack เดียว · quantity ต่อสินค้า/สี/ไซซ์/จุดพิมพ์ · `OperationEvent` append-only
- [x] คำสั่งปลอด retry: `commandId` (unique) + `expectedRevision` + ลำดับ lock ชุดเดียว · `availableCommands` / `blockedReason` มาจาก server · เฉพาะของดีปลดขั้นถัดไป · reject ต้องมี disposition · rework ต้องตรวจซ้ำก่อนเดินต่อ
- [x] สูตรขั้นงานเป็นข้อมูล: seed idempotent `prisma/seed.ts` + `/settings/routings` (เวอร์ชันที่ใช้แล้วคัดลอกเป็นร่าง · `src/server/services/routing-template.ts`) · `executionMode` รายขั้น (ขั้นไหนก็ส่งร้านนอกได้) · ของกลับจากร้านผ่านขั้น "ตรวจของกลับจากร้าน" (`RETURN_QC`) ก่อนรีดร้อน แทนกฎ "รีดร้อนรอร้านนอกทุกสายจบ" · งานร้านนอกเดินขนานกับ DTF (เบสเคาะ 2026-09-01 · `prisma/seed.ts`)
- [x] หลังเปิด MO นิยามสินค้า/สี/ไซซ์/จุดพิมพ์ + หลักฐานรับเสื้อบน Order เป็น read-only · `order.updateStatus`: ออเดอร์ที่มีใบสั่งผลิต V2 (`work_order_number` / `completion_owner_step_id`) เปลี่ยนสถานะจากหน้าออเดอร์ได้แค่ → COMPLETED แม้ปิด flag (อ่าน ownership หลัง lock topology + order) · Final Pack owner หาย/ไม่ตรง = fail closed (`src/server/services/packing-readiness.ts`) · capacity ที่ไม่มี standard time แสดง "ยังไม่ประเมิน" · เปิด `PRODUCTION_V2_ENABLED` แล้ว สถานะการผลิต/ส่ง (`PRODUCTION_V2_FLOW_STATUS_TARGETS` ใน `src/lib/order-status.ts`) เปลี่ยนจากหน้าออเดอร์ไม่ได้ทุกออเดอร์ ต้องมาจาก event ของ Manufacturing/Delivery · Final Pack ขึ้น READY_TO_SHIP เฉพาะเมื่อทุก operation ที่เปิดใช้จบแล้ว (`src/server/services/manufacturing-commands.ts`)
- [ ] PV2.8 cutover บนเว็บจริง (`ROADMAP.md` §B)

### UI ที่ตรวจได้
- [x] ทุกจออ่าน tRPC/service/permission ชุดจริง ไม่มีปุ่มหลอกหรือตัวเลขค้าง · loading / error+retry / ว่าง / ไม่มีสิทธิ์ แยกกัน · ข้อมูลยังไม่มาแสดง loading ไม่ใช่ 0 · dialog mount แบบมีเงื่อนไข · interactive ไม่ซ้อนกัน
- [x] 390 และ 1440 px ไม่เลื่อนแนวนอน (ตารางเลื่อนในกรอบตัวเอง) · เป้ากด ≥44px บนมือถือ/จอทัช 36px บน desktop (`src/components/ui/control-size.ts`) · WCAG AA ทั้งสองธีม · reduced-motion · หน้า public/print light-only
- [x] โครงหน้า: เมนูซ้ายไม่มีสี ปุ่มหุบ/กางอยู่แถวตรา · มือถือ bottom nav 4 รายการ + "เพิ่มเติม" · สีหมวด = ไอคอนสีไม่มีกล่อง (เบส 2026-08-31) · หน้าออเดอร์ `/orders/[id]` หัวใบมีแค่สถานะ + CTA · แท็บจำใน URL และ Back ใช้ได้ · แท็บภาพรวมเห็นลาย/ม็อกอัพทันที
- [x] `npm run verify:ui` ผ่าน (token · ratchet ลำดับสายตา · โครงใบผลิต)

### Gate ก่อนใช้จริง
- [ ] B6 นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน จากเอกสารพิมพ์จริง
- [ ] B16 walkthrough ของจริงกับทีม (login จริงบน Production) + นักบัญชีเห็นเอกสารเงินพิมพ์จริง 1 รอบ
- [ ] console Supabase/Vercel ครบตาม `docs/deploy-checklist.md` (ปิด public signup ยังไม่ยืนยัน)
- [ ] PV2.8 cutover Production V2

## นอกขอบเขต (จงใจไม่ทำ · เหตุผลอยู่ plan.md ในสมอง)
GL/บัญชีแยกประเภท/งบการเงิน (ส่ง export CSV/PEAK ให้นักบัญชี) · job costing/ต้นทุนต่อออเดอร์ (เบสเคาะ 2026-06-12) · DTF auto-nesting (RIP ทำ) · online designer เต็มรูป (เว็บสกรีน = เลือก/อัปโหลด + ดีไซเนอร์ช่วย) · แชตในแอป (ลูกค้าอยู่ LINE) · ใบกำกับอย่างย่อ · time-clock/payroll (hr-platform-v2) · WMS/PR-PO-GRN (Anajak Stock ทำ) · mockup generator · CMMS · anomaly detection · capacity planning เต็มรูป · Block reuse/BOM เต็มรูป · courier API booking · รายงาน ม.87(3)
