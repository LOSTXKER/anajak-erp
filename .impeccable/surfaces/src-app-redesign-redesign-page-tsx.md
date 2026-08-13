---
version: 1
slug: "src-app-redesign-redesign-page-tsx"
primary_target: "src/app/(redesign)/redesign/page.tsx"
related_targets: ["src/app/(redesign)/redesign.css","src/components/redesign/redesign-shell.tsx","src/components/redesign/erp-command-center.tsx","src/lib/redesign-flow.ts"]
---

# Scope and mode

- Surface ที่ ship: ต้นแบบหลัง login แยกที่ `/redesign`; route เดิมยังเป็น canonical.
- สถานะ: shipped prototype, ผ่าน finish review 2026-08-14.
- Mode: Operate.
- ผู้ใช้หลัก: เจ้าของ/ผู้จัดการ โดย navigation และข้อมูลของทีม 5 คนยังถูกกรองตามสิทธิ์.
- งานหลัก: รู้ในไม่กี่วินาทีว่าเรื่องใดต้องแทรกแซง เห็นตำแหน่งออเดอร์ในสายงาน และเปิด record จริงเพื่อทำต่อ.
- Primary action: เปิดความเสี่ยงถัดไป หรือเปิดงานจริงเมื่อมีสิทธิ์.

# Data truth and boundaries

- ใช้ source จริงเท่านั้น: `analytics.dashboard`, `analytics.ownerPulse`, `user.me`, navigation registry กลาง, `buildDashboardAttentionItems` และ canonical routes.
- แถวออเดอร์ จำนวนแต่ละช่วง ข้อยกเว้น notification ค้นหา navigation และ drill-through มาจากข้อมูลจริงหรือ route เดิม; ไม่มี metric ปลอมหรือ action ตาย.
- เงิน owner pulse การเปิดงาน และ navigation ถูก gate ตามสิทธิ์และ fail closed. คนไม่มีสิทธิ์รายงานบริหารเห็นทางไปคิวส่วนตัวจริงแทนข้อมูลเสี่ยงรวม.
- loading, primary error+retry, attention error+retry, empty และ permission fallback แยกกัน.
- ไม่เพิ่ม schema, dependency, config, business logic หรือ mutation; public, print, auth, factory และ canonical routes ไม่ถูกแตะ.
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

## Mobile

- ต่ำกว่า `xl` เปลี่ยน composition ไม่ย่อ matrix: exception docket → สรุป 7 ช่วง → การ์ดออเดอร์ล่าสุด.
- bottom nav คงที่มี Dashboard, My Tasks, Orders, Production และ All โดยกรองจาก navigation registry ตามสิทธิ์ชุดเดิม.
- การ์ดคงสถานะ ช่วงงาน กำหนดส่ง และ drill-through จริง; control รักษา touch target ขั้นต่ำ 44px ตาม P1.0.

# Flow semantics

- 7 ช่วง: **รับงาน → อาร์ตเวิร์ก → ความพร้อม → DTF ภายใน → งานร้านนอก → QC / แพ็ค → ส่ง / ปิด**.
- DTF กับร้านนอกเป็น alternate lanes: งานภายในติด DTF, งาน outsource ติดร้านนอก, งานผสมติดทั้งสอง.
- ผ่านแล้ว = check+rail cobalt; ปัจจุบัน = วงขอบ cobalt มีจุด; ยังไม่ถึง = วงทึบเปล่า; ไม่เกี่ยว = วงประมีขีดลบ; unknown/on hold = วงประเปล่า.
- จำนวนช่วงอ่านจาก `ordersByStatus` จริง; สองเลนผลิตอ่าน `productionRouteCounts` จริงเพื่อไม่โกหกงานผสม.

# Implementation inventory

| Comp commitment | Implementation medium |
|---|---|
| top bar cobalt, ค้นหา, เปิดงาน, notification, ผู้ใช้ | command palette, user menu, notification query, permission helper, Printer mark และ Lucide line icons เดิม |
| shell navigation แบ่งกลุ่ม + mobile nav | registry `navigation.ts`, active-route helper และสิทธิ์เดิม; dashboard ชี้ `/redesign`, ลิงก์อื่นยัง canonical |
| matrix ต่อเนื่อง 7 ช่วง | semantic table + `getRedesignFlowState`; recent row จริง 5 แถวและ rail ใน CSS |
| exception docket | ordered list จาก `ownerPulse` จริง; ทุก item คง canonical resolution href |
| capacity strip / mobile stage summary | จำนวนจริง 7 ช่วง; เลนผลิตใช้ route count; progress bar ด้วย CSS ไม่มี canvas |
| responsive order view | matrix ที่ `xl`; ต่ำกว่า `xl` เป็นการ์ดข้อมูลจริง ไม่บีบ table แนวนอน |
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

- surface นี้พิสูจน์ composition และ visual world เฉพาะที่ ไม่ใช่สิทธิ์ restyle ทั้งระบบ.
- promote ทีละ route หลังมีใบงาน ROADMAP และเบสเคาะจาก render จริง; ต้องคง auth, permission, navigation, query, URL และ server invariant.
- ห้ามทำ token ต้นแบบเป็น global, คัด matrix ไปมือถือ, นำข้อมูลตัวอย่าง/source badge จาก comp มาใช้, สร้าง POD back office หรือแทน Printer mark ด้วยโลโก้ A.

# Finish evidence and verdict

- Comp ที่อนุมัติ: `.impeccable/mocks/flow-matrix.png`.
- หลักฐาน desktop: `.impeccable/review/redesign-desktop-1440.png` — เห็น 5 แถวเต็ม, legend, capacity strip ครบ และ docket ข้างกัน.
- หลักฐาน mobile: `.impeccable/review/redesign-mobile-390.png` — เริ่มด้วยข้อยกเว้น ต่อด้วยสรุปช่วงงานและ bottom nav คงที่; การ์ดออเดอร์อยู่ถัดลงไป.
- Final reviewer disposition: **SHIP** · remaining: **clear**.
