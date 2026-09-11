# มาตรฐาน UI Anajak ERP

## ขอบเขต A16 (2026-09-11)

เบสอนุมัติเริ่ม refactor และปรับ UI ทุกหน้าทุกส่วน รวมกฎหน้าตาที่ขัดการใช้งาน. ใช้ [ui-guidance ฉบับปัจจุบัน](/Users/lostxker/dev/Git/bestos-brain/global-skills/ui-guidance/SKILL.md) ร่วมกับเกณฑ์พฤติกรรมใน `SPEC.md`; ใบงาน/ผลตรวจอยู่ `ROADMAP.md` และ `PROGRESS.md`. สูตรหน้าตารุ่นก่อนอยู่ใน git history ไม่เป็นข้อห้ามของงานนี้

ไฟล์นี้เก็บแหล่ง component/token และข้อกำหนดที่ต้องคงไว้ ไม่คัดสกิลหรือประวัติการเลือกแบบมาซ้ำ. เมื่อเอกสารกับโค้ดต่างกันให้ตรวจพฤติกรรมจริงและมติล่าสุดก่อนแก้ทั้งคู่ ไม่ถือว่าของที่มีอยู่ถูกโดยอัตโนมัติ

## ลำดับความสำคัญทางสายตา

จัดกลุ่มตามงานที่ผู้ใช้ต้องทำและสิ่งที่ต้องเทียบ พร้อมสถานะ เหตุที่ติด และทางไปต่อจากข้อมูลจริง. แต่ละรายการอิสระมีคำสั่งหลักของตัวเองได้; จำนวนปุ่ม สี การ์ด หรือชิปไม่ใช่คะแนน UX

- `PageHeader`/`PageShell`: ชื่องาน บริบท และทางกลับ; `description` ใช้เมื่อช่วยเข้าใจงาน ไม่เติมคำโปรยอัตโนมัติทุกหน้า. `meta` เป็นข้อเท็จจริงเฉพาะรายการ ไม่ใช้แทนคำช่วยที่จำเป็น
- `Section`/`Field`: วางคำแนะนำ ตัวอย่าง และเหตุที่ทำไม่ได้ตรงข้อมูลที่เกี่ยว. ข้อความจำเป็นจะคงที่หรือเปลี่ยนตามสถานะก็แสดงได้ ไม่จำกัดหนึ่งบรรทัด
- `HelpTip`: รายละเอียดเสริมที่เปิดเมื่อจำเป็นด้วย click/tap/keyboard. คำเตือน validation สิทธิ์ ผลสำคัญ และคำช่วยที่ต้องใช้ตัดสินใจไม่ซ่อนไว้ใน hover/title
- `ActionZone`: จัดคำสั่งใกล้ข้อมูลของงานนั้นพร้อมผลและเงื่อนไข. คำสั่งที่ยังทำไม่ได้ต้องบอกเหตุและทางแก้; จะใช้ disabled หรือข้อความขึ้นกับภารกิจ ไม่ซ่อนทางที่ผู้ใช้จำเป็นต้องรู้
- `Fact`, `Metric`, `InfoChip`, `DueTag`, `StatusLabel` เป็นตัวเลือกช่วยจัดข้อมูล ไม่บังคับทุกแถวมีครบสามชั้น. ใช้ข้อความธรรมดาได้เมื่ออ่านและเทียบง่าย; หลีกเลี่ยงทั้งบรรทัดอัดแน่นและชิปที่แยกข้อเท็จจริงจนเทียบยาก
- `ui-hierarchy-ratchet` ชี้ตำแหน่งที่ควรทบทวนเท่านั้น. การนับจุดคั่น/ข้อความรองไม่พิสูจน์ความอ่านง่าย; ห้ามตัดคำช่วยจำเป็นเพื่อหลบคำเตือน

## แหล่งระบบภาพ

| เรื่อง | แหล่งปัจจุบัน | การใช้งาน |
|---|---|---|
| สี/ฟอนต์/พื้น/เงา/มุม/animation | `src/app/globals.css` | ปรับ token ร่วมกันและตรวจ Light/Dark; ไม่เพิ่มสูตรรายหน้าที่ทำหน้าที่เดียวกันโดยไม่มีเหตุ |
| ผิว/interaction/focus/radius | `src/components/ui/tokens.ts` | แยก resting, hover, pressed, selected, disabled และ focus ตามความหมาย |
| ขนาด control | `src/components/ui/control-size.ts` | mobile/coarse 44px, desktop 36px; primitive คุมขนาดก่อน override |
| ตัวตนหน้า/สีหมวด | `src/lib/page-identity.tsx`, `src/lib/visual-tone.ts` | ช่วยจำบริบทได้โดยไม่แย่งข้อมูลสำคัญ; icon ตกแต่งใช้ aria-hidden |
| ขนาดหน้า | `src/components/page-shell.tsx` | เลือกตามงาน; inline editor รับความกว้างจาก host ไม่หุบซ้ำ |

น้ำเงิน Anajak `#3973b2` และ Prompt เป็นทิศปัจจุบัน. สีช่วยแบรนด์ การเลือก การกระทำ และสถานะได้ แต่ความหมายต้องมีข้อความ/สัญลักษณ์ประกอบ. การปรับมุม พื้น เงา density และ composition ใน A16 ทำผ่านส่วนกลางพร้อมตรวจการอ่านและ interaction ไม่ยึดค่า 8px/16px หรือสูตรชั้นสีเก่าที่ขัดกัน

ข้อความใช้ `text-strong`, `text-secondary`, `text-muted`, `text-placeholder` ตามบทบาทและ contrast. บันไดอักษรอยู่ใน `globals.css`; ตัวไทยต้องไม่ตัดสระ/วรรณยุกต์หรือบีบด้วย tracking/line-height จนอ่านยาก. micro 11px เหมาะเฉพาะ status/counter ที่มีบริบท ไม่ใช้กับ label/คำช่วย/action. mobile input ต้องอย่างน้อย 16px เพื่อไม่ให้ Safari ซูมเมื่อกรอก

ตารางใช้ density ที่เหมาะกับข้อมูลและเป้ากด; skeleton ต้องใกล้โครงจริงเพื่อไม่กระโดดเมื่อโหลด ไม่ล็อกทุกแถวเท่ากันทั้งระบบ. โครงสี/มุมของ print เป็นอีก surface เพราะคุมกระดาษ ไม่กวาดตามค่าหน้าจอ

## Component และแหล่งข้อมูลร่วม

| งาน | ใช้จาก |
|---|---|
| โครงหน้า/สถานะโหลด-ผิดพลาด-สิทธิ์ | `page-shell.tsx`, `page-header.tsx`, `ui/page-skeleton.tsx`, `ui/query-error.tsx`, `ui/access-denied.tsx`, `ui/record-not-found.tsx` |
| รายการ/ตาราง/ตัวกรอง/แบ่งหน้า | `ui/data-table.tsx`, `ui/responsive-list.tsx`, `ui/toolbar.tsx`, `ui/search-input.tsx`, `ui/filter-chip.tsx`, `ui/filter-popover.tsx`, `ui/table-pagination.tsx` |
| URL state/ค้นหา/คุมหน้าเมื่อผลลด | `hooks/use-list-page-state.ts` (`useListPageState`, `usePageClamp`) |
| ฟอร์มและข้อความที่สัมพันธ์กับช่อง | `ui/field.tsx`, `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx`, `ui/checkbox.tsx`, `ui/switch.tsx` |
| ตัวเลข/เงิน | `ui/number-input.tsx` (`NumberInput`, `MoneyInput`) แยกว่างจาก 0; คำนวณเงินตาม SPEC |
| วัน/ช่วงวัน | `ui/date-picker.tsx`, `ui/date-range-picker.tsx` |
| dialog/ยืนยัน/ถามเหตุผล | `ui/dialog.tsx`, `useConfirm`/`usePromptText` จาก `ui/confirm-dialog.tsx`; ไม่ใช้ window.confirm/prompt |
| โครงกลุ่ม/สถานะ/ทางไปต่อ | `ui/section.tsx`, `ui/card.tsx`, `ui/alert.tsx`, `ui/context-panel.tsx`, `ui/empty-state.tsx`, `ui/action-zone.tsx` |
| คำช่วยเสริม | `ui/help-tip.tsx` |
| แท็บ | `ui/tabs.tsx`; lazy ตามค่าเริ่มต้น, keepMounted เมื่อจำเป็นรักษาฟอร์มที่ยังไม่บันทึก |
| สิทธิ์ | `permAllows` จาก `lib/permissions`; server เป็นผู้ตัดสินสุดท้าย |
| สถานะ/วิธีส่ง/วันที่/เงิน | `lib/status-config.ts`, `lib/order-status.ts`, `lib/shipping-methods.ts`, `lib/utils.ts`; วันที่ใช้ Asia/Bangkok |

ก่อนเพิ่ม primitive ใหม่ ค้นส่วนที่มีอยู่และขยาย contract เมื่อหน้าที่ตรงกัน. ไม่ฝืนใช้ component จนต้องซ่อนคำช่วย/สถานะหรือสร้าง wrapper ซ้ำ. shared component ต้องไม่คำนวณสถานะ เงิน หรือสิทธิ์ขึ้นเอง

## การนำทาง การเข้าถึง และสถานะ

- Sidebar/Command Palette ใช้ navigation registry เดียวและ permission เดิม; active route ใช้ exact/longest match. เมนูย่อยังมี accessible name; ทางกลับและ deep link ต้องพาไปงานเดิมได้
- query แยก initial loading/error/empty, background error/stale และ success. error มี retry ที่ทำงานจริงและประกาศได้; เก็บ cached data เมื่อ refetch พัง. ข้อมูลยังไม่มาห้ามแสดงเป็นศูนย์หรือ “ไม่มีข้อมูล”
- ฟอร์มมี label ต่อ control, error/help ที่เชื่อม aria, รักษาค่าที่กรอกและทางแก้เมื่อผิด. mutation pending ป้องกันส่งซ้ำและบอก “กำลัง…”/aria-busy; success อิงผล server
- เป้ากด mobile/coarse อย่างน้อย 44×44px; fine-pointer desktop 36px. ทุกหน้าต้องทำงานด้วย keyboard มี focus เห็นชัดและ contrast ผ่าน WCAG AA ทั้งสองธีม. สถานะไม่ใช้สีอย่างเดียว
- dialog มี title/description ตามหน้าที่, viewport gutter, max-height/body scroll, Escape, focus trap และคืน focus ไป trigger/จุดต่อที่เหมาะสม. interactive elements ไม่ซ้อนกัน
- ตรวจ 390px และ 1440px รวม 1024px เมื่องานทัชเกี่ยว. document ไม่ล้นแนวนอน; ตารางที่ต้องเทียบอาจเลื่อนใน container ได้โดยผู้ใช้รู้ว่ายังมีคอลัมน์. ใช้ table/card ตามภารกิจ ไม่บังคับทุก list เปลี่ยนแบบเดียว
- คำสั่งจำเป็นมองเห็นและแตะได้ ไม่พึ่ง hover. animation เคารพ reduced-motion; dashboard มี skip link ไป `main-content`. ปุ่มต้องทำงานจริง ไม่วาด affordance ลาก/กดที่ไม่มีผล
- คำบนจอใช้ภาษาผู้ทำงาน ไม่แสดง CLI/environment/schema เมื่อไม่ช่วยตัดสินใจ. ไม่แสดงตัวเลข/owner/เวลา/ความจุที่ไม่มีแหล่งข้อมูลเพื่อให้หน้าดูเต็ม

## ม็อกอัพและไฟล์

- `DesignVersion` หนึ่งเวอร์ชันมีหลายรูปใน `DesignVersionFile`; ลูกค้าอนุมัติทั้งชุด. ไม่เปลี่ยนชื่อตาราง/token/audit contract ในงาน UI
- บ้านจัดการคือแท็บม็อกอัพและไฟล์ของออเดอร์. `MockupPanel` จัดการ, `MockupGallery` อ่าน, `MockupThumbnail` รูปปก, `OrderMockupHandoff` พาไปบ้านจริง ใช้ `src/components/mockup/` ร่วมกัน
- สูตรภาพใช้ `lib/mockup.ts` (`mockupImages`, `mockupCoverImage`, `orderMockupCover`); `files` ว่างในข้อมูลเก่า fallback `fileUrl` ตามเดิม ไม่ backfill จาก UI. ไม่มีรูปแสดงความหมายว่า “ยังไม่มีม็อกอัพ” ไม่ปลอม artwork ให้เป็นแบบอนุมัติ
- ใบผลิต/แท็บผลิตอ่านม็อกอัพ ไม่เปิด writer อัปโหลด/อนุมัติซ้ำ. ไฟล์ที่ browser ดูไม่ได้ต้องแนบรูปตัวอย่างก่อนส่งลูกค้า; ทุกรูปมี approval token ผ่าน `withFileToken` และ `/api/files` ตามสิทธิ์เดิม
- จอสถานีคงคำเตือน `ห้ามวางตำแหน่งจากภาพนี้`. เอกสารกระดาษและลิงก์เวอร์ชันเก่าต้องไม่ถูกแสดงเหมือนแบบล่าสุดโดยไม่มีคำบอก

## การผลิตและโหมดหน้างาน

| เส้นทาง | หน้าที่ |
|---|---|
| `/production` | ตารางต่อเนื่องของหัวหน้า (A10–A11) พร้อมค้นหา/กรอง/เรียง/สถานะจริง; ไม่มีหัวแบ่งสถานะในตาราง; จำนวนภาพรวมไม่นับจากผลกรอง |
| `/production/[id]` | ใบผลิตที่หัวหน้าดู วางแผน ลงมือ มอบหมาย และแก้ปัญหาได้ครบตามสิทธิ์ (A9/A14); คงคำสั่งและหลักฐาน ไม่บังคับย้ายไปจอสถานี |
| `/production/floor` | คิวและงานปัจจุบันของช่าง; หัวหน้าใช้ได้เมื่อเดินโรงงาน; controller/เช็คลิสต์เดียวกับใบผลิต; `/station` เป็นทางเข้าเดิม |
| `/factory` | TV อ่านอย่างเดียว ไม่มี mutation/link/button สำหรับลงมือ; ข้อมูลไม่มีเงิน |
| Order/My Tasks | สรุปและ deep link ไป record/ขั้นที่เกี่ยว ไม่สร้าง lifecycle อีกชุด |

- readiness, waitingOn, availableCommands, blockedReason, due sort และจำนวนที่ทำได้มาจาก controller/service เดิม; ไม่คำนวณกฎคู่ขนานใน presentation. กดเลือกดูขั้นไม่ใช่เริ่มงาน
- `GARMENT_PICK` ผ่านเบิก/คืน Stock; `GARMENT_RECEIVE` ผ่าน Goods Receipt evidence; DTF ผ่าน Print Run/batch; QC/pack ผ่าน controller เฉพาะ; `HEAT_PRESS` คง `evaluateHeatPressGate`. การตรวจรับร้านนอกเกิดก่อน final QC
- พนักงานเห็นงานของตน/ยังไม่มอบหมาย; `supervise_operations` เห็นข้าม owner. mutation fail closed จนรู้สิทธิ์. ตรวจรับร้านนอกต้องมี `manage_production` และ `supervise_operations`; final pack ที่สร้าง delivery ต้องมี `manage_production` และ `manage_delivery`, เปลี่ยนพร้อมส่งต้องมี `update_order_status_production`
- แจ้งปัญหาให้ server derive work center/source จาก step และคง transaction/lock/audit/notification เดิม. การแก้ยอดหรือย้อนขั้นต้องผ่านคำสั่งและหลักฐานที่ SPEC ระบุ ไม่ set status เพื่อทำให้จอดูง่าย
- scan/QR เปิดบริบทเท่านั้น ไม่ claim/start/complete/pack; หลาย production ให้เลือก record. handoff เป็น navigation ที่ผู้ใช้เลือกเอง และคง exact production/order context ไม่เดาสถานี
- `factory.stationQueueContext` ใช้ exact no-money snapshot ไม่พึ่งรายการ `take: 200`; หลัง mutation sync snapshot ก่อนเสนอทางต่อ. navigation ไม่ผูก mutation และไม่ให้ Back ไปขั้นเก่าที่ปิดโดยผิดบริบท
- ลำดับหลังผลิตคือ production → QC → final pack → ready. `PACKAGING` เป็นข้อมูลเก่า ไม่สร้างขั้นใหม่; recovery กลับเข้า QC. QC และแพ็กเป็นคนละด่านเสมอ
- live queues คง polling/focus/reconnect ตาม query จริง. TV เก็บ snapshot ล่าสุดและแจ้ง stale เมื่อไม่ refresh สำเร็จเกิน 2 นาที. initial error มี retry; background error ไม่ล้างงานที่ผู้ใช้กำลังอ่าน
- worklist/ใบผลิต/print run/film/outsource ไม่เพิ่มราคา/ค่าจ้าง/ยอดออเดอร์. Station/TV DTO ไม่ขนส่งหรือ render เงินแม้ OWNER; ไม่ mount MaterialUsage หรือส่ง shipping cost. ERP recovery วัตถุดิบเดิมยังต้องมี `see_finance`

### เมื่อเปิด Production V2

แหล่ง contract คือ `prisma/schema.prisma`, `server/services/manufacturing-*.ts`, `server/routers/manufacturing.ts`; `Production`/`ProductionStep` คง ID/FK เป็น Manufacturing Order/Operation Job

- RoutingVersion ที่ release แก้ไม่ได้; เก็บ routing/instruction/approved mockup snapshot และ dependency ที่ผ่าน cycle validation; ทุก lane รวม Final Pack terminal เดียว
- quantity แยกสินค้า/สี/ไซซ์/ตำแหน่งพิมพ์ planned/good/scrap/rework; good เท่านั้นปลด successor, reject มี disposition, rework ตรวจซ้ำ. DTF commit ตรวจ full membership/revision และรายงานต่อ quantity line
- `OperationEvent` append-only; command ใช้ commandId/expectedRevision กับ transaction/lock order เดิมเพื่อไม่ซ้ำ quantity/stock/event เมื่อ retry
- หลังเปิด Manufacturing Order นิยาม item/variant/print และหลักฐานรับเสื้อบน Order read-only. writer เดิมตรวจ ownership หลัง topology/order lock ไม่ทำ snapshot stale
- Order status ผ่าน transition service. generic updateStatus ปฏิเสธ production-owned target และ hold/cancel/flow target ตาม ownership ของ record แม้ flag ปิด
- Final Pack เดิน READY_TO_SHIP เมื่อทุก enabled operation จบ; Office Delivery สร้าง shipment/tracking และยืนยันส่งผ่าน `ship_orders`. ความจุที่ไม่มี standard time แสดง “ยังไม่ประเมิน”
- งานหน้าตาไม่เปิด flag, apply migration หรือ cutover. PV2.8 ยังต้องผ่าน walkthrough/backup/target และอนุมัติตาม SPEC

## Public และเอกสารพิมพ์

Public token ใช้ light theme, masthead กลาง และข้อมูลตามสิทธิ์ของ token; คง blind-ship. แยก network failure จาก token เสีย/หมดอายุและให้ retry/ติดต่อที่ใช้ได้จริง โดยไม่เปิดข้อมูลภายในเพิ่ม

Print ใช้ `components/print/print-document.tsx` และ DocHeader ร่วมกัน; A4, grayscale-safe, คงยอด/ข้อความกฎหมาย/ต้นฉบับ-สำเนา/ลายน้ำยกเลิก/ลำดับหน้า. ก่อนแก้ primitive พิมพ์ต้อง render quotation, invoice, billing-note, job-ticket และ packing-list จริง

## การตรวจและรับงาน

`verify:ui` ยังตรวจข้อมูล/สิทธิ์/semantic/accessibility contract. heuristic การนำเสนอเป็นคำชี้ให้ทบทวน ไม่ยืนยันว่าคนใช้เข้าใจ; เมื่ออนุมัติเปลี่ยน contract ให้แก้ข้อคาดหวังที่เกี่ยวและพิสูจน์พฤติกรรม ไม่ปิดด่านเพื่อให้ผ่าน

ใช้ภารกิจตาม ui-guidance ตรวจทางสำเร็จและทางติดขัดที่เกี่ยวบนข้อมูลทดลอง; งาน flow หลักให้ผู้ตรวจที่ไม่ได้ออกแบบลองโดยไม่บอกตำแหน่งปุ่ม. บันทึกหน้า/บทบาท/สิ่งที่ลอง/ผล/ส่วนที่ยังไม่ตรวจในที่เก็บผลเดิม ไม่สร้างคะแนน UX สมมติ. typecheck/build/screenshot อย่างเดียวไม่ยืนยันว่าทำงานจบได้
