# มาตรฐาน UI Anajak ERP (P1.0)

> หน้าใหม่ + หน้าที่ถูกแตะใน P1-P3 ต้องตามนี้ทันที · หน้าเก่าที่ยังไม่มีงานไปแตะ ปล่อยไว้ก่อน
> (รอบเก็บตกอยู่ปลาย P1 ตาม ROADMAP) — **ห้าม redesign หน้าที่ไม่มีงาน functional**
>
> ⚠️ **ถ้าเอกสารนี้ขัดกับโค้ด ให้เชื่อโค้ด แล้วกลับมาแก้เอกสารในคอมมิตเดียวกัน**
> (audit 2026-08-02 พบว่าไฟล์นี้ระบุผิด 8 จุด — สั่งให้ใช้สีที่ไม่มีใครใช้ · อ้างไฟล์ที่ไม่มีอยู่จริง
>  2 ไฟล์ · บอกมุมโค้งปุ่มผิด · สอนวิธีเขียนที่ด่าน lint ตีตก · และเป็นสาเหตุตรงที่ทำให้ของใหม่
>  ออกมาไม่เข้าชุด เพราะคนใหม่เปิดไฟล์นี้เป็นไฟล์แรก)
>
> **หน้าตัวอย่างที่ทำถูกทั้งหน้า:** `src/app/(dashboard)/customers/page.tsx`

## สี — token 3 ชั้น (`src/app/globals.css`)

| ชั้น | คืออะไร | ใช้ยังไง |
|---|---|---|
| Primitive | สีแบรนด์: `--color-anajak-blue #3973b2` · `--color-anajak-yellow #fec91b` · `--color-anajak-red #e72f27` | **ห้ามใช้ตรงใน component** |
| Ramp | สเกล `blue-50..950` / `red-50..950` ของ Tailwind ถูก override เป็น ramp จากสีแบรนด์ (เลข 600 = สีแบรนด์เป๊ะ) | ใช้ utility ปกติ: `bg-blue-600`, `text-red-700` — ได้โทนแบรนด์อัตโนมัติ |
| Semantic | พื้น: `--color-bg` (light `#f7f7f8` ขาวนวล) · `--color-chrome` / `--color-surface` (light `#fff`) · `--color-surface-muted` (light `#f2f2f4`) · interaction: `--color-interactive-hover` / `--color-interactive-pressed` · ข้อความ: `--color-text` / `--color-strong` / `--color-secondary` / `--color-muted` | ใช้ผ่าน `bg-bg` / `bg-chrome` / `bg-surface` / `bg-surface-muted` / `bg-interactive-hover` / `bg-interactive-pressed` และ `text-strong` / `text-secondary` / `text-muted` |

> **แก้ 2026-08-02 จาก audit สี:** เคยมีสี semantic ที่ซ้ำกับ ramp อีก 17 ตัว (`accent` · `success` ·
> `warning` · `danger` · `border` · `text-muted` ฯลฯ) เขียนไว้ในเอกสารนี้ว่า "ให้ใช้"
> — ตรวจแล้ว **ไม่มีใครเรียกใช้เลยสักจุดตั้งแต่วันที่ประกาศ** และค่าที่ตั้งไว้ขัดกับสีจริง
> (`--color-danger` เป็นแดง Apple คนละเฉดกับแดงแบรนด์) → **ลบทิ้งแล้ว** ห้ามเขียนกลับมา
> โดยไม่มีคนใช้จริง · semantic ข้อความ 3 ระดับด้านบนเพิ่มภายหลังเพื่อแก้การสลับธีมและมีด่านตรวจรองรับ

**สีตัวหนังสือใหม่ใช้ semantic ก่อน** ส่วน markup เดิมที่ยังใช้ ramp จะได้ค่าเฉดเดียวกันจาก `globals.css`:

| ใช้ทำอะไร | เขียนยังไง |
|---|---|
| ตัวหนังสือหลัก | `text-strong` (ของเดิม: `text-slate-900 dark:text-white`) |
| ตัวหนังสือรอง | `text-secondary` |
| คำบรรยาย · วันที่ · meta | `text-muted` (ของเดิม: `text-slate-500 dark:text-slate-400`) |
| ค่าว่าง / เลขศูนย์ | `text-slate-400 dark:text-slate-500` |
| หัวตารางบนการ์ด | `TABLE_HEAD_SURFACE` (`bg-surface dark:bg-white/[0.03]`) |
| พื้นที่จมลงไป — กล่องย่อยในการ์ดใช้ `SUNK_PANEL` (จม = **เข้มกว่า** พื้นเสมอ ทั้งสองธีม · เบสเคาะ 2026-08-04) · พื้นตอนชี้ | `SUNK_PANEL` (`bg-surface-muted dark:bg-black/25`) · hover `bg-interactive-hover` · pressed `bg-interactive-pressed` (ห้ามกลับไป `slate-100` เพราะเท่ากับพื้นจม) |
| เส้นคั่น | `border-slate-200 dark:border-white/10` (ในกล่องลอยใช้ `dark:bg-white/10`) |

**โหมดมืดใช้ "ขาวโปร่ง" ไม่ใช่เทาเข้ม** — `bg-white/10` สว่างกว่าพื้นเสมอไม่ว่าวางบนการ์ด
พื้นหน้า หรือกล่องลอย · ถ้าใช้ `dark:bg-slate-800` จะกลืนกับพื้นการ์ด (ต่างกัน 5 จาก 255)

กฎ: **ห้าม hex ตรงๆ ในโค้ด component** · ใช้ได้แค่ 5 ตระกูล **slate / blue / red / amber / green**
(ทั้งหมดถูก override เป็นโทนแบรนด์แล้ว) — ตระกูลอื่นมีด่าน lint ข้อ 10 ดักไว้
· neutral มาตรฐาน = `slate-*` เท่านั้น (ramp ถูก override เข้าโทน Apple gray ที่ `@theme` แล้ว — UX4.4) — **ห้ามใช้ `gray-*`/`zinc-*` ปน** เพราะจะหลุดโทนที่ override ไว้

## Component มาตรฐาน — มีแล้ว ห้ามสร้างซ้ำ

| งาน | ใช้ตัวนี้ | หมายเหตุ |
|---|---|---|
| **โครงหน้า dashboard** | `components/page-shell.tsx` (PageShell) | header + โหลด/พัง/ไม่มีสิทธิ์ + spacing/width (full/wide/content/form) — เขียน header ครั้งเดียว **ห้าม return branch พร้อม PageHeader ซ้ำเอง** |
| **โครงหน้า public (token)** | `components/public/public-page.tsx` (PublicPageShell / FullScreenLoading / InfoRow) | route อยู่ใน `(public)` — layout กลางใส่ noindex ให้ · prefix ธีมสว่างอยู่ `lib/public-routes.ts` |
| **ไม่มีสิทธิ์** | `ui/access-denied.tsx` | ผ่าน prop `denied` ของ PageShell — ห้ามใช้ QueryError/`<p>` เทาแทน |
| **state หน้า list** | `hooks/use-list-page-state.ts` (useListPageState + usePageClamp) | URL state + debounce ค้นหา + page clamp — ห้ามเขียน replaceListState เอง |
| ตาราง list | `ui/data-table.tsx` (DataTable.Root/Head/Body/...) + `ui/table-pagination.tsx` | หัว sentence-case ห้าม UPPERCASE · หัวตาราง custom ใช้ `TABLE_HEAD_SURFACE` · จอเล็ก: ดูหัวข้อ Mobile |
| ยืนยัน/ถามเหตุผล | `useConfirm()` / `usePromptText()` จาก `ui/confirm-dialog.tsx` | **ห้าม window.confirm/prompt — lint เป็น error** |
| dialog ทั่วไป | `ui/dialog.tsx` (Radix) | **เปิดแบบ conditional mount เท่านั้น** — กติกาอยู่ comment หัวไฟล์ |
| **ปุ่มท้าย dialog ฟอร์ม** | `ui/dialog-submit-footer.tsx` (DialogSubmitFooter) | ยกเลิก+บันทึก · pending/spinner/disabled/มือถือเต็มแถว ให้ครบในตัว |
| **ติ๊ก** | `ui/checkbox.tsx` | ห้าม `<input type="checkbox">` ดิบ |
| **ช่องตัวเลข/เงิน** | `ui/number-input.tsx` (NumberInput / MoneyInput) | คุม empty/fallback/tabular-nums — ห้ามเขียน parseFloat เองรายช่อง |
| สถานะออเดอร์ | `components/order-status-badge.tsx` | dot + customer status + internal มาตรฐานเดียว |
| badge อื่น | `ui/badge.tsx` (variant: default/accent/success/warning/destructive/outline) | อย่าเพิ่มสีใหม่ |
| ว่างเปล่า | `ui/empty-state.tsx` | ทุก list ที่ว่างต้องมี |
| โหลด/พัง | `ui/skeleton.tsx` + `ui/query-error.tsx` | ทุก query หลักของหน้า |
| หัวข้อกลุ่ม/สถิติ | `ui/section.tsx` · `ui/stat-card.tsx` | StatCard รับ `tone`/`href` สำหรับเลขเสี่ยง (ตัวเลขที่ต้องเด่น+กดไปดูได้ — UX4.3) |
| ฟอร์ม | `ui/field.tsx` ครอบ `input\|textarea\|select\|switch` + Zod เมื่อมี validation ซับซ้อน | label/id/required/description/error/aria ต้องมาจาก Field · **`native-select` ถูกยุบเข้า `ui/select.tsx` แล้ว** ไม่มีไฟล์นั้น |
| list responsive | `ui/responsive-list.tsx` | desktop table + mobile card เฉพาะหน้าจอ · ใช้ loading/error/empty/pagination ชุดเดียว · มี `emptyAction` ใส่ปุ่มก้าวถัดไปตอน list ว่าง (UX4.7) |
| สิทธิ์ UI | `permAllows` จาก `lib/permissions` | action ที่ server ไม่อนุญาตต้องไม่เปิดให้กรอกก่อนแล้วค่อย error · (เอกสารเคยอ้าง `ui/capability-gate.tsx` — **ไฟล์นั้นไม่มีอยู่จริง** ลบข้อมูลผิดออก 2026-08-02) |
| ภาษาหน้าตา (มุมโค้ง · วงแหวนโฟกัส · ผิวช่องกรอก · สีกล่องเตือน) | `ui/tokens.ts` | RADIUS · FOCUS_FIELD/BUTTON/INSET · FIELD_SURFACE · OVERLAY_PANEL · MENU_ITEM · MENU_SEPARATOR · TINT · DASHED · ACTIVE_FILTER — **ด่าน lint บังคับให้ใช้ ห้ามเขียนเอง** |
| ความสูง control | `ui/control-size.ts` + size ของ Input/Select | CONTROL_H / CONTROL_H_SM / CONTROL_MIN_H · `size="sm"` (32px desktop) / `size="dense"` (สูงมาตรฐาน+อักษร xs สำหรับ editable grid) |
| ช่องทางจ่ายเงิน | `lib/payment-methods.ts` | ค่า+ป้ายที่เดียว |
| วิธีจัดส่ง | `lib/shipping-methods.ts` | ค่า+ป้ายที่เดียว (ตรง schema) — ห้าม hardcode `<option>` |
| สถานะ→สี/ป้าย | `lib/status-config.ts` (+ `*_LABELS_CUSTOMER`) · `lib/order-status.ts` | ห้ามประกาศ map สถานะในหน้า — หน้า public ใช้ชุด `_CUSTOMER` |
| **สีตัวหนังสือ** | `text-strong` / `text-secondary` / `text-muted` (globals.css) | สลับธีมในตัว — slate 900/700/500 เดี่ยวๆ ไม่มีคู่ `dark:` โดนด่านใน `verify:ui` ตีตก |
| วันที่/เงิน (แสดงผล) | `lib/utils.ts` — formatDate/formatDateShort/formatDateTime/formatTime (ปัก Asia/Bangkok) · formatCurrency/formatBaht | ห้าม `toLocaleDateString` สดโดยไม่ปัก timezone |

## Mobile-first (หน้า ops: task queue / production / งานหน้าเครื่อง)

พนักงานใช้มือถือหน้างาน — หน้า ops ต้อง:
1. **เป้านิ้ว ≥ 44px**: control กลางทุกชนิดสูงอย่างน้อย 44px บนจอ < `sm`; desktop กลับเป็น 36px ได้ · แถว/ไอคอนที่กดได้มี hit area ≥ 44×44px
2. **ตาราง → การ์ด**: ใช้ `ResponsiveList` (สลับที่ `lg` — จอแคบกว่านั้น sidebar กินพื้นที่จนตารางบีบ) — ห้ามเขียน `hidden lg:block`/`lg:hidden` เอง
3. **action หลักติดจอ**: ปุ่มยืนยันงานใช้ sticky bottom bar บนมือถือ
4. **dialog**: ConfirmDialog ทำให้แล้ว (ปุ่มเต็มแถวซ้อนกันบนจอเล็ก) — dialog ใหม่ทำตาม
5. เริ่มเขียน layout จากจอเล็กก่อนแล้วค่อย `sm:`/`lg:` ขึ้นไป

## Typography / spacing / radius

ตามที่ component มาตรฐานใช้อยู่: ฟอนต์ Prompt · ตัวเลขเงิน `tabular-nums` เสมอ ·
mobile input ต้อง 16px กัน browser zoom; desktop control/body 14px · metadata อย่างน้อย 12px และต้องผ่าน contrast

**มุมโค้ง — ใช้ `RADIUS` จาก `ui/tokens.ts` เท่านั้น** (แก้ข้อมูลผิด 2026-08-02: เอกสารเคยบอกว่าปุ่ม/ช่องกรอกเป็น 8px ซึ่งไม่ตรงของจริง ทำตามแล้วมุมไม่เท่าหน้าอื่น):

| ของชิ้นไหน | ค่า |
|---|---|
| ชิ้นเล็กในรายการ (ตัวเลือกในเมนู · ปุ่มในแถบสลับ) | `RADIUS.item` = 8px |
| กล่องย่อยในการ์ด · รูปย่อ | `RADIUS.inner` = 12px |
| การ์ด · ส่วน · ช่องกรอกทรงเหลี่ยม · กล่องเด้ง | `RADIUS.surface` = 16px |
| **ปุ่ม · ชิปตัวกรอง · ช่องค้นหา · สวิตช์** | `RADIUS.pill` = มนเต็ม |

**ขนาดตัวอักษร** ใช้บันได 8 ขั้นใน `globals.css` (`text-2xs` … `text-3xl`) — **ห้ามสั่งเป็น px ดิบ มีด่าน lint ดักไว้**
หัวเรื่องหน้า = `PageHeader` (`text-2xl` = 24px · แก้ข้อมูลผิด 2026-08-02: เอกสารเคยเขียน `text-[26px]` ซึ่ง**ด่าน lint ตีตกทันที**ทั้งที่ทำตามเอกสารเป๊ะ) — ทุกหน้าใช้ผ่าน component นี้ **ห้ามเขียน `<h1>` เอง** · หัว section ภายในหน้า = `Section`

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
