# Production Control + Station Execution mockups

Standalone HTML สำหรับเลือกทิศ UX2.16 ก่อนแตะ production code

## Shared scenario

- `ORD-2606-0021`
- Anajak Oversize CVC · FREE · ดำ
- ต้องใช้ 1 · เบิกสุทธิ 0 · ยังขาด 1
- DTF เสร็จ 1/1 · รีดร้อนรอเสื้อ
- ERP แสดงเฉพาะ control/exception action
- Station เตรียมเสื้อเป็นเจ้าของ routine action “เบิกเสื้อ 1 ตัว” และ “แจ้งปัญหา”
- ข้อมูลที่ระบบยังไม่มี เช่น due, owner, severity, age, actor/time ติดป้าย “ข้อมูลที่ต้องเพิ่ม” หรือไม่แสดง

## Directions

| Direction | ERP | Station | เหมาะกับ |
|---|---|---|---|
| A — Exception Control Record (แนะนำ) | attention + operation ledger + readiness/audit | current job focus + compact queue | สมดุลที่สุดและ role ชัด |
| B — Split Control Desk | worklist ค้างซ้าย + selected record ขวา | queue/current split | ไล่หลายงานเร็วบนจอกว้าง |
| C — Route Dossier | multi-lane route + evidence | operation traveler + next handoff | งานหลายเส้นทางและ rework |

ไฟล์ HTML และ PNG อยู่ในโฟลเดอร์นี้และ `renders/` ตามชื่อ direction

## Verification

- render ERP ที่ 1440×900 และ Station ที่ 1024×768
- target ทั้ง 6 หน้าไม่มี horizontal overflow หรือ console error
- Station buttons ที่มองเห็นมีความสูงอย่างน้อย 44px
- HTML ไม่มี network dependency และ mockup ไม่ส่ง mutation

