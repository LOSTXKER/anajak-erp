---
version: 1
slug: "src-app-dashboard-production-page-tsx"
primary_target: "src/app/(dashboard)/production/page.tsx"
related_targets: ["src/app/(dashboard)/production/[id]/page.tsx","src/app/(dashboard)/production/print-runs/page.tsx","src/components/production/production-board-view.tsx","src/components/production/production-now-card.tsx","src/components/production/production-steps-list.tsx","src/components/production/garment-pick-card.tsx","src/components/material-usage.tsx","src/lib/production-board.ts","src/lib/production-step-actions.ts","src/lib/print-run-workspace.ts","src/server/routers/production.ts","src/server/routers/print-run.ts","src/server/services/print-run.ts"]
---

# Scope and mode

- Surface ที่ ship: canonical `/production`, `/production/[id]` และ `/production/print-runs` ใต้ dashboard shell เดิม.
- Mode: Operate.
- ผู้ใช้หลัก: เจ้าของ/หัวหน้าบนคอมและจอทัชตั้งในโรงงาน; 390px เป็น fallback ที่ยังต้องใช้ได้ครบ.
- งานหลัก: เห็นว่างานกองอยู่สถานีไหน → เปิดใบที่ต้องลงมือ → จัด DTF เข้ารอบพิมพ์และปิดงานหลังพิมพ์.
- Primary action: เปิดใบผลิตจากบอร์ด; action เปลี่ยนข้อมูลอยู่ในใบผลิตหรือรอบพิมพ์ตามสิทธิ์เท่านั้น.

# Data truth and boundaries

- ใช้ `production.kanban`, `production.getById`, `printRun.queue`, `printRun.list` และ `user.me` จริง; presentation model เป็น pure grouping/filtering เท่านั้น.
- mutation, payload, invalidation, polling, permission, due-date sort, QC/outsource/readiness gate และ transition `PRINTING → PRINTED → COMPLETED` ใช้ controller/server เดิมทั้งหมด.
- บอร์ดและใบผลิตไม่มีข้อมูลเงิน; สิทธิ์ fail closed และ error ของ query สิทธิ์มี state/retry ของตัวเอง.
- ไม่เพิ่ม schema, endpoint, dependency, config, mutation หรือกฎสถานะในงาน UI นี้. `/production/films` เป็น surface แยก.
- loading, error, success-empty, not-found และ read-only ต้องไม่ใช้หน้าตาเดียวกันหรือกลบกันด้วย `[]`/`null`.

# Chosen direction

- Thesis: กระดานหน้าโรงงานที่พาไปยังโต๊ะลงมือจริง ไม่ใช่ dashboard ที่เล่าเรื่องซ้ำ.
- Story: **ตำแหน่งกองงาน → สิ่งที่ต้องทำตอนนี้ → รอบ DTF ที่กำลังไหล**.
- World: P1.0 canonical ERP — workspace เกือบขาว/neutral dark, white/charcoal work surfaces, Anajak cobalt เฉพาะ primary/selected/focus, Prompt และ Lucide เดิม.
- ข้อมูลบนการ์ดจำกัดเฉพาะสิ่งที่ใช้เลือกงาน; ไม่มี hero metrics, nested cards, CTA ซ้ำ หรือข้อความอธิบายยาว.

# As-built topology

## Production board

- desktop เป็นคอลัมน์สถานีจริงเรียงทางเดินงาน; การ์ดในแต่ละคอลัมน์เรียงกำหนดส่งและงานผสมอยู่ได้หลายสถานีตามจริง.
- กดหัวคอลัมน์กรอง `?lane=`; ค้นหาและเรียงเก็บใน URL. การ์ดทั้งใบเปิด `/production/[id]` และไม่มี mutation บนบอร์ด.
- mobile ซ้อนสถานีลงแนวตั้ง; horizontal scroll ถูกกักในบอร์ด ไม่ลากทั้งหน้า.

## Production detail

- ใช้ `PageShell width="content"` จุดเดียวทุก state.
- ลำดับ: บริบทกำหนดส่ง/ด่วน/จำนวน/ความคืบหน้า → “ตอนนี้ต้องทำ” → แบบและไซส์ → ขั้นทั้งหมด → เบิกเสื้อ → วัตถุดิบ.
- งานผสมคืน action ได้หลายเลนพร้อมกันตาม `selectNowSteps`; gate ที่มีอยู่บอกเหตุผลแทนปุ่มเมื่อกดไม่ได้.

## Print runs

- DOM และ mobile order: **กำลังพิมพ์ → รอตัดแยก+ติดป้าย → คิวพิมพ์ → ประวัติ**.
- desktop/laptop เป็น first workspace สองฝั่ง 4:6 และขยาย 5:7; history อยู่นอก grid เต็มแถว.
- queue รักษาลำดับจาก service; thumbnail link เป็น sibling ของ row selection. Selection bar อยู่ก่อน long queue, sticky ใน overflow context ที่ถูก และมี forward keyboard path ไป action.

# Interaction, state, and accessibility contract

- ทุกหน้ารอ query ข้อมูลและ `user.me`; initial error มี retry และ cached data ไม่ถูกถอนเพราะ background refetch ล้ม.
- ผู้ไม่มี `manage_production` ยังเห็นข้อมูล/runs แต่ไม่เห็น mutation control; server guard ยังคงเป็นด่านจริง.
- control บนมือถือและ `pointer: coarse` ≥44×44px; desktop fine pointer คง density 36px ได้.
- dialog/input มี programmatic label, validation ใช้ `aria-invalid` + `aria-describedby`, dynamic selection ใช้ live region และ pending action ใช้ `aria-busy` + ข้อความ “กำลัง…”.
- reduced motion หยุด spinner/transition ได้โดยข้อความสถานะยังอยู่; keyboard focus ไม่พึ่ง hover และไม่มี `<a>` ซ้อน `<button>`.

# Implementation inventory

| Commitment | Implementation |
|---|---|
| บอร์ดโรงงานและ URL state | `ProductionBoardView`, `buildProductionBoard`, `useListPageState` |
| ใบผลิตแบบลงมือ | `PageShell`, `ProductionNowCard`, `selectNowSteps`, controller/mutation เดิม |
| เบิกเสื้อ/วัตถุดิบ | compact query states + field/dialog primitives + mutations เดิม |
| รอบพิมพ์ 4 ชั้น | `splitPrintRunsByStage`, pure `PrintRunsPageView`, service order เดิม |
| สิทธิ์/read-only | `user.me`, `permAllows`, PageShell gates และ router permission เดิม |
| touch/a11y | control-size coarse-pointer token, semantic text token, labels/live state |

# Finish evidence and verdict

- Browser ใช้ข้อมูลจริงแบบ read-onlyบน cold dev origin; ไม่สร้าง demo transaction และไม่รัน `verify:printrun` บนฐานแชร์.
- `/production` และ `/production/[id]` มี populated records จริง; print-run ใช้ runtime empty state + non-DB SSR fixtures สำหรับ populated manager/read-only DOM contract.
- Browser final ผ่านทั้ง 3 route ที่ 1440×900 + 390×844 Light/Dark: ไม่มี horizontal overflow, hydration, console error หรือ action overlap; mobile interactive ที่มองเห็น ≥44×44px.
- `typecheck`, lint 0 error (28 warning เดิม), unit 855/855, `verify:ui`, Impeccable detector `[]` และ production build ผ่านครบ.
- Verdict: **SHIP** — canonical production UI ทั้ง PC1–PC4 พร้อมให้เบสตรวจรับเชิงสายตา; ไม่มี DB mutation หรือกฎธุรกิจใหม่ในก้อนนี้.
