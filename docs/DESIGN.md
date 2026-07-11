# มาตรฐาน UI Anajak ERP (P1.0)

> หน้าใหม่ + หน้าที่ถูกแตะใน P1-P3 ต้องตามนี้ทันที · หน้าเก่าที่ยังไม่มีงานไปแตะ ปล่อยไว้ก่อน
> (รอบเก็บตกอยู่ปลาย P1 ตาม ROADMAP) — **ห้าม redesign หน้าที่ไม่มีงาน functional**

## สี — token 3 ชั้น (`src/app/globals.css`)

| ชั้น | คืออะไร | ใช้ยังไง |
|---|---|---|
| Primitive | สีแบรนด์: `--color-anajak-blue #3973b2` · `--color-anajak-yellow #fec91b` · `--color-anajak-red #e72f27` | **ห้ามใช้ตรงใน component** |
| Ramp | สเกล `blue-50..950` / `red-50..950` ของ Tailwind ถูก override เป็น ramp จากสีแบรนด์ (เลข 600 = สีแบรนด์เป๊ะ) | ใช้ utility ปกติ: `bg-blue-600`, `text-red-700` — ได้โทนแบรนด์อัตโนมัติ |
| Semantic | `--color-accent/-hover/-soft`, `--color-success/warning/danger(-soft)`, surface/border/text | ผ่าน utility: `bg-accent`, `bg-surface`, `text-text-muted` |

กฎ: **ห้าม hex ตรงๆ ในโค้ด component** · สีเหลืองแบรนด์ใช้เฉพาะจุดเน้นพิเศษ (เช่น Job Ticket) ผ่าน `anajak-yellow` · `amber-*` = warning ตามเดิม

## Component มาตรฐาน — มีแล้ว ห้ามสร้างซ้ำ

| งาน | ใช้ตัวนี้ | หมายเหตุ |
|---|---|---|
| ตาราง list | `ui/data-table.tsx` (DataTable.Root/Head/Body/...) + `ui/table-pagination.tsx` | จอเล็ก: ดูหัวข้อ Mobile |
| ยืนยัน/ถามเหตุผล | `useConfirm()` / `usePromptText()` จาก `ui/confirm-dialog.tsx` | **ห้าม window.confirm/prompt — lint เป็น error** |
| dialog ทั่วไป | `ui/dialog.tsx` (Radix) | |
| สถานะออเดอร์ | `components/order-status-badge.tsx` | dot + customer status + internal มาตรฐานเดียว |
| badge อื่น | `ui/badge.tsx` (variant: default/accent/success/warning/destructive/outline) | อย่าเพิ่มสีใหม่ |
| ว่างเปล่า | `ui/empty-state.tsx` | ทุก list ที่ว่างต้องมี |
| โหลด/พัง | `ui/skeleton.tsx` + `ui/query-error.tsx` | ทุก query หลักของหน้า |
| หัวข้อกลุ่ม/สถิติ | `ui/section.tsx` · `ui/stat-card.tsx` | |
| ฟอร์ม | `ui/field.tsx` ครอบ `input|textarea|select|native-select|switch` + Zod เมื่อมี validation ซับซ้อน | label/id/required/description/error/aria ต้องมาจาก Field · ยังไม่เพิ่ม form dependency |
| list responsive | `ui/responsive-list.tsx` | desktop table + mobile card เฉพาะหน้าจอ · ใช้ loading/error/empty/pagination ชุดเดียว |
| สิทธิ์ UI | `ui/capability-gate.tsx` + `permAllows` | action ที่ server ไม่อนุญาตต้องไม่เปิดให้กรอกก่อนแล้วค่อย error |
| ช่องทางจ่ายเงิน | `lib/payment-methods.ts` | ค่า+ป้ายที่เดียว |

## Mobile-first (หน้า ops: task queue / production / งานหน้าเครื่อง)

พนักงานใช้มือถือหน้างาน — หน้า ops ต้อง:
1. **เป้านิ้ว ≥ 44px**: control กลางทุกชนิดสูงอย่างน้อย 44px บนจอ < `sm`; desktop กลับเป็น 36px ได้ · แถว/ไอคอนที่กดได้มี hit area ≥ 44×44px
2. **ตาราง → การ์ด**: จอ < `sm` ห้ามให้ scroll ตารางแนวนอนเป็นทางหลัก — แสดงเป็น card list (`hidden sm:block` ตาราง / `sm:hidden` การ์ด)
3. **action หลักติดจอ**: ปุ่มยืนยันงานใช้ sticky bottom bar บนมือถือ
4. **dialog**: ConfirmDialog ทำให้แล้ว (ปุ่มเต็มแถวซ้อนกันบนจอเล็ก) — dialog ใหม่ทำตาม
5. เริ่มเขียน layout จากจอเล็กก่อนแล้วค่อย `sm:`/`lg:` ขึ้นไป

## Typography / spacing / radius

ตามที่ component มาตรฐานใช้อยู่: ฟอนต์ Prompt · ตัวเลขเงิน `tabular-nums` เสมอ ·
การ์ด/กล่อง `rounded-2xl` · ปุ่ม/ช่องกรอก `rounded-lg` · mobile input ต้อง 16px กัน browser zoom; desktop control/body 14px · metadata อย่างน้อย 12px และต้องผ่าน contrast
หัวเรื่องหน้า `text-xl font-semibold` — ดูตัวอย่างจริงจาก component ใน `ui/` ไม่ต้องจำตาราง

## Interaction / navigation / state contract (UX0)

- Sidebar และ Command Palette อ่านจาก navigation registry เดียว: label/icon/href/permission/search aliases/visibility อยู่ที่เดียว · active route ใช้ exact หรือ longest match ห้าม `startsWith` ทื่อจนติดหลายเมนู
- list state ที่แชร์/ย้อนกลับได้อยู่ใน URL: `q`, `status`, `sort`, `page` + filter เฉพาะหน้า · Orders รองรับ `attention=overdue|due-soon|stuck`
- query ต้องแยก loading/error/empty ชัดเจน; error มี retry และ live announcement · ห้ามแสดง error เป็น “ไม่มีข้อมูล”
- dialog/sheet ต้องมี viewport gutter, `max-height`, body scroll, Escape, focus trap และคืน focus ให้ trigger
- action สำคัญห้ามพึ่ง hover; ปุ่มลบ/แก้ต้องมองเห็นและแตะได้บน coarse pointer
- public token pages บังคับ light theme เพื่อให้เอกสารลูกค้าอ่านได้แน่นอน แม้เครื่องตั้ง system dark
- animation ต้องเคารพ `prefers-reduced-motion`; ทุกหน้าหลังบ้านมี skip link ไป `<main id="main-content">`

## ลิสต์หนี้ UI เก่า

`npm run lint` — warning ที่เหลือ (react-hooks compiler/no-img/unused) คือหน้าเก่าที่รอ
รอบเก็บตกปลาย P1 · แตะหน้าไหนเก็บหน้านั้น (boy-scout) · ห้ามเพิ่ม warning ใหม่
