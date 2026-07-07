# Audit — หน้าเปิดงานใหม่ (`/orders/new`)

> วันที่ audit: 2026-07-07 · จากโค้ดจริง (อ้างไฟล์:บรรทัด) · สถานะ: **วางแผนเท่านั้น ยังไม่แตะโค้ด**
> หมายเหตุสำคัญ: โจทย์บอก "page ~875 บรรทัด" แต่ของจริงคือ **680 บรรทัด** — หน้านี้เพิ่งถูกรื้อโครงไปแล้วรอบหนึ่ง (2026-06-12 เบสเคาะ: แตก component + ลำดับ 1-2-3 + sticky bar — comment หัวไฟล์ `page.tsx:3-8`) ดังนั้นงานรอบนี้ = **เก็บงานต่อยอด ไม่ใช่รื้อใหม่**

## ไฟล์ที่เกี่ยว

| ไฟล์ | บรรทัด | หน้าที่ |
|---|---|---|
| `src/app/(dashboard)/orders/new/page.tsx` | 680 | โครงหน้า + state + validate + submit |
| `src/components/orders/new/order-item-card.tsx` | 507 | การ์ดรายการ (ลาย/สินค้า/ส่วนเสริม/หมายเหตุ) |
| `src/components/orders/new/product-table-row.tsx` | 269 | แถวสินค้า 8 คอลัมน์ |
| `src/components/orders/new/print-table-row.tsx` | 176 | แถวลาย (หลัก 4 ช่อง + toggle "ตำแหน่ง/ขนาด") |
| `src/components/orders/new/size-matrix.tsx` + `src/lib/size-matrix.ts` | 106+34 | ตารางหลายไซส์ |
| `src/components/orders/new/order-detail-fields.tsx` | 129 | ช่องข้อมูลงาน (section 1) |
| `src/components/orders/new/order-customer-section.tsx` | 117 | เลือกลูกค้า + ป้ายบริบท (เครดิต/ฟิล์มค้าง/คลังลาย) |
| `src/components/orders/new/order-price-summary.tsx` | 291 | สรุปราคา + margin estimate (role การเงิน) |
| `src/components/orders/new/order-fee-section.tsx` | 136 | ค่าใช้จ่ายเพิ่มเติม |
| `src/components/orders/new/order-shipping-section.tsx` | 122 | ที่อยู่จัดส่ง (toggle) |
| `src/components/orders/new/order-attachments-section.tsx` | 153 | รูปอ้างอิงจากแชท (CollapsibleSection) |
| `src/hooks/use-order-items-form.ts` | 283 | state รายการ + draft localStorage |
| `src/types/order-form.ts` | 315 | types + validate ฝั่งฟอร์ม |
| `src/server/routers/order.ts:550-593` | — | zod schema `order.create` (ความจริงว่าอะไรบังคับ) |

**ทางเข้า:** ปุ่ม topbar (`layout/topbar.tsx:111,117`) · command palette (`command-palette.tsx:69`) · หน้า /orders (`orders/page.tsx:256,501`)
**เปิดจากใบเสนอ:** ❌ ไม่ผ่านหน้านี้ — ใบเสนอ→ออเดอร์ใช้ `quotation.convertToOrder` (server mutation จากหน้า `quotations/[id]/page.tsx:95,237`) สร้างออเดอร์ทั้งใบฝั่ง server เลย ไม่มี prefill เข้า /orders/new · ดังนั้น audit นี้โฟกัสเส้นเปิดตรงเส้นเดียว

---

## ① นับ field — อันไหนบังคับจริง

### บังคับจริง (จาก server `order.ts:550-593`)
- **`customerId` ช่องเดียว** (`order.ts:556` — z.string() ไม่ optional) → เปิดเป็น INQUIRY ได้เลย (`order.ts:681-685`: ไม่มีรายการ = INQUIRY)
- ชื่องานว่างได้ — server ตั้งให้ (`order.ts:656-677`)

### บังคับ "ต่อเมื่อใส่รายการ" (โหมดคิดเงิน — `itemHasContent` เป็นสวิตช์ `page.tsx:167`)
- ต่อสินค้า (`order-form.ts:294-309` + zod `order.ts:97-120`): คำอธิบาย · ราคา >0 (ยกเว้น CUSTOMER_PROVIDED) · ไซส์ ≥1 + จำนวน ≥1 ต่อไซส์ · แหล่งที่มา (itemSource)
- ต่อลาย (`order.ts:73-85`): position/printType มี default อยู่แล้ว · unitPrice ≥0 — **ไม่มีอะไรต้องกรอกเพิ่มจริง**
- ต่อ fee (`order.ts:130-136`): feeType + name + amount

### กรอกทีหลังได้ทั้งหมด (optional/มี default)
channel (default LINE) · title · deadline · description · notes · priority (default NORMAL + auto จาก deadline) · paymentTerms · poNumber · taxRate (default 7) · discount · platformFee · externalOrderId · shipping ทั้ง 7 ช่อง · referenceImages · addons · packagingOptionId · สเปคตัดเย็บ (fabric/pattern/collar/sleeve/fit ~9 ช่องใน `custom-made-detail.tsx`) · สภาพเสื้อลูกค้า

### จำนวนช่องที่ "มองเห็นพร้อมกัน" ตอนเปิดหน้าครั้งแรก (ยังไม่กรอกอะไร)
Section 1: ~8 control (ลูกค้า, รายละเอียดจากแชท, ชื่องาน, กำหนดส่ง, chip ช่องทาง 7 ตัว, ความเร่งด่วน, หมายเหตุภายใน)
Section 2: ~10 control (คำอธิบายงาน, การ์ดเลือกชนิดสินค้า 3 ใบ, CTA ลาย, CTA ส่วนเสริม, หมายเหตุรายการ, CTA ค่าใช้จ่าย, ภาษี%, เงื่อนไขชำระ, ส่วนลด, สรุปราคา)
รวม **~18-20 control บนจอเดียว** ทั้งที่บังคับจริงมีช่องเดียว — นี่คือแก่นของ "ดูรก"

---

## ② ลำดับการกรอกจริง vs ผังหน้า

ลำดับจริงของแอดมินตอนถือแชท (จาก intent ที่โค้ดเองประกาศ `page.tsx:4` "เปิดงานได้ในไม่กี่วินาทีระหว่างถือแชท" + `order-detail-fields.tsx:10` "รายละเอียดจากแชทขึ้นก่อน — จุด capture หลัก"):

```
เลือกลูกค้า → จดรายละเอียดจากแชท → เซฟรูปที่ลูกค้าส่งมา → (ถ้าตีราคาได้เลย) รายการ+ไซส์+ลาย → ราคา/ส่วนลด → กำหนดส่ง → จัดส่ง
```

ผังหน้าปัจจุบัน: 1 ลูกค้า&งาน → 2 รายการ&ราคา → 3 รูปอ้างอิง → จัดส่ง

**จุดไม่ตรง 2 จุด:**
1. **รูปจากแชทอยู่ท้ายสุด (section 3, พับอยู่)** — `page.tsx:594-603` + `order-attachments-section.tsx:76` (`defaultOpen={images.length > 0}` = เริ่มต้นพับ) ทั้งที่เป็นของที่แอดมิน capture ตั้งแต่นาทีแรกพร้อมข้อความแชท · ต้องเลื่อนผ่านตารางราคาทั้งก้อนไปหา
2. **กำหนดส่งอยู่บนสุด (section 1)** — `order-detail-fields.tsx:74-79` ทั้งที่ตอนแชทมักยังไม่รู้ deadline (รู้ตอนเคาะราคา) — อันนี้เบา ยอมรับได้เพราะอยู่แถวเดียวกับชื่องาน

---

## ③ จุดรก — เรียงตาม impact

### สูง
1. **โซนราคาโชว์เต็มทั้งที่ยังไม่มีรายการ** — `page.tsx:528-589`: OrderFeeSection + ภาษี% + เงื่อนไขชำระ + OrderPriceSummary (รวมช่องส่วนลด/สรุป ฿0.00 ทุกแถว) กางตลอดแม้ฟอร์มว่าง · เส้นทางหลัก "เปิดเบาเป็นใบสอบถาม" ไม่ต้องใช้สักช่อง · หนักกว่านั้น: มันเป็นกับดักจริงจนต้องมี validation ดักไว้เอง (`page.tsx:272-283` — "มีค่าใช้จ่าย/หมายเหตุที่กรอกไว้ แต่ยังไม่มีรายการสินค้า" = โค้ดยอมรับเองว่าผัง invite ให้กรอกผิดที่)
2. **ตารางสินค้า 8 คอลัมน์ fixed-width** — `order-item-card.tsx:285-295` (colgroup รวม ~548px + คอลัมน์สินค้า) · จอมือถือต้อง scroll แนวนอนใน form ขัด DESIGN.md Mobile ข้อ 2 (ตาราง→การ์ดใต้ sm) — หน้านี้ยังไม่มีเวอร์ชันการ์ด · ช่องสี/ไซส์เล็กจิ๋ว w-20/w-16 (`product-table-row.tsx:159-160`) ซ้อนอยู่ในคอลัมน์ "สินค้า" อีกชั้น = ช่องในช่อง
3. **free-text ความหมายใกล้กัน 4 ช่องบนจอเดียว** — "รายละเอียดจากแชท" (`order-detail-fields.tsx:55-62`) · "หมายเหตุภายใน" (`order-detail-fields.tsx:119-125`) · "คำอธิบายงาน" ต่อรายการ (`order-item-card.tsx:172-176`) · "หมายเหตุรายการ" (`order-item-card.tsx:383-388`) — แอดมินต้องเดาว่าจดที่ไหน แล้วของก็กระจัดกระจาย (ยังไม่นับ designNote ต่อลายที่ซ่อนอยู่)

### กลาง
4. **ส่วนลด 2 ชั้น 2 ที่** — ส่วนลดต่อสินค้า (คอลัมน์ในตาราง `product-table-row.tsx:205-209`) กับส่วนลดทั้งใบ (`order-price-summary.tsx:244-259`) · ตัวคำนวณต่างกัน (ต่อชิ้น vs ท้ายบิลก่อน VAT) แต่ UI ไม่บอกความต่าง — คนกรอกซ้ำ 2 ที่ได้
5. **คอลัมน์ "แพค" ในตารางหลัก** — `product-table-row.tsx:212-219` (110px) ของที่แทบไม่ตัดสินตอนเปิดงาน กินที่ถาวรทุกแถว
6. **ส่วนเสริม (Add-ons) + ค่าใช้จ่ายเพิ่มเติม เป็น empty-state CTA ก้อนใหญ่ 2 ก้อนกางตลอด** — `order-item-card.tsx:335-343` + `order-fee-section.tsx:55-63` (กล่อง dashed py-6 อย่างละก้อน) ทั้งที่งานส่วนใหญ่ไม่มี — ควรยุบเป็นปุ่มลิงก์แถวเดียว
7. **ภาษี/เงื่อนไขชำระ/PO ลอยอยู่กลาง section ราคา** — `page.tsx:536-576` grid 3 ช่องแทรกระหว่าง fee กับสรุปราคา · "เงื่อนไขชำระ" ไม่ใช่เรื่องราคา ควรอยู่กับข้อมูลลูกค้า/การวางบิล — ตำแหน่งนี้ทำให้ section 2 ยาวขึ้นโดยไม่จำเป็น

### เบา
8. **"คัดลอกลาย..." เป็น `<select>` ปลอมตัวเป็นปุ่ม** — `order-item-card.tsx:185-201` มุมหัวข้อลาย มองไม่ออกว่าเป็น dropdown จนกว่าจะมี >1 รายการ
9. **เลข section หาย** — attachments ได้เลข 3 (`page.tsx:597`) แต่ "ที่อยู่จัดส่ง" ที่ตามมาไม่มีเลข (`page.tsx:605-610`) — ระบบนับ 1-2-3 ขาดท่อน
10. **priority auto-escalate ทางเดียว** — `page.tsx:169-179` เลื่อน deadline ใกล้ → ดันเป็น URGENT/HIGH แต่เลื่อนออก ไม่ลดกลับ · แอดมินไม่รู้ตัวว่าค่าโดนเปลี่ยน
11. **header draft เก็บไม่ครบ** — `use-order-items-form.ts:17-23` เก็บแค่ customerId/selectedCustomer/title/description — deadline/channel/notes/fees/shipping หายตอน refresh (draft รายการรอด)

---

## ④ multi-size matrix ใช้ยังไงตอนนี้

- ค่าเริ่มต้นสินค้า 1 แถว = 1 variant (สี+ไซส์+จำนวน ช่อง inline เล็กๆ ใน `product-table-row.tsx:159-160,200`)
- กดปุ่ม "หลายไซส์" (`product-table-row.tsx:163-173` — เฉพาะสินค้าไม่ใช่ FROM_STOCK) → เปิด `SizeMatrix` เป็นแถวเต็มกว้างใต้แถวสินค้า (`product-table-row.tsx:259-266`)
- Matrix: คอลัมน์มาตรฐาน S/M/L/XL/2XL/3XL (`lib/size-matrix.ts:7`) + เพิ่มไซส์เองได้ (XS/4XL/เด็ก/ตัวเลข) · **สีเดียวใช้ทุกไซส์** (`size-matrix.tsx:50-61`) · กรอกจำนวนต่อช่อง รวมอัตโนมัติ · คืน variants เฉพาะ qty>0
- มี >1 variant = บังคับโหมด matrix ปิดไม่ได้ (`product-table-row.tsx:90,167` disabled + title "ล้างจำนวนไซส์ให้เหลือไซส์เดียวก่อนปิด")
- สินค้า FROM_STOCK: เลือกจาก ProductPickerDialog แล้ว 1 variant = 1 แถวสินค้า (`lib/order-form-stock.ts:49-55` dedupe ต่อ size/color)

**ประเมิน:** ตัว matrix ทำงานดี ตรงงานเสื้อทีม · ข้อจำกัดจริง 2 อย่าง — (ก) **หลายสี = ต้องเพิ่มแถวสินค้าซ้ำต่อสี** (สีเป็นค่าเดียวทั้ง matrix) ซึ่งเป็นเคสจริงของงานทีม (ดำ+ขาวอย่างละครึ่ง) · (ข) การเข้าโหมดซ่อนอยู่หลังปุ่มเล็ก text-[11px] ตอนงาน 40 ตัว 5 ไซส์แอดมินอาจกรอกช่องเดี่ยวไปก่อนแล้วค่อยเจอปุ่ม — ควรให้ matrix เป็น default ของ CUSTOM_MADE/CUSTOMER_PROVIDED หรือถามจำนวนก่อน (ตัดสินใน ⑤)

---

## ⑤ ข้อเสนอโครงใหม่ 2 ทาง

### ทาง A — หน้าเดียวเดิม + "ราคาค่อยเปิด" (progressive disclosure) ✅ แนะนำ
คงโครง 1-2-3 + sticky bar (เพิ่งรื้อมา ผู้ใช้เพิ่งชิน) แล้วผ่าเฉพาะจุดรก:
1. โซนราคา (fee + ภาษี + เงื่อนไขชำระ + สรุปราคา `page.tsx:528-589`) **render เมื่อ `hasItemContent` เท่านั้น** — สวิตช์มีอยู่แล้ว (`page.tsx:167`) แค่เอามาคุม render · ฟอร์มว่าง = จอสั้นลงเกือบครึ่ง และกับดัก validation ข้อ 3 หายเอง
2. ย้าย "รูปอ้างอิงจากแชท" ขึ้นไปท้าย section 1 (จุด capture ตอนแชท) — คง CollapsibleSection เดิม
3. ตารางสินค้า: จอ < sm สลับเป็นการ์ด (pattern DESIGN.md ข้อ 2 — มีตัวอย่างใน repo แล้ว) · ย้าย "แพค" + "ส่วนลดต่อชิ้น" เข้า popover/แถวขยาย "เพิ่มเติม" ต่อแถว (pattern เดียวกับ print-table-row ที่ทำไว้แล้ว `print-table-row.tsx:122-173`) → เหลือ 5 คอลัมน์หลัก: แหล่ง·สินค้า·ราคา·จำนวน·รวม
4. ยุบ "ส่วนเสริม" + "หมายเหตุรายการ" + "ค่าใช้จ่ายเพิ่มเติม" เป็นแถวปุ่มลิงก์ (+ ส่วนเสริม · + หมายเหตุ · + ค่าใช้จ่าย) เปิดเมื่อกด — ตัด empty-state dashed 3 ก้อน
5. งานตัดเย็บ/ลูกค้าส่งมา: เปิด SizeMatrix เป็น default แทนช่องสี/ไซส์เดี่ยว (งานพวกนี้แทบไม่มีไซส์เดียว) — ช่องเดี่ยวเก็บไว้ให้ FROM_STOCK เหมือนเดิม
6. เก็บเบา: ใส่เลข section ให้ครบ · เปลี่ยน "คัดลอกลาย" เป็นปุ่ม+dropdown จริง · toast บอกเมื่อ priority ถูก auto-เปลี่ยน

- **ดี:** surgical ตามกติกา build · แตะน้อย logic ราคา/validate ไม่ขยับ · ผู้ใช้ไม่ต้องเรียนใหม่ · ทำเป็นชิ้นเล็ก verify ทีละข้อได้
- **เสีย:** ยังเป็นหน้ายาว scroll อยู่ · ช่องที่ "โชว์ตลอด" ยังเยอะกว่า wizard · ไม่บังคับลำดับการกรอก

### ทาง B — wizard 3 ขั้น (ลูกค้า+โจทย์ → รายการ+ราคา → ส่ง+ยืนยัน)
ขั้น 1: ลูกค้า + รายละเอียดแชท + รูป + deadline (จบขั้นนี้กด "เปิดเป็นใบสอบถาม" ได้เลย) · ขั้น 2: รายการ/ไซส์/ลาย/ราคา (ข้ามได้) · ขั้น 3: จัดส่ง + เงื่อนไขชำระ + สรุป+ยืนยัน

- **ดี:** จอสะอาดสุด ทีละเรื่อง · เข้ากับมือถือ · เส้น "เปิดเบา" ชัดเป็นปุ่มจบขั้น 1
- **เสีย:** รื้อโครงที่เพิ่งรื้อเมื่อเดือนก่อน (ขัด surgical + ผู้ใช้ต้องเรียนใหม่รอบสอง) · งานถือแชทต้องกระโดดไปมาระหว่างขั้น (ลูกค้าส่งรูปเพิ่มตอนกรอกราคาอยู่ = ต้องย้อนขั้น) · state/draft ข้ามขั้นซับซ้อนขึ้น · แก้ค่าที่กรอกขั้นก่อนต้อง back · โค้ด review เดิม (audit ข้อ 1-13 ใน comment) ที่แก้ไว้บนโครงหน้าเดียวเสี่ยง regress

**คำแนะนำ: ทาง A** — ปัญหาที่เบสรู้สึก ("รก") มาจาก *ของไม่จำเป็นโชว์พร้อมกัน* ไม่ใช่ *ไม่มีขั้นตอน* · โครง 1-2-3 + sticky bar เพิ่งวางและตรงพฤติกรรมถือแชทอยู่แล้ว · ทาง A ตัด control ที่เห็นตอนเปิดหน้าจาก ~18-20 เหลือ ~8-9 โดยแทบไม่แตะ logic · ถ้าทำ A แล้วยังรกค่อยพิจารณา B (A เป็น subset ที่ B ต้องทำอยู่ดี ไม่เสียของ)

**ลำดับลงมือแนะนำ (session หน้า):** A1 (ราคาค่อยเปิด — ผลแรงสุด/เสี่ยงต่ำสุด) → A2 (ย้ายรูป) → A4 (ยุบ CTA) → A3 (ตาราง→การ์ด — ชิ้นใหญ่สุด แยก commit) → A5 → A6

---

## สิ่งที่ห้ามแตะ

- **logic ราคา**: `calculateOrderSummary`/`calculateFormItemSubtotal` (`lib/pricing`) + สูตร A ฝั่ง server (`order.ts:608-615` `priceOrderItems`/`computeOrderTotals`) — client เป็นแค่ preview, server คิดจริงเป็น Decimal · ห้ามคิดสูตรใหม่/ห้าม Float
- **taxRate default 7 + สลับ marketplace** (`page.tsx:98-100,187-195`) — Gate B2 เบส confirm 2026-07-02 ภาษีขายห้ามขาด
- **`itemHasContent`** (`order-form.ts:268-281`) — ตัวตัดสิน draft+โหมดใช้ร่วมกัน 2 ระบบ แก้แล้ว draft ค้าง/หาย (ใช้มันคุม render ได้ แต่ห้ามแก้เงื่อนไขข้างใน)
- **validate ฝั่งฟอร์ม+server**: `validateOrderItem*` (`order-form.ts:294-315`) และ zod ใน `order.ts` — quantity ≥1, ราคา >0 ล้วนมีเหตุ (comment ระบุเคสจริง)
- **draft localStorage 2 ชั้น** (`use-order-items-form.ts`) — SSR-safe load-after-mount ที่เพิ่งแก้ hydration ไว้ · ขยายให้เก็บ field เพิ่มได้ แต่ห้ามเปลี่ยนกลไก
- **margin estimate gating** (`order-price-summary.tsx:44-87`) — ตัวเลขทุนโชว์เฉพาะ role การเงิน FORBIDDEN→null→ไม่ render · เช่นเดียวกับวงเงินเครดิต (`order-customer-section.tsx:30-37`) — PERM ห้ามรั่ว
- **status/derive ฝั่ง server** (`order.ts:150-154,679-685`) — deriveOrderType/initialStatus เดินผ่าน server เท่านั้น
- **`mergeStockVariantsIntoItems`** (`lib/order-form-stock.ts`) + **`OrderItemCard` ใช้ร่วมกับฟอร์มแก้รายการ** (`order-items-editor.tsx:23`) — แก้การ์ดต้อง regression-test หน้าแก้รายการออเดอร์ด้วยเสมอ
