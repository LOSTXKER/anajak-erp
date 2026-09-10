# สัญญาระบบหน้า production/station — Anajak ERP

> ย้ายมาจาก `docs/DESIGN.md` 2026-09-10 (มาตรฐาน UI ใหม่: DESIGN.md เหลือฉบับบาง · เรื่อง route/shell · data/command · station · permission เป็นสัญญาระบบ ไม่ใช่ดีไซน์) · ของจริง = โค้ด เอกสารขัดกับโค้ด = เชื่อโค้ด · ฉบับเดิมทั้งไฟล์: `git show e9640f8:docs/DESIGN.md`

## ม็อกอัพของออเดอร์ — บ้านเดียว ใช้ร่วมทุกจอ (2026-08-22)

> "ม็อกอัพ" = ไฟล์ชั้น 2 (APPROVAL) ตาม `src/lib/file-layers.ts` เก็บใน `DesignVersion`
> **หนึ่งเวอร์ชัน = หลายรูป** (`DesignVersionFile` — หน้า/หลัง/แขน) ลูกค้าอนุมัติทั้งชุดครั้งเดียว
> ไม่เปลี่ยนชื่อตาราง `design_versions` โดยตั้งใจ: audit log, token ที่ส่งลูกค้าไปแล้ว และ migration
> เดิมอ้างชื่อนี้อยู่ · เปลี่ยนเฉพาะคำที่หน้าจอเรียก

- ทุกจอที่แสดงม็อกอัพต้องเรียก `src/components/mockup/` ชุดเดียว — `MockupPanel` (จัดการเต็ม) ·
  `MockupGallery` (อ่านอย่างเดียว) · `MockupThumbnail` (รูปปกในแถวรายการ) · `OrderMockupHandoff` (แถบสรุปพาไปบ้านจริง)
  **ห้ามสร้างตัวที่สอง** — ก่อนหน้านี้หน้าออเดอร์มีสองชุด ยิง `design.listByOrder` ซ้ำ และคนอ่านไม่รู้ว่าอันไหนของจริง
- `MockupThumbnail` ไม่มีรูปให้แสดงช่องว่างขอบประ + `ImageOff` อย่างสงบในขนาดเดิม ทั้งหน้าออเดอร์และคิวผลิต · ห้ามเว้นพื้นที่ล่องหนหรือเปลี่ยนเป็น object icon/initials เพราะคนต้องแยก “ยังไม่มีม็อกอัพ” ออกจาก “มีรูปแล้ว” ได้ทันที
- สูตรอ่านม็อกอัพอยู่ที่ `src/lib/mockup.ts` ที่เดียว (`mockupImages` / `mockupCoverImage` / `orderMockupCover`)
  ห้ามจอไหนคำนวณเอง · `files` ว่าง = เวอร์ชันก่อน migration ต้องถอยไปใช้ `fileUrl` เป็นรูปปกเสมอ ไม่ backfill
- **บ้านของม็อกอัพคือหน้าออเดอร์แท็บ `ม็อกอัพ & ไฟล์`** เท่านั้น — จัดเรียงตามชั้นไฟล์: ชั้น 2 ม็อกอัพ (บนสุด
  เพราะเป็นของที่คนเปิดแท็บนี้มาหา) แล้วค่อยชั้น 1 ไฟล์ดิบลูกค้า และชั้น 3 ไฟล์พิมพ์ในการ์ด "ไฟล์อื่นของออเดอร์"
- แท็บ `งานผลิต` และ `/production/[id]` **อ่านอย่างเดียว** — ห้ามมีปุ่มอัป/อนุมัติ/สร้างลิงก์ลูกค้าซ้ำ
  (`MockupPanel readOnly` ตัดทั้งปุ่มและก้อนค่าแก้แบบออกทั้งหมด — no-money contract)
- ไฟล์ที่เบราว์เซอร์แสดงไม่ได้ (`.ai/.psd/.pdf`) **ต้องแนบรูปตัวอย่างก่อนส่งลูกค้า** — บังคับที่ dialog อัป
  (`canSubmitMockupSet`) ไม่ใช่ปล่อยให้ลูกค้าตัดสินทั้งที่มองไม่เห็นแบบ
- ทุกรูปในชุดต้องติด approval token ผ่าน `withFileToken` และ `/api/files` ต้องอนุญาตครบทั้งชุด —
  allowlist **กว้างเท่าที่หน้าโชว์ ไม่กว้างกว่านั้น** (ลิงก์สถานะกับใบงานร้านนอกยังโชว์แค่รูปปก จึงไม่ขยาย)
- จอสถานีแสดงม็อกอัพเป็น **ข้อมูลอ้างอิงรอง** ต่อจากจุดงาน และต้องคงข้อความ `ห้ามวางตำแหน่งจากภาพนี้`
  (ขนาด/จุดวางยึดตัวเลขในใบงานเสมอ — `verify:ui` ล็อกไว้)

## Canonical Production V2 (`PRODUCTION_V2_ENABLED`)

Production V2 ใช้ `manufacturing` read/command contract เป็นแหล่งความจริงเดียว โดยเก็บ `Production` และ `ProductionStep` เป็น Manufacturing Order/Operation Job เพื่อรักษา FK ของข้อมูลเดิม · schema/command source อยู่ที่ `prisma/schema.prisma`, `src/server/services/manufacturing-*.ts` และ `src/server/routers/manufacturing.ts`; UI ห้ามคำนวณ dependency, readiness, permission หรือสถานะถัดไปซ้ำ

### บ้านและเจ้าของงาน

| บ้าน | เจ้าของและสิ่งที่ทำได้ |
|---|---|
| `/production` | **ตารางต่อเนื่อง (A10 · 2026-09-09)**: ตัวกรอง 4 ช่องแบบกระชับ · ค้นหาและชิปขั้นงาน · จำนวนผลและล้างตัวกรอง · ตาราง 6 คอลัมน์ (ใบงาน/จำนวน/กำหนดส่ง/ขั้นตอนพร้อมเส้นทาง/ร้านนอก/ผู้รับผิดชอบ) ไม่มีหัวแบ่งสถานะ · กดหัวใบงาน/จำนวน/กำหนดส่งเพื่อเรียง เก็บ sort/dir ใน URL · กดแถวหรือ Link เลขใบเปิดใบผลิต ใช้คีย์บอร์ดและเปิดแท็บใหม่ได้ · มือถือเลื่อนเฉพาะตาราง หน้าไม่ล้น |
| `/production/[id]` | **ใบผลิตแบบ E “ตอนนี้ทำอะไร (รู้ทางขนาน)” (เบสเคาะ 2026-09-06 · แทนแบบ D แท็บ + 2 คอลัมน์ ที่ทีมผลิตบอกใช้ยาก)**: หัวใบตัวเลข 4 ช่อง (จำนวน · กำหนดส่ง · ผ่านแล้ว · ติดปัญหา) → **แผนที่เส้นทาง** (`work-order-route.tsx` · ผังจาก `lib/work-order-route`): สายที่เดินขนานกันคนละแถว (เตรียมเสื้อ · ฟิล์ม DTF · ร้านนอกแต่ละสาย) เส้นวิ่งรวมที่ขั้นบรรจบ (รีดร้อน = เงื่อนไข evaluateHeatPressGate · หางงาน QC/แพ็ก = เงื่อนไข stepsBlockingQc) กดขั้นไหน = เปิดขั้นนั้น · ขั้นที่ยังรอสายอื่นเขียน “รอ X + Y” ไม่ใช่ศัพท์ระบบ → แถบเสื้อ/ไซซ์ → **ตอนนี้ทำอะไร**: ติดปัญหา (การ์ดปัญหา + โซนลงมือ) → ทำได้ตอนนี้ สายละใบวางคู่ (ขั้นแรกที่ยังไม่ปิดของแต่ละสายที่ไม่ได้รอใคร · ปุ่มเดียว/ใบ จาก `selectNowSteps` เดิม) → ถัดไป (บรรทัดสั้น) → พับไว้ท้าย: ลายและม็อกอัพ · ข้อมูลใบ · ประวัติ (แทนแท็บ ไม่มีอะไรหาย) · ไม่มีปุ่มลงมือแทนพนักงานนอกโซนลงมือมาตรฐาน · ด่าน `scripts/verify-work-order-ui.tsx` 33 ข้อ |
| `/production/floor` (เดิม `/station` → redirect) | **โหมดหน้างานของโมดูลผลิต — แบบ A “หยิบงานเอง” (2026-09-03 · แทน `/factory/station` ที่ถอดไป) · โครง “หนึ่งโมดูล สองสายตา”: นี่คือสายตาของช่าง (ล็อกอินแล้วตกที่นี่) · หัวหน้าทำครบจากใบผลิต `/production/[id]` (ลงมือ · แก้ให้ · แจ้งปัญหา · วางแผน) ไม่ต้องมาจอนี้ ยกเว้นเดินโรงงาน**: เต็มจอ ไม่มีเมนูข้าง ธีมเดียวกับเว็บ · 3 ชั้น เลือกสถานี (ป้ายใหญ่ + ตัวเลข กำลังทำ/พร้อม/ติด) → คิว 3 กลุ่ม (การ์ดทั้งใบกดได้) → หน้าลงมือ (ลาย/ไซซ์ ซ้าย · ขั้นนี้ขวา: ตัวเลข → ปัญหา → ข้อกำหนดติ๊กปุ่มใหญ่ → `ActionZone touch` ปุ่มหลักปุ่มเดียว) · หัวหน้าเปิดจอเดียวกัน = แผงสถานี + ปุ่ม “แก้ให้” ทุกการ์ด · ข้อมูล `factory.stationQueue` (no-money) · ปุ่มจาก `work-order-controller` ชุดเดียวกับใบผลิต |
| `/factory` | TV อ่านอย่างเดียว แสดง WIP/load/late/exception ของ Work Center โดยไม่มี link, button หรือ mutation |
| Order / My Tasks | Order Production tab เหลือ summary+deep link; My Tasks ทุกบทบาทเข้า Control Record จนกว่าจอสถานีใหม่จะมา (เดิม route ตาม role ไป exact Station job) |
| route legacy | print runs, films และ outsource **ถอดออก 2026-09-02** พร้อมหน้ารายการผลิต (เดิม redirect เข้า `/production` เมื่อเปิด V2) |

### Data, command และ state contract

- RoutingVersion ที่ release แล้วแก้ไม่ได้; Manufacturing Order เก็บ routing/instruction/approved mockup snapshot และ operation dependency ที่ผ่าน cycle validation · ทุก lane ต้องมี path มารวมที่ Final Pack เดียวซึ่งเป็น terminal operation
- quantity แยกรายสินค้า/สี/ไซซ์/ตำแหน่งพิมพ์ พร้อม planned/good/scrap/rework; good เท่านั้นปลด successor และทุก reject ต้องมี disposition
- `OperationEvent` เป็น append-only; command ใช้ `commandId` + `expectedRevision` และ transaction/lock order ชุดเดียวเพื่อให้ retry ไม่เพิ่ม quantity, stock หรือ event ซ้ำ
- `availableCommands` และ `blockedReason` มาจาก server ตาม actor/work-center membership/assignment; Station และ Factory DTO ใช้ safe mapper ที่ไม่มีราคา ต้นทุน ค่าจ้างหรือค่าขนส่ง
- Order status เขียนผ่าน transition service จาก release/completion/QC/pack/delivery event; generic `order.updateStatus` ปฏิเสธ production-owned targets เมื่อ flag เปิด และปฏิเสธ hold/cancel/flow target จาก record จริงแม้ปิด flag หากออเดอร์มี V2 Work Order
- เมื่อสร้าง Manufacturing Order แล้ว item/variant/print definition และหลักฐานรับเสื้อบน Order เป็น read-only; writer เก่าต้องตรวจ ownership หลัง topology+order lock เพื่อไม่ให้ snapshot หน้างาน stale
- DTF batch commit ตรวจ full membership+revision แล้วรายงาน film good/scrap/reprint ต่อ quantity line; QC fail สร้าง exact defect/exception/rework target และต้องตรวจซ้ำก่อนเดินต่อ
- Final Pack completion เดิน Order เป็น READY_TO_SHIP เฉพาะเมื่อทุก enabled operation จบแล้ว; Office Delivery เท่านั้นสร้าง shipment/tracking และยืนยันส่งด้วย `ship_orders`
- scan/QR เปิด order context เท่านั้น; handoff เป็น navigation ที่ผู้ใช้ยืนยันเองและไม่ claim/start/complete
- capacity ที่ไม่มี standard time ต้องแสดง “ยังไม่ประเมิน”; ห้ามเดาค่าเพื่อเติม UI

### Visual และ verification contract

- ERP ใช้ light workspace เป็นค่าแนะนำและสีเฉพาะ semantic; Station/TV ใช้ high-contrast dark surface · สถานะต้องมีข้อความ/ไอคอนร่วมกับสี
- Production list ใช้ server-side cursor pagination; mobile เปลี่ยนเป็น scan-first cards, tablet ยอมให้ table container เลื่อนในตัวโดย document ห้าม overflow
- initial loading/error+retry/empty, cached-stale และ success ต้องแยกกัน; refresh/deep link/Back/Escape/focus/reduced-motion ใช้งานได้
- verification source คือ `scripts/verify-ui-tokens.tsx`, test ใกล้ service/router/component, `scripts/verify-production-v2-migration.sql` และ `scripts/verify-manufacturing-v2.ts`; cutover ยังต้องรอ walkthrough ของเบสและห้าม merge main/deploy ก่อนรับงาน

## Legacy factory rollback contract (ใช้เฉพาะเมื่อปิด `PRODUCTION_V2_ENABLED`)

> งานโรงงานเป็นโมดูลเดียวที่ใช้ record, permission, readiness และ transition ฝั่ง server ชุดเดียวกัน แต่แยกคำถามตามจอ:
> หัวหน้าตัดสินลำดับที่ `/production` (ถอดออก 2026-09-02 รอออกแบบใหม่ §A3), พนักงานลงมือที่จอสถานี (ถอดออก 2026-09-02 รอออกแบบใหม่ — ระหว่างนี้ผ่านใบผลิต) และทั้งโรงงานดู pulse แบบอ่านอย่างเดียวที่ `/factory` ·
> presentation ห้ามสร้าง controller, lifecycle หรือข้อมูลตัวอย่างอีกชุด

### Route, shell และ local navigation contract

| Route | Shell | หน้าที่ของจอ |
|---|---|---|
| `/production` | shared dashboard `AppShell` | โต๊ะงานหัวหน้า: ตัวเลขใหญ่ 4 ช่อง → ตาราง 8 คอลัมน์ กองตามความรีบ (ติดปัญหา → ของร้านนอกครบกำหนด → รอเปิดใบ → ลงมือได้ → รอของ → พร้อมส่ง) ตอบว่า “งานไหนต้องจัดการก่อน อยู่ขั้นไหน ของร้านนอกกลับเมื่อไร” |
| `/production/[id]` | shared dashboard `AppShell` | exception control record ของหัวหน้า: attention, plan/actual, owner, blocker, readiness, handoff และหลักฐานทั้งใบ; routine execution ไป Station · inspector มีแท็บ **เสื้อและวัตถุดิบ / ม็อกอัพ / เส้นทางทั้งหมด** |
| `/production/print-runs` | — | **ถอดออก 2026-09-02** (เดิม: workspace รอบ DTF ตามลำดับ **กำลังพิมพ์ → ตัดแยก/ติดป้าย → คิวพิมพ์ → ประวัติ 7 วัน**) |
| `/production/films` | — | **ถอดออก 2026-09-02** (เดิม: คลังฟิล์มแบบ compact: ลาย/ลูกค้า, ต้นทาง, คงเหลือ และการหยิบใช้) |
| `/outsource` | — | **ถอดออก 2026-09-02** (เดิม: คิวส่งร้าน/รับกลับ/**ตรวจรับจากร้าน**/ประวัติ; การตรวจรับนี้มาก่อน QC ขั้นสุดท้ายของออเดอร์ — กติกานี้ยังใช้กับหน้าใหม่) |
| `/production/floor` (เดิม `/station` → redirect) | ไม่มี shell (layout ของตัวเอง หลัง auth) | โหมดหน้างาน: จอทัชหน้าเครื่องของช่าง + แผงสถานีของหัวหน้าตอนเดินโรงงาน · ช่าง (`PRODUCTION_STAFF` ไม่มีสิทธิ์หัวหน้า) เปิด `/home` `/production` `/production/[id]` ถูกพามาที่นี่ (`lib/production-surface`) · เปิดใบจาก URL ได้โดยไม่ต้องรู้สถานี · สถานี = สายงานของ board (`lib/station-desk`: เตรียมเสื้อ · DTF/รีด · ร้านนอกรวมทุกประเภท · QC · แพ็ก) · ช่างเห็นเฉพาะงานของตน/ยังไม่มีคนรับ หัวหน้าเห็นข้ามคน · QC/แพ็กยังกดไปทำในหน้าออเดอร์ (หน้าลงมือของสองสถานีนี้รุ่นถัดไป) · จำสถานีล่าสุดต่อเครื่อง · เปลี่ยนคน = ออกจากระบบ |
| `/factory` | full-screen Dark TV | pulse 5 ด่านแบบ read-only หนึ่ง viewport; ไม่มี action หรือ mutation path |

- (กติกาของหน้ารายการเดิม — ถอดออก 2026-09-02 · เก็บไว้ให้หน้าใหม่ยึด) สี่หน้ารวม/พื้นที่หัวหน้าใน `AppShell` ใช้ `ProductionModuleNav` ชุดเดียวและลำดับเดียว: **คิวผลิต / รอบพิมพ์ DTF / คลังฟิล์ม / งานร้านนอก**; ทางเข้าเสริม **จอโรงงาน** อยู่ท้ายแถบและไม่สร้าง sidebar ฝ่ายผลิตอีกชุด (โหมดสถานีถอดออก 2026-09-02 — จอใหม่มาค่อยใส่ทางเข้าคืน) · control record `/production/[id]` มี breadcrumb กลับคิวและ handoff ไป work center ที่เกี่ยวข้อง แต่ไม่เพิ่ม local nav ซ้ำ
- `/production` ใช้ `production.kanban` กับ `user.me`; filter `ทั้งหมด`, `ต้องจัดการ`, `กำลังผลิต`, `รอ QC`, `แพ็ก / พร้อมส่ง`, จำนวน, search และ sort derive จาก board ชุดเดียว โดยเก็บ `view`, `q`, `sort` ใน URL
- `/production` มีสรุปวันนี้ 3 ตัวเลขเหนือชิปตัวกรอง: **เลยกำหนด / ครบกำหนดวันนี้ / กำลังลงมือ** — นับจาก `board.jobs` ทั้งกระดาน **ห้ามนับจากรายการที่กรองแล้ว** ไม่งั้นตัวเลขที่ใช้ตัดสินใจขยับใต้มือทุกครั้งที่เปลี่ยนมุมมอง · ห้ามเพิ่มยอดเงินหรือสถิติรายเดือนในแถบนี้ (หน้านี้ตัดสินลำดับงานวันนี้ ไม่ใช่รายงานผู้บริหาร)
- ทุกแถวคิว (ทั้งตาราง desktop และการ์ดมือถือ) นำหน้าด้วยรูปม็อกอัพผ่าน `MockupThumbnail` + `orderMockupCover` — หัวหน้าจำงานจากภาพเร็วกว่าเลขออเดอร์ · ไม่มีม็อกอัพอนุมัติให้ถอยไปรูปลาย/คลังลาย ไม่มีเลยจึงเป็นกรอบว่าง
- worklist เรียง exception ก่อนและไม่ทำให้ออเดอร์ผสมซ้ำหลายแถว; แถวเปิดปลายทางจริงตามสถานะ: ใบผลิต, หน้าออเดอร์แท็บผลิต/QC, หน้า delivery หรือ dialog เปิดใบผลิตตามสิทธิ์
- `/production/[id]` ฝั่ง ERP เป็น **exception control record**: หัวใบกระชับแสดงสถานะ จำนวน ความคืบหน้า และ deadline; attention แสดงข้อยกเว้นจริงเพียงเรื่องนำ; operation ledger แสดงทุก lane พร้อม actual/owner/blocker; readiness/handoff/activity เป็นข้อมูลรองเพื่อให้หัวหน้าตัดสินใจโดยไม่ทำ routine operation แทนสถานี · ฟิลด์ที่ schema/DTO ยังไม่มี เช่น production owner, per-operation plan/SLA และ audit actor/source ห้ามสร้างข้อมูลตัวอย่างหรือแสดงกรอบ data-gap ของทีมพัฒนาบน default surface: ซ่อนเมื่อไม่ช่วยตัดสินใจ และบอกขอบเขตหลักฐานด้วยภาษาผู้ใช้แบบข้อความรองเมื่อจำเป็น · งานร้านนอกที่ยัง active และเลย `expectedBackAt` ต้องยกเป็น warning attention ก่อน `IN_PROGRESS` ทั่วไป · ปุ่มบน default surface จำกัดที่มอบหมาย/แก้ exception (ปุ่มเปิดบริบท Station ถอดออกพร้อมจอสถานี 2026-09-02); operation ที่ยังไม่มี parity เช่น QC rework ที่ไม่มี target work center หรือ DTF deviation ที่ยังไม่มี event model ต้องเป็น read-only/หนี้ Phase ถัดไป ไม่คืน routine fallback บน ERP · compatibility inventory deep link คงได้เฉพาะ supervisor recovery ที่มี audit และไม่อยู่บน default control surface
- (กติกาของจอสถานีเดิม — จอถอดออก 2026-09-02 · เก็บไว้ให้จอใหม่ยึด) `/factory/station` เป็น **current-job-first execution surface**: งานที่เปิดอยู่เป็นผืนหลักพร้อม operation/จำนวน/spec และ one primary action; rail ขวาที่ 1024px แยกกำลังทำอื่น/พร้อมถัดไป/ติดปัญหาและตัด record ปัจจุบันออก; scan อยู่ใน railเมื่อมี current และอยู่ใต้ queueเมื่อยังไม่ได้เปิดงาน · `GARMENT_PICK` เดินผ่านบริการเบิก/คืน Stock, `GARMENT_RECEIVE` เดินผ่าน Goods Receipt evidence, DTF เดินผ่าน Print Run, QC/Pack ใช้ controller เฉพาะ และ `HEAT_PRESS` คง readiness gate · `แจ้งปัญหา` เป็น semantic command ที่ server derive work center/source จาก step, lock step→production→order, ตรวจ PRODUCING/ownership, บันทึก FAILED+เหตุผล+audit+notification ใน transaction เดียว และไม่รับ station/source จาก client
- `/production/print-runs` คงลำดับ DOM ตามงานจริง: พิมพ์ก่อน ตัดแยก+ติดป้าย ถัดมาคิว และประวัติท้ายหน้า; desktop เป็น workspace สองฝั่ง ส่วนจอแคบเรียงตาม DOM เดิม
- `/production/print-runs` ใช้ Sidebar + `ProductionModuleNav` เป็นลำดับชั้นนำทางอยู่แล้ว จึงไม่วาด breadcrumb ซ้ำเหนือชื่อหน้า
- `/production/films` เป็น inventory หนาแน่นพอดี ไม่ใช้สถิติ hero; `/outsource` เรียงคิวรับกลับตามกำหนดและเรียก `QC_*` เดิมใน data layer ว่า “ตรวจรับ” ใน UI เพื่อไม่ให้สับสนกับ final QC หลัง production

### Station work center และ flow (กติกาที่โหมดหน้างาน `/production/floor` รักษา — จอเดิม `/factory/station` ถอดออก 2026-09-02)

> จอใหม่ (2026-09-03) ยังยึด flow ด้านล่างทั้งหมด ต่างที่ (1) สถานีอ่านจากสายงานของ board ไม่ใช่ 5 ค่าตายตัว — ร้านนอกทุกประเภทยุบเป็นสถานีเดียว (2) ธีมเดียวกับเว็บ ไม่บังคับมืด (3) หัวหน้ามี “แก้ให้” ต่อใบบนจอเดียวกัน (ยอด · คน · ปลดปัญหา · พัก · คืนคิว · ผ่านแทน — ทั้งหมดผ่าน `updateStep`/`assignStep`/`resolveStationProblem` เดิม · “ย้อนขั้นที่ปิดแล้ว” ยังทำไม่ได้เพราะ server ไม่รับ) (4) แจ้งปัญหากดเลือกเหตุ 5 แบบ + อื่น ๆ · ข้อกำหนดต่อขั้นติ๊กบนจอแต่ยังไม่บันทึก (ROADMAP §A)

สถานีมี 5 ค่าแบบล็อก ไม่สร้าง lane ตามข้อมูลหน้างานเอง:

| Station | งานที่รับผิดชอบ |
|---|---|
| `prep` — เตรียมเสื้อ | `GARMENT_PICK` / `GARMENT_RECEIVE` |
| `dtf-print` — พิมพ์ DTF | คิวและรอบพิมพ์ DTF |
| `heat-press` — รีดร้อน | `HEAT_PRESS` หลังผ่าน readiness gate |
| `qc` — ตรวจคุณภาพ | ตรวจจำนวนดีหลัง production จบ |
| `final-pack` — แพ็คสุดท้าย | บันทึกหลักฐานจัดส่งและปิดจำนวนก่อนพร้อมส่ง |

- หน้าแรกของ Station มีตัวเลือก 5 สถานีเพียงชุดเดียว; เมื่อเลือกแล้วเก็บ `station` ใน URL · ยังไม่เปิดงานให้เรียง **กำลังทำ → พร้อมทำ → ติดปัญหา → scan**; เมื่อเปิดงานให้ current job นำและย้ายสรุปคิว/พร้อม/blocked/scan ไป rail (`dtf-print` ใช้ workspace รอบพิมพ์แทนคิวทั่วไป)
- การสแกนรับเลขออเดอร์ตรงหรือ QR ต้นทาง ERP แล้ว **เปิดบริบทเท่านั้น**; ห้าม claim, เริ่ม, จบ, แพ็ก หรือเปลี่ยนสถานะอัตโนมัติ และเมื่อออเดอร์มีหลาย production ต้องให้ผู้ใช้เลือก record เอง
- เมื่อขั้นที่เปิดอยู่จบและหลุดจาก work center เดิม ให้คงออเดอร์เดิมใน main pane แล้วแสดง handoff ที่ผู้ใช้กดยืนยันเอง: เลือก production เดิมก่อน, fallback ไป order เดิมเมื่อ production จบ, current/ready มาก่อน blocked และหลาย lane ต้องมีตัวเลือก ไม่ยุบเหลือคำว่า “ขั้นถัดไป” เดียว · DTF ready ส่งเข้า batch workspace พร้อมโฟกัส queue row เดิม; DTF active คง exact production context · งาน unmapped/CUSTOM/outsource/owner อื่นต้องหยุดพร้อมทางกลับ ERP ไม่เดาสถานี
- handoff ใช้ `factory.stationQueue` เป็นภาพรวมและ `factory.stationQueueContext` เป็น exact no-money snapshot ของ record ที่เปิดอยู่ จึงไม่ติด `take: 200`; เมื่อ mutation ทำให้คิว refresh ต้อง sync exact snapshot แล้วจึงเสนอทางต่อ · navigation ใช้ `replace` เพื่อไม่ให้ Back กลับสถานีที่ปิดแล้ว และห้ามผูก mutation ใหม่กับการเปลี่ยนหน้า
- คิว Station แสดง active/ready/blocked ของสถานี เรียงกำหนดส่งแล้วตาม priority; blocked ต้องอยู่คนละกลุ่มพร้อม `waitingOn` หรือ step note จริงและห้ามหลุดเข้า actionable queue · พนักงานเห็นเฉพาะงานของตน/ยังไม่มอบหมาย ส่วน `supervise_operations` เห็นข้าม owner · ใบงาน Station แสดงเฉพาะบริบทและ action ของสถานีปัจจุบัน
- ลำดับหลังผลิตที่ยอมรับมีชุดเดียว: **production → QC → final pack → ready**; การตรวจรับของร้านนอกอยู่ก่อน final QC · `PACKAGING` เป็น compatibility ของข้อมูลเก่าเท่านั้น ห้ามสร้างเป็น `ProductionStep` ใหม่ และ recovery ต้องส่งกลับเข้า QC
- `/factory` เรียง pulse 5 ด่าน **เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็กสุดท้าย** พร้อม active/queue/next, rail ด่วน/ติดปัญหา และผลลัพธ์พร้อมส่ง; QC กับแพ็กต้องเป็นคนละด่านเสมอ
- กฎ due sort, readiness, `evaluateHeatPressGate`, จำนวนที่ทำได้ และ status transition เป็น source of truth ฝั่ง server ห้ามหน้า UI คำนวณกฎธุรกิจคู่ขนาน

### Desktop/touch, permission, cache, error และ no-money contract

- composition ตั้งต้นที่ desktop `1440×900` และจอทัช `1024×768`; `390px` เป็น regression guard ที่ยังต้องใช้ flow ได้ครบและไม่เลื่อนแนวนอน · control บน mobile/`pointer: coarse` ≥44×44px ส่วน fine-pointer desktop ใช้ density 36px ได้
- ทุก `/factory*` ต้องมี session และทุก query เป็น protected procedure; mutation control ต้อง **fail closed** จนรู้ permission และ server guard เป็นด่านสุดท้ายเสมอ
- ไม่มี `manage_production` = Station/print run/film เป็น read-only; `supervise_operations` จึงเห็นงานข้ามผู้รับผิดชอบ และการตัดสินตรวจรับร้านนอกต้องมีทั้ง `manage_production` + `supervise_operations`; final pack ที่สร้าง delivery ต้องมี `manage_production` + `manage_delivery` และการเปลี่ยนเป็นพร้อมส่งต้องมี `update_order_status_production` เพิ่ม
- live queue (`/production`, print runs, Station — ทั้งสามถอดออก 2026-09-02 รอออกแบบใหม่ — และ TV) poll ทุก 30 วินาทีตามจอที่กำหนดและ refetch เมื่อ focus/reconnect; initial loading, initial error+retry, empty, blocked และ read-only ต้องแยกกัน · background error ต้องคง cached data พร้อมคำเตือนแทนการล้างจอ
- TV เตือน stale เมื่อไม่ได้ refresh สำเร็จเกิน 2 นาทีและคง snapshot ล่าสุด; pending action ใช้ข้อความ “กำลัง…” + `aria-busy`, error/retry มี label ที่อ่านได้ และ focus/keyboard/reduced-motion ไม่พึ่ง hover
- worklist, control record, print run, film และ outsource ไม่เพิ่มราคา/ยอดออเดอร์/ค่าจ้าง · Station/TV ต้องไม่ขนส่งหรือ render เงินแม้ role เป็น OWNER, ไม่ mount `MaterialUsage` และ final pack ไม่ส่ง shipping cost มาที่ client; compatibility deep link ของ ERP อาจเปิดข้อมูลวัตถุดิบเดิมได้เฉพาะ `see_finance` แต่ไม่อยู่บน default control surface
