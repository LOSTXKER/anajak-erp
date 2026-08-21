# Station Mode — low-tech operator exploration

วันที่: 2026-08-21

mockup ชุดนี้ใช้เลือก information hierarchy ของ Station Mode ก่อนแก้ application source จริง โดยยึด design plan ที่ผ่าน critic ใน BestOS:

`records/projects/anajak-erp/design-station-lowtech-2026-08-21.md`

## Directions

- `a-one-task-kiosk.html` — งานเดียวเต็มจอ อ่านน้อยและ action ใหญ่
- `b-picture-work-sheet.html` — ใช้ภาพตำแหน่ง/สเปกเป็นแกน แต่ไม่สร้าง progress/checklist ที่ไม่มี server truth

ทั้งสองทิศใช้ข้อมูล fixture เดียวกันและต้องคง business truth เดิม: no money, scan does not mutate, ownership-safe, multi-lane, DTF batch, no auto-claim และ same-order handoff ที่ผู้ใช้กดยืนยันเอง

## Prototype states

เปิดด้วย query `?state=`:

- `ready` — Heat Press พร้อมเริ่ม (default)
- `blocked` — Stock shortage ที่ report แล้ว
- `handoff` — Heat Press เสร็จและไป QC ต่อ
- `qc` — ทางเลือก “ทั้งหมดดี / พบของเสีย”
- `dtf` — PRINTING + PRINTED รอตัด + incoming handoff พร้อมกัน
- `multilane` — ออเดอร์เดียวหลาย lane + assigned-other
- `stale` — cached data; state-changing actions disabled
- `unknown` — request outcome ยังไม่ทราบ; ห้ามทำซ้ำ

interaction ใน HTML เป็น prototype เท่านั้น ไม่เรียก API และไม่เขียนฐานข้อมูล

## Review viewports

- touch station: 1024×768
- mobile regression: 390×844

ก่อนนำทิศที่เลือกไป implement ต้องทดสอบกับพนักงานจริงบนอุปกรณ์จริง และแก้ QC good/defect invariant ด้วย client/server regression test แยกจากงาน visual
