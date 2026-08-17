# Scope and operating mode

- Surface family: canonical authenticated factory operations across `/production*`, `/outsource`, `/factory/station` and `/factory`.
- Mode: Operate.
- Primary devices: supervisor desktop at `1440×900` and factory touch display at `1024×768`; `390px` remains a complete no-overflow regression guard.
- Audience: supervisors/owners triage at `/production`, factory staff act at `/factory/station`, and the whole floor reads `/factory` on a TV.
- Product question by surface: **what needs attention → what must happen now → where is the factory blocked**.

# As-built route topology

| Route | Shell | UI contract | Real data / authority |
|---|---|---|---|
| `/production` | dashboard `AppShell` | Exception-first worklist, exactly one order per row; filters/count/search/sort share one source | `production.kanban`, `user.me`; read/triage only, then drill to a real destination |
| `/production/[id]` | dashboard `AppShell` | Focused job traveler: persistent context plus `ทำงาน / เบิกของ / ขั้นตอนทั้งหมด` content tabs; no breadcrumb or module navigation | `production.getById`; existing production mutations and guards only |
| `/production/print-runs` | dashboard `AppShell` | **printing → cut/label → queue → 7-day history** | `printRun.queue/list`; `manage_production` gates controls |
| `/production/films` | dashboard `AppShell` | Compact film inventory: artwork/customer, source, quantity and consume action | `filmStock.list`; consume remains server-guarded |
| `/outsource` | dashboard `AppShell` | Send/receive/**vendor receiving inspection**/history; inspection completes before order-level final QC | Existing outsource and goods-receipt queries/mutations; no new lifecycle |
| `/factory/station` | full-screen Dark, no ERP sidebar/top bar | Select one of five stations, then **active → ready → compact scan** | Station-scoped actions when authorized; otherwise read-only |
| `/factory` | full-screen Dark TV | Read-only five-stage pulse in one viewport, plus exception rail and ready output | `factory.board`; no control or mutation path |

- `ProductionModuleNav` is the single local navigation on the four supervisor workspaces inside `AppShell`: **คิวผลิต / รอบพิมพ์ DTF / คลังฟิล์ม / งานร้านนอก**, followed by entry links to **โหมดสถานี / จอโรงงาน**. It does not create another sidebar and does not render on `/production/[id]`.
- `/production` stores `view`, `q` and `sort` in the URL. Worklist links resolve to the actual production record, production/QC order tab, delivery tab or create-production dialog according to current state and permission.
- `/production/[id]` keeps one back-to-queue path, compact context and summary above three intent tabs. `ทำงาน` is the default and keeps actionable work, blockers and artwork/quantity together; `เบิกของ` owns garment/material support; `ขั้นตอนทั้งหมด` is historical/read-only. Tab state is URL-backed, lazy on first visit and then kept mounted. These are content tabs, not module navigation. Station stays linear, station-scoped and does not mount the tablist or `MaterialUsage`.
- Print-run DOM order follows the floor workflow. Desktop uses a two-column workspace; narrower layouts stack in the same operational order.
- Film stock remains an inventory list, not a dashboard. Outsource UI calls legacy `QC_*` data states “ตรวจรับ” so staff do not confuse vendor receiving inspection with final QC.

# Station and lifecycle contract

| Station | Scope |
|---|---|
| `prep` — เตรียมเสื้อ | `GARMENT_PICK` and `GARMENT_RECEIVE` |
| `dtf-print` — พิมพ์ DTF | DTF queue, printing, cut separation and labels |
| `heat-press` — รีดร้อน | `HEAT_PRESS` only after the readiness gate |
| `qc` — ตรวจคุณภาพ | Order-level good/defect count after production completes |
| `final-pack` — แพ็คสุดท้าย | Delivery evidence and final quantity closure |

- Station selection appears once and persists in `?station=`. The selected work center shows active work first, ready work second, and scan/search last; `dtf-print` substitutes the print-run workspace for the generic queue.
- Scan accepts an exact order number or supported ERP-origin QR and opens context only. It never claims, starts, completes, packs or changes status. Multiple production records require explicit selection.
- Station queues contain only actionable active/ready work for the selected station, sorted by due date and priority. Gate-blocked work stays out of the actionable queue.
- The canonical flow is **production → QC → final pack → ready**. Vendor receiving inspection is upstream of final QC. `PACKAGING` is legacy recovery data only and must route back through QC.
- `/factory` presents five distinct stages in order: **เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็กสุดท้าย**. QC and final pack never collapse into one stage.
- Due ordering, readiness, quantities, `evaluateHeatPressGate`, locks, idempotency and status transitions remain server truth.

# Permissions, cache, errors and no-money boundary

- Permission UI fails closed and mirrors server authority. Missing `manage_production` makes Station/print-run/film controls read-only; `supervise_operations` expands assignee visibility, while vendor inspection decisions require both `manage_production` + `supervise_operations`.
- Final-pack delivery creation requires `manage_production` + `manage_delivery`; marking ready additionally requires `update_order_status_production`. Server guards remain authoritative for every mutation.
- Live queue surfaces poll every 30 seconds as configured and refetch on focus/reconnect. Initial loading, initial error+retry, empty, blocked and read-only are distinct. A background failure preserves cached work and adds a stale warning.
- Factory TV warns after two minutes without a successful refresh while retaining the last snapshot.
- Worklist, print runs, film stock and outsource do not add order prices, totals or vendor charges. ERP job traveler may expose material cost only through the existing `see_finance` gate.
- Station and TV payloads exclude all money at the server response boundary, including for OWNER. Station never mounts `MaterialUsage`; final packing omits shipping cost from the client payload.

# Interaction and accessibility grammar

- Coarse-pointer controls and fields are at least `44×44px`; fine-pointer desktop may retain 36px density. No primary composition creates page-level horizontal overflow.
- Pending controls keep an explicit “กำลัง…” label and `aria-busy`. Inputs/dialogs retain programmatic labels, validation relationships, keyboard focus and reduced-motion behavior.
- Action availability never relies on hover. Scan, read-only, blocked, cached-stale and mutation-error feedback appear at the decision point.

# Non-goals

- No second shell, lifecycle, status transition, readiness calculation or queue engine.
- No mutation from Factory TV or scan resolution.
- No monetary payload or presentation in Station/TV.
- No mock/example route or fake factory metric in canonical operations.
