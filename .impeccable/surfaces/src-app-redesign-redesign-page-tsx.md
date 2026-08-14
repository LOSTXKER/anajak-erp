---
version: 1
slug: "src-app-redesign-redesign-page-tsx"
primary_target: "src/app/(redesign)/redesign/page.tsx"
related_targets: ["src/app/(redesign)/redesign.css","src/app/(redesign)/redesign/orders/page.tsx","src/app/(redesign)/redesign/orders/[id]/page.tsx","src/app/(redesign)/redesign/production/page.tsx","src/components/redesign/redesign-shell.tsx","src/components/redesign/erp-command-center.tsx","src/components/redesign/redesign-orders-registry.tsx","src/components/redesign/redesign-order-detail.tsx","src/components/redesign/redesign-production-control.tsx","src/lib/order-list-contract.ts","src/lib/order-list-contract.test.ts","src/lib/redesign-flow.ts","src/lib/redesign-order-detail.ts","src/lib/redesign-order-detail.test.ts","src/lib/redesign-production.ts","src/lib/redesign-production.test.ts","src/lib/redesign-navigation.ts","src/lib/redesign-navigation.test.ts","src/server/routers/production.ts","src/server/routers/production.readiness-permission.test.ts"]
---

# Scope and mode

- Surface ที่ ship: ต้นแบบหลัง login แยกที่ `/redesign`, Orders Registry ที่ `/redesign/orders`, Order Workbench ที่ `/redesign/orders/[id]` และ Production Control ที่ `/redesign/production`; route เดิมยังเป็น canonical.
- สถานะ: shipped prototype, ผ่าน finish review 2026-08-14.
- Mode: Operate.
- ผู้ใช้หลัก: เจ้าของ/ผู้จัดการ โดย navigation และข้อมูลของทีม 5 คนยังถูกกรองตามสิทธิ์.
- งานหลัก: รู้ในไม่กี่วินาทีว่าเรื่องใดต้องแทรกแซง เห็นตำแหน่งออเดอร์ในสายงาน และเปิด record จริงเพื่อทำต่อ.
- Primary action: เปิดความเสี่ยงถัดไป หรือเปิดงานจริงเมื่อมีสิทธิ์.

# Data truth and boundaries

- ใช้ source จริงเท่านั้น: `analytics.dashboard`, `analytics.ownerPulse`, `order.list`, `order.getById`, `production.kanban`, conditional order context/billing, `user.me`, navigation registry กลาง, pure view models และ canonical routes.
- แถวออเดอร์ จำนวนแต่ละช่วง ข้อยกเว้น notification ค้นหา navigation และ drill-through มาจากข้อมูลจริงหรือ route เดิม; ไม่มี metric ปลอมหรือ action ตาย.
- เงิน owner pulse การเปิดงาน และ navigation ถูก gate ตามสิทธิ์และ fail closed. คนไม่มีสิทธิ์รายงานบริหารเห็นทางไปคิวส่วนตัวจริงแทนข้อมูลเสี่ยงรวม.
- loading, primary error+retry, attention error+retry, empty และ permission fallback แยกกัน.
- ไม่เพิ่ม schema, dependency, config, business logic หรือ mutation; prototype เป็น read/triage layer ส่วน canonical `/orders*` และ `/production*` ยังเป็น controller/source of truth. Public, print, auth, factory และ canonical presentation ไม่ถูก restyle.
- เว็บ custom-print แบบ self-serve ในอนาคตเป็น source ที่เข้า lifecycle นี้ ไม่ใช่หลังบ้านอีกชุด; ห้ามโชว์ source badge จนมี field/API จริง.

# Shipped direction

- Thesis: หนึ่งสายงานสดตั้งแต่รับงานถึงปิดงาน ไม่ใช่ dashboard การ์ดทั่วไป.
- World: Swiss industrial manual + ใบงานโรงงาน ผ่าน Anajak cobalt `#3973b2`, กระดาษทำงาน, เส้น blueprint บาง และหมึกเข้ม; seed key `953c4cb7`.
- Story: เห็นข้อยกเว้น → ไล่ออเดอร์ผ่าน 7 ช่วง → เปิด record จริงเพื่อทำต่อ.
- First viewport: desktop ให้ Flow Matrix นำและวาง exception docket ข้างกัน; mobile เริ่มที่ข้อยกเว้นก่อนจำนวนช่วงงานและออเดอร์.
- Comp ที่อนุมัติ: `.impeccable/mocks/flow-matrix.png`.
- จังหวะจำ: hover/focus ออเดอร์หนึ่งแถวแล้ว rail ทั้งเส้นชัดขึ้น ขณะ docket ข้างกันบอกเรื่องที่ต้องขยับ.
- Brand: Printer mark เดิม + wordmark “Anajak ERP”; โลโก้ A ที่ comp แต่งขึ้นไม่ได้ ship และห้ามคัดลอก.
- Form: เส้นบาง, spacing แบบใบงาน, ไอคอนเส้น; ไม่มี gradient, glow, hero card หรือขอบหนาตกแต่ง.

# As-built topology

## Desktop

- top bar cobalt สูง 64px พาดเต็มจอ; navigation แบ่งกลุ่มตามสิทธิ์อยู่ใน sidebar 256px ตั้งแต่ `lg`.
- ที่ `xl` พื้นที่คำสั่งแบ่ง 4 คอลัมน์: Flow Matrix + capacity strip เต็มใช้ 3 คอลัมน์ และ exception docket ใช้ 1.
- first viewport มี recent order 5 แถวเต็ม, legend 5 state และ capacity strip 7 ช่วงครบ; ห้ามเติมแถวจากข้อมูลตัวอย่างใน comp.
- Orders Registry ใช้ semantic table + sortable headers; Production Control ใช้ exception/readiness docket นำ แล้วจึงเป็น release queue และ factory lane control board.

## Mobile

- ต่ำกว่า `xl` เปลี่ยน composition ไม่ย่อ matrix: exception docket → สรุป 7 ช่วง → การ์ดออเดอร์ล่าสุด.
- bottom nav คงที่มี Dashboard, My Tasks, Orders, Production และ All โดยกรองจาก navigation registry ตามสิทธิ์ชุดเดิม.
- การ์ดคงสถานะ ช่วงงาน กำหนดส่ง และ drill-through จริง; control รักษา touch target ขั้นต่ำ 44px ตาม P1.0.
- Registry เปลี่ยน table เป็น whole-card links + bottom-sheet filters; Production เปลี่ยน board เป็น exception → lens/filter → work cards โดยไม่สร้าง horizontal desktop UI บนมือถือ.

# Flow semantics

- 7 ช่วง: **รับงาน → อาร์ตเวิร์ก → ความพร้อม → DTF ภายใน → งานร้านนอก → QC / แพ็ค → ส่ง / ปิด**.
- DTF กับร้านนอกเป็น alternate lanes: งานภายในติด DTF, งาน outsource ติดร้านนอก, งานผสมติดทั้งสอง.
- ผ่านแล้ว = check+rail cobalt; ปัจจุบัน = วงขอบ cobalt มีจุด; ยังไม่ถึง = วงทึบเปล่า; ไม่เกี่ยว = วงประมีขีดลบ; unknown/on hold = วงประเปล่า.
- จำนวนช่วงอ่านจาก `ordersByStatus` จริง; สองเลนผลิตอ่าน `productionRouteCounts` จริงเพื่อไม่โกหกงานผสม.

# Order Workbench extension

- Command Center rows เปิด `/redesign/orders/[id]`; surface นี้อ่านและสรุปเพื่อช่วยตัดสินใจ ส่วน `/orders/[id]` ยังเป็น source of truth ของ controller, mutation และ deep work.
- desktop: action docket + dispatch facts → lifecycle 7 ช่วง → work brief + operation snapshots. mobile: identity → action → warnings → facts → lifecycle → brief → snapshots โดยไม่มี horizontal tabs.
- data มาจาก `order.getById`, `user.me`, conditional `production.orderContext` และ conditional `billing.listByOrder` ผ่าน pure model; action truth ใช้ `getOrderNextStep` และ `order-tabs` เดิม ทุก deep link กลับ canonical route และไม่มี status mutation ชุดที่สอง.
- production drill-through ชี้ record เมื่อไม่กำกวม: มี active production หนึ่งรายการ หรือทั้งออเดอร์มีใบผลิตเดียว; นอกนั้นชี้ canonical production tab เพื่อไม่เลือกแทนผู้ใช้.
- money fail closed ตาม `see_order_money`; billing overview คำนวณจาก `billing.listByOrder` รวม adjustment เท่านั้น. payment readiness ถูก sanitize ฝั่ง server สำหรับคนไม่มีสิทธิ์ และกรณี `SHIPPED` ไม่มีสิทธิ์เงินแสดงคำแนะนำทั่วไปเท่านั้น.
- loading, not found, error+retry และ empty แยกกัน; mobile target ขั้นต่ำ 44px, ใช้ `<h1>`, ordered lifecycle และ `aria-current`; Light/Dark ไม่ล้นแนวนอน.

# Connected Operations extension

- Connected topology: Command Center → Orders Registry → Order Workbench → Production Control → canonical mutations/dialogs. Prototype ไม่มี mutation หรือ status controller ซ้ำ.
- Orders Registry ใช้ `order.list` + `user.me`; URL contract ครบ `q`, `attention`, `status`, `channel`, `type`, `from`, `to`, `sort`, `page`. เงิน, money sort และ create CTA fail closed; initial/background error, retry, filtered/system empty และ pagination แยกกัน.
- Production Control ใช้ `production.kanban` + `user.me` ผ่าน pure model; exception dedupe รวม failed/overdue/blocked, readiness ส่งต่อเฉพาะ `label` + `waitingOn` และไม่คัด `detail` หรือเงิน.
- lane cards derive ด้วย `laneOf`, `LANE_ORDER`, `LANE_LABELS`; PACK gate รอทุก non-PACK step จบ และ heat-press readiness reuse `evaluateHeatPressGate`. งานผสมคงหลาย lane ตามจริง; direct link ใช้ production จาก loop ส่วน target กำกวมกลับ canonical production tab.
- รอบตรวจจริงมีทะเบียน 78 orders; Production Control มี 21 cards และ 7 live lanes. DTF lens กรอง cards จริงและ click journey เปิด canonical `/production/[id]`; release/deep actions ไป `/production?create=…` หรือ `/orders/[id]?tab=…` ตาม guard เดิม.
- Desktop ใช้ registry table + factory control board; mobile ใช้ cards/filter sheet/bottom nav และรักษา touch target 44px. ทุก query มี loading, error+retry, background-cache และ empty state ตามบริบท.

# Implementation inventory

| Comp commitment | Implementation medium |
|---|---|
| top bar cobalt, ค้นหา, เปิดงาน, notification, ผู้ใช้ | command palette, user menu, notification query, permission helper, Printer mark และ Lucide line icons เดิม |
| shell navigation แบ่งกลุ่ม + mobile nav | registry `navigation.ts`, active-route helper และสิทธิ์เดิม; dashboard ชี้ `/redesign`, ลิงก์อื่นยัง canonical |
| matrix ต่อเนื่อง 7 ช่วง | semantic table + `getRedesignFlowState`; recent row จริง 5 แถวและ rail ใน CSS |
| exception docket | ordered list จาก `ownerPulse` จริง; ทุก item คง canonical resolution href |
| capacity strip / mobile stage summary | จำนวนจริง 7 ช่วง; เลนผลิตใช้ route count; progress bar ด้วย CSS ไม่มี canvas |
| responsive order view | matrix ที่ `xl`; ต่ำกว่า `xl` เป็นการ์ดข้อมูลจริง ไม่บีบ table แนวนอน |
| order workbench | route + read-only component + pure model; Command Center เชื่อมเข้าหน้านี้ ส่วน action เชื่อมกลับ canonical order tabs/status controller |
| orders registry | `order.list` + URL contract กลาง; desktop semantic table, mobile cards + filter sheet; ทุกแถวเปิด workbench |
| production control | `production.kanban` + permission-safe pure model; exception/readiness-first, lane/post summaries, real lens และ canonical deep actions |
| permission hardening | conditional billing/readiness query, server-sanitized payment detail และ router permission tests; ไม่มีเงินไหลผ่าน fallback copy |
| state integrity | status badge, formatter, permission, query และ error primitive เดิม; ไม่มี business engine ชุดที่สอง |

# Token and component grammar

- token scope เฉพาะ `.redesign-shell`: Light canvas/paper/ink/rule = `#f4f7fa` / `#ffffff` / `#13202c` / `#dbe4ec`; Dark = `#151b21` / `#202a34` / `#f5f7fa` / `#304253`.
- Dark เป็นกระดาษ blue-charcoal กับกฎ cobalt; Light คงกระดาษขาว; น้ำเงิน Anajak ต้องเป็น `#3973b2` ทั้งสองธีม.
- control/item โค้ง 8px, sheet 12px; pill ใช้เฉพาะ badge/status ขนาดเล็ก.
- divider blueprint 1px; lifecycle progress ที่ active เท่านั้นใช้ 2px; ห้ามขอบตกแต่ง 4px.
- sheet เกือบแบน มีเงาตกลงเบา ๆ และไม่มี halo.
- บันไดอักษร: metadata 12px, body/control 14px, section 18px, page heading 24–28px; ใช้น้ำหนักและระยะสร้างลำดับ.
- row hover และ `focus-within` ทำให้ rail ทั้งเส้นชัด; action สำคัญต้องเห็นโดยไม่พึ่ง hover.
- motion เป็น state transition สั้นและปิดเมื่อ reduced motion; keyboard focus, skip link และ semantic landmark ต้องเห็นชัด.

# Promotion boundary

- surface นี้พิสูจน์ composition และ visual world เฉพาะที่ ไม่ใช่สิทธิ์ restyle ทั้งระบบ; canonical routes ยังคงเป็น controller ของ mutation, dialog และ server guard.
- promote ทีละ route หลังมีใบงาน ROADMAP และเบสเคาะจาก render จริง; ต้องคง auth, permission, navigation, query, URL และ server invariant.
- ห้ามทำ token ต้นแบบเป็น global, คัด matrix ไปมือถือ, นำข้อมูลตัวอย่าง/source badge จาก comp มาใช้, สร้าง POD back office หรือแทน Printer mark ด้วยโลโก้ A.

# Finish evidence and verdict

- Comp ที่อนุมัติ: `.impeccable/mocks/flow-matrix.png`.
- หลักฐาน desktop: `.impeccable/review/redesign-desktop-1440.png` — เห็น 5 แถวเต็ม, legend, capacity strip ครบ และ docket ข้างกัน.
- หลักฐาน mobile: `.impeccable/review/redesign-mobile-390.png` — เริ่มด้วยข้อยกเว้น ต่อด้วยสรุปช่วงงานและ bottom nav คงที่; การ์ดออเดอร์อยู่ถัดลงไป.
- หลักฐาน Order Workbench: `.impeccable/review/order-workbench-desktop.png` และ `.impeccable/review/order-workbench-mobile.png`.
- Order Workbench ผ่าน typecheck, targeted lint, 73 files / 711 tests, `verify:ui`, manual detector `[]`, production build และ browser desktop/mobile Light + mobile Dark โดยไม่มี overflow, console หรือ hydration error.
- Final reviewer รอบแรก: **HOLD** พบ 2 P1 + 1 P2; หลังแก้และตรวจซ้ำ: **SHIP** · remaining: **clear**.
- หลักฐาน Connected Operations: `.impeccable/review/connected-operations-orders-desktop.png`, `.impeccable/review/connected-operations-orders-mobile.png`, `.impeccable/review/connected-operations-production-desktop.png` และ `.impeccable/review/connected-operations-production-mobile.png`.
- Browser exact 1440×900 Light + 390×844 Dark ผ่านโดยไม่มี overflow หรือ console error; เดิน DTF filter → work card → canonical production link จริง.
- Connected Operations ผ่าน typecheck, lint 0 error (29 warning เดิม), 742 tests, `verify:ui`, detector `[]` และ production build. Finish review รอบแรก **HOLD**; หลังแก้และตรวจซ้ำ **SHIP**.
