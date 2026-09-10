# PROGRESS — สถานะสด
> เขียนทับทุกครั้ง ไม่สะสม log (log อยู่ git history) · hook โหลดไฟล์นี้ทุก session · สมองของ Nami อ่านส่วนหัวไฟล์นี้เป็นความคืบหน้าของ project
อัปเดตล่าสุด: 2026-09-11
## ทำถึงไหน
- หน้าลอง `/proto` ทั้งหมดถูกลบ 09-11 (เบสสั่ง · ของเดิม `git show 42c408a:src/app/proto/`) → A17 ปุ่มลงมือใบผลิตพักไว้ · ใบผลิตจริงยังเป็น flow A16
- A16 ตรวจ+แก้ flow ผลิตครบวงจร เสร็จบน branch `codex/production-flow-audit-20260910` (แตกจาก main 9e8a9cd) · ยังไม่ merge/deploy · V2 ยังปิด · ฐานทดลองรีเซ็ตกลับจุดเริ่มแล้ว
- จัดไฟล์ตามมาตรฐาน new-repo (docs/ กลั่นเข้าไฟล์มาตรฐาน · เหลือ docs/ 2 ไฟล์ที่โค้ดอ้าง) + ลบหน้าลอง → เข้า branch codex แล้ว 09-11
## ค้าง / ติดอะไร
- ยังไม่ลองบน Production แบบ login จริง (ตรวจแค่ฐานทดลอง) · ยอดร่างยังไม่มีเทสต์ Back/Forward
## NEXT (ทำต่อทันที)
1. เบสไล่ลอง demo 12 เส้นทาง `/production/demo-production-form-<key>` แล้วลองกับบทบาทพนักงาน
2. review/merge branch codex เข้า main แล้วตรวจ CI/deploy แยกจากผล local
