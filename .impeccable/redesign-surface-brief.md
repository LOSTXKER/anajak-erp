# Scope and mode

- Surface: authenticated `/redesign` prototype only; desktop command center plus mobile priority queue.
- Mode: Operate.
- Audience: owner/manager first, while preserving role-aware navigation and safe views for the five-person team.
- Job: know within seconds what needs intervention, understand where live orders are in the end-to-end factory flow, and open the real record that resolves it.
- Primary action: open the next actionable risk or create a real order when permission allows.

# Content and constraints

- Real sources only: `analytics.dashboard`, `analytics.ownerPulse`, `user.me`, shared navigation registry, `buildDashboardAttentionItems` and canonical routes.
- No new schema, dependency, config, business logic, mutations or fake metrics.
- Money and navigation remain permission-gated and fail closed.
- Public, print, auth, factory and canonical dashboard surfaces stay untouched.
- Future website/POD intake appears only as an order source in the same lifecycle; this prototype adds no POD capability or UI claim.

# Chosen direction

- World: Swiss industrial production manual + matte factory work order, expressed with Anajak cobalt `#3973b2`, off-white workspace, white sheets, fine blueprint rules and ink-dark text.
- Approved/delegated comp: `.impeccable/mocks/flow-matrix.png`.
- Memorable moment: hovering/focusing one live order clarifies its entire lifecycle rail while the adjacent exception docket identifies what must move next.
- Honest risk: a literal matrix becomes dense and engineering-like; mobile therefore becomes a priority queue and stage summary rather than a shrunken desktop grid.

# Implementation inventory

| Comp commitment | Implementation medium |
|---|---|
| Unified cobalt operations bar, global search, primary action, notifications and user | Semantic HTML + existing Lucide icons + shared command palette/user primitives |
| Quiet grouped navigation with permission-aware routes | Semantic nav from `navigation.ts`; CSS scoped to prototype |
| Continuous lifecycle matrix with linked stage nodes | Semantic table/list + authored CSS/SVG-like rules; real recent orders and real status mapping |
| Exception docket with direct resolution paths | Semantic ordered list from `ownerPulse` view model; existing real hrefs |
| Workload balance band | Semantic seven-stage meter from real `ordersByStatus` counts (รับงาน, อาร์ตเวิร์ก, พร้อมผลิต, ผลิต, QC/แพ็ค, จัดส่ง, ปิดงาน); CSS bars, no canvas |
| Thai workhorse typography | Existing Prompt font; restrained type scale, tabular numbers only for data |
| Mobile composition | Priority queue, stage strip and recent-order cards; bottom navigation, no horizontal desktop table |
| Image-native assets | None; all visual language is precise UI geometry and must remain responsive code |

# Component grammar

- Corners: 8px controls/items, 12px sheets; no pill navigation except compact status/filter controls.
- Lines: 1px cool blueprint dividers, 2px only for active lifecycle progress, 4px never used as decorative card edge.
- Elevation: near-flat white sheets with a soft downward shadow; no halo.
- Type ramp: 12px metadata, 14px body/controls, 18px section, 24–28px page heading; weight and spacing establish hierarchy.
- Motion: one row-focus clarification using color and line opacity; disabled under reduced motion.
