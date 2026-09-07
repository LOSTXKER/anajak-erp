# PROGRESS — สถานะสด

## ตอนนี้ (2026-09-07)
- **เบสสั่งลบ proto ทั้งหมด แล้ว commit/push main ก่อนเริ่มใหม่.** ลบ `src/app/proto` ทั้งโฟลเดอร์ รวมทะเบียนและหน้าเลือกแบบ (139 ไฟล์ใน branch ทดลอง); ยุติการรอเลือกหน้าลองเดิมทุกชุด.
- ลบ SVG ที่ใช้เฉพาะหน้าลอง 6 ไฟล์ และ baseline ที่อ้างไฟล์ซึ่งลบแล้ว 22 รายการ. เก็บ `public/demo-mockups/front.svg` เพราะ fixture QA และ test ของหน้าจริงยังใช้. แก้ PRODUCT/ARCHITECTURE ให้ไม่ชี้ทะเบียนที่ลบแล้ว; การอ้างหน้าลองเก่าในเอกสารหรือ comment เป็นประวัติใน git.
- ไม่มี executable import/link จากหน้าจริงไป `/proto`. ไม่แก้หน้า ERP จริง, server, สิทธิ์, schema, ข้อมูล หรือ dependency. แนวทางทำหน้าลองก่อนเคาะ UI ในอนาคตยังคงเดิม.
- ตรวจผ่าน: typecheck, lint (0 errors / 24 warnings เดิม), unit 164 ไฟล์ / 1,666 tests, verify:ui (รวม work-order 33/33), production build และ diff check. รายการ route ใน build ไม่มี `/proto`.
- Chrome local: URL `/proto/work-order-reset/view?v=record&case=overdue&boss=1` เป็น 404; `/production` โหลดรายการและกด ORD-2609-0009 ไป `/production/demo-production-outsource-overdue` ได้ ข้อมูลขั้นงาน/ร้านนอกและปุ่มยังแสดงครบ.
- เผยแพร่การลบใน commit `4082e7a`: push main แล้วและ remote SHA ตรง; Vercel Production `dpl_FUP6wKenTHSw7aivzzhURr2dHs3F` READY ผูก `anajak-erp.vercel.app`. เว็บจริง `/login` ตอบ 200 และเส้นทางหลัง auth redirect ไป login ตามเดิม; ไม่ได้ยืนยันหน้าหลัง login บน Production เพราะไม่มี session ที่ใช้งานได้ในรอบนี้.
- CI run `34139448777`: lint/typecheck ผ่าน, unit ผ่าน 1,664 ตก 2 ใน `production-desk.test.ts:100,114`. เป็นปัญหาเดิมตั้งแต่ main `75f1e19` (run `34051857606`); ทำซ้ำได้ด้วย TZ=UTC แต่ TZ=Asia/Bangkok ผ่าน 7/7. สาเหตุ `production-desk.ts` ใช้ `setHours()` ตามเขตเวลาเครื่องในการคำนวณวัน; รอบลบ proto ไม่แก้ตรรกะหน้าจริงหรือเปลี่ยน test เพื่อให้ผ่าน. ต้องแยกแก้ให้ใช้ปฏิทินไทยในงานถัดไป.

## NEXT
1. **รอโจทย์ใหม่จากเบส** — ยังไม่มีแบบหน้าลองที่รอเคาะ และไม่เริ่มรื้อหน้าจริงต่อจากแบบที่ลบแล้ว.
2. งานค้างอื่นอยู่ ROADMAP §A2–A8/B/C/F: QC/แพ็กหน้างาน, ซ้อม Production V2, ทางเข้ารอบพิมพ์/วัตถุดิบ/ประวัติละเอียด. การลบหน้าลองไม่ได้เปลี่ยนสถานะงานเหล่านี้.
3. แจ้งเบสว่า CI ยังแดงจากบั๊กเขตเวลาเดิม; ก่อนอ้างว่า CI ผ่านต้องแก้และตรวจทั้ง UTC/Asia-Bangkok โดยคงความคาดหวังของ test เดิม.

## บริบทที่ยังต้องรักษา
- กระดาษเป็นหลัก: จุดจด screen / paper / auto ตาม `lib/work-order-record-mode.ts`; checklist ปัจจุบันอ่านอย่างเดียว ไม่มีผลติ๊กในฐาน.
- หัวหน้าทำครบจากใบผลิต; ช่างมี `/production/floor`; ใช้เครื่องยนต์และสิทธิ์ชุดเดียวกัน. Station/TV ไม่มีเงิน.
- ทำเองเฉพาะ DTF; งานร้านนอกเดินขนานได้; สูตรที่ RELEASED ต้องคัดลอกเป็นร่างใหม่จึงแก้ได้.
- Production V2 บนเว็บจริงยัง legacy ตามบันทึกเดิม; รอบนี้ไม่เปลี่ยน flag หรืออ้างว่าเปิดใช้แล้ว.
- เบสเคาะแล้ว: จด VAT, ร้านนอกสื่อสาร LINE, นักบัญชีใช้ PEAK. ใครถือ role ACCOUNTANT ยังไม่ชัด; อย่าปรับสิทธิ์เงียบ.

## สภาพแวดล้อม
- Port 3000 เสิร์ฟ checkout `/Users/lostxker/dev/Git/anajak-erp` ด้วย `npm run dev:demo`. รีสตาร์ตหนึ่งครั้งเพื่อให้ Next.js สร้างรายการ route types ใหม่หลังลบหน้า; typecheck/build รอบแรกพบเฉพาะแคช `.next/dev/types` ที่ยังอ้างหน้าลองเก่า แล้วผ่านหลังรีสตาร์ต.
- ฐานทดลอง `127.0.0.1:5433/anajak_erp_demo`; ไม่แก้ env, ไม่ seed/reset และไม่รัน integration ที่สร้างข้อมูล.
- เริ่มงานครั้งต่อไปอ่าน ROADMAP/SPEC และ git สด; docs/DESIGN ยังเป็นกติกา UI. โค้ดหน้าลองเดิมดูได้ด้วย `git log --all -- src/app/proto`.
