---
target: Production Control worklist /production
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-08-23T13-09-31Z
slug: ponents-production-production-control-worklist-tsx
---
# Production Control Worklist Critique

Method: dual-agent (A: production_design_assessment · B: production_detector_assessment)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | active filter, counts, progress and deadline are clear |
| 2 | Match system / real world | 3/4 | factory language is strong, but attention mixes different work owners |
| 3 | User control and freedom | 3/4 | URL/Back preserve filter, but Back loses row focus |
| 4 | Consistency and standards | 3/4 | responsive table/cards are consistent; navigation and lens axes overlap |
| 5 | Error prevention | 3/4 | worklist is read-only and routes actions to the right context |
| 6 | Recognition rather than recall | 3/4 | key facts are visible, but reason/owner still require opening detail |
| 7 | Flexibility and efficiency | 3/4 | search, lens, URL and sort are efficient, but two sort systems compete |
| 8 | Aesthetic and minimalist design | 2/4 | clean but control layers repeat before the work list |
| 9 | Error recovery | 3/4 | retry, stale-data and empty states give recovery |
| 10 | Help and documentation | 2/4 | attention's cross-stage meaning is not self-evident |
| **Total** |  | **28/40** | **Good — strong foundation, triage hierarchy needs work** |

## Design Specificity Verdict

The data model feels authored for Anajak: mockup, station, step progress, garment quantity, due date and direct routes to the real work context. The visual composition is still category-interchangeable: summary cards, underline lenses, search/sort and bordered table could belong to any admin SaaS. The biggest opportunity is not decoration; it is turning the list into a supervisor dispatch desk that says who must do what next.

The deterministic detector returned `[]` with zero findings. Browser evidence found no desktop/mobile horizontal overflow, no control overlap and no console warning/error. Desktop fine-pointer controls at 36–40px match the established density; mobile controls were all at least 44px. Live visual overlays were not produced because browser evaluation was read-only, so no reliable user-visible overlay exists.

## Overall Impression

The page is trustworthy and operationally dense without becoming cluttered. Its weakness is duplicated triage: three summary metrics, five lenses, search, preset sort and column sort all appear before or around the same work list. The user can see risk, but still has to open records to understand action ownership.

## What's Working

- One order per row prevents duplicate counting while preserving multi-station context.
- Deadline, quantity and step progress are easy to scan; selecting `ต้องจัดการ` updates URL, pressed state and results correctly.
- Desktop table and mobile cards are genuinely responsive: no overflow, 44px mobile targets and 39px clearance above bottom navigation.

## Priority Issues

### [P1] Attention reports urgency, not ownership

`ต้องจัดการ 5` includes both a stock-blocked 0% job and 100% ready-to-ship jobs that are overdue. A supervisor sees red but not who should act. Add a primary `เหตุที่ต้องจัดการ` and `เจ้าของขั้นถัดไป` line; separate production blockers from delivery lateness in ordering or labeling.

Suggested command: `/impeccable clarify`

### [P1] The first viewport spends too much on controls before work

On 390×844 the first job begins around y=617 after module navigation, three summaries and five lenses. Keep urgent context, but compress static metrics into one line and make the exception queue the first operational surface.

Suggested command: `/impeccable adapt`

### [P2] One lens row mixes exception and stage dimensions

`ทั้งหมด / ต้องจัดการ / กำลังผลิต / รอ QC / แพ็ก` presents cross-stage exception and stage partitions as peers. Separate exception inbox from stage navigation or label the two axes explicitly.

Suggested command: `/impeccable shape`

### [P2] Navigation is duplicated

Sidebar already exposes production and Station, while the module nav repeats six destinations and adds more dividers. Keep one four-item production module axis; move Station/Factory into a single workspace switcher or secondary menu.

Suggested command: `/impeccable distill`

### [P2] Desktop has two sort systems

The preset select offers ten options while four table columns are sortable. Keep column sort plus only genuinely cross-column presets on desktop; keep the combined select on mobile where table headers do not exist.

Suggested command: `/impeccable distill`

## Persona Red Flags

- Power user: URL state is fast, but preset and column sort compete; Back restores the filter but loses focus to `body`.
- Keyboard/screen-reader user: semantics are strong, but the clickable desktop row is not focusable as a whole and mobile card names are very long.
- Mobile supervisor: all targets pass, but the job list appears too low for quick interruption-driven checks.

## Minor Observations

- The three read-only summary cells look like clickable cards; reduce their card affordance if they remain static.
- `เลยกำหนด` can repeat as urgency and due-date state in the same record.
- Repeated empty mockup placeholders become visual noise across several adjacent rows.
- `1/5 ช่วง` is precise but a first-timer may not know whether it means production steps or milestones.

## Questions to Consider

- Should `ต้องจัดการ` become the default supervisor inbox, or remain one optional filter?
- Should 100% ready-to-ship but overdue jobs stay in Production Control, or move to a delivery exception queue?
- If detail already knows blocker and responsible role, why not promote both into the list?
