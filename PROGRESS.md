# PROGRESS — สถานะสด (อัปเดตทุก session)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: อัปเดตไฟล์นี้ก่อนปิด

## ตอนนี้
- **Phase: P1 · เสร็จแล้ว: P1.0 Design System ✅ · PDF/ใบกำกับภาษีเต็มรูป ✅ · Job Ticket+QR ✅ · มัดจำตามเทอม+overdue ✅** (2026-06-10)
- งานถัดไป (เลือกจากลิสต์ P1 ใน ROADMAP): แนะนำ **ใบวางบิล + ลูกหนี้ aging + เช็ค credit limit** (ต่อโซ่การเงิน — ตอนนี้มี dueDate/OVERDUE จริงแล้ว aging ทำได้เลย + ควรนิยามความหมายเงินของใบลดหนี้ในงานนี้) หรือ **task queue "งานของฉันวันนี้"** (หน้า ops mobile-first ตัวแรก)
- **เบสต้องทำก่อนใช้เอกสารจริง**: ไปกรอก **Settings → ข้อมูลกิจการ** (ชื่อ/ที่อยู่/เลขผู้เสียภาษี 13 หลัก) — ไม่งั้นหัวเอกสารขึ้น "(ยังไม่ตั้งค่าข้อมูลกิจการ)" · deploy จริงต้องตั้ง `NEXT_PUBLIC_APP_URL` (QR บน Job Ticket) + `CRON_SECRET` (cron กวาดบิลเลยกำหนด — ระหว่างยังไม่ deploy ระบบกวาดเองตอนเปิดหน้า /billing ไม่เกินทุก 6 ชม.)
- 🎉 P0 จบครบ 5 ด่าน (2026-06-10) — auth ✓ เงินตรง ✓ migration ✓ seed ✓

## เสร็จแล้ว
- 2026-06-10 — **P1: มัดจำตาม payment terms + overdue อัตโนมัติ**:
  - **`src/lib/payment-terms.ts` ที่เดียวทั้งระบบ**: เทอม 8 ค่า (มัดจำ 30/50 · เครดิต 7/15/30/60 วัน · COD · จ่ายเต็มล่วงหน้า) + ความหมายเชิงเงิน — ทุก dropdown (สร้าง/แก้ออเดอร์, ฟอร์มลูกค้า) ใช้ชุดเดียวกัน + zod enum ฝั่ง server (เดิม string เปล่าพิมพ์อะไรก็เข้า DB)
  - **`services/payment-plan.ts`**: ยอดบิลแนะนำตามเทอมจริง (เลิก hardcode 50%) · แยกฐานภาษี+VAT ให้ตรงใบกำกับ ม.86/4 ตั้งแต่เปิดบิล · เครดิตเทอม → dueDate อัตโนมัติ (วันนี้ไทย+X) · **เพดานวางบิลฝั่ง server ใน tx + lock แถวออเดอร์** (ปิดหนี้ P0: บิลรวมเกินยอดออเดอร์) — ใบแจ้งหนี้ D+F กองหนึ่ง ≤ ยอดออเดอร์ · ใบเสร็จอีกกอง ≤ ยอดออเดอร์+ใบเพิ่มหนี้−ใบลดหนี้
  - **`services/overdue.ts`**: เลยกำหนด = พ้นสิ้นวันไทยของ dueDate · sweep ตั้ง OVERDUE + กระดิ่งแจ้ง OWNER/MANAGER/ACCOUNTANT (ผู้ใช้ `createNotification` รายแรกของระบบ — กระดิ่ง topbar โพล 30 วิเด้งเอง) · กันแจ้งซ้ำตอน race ด้วย updateManyAndReturn · ตัวเรียก 3 ทาง: `/api/cron/overdue` (Bearer CRON_SECRET, fail-closed) + vercel.json รายวัน 00:05 ไทย · ปุ่ม markOverdue เดิม · กวาดอัตโนมัติ throttle 6 ชม.ตอนเปิด /billing (ทำงานจริงแม้ยังไม่ deploy)
  - UI dialog สร้างบิล: prefill ชนิด/ยอด/ภาษี/ครบกำหนดจาก `billing.suggest` + โชว์เงื่อนไข/คงเหลือวางบิล + เตือนเมื่อมีใบลดหนี้ · ภาษีคิดใหม่เมื่อแก้ยอด/ส่วนลด (กัน VAT ค้างของยอดเดิม) · prefill ไม่ทับค่าที่ผู้ใช้พิมพ์ · toast error (เดิม server ปฏิเสธแล้วเงียบ) · ปุ่มสร้างบิล+suggest จำกัด role การเงิน · แก้ dialog แก้ออเดอร์ล้างเทอมกลับ "ไม่ระบุ" ได้จริง · paymentTerms เข้า touchesMoney guard
  - **billing.stats แก้เลขเพี้ยน**: ยอดค้างนับ OVERDUE ด้วย (เดิมบิลที่ถูก mark หายจากยอดค้าง) + นับเฉพาะใบแจ้งหนี้/เพิ่มหนี้−ลดหนี้ (เดิมใบเสร็จถูกนับซ้ำเป็นยอดค้าง/รายได้)
  - **verify**: unit 81 ตัว (payment-plan 32 + overdue 9) · `npm run verify:terms` = integration จริง 15/15 (สร้าง [TERMS-VERIFY] → ลบเกลี้ยง + คืน DocumentSequence) · adversarial review 5 มิติ 19 agents — confirmed 11 แก้ครบ 4 major · tsc 0 · lint 0 errors · build ผ่าน
- 2026-06-10 — **P1: Job Ticket ใบสั่งงานหน้างาน + QR** (`/print/job-ticket/[id]` — ปุ่ม "ใบสั่งงาน" หัวหน้า order detail):
  - ใบเดียวครบสำหรับทีมผลิต: QR สแกนเปิดออเดอร์บนมือถือ (lib `qrcode` ทำ SVG ในเครื่อง — ห้ามเปลี่ยนไปพึ่ง service นอก) · กำหนดส่ง+ความเร่งด่วนเด่น · ตารางไซซ์/สี/จำนวนต่อสินค้า · สเปคผ้า/แพทเทิร์น/แหล่งเสื้อ (เตือนแดงถ้าเสื้อลูกค้าส่งมา-ยังไม่ตรวจรับ) · ตารางลายพิมพ์ (ตำแหน่ง/วิธี/ขนาด/สี/หมายเหตุแบบ) · ส่วนเสริม · checklist ขั้นตอนผลิตให้เซ็นหน้างาน (ไม่มี production = ช่องว่างเขียนมือ) · ช่องบันทึกหน้างาน
  - **กติกาตายตัว: ไม่มีราคา/เงินใดๆ บนใบนี้** (พนักงานหน้างานไม่เห็นเงิน — verify ยืนยันคำว่า ราคา/บาท/฿ ไม่โผล่)
  - verify: `scripts/verify-print.tsx` ขยายเป็น 20/20 (รวม Job Ticket 6 เคส) · build ผ่าน route ขึ้น
- 2026-06-10 — **P1: PDF ครบชุด + ใบกำกับภาษีเต็มรูป ม.86/4** (วิธี: หน้า print A4 → browser print/Save as PDF — ไม่พึ่ง lib PDF, ฟอนต์ไทยเป๊ะ):
  - **เอกสารครบ**: ใบเสนอราคา (`/print/quotation/[id]`) · ใบแจ้งหนี้/มัดจำ · **ใบเสร็จรับเงิน+ใบกำกับภาษีเต็มรูป** (ต้นฉบับ+สำเนา 2 หน้า อัตโนมัติ) · ใบลดหนี้/เพิ่มหนี้ (`/print/invoice/[id]`) · ใบ voided พิมพ์ได้พร้อมลายน้ำ "ยกเลิก"+เหตุผล (ห้ามลบตามกติกา)
  - ข้อมูลบังคับ ม.86/4 ครบ: ชื่อ/ที่อยู่/เลขผู้เสียภาษี+สาขา ทั้งผู้ขาย-ผู้ซื้อ · เลขที่+วันที่ (พ.ศ.) · แยกฐานภาษี/VAT ชัด · จำนวนเงินตัวอักษร (`src/lib/baht-text.ts` + test 8 เคส รวมกฎ เอ็ด/ยี่สิบ/ล้านซ้อน) · ใบเสร็จโชว์ "ชำระโดย" จาก payments จริง
  - โครง: `(print)` route group (server component อ่าน DB ตรง — HTML นิ่ง ไม่มี sidebar, middleware กัน auth) · ชิ้นส่วนกลาง `src/components/print/print-document.tsx` (เอกสารใหม่ทุกชนิดประกอบจากชุดนี้ — Job Ticket ใช้ต่อได้เลย) · CSS A4 ใน globals.css
  - **Settings → ข้อมูลกิจการ** หน้าใหม่ (`settings/company` — OWNER/MANAGER แก้, ทุก role อ่านเพื่อพิมพ์) เก็บใน Setting key `company_profile`
  - ปุ่มพิมพ์: หน้า quotation detail ("พิมพ์/PDF") + icon printer ทุกใบในการ์ดบิลของ order detail
  - **verify จริง**: `scripts/verify-print.tsx` render เอกสารจริง 4 ชนิดผ่าน 14/14 (ข้อมูลทดสอบใช้เลข TEST-xxx ไม่แตะ sequence จริง + ลบเกลี้ยงท้ายสคริปต์) · tsc 0 · build ผ่าน route ขึ้นครบ · test รวม 48 ตัว
- 2026-06-10 — **P1.0 Design System + UI มาตรฐาน (วางมาตรฐานกลาง)**:
  - **token 3 ชั้น** ใน `globals.css`: primitive สีแบรนด์ (anajak-blue/yellow/red) → **remap ramp `blue-50..950`/`red-50..950` ของ Tailwind จากสีแบรนด์** (เลข 600 = สีแบรนด์เป๊ะ) → ทั้งแอป 48 ไฟล์เปลี่ยนโทนแบรนด์ทันทีไม่แตะ markup → semantic accent ชี้แบรนด์ · ปุ่ม destructive ขยับ red-700 (contrast AA)
  - **เลิก window.confirm/prompt ทั้งระบบ**: `ui/confirm-dialog.tsx` (`useConfirm`/`usePromptText` promise API + provider ใน providers.tsx · mobile-ready ปุ่มเต็มแถว) — กวาดครบ 7 จุด (orders/new, orders/[id] ยกเลิก+เหตุผล, quotations/[id] ปฏิเสธ+แปลง, settings ×3) · **lint `no-alert` = error แล้ว**
  - component มาตรฐานครบ + ประกาศใน **`docs/DESIGN.md`**: DataTable/EmptyState/OrderStatusBadge/Badge/Dialog/ConfirmDialog/Skeleton/QueryError + กฎ mobile-first หน้า ops (เป้านิ้ว ≥44px · ตาราง→การ์ดจอเล็ก · sticky action) — หน้าใหม่/หน้าที่แตะใน P1-P3 ต้องตามนี้
  - verify: tsc 0 · lint 0 errors (warnings 55→48) · test 40/40 · **production build ผ่านทุกหน้า** · login render จริง
- 2026-06-10 — **P0.5 จัดระเบียบโค้ด**:
  - **vitest + test แกน 40 ตัว** (`npm test` — 0.5 วิ): สูตรราคา server (`pricing.test.ts` — สูตร A/ปัด half-up/กัน discount เกิน/เคส float คิดผิด 7.525→7.53) + mirror client/server + state machine (`order-status.test.ts` — รวม transitions ใหม่ของ P0.2) + เลขเอกสาร (`document-number.test.ts` — period เวลาไทย/format/retry semantics) + money helpers — **นี่คือเกราะ: แตะสูตรต้องผ่าน test ก่อน**
  - `npm run verify:p02` = integration จริงกับ DB 35 เคส (ย้ายจาก scripts ชั่วคราวเป็นของถาวร)
  - **ลบ dead code**: size-matrix.tsx · useOrderDraft/OrderDraftData (full-draft system ไม่ถูกใช้) · ปุ่มแก้ไข dead link `/quotations/[id]/edit` · empty dirs (api/sync, products/new, (portal)) · scripts/migrate-order-items.ts · mark BrandProfile/rfmScore ใน schema "รอ P3"
  - **payment-method ที่เดียว**: `src/lib/payment-methods.ts` (ค่า+ป้าย) — ปิด mismatch TRANSFER/PROMPTPAY vs BANK_TRANSFER/QR_CODE (DB ล้างแล้วจึงตั้งมาตรฐานได้เลย ค่า canonical: BANK_TRANSFER/CASH/QR_CODE/CREDIT_CARD/CHECK/COD)
  - **ESLint flat config ใช้จริง** (`npm run lint` = `eslint .` — next lint ตาย): next/core-web-vitals + typescript + no-alert(warn)/no-empty(error) · **0 errors** · warning 55 = ลิสต์หนี้ UI เก่า (react-hooks compiler rules + no-img + unused vars) → ยกเป็น error ตอน P1.0
  - **`docs/ARCHITECTURE.md`**: ชั้นของระบบ + กฎเหล็ก (เงิน/สถานะ/เลขเอกสาร/สิทธิ์) + ตาราง test — กัน session ใหม่วางของผิดที่
  - **attachment.create validate ปลายทางจริง** (ค้างจาก review P0.1): entityType ต้องอยู่ใน 5 ชนิดที่รองรับ + entityId ต้องชี้ record ที่มีอยู่
  - ไม่แตะ: orders/new/page.tsx แตกไฟล์ → ทำตอน P1.12 ตามใบงาน (จงใจ)
- 2026-06-10 — **P0.3 วินัยฐานข้อมูล**: prisma migrate จริง (baseline `0_init` + `add_hot_path_indexes`) — **ห้าม db push อีก** · seed = master data (ServiceCatalog 25) idempotent · ล้างข้อมูลทดสอบหมด (เบสยืนยัน) เหลือ: user เบส 1 · products 9 + variants 760 (Stock sync) · catalog 25 · pattern 1 · packaging 5 · settings 2 · **P0.4 ปิดโดยงาน P0.2** (TaxLineType + services แยกแล้ว)
- 2026-06-10 — **P0.2 เงินถูกต้อง** (commit d55369c): Decimal 44 จุด + boundary extension + สูตร A platformFee + billing $transaction/lock + DocumentSequence + transitionOrder กลาง + guards · adversarial review 5 มิติ + verify 35/35
- 2026-06-10 — **P0.1 Auth จริง + RBAC** (commit d39e451/871b4f1) · แผน + retrofit repo

## ติดอยู่ / รอตัดสิน
- (ว่าง)

## ข้อเท็จจริงที่ session ใหม่ต้องรู้
- **บัญชี OWNER ของเบส**: hongtaeswatht@gmail.com (user เดียว) · สร้างพนักงาน: Settings → Users · bootstrap: `node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]`
- **คำสั่งหลัก**: `npm run dev` · `npm test` (unit — ต้องผ่านก่อน commit ที่แตะสูตร) · `npm run lint` (0 errors ห้ามถอย) · `npx prisma migrate dev` (ห้าม db push) · `npm run db:seed` (master data รันซ้ำได้) · `npm run verify:p02` (integration เงิน — สร้างข้อมูลจริง ห้ามรันบน DB ใช้งานจริง)
- **อ่าน `docs/ARCHITECTURE.md` ก่อนวางโค้ดใหม่** — ชั้น router(ผิว)/services(แกน)/lib + กฎเหล็กเงิน/สถานะ/เลขเอกสารอยู่ที่นั่นครบ
- **DB สะอาด ไม่มี order/customer** — เลขเอกสารเริ่ม 0001 เมื่อใช้จริง · ปัญหาเลขเก่าชน sequence หมดแล้ว
- **หนี้ที่จงใจค้าง + ใบงานรองรับ** (อย่าแก้เงียบ): lint warnings ~50 (react-hooks/no-img/unused) · platformFee → CostEntry/margin → P2 job costing · sidebar เมนูตาม role → รอบเก็บตก P1 · review เสริม 2 มิติ (pricing/decimal ละเอียด) ยังไม่ rerun
- **หนี้ใหม่จาก review งานมัดจำ/overdue** (จดไว้ อย่าแก้เงียบ): (1) **ใบลดหนี้ไม่มีความหมายเชิงเงิน** — ไม่ผูกกับใบที่ลด/ไม่ลดยอดค้าง → ลูกค้าจ่ายสุทธิหลังหักใบลดหนี้แล้วใบเดิมค้าง PARTIALLY_PAID → sweep จะ mark OVERDUE ปลอม (ตอนนี้ UI เตือนตอนสร้างบิลแล้ว แต่ตัวจริงต้องนิยามใน **ใบวางบิล+aging**) (2) แก้ออเดอร์ (update/updateItems/updateFees) ลดยอดต่ำกว่าบิลที่ออกแล้วได้โดยไม่เตือน — เพดานกันขาวางบิลขาเดียว (3) บันทึกชำระได้ทั้งบนใบแจ้งหนี้และใบเสร็จ → ถ้าทีมบันทึกซ้ำสองใบ totalSpent/รับชำระเดือนนับซ้ำ — แนวถาวร: auto-ออกใบเสร็จจากงวดรับเงิน (ตรงกติกาใบกำกับทุกงวดรับเงินพอดี) (4) ปุ่มบันทึกชำระ/ยกเลิกบิลยังโชว์ role ที่ไม่มีสิทธิ์ (server กันอยู่ — UI ค่อยเก็บ)
- payment method ใช้ค่าจาก `src/lib/payment-methods.ts` เท่านั้น — DB ไม่มีค่าเก่า (TRANSFER/PROMPTPAY) แล้ว
