# Anajak ERP — AGENTS.md
> แหล่งความจริงเดียวสำหรับ AI ทุกเจ้า (Claude/Codex/Cursor) · Claude อ่านผ่าน `CLAUDE.md` (`@AGENTS.md`)
> ไฟล์ใน repo = สเปค + แผน + สถานะ + โค้ด เท่านั้น · แผนธุรกิจ/research/ดีไซน์ยาว → repo bestos `records/projects/anajak-erp/` (หา path จาก bestos: `node tools/project/resolve-repo.mjs anajak-erp`)

## โปรเจคนี้คือ
ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak — ทีม 5 คน + เจ้าของ (เบส · non-coder) · ลูกค้า B2B เครดิตเทอม = ฐานรายได้ · **ทำเองมีแค่ DTF** (DTG/silkscreen/ปัก/sublimation/ตัดเย็บ/ป้ายคอ = ส่งร้านนอกทั้งหมด · เบสเคาะ 2026-06-12)
stack: Next.js 16.3 + React 19 + tRPC 11 + Prisma 6 + Supabase + Tailwind 4 + shadcn · deploy Vercel (**push main = ขึ้นเว็บจริง**)

## เป้าหมาย (เบสย้ำ 2026-09-02 — ใช้ตัดสินทุกงาน)
1. **ครอบคลุมทุกอย่างของโรงงานเสื้อ** — ขาย → ออกแบบ/อนุมัติ → ผลิต → QC → แพ็ก/ส่ง → บิล/ภาษี/ลูกหนี้ ในระบบเดียว ไม่ต้องพึ่งกระดาษ/ความจำ
2. **โยนงานให้ที่อื่นอย่างมีประสิทธิภาพ** — ขั้นไหนก็ส่งร้านนอกได้ (รวม DTF วันเครื่องเสีย) · รู้ว่างานอยู่ไหน กลับเมื่อไร ตรวจรับยังไง · ร้านนอกดูงานผ่านลิงก์ ไม่ต้องคุยซ้ำ
3. **UX/UI สวย ทันสมัย ใช้ง่าย** — minimal · เปิดหน้ามารู้ใน 3 วิว่าต้องทำอะไรต่อ · มือถือ/จอทัชหน้างานใช้ได้จริง · หนึ่งหน้า primary action เดียว
4. **รองรับเว็บสกรีนเสื้อในอนาคต** — ออเดอร์จากเว็บ ทั้งแบบธรรมดาและ custom ต้องไหลเข้าเป็นออเดอร์เดียวกับหน้าร้าน (P4) · order model / ราคา / ไฟล์ / อนุมัติแบบ ต้องออกแบบเผื่อ **ไม่ทำทางแยก**

## 🔄 วงจรการทำงาน (บังคับ)
1. **เริ่ม** → อ่าน `PROGRESS.md` (ทำถึงไหน + NEXT) · `ROADMAP.md` (ใบงานที่เปิดอยู่) · `SPEC.md` (อะไรคือเสร็จ) + `git log --oneline -10` · งานทุกชิ้น trace กลับ ROADMAP ได้ — **ไม่อยู่ใน ROADMAP = ถามเบสก่อน ห้ามทำเงียบ**
2. **งานใหญ่/หลายขั้น** → เขียนใบงานใน ROADMAP ก่อนลงมือ · ทำทีละ task ไม่กระโดด
3. **UI ที่มีหลายทาง** → ทำหน้าลอง `/proto/<slug>` เทียบ 2-4 ทางให้เบสเลือกก่อน (ทะเบียน `src/app/proto/_registry.ts` · skill `/proto` ของ bestos) — **ห้ามรื้อของจริงก่อนเคาะ**
4. **ก่อนเคลม "เสร็จ"** → รัน/เปิดดูจริง — type check ผ่าน ≠ ใช้งานได้ (ด่านขั้นต่ำท้าย `SPEC.md`)
5. **ก่อนจบ session** → เขียนทับ `PROGRESS.md` (ตอนนี้/NEXT/เสร็จ/ติด) + commit ก้อนเล็ก **บรรทัดแรกเป็นภาษาคน** (ไม่ใช่ `feat:`/`chore:`) + push เป็น branch

## เอกสารในโปรเจค (แค่นี้ — ห้ามเพิ่มไฟล์แผน/สเปค/mockup ใหม่ที่ root)
| ไฟล์ | ใช้ทำอะไร | กติกา |
|---|---|---|
| `PROGRESS.md` | สถานะสด + NEXT | **เขียนทับ ไม่สะสมประวัติ** (ประวัติ = `git log`) · เพดาน ~100 บรรทัด |
| `ROADMAP.md` | ใบงานที่ยังเปิด · ลองแล้วไม่เอา · จงใจไม่ทำ | เสร็จแล้ว = ย้ายไปดัชนี "เสร็จแล้ว" 1 บรรทัด |
| `SPEC.md` | เกณฑ์ "เสร็จ" · กฎเหล็กข้อมูล · UI ที่เคาะแล้ว · gate | กติกาเปลี่ยน = แก้ที่นี่ก่อนเขียนโค้ด |
| `PRODUCT.md` | product context สำหรับ skill ดีไซน์ (impeccable) | |
| `docs/ARCHITECTURE.md` | ของอยู่ตรงไหน วางของใหม่ที่ไหน | อ่านก่อนวางโค้ดใหม่ |
| `docs/DESIGN.md` | design system + contract หน้า production/station | UI ใหม่ต้องตาม |
| `docs/deploy-checklist.md` | สิ่งที่ต้องทำใน Supabase/Vercel console ก่อนใช้จริง | |
| `docs/local-demo-data.md` | ฐานทดลอง local (`npm run dev:demo`) | |
mockup/audit/spec ที่จบแล้ว **ไม่เก็บใน repo** — ดูใน git history (`git log --all -- <path>`) หรือ bestos records · หน้าลอง `/proto` ที่เคาะแล้วเก็บตามสถานะในทะเบียน

## กติกา build (ย่อ — เต็ม `ROADMAP.md` §กติกา)
- **surgical**: แตะเฉพาะที่ใบงานสั่ง · เลียน pattern เดิม (grep ก่อนสร้างใหม่) · refactor = targeted + test ก่อน ห้าม big-bang
- **เงิน = Decimal เท่านั้น** (ห้าม Float ใหม่) · เลขเอกสารรันต่อเนื่องผ่าน `DocumentSequence` (ห้ามสุ่ม) · การเงินหลายขั้น = `$transaction` + lock แถว
- **status เปลี่ยนผ่าน `transitionOrder` / `isValidTransition` ที่ server เท่านั้น** — ห้าม set ตรง · business logic แกน (ราคา/สถานะ/เลขเอกสาร) อยู่ `src/server/services/` · tRPC router = ผิว
- ใบกำกับภาษี: ออก**ทุกงวดรับเงินรวมมัดจำ** (จ้างทำของ) · ยกเลิก-ออกใหม่เท่านั้น **ห้ามลบ**
- UI: component มาตรฐานใน `docs/DESIGN.md` · mobile-first หน้า ops · ห้าม `window.prompt/confirm` · Station/TV ห้ามมีเงินโดยโครงสร้าง · ด่าน `npm run verify:ui` ห้ามปิด
- **ไม่ build**: GL/บัญชี · job costing/ต้นทุนต่อออเดอร์ (เบสเคาะ 2026-06-12 — ห้ามเพิ่มช่องเงินใน flow ผลิต/outsource) · DTF auto-nesting · in-app chat · online designer · time-clock · WMS (Anajak Stock มี) — เต็ม+เหตุผล `ROADMAP.md` §จงใจไม่ทำ

## คำสั่งหลัก
```bash
npm run dev            # localhost:3000 — ต่อ Supabase จริง
npm run dev:demo       # ฐานทดลอง local (ดู docs/local-demo-data.md) — dev สองตัวพร้อมกันไม่ได้
npm run typecheck && npm run lint && npm test && npm run verify:ui   # ด่านขั้นต่ำก่อน commit
npx prisma migrate dev # หลังแก้ schema (ห้าม db push)
npm run db:seed        # master data (idempotent)
npm run verify:<x>     # integration กับ DB — สร้างข้อมูลจริง ห้ามรันบนฐานที่ใช้งาน (รายชื่อใน package.json)
```
external: Anajak Stock (sibling `../anajaktshirt-stock`) — ERP คุยผ่าน `/api/erp/*` + X-API-Key (Settings → Stock)

## permission (3 ชั้น)
- ✅ ทำได้เลย: แก้โค้ดตามใบงาน · รัน test/lint/typecheck · housekeeping เล็ก
- ⚠️ ถามก่อน: ลบไฟล์โค้ด · แก้ schema/migration · เพิ่ม dependency · แตะ config/env · งานนอก ROADMAP · รื้อหน้าจริงที่ยังไม่เคาะทิศ
- ⛔ ห้าม: push main ตรง · commit secret · ลบ/ปิด test หรือด่าน verify เพื่อให้ผ่าน · set status ตรง · Float ให้ฟิลด์เงิน · apply/reset ฐาน shared/remote โดยไม่ระบุ target + backup

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
