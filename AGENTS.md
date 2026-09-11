# Anajak ERP — กติกาการพัฒนา

อ่าน [README.md](README.md) สำหรับภาพรวม การตั้งค่า และคำสั่ง; [SPEC.md](SPEC.md) สำหรับพฤติกรรมที่ต้องรักษา; [ROADMAP.md](ROADMAP.md) สำหรับงานและสถานะ; [DESIGN.md](DESIGN.md) สำหรับหน้าตา

## โครงสร้างที่ต้องรู้ก่อนแก้

- `src/app/`: `(dashboard)` หลังบ้าน · `(public)` หน้าลูกค้า/ร้านนอกผ่าน token · `(print)/print` เอกสาร A4 · `(auth)` login · `(v2)` redirect ที่ต้องเข้ากันได้ · `production/floor` หน้างานช่าง · `factory` จอ TV อ่านอย่างเดียว · `api` tRPC/files/MCP/cron/backup
- `src/proxy.ts` ดูแล session และทางสาธารณะ; `src/instrumentation.ts` เรียก `src/lib/env.ts` ตรวจค่าตอนบูต
- `src/server/routers/_app.ts` รวม tRPC; router ตรวจ input/สิทธิ์แล้วเรียก `src/server/services/` ที่เก็บกฎธุรกิจ; context และสิทธิ์อยู่ `src/server/trpc.ts`
- `src/lib/` เก็บของร่วม client/server; `src/components/ui/` primitives; `src/components/<โมดูล>/` หน้าธุรกิจ; `src/hooks/` hooks; `src/types/` types
- `prisma/schema.prisma` และ `prisma/migrations/` คือโครงข้อมูล; `prisma/seed.ts` master data; `seed-demo*.ts` ข้อมูลทดลอง; `scripts/` ตัวตรวจและเครื่องมือเฉพาะงาน
- `scripts/storage-private-rollout.sql` เป็น SQL ต้นฉบับของ policy Storage; อ่านก่อนแก้นโยบายไฟล์

## วิธีทำงานและจัดเอกสาร

1. อ่าน ROADMAP § ตอนนี้ทำ และ SPEC ที่เกี่ยวก่อนลงมือ การ์ดจาก hook เป็นทางลัด; ถ้าถูกตัดให้อ่านไฟล์จริง
2. ทำตามโจทย์ที่เบสอนุมัติแล้ว งานใหญ่แตกขั้นใน § ตอนนี้ทำ ก่อนแก้; ไม่หยิบงานนอกขอบเขตมาขยายเอง
3. ตรวจตามผลกระทบ: โค้ดใช้ typecheck, lint, test และ verify:ui ตาม README; UI ต้องเปิดจริงที่ 1440/390 ทั้งสว่าง/มืดและลองบทบาทที่เกี่ยว; build ก่อนขอปล่อยจริง งานเอกสารตรวจลิงก์ ตัวอ่าน และเนื้อหาที่กระทบ
4. ปิดรอบอัปเดต ROADMAP § ตอนนี้ทำ ด้วย `ทำถึงไหน / ตรวจแล้ว / ติดอะไร / ทำต่อ` ครั้งเดียวเมื่อข้อมูลเปลี่ยน ระบุผลที่รันจริงและส่วนที่ยังไม่ได้ตรวจ
5. งานเสร็จลบจากแผน ประวัติอยู่ Git; เกณฑ์ที่ต้องรักษาอยู่ SPEC เสมอ Stage เฉพาะงานนี้ → commit หัวเรื่องไทยอ่านรู้เรื่อง ≤90 ตัว → push branch

- ใช้ ROADMAP ชื่อเดิม เพราะโค้ดอ้างรหัสงาน A2/A5/B15/PERM ฯลฯ ไม่สร้าง PLAN หรือ PROGRESS อีกชุด; คิวไม่เกิน 15 รายการ และไฟล์ไม่เกิน 20KB
- README เป็นภาพรวม/เริ่มใช้, SPEC เป็นข้อกำหนด, DESIGN ≤4KB ชี้ token จริง, CLAUDE เป็น `@AGENTS.md`; ไม่เพิ่ม PRODUCT/OVERVIEW หรือกอง docs ซ้ำ
- เก็บเอกสารเพิ่มเติมเฉพาะที่โค้ด/CI อ่านจริงหรือแพ็กเกจย่อยต้องใช้ แผนธุรกิจ/research/บัตรโปรเจกต์อยู่สมอง `records/projects/anajak-erp/`; ไม่คัดสถานะ repo ไปที่บัตร
- Hook โหลดสถานะใช้ระบบกลาง BestOS; ไม่สร้าง `progress-on-start.mjs` กลับมา และไม่ทับ hook/permissions ของผู้ใช้

## แบบแผนโค้ด

- TypeScript strict; alias `@/*` คือ `src/*`; kebab-case; 2 ช่อง/LF ตาม `.editorconfig`; double quote และ semicolon
- แก้เฉพาะโจทย์ ค้น pattern เดิมก่อนสร้างใหม่; business logic อยู่ service; procedure ใหม่ใช้ `requirePermission` และย้าย `requireRole` เดิมเมื่อแตะเรื่องนั้น
- ป้ายและค่ากลางอยู่ `src/lib/status-config.ts`, `payment-methods.ts`, `payment-terms.ts`, `shipping-methods.ts`, `order-status.ts`; สูตร preview `src/lib/pricing.ts` ต้องตรงกับ service ฝั่ง server
- ใช้ `useListPageState`, `usePageClamp`, `requestAppNavigation`, `differenceInBangkokDays`, `PageShell`, `DataTable`, `TablePagination` และ `src/lib/customer-upload-policy.ts` ก่อนสร้างซ้ำ; ใบผลิต/หน้างานใช้ `work-order-controller` ร่วมกัน
- Tests วางข้างไฟล์เป็น `*.test.ts`; Vitest จับเฉพาะ `src/**/*.test.ts` ไม่จับ `.test.tsx` ชื่อ test ไทยสื่อพฤติกรรม
- ใช้ `useConfirm`/`usePromptText` แทน alert; ไม่ปิด lint, tests หรือด่านตรวจเพื่อให้ผ่าน

## จุดที่แก้พลาดแล้วกระทบข้อมูล

- เงินใช้ `Prisma.Decimal`/`Decimal(12,2)` และ `round2` ใน `money.ts`; แปลงเป็น number ที่ขอบ `src/lib/prisma.ts`, aggregate ใช้ `aggToNumber`; ห้าม Float ในช่องเงิน
- เลขเอกสารใช้ `nextDocumentNumber()` ใน transaction ที่สร้างเอกสาร งานเงินหลายขั้นล็อกแถวก่อนอ่าน/เขียน รักษา `billedFloor` และทางซ่อมยอดเก่าใน `assertOrderTotalCoversBilled` ตาม SPEC
- เอกสารเงินยกเลิกพร้อมเหตุผล ไม่ลบประวัติ; snapshot คู่ค้าใช้ `document-party.ts`; งานหน้าตาไม่เปลี่ยนข้อความกฎหมาย ยอด หรือลำดับหน้า
- เปลี่ยน `internalStatus` ผ่าน `transitionOrder()` เท่านั้น; readiness สิทธิ์ และคำสั่งถัดไปมาจาก server ไม่ทำสูตรคู่ขนานที่จอ
- Production V2 ต้องผ่าน ROADMAP §B ก่อนเปิดฐานจริง; รักษา `commandId`, `expectedRevision`, released routing และ ownership guard แม้ปิด flag; ห้ามเปลี่ยนชื่อตาราง `design_versions`
- จอหน้างาน/สถานี/TV ใช้ DTO ไม่มีเงินแม้ OWNER; จออื่นตัดข้อมูลเงินตาม permissions จริง ไม่เดาจาก role อย่างเดียว; ไม่ขยาย flow ผลิตเป็น job costing
- Auth ต้องมี Supabase session และ User active; server ตรวจสิทธิ์; `manage_users` OWNER เท่านั้นและต้องเหลือ active OWNER; ทาง public อยู่ `src/lib/public-routes.ts`/`src/proxy.ts`; ไม่แทรก logic ระหว่าง `createServerClient` กับ `getUser`
- ไฟล์ใน private bucket `designs` อ่านผ่าน `/api/files`; upload `upsert: false`; token เปิดได้เฉพาะ allowlist/อายุที่กำหนด; service role อยู่ server; cron ต้อง `CRON_SECRET`, MCP เก็บ key แบบ sha256
- Repo นี้ public: ไม่เก็บ secret ข้อมูลลูกค้าหรือโน้ตธุรกิจใน tracked files; ไม่พิมพ์รหัสผ่านหรือสร้างกุญแจ MCP แทนเบส
- Stock เป็นระบบจริงที่เขียนข้อมูลได้ ฐานทดลองต้องมี demo flag/target ถูกต้องและไม่มี Stock credentials ตาม README; ห้ามผ่อนด่านใน `demo-seed-plan.ts`
- Schema ใช้ additive migration; ฐานร่วม/ฐานจริงต้องระบุ target มี backup และการอนุมัติก่อน apply/seed/เปลี่ยน flag ห้าม reset หรือ db push; master seed ต้อง idempotent และไม่ทับราคาที่ผู้ใช้แก้

## UI และขอบเขตการปล่อย

- ทิศปัจจุบันอยู่ DESIGN; มีหลายทางเลือกในการเปลี่ยนหน้าจริงให้เบสเคาะก่อน ไม่สร้าง `/proto` เว้นแต่เบสสั่ง
- ใช้ข้อมูลจริงกับปุ่ม; คำอธิบายที่จำเป็นใช้ tooltip ได้ แต่ warning, validation, เหตุที่ล็อก, สิทธิ์ไม่พอ, เตือนก่อนบันทึก และ EmptyState ต้องยังเห็น
- งาน presentation ไม่เปลี่ยน query/mutation/permission/status/schema ถ้าโจทย์ไม่สั่ง; หน้าดู `orders/detail/order-items-display.tsx` ต้องตามฟอร์ม `orders/new/order-item-card.tsx`
- `verify:ui` ต้องอยู่; baseline `scripts/ui-hierarchy-baseline.json` ลดได้เมื่อดีขึ้นจริง ไม่เพิ่มและไม่ลบข้อมูลบนจอเพื่อหลบด่าน; เปลี่ยนค่าคาดหวังเมื่อบทบาท token เปลี่ยนใน commit เดียวกัน
- ทำเองได้ภายในโจทย์ที่อนุมัติ: แก้/ตรวจ/จัดเอกสารและ commit/push branch; การอนุมัติที่มีแล้วไม่ต้องถามซ้ำ
- งานแตะ schema/dependency/auth/env หรือระบบจริงต้องอยู่ในขอบเขตที่เบสอนุมัติ; การ merge/ปล่อยเว็บจริงแยกจากการตรวจ local ห้าม push main ตรง, force push หรือ `vercel --prod` โดยพลการ
- คงบล็อก Next.js ข้างล่างคำต่อคำ เพราะ `next dev` เขียนกลับเอง

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
