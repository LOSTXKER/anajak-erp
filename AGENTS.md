# Anajak ERP — กติกาการพัฒนา

อ่าน [README.md](README.md) สำหรับผู้ใช้ ขอบเขต วิธีเริ่มใช้ ฐานทดลอง และการปล่อยระบบ; [SPEC.md](SPEC.md) คือพฤติกรรมและเกณฑ์ตรวจ; งานและสถานะอยู่ [ROADMAP.md](ROADMAP.md) เพียงไฟล์เดียว

## จุดสำคัญของโค้ด

| ตำแหน่ง | หน้าที่ |
|---|---|
| `src/app/(dashboard)/` | หลังบ้าน: ออเดอร์ ลูกค้า ผลิต การเงิน สินค้า ตั้งค่า และรายงาน |
| `src/app/(public)/` | ลิงก์ลูกค้า/ร้านนอกตาม token; คงขอบเขตข้อมูลของแต่ละลิงก์ |
| `src/app/(print)/print/` | เอกสารพิมพ์ 5 แบบ; ใช้ส่วนกลาง `src/components/print/` |
| `src/app/production/floor/`, `src/app/station/`, `src/app/factory/` | จอช่าง ทางเข้าสถานีเดิม และ TV; ตรวจ route จริงก่อนแก้ |
| `src/proxy.ts`, `src/app/(dashboard)/layout.tsx` | ต่อ session, public allowlist และ guard หลังบ้าน |
| `src/app/api/` | tRPC, private files, MCP, cron และ export สำรองข้อมูล |
| `src/server/routers/`, `src/server/trpc.ts` | validate input, auth/permission และเรียก service |
| `src/server/services/` | กฎธุรกิจแกน: เงิน เลขเอกสาร สถานะ ผลิต QC และจองสต๊อก |
| `src/server/services/{pricing,billing-payment,document-number,money}.ts` | สูตรราคา ธุรกรรมรับเงิน เลขรัน และ Decimal helpers |
| `src/server/services/order-status.ts`, `src/lib/order-status.ts` | transition และ state machine; ไม่ตั้งสถานะจาก UI |
| `src/server/services/manufacturing-*.ts`, `routing-template.ts`, `production-v2-gate.ts` | Manufacturing V2, routing และด่านเปิดใช้ |
| `src/lib/prisma.ts`, `src/lib/superjson.ts` | Prisma client/Decimal extension และ serialization |
| `src/lib/pricing.ts` | สูตร preview ต้องตรงกับ service และทดสอบคู่กัน |
| `src/lib/permissions.ts`, `roles.ts` | สิทธิ์และกลุ่มที่เห็นเงิน; ใช้ effective permission ชุดเดียวกับ server |
| `src/lib/status-config.ts`, `payment-methods.ts`, `payment-terms.ts`, `shipping-methods.ts`, `date-utils.ts` | ค่า/ป้ายร่วมและวันตาม Asia/Bangkok; ค้นของเดิมก่อนประกาศซ้ำ |
| `src/lib/stock-api.ts`, `stock-sync.ts`, `customer-upload-policy.ts` | เชื่อม Anajak Stock และนโยบายไฟล์ร่วม client/server |
| `src/components/`, `src/hooks/` | ส่วนแสดงผลและ hooks; UI ที่เลือกและส่วนกลางดู [DESIGN.md](DESIGN.md) |
| `prisma/schema.prisma`, `prisma/migrations/` | Schema และ migration; master data อยู่ `prisma/seed.ts` |
| `prisma/seed-demo.ts`, `scripts/run-local-demo.ts` | ฐานทดลองที่ระบุเป้าหมายตายตัว; วิธีใช้และผลของ reset อยู่ README |
| `scripts/verify-*.ts`, `scripts/verify-*.tsx` | ด่านเฉพาะเรื่อง; ตรวจแต่ละคำสั่งว่าใช้ DB หรือไม่ก่อนรัน |

## กติกาเฉพาะโครงการ

- แตะตามขอบเขตที่เบสสั่ง ค้น pattern เดิมก่อนสร้างใหม่; refactor เฉพาะจุดและตรวจผลจริง
- เงินฝั่งเขียนใช้ Decimal; aggregate แปลงผ่าน `aggToNumber`. ราคา สถานะ เลขเอกสาร และธุรกรรมต้องผ่าน service/transaction/lock ตาม SPEC; ห้ามสร้างกฎอีกชุดใน router หรือ UI
- mutation ตรวจสิทธิ์ที่ server; สถานะผ่าน `transitionOrder`/`isValidTransition`, เลขเอกสารผ่าน `nextDocumentNumber` ใน transaction เดียวกัน. Station/TV DTO ไม่มีเงินแม้เป็น OWNER
- ใบกำกับออกทุกงวดรวมมัดจำ; ยกเลิกและออกใหม่ตาม SPEC ห้ามลบ. งานตั้ง repo/UI ไม่เปลี่ยนสูตรเงิน สิทธิ์ สถานะ API หรือเปิด Production V2
- Schema ใช้ migration เท่านั้น ห้าม `db push`; ฐาน shared/remote ต้องระบุ target, backup และมีการอนุมัติก่อนเขียน
- ทุกงาน UI ใช้สกิล `ui-guidance` ฉบับปัจจุบัน (`global-skills/ui-guidance/SKILL.md` ในสมองที่ป้ายระดับเครื่องระบุ) ร่วมกับ DESIGN/SPEC. คงคำช่วย เหตุผลที่ทำไม่ได้ และผลคำสั่งตรงจุดใช้
- ทิศทางที่ยังไม่เลือกใช้ตัวอย่างเล็กจากงานจริงให้ตัดสินใจ; เพิ่มทางเลือกเมื่อมีข้อแลกเปลี่ยนจริง ไม่สร้าง `/proto` หรือกำหนดจำนวนแบบโดยอัตโนมัติ. ทิศที่อนุมัติแล้วทำต่อได้ตามขอบเขตใน ROADMAP
- ไม่ปิด tests, lint หรือ `verify:ui` เพื่อให้ผ่าน; ไม่ใช้ `window.prompt/confirm`. งานพิมพ์ต้องคงยอด ข้อความทางบัญชี และสิทธิ์ตาม SPEC

## วิธีทำงาน

1. เปิด README, กฎนี้, SPEC ส่วนที่เกี่ยว, ROADMAP `§ ตอนนี้ทำ` และ `git status`/`git log` ก่อนเริ่ม; การ์ดจาก hook เป็นทางลัด ถ้าถูกตัดต้องเปิดไฟล์เต็ม
2. มีงานปัจจุบันเดียวใน ROADMAP; งานใหญ่แตกขั้นก่อนแก้โค้ด เก็บคิวถัดไปใน `§ คิว` และงานพักใน `§ พักไว้`. งานใหม่ที่ได้รับอนุมัติบันทึกขอบเขตก่อนลงมือ ไม่ถามซ้ำเรื่องที่อนุมัติแล้ว
3. ทำและตรวจทีละส่วนกับเกณฑ์ SPEC; UI ต้องเปิดผลจริงและลองภารกิจ/กรณีติดขัดตามขนาดงาน. ผลจาก agent ต้องอ่านหลักฐานก่อนสรุป
4. ปิดรอบอัปเดตทำถึงไหน/ผลตรวจ/ข้อขัดข้อง/จุดต่อใน ROADMAP ครั้งเดียวเมื่อมีการเปลี่ยนแปลง; งานเสร็จเอาออกจากแผน เกณฑ์ถาวรเก็บใน SPEC ประวัติอยู่ Git
5. ตรวจ `npm run typecheck`, `npm run lint`, `npm test`, `npm run verify:ui` ก่อน commit ตามเกณฑ์ SPEC; ด่านที่เขียน DB ใช้ฐานทดลองที่ยืนยัน target แล้วเท่านั้น. ไม่ยกผลตรวจเอกสารเป็นผลตรวจแอปหรือ release
6. ตรวจ diff แล้ว stage เฉพาะไฟล์งานนี้; commit บรรทัดแรกเป็นภาษาไทยที่คนอ่านเข้าใจด้วย `git commit -F -`, push branch. โครงการต่อ Vercel: merge/release ตามการอนุมัติ ห้าม push main ตรง
7. ใช้ hook กลางของ BestOS ที่เครื่องติดตั้งไว้; ไม่เพิ่มตัวโหลดสถานะซ้ำใน repo และไม่เปลี่ยน trust แทนผู้ใช้. เครื่องอื่น/cloud ต้องตรวจการติดตั้งและเหตุการณ์จริงแยก

## เจ้าของเอกสาร

- README = ภาพรวมและวิธีใช้; SPEC = ข้อกำหนดที่ตรวจได้; ROADMAP = งานและสถานะ; DESIGN = ทิศทาง/แหล่ง token; AGENTS = กติกาและตำแหน่งโค้ด; CLAUDE = `@AGENTS.md` เท่านั้น
- ไม่เพิ่ม PRODUCT/PROGRESS/PLAN ซ้ำกับ ROADMAP หรือเอกสารรายงานที่ root. ROADMAP ≤20KB, DESIGN ≤4KB, AGENTS+CLAUDE <200 บรรทัด
- เรื่องธุรกิจ research และบัตรโครงการอยู่ในสมอง `records/projects/anajak-erp/`; ไม่คัดสถานะ repo ลงบัตร
- คง `docs/sql/storage-private-rollout.sql` ซึ่งเป็นสคริปต์ตั้ง Storage, `.github/**` และไฟล์ที่โค้ด/CI ใช้; ตรวจผู้อ่านก่อนย้ายไฟล์หรือถอด hook

## ขอบเขตการลงมือ

ทำตามใบงาน ตรวจโค้ด/เอกสาร และ housekeeping ที่ย้อนกลับได้ตามสิทธิ์เดิม. การตั้ง repo ไม่อนุมัติเปลี่ยนผลิตภัณฑ์ ปล่อยเว็บ เพิ่ม dependency หรือแก้ schema เอง; ขอข้อมูลเพิ่มเฉพาะเรื่องนอกขอบเขตที่จำเป็น. ห้าม force push, commit secret, ล้างข้อมูลจริง หรือแก้สถานะตรงเพื่อให้หน้าจอดูคุ้น

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
