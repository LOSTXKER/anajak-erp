# PROGRESS — สถานะสด

## ตอนนี้ (2026-09-09 · A11 · ปล่อยผ่าน main)
- เบสสั่ง commit push main; รวม codex/production-table-refine เข้า main แบบ fast-forward จาก 856c3bc ถึง e9640f8 ไม่มี conflict หรือโค้ดใหม่หลังผลตรวจ A11
- โค้ด A10/A11 อยู่ใน 5856b9f / 4a910c6 / e9640f8; commit นี้บันทึกการนำขึ้น main เท่านั้น ผล CI และ Vercel ต้องยืนยันกับ SHA ที่ push จริง
- Inventory: page.tsx58 = dashboard35/auth1/public5/print5/factory1/floor1/station-redirect1/v2-redirect4/proto5; ไม่นับหน้าลองและ redirects เหลือ **47 หน้าจอจริง**; layout7 (รวมproto1)
- ตรวจระดับ route/component/shared dependency; ไม่ได้ตรวจทุกบรรทัดของ92บริการ/router และไม่เปลี่ยนของที่แยกขอบเขตธุรกิจเหมาะอยู่แล้วเพื่อให้เกิดdiff

## สิ่งที่ปรับ
- ผลิต: ตารางต่อเนื่อง6คอลัมน์ ไม่มีหัวแบ่งสถานะ; ขึ้นงานที่ทำต่อได้ก่อนขั้นที่รอ; งานเลยกำหนด/รอเสื้อไม่ถูกนับติดปัญหา; DRAFT/SENT/COMPLETED/RECEIVED_BACKร้านนอกแสดงหน้าที่ถัดไปถูกช่วง
- production-board คิด waitingOn จากเส้นทางเดียวกับใบผลิต: QC/ขั้นท้ายไม่ถูกนับพร้อมก่อนงานต้นทางเสร็จ; คง heat-press gate/exceptions/server เดิม
- มือถือผลิตยังเป็นtable: เลขใบ/จำนวน/กำหนดส่ง/ตอนนี้อยู่ด้วยกัน มีตัวเลือกเรียง; ลดพื้นที่หัว/ตัวเลขกรอง; รายละเอียดรองเลื่อนภายในตาราง
- ใบผลิต: รูป/ชื่อ/ลายครั้งเดียวต่อสินค้า แล้วตาราง4คอลัมน์ไซซ์/จำนวน/ทำแล้ว/เสีย; แยกด้วยproductId ไม่รวมสินค้าชื่อเหมือนกัน; ใช้ร่วมขั้นหลักและคู่; PENDINGที่ถึงคิวแสดงพร้อมทำ
- Station: เช็คลิสต์ใช้ step.checks + tickStandard ที่บันทึกจริง; ปิดขั้นผ่านcontrollerเดียวกับใบผลิต รวมรีดร้อนที่A5เคยซ่อน; รอติ๊กครบ/บันทึกเสร็จก่อนปิด; งานเก่าไม่แต่งว่าติ๊กครบเอง
- รายการ: customer/product/quote ล้างผลค้นหาว่างได้; productใช้paginationกลาง; notifications เก็บview/pageในURL; page clampกลางคืนหน้า1เมื่อserverส่งpages=0
- ฟอร์ม/รายละเอียด: order new/editใช้แถบปุ่มร่วมพอดีมือถือ; quoteใช้numeric inputกลาง/รอprefill/ลดsubtotalซ้ำ; quote detailรวมsecondary actions; ลูกค้าแยกยอดหนี้; สินค้าไม่ครอปรูป/emptyตรงแหล่ง
- การเงิน: ลดลิงก์ซ้ำต่อแถว, เลขบิล/ออเดอร์ไม่ตัดบรรทัด, ดูใบจ่ายแล้วเป็นปุ่มรอง; loadingสถิติแยกจาก0; notes/WHTแยกข้อมูลเลือกเอกสาร, aging retry; analyticsแยกโหลด/ว่างและเปิดลูกค้าได้
- Settings: ใช้PageShell; กันแก้ชนsave; keyboard/touchเป้าขนาดเหมาะสม; packaging formจอแคบ; patterns upload fail/retry; routings queryพังมีretryแทนskeletonค้าง
- Public/login/print: main landmark/ข้อความยาว/labelความคิดเห็น; loginคืนloadingเมื่อnetwork throw; uploadแยกไฟล์ชื่อซ้ำด้วยIDและใช้กฎชนิดไฟล์/25MBร่วมserver; printคงA4/blind-ship
- ส่วนกลาง: PageShellระยะมือถือ, StatCard loading, TablePaginationห่อจอแคบ, DataTableเลือกข้อความ/ไม่แย่งcontrol/ผ่านunsaved navigation, Command Palette combobox+listbox/ลูกศร+Enter/IME
- ลบ UI เก่าไม่มีผู้เรียก2ไฟล์: components/production/work-order-route.tsx และ production-mockup-tab.tsx รวม268บรรทัด; ลบbaselineอ้างไฟล์เฉพาะจุด; **lib/work-order-route ยังใช้จริงและคงไว้**

## Coverage ของส่วนที่ตรวจแล้วคงโครงเดิม
- / dashboard มีpermission/loading/empty/ลิงก์ครบ; /home และv2/station redirectsคงปลายทาง/query; auth/public/print layoutsคงguard/ธีมตามหน้าที่
- orders list และorder detail/overview/money ใช้shared/permission/lazy tabsถูกแล้ว; editใช้ฟอร์มร่วม ไม่แยกสำเนา
- settings backup/stock/vendors มีสิทธิ์/สถานะ/ฟอร์มครบ ไม่เรียกexportหรือแก้credentials; services/users/company/cost-rates/routings/audit/patterns/packagingตรวจครบ
- Print invoice/quotation/billing-note/job-ticket/packing-list คงข้อมูลต่างตามเอกสาร ไม่ยุบจนblind-ship/ภาษีเสีย
- Backend: ตรวจboundary trpc/permissions, pricing/money/payment/document-number/order-status, manufacturing command/policy/read-model, public services/factory DTO; คงDecimal/transaction/lock/revision/idempotency/transitionOrder/explicit select

## ตรวจแล้ว
- Full unit **171 files / 1,735 tests ผ่าน**; typecheckผ่าน; full lint **0errors/23warnings** (img/effectฯลฯที่ยังเหลือ); verify:ui tokens/hierarchy + work-order34/34ผ่าน; production buildผ่าน
- Regressionใหม่: ไม่รวมงานรอ/เลยกำหนดเป็นปัญหา, ร้านนอกทุกช่วง, QCรอก่อนพร้อม, page0 recovery, StatCardไม่บอก0ระหว่างโหลด, ไฟล์ชื่อซ้ำ, Station saved checks/pending/สิทธิ์/งานเก่า/รีดร้อน/special flow
- Browser localhost:3000หลังrestart demo: ผลิต21แถว/0หัวrowgroup, ค้นป้ายคอ2→ล้างกลับ21, มือถือ390ไม่ล้นหน้า; tag-pressเปิดจากLinkถูกหน้า กลุ่มสินค้า1/tableกว้าง346pxในจอ390; Light1440/390
- Browser localhost:3005 proxyชั่วคราวเข้าdev3000ชุดเดียวเพื่อเลี่ยงFitness Service Workerค้าง: ใบผลิตDark390; ค้นหากลางcombobox→Enter→สินค้า; product search empty→clearกลับ2; settings/index+packagingเปิด/ยกเลิกฟอร์มมือถือ
- Browserกลุ่มการเงิน: billing/notes/aging/wht/tax/analytics เปิดdesktop1440ไม่มีpage overflow; คำเตือนบัญชีเดิมคงอยู่; order/new desktop+390/สลับแท็บทำงาน
- Browser Station: เปิดคิวDTF→ใบรีด พบsaved checks0/3และปุ่มปิดdisabled; หลังแก้boardสถานีOTHERพร้อม0/รอ16; ไม่กดเขียนสถานะจริง
- Public fixtureเฉพาะlocal anajak_erp_demo: approve/design, quote(ขอแก้ไขเปิดช่องมีlabel), upload; Light390/mainครบ/ชนิดไฟล์ตรงserver. ไม่ยืนยัน/ส่งข้อความ/อัปโหลดจริง; process cleanupลบfixture+token fileแล้ว
- Proto qty-partial: ใส่ครบ→บันทึกยอด39→60และปุ่มปิดenabled; ปิดขั้นเป็นtoastจำลองของproto จึงไม่ใช่หลักฐานDB transitionสำเร็จ
- ไม่มีschema/migration/dependency/envใหม่ ไม่reset/reseedข้อมูลเดิม; เก็บSPEC/DESIGN/ARCHITECTUREตรงส่วนกลางใหม่; ปล่อยผ่าน Git integration เดิมตามคำสั่งเบส

## NEXT / ขอบเขตที่ยังคงไว้
1. หลัง push ตรวจ GitHub CI + Vercel READY/alias ให้ตรง SHA บน main และเปิด https://anajak-erp.vercel.app/production แบบอ่านอย่างเดียว; ใบ demo-production-form-tag-press มีเฉพาะฐาน local ไม่ใช่ข้อมูล Production
2. A2–A8/B/C/Fที่เป็นfeatureตามROADMAPยังเปิด; A11ไม่ได้สร้างหน้าprint-runs/films/outsourceที่ถอด หรือcutoverProduction V2
3. A9 server sendToQc shortcutของlegacyยังเดิม, ข้อกำหนดยังstatic standards; helpers3ตัวที่เหลือtest-only importsคงไว้จนทบทวนสัญญาเก่าแยก ไม่ลบtestsเพื่อให้ตรวจผ่าน
4. ไม่ทดสอบเขียนธุรกรรมเงินจริงและsubmitทุกฟอร์มผ่านbrowserซ้ำ; core unit/guardsผ่านและคงwriter semantics. warningsที่เหลือไม่ปิดกฎซ่อน

## สภาพแวดล้อม
- dev3000ใช้ npm run dev:demo กับฐานlocal; พบdevเก่าหยุดและFitness offline cacheในChrome จึงrestart canonical demoแล้วเปิดใหม่ยืนยัน3000ได้
- Chrome serviceworker-internals ถูกbrowser policyปฏิเสธ; ไม่ล้างcookies/cache/Service Worker และไม่แก้AppShellเพื่อซ่อนปัญหาcache
- main รวมงานformก่อนA10ด้วย; ผลตรวจ local เป็นฐานก่อนปล่อย ส่วนสถานะ remote/CI/Production ต้องอ่านจากระบบจริงแยกกัน
