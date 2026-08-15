# Scope and operating mode

- Surface family: canonical authenticated factory operations across `/production`, `/factory/station` and `/factory`.
- Mode: Operate.
- Audience: supervisors/owners at `/production`, factory staff at `/factory/station`, and the whole floor viewing `/factory` on a TV.
- Job: move real work through the current station without losing order context, while giving supervisors and the team one consistent view of progress.
- Primary action: choose a station and act on the next eligible queue item; scan is a context shortcut, never an action.

# Surface topology and authority

| Route | Shell | Interaction authority | Real data |
|---|---|---|---|
| `/production` | shared dashboard `AppShell` | Supervisor board, drill-through and entry to Station Mode | `production.kanban`, `user.me`; detail/print routes reuse `production.getById`, `printRun.queue/list` |
| `/factory/station` | full-screen Dark, no ERP sidebar/top bar | Station-scoped actions when authorized; otherwise read-only | `factory.stationQueue`, `factory.resolveStationScan`, `factory.stationContext`, production/print/QC/packing endpoints, `user.me` |
| `/factory` | full-screen Dark TV | Read-only only; no action controls or mutation path | `factory.board` |

- The three surfaces are different presentations of the same server-owned lifecycle, permissions and records; none may introduce a second production controller.
- All `/factory*` routes require a session and all reads use protected procedures.

# Station map and lifecycle

| Station | Scope |
|---|---|
| `prep` — เตรียมเสื้อ | `GARMENT_PICK` and `GARMENT_RECEIVE` |
| `dtf-print` — พิมพ์ DTF | DTF print queue and print runs |
| `heat-press` — รีดร้อน | `HEAT_PRESS` after the readiness gate |
| `qc` — ตรวจคุณภาพ | Order-level quality check after production completes |
| `final-pack` — แพ็คสุดท้าย | Delivery evidence and final quantity closure |

- The canonical post-production flow is **production → QC → final pack → ready**.
- `PACKAGING` exists only for legacy recovery: do not create a new `ProductionStep`; route recoverable legacy work back to QC.
- Readiness, due ordering, quantities, `evaluateHeatPressGate` and status transitions remain server truth.

# Scan and queue contract

- Scan accepts an exact order number or an ERP-origin QR, resolves the order and opens context only. It must never claim, start, complete, pack or change status.
- Reject unsupported external QR origins. When an order has multiple production records, require explicit selection instead of guessing.
- Station queues contain only active/ready work for the chosen station, sorted by due date then priority. Gate-blocked work does not enter the actionable queue.
- Live queries poll every 30 seconds and refetch on focus/reconnect. Initial loading, initial error+retry and true empty states are distinct from background stale/error; background failure retains cached work.
- The TV warns when refresh has been stale for more than two minutes while preserving its last successful snapshot.

# Permissions and no-money boundary

- Permission checks are station-scoped and fail closed in both UI and server. Missing `manage_production` makes Station Mode read-only.
- Production/QC/DTF actions require `manage_production`; delivery creation in final pack requires `manage_production` + `manage_delivery`; marking ready also requires `update_order_status_production`.
- `supervise_operations` may see work across assignees. Without it, queue visibility is limited to the current user and unassigned work.
- Station and TV response shapes exclude monetary fields at the server select/response boundary. They do not transport or render prices, costs, totals, payments or shipping cost, including for OWNER.
- Station detail does not mount cost-bearing `MaterialUsage`; final packing hides and omits shipping cost rather than relying on visual masking.

# State and component grammar

- `/production` keeps the shared responsive dashboard grammar. Factory surfaces use the dedicated full-screen Dark shell and do not inherit dashboard chrome.
- Touch controls are at least 44px on mobile/coarse pointers; pending actions retain an explicit “กำลัง…” label and `aria-busy`; 320px layouts must not create page-level horizontal overflow.
- Read-only, loading, error, empty, blocked and stale are explicit states. A background refresh error must not erase usable cached context.
- Mutation controls appear only when the same action is allowed by the server permission contract; no UI-only shortcut may widen authority.

# Non-goals

- No alternate command center, alternate shell, fake metrics or sample factory data.
- No mutation from TV or from scan resolution.
- No money in Station/TV payloads or presentation.
- No second lifecycle, status transition, readiness calculation or queue engine in the frontend.
