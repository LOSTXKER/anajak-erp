# PROGRESS — สถานะสด (อัปเดตทุก session)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: อัปเดตไฟล์นี้ก่อนปิด

## ตอนนี้
- **Phase: P1 · P1.0 Design System วางมาตรฐานเสร็จแล้ว ✅** (2026-06-10) — รอบเก็บตกหน้าเก่าอยู่ปลาย P1 ตามใบงาน
- งานถัดไป: **ใบงาน P1 ถัดไป — แนะนำ PDF ครบชุด + ใบกำกับภาษีเต็มรูป ม.86/4** (หัวใจ B2B เครดิตเทอม: ใบเสนอ/แจ้งหนี้/เสร็จ + ยกเลิก-ออกใหม่ห้ามลบ + ใบลดหนี้-เพิ่มหนี้) หรือเบสเลือกใบงานอื่นจากลิสต์ P1 ใน ROADMAP
- **เบสควรเปิดดูระบบ 1 รอบ**: สีทั้งแอปเปลี่ยนจากน้ำเงิน Apple → น้ำเงินแบรนด์ Anajak (#3973b2) แล้ว — ถ้าโทนไหนดูแปลกบอกได้ ปรับที่ globals.css จุดเดียว
- 🎉 P0 จบครบ 5 ด่าน (2026-06-10) — เกณฑ์ผ่านหมด: auth ✓ เงินตรง (test 40 + integration 35) ✓ migration ✓ seed ✓

## เสร็จแล้ว
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
- **หนี้ที่จงใจค้าง + ใบงานรองรับ** (อย่าแก้เงียบ): lint warnings 55 (react-hooks/no-alert/no-img/unused) → P1.0 ยกเป็น error · billing.create ไม่กันบิลรวมเกินยอดออเดอร์ → P1 · platformFee → CostEntry/margin → P2 job costing · sidebar เมนูตาม role → P1.0 · review เสริม 2 มิติ (pricing/decimal ละเอียด) ยังไม่ rerun (ติดโควต้าวันนั้น)
- payment method ใช้ค่าจาก `src/lib/payment-methods.ts` เท่านั้น — DB ไม่มีค่าเก่า (TRANSFER/PROMPTPAY) แล้ว
