---
target: หน้า /orders มีอะไรควรปรับ
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-08-23T09-34-22Z
slug: src-app-dashboard-orders-page-tsx
---
Method: dual-agent (A: `/root/orders_design_review` · B: `/root/orders_technical_review`)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | loading/error/retry ดี แต่ข้อมูลสำคัญไม่เท่ากันข้ามจอ |
| 2 | Match System / Real World | 3 | flow งานจริงดี แต่สถานะสองบรรทัดไม่บอก customer/internal |
| 3 | User Control and Freedom | 4 | filter/search อยู่ใน URL และ Back รักษาผลค้น |
| 4 | Consistency and Standards | 2 | desktop/mobile แสดงชื่องาน เงิน และ urgency ไม่เหมือนกัน |
| 5 | Error Prevention | 3 | CSV ไม่บอกว่าส่งออกเพียงหน้าปัจจุบัน |
| 6 | Recognition Rather Than Recall | 2 | desktop ซ่อนชื่องานและ rail มี 14 สถานะพร้อมกัน |
| 7 | Flexibility and Efficiency | 3 | search/filter/sort ดี แต่ table เลื่อนแนวนอนที่ 1280px |
| 8 | Aesthetic and Minimalist Design | 3 | visual สงบ แต่ status rail เด่นกว่ารายการ |
| 9 | Error Recovery | 3 | มี retry และ empty-state ล้างตัวกรองได้ |
| 10 | Help and Documentation | 2 | ไม่มี contextual help แต่ flow หลักยังเข้าใจได้ |
| **Total** | | **28/40** | **Good** |

## Design Specificity Verdict

หน้า Orders มีความเป็น Anajak ERP ชัดจาก flow รับงานไปจนปิดงาน, deadline, payment และสถานะภายใน ไม่ใช่ generic admin. จุดอ่อนหลักอยู่ที่ information hierarchy และ contract ข้าม viewport ไม่ใช่สีหรือ card geometry.

Deterministic detector คืน `[]` เพราะ target route เป็น wrapper สองบรรทัดและไม่ traverse `components/orders/orders-page.tsx`; จึงไม่ถือเป็น clean bill of health. ไม่มี overlay เพราะไม่มี finding ที่น่าเชื่อถือจาก scan นี้.

## Overall Impression

ฐานแข็งแรงและใช้งานได้จริง แต่ desktop ตัดข้อมูลจำแนกงานออก ขณะที่ mobile ใช้พื้นที่ต่อรายการมากเกินไป. โอกาสใหญ่ที่สุดคือทำให้ registry scan-first เหมือนกันทุก viewport.

## What's Working

- ค้นหา `แพรว` เปิด `ORD-2608-0015` แล้ว Back ยังรักษา query และผลลัพธ์.
- mobile ไม่มี document overflow ถึง 320px และ control หลักไม่น้อยกว่า 44px.
- Light/Dark, focus ring, row hover, empty/error/loading semantics และ console อยู่ในสภาพดี.

## Priority Issues

### [P1] Desktop แยกงานของลูกค้าซ้ำไม่ได้

หัวคอลัมน์เขียน `ลูกค้า / งาน` แต่แสดงเฉพาะชื่อลูกค้า; ลูกค้าซ้ำหลายออเดอร์จึงต้องจำเลข ORD หรือเปิดทีละใบ. เพิ่มชื่องานบรรทัดรองแบบ truncate และแยก chat เป็น action รอง. Suggested command: `/impeccable layout`.

### [P1] Mobile เห็นรายการจริงช้าเกินไป

การ์ดแรกเริ่มราว y=508px และแต่ละใบสูง 231-247px จึงเห็นประมาณหนึ่งงานต่อ viewport. ลดเป็น operational card 2-3 ชั้น: identity/status, due/countdown, amount/payment; ตัด metadata รอง. Suggested command: `/impeccable adapt`.

### [P2] Deadline ซ้ำสองคอลัมน์ทำให้ table กว้าง

ที่ 1280px table กว้างกว่าพื้นที่ 63px; `เหลือเวลา` กับ `กำหนดส่ง` ซ้ำความหมาย. รวมเป็นคอลัมน์เดียว แสดงวันที่และ countdown สองบรรทัดพร้อม sort เดียว. Suggested command: `/impeccable distill`.

### [P2] Status rail ใหญ่เกินหน้าที่

14 ตัวเลือกพร้อมกันรวม zero-count states ทำให้ rail เด่นกว่ารายการ. คง 3-5 สถานะที่มีงานหรือควรจัดการ ที่เหลืออยู่ใน `ทุกสถานะ`. Suggested command: `/impeccable distill`.

### [P2] Desktop/mobile data contract ไม่ตรงกัน

mobile ตัดทศนิยมเงิน ไม่มี label `ยอดรวม` และไม่แสดง relative urgency แบบ desktop. ใช้ formatter เดียวกัน เพิ่ม label และแสดง countdown เป็นข้อมูลหลัก. Suggested command: `/impeccable polish`.

## Persona Red Flags

- **Alex (Power User):** ต้องจำเลข ORD เมื่อชื่อลูกค้าซ้ำ, table เลื่อนแนวนอน และไม่มี bulk action.
- **Sam (Accessibility):** โครงสร้างและ focus ดี แต่ยอดเงิน mobile ไม่มี label และสถานะสองบรรทัดไม่บอกความสัมพันธ์.
- **หัวหน้าทีมโรงงาน:** pipeline ช่วยเห็นภาพรวม แต่เทียบงานลูกค้าซ้ำยากและ mobile ต้อง scroll มากก่อนเห็นงานถัดไป.

## Minor Observations

- `ส่งออก CSV` ส่งเฉพาะรายการหน้าปัจจุบันแต่ label ชวนเข้าใจว่าเป็นผลลัพธ์ทั้งหมด.
- สถานะสองบรรทัดควรบอก `ภายใน:` เฉพาะเมื่อจำเป็น.
- คอลัมน์ที่ปรากฏ/หายตามข้อมูลหน้าอาจทำให้ตำแหน่งข้อมูลไม่นิ่งระหว่าง paginate.

## Questions to Consider

- Registry นี้ควรให้คนตอบคำถามแรกว่า “งานไหนต้องทำต่อ” หรือ “ออเดอร์นี้คือของใคร”?
- Status rail ต้องโชว์ทุกสถานะตลอดเวลา หรือควรโชว์เฉพาะงานที่มีอยู่และข้อยกเว้น?
- Mobile ต้องรักษาข้อมูลครบเท่า desktop หรือควรเป็น scan-first view ที่เปิดรายละเอียดเมื่อแตะ?
