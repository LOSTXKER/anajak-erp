# แผนออกแบบจอโรงงาน — ทีวีคิวรวม (read-only) + จอทัช/มือถือช่าง

> วางแผนอย่างเดียว (2026-07-07) — ยังไม่แตะโค้ด · มติเบส: **ทีวีโชว์คิวรวม read-only + จอทัช/มือถือให้ช่างกดรับงาน-ปิดขั้น-ดูลาย**
> กรอบบังคับ: DESIGN.md (token 3 ชั้น · mobile-first · เป้านิ้ว ≥44px) · B8 ห้ามของปลอม/ปุ่มหลอก · PERM (จอโรงงาน**ห้ามมีเงินเด็ดขาด**) · status เดินผ่าน `isValidTransition` ฝั่ง server เท่านั้น

---

## ① ข้อมูลที่มีให้ใช้แล้วในระบบ (สำรวจจากโค้ดจริง)

### คิวงาน — `task.myToday` (src/server/routers/task.ts:22-461)

| ก้อน | ที่มา | เงื่อนไขกรอง | มีเงินไหม |
|---|---|---|---|
| `production` | task.ts:43-92 | ขั้นค้างทุกสถานะรวม FAILED/ON_HOLD เด่นก่อน (PROBLEM_FIRST task.ts:40) · ตัด DTF_PRINT/HEAT_PRESS ออก (มีคิวเฉพาะ) · ขั้นแพ็คผ่านด่าน `packGateReady` (task.ts:17-19) | ไม่มี |
| `printQueue` | task.ts:96-98 → `getPrintQueue` (src/server/services/print-run.ts:55-119) | ไฟล์พร้อม (แบบ APPROVED) + ไม่ติดรอบ active + ยังพิมพ์ไม่ครบ · เรียงกำหนดส่ง | ไม่มี |
| `pressQueue` | task.ts:102-151 | ผ่าน gate `evaluateHeatPressGate` (src/lib/production-steps.ts:144-161 — ฟิล์มเสร็จ∧เสื้อพร้อม) · มี qtyDone/qtyTotal | ไม่มี |
| `packQueue` | task.ts:155-210 | ผ่าน `packGateReady` + dedupe ต่อใบผลิต · มีธง `blindShip` (task.ts:179) | ไม่มี |
| `awaitingProduction` | task.ts:214-224 | ออเดอร์เข้าคิวแต่ยังไม่มีใบผลิต (งานหัวหน้า) | ไม่มี |
| `adminToday` | task.ts:273-387 | ร้านนอกครบกำหนดรับ / รอตรวจรับเสื้อ / ค้างอนุมัติแบบ / ครบกำหนดส่งวันนี้-พรุ่งนี้ — comment ระบุ "ops ล้วน ห้ามมีเงิน" | ไม่มี |
| `followUp` / `billing` | task.ts:255-270, 390-426 | `totalAmount` / `overdueInvoices` | **มีเงิน — ห้ามขึ้นจอโรงงาน** |

ข้อจำกัดสำคัญ: `myToday` เป็น **protectedProcedure ผูกคนที่ login** (`ownWorkOnly` task.ts:26, ctx.userId ใน where task.ts:52-54) — ทีวีที่ไม่มีคน login ใช้ endpoint นี้ตรงๆ ไม่ได้ ต้องมี endpoint ใหม่ที่ (ก) ไม่ผูก user (ข) ตัดก้อนเงินออกโดยโครงสร้าง

### รอบพิมพ์ — src/server/services/print-run.ts
- จังหวะรอบ: `PRINTING → PRINTED → COMPLETED` (comment print-run.ts:8-11 — ปิดขั้นสมาชิกตอน COMPLETED เท่านั้น กันฟิล์มสลับออเดอร์)
- `listPrintRuns` (print-run.ts:401-422) — รอบ active + ประวัติ 7 วัน พร้อม items/qty/สถานะขั้น → ทีวีใช้โชว์ "รอบพิมพ์ที่กำลังเดิน" ได้เลย
- mutation ครบสำหรับจอช่างพิมพ์: `createPrintRun` (:131), `markPrintRunPrinted` (:243), `completePrintRun` (:260), `cancelPrintRun` (:361) — ใช้อยู่แล้วบนหน้า /production/print-runs (641 บรรทัด)

### ขั้นผลิต + เลน — src/lib/production-steps.ts
- `STEP_TYPE_LABELS` (:7), เลน `laneOf`/`LANE_LABELS` (:99-120), `evaluateHeatPressGate` (:144) พร้อม `waitingOn` ข้อความไทย ("รอฟิล์ม…"/"รอเสื้อ…" :158-159) — ทีวีใช้บอก "งานติดอะไร" ได้ทันที
- ปิดขั้น/รับงาน: `production.updateStep` (src/server/routers/production.ts:395-539) — staff **auto-claim** ขั้นที่ยังไม่มีเจ้าของ (production.ts:429-439) · guard ขั้นที่ติดรอบพิมพ์ (:444-454) · guard outsource ค้าง (:458-480) · จบด้วย `finalizeProductionIfComplete` (:507) → status ออเดอร์เดิน server-side ถูกกติกาแล้ว **จอช่างไม่ต้องสร้าง mutation ใหม่เลย**

### ด่านพร้อมผลิต — src/server/services/production-readiness.ts
- `evaluateReadiness` (:68-134) — 3 เช็ค เงิน/แบบ/ของ ⚠️ **detail ของเช็คเงินมีตัวเลขบาท** (`fmtBaht` :65-66, "รับแล้ว x/y บาท" :84) → จอโรงงานห้ามใช้ก้อนนี้ตรงๆ ถ้าจะโชว์ "งานติดอะไร" ให้ใช้เฉพาะ `ok` + `waitingOn` (ไม่มีเลขเงิน) หรือไม่ขึ้นเช็คเงินเลย

### ลาย + ตารางไซส์ (สิ่งที่ช่างต้อง "ดู")
- ใบสั่งงานพิมพ์ `/print/job-ticket/[id]` (src/app/(print)/print/job-ticket/[id]/page.tsx:48,74,84,230) ประกอบครบแล้ว: แบบ APPROVED ล่าสุด + variants ต่อไซส์ — เป็น server component ฝั่ง session
- แต่หน้าใบผลิต `/production/[id]` ที่ช่างใช้จริง **ไม่มีรูปลาย/ตารางไซส์**: `production.getById` (production.ts:97-122) select แค่ order header + `items.totalQuantity` (:116) — ช่างต้องกดออกไป "ใบสั่งงาน" (PDF-style) หรือหน้าออเดอร์ (production/[id]/page.tsx:112,118) ซึ่งบนจอทัชคือหลุด flow
- รูปเสิร์ฟผ่าน proxy `/api/files/<bucket>/<path>` — เช็ค session หรือ approval token เท่านั้น (src/app/api/files/[...path]/route.ts:16-21,60-70) → **จอที่ไม่ login เปิดรูปลายไม่ได้** (มีผลต่อการตัดสินใจข้อ ②)

### precedent auth ที่มีแล้ว (สำหรับจอไม่มีคน login)
1. **Secret-URL token**: ใบงานร้านนอก `/job/[token]` — เช็ค `shareToken` + วันหมดอายุ, payload ถูก sanitize เป็น public-safe (src/app/job/[token]/page.tsx:25-29 · src/server/services/outsource-share.ts:47-62) · middleware ยกเว้น path นี้จาก redirect /login (src/middleware.ts:77)
2. **Device API key**: `AgentApiKey` ของ MCP — key เก็บ sha256 hash, prefix `ana_`, ผูก User จริง → ได้ role/permissionOverrides, fail-closed (ไม่มี/หมดอายุ/user ปิด = 401), revoke ได้, `lastUsedAt` (src/lib/mcp/auth.ts:20-84 · src/app/api/mcp/[transport]/route.ts:35-36)

### UI precedent
- จอเช้า `/my-tasks` (465 บรรทัด) — `TaskSection`/`TaskRow` แถวกดได้ ≥56px (page.tsx:88-120) แต่มีเงิน (formatCurrency :422,:441 — gate ด้วยสิทธิ์ฝั่ง server แล้ว)
- `/production/[id]` = "บ้านของฝั่งโรงงาน… ช่างใช้หน้านี้บนมือถือหน้างาน — ไม่มีเงินของออเดอร์บนหน้านี้" (page.tsx:39-40) — มี quickPass + StepUpdateDialog + GarmentPickCard แล้ว
- DESIGN.md: token 3 ชั้น ห้าม hex ตรง · mobile-first ops (เป้านิ้ว ≥44 · sticky bottom bar · ตาราง→การ์ด)

---

## ② ทีวีคิวรวม — route ใหม่ `/factory` (read-only)

### หลักออกแบบ
จอเดียวตอบ 4 คำถามของคนยืนห่าง 3-5 เมตร: **ตอนนี้เครื่องพิมพ์ทำรอบไหน · คิวถัดไปคืออะไร · งานไหนด่วน/เลยกำหนด · งานไหนติดปัญหา** — ไม่มี interaction ใดๆ (ทีวีไม่มีเมาส์ — ทุกข้อมูลต้องเห็นจบโดยไม่ hover/กด)

### เนื้อหา (บน→ล่าง / ซ้าย→ขวา)
1. **แถบหัว**: โลโก้ + นาฬิกาสด + วันที่ไทย + ตัวชี้ความสดของข้อมูล ("อัปเดต 14:02" — ถ้า fetch พังเกิน 2 รอบ ขึ้นแถบเหลืองใหญ่ "ข้อมูลค้างตั้งแต่ 14:02" ตามกติกา B8 ห้ามแสร้งว่าสด)
2. **แถบแดง "งานมีปัญหา/เลยกำหนด"** (โชว์เฉพาะเมื่อมี): ขั้น FAILED/ON_HOLD (มีอยู่แล้วใน production pile, PROBLEM_FIRST task.ts:40) + ออเดอร์เลยกำหนดที่ยังเดิน — เลขออเดอร์ + ชื่องาน + ติดอะไร (`waitingOn` จาก gate)
3. **คอลัมน์ DTF**: (ก) รอบพิมพ์ที่กำลังเดิน จาก `listPrintRuns` — เลขรอบ · สถานะ PRINTING/PRINTED(รอตัดแยก) · งานสมาชิก x/y ชิ้น (ข) คิวพิมพ์ถัดไปจาก `getPrintQueue` 6-8 แถวแรก + "+N งาน"
4. **คอลัมน์รีด**: pressQueue (ผ่าน gate แล้ว = ลงมือได้จริง) — งาน · รีดแล้ว x/y · กำหนดส่ง
5. **คอลัมน์แพ็ค**: packQueue — งาน · กำหนดส่ง · ธง **BLIND SHIP ตัวใหญ่สีแดง** (พลาดครั้งเดียวเสียลูกค้า reseller — task.ts:179)
6. **แถวล่าง "กำลังจะมา"**: dueSoon วันนี้-พรุ่งนี้ + ร้านนอกครบกำหนดรับ (จาก adminToday shape — ops ล้วน)

**ไม่ขึ้น**: เงินทุกช่อง (followUp/billing/readiness-detail เช็คเงิน) · ชื่อลูกค้า → เคาะให้ขึ้นได้ (ทีมในโรงงานเอง ไม่ใช่จอลูกค้าเห็น) แต่ตัดได้ง่ายถ้าเบสไม่เอา · รูปลาย (ติด auth /api/files — จอ read-only ไม่จำเป็น ช่างดูลายบนจอทัชที่ login แล้ว)

### endpoint ใหม่ `factory.board` (ห้ามยัดใน myToday)
- Query เดียว คืน `{ activeRuns, printQueue, pressQueue, packQueue, problems, dueSoon, outsourceDue }` — **ไม่มี field เงินโดย type** (ปลอดภัยเชิงโครงสร้าง ไม่ใช่แค่ "อย่าลืม filter")
- ทำแบบ surgical: ดึง query body ของ pressQueue/packQueue จาก task.ts:102-210 ออกเป็น service (`src/server/services/factory-board.ts`) แล้วให้ทั้ง `task.myToday` และ `factory.board` เรียกตัวเดียวกัน (ตามกติกา business logic อยู่ services/) — `getPrintQueue`/`listPrintRuns` reuse ได้ทันที · ย้าย `packGateReady` (task.ts:17) ไปอยู่ข้าง `evaluateHeatPressGate` ใน src/lib/production-steps.ts (มี unit test อยู่แล้วไฟล์คู่)
- จอทีวีไม่ผูกคน → ไม่ใส่ `ownWorkOnly` — โชว์คิวรวมทั้งโรงงาน

### auth ของจอที่ไม่มีคน login — เทียบ 2 ทาง

| | ทาง A: **Display token แบบ AgentApiKey** (แนะนำ) | ทาง B: secret URL ใน SystemSetting |
|---|---|---|
| วิธี | ตาราง/แถวใหม่ทำนอง `DisplayToken` (หรือ reuse `AgentApiKey` + ธง scope `display`) — เก็บ **hash** (pattern src/lib/mcp/auth.ts:22-24) · จอเปิด `/factory?k=<token>` ครั้งแรก → เก็บ localStorage → เรียก `factory.board` (publicProcedure + input token) | เก็บ token plaintext ใน SystemSetting (แบบ `stock_api_key` — src/lib/stock-api.ts:402) · จอเปิด `/factory/<token>` |
| fail-closed | ✅ ไม่มี/ผิด/revoke/หมดอายุ = จอ "ยังไม่ได้ลงทะเบียน" (เหมือน 401 ของ MCP route.ts:35) | ✅ ได้เหมือนกัน |
| revoke รายจอ | ✅ ปิดจอเดียวได้ + เห็น `lastUsedAt` ว่าจอไหนยังหายใจ | ❌ เปลี่ยน token = จอทุกตัวหลุดพร้อมกัน |
| token รั่ว | hash ใน DB ไม่รั่วจาก dump · ตัว raw อยู่แค่บนจอ | plaintext ใน DB · อยู่ใน URL เต็มๆ (history/photo ของจอ) |
| งานสร้าง | มากกว่า: model(±migration) + UI จัดการใน Settings (ลอก UI agent key ที่มีอยู่) | น้อยกว่ามาก: setting ช่องเดียว |
| ความเสี่ยงคงเหลือ | ต่ำ — endpoint read-only ไม่มีเงินอยู่แล้ว | ยอมรับได้เพราะข้อมูลเป็น ops ล้วน แต่ผิดมาตรฐานที่ repo เพิ่งยกระดับเอง (mcp/auth.ts:7 บอกชัดว่า hash คือการยกระดับจาก stock_api_key) |

**คำแนะนำ: ทาง A** — โรงงานมีหลายจอในอนาคต (ทีวี + จอทัช) revoke รายจอจำเป็นจริง และ pattern+UI มีให้ลอกครบแล้ว blast radius ของ token รั่ว = เห็นคิวงาน (ไม่มีเงิน) เท่านั้น · ถ้าเบสอยากได้เร็วสุดใน sprint แรก ใช้ทาง B ชั่วคราวได้แต่ต้องบันทึกหนี้ไว้ใน ROADMAP
- middleware: เพิ่ม `factory/` เข้า matcher exclusion (src/middleware.ts:77 — แถวเดียว pattern เดียวกับ `job/`)
- **ต้องเป็น fail-closed ทั้ง 2 ชั้น**: หน้า `/factory` ไม่มี token ที่ verify ผ่าน = โชว์จอลงทะเบียนเท่านั้น (ไม่ render โครงคิวเปล่า) · `factory.board` ไม่มี token = TRPCError UNAUTHORIZED

### ฟอนต์/contrast ระยะ 3-5 เมตร
- กฎหยาบ: อ่านที่ 4 ม. ต้องสูง ≥ x-height ~23px → **ฐานตัวอักษร 28-32px · เลขออเดอร์/หัวคอลัมน์ 40-48px `font-semibold` · ตัวเลขนับ `tabular-nums`** (ห้ามใช้ 13px ฐานของ dashboard — จอนี้มีสเกลของตัวเอง แต่**สีต้องมาจาก token เดิม** ห้าม hex ใหม่ ตาม DESIGN.md)
- ธีมมืด (พื้น slate-950 ตัวหนังสือขาว) — โรงงานสว่าง จอมืด contrast ชนะแสงสะท้อน + ลด burn-in · สถานะใช้สี semantic เดิม: แดง danger = ปัญหา/เลยกำหนด · เหลือง warning = ใกล้กำหนด/รอตัดแยก · เขียว success = กำลังเดิน
- จำกัดต่อคอลัมน์ ~6-8 แถว + "+N งาน" — **ไม่ทำ marquee/auto-scroll** (อ่านไม่ทัน + ของแถวหายตอนกำลังอ่าน) ถ้าคิวล้นบ่อยค่อยพิจารณาสลับหน้าทุก 15 วิ เป็นงานหลัง
- layout `grid` fix ความสูง 100vh ไม่มี scroll (ทีวีไม่มีใคร scroll)

### auto-refresh
- `refetchInterval: 30_000` + `refetchIntervalInBackground: true` (tRPC/react-query มีให้ ไม่ต้องสร้างอะไร) — โหลด DB ต่ำ (query ก้อนเดียว/30วิ/จอ) · ไม่ทำ websocket/realtime ในเฟสนี้ (over-engineer สำหรับทีม 5 คน)
- กันจอค้างเงียบ: เก็บ `dataUpdatedAt` — เกิน 2 นาทีขึ้นแถบเตือนข้อมูลค้าง (B8)
- กัน memory leak จอเปิด 24 ชม.: หน้าเบา ไม่มี dialog/form · แนะนำตั้งทีวี auto-reload กลางคืน (หรือ `location.reload()` วันละครั้งตอน 04:00 — กันของค้างสะสมแบบถูกสุด)

---

## ③ โหมดช่างบนจอทัช/มือถือ — เทียบ 2 ทาง

| | ทาง A: **ต่อยอดหน้าเดิม** `/my-tasks` + `/production/[id]` + `/production/print-runs` (แนะนำ) | ทาง B: หน้า kiosk ใหม่ `/factory/station` + บัญชีกลางประจำจอ |
|---|---|---|
| login | ช่างคนจริง login บน tablet (PERM ตัดเงินให้แล้วทั้ง server: task.ts gate ต่อสิทธิ์ · production/[id] ไม่มีเงินโดยออกแบบ page.tsx:40) | บัญชี "จอ DTF" ใช้ร่วม |
| audit/claim | ✅ auto-claim + `changedBy` เป็นคนจริง (production.ts:429-439, :384) — ตอบได้ว่าใครปิดขั้น | ❌ ทุกงานลงชื่อ "จอ DTF" — PERM รายคน + audit ที่เพิ่งสร้างทั้งโปรเจกต์ (PERM1-5) ไร้ความหมายบน flow ผลิต |
| งานสร้าง | น้อย — เติมของที่ขาด 3 จุด (ล่าง) | มาก — หน้าใหม่ทั้งชุด + ระบบเลือกตัวตนต่อ action (แตะชื่อก่อนกด?) = สร้าง auth layer ใหม่ |
| ความเสี่ยง | session ค้างคาจอ → คนอื่นกดในนามคนเดิม (ดู ④) | ความเสี่ยง audit ถาวรโดยโครงสร้าง |

**คำแนะนำ: ทาง A** — ระบบออกแบบมารองรับ mobile หน้างานอยู่แล้ว (comment ระบุตรงๆ production/[id]/page.tsx:40) และ mutation `updateStep` มีกติกา own-work/auto-claim/guard ครบ ทาง B ขัดกับการลงทุน PERM ทั้งก้อนที่เพิ่งจบ (git log: PERM2-5)

### สิ่งที่ต้องเติม (จากช่องว่างจริงที่เจอ)

**(1) การ์ด "ลายงาน + ตารางไซส์" บนหน้า `/production/[id]`** — ช่องว่างหลัก
- ปัญหา: ช่างจะดูลาย/ไซส์ต้องเด้งไปใบสั่งงาน print หรือหน้าออเดอร์ (production/[id]/page.tsx:112,118) — หลุด flow บนจอทัช
- แก้: ขยาย `production.getById` (production.ts:97-122) ให้ select เพิ่ม: แบบ APPROVED ล่าสุด (`designs` where APPROVED take 1 — pattern เดียวกับ job-ticket/[id]/page.tsx:74-84) + `items → products → variants {size, quantity}` + สี/รายละเอียดสินค้า แล้ว render เป็นการ์ดใหม่ใต้แถบบริบทงาน: รูปลายกดขยายเต็มจอ (dialog รูปเดียว ไม่ใช่ lightbox library ใหม่) + ตารางไซส์ (`hidden sm:block` ตาราง / การ์ดบนจอเล็ก ตาม DESIGN.md) — รูปผ่าน `/api/files` เดินได้เพราะ tablet มี session
- ไม่มีเงินเพิ่มขึ้นบนจอ: variants/design ไม่มี field ราคา

**(2) ปุ่ม "รับงาน" ชัดๆ + ปุ่มใหญ่บนขั้นตอน**
- ตอนนี้ staff claim งานแบบ "auto ตอนอัปเดตครั้งแรก" (production.ts:425-427 — comment บอกเองว่าเพราะยังไม่มี UI มอบหมาย) — ช่างหน้างานไม่รู้ว่าใครถืองานอยู่จนกว่าจะกดเข้า dialog
- แก้ที่ `ProductionStepsList`/`StepUpdateDialog` (src/components/production/): ขั้นที่ `assignedToId = null` และสถานะ PENDING → ปุ่มหลัก `size="lg"` "รับงานนี้" (ยิง `updateStep {status: IN_PROGRESS}` — auto-claim ฝั่ง server จัดการเอง **ไม่ต้องมี mutation ใหม่ ไม่แตะกติกา status**) · ขั้นของฉันที่กำลังทำ → ปุ่มหลัก "เสร็จแล้ว" + รอง "บันทึกจำนวน/ติดปัญหา" (เปิด dialog เดิม) · แถวโชว์ชื่อคนถือ + gate `waitingOn` ที่มีอยู่
- จอทัช = ใช้หน้าเดียวกับมือถือ — ไม่แตก layout พิเศษ แค่คุมเป้ากด ≥44px ตาม DESIGN.md ที่บังคับอยู่แล้ว

**(3) จุดเข้าเร็วสำหรับช่าง**: `/my-tasks` เป็นจอเช้าอยู่แล้วและ section โผล่ตามสิทธิ์ — ช่างเห็นเฉพาะคิวผลิต (followUp/billing ไม่โผล่เพราะ gate `can("create_sales_docs")`/`can("see_finance")` task.ts:255,390) → ใช้เป็น home ของ tablet ได้เลย ไม่ต้องสร้างหน้าใหม่ · งานเดียวที่ควรทำ: ทำ shortcut/บุ๊กมาร์กจอเป็น `/my-tasks` (PWA icon — ไม่ใช่งานโค้ด)

---

## ④ Reuse vs สร้างใหม่ + ความเสี่ยง

### Reuse ได้ (ไม่แตะ)
- `getPrintQueue` / `listPrintRuns` / mutation รอบพิมพ์ทั้งชุด (print-run.ts)
- `evaluateHeatPressGate` + `waitingOn` (production-steps.ts:144) · `updateStep` + auto-claim + guards (production.ts:395)
- pattern token: hash+fail-closed จาก mcp/auth.ts · middleware exclusion จาก middleware.ts:77 · UI จัดการ key ใน Settings
- ระบบสิทธิ์ PERM ทั้งก้อน + design token/component (badge/empty-state/skeleton/query-error)

### แตะแบบ surgical
- ย้าย query pressQueue/packQueue (task.ts:102-210) + `packGateReady` (task.ts:17) → service/lib กลาง ให้ myToday กับ factory.board ใช้ร่วม (กัน drift สองสำเนา)
- ขยาย select ของ `production.getById` (designs + variants)
- `ProductionStepsList`/`StepUpdateDialog` — เพิ่มปุ่มรับงาน/ปุ่มใหญ่

### สร้างใหม่
- route group `/factory` (นอก `(dashboard)` — ไม่มี sidebar/chrome) + component สเกลทีวี
- `factory.board` (publicProcedure + display token) + service `factory-board.ts`
- DisplayToken (model หรือ scope บน AgentApiKey — **แตะ schema = ถามเบสก่อนตามกติกา permission**) + แถบจัดการใน Settings

### ความเสี่ยง & ทางกัน
1. **จอทัชทิ้งไว้ค้าง session** → คนอื่นกดปิดขั้นในนามคนเดิม: ความเสี่ยงจริงแต่ทีม 5 คนรู้หน้ากันหมด — ชั้นกันที่คุ้ม: โชว์ชื่อ+avatar คนที่ login ใหญ่ๆ มุมจอทุกหน้า ops + ปุ่ม "สลับคน" (logout เร็ว) · ไม่ทำ PIN ต่อ action ในเฟสแรก (เพิ่ม friction จนช่างเลิกใช้ — แลกไม่คุ้ม บันทึกไว้เป็น option ถ้าเกิดปัญหาจริง)
2. **ทีวี token รั่ว** (ถ่ายรูปจอ/URL): เห็นได้แค่คิว ops ไม่มีเงิน + revoke รายจอได้ (ทาง A) — ยอมรับได้
3. **สองสำเนา query drift** (myToday vs factory.board): กันด้วยการ extract service ก่อนใน FD1 — ห้าม copy-paste
4. **จอทีวีโชว์ข้อมูลค้างเงียบๆ**: แถบ "ข้อมูลค้างตั้งแต่ HH:MM" บังคับ (B8) — ห้ามปล่อยจอสวยแต่โกหก
5. **readiness detail มีเลขเงิน** (production-readiness.ts:84): ถ้าอนาคตจะโชว์ "ติดอะไร" บนทีวี ใช้เฉพาะ `waitingOn` — ระบุใน spec ของ FD1 กันคนหยิบผิดก้อน
6. **โหลด DB จาก polling**: 2-3 จอ × query/30วิ = จิ๊บจ๊อย — ไม่ต้อง cache เพิ่ม

---

## ใบงานเสนอ (ลำดับลงมือ — session หน้า)

- **FD1 — server**: extract `factory-board.ts` service (ย้าย pressQueue/packQueue/packGateReady + ประกอบ problems/dueSoon) + `factory.board` endpoint token-gated ไม่มี field เงิน + display token (เคาะทาง A/B กับเบสก่อน — แตะ schema) · acceptance: เรียกด้วย token ถูก = ได้ข้อมูล / ไม่มี token = UNAUTHORIZED / ทั้ง payload ไม่มี field เงิน (ยืนยันด้วย type) / myToday ผลเท่าเดิมเป๊ะ
- **FD2 — ทีวี**: `/factory` page ธีมมืดสเกลใหญ่ + refetch 30วิ + แถบข้อมูลค้าง + middleware exclusion · acceptance: เปิดบนทีวีจริง อ่านเลขออเดอร์ออกที่ 4 เมตร / ถอด token แล้วจอปิดสนิท
- **FD3 — จอช่าง**: การ์ดลาย+ตารางไซส์บน `/production/[id]` (ขยาย getById) + ปุ่มรับงาน/เสร็จแล้ว size lg บน steps list · acceptance: ช่าง flow เดียวจบบน tablet — เห็นลาย เห็นไซส์ กดรับ กดปิด โดยไม่ออกจากหน้า / staff แตะงานคนอื่นไม่ได้เหมือนเดิม
- **FD4 — เก็บ**: ชื่อคน login เด่น + ปุ่มสลับคนบนหน้า ops · Settings UI จัดการ display token · (option) auto-reload ทีวีตี 4

> เปิดงานจริงต้องเพิ่มก้อนนี้เข้า ROADMAP ก่อน (กติกาวงจรการทำงานข้อ 1) และการแตะ schema (DisplayToken) ต้องผ่านเบสก่อนตาม permission ชั้น ⚠️
