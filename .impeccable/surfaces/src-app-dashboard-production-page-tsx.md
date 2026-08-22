---
version: 1
slug: "src-app-dashboard-production-page-tsx"
primary_target: "src/app/(dashboard)/production/page.tsx"
related_targets: ["src/app/(dashboard)/production/[id]/page.tsx","src/app/(dashboard)/production/print-runs/page.tsx","src/components/production/production-board-view.tsx","src/components/production/production-detail-screen.tsx","src/components/production/production-now-card.tsx","src/components/production/production-design-card.tsx","src/components/production/production-steps-list.tsx","src/components/production/garment-pick-card.tsx","src/components/material-usage.tsx","src/lib/production-board.ts","src/lib/production-step-actions.ts","src/lib/print-run-workspace.ts","src/server/routers/production.ts","src/server/routers/print-run.ts","src/server/services/print-run.ts"]
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
- World: Vercel Panel System — Light workspace off-white กับ chrome/panel ขาว และ Dark workspace ดำกับ panel ยกหนึ่ง neutral step; กลุ่มหลักรวมใน panel เส้น 1px มุม 8px ไม่มีเงาตกแต่ง, ห้าม card ซ้อนโดยไม่เพิ่มความหมาย, overlay ลอยสูงสุด; table header เป็น neutral band ต่อเนื่อง, Anajak cobalt ใช้เฉพาะ primary/link/focus, active navigation ใช้ neutral fill, Prompt และ Lucide เดิม.
- ข้อมูลบนการ์ดจำกัดเฉพาะสิ่งที่ใช้เลือกงาน; ไม่มี hero metrics, nested cards, CTA ซ้ำ หรือข้อความอธิบายยาว.

# As-built topology

## Production board

- desktop เป็นคอลัมน์สถานีจริงเรียงทางเดินงาน; การ์ดในแต่ละคอลัมน์เรียงกำหนดส่งและงานผสมอยู่ได้หลายสถานีตามจริง.
- กดหัวคอลัมน์กรอง `?lane=`; ค้นหาและเรียงเก็บใน URL. การ์ดทั้งใบเปิด `/production/[id]` และไม่มี mutation บนบอร์ด.
- mobile ซ้อนสถานีลงแนวตั้ง; horizontal scroll ถูกกักในบอร์ด ไม่ลากทั้งหน้า.

## Production detail

- ใช้ `PageShell width="full"` จุดเดียวทุก loading/error/not-found/permission/success state; หัวใบเป็น context strip พื้นสว่างแบบ compact เห็นเลขงาน สถานะ ชื่องาน/ลูกค้า และข้อมูลกำหนดส่ง/จำนวน/ความคืบหน้าก่อน โดยปุ่มข้อมูลใบงาน ใบสั่งงาน และดูออเดอร์เป็น utility รอง.
- ตั้งแต่ `xl` ใช้ stage dock แนวตั้งกว้าง `16rem` ทางซ้าย; ที่ 1024px และ mobile ใช้ stage selector แนวนอนชุดเดียวกัน. ขั้นเสร็จ/current/failed/waiting/queued แยก semantic tone ชัด และ selector เป็น manual tab/view state เท่านั้น ไม่เปลี่ยน workflow status.
- ขั้นที่เลือกอยู่บน work canvas จำกัดความกว้างใน workspace; blocker จำนวนสินค้า/ยอดขาด และ primary action เดียวจาก controller เดิมอยู่รวมกันใน first viewport. แบบและสเปกเป็น reference sidecar ของขั้นเมื่อมีข้อมูล และซ้อนใต้ action ก่อน `xl`.
- `GARMENT_PICK` render การ์ดเบิกจริงเพียงจุดเดียวในขั้นที่เลือก พร้อม **ต้องใช้ / เบิกสุทธิ / ยังขาด** และปุ่มเบิกหลัก; ห้ามสร้าง generic complete ซ้ำ. เสื้อ/วัตถุดิบและเส้นทางระดับทั้งใบอยู่ใน inspector เดียวแบบ drawer/bottom sheet; `?tab=inventory|history` ยังเปิด section เดิมและคืน focus ให้ trigger เมื่อปิด.
- ใช้ P1.0 Prompt/neutral + Anajak blue `#3973b2`, semantic tokens และ one-primary-action; mutation, permission, readiness/status/action policy และ `selectNowSteps` เดิมทั้งหมด. `/factory/station` ยังคง non-embedded linear presentation เดิม.

## Print runs

- DOM และ mobile order: **กำลังพิมพ์ → รอตัดแยก+ติดป้าย → คิวพิมพ์ → ประวัติ**.
- desktop/laptop เป็น first workspace สองฝั่ง 4:6 และขยาย 5:7; history อยู่นอก grid เต็มแถว.
- queue รักษาลำดับจาก service; thumbnail link เป็น sibling ของ row selection. Selection bar อยู่ก่อน long queue, sticky ใน overflow context ที่ถูก และมี forward keyboard path ไป action.
- Sidebar และ `ProductionModuleNav` เป็นเจ้าของลำดับชั้นนำทางของหน้านี้ จึงไม่มี breadcrumb ซ้ำเหนือชื่อหน้า.

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
| ใบผลิตแบบลงมือ | `PageShell`, `ProductionDetailScreen`, `ProductionNowCard`, `ProductionDesignCard`, `selectNowSteps`, controller/mutation เดิม |
| เบิกเสื้อ/วัตถุดิบ | `GarmentPickCard` primary task + `MaterialUsage embedded` + field/dialog primitives + mutations เดิม |
| รอบพิมพ์ 4 ชั้น | `splitPrintRunsByStage`, pure `PrintRunsPageView`, service order เดิม |
| สิทธิ์/read-only | `user.me`, `permAllows`, PageShell gates และ router permission เดิม |
| touch/a11y | control-size coarse-pointer token, semantic text token, labels/live state |

# Finish evidence and verdict

- Browser ใช้ข้อมูลจริงแบบ read-onlyบน cold dev origin; ไม่สร้าง demo transaction และไม่รัน `verify:printrun` บนฐานแชร์.
- `/production` และ `/production/[id]` มี populated records จริง; print-run ใช้ runtime empty state + non-DB SSR fixtures สำหรับ populated manager/read-only DOM contract.
- Browser final ของใบผลิตผ่าน 1440×900 + 1024×768 + 390×844 ทั้ง Light/Dark โดยไม่มี horizontal overflow; action บน mobile อยู่เหนือ bottom nav และ Station ยังคง linear/no-money.
- ใบผลิตผ่าน manual keyboard tabs, Back, legacy deep link, not-found, inspector/dialog Escape และ focus return โดยไม่กด mutation; unit 1064/1064, lint 0 error, `verify:ui` และ production buildผ่านครบ.
- Reviewer verdict: **SHIP WITH NITS** — พบ hydration mismatch เฉพาะ Codex in-app browser ที่ `AppShell` นอก diff; Chrome fresh tab สะอาด. canonical production UI พร้อมตรวจรับโดยไม่มี DB mutation หรือกฎธุรกิจใหม่ในก้อนนี้.
