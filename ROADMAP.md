# Anajak ERP — Roadmap & ใบงาน
> เฉพาะใบงานที่ **ยังเปิดอยู่** + สิ่งที่ตัดสินแล้ว · แผนเต็ม + เหตุผล: bestos `records/projects/anajak-erp/plan.md` · ของที่เสร็จแล้วอยู่ดัชนีท้ายไฟล์ 1 บรรทัด — รายละเอียดใบงานเก่าทุกรอบใน git: `git show 61575af:ROADMAP.md` (420 KB) + `git log`
> กรอบที่เบสเคาะ 2026-06-10: ซ่อมต่อบนโครงเดิม · ผู้ใช้ = พนักงาน 5 คน + เบส + ลูกค้า · ภาษีเต็มรูป + หัก ณ ที่จ่าย 2 ขา · เว็บสกรีน = P4
> เป้าหมายที่เบสย้ำ 2026-09-02 → `AGENTS.md` §เป้าหมาย (ครอบคลุมโรงงาน · ส่งร้านนอกมีประสิทธิภาพ · UX สวยใช้ง่าย · รองรับออเดอร์เว็บธรรมดา + custom)

## กติกา build (ผูกทุก phase — ห้ามข้าม)
1. เพดานจริง ~1-2 โมดูลเล็ก/เดือน — อย่ารับปากเกิน · ทุกไตรมาส prune backlog ที่ยังไม่เริ่มทิ้งครึ่ง
2. เปิด "gate บังคับ" ทีละตัว — เปิดพร้อมกันพนักงาน bypass ข้อมูลกลายเป็นขยะ
3. manual field/CSV ก่อน API เสมอ (courier/บัญชี/stock-link)
4. **ไม่คิดต้นทุนต่องาน** (เบสเคาะ 06-12 — ต้นทุนเหมา คิดกำไรขาดทุนรายเดือนในระบบบัญชี) · ห้ามเพิ่มช่องเงิน/ต้นทุนใน flow ผลิต-outsource
5. **ไม่ build GL** — ERP ออกเอกสารขาย/ใบกำกับ/50ทวิ + export (CSV มาตรฐาน + template PEAK) ให้นักบัญชี
6. surgical: แตะเฉพาะที่ใบงานสั่ง · โครงเดิมดี (order module/status machine/token approval/V2 manufacturing) ต่อยอด อย่ารื้อ
7. refactor = targeted + test ก่อน ห้าม big-bang · boy-scout rule (แตะไฟล์ไหน เก็บกวาดไฟล์นั้น)
8. UI ใหม่ผ่าน design system (`docs/DESIGN.md` — component/token/ความกว้าง/สถานะ) ไม่ไล่ทาสีทีละหน้า · ห้าม redesign หน้าที่ยังไม่มีงาน functional ไปแตะ
9. UI ที่มีหลายทาง → หน้าลอง `/proto` เทียบ 2-4 ทางให้เบสเลือกก่อนแตะของจริง · เคาะแล้วค่อยลง presentation (ไม่แตะ query/mutation/permission/status/schema ถ้าใบงานไม่สั่ง) · เสนอทางเดียว + รื้อก่อนตกลงทิศ = ถูกปฏิเสธมาแล้ว 2 ครั้ง
10. schema เพิ่มแบบ additive · ห้าม apply/reset ฐาน shared/remote โดยไม่ระบุ target + backup แยก

## 🔥 เปิดอยู่ตอนนี้ (เรียงตามลำดับที่ควรทำ)

### A. หน้าใบสั่งผลิต `/production/[id]` — เริ่มใหม่จากศูนย์ (เบสสั่ง 2026-09-02)
- [ ] รอเบสตั้งโจทย์ใหม่ · **ห้ามยึดกับ 20+ แบบที่ลบไป** (ย้อนดูได้ที่ commit `ab7d4f8`–`19aeadb` แต่อย่าเสนอซ้ำ)
- [ ] ได้โจทย์ → หน้าลอง `/proto` 2-4 ทาง → เบสเลือก → ลงของจริง (presentation เท่านั้น)

### A2. จอสถานี `/factory/station` — ถอดออกแล้ว เริ่มใหม่จากศูนย์ (เบสสั่ง 2026-09-02)
- [x] ถอด route + UI ทั้งชุด (legacy + V2) + ด่าน verify ของจอเดิม (branch `remove/factory-station-2026-09-02`) · ทางเข้าจากเมนูข้าง/เมนูผลิต/My Tasks/ใบผลิต/แจ้งเตือน ชี้ไปใบผลิต `/production/[id]` แทน · จอโรงงาน `/factory` (TV) ยังอยู่
- [ ] จอสถานีใหม่รวมอยู่ในหน้าลอง `/proto/production-module` (สวิตช์ "โหมดหน้างาน") — เคาะพร้อม §A3
- เก็บไว้ให้จอใหม่ต่อ (ยังไม่ลบ): server `factory.station*` / `manufacturing.station*` + read model · กติกาใน `docs/DESIGN.md` §Station work center · โหมด `surface="station"` ที่ฝังในหน้าใบผลิต/รอบพิมพ์ (ไม่มีใครเรียกแล้ว — ถอดตอนจอใหม่เคาะ) · `station-garment-preview` ยังใช้ในการ์ดลายของใบผลิต

### A3. หน้ารายการผลิต `/production` + รอบพิมพ์ + คลังฟิล์ม + คิวร้านนอก — ถอดออกแล้ว เริ่มใหม่จากศูนย์ (เบสสั่ง 2026-09-02)
- [x] ถอด route + UI ทั้งโมดูลรายการ (legacy + V2): `/production` · `/production/print-runs` · `/production/films` · `/outsource` + dialog เปิดใบผลิต + lib worklist/board + หน้าลอง proto ของหน้ารายการ 5 ชุด (production-list/row/groups/filter/canvas-filter) · เหลือใบผลิต `/production/[id]` กับจอโรงงาน `/factory`
- [x] เบสยอมพังชั่วคราว: เมนู "การผลิต" หายจากเมนูข้าง/แดชบอร์ด · **เปิดใบผลิตจากออเดอร์ไม่ได้** จนกว่าหน้าใหม่จะมา · ลิงก์ที่เคยชี้มา (My Tasks · ปุ่มกลับในใบผลิต · การ์ดผลิตในออเดอร์ · แจ้งเตือนร้านนอก) ชี้ไปหน้าออเดอร์/My Tasks แทน
- [x] หน้าลอง `/proto/production-module` — **เบสเคาะ A “โต๊ะงานหัวหน้า” (09-02)**: ตัวเลขใหญ่ 4 ช่องเป็นตัวกรอง · รายการเป็น `DataTable` 8 คอลัมน์ (ใบงาน · จำนวน · กำหนดส่ง · เส้นทางงาน · ตอนนี้อยู่ที่ · ร้านนอก · ผู้รับผิดชอบ · ลูกศรเปิดดู) · กองตามความรีบเป็นหัวกลุ่มในตารางเดียว · **ไม่มีปุ่มในแถว** แถวกดเปิดใบผลิตทั้งแถว · โหมดหน้างาน = โต๊ะเดียวกันย่อเหลือสถานีของฉัน การ์ดใหญ่ปุ่ม 56px
- [ ] **ลงของจริง `/production` ใหม่ตามแบบ A** (presentation ต่อ `production.kanban` / `manufacturing.controlList` เดิม): route + หน้า + ตัวเลข 4 ช่อง + ตาราง + กอง · คืนเมนู "การผลิต" + ปุ่มเปิดใบผลิต + ลิงก์จาก My Tasks/ออเดอร์ · ต้องผ่าน impeccable + กฎ 3 ชั้น · ยังไม่ทำ: โหมดหน้างานของจริง (§A2 ทำต่อหลังหน้ารายการ) · ที่อยู่ของรอบพิมพ์/คลังฟิล์ม (ยุบเป็นปุ่มที่สถานีพิมพ์ตามหน้าลอง — ถ้าเบสอยากได้หน้าแยกบอกได้)
- เก็บไว้ให้หน้าใหม่ต่อ (ยังไม่ลบ): server `production.kanban` · `manufacturing.controlList/workCenterLoad` · router print-run / film-stock / outsource · `lib/outsource-ui` · กติกาเดิมใน `SPEC.md` §UI และ `docs/DESIGN.md`

### B. Cutover Production V2 (PV2.8 / P5.6) — เสี่ยงสูง ทำเป็นขั้น เบสอนุมัติทุกขั้น
> โค้ด + migration + seed สูตรมาตรฐาน + หน้าตั้งค่า `/settings/routings` ครบแล้ว (`SPEC.md` §Production V2) · ของจริงบน Vercel ยังเป็น **legacy** (`PRODUCTION_V2_ENABLED=0`) · ฐาน demo (`npm run dev:demo`) เปิด V2 ไว้ซ้อม · ฐานจริงยังไม่ seed routing/work center
- [ ] B1 เบสซ้อมบนฐาน demo: เปิดใบจากสูตรมาตรฐาน → กดทีละขั้นในจอสถานี (**รอจอสถานีใหม่ §A2** — ของเดิมถอดแล้ว 09-02) (รวมส่งร้านนอก · QC fail/rework · แพ็กแยกไซซ์) → บอกว่าอะไรไม่ตรงหน้างาน
- [ ] B2 แก้ตามที่ซ้อมเจอ (เขียนใบงานย่อยใต้ข้อนี้)
- [ ] B3 seed routing + work center ลงฐานจริง (additive) → backup → เปิด flag บน production → ลบ legacy UI/writer เก่าตามสัญญา rollout window
- [ ] B4 หนี้ที่ V2 ยังขาด (Phase 2 parity — ปิดหลัง cutover): QC rework target work center · DTF partial/waste/reprint event · owner/plan/SLA/audit actor read model · supervisor material recovery · WIP ownership ของ QC/final pack

### C. MFG — ตัวชี้วัดฝ่ายผลิต (เบสสั่ง 2026-08-15) · อ่านอย่างเดียว · ไม่เพิ่ม schema · ไม่มีเงิน
> วัตถุดิบมีครบใน DB แล้ว: `ProductionStep.startedAt/completedAt` · `QcRecord.qtyGood/qtyDefect` · `QcDefect.reason/size/color/printLabel/photoUrls` · `Order.deadline/shippedAt`
- [ ] MFG1 หน้าเดียว 2 ตัวเลข: **ส่งตรงเวลา %** (ออเดอร์ที่ `shippedAt` ในงวด เทียบ `deadline` · ไม่มี deadline = ไม่นับ) + **ทำถูกครั้งแรก %** (`Σ qtyGood / (Σ qtyGood + Σ qtyDefect)`) · เลือกงวดเดือนไทยแบบ `/billing/tax`
- [ ] MFG2 สรุปของเสียตาม `QcDefect.reason` ในงวด แยกย่อย ไซส์/สี/ลาย + เปิดรูปที่ช่างถ่าย · ป้ายสาเหตุจาก `src/lib/qc.ts` ห้ามประกาศ map ใหม่
- [ ] MFG3 ด่าน: pure function แยกจาก router + unit test เคสขอบ (งวดว่าง / ไม่มี deadline / หารศูนย์ / ยังไม่ส่ง / ยกเลิก) · จอจริง 1440 + 390 ทั้งสองธีม · เพิ่มเกณฑ์เสร็จใน SPEC

### D. Gate ก่อนใช้จริง
- [ ] B6 นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน จากเอกสารพิมพ์จริง
- [ ] B16 walkthrough ของจริงกับทีม + นักบัญชีดูเอกสารเงินพิมพ์จริง 1 รอบ
- [ ] console checklist Supabase/Vercel → `docs/deploy-checklist.md`

### E. Gate C — หลังใช้จริง ~1 เดือน (calibrate จากข้อมูลจริงก่อน build)
- [ ] C1 pricing engine ใบเสนอ (qty break × เทคนิค × ตำแหน่ง + ราคาต่อลูกค้า) — ต้องเป็น service เรียกซ้ำได้ เพราะเป็นฐานราคาออเดอร์เว็บใน P4 ด้วย
- [ ] C2 stale sweep (ใบเสนอ SENT / แบบรอลูกค้า / INQUIRY / outsource เลยกำหนด ค้างเกิน N วัน → กระดิ่ง · โครง cron + notification พร้อมแล้ว)
- [ ] C3 global search ⌘K ค้นเลขออเดอร์/ลูกค้าจริง (server search มีแล้ว เหลือต่อท่อ palette)
- [ ] C4 Owner Pulse drill-down (`/orders` รับ URL filter) + คอลัมน์/sort กำหนดส่ง
- [ ] C5 UX ops เก็บตก (ส่วนใหญ่ถูกทับด้วย Station V2 — ตรวจอีกทีหลัง cutover ว่าเหลืออะไร)
- [ ] C6 LINE OA notify (ระหว่างนี้ template ก๊อปส่ง)

### E2. ลำดับความสำคัญทางสายตา — refactor ของเก่าให้ผ่านกฎ 3 ชั้น (เบสสั่ง 2026-09-02 "แก้ราก + refactor ด้วย")
> ราก: กฎมีแต่ "ห้าม" ไม่มี "ต้องเด่น" + ไม่มีชิ้นส่วนนำเสนอข้อมูล → ทั้งเว็บเป็นตัวเทาต่อจุด · แก้รากแล้ว: `docs/DESIGN.md` §ลำดับความสำคัญทางสายตา · primitive 5 ชิ้น (`Fact` `Metric` `InfoChip` `DueTag` `ActionZone`) · ด่าน `scripts/ui-hierarchy-ratchet.ts` ใน `verify:ui` (baseline ห้ามเพิ่ม) · AGENTS §วงจร 3 บังคับผ่าน impeccable
- [x] รอบ 1 (09-02): หน้าลอง `/proto/production-module` ทั้ง 3 ทาง · `production-steps-list` (ร้านนอก/กำหนดรับเป็นชิป) · แถวสินค้าตอนเปิดออเดอร์ (`product-table-row` `product-card-mobile`) · รายการสินค้าในใบงาน (`order-items-display` สเปกเสื้อเป็น FactList) · ใบผลิต `production-control-record` + `station-garment-preview` (ไซส์/สีเป็นชิป)
- [ ] รอบ 2 — ไฟล์ที่ยังมี `text-xs text-muted` เยอะสุด (ratchet baseline): `production-v2-control-record` 16 · `order-qc-section` 13 · `material-usage` 11 · `order-files-card` 8 · `billing/tax` 7 · `billing/page` 7 · `job-share-view` 7 · `order-billing-section` 6 · `manufacturing-factory-board` 6 — แตะไฟล์ไหนให้แปลง "ป้าย: ค่า" เป็น `Fact` · ตัวเลขนำเป็น `Metric` · กำหนดส่ง/กำหนดรับเป็น `DueTag` แล้ว `npx tsx scripts/ui-hierarchy-ratchet.ts --update`
- [ ] รอบ 3 — หน้าออเดอร์ `/orders/[id]` แท็บภาพรวม + แถบสถานะ (เบสเห็นบ่อยสุด) · ทำเป็นหน้าลองก่อนเพราะเคาะแบบ B ไปแล้ว 08-31
- ห้าม: โฟกัสด้วยสี (เบสตีกลับ 09-02) · primitive ใหม่ซ้ำหน้าที่ · ลด baseline ด้วยการลบข้อมูลออก

### F. หนี้ที่จดไว้ (ทำตอนแตะไฟล์นั้น หรือเปิดใบงานเมื่อถึงคิว — **อย่าแก้เงียบ**)
- **UI**: `/factory` สี alpha ดิบ 13 จุด (อ่านถูกบนจอจริง ไม่รีบ) · hairline alpha ค่าเดียว · ยังไม่ตรวจจอทัชโรงงานจริง (แสงสะท้อน เงาจางกว่า) · แถบ "ยังไม่อ่าน"/ราง `SegmentedControl` · ธีมมืดบันไดแคบกว่าสว่าง
- **pattern เก่า**: `/quotations/new` ยัง Card/form row รุ่นเก่า → migrate เป็น `Section`/`Field` โดยคง conversion logic · settings company/cost-rates/patterns/services/users ยังมี raw label · dashboard home ซ่อน `max-w-6xl` ใน className → เคาะ width role
- **โค้ด**: `OrderInfoEditDialog` / `OrderItemsEditor` เดิมไม่มี caller — รอเบสอนุญาตลบ · lint warning เก่า (react-hooks/no-img/unused) เก็บตอนแตะไฟล์ ห้ามเพิ่มใหม่
- **ข้อมูล/ธุรกิจ** (ต้องมีใบงาน + test): dropdown ลูกค้าใน orders/new + quotations/new ตัดที่ 100 ไม่มีค้นหา · inquiry ↔ ใบเสนอ ↔ ออเดอร์ยังไม่ผูกกัน + `convertToOrder` ได้ items โครงเปล่า (เคาะ data model — เกี่ยวกับออเดอร์เว็บ P4 โดยตรง) · `attachment.create` มี API ไม่มีปุ่ม (สลิปโอน `evidenceUrl`) · Delivery ไม่มี line items (แบ่งส่งหลายรอบบอกไม่ได้ว่ากล่องไหนมีอะไร — เคาะ schema ก่อน) · token อนุมัติหมดอายุ regenerate ไม่ได้ · `recordPayment` ไม่เตือนว่าใบอยู่บนใบวางบิลแล้ว

## P2 — ผลิต + สต๊อค (หลัง cutover V2)
per-item tracking + นับชิ้น + ของเสีย/reprint log (V2 มี quantity line/event แล้ว — ต่อยอด ไม่สร้างใหม่) · AP vendor + WHT ขาจ่าย 3% + 50ทวิ + ภงด.53 export (**ทบทวนขอบเขตกับเบสก่อนเริ่ม** — คนละเรื่องกับต้นทุนต่องาน) · จองสต๊อกลึกขึ้นกับ Anajak Stock · ใบแพ็ค + Delivery line items

## P3 — ฝั่งลูกค้า
Customer portal เต็ม (สถานะ/ประวัติ/เอกสาร/อนุมัติ/สั่งซ้ำ) · LINE OA notify + ทวงหนี้ + รูป WIP · CRM เต็ม (follow-up/RFM) · revision quota + คิดเงินเกินโควตา + lock หลังอนุมัติ · strike-off gate (ตัวอย่างจริง opt-in) · preflight ไฟล์ (DPI/พื้นโปร่ง) · analytics ลึก

## P4 — เชื่อมโลก + เว็บสกรีนเสื้อ (เบสย้ำ 2026-09-02)
- **Order-intake API** ให้เว็บสกรีน (project `anajak-print-web` ใน bestos) ส่งออเดอร์เข้ามาเป็น **ออเดอร์เดียวกับหน้าร้าน** — ทั้ง **ธรรมดา** (เสื้อสำเร็จ + ลาย/ตำแหน่งที่เลือก) และ **custom** (ไฟล์ลูกค้า · ตำแหน่ง/เทคนิค/ไซซ์เอง · ต้องผ่านขั้นอนุมัติแบบ) → ใช้ order type / garment source / design version / approval token / payment terms ที่มีอยู่
- **สิ่งที่ต้องเผื่อตั้งแต่ตอนนี้**: pricing engine (C1) เป็น service เรียกซ้ำได้ · ไฟล์ลูกค้าเข้า pipeline เดิม (`/upload` + design version) · **ไม่สร้างสถานะ/flow แยกสำหรับออเดอร์เว็บ** · MCP/API เคารพสิทธิ์ชุดเดียวกัน
- MCP server (มีแล้ว · ขยายตามสิทธิ์) · ฟอร์มเก็บไซซ์ลูกค้าองค์กร (เวอร์ชันเบา) · e-Tax provider / PEAK API / courier API เมื่อ volume ถึง

## จงใจไม่ทำ (อย่าหยิบกลับมา — เหตุผลใน plan.md)
GL/งบการเงิน · job costing/ต้นทุนต่อออเดอร์ · DTF auto-nesting (RIP ทำแล้ว) · in-app chat (ลูกค้าอยู่ LINE) · online designer เต็มรูป (เว็บสกรีน = เลือก/อัปโหลด + ดีไซเนอร์ช่วย) · ใบกำกับอย่างย่อ · time-clock/payroll (hr-platform-v2) · WMS/PR-PO-GRN (Anajak Stock) · mockup generator · CMMS เต็ม · anomaly detection · capacity planning เต็มรูป (ใช้ปฏิทินภาระงานเบา) · Block reuse/BOM เต็มรูป (ไม่มีบล็อกในบ้าน)

## ลองแล้วไม่เอา (อย่าเสนอซ้ำ)
- หน้าทำงานหลักรวมออเดอร์ + ผลิต (`/proto/work-board` A/B/C) → เบสเลือก "แบบปัจจุบันยังดีกว่า" (08-30) — คงสองหน้า `/orders` + `/production` (ต่อมา `/production` ถูกถอดทั้งหน้า 09-02 §A3)
- ผังโรงงานเป็นตัวกรอง `/production` (`production-canvas-filter`) → "เอาแบบเดิมก่อน" (09-02) · จอ canvas ทั้งโรงงาน (`factory-canvas`) เก็บเป็นวัตถุดิบอนาคต · หน้าลองของหน้ารายการผลิตทั้ง 5 ชุด (list/row/groups/filter/canvas-filter) ลบไปพร้อมหน้า 09-02 — ดูได้ใน git ก่อน commit นี้
- ใบสั่งผลิตแบบผังสายพาน/จอสถานี/แผงลงมือ 20+ แบบ (08-30 → 09-02) → ลบทั้งหมด เริ่มใหม่
- เมนูซ้ายมีสีหมวด → ถอยกลับ (08-31) · ตารางไม่มีกล่องครอบ → กลับคำ (08-26) · ราคาและเงื่อนไขแบ่ง 2 ฝั่ง · CTA ต่อท้ายหัวข้อ (08-04)
- Order Workbench / Command Center redesign ทั้งระบบทีเดียว (08-14, 08-29) → ปฏิเสธเพราะเสนอทางเดียว + รื้อก่อนตกลงทิศ

## ✅ เสร็จแล้ว (ดัชนี — ไม่ทำซ้ำ · รายละเอียด `git log` / `git show 61575af:ROADMAP.md`)
- 06-10 → 06-19 **P0** ฐานราก: auth + RBAC จริง · Float → Decimal · เลขเอกสารรันต่อเนื่อง · migrations · service layer · test แกน · `docs/ARCHITECTURE.md`
- 06-11 audit วงจรออเดอร์ 31 ข้อแก้ครบ · 06-12 **FLOW-REDESIGN** ผังใหม่ทั้งระบบ · แยกโมดูลผลิต · ตัด job costing
- 07-02 → 07-03 **Gate A** เงินห้ามผิด · **Gate B1-B15**: CN/DN ม.86/10 · VAT 7% · tax point งวดรับเงิน · QC bypass ปิด · รายงานภาษีขาย CSV · CRM · ถอดฟอร์มปลอม · เพดานสองขา · ON_HOLD · soft-delete · sidebar role · delivery state machine · ใบส่งร้านนอก LINE · CI + security headers + backup export
- 07-06 → 07-07 **PERM** สิทธิ์รายคน · 07-07 → 08-05 **UX0-UX3** ทางเดินงาน + design system (PageShell/DataTable/Field/ResponsiveList/verify:ui) + orders/new หลายรอบ
- 08-12 → 08-14 **UI V2 → UI หลัก** · ระบบสีใหม่ · Impeccable integrity refactor · ฟอร์มออเดอร์เดียวสร้าง + แก้ · แยกที่อยู่ผู้ติดต่อ/จัดส่ง
- 08-15 → 08-21 **Next.js 16.3** · PRODUCTION-UX2 family · MFG0 · ใบผลิต → Direction A (Control vs Station) · Station low-tech · ฐาน demo local
- 08-22 → 08-23 ม็อกอัพหลายรูป/บ้านเดียว · **PRODUCTION-V2 PV2.1-2.7** · Visual identity + Vercel panel system · Anajak Blue selection
- 08-25 → 08-28 **UI-2026** เฟส 1-11 (token ฐาน · ธีม · หัวตาราง · sidebar toggle) · production step flow / live signal
- 08-30 **NO-JOB-TITLE** (ลบคอลัมน์ถาวร) · หน้าใบงานหน้าตาใหม่ · 08-31 สีบอกหมวดแบบ B · `/production` แบบ C · แถบกรอง A · ภาพรวมออเดอร์ B
- 09-01 → 09-02 แถบกรองเส้นทางงาน D · คอลัมน์เส้นทางงาน C · **P5.0 สูตรขั้นงานมาตรฐาน (seed)** · **P5.5 หน้าตั้งค่า `/settings/routings`** · V2 เปิดบนฐาน demo · เก็บกวาด repo
