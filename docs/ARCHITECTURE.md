# สถาปัตยกรรม Anajak ERP — ของอยู่ตรงไหน วางของใหม่ที่ไหน

> สั้นที่สุดเท่าที่กัน AI/คนใหม่วางของผิดที่ได้ — กติกาเต็มดู `AGENTS.md` + `ROADMAP.md` · UI ดู `docs/DESIGN.md`

## ชั้นของระบบ (บนลงล่าง)

```
src/app/            หน้าจอ (Next.js App Router · Turbopack)
  (auth)/login      หน้า login
  (dashboard)/      ทุกหน้าหลังบ้าน — ผ่าน Proxy + layout guard (orders/quotations/customers/products/
                    production/billing/analytics/my-tasks/notifications/settings/*)
                    /production = โต๊ะงานหัวหน้าแบบ A (2026-09-02 · production-desk-page/-view + lib/production-desk) · /production/[id] + print-runs/films//outsource ถอดออกแล้ว รอออกแบบใหม่ (ROADMAP §A §A3)
  (public)/         หน้าลูกค้า/ร้านนอกถือ token ไม่ต้อง login: approve/design · status · upload · quote · job
  (print)/print/    เอกสาร A4 light-only: invoice · quotation · billing-note · job-ticket · packing-list
  (v2)/v2/*         compatibility redirect ไป URL หลัก (คง query)
  factory/          จอโรงงาน: /factory (TV อ่านอย่างเดียว) · จอสถานี /factory/station ถอดออก 2026-09-02 รอออกแบบใหม่ (ROADMAP §A2)
  proto/            หน้าลองเทียบทางเลือก UI ให้เบสเคาะ — ทะเบียน proto/_registry.ts (skill /proto)
  api/trpc/         endpoint เดียวของ tRPC
  api/files/        อ่านไฟล์ private bucket ผ่าน signed URL (เช็ค User + isActive)
  api/mcp/          MCP server ให้ AI agent (auth ด้วย agent key · เคารพสิทธิ์)
  api/cron/         overdue (กวาดบิลเลยกำหนด) · stock-reservations (ปลดจองค้าง) — Bearer CRON_SECRET · fail-closed
  api/backup/       export JSON ทุกตาราง (OWNER)

src/proxy.ts        Next 16 Proxy: refresh Supabase session ทุก request + redirect + public allowlist (มี proxy.test.ts)
src/components/     UI components (ui/ = primitives · layout/ · orders/ · production/ · public/ ฯลฯ)
src/hooks/          React hooks ฝั่ง client

src/server/routers/ tRPC routers — "ผิว" เท่านั้น: zod validate + requireRole/permission +
                    เรียก service + จัด response · ห้ามฝัง business logic แกนที่นี่
src/server/services/ ★ business logic แกน — เงิน/สถานะ/เลขเอกสาร/ผลิต ต้องอยู่ที่นี่
  pricing.ts        สูตรราคาตัวจริง (สูตร A) — ทุก mutation ที่แตะยอดต้องผ่าน
  order-status.ts   transitionOrder = จุดเดียวที่เปลี่ยน internalStatus ได้
  document-number.ts nextDocumentNumber = เลขเอกสารรันต่อเนื่อง (เรียกใน tx เสมอ)
  money.ts          Decimal helpers (D/round2/moneyInput/aggToNumber)
  billing.ts        บิล/รับเงิน/void/refund/CN-DN ใต้ $transaction + row lock
  payment-plan.ts · receivables.ts · overdue.ts · dunning.ts   เทอม/ลูกหนี้/aging/วงเงิน/ทวง
  manufacturing*.ts · routing-template.ts · production-v2-gate.ts   Production V2 (MO/Operation/routing/command)
  production-readiness.ts · qc.ts · print-run*.ts · stock-reservation.ts   ด่านผลิต/QC/รอบพิมพ์/จองสต๊อก
src/server/trpc.ts  context + auth middleware (requireRole)
src/server/helpers.ts createAuditLog / createNotification

src/lib/            ของใช้ร่วม client+server
  prisma.ts         ★ Prisma client + result extension แปลง Decimal→number ตอนอ่าน
  superjson.ts      ตาข่าย wire: Decimal ที่หลุดมาถูกส่งเป็น number
  pricing.ts        สูตร preview ฝั่ง client — ต้อง mirror services/pricing.ts เสมอ (มี test คู่)
  order-status.ts   state machine (isValidTransition/labels/flows)
  permissions.ts · roles.ts   สิทธิ์รายคน (PERM) + กลุ่ม role ที่เห็นเงิน
  status-config.ts · payment-methods.ts · payment-terms.ts · shipping-methods.ts   ค่า+ป้าย ที่เดียว ห้ามประกาศซ้ำ
  production-steps.ts · production-v2-flag.ts   ขั้นผลิต legacy + flag V2
  supabase*.ts      auth (browser/server/admin)
  stock-api.ts / stock-sync.ts   ท่อคุยกับ Anajak Stock app

prisma/schema.prisma + prisma/migrations/  (ใช้ `prisma migrate dev` เท่านั้น ห้าม db push)
prisma/seed.ts      master data เท่านั้น (idempotent · รวมสูตรขั้นงานมาตรฐาน) — ห้ามใส่ demo data
prisma/seed-demo.ts + scripts/run-local-demo.ts   ฐานทดลอง local (docs/local-demo-data.md)
scripts/            create-owner.ts (bootstrap) · create-agent-key.ts (MCP) · verify-*.ts (integration กับ DB — รายชื่อใน package.json)
                    verify-ui-tokens.tsx = ด่าน design system (`npm run verify:ui`)
```

## กฎเหล็ก (ตัดสินใจไว้แล้ว — อย่าฝ่าโดยไม่อ่านที่มา)

| เรื่อง | กฎ | ที่มา |
|---|---|---|
| เงินใน DB | Decimal(12,2) เท่านั้น · โค้ดอ่านได้ number ผ่าน extension · **aggregate/_sum ต้องแปลงเอง `aggToNumber`** | P0.2 |
| สูตรยอดออเดอร์ | สูตร A: `total = max(0, items+fees-discount + tax)` · **platformFee ไม่เข้ายอด/ฐาน VAT** (เงินที่ marketplace หักจากร้าน) | P0.2 |
| คำนวณเงินฝั่งเขียน | Decimal ใน `services/pricing.ts` ปัด half-up 2 ตำแหน่ง · เงินหลายขั้นตอน = `$transaction` + lock แถวที่เสี่ยงชน | P0.2 |
| สถานะออเดอร์ | เปลี่ยนผ่าน `transitionOrder` เท่านั้น (validate + กัน race + revision) — ห้าม set `internalStatus` ตรง ยกเว้นค่าเริ่มต้นตอน create · เมื่อเปิด V2 สถานะการผลิต/ส่งมาจาก manufacturing event | P0.2 · PV2 |
| เลขเอกสาร | `nextDocumentNumber(tx, type)` ใน transaction เดียวกับการสร้างเอกสาร — ห้ามสุ่ม/นับเอง (กฎหมายใบกำกับ) | P0.2 |
| สิทธิ์ | ทุก mutation ต้องมี `requireRole`/permission · UI อ่าน effective permission ชุดเดียวกับ server (`permAllows`) · Station/TV DTO ไม่มีเงิน | P0.1 · PERM |
| ใบกำกับภาษี | ออกทุกงวดรับเงินรวมมัดจำ · ยกเลิก-ออกใหม่เท่านั้น ห้ามลบ · CN/DN อ้างใบเดิม + เหตุผล | Gate B |
| Production V2 | command ต้องมี `commandId` + `expectedRevision` · readiness/availableCommands คำนวณที่ server · routing ที่ release แล้ว immutable | PV2 |
| UI ใหม่ | component/token ใน `docs/DESIGN.md` · ห้าม `window.prompt/confirm` (lint error) · ด่าน `verify:ui` | P1.0 |

## Test
- `npm test` — vitest unit (`src/**/*.test.ts`): สูตรราคา (server+client mirror) · state machine · เลขเอกสาร · money · payment-plan · receivables · routing-template · proxy ฯลฯ — **เกราะของทุก refactor ต้องผ่านก่อน**
- `npm run verify:ui` — ด่าน design system (token/สี/ความกว้าง/ข้อห้าม) — ห้ามปิด
- `npm run verify:<x>` — integration จริงกับ DB (เงิน/เทอม/ใบวางบิล/ops/e2e/QC/…) ⚠️ สร้างข้อมูลจริง — **รันบนฐาน demo เท่านั้น** (`docs/local-demo-data.md`)
- CI (`.github/workflows/ci.yml`): lint + typecheck + unit ทุก push/PR — ไม่รวม build/verify:* (ต้องมี env/DB)
