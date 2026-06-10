# สถาปัตยกรรม Anajak ERP — ของอยู่ตรงไหน วางของใหม่ที่ไหน

> สั้นที่สุดเท่าที่กัน AI/คนใหม่วางของผิดที่ได้ — กติกาเต็มดู `CLAUDE.md` + `ROADMAP.md`

## ชั้นของระบบ (บนลงล่าง)

```
src/app/            หน้าจอ (Next.js App Router)
  (auth)/login      หน้า login
  (dashboard)/      ทุกหน้าหลังบ้าน — ผ่าน middleware + layout guard
  approve/[token]   หน้าลูกค้าอนุมัติแบบ (token-based ไม่ต้อง login)
  api/trpc/         endpoint เดียวของ tRPC
  api/cron/overdue  cron กวาดบิลเลยกำหนด (Bearer CRON_SECRET · fail-closed)

src/components/     UI components (orders/, layout/, ui/ ฯลฯ)
src/hooks/          React hooks ฝั่ง client

src/server/routers/ tRPC routers — "ผิว" เท่านั้น: zod validate + requireRole +
                    เรียก service + จัด response · ห้ามฝัง business logic แกนที่นี่
src/server/services/ ★ business logic แกน — เงิน/สถานะ/เลขเอกสาร ต้องอยู่ที่นี่
  pricing.ts        สูตรราคาตัวจริง (สูตร A) — ทุก mutation ที่แตะยอดต้องผ่าน
  order-status.ts   transitionOrder = จุดเดียวที่เปลี่ยน internalStatus ได้
  document-number.ts nextDocumentNumber = เลขเอกสารรันต่อเนื่อง (เรียกใน tx เสมอ)
  money.ts          Decimal helpers (D/round2/moneyInput/aggToNumber)
  payment-plan.ts   เทอม→ยอดบิลแนะนำ/ฐานภาษี+VAT/วันครบกำหนด/เพดานวางบิล (P1)
  overdue.ts        กวาดบิลเลยกำหนด + แจ้งเตือนทีมการเงิน (เลยกำหนด = พ้นสิ้นวันไทย)
src/server/trpc.ts  context + auth middleware (requireRole)
src/server/helpers.ts createAuditLog / createNotification

src/lib/            ของใช้ร่วม client+server
  prisma.ts         ★ Prisma client + result extension แปลง Decimal→number ตอนอ่าน
  superjson.ts      ตาข่าย wire: Decimal ที่หลุดมาถูกส่งเป็น number
  pricing.ts        สูตร preview ฝั่ง client — ต้อง mirror services/pricing.ts เสมอ
  order-status.ts   state machine (isValidTransition/labels/flows)
  payment-methods.ts ช่องทางชำระเงิน (ค่า+ป้าย ที่เดียว)
  payment-terms.ts  เงื่อนไขการชำระเงิน 8 ค่า (ค่า+ป้าย+%มัดจำ/วันเครดิต ที่เดียว)
  supabase*.ts      auth (browser/server/admin)
  stock-api.ts/stock-sync.ts ท่อคุยกับ Anajak Stock app

prisma/schema.prisma + prisma/migrations/  (ใช้ `prisma migrate dev` เท่านั้น ห้าม db push)
prisma/seed.ts      master data เท่านั้น (idempotent) — ห้ามใส่ demo data
scripts/            create-owner.ts (bootstrap) · verify-p02.ts (integration check เส้นทางเงิน)
```

## กฎเหล็ก (ตัดสินใจไว้แล้ว — อย่าฝ่าโดยไม่อ่านที่มา)

| เรื่อง | กฎ | ที่มา |
|---|---|---|
| เงินใน DB | Decimal(12,2) เท่านั้น · โค้ดอ่านได้ number ผ่าน extension · **aggregate/_sum ต้องแปลงเอง `aggToNumber`** | P0.2 |
| สูตรยอดออเดอร์ | สูตร A: `total = max(0, items+fees-discount + tax)` · **platformFee ไม่เข้ายอด/ฐาน VAT** (เงินที่ marketplace หักจากร้าน) | P0.2 |
| คำนวณเงินฝั่งเขียน | Decimal ใน `services/pricing.ts` ปัด half-up 2 ตำแหน่ง · เงินหลายขั้นตอน = `$transaction` + lock แถวที่เสี่ยงชน | P0.2 |
| สถานะออเดอร์ | เปลี่ยนผ่าน `transitionOrder` เท่านั้น (validate + กัน race + revision) — ห้าม set `internalStatus` ตรง ยกเว้นค่าเริ่มต้นตอน create | P0.2 |
| เลขเอกสาร | `nextDocumentNumber(tx, type)` ใน transaction เดียวกับการสร้างเอกสาร — ห้ามสุ่ม/นับเอง (กฎหมายใบกำกับ) | P0.2 |
| สิทธิ์ | ทุก mutation ต้องมี `requireRole` ตามตาราง §7 — สรุป matrix ใน `PROGRESS.md` (P0.1) | P0.1 |
| ใบกำกับภาษี | ออกทุกงวดรับเงินรวมมัดจำ · ยกเลิก-ออกใหม่เท่านั้น ห้ามลบ (โครง P1) | ROADMAP |
| UI ใหม่ | รอ design system P1.0 · ห้าม `window.prompt/confirm` ในโค้ดใหม่ (lint เตือน) | ROADMAP |

## Test
- `npm test` — vitest unit: สูตรราคา (server+client mirror) · state machine · เลขเอกสาร · money helpers — **เกราะของทุก refactor แตะสูตรต้องผ่านก่อน**
- `npm run verify:p02` — integration จริงกับ DB: เส้นทางเงินครบ (จ่าย/void/refund/เลขต่อเนื่อง/guards) ⚠️ สร้างข้อมูล [P0.2-VERIFY] จริง — ห้ามรันบน DB ที่ใช้งานจริงแล้ว
- `npm run verify:terms` — integration จริงกับ DB: มัดจำตามเทอม/เพดานวางบิล/dueDate อัตโนมัติ/overdue sweep — สร้างข้อมูล [TERMS-VERIFY] แล้วลบเกลี้ยง + คืน DocumentSequence ⚠️ ห้ามรันบน DB ที่ใช้งานจริงแล้ว
