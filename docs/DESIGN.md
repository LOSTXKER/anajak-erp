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

## สี — semantic system (`src/app/globals.css`)

รอบเก็บสี 2026-08-14 ใช้ Light workspace ใน AppShell `#fafafa` ใกล้ขาวแบบ Vercel โดย card/chrome คงขาวล้วน
และคืน Dark เป็น neutral gray เข้มแบบเดิม
และใช้ surface hover/pressed เป็นเทากลางแทนฟ้ากับพื้นที่กดทั้ง navigation/control/row/card ·
hover Light เป็นขาวนวล ไม่ใช่แถบเทาหนัก · น้ำเงิน Anajak `#3973b2` สงวนให้ primary,
selected และ focus เพื่อให้สถานะชี้กับสถานะเลือกไม่สื่อความหมายซ้ำกัน

| บทบาท | Light | Dark | utility |
|---|---|---|---|
| พื้น workspace หลังบ้าน | `#fafafa` | `#1a1a1c` | `.app-workspace` + `bg-bg` |
| พื้น fallback public/auth | `#f8f9fb` | `#1a1a1c` | `bg-bg` |
| navbar/sidebar | `#fff` | `#161618` | `bg-chrome` |
| card | `#fff` | `#252528` | `bg-surface` / `card-surface` |
| menu/dialog | `#fff` | `#252528` | `bg-surface-elevated` / `overlay-surface` |
| กล่องจมเชิงโครงสร้าง/disabled | `#f3f5f7` | `#1d1d1f` | `bg-surface-muted` / `SUNK_PANEL` |
| ช่องกรอก | `#fff` + ขอบ `#c8d0d9` | `#101012` + ขอบ `#3f3f44` | `FIELD_SURFACE` |
| พื้นที่เพิ่ม/อัปโหลด | ขอบประ `slate-300` | ขอบประ `slate-700` | `DASHED` / `DASHED_INTERACTIVE` — resting เบา; hover/focus ค่อยเน้น |
| control บน toolbar | `#fff` + เงา | `#252528` + เงา | prop `surface="raised"` → `RAISED_CONTROL_SURFACE` |
| ปุ่มรอง | `#fff` + ขอบบาง+เงา | `#252528` + ขอบบาง+เงา | `Button outline/secondary/subtle` |
| ขอบทั่วไป / เส้นคั่น | `#e2e6ea` / `#e8ebef` | `#343438` / `#303034` | `border-border` / `border-divider` |
| Hover | `#f1f3f5` | `#303034` | `bg-interactive-hover` / `INTERACTIVE_HOVER` |
| Pressed | `#e3e6e9` | `#38383c` | `bg-interactive-pressed` / `INTERACTIVE_PRESSED` |
| Hover บน navbar/sidebar | `#f1f3f5` | `#252528` | `bg-interactive-chrome-hover` / `INTERACTIVE_CHROME_HOVER` |
| Pressed บน navbar/sidebar | `#e3e6e9` | `#303034` | `bg-interactive-chrome-pressed` / `INTERACTIVE_CHROME_PRESSED` |
| Selected | `#d2e4f6` | `#173c61` | `bg-interactive-selected text-interactive-selected-text` |

**ข้อความใช้ semantic ก่อน** — ทุกค่าข้างล่างสลับธีมเองและผ่าน AA บน surface กับ interaction states:

| ใช้ทำอะไร | เขียนยังไง |
|---|---|
| หัวข้อ/ชื่อ/ค่าหลัก | `text-strong` |
| ข้อความรอง | `text-secondary` |
| คำบรรยาย · วันที่ · meta | `text-muted` |
| ข้อความตัวอย่างในช่อง | `text-placeholder` / `placeholder:text-placeholder` |
| ค่าว่างที่ไม่ใช่ placeholder | ใช้ `text-muted`; จางกว่านี้ได้เฉพาะ disabled/decoration ที่ไม่ใช่ข้อมูล |
| หัวตาราง | `TABLE_HEAD_SURFACE` |

กติกา interaction:

- navigation, ขั้นสถานะ, control, menu option, row และ clickable card ใช้พื้น hover ครอบ hit area จริง; Light ใช้ขาวนวลเพื่อไม่ให้ดูเป็นแถบเทาหนัก
- clickable card compose `card-surface-hover` เพื่อรับพื้น hover เต็ม hit area + elevation + pressed จาก primitive กลาง; ห้ามเขียนสีซ้ำที่ caller
- ของที่กดได้จริง compose `INTERACTIVE_PRESSED` ให้ตอนกดเข้มกว่า hover; selected/current คงพื้นฟ้า
- ของที่ถูกเลือกใช้ `INTERACTIVE_SELECTED` — ห้ามใช้ hover เป็น selected เพราะความหมายคนละอย่าง
- Primary action ใช้ `blue-600` → hover `blue-700` → pressed `blue-800`; น้ำเงิน 600 ต้องคง `#3973b2`
- Minimal = ไม่มีเส้นกรอบ **ตกแต่ง**: card/table/status rail ใช้ surface+เงาโดยไร้ outline · field ใช้ขาว/เข้ม + เส้น resting อ่อนเพื่อช่วยเห็นรูปทรง · toolbar/secondary action ใช้ surface ยก · กล่องจมใช้ `surface-muted` เฉพาะโครงสร้าง
- รายการงานในฟอร์มใช้หนึ่ง `card-surface` ต่อหนึ่งรายการโดยตรงบน page canvas · ห้ามวาง card ใหญ่ครอบ list แล้วเติม border รอบรายการซ้ำ · CTA “เพิ่มรายการ” อยู่ก่อน list ทั้งหน้าเปิดงานและหน้าแก้ไข
- ช่องกรอกใช้ `FIELD_SURFACE` เสมอ — `border-field-border bg-field` ไม่มีเงา; resting boundary ต้องอยู่ในช่วงที่ guard ล็อกไว้ไม่ให้จางจนกลืนหรือเข้มจนเป็นตาราง · focus/error ใช้เส้น contrast สูงและเปลี่ยนสีเส้นเดิมโดยความสูงไม่ขยับ · ห้าม ancestor เปลี่ยนสี field ตามตำแหน่ง
- กล่องเพิ่มของ/อัปโหลดใช้ `DASHED_INTERACTIVE`; placeholder ที่อ่านอย่างเดียวใช้ `DASHED` — ขอบประตอนพักต้องอ่อนกว่าขอบเน้น เพราะพื้นที่ก้อนใหญ่ขยายน้ำหนักของเส้น; hover/pressed/focus เป็นผู้บอก interaction แทน · ห้ามใช้ `border-strong` เป็น resting state
- `SearchInput`/`Select` ที่อยู่บน `Toolbar` ระบุ `surface="raised"`; ใน form/dialog ระบุ/default `field`; action ในแถวที่ตั้งใจโปร่งใช้ `surface="inline"` แทน class สีดิบ
- field และ Button ที่ disabled ใช้ muted fill/text + `shadow-none` โดยไม่ลด opacity ทั้งก้อน เพื่อให้ยังอ่านค่าที่ล็อกอยู่ได้; icon-only/checkbox/switch คง feedback disabled ของ primitive ตัวเอง
- สีสถานะใช้เฉพาะ **blue / red / amber / green** ผ่าน `Badge`, `Alert`, `StatusLabel`, `TINT`
- `slate-*` เป็น compatibility ramp สำหรับ markup เก่า ไม่ใช่ทางหลักของ component ใหม่
- เอกสารใน `.print-page` ล็อก grayscale ของตัวเองและ public/print บังคับ Light เสมอ

กฎ: **ห้าม hex ตรงใน component** · ห้าม `gray-*`/`zinc-*` ปน · ห้ามเขียน neutral hover
ด้วย `slate/white/black` ตรง ๆ; `verify:ui` ตรวจทั้ง class, token layer และ contrast จริงค่ะ

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
| แท็บ | `ui/tabs.tsx` | เนื้อหา lazy เป็นค่าเริ่มต้น · ฟอร์มที่มี state ยังไม่บันทึกเท่านั้นจึง opt-in `keepMounted` · ห้าม force-mount แท็บ query-heavy ทั้งหน้า |
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
| ภาษาหน้าตา (มุมโค้ง · วงแหวนโฟกัส · ผิวช่องกรอก · สีกล่องเตือน) | `ui/tokens.ts` | RADIUS · FOCUS_FIELD/BUTTON/INSET · FIELD/RAISED/INLINE/DISABLED surface · OVERLAY_PANEL · MENU_ITEM · MENU_SEPARATOR · TINT · DASHED · ACTIVE_FILTER — **ด่าน lint บังคับให้ใช้ ห้ามเขียนเอง** |
| ความสูง control | `ui/control-size.ts` + size ของ Input/Select | CONTROL_H / CONTROL_H_SM / CONTROL_MIN_H · ทุก size สูง 44px mobile / 36px desktop; `sm` ลด padding/อักษร, `dense` ลดเฉพาะอักษรสำหรับ editable grid |
| ปุ่มไอคอนข้าง control | `ui/control-icon-button.tsx` | ปุ่มล้างค่า/ปิด overlay เป็น sibling ของ trigger เสมอ · 44px mobile / 36px desktop · ห้ามซ้อน interactive element ใน `<button>` |
| ช่องทางจ่ายเงิน | `lib/payment-methods.ts` | ค่า+ป้ายที่เดียว |
| วิธีจัดส่ง | `lib/shipping-methods.ts` | ค่า+ป้ายที่เดียว (ตรง schema) — ห้าม hardcode `<option>` |
| สถานะ→สี/ป้าย | `lib/status-config.ts` (+ `*_LABELS_CUSTOMER`) · `lib/order-status.ts` | ห้ามประกาศ map สถานะในหน้า — หน้า public ใช้ชุด `_CUSTOMER` |
| **สีตัวหนังสือ** | `text-strong` / `text-secondary` / `text-muted` (globals.css) | สลับธีมในตัว — slate 900/700/500 เดี่ยวๆ ไม่มีคู่ `dark:` โดนด่านใน `verify:ui` ตีตก |
| วันที่/เงิน (แสดงผล) | `lib/utils.ts` — formatDate/formatDateShort/formatDateTime/formatTime (ปัก Asia/Bangkok) · formatCurrency/formatBaht | ห้าม `toLocaleDateString` สดโดยไม่ปัก timezone |

## มาตรฐานความกว้างของหน้า

ความกว้างเลือกจาก **บทบาทของพื้นที่** ไม่ใช่จากชื่อ component ที่อยู่ข้างใน · จุดคุมกลางคือ
`PageShell width` ซึ่งวางอยู่ใน AppShell ที่มีเพดาน `max-w-screen-2xl` อยู่แล้ว:

| บทบาท | ค่า | ใช้เมื่อ |
|---|---|---|
| พื้นที่ทำงานเต็ม | `full` | list, dashboard, order detail, ตารางหลายคอลัมน์ และ inline editor ที่เปิดแทนเนื้อหาในหน้า detail |
| ฟอร์มเอกสาร standalone | `wide` = `max-w-5xl` | สร้างออเดอร์/ใบเสนอที่เป็นงานยาวหลายตอนและเปิดเป็นหน้าของตัวเอง |
| เนื้อหาอ่านแบบโฟกัส | `content` = `max-w-4xl` | รายละเอียดหรือบทความคอลัมน์เดียวที่ไม่มีตารางกว้าง |
| ฟอร์มสั้น | `form` = `max-w-2xl` | ตั้งค่า/ข้อมูลบริษัทที่มีแนวกรอกเดียว |

- component ร่วมต้องคุมโครง ลำดับ spacing ถ้อยคำ และ responsive state ให้เหมือนกัน แต่ **ห้ามฝัง `max-w-*` เพื่อเลียนความกว้างของ caller อื่น**
- inline editor รับความกว้างจาก host เสมอ; ห้ามครอบ `mx-auto max-w-*` ซ้ำจนเกิด double narrowing
- หากส่วนเดียวกันอยู่ใน `wide` และ `full` ให้ตาราง/field ขยายตามพื้นที่จริง ส่วนบรรทัดคำอธิบายยาวคุม measure ที่ตัวข้อความ ไม่บีบทั้งฟอร์ม

## Mobile-first (หน้า ops: task queue / production / งานหน้าเครื่อง)

พนักงานใช้มือถือหน้างาน — หน้า ops ต้อง:
1. **เป้านิ้ว ≥ 44px**: control กลางทุกชนิดสูงอย่างน้อย 44px บนจอ < `sm` และบนอุปกรณ์ `pointer: coarse` ทุกขนาด; desktop ที่ใช้เมาส์กลับเป็น 36px ได้ · แถว/ไอคอนที่กดได้มี hit area ≥ 44×44px
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
| การ์ด · ส่วน · กล่องเด้ง | `RADIUS.surface` = 16px |
| ช่องกรอกทรงเหลี่ยม | `RADIUS.field` = 10px |
| **ปุ่ม · ชิปตัวกรอง · ช่องค้นหา · สวิตช์** | `RADIUS.pill` = มนเต็ม |

**ขนาดตัวอักษร** ใช้บันได 8 ขั้นใน `globals.css` (`text-2xs` … `text-3xl`) — **ห้ามสั่งเป็น px ดิบ มีด่าน lint ดักไว้**
หัวเรื่องหน้า = `PageHeader` (`text-2xl` = 24px · แก้ข้อมูลผิด 2026-08-02: เอกสารเคยเขียน `text-[26px]` ซึ่ง**ด่าน lint ตีตกทันที**ทั้งที่ทำตามเอกสารเป๊ะ) — ทุกหน้าใช้ผ่าน component นี้ **ห้ามเขียน `<h1>` เอง** · หัว section ภายในหน้า = `Section`

## Interaction / navigation / state contract (UX0)

- Sidebar และ Command Palette อ่านจาก navigation registry เดียว: label/icon/href/permission/search aliases/visibility อยู่ที่เดียว · active route ใช้ exact หรือ longest match ห้าม `startsWith` ทื่อจนติดหลายเมนู
- desktop Sidebar แสดงหมวด **ภาพรวม / งานขาย / การผลิต / สินค้า / การเงิน / ระบบ** ที่ผู้ใช้มีสิทธิ์ตลอดและเลื่อนภายในเอง · ห้ามซ่อนเมนูหลัง disclosure “เมนูทั้งหมด”; mobile คง bottom navigation 4 งานหลัก + “เพิ่มเติม”
- list state ที่แชร์/ย้อนกลับได้อยู่ใน URL: `q`, `status`, `sort`, `page` + filter เฉพาะหน้า · Orders รองรับ `attention=overdue|due-soon|stuck`
- query ต้องแยก loading/error/empty ชัดเจน; error มี retry และ live announcement · ห้ามแสดง error เป็น “ไม่มีข้อมูล”
- dialog/sheet ต้องมี viewport gutter, `max-height`, body scroll, Escape, focus trap และคืน focus ให้ trigger
- action สำคัญห้ามพึ่ง hover; ปุ่มลบ/แก้ต้องมองเห็นและแตะได้บน coarse pointer
- public token pages บังคับ light theme เพื่อให้เอกสารลูกค้าอ่านได้แน่นอน แม้เครื่องตั้ง system dark
- animation ต้องเคารพ `prefers-reduced-motion`; ทุกหน้าหลังบ้านมี skip link ไป `<main id="main-content">`

## Canonical factory operations (`/production*`, `/outsource`, `/factory*`)

> งานโรงงานเป็นโมดูลเดียวที่ใช้ record, permission, readiness และ transition ฝั่ง server ชุดเดียวกัน แต่แยกคำถามตามจอ:
> หัวหน้าตัดสินลำดับที่ `/production`, พนักงานลงมือที่ `/factory/station` และทั้งโรงงานดู pulse แบบอ่านอย่างเดียวที่ `/factory` ·
> presentation ห้ามสร้าง controller, lifecycle หรือข้อมูลตัวอย่างอีกชุด

### Route, shell และ local navigation contract

| Route | Shell | หน้าที่ของจอ |
|---|---|---|
| `/production` | shared dashboard `AppShell` | worklist แบบ exception-first หนึ่งออเดอร์ต่อหนึ่งแถว สำหรับตอบว่า “งานไหนต้องจัดการก่อน” |
| `/production/[id]` | shared dashboard `AppShell` | job traveler แบบ process bar: เลือกดูทีละขั้นโดย selector ไม่เปลี่ยนสถานะ; action/blocker/spec อยู่ใน panel ของขั้นนั้น |
| `/production/print-runs` | shared dashboard `AppShell` | workspace รอบ DTF ตามลำดับ **กำลังพิมพ์ → ตัดแยก/ติดป้าย → คิวพิมพ์ → ประวัติ 7 วัน** |
| `/production/films` | shared dashboard `AppShell` | คลังฟิล์มแบบ compact: ลาย/ลูกค้า, ต้นทาง, คงเหลือ และการหยิบใช้ |
| `/outsource` | shared dashboard `AppShell` | คิวส่งร้าน/รับกลับ/**ตรวจรับจากร้าน**/ประวัติ; การตรวจรับนี้มาก่อน QC ขั้นสุดท้ายของออเดอร์ |
| `/factory/station` | full-screen Dark; ไม่มี ERP sidebar/top bar | เลือกหนึ่งใน 5 สถานี แล้วลงมือเฉพาะ action ของสถานีและสถานะปัจจุบัน |
| `/factory` | full-screen Dark TV | pulse 5 ด่านแบบ read-only หนึ่ง viewport; ไม่มี action หรือ mutation path |

- สี่หน้ารวม/พื้นที่หัวหน้าใน `AppShell` ใช้ `ProductionModuleNav` ชุดเดียวและลำดับเดียว: **คิวผลิต / รอบพิมพ์ DTF / คลังฟิล์ม / งานร้านนอก**; ทางเข้าเสริม **โหมดสถานี / จอโรงงาน** อยู่ท้ายแถบและไม่สร้าง sidebar ฝ่ายผลิตอีกชุด · ใบผลิต `/production/[id]` ไม่วาด local nav หรือ breadcrumb ซ้ำ เพราะเป็นบริบทลงมือที่มีทางกลับคิวเพียงจุดเดียว
- `/production` ใช้ `production.kanban` กับ `user.me`; filter `ทั้งหมด`, `ต้องจัดการ`, `กำลังผลิต`, `รอ QC`, `แพ็ก / พร้อมส่ง`, จำนวน, search และ sort derive จาก board ชุดเดียว โดยเก็บ `view`, `q`, `sort` ใน URL
- worklist เรียง exception ก่อนและไม่ทำให้ออเดอร์ผสมซ้ำหลายแถว; แถวเปิดปลายทางจริงตามสถานะ: ใบผลิต, หน้าออเดอร์แท็บผลิต/QC, หน้า delivery หรือ dialog เปิดใบผลิตตามสิทธิ์
- `/production/[id]` ฝั่ง ERP เป็น **Job Jacket** ที่หลุดจาก PageHeader/card stack ปกติ: แถบตัวตนงานสี graphite ต่อด้วย route ribbon แล้วให้ขั้นที่เลือกกลายเป็น operation canvas ทั้งหน้า · รางมาจาก workflow จริง, ขั้นเสร็จเป็น check, ขั้นอื่นเป็นเลขและชื่อใต้ node; workflow tone ต้องแยกจาก selection ring และรองรับหลาย current โดยไม่เปลี่ยนสถานะเมื่อกดดู · canvas มี blocker/จำนวน/primary action จาก `selectNowSteps` เดิมเพียงจุดเดียว ส่วนข้อมูลแบบแสดงใน reference sidecar เฉพาะขั้นและซ้อนเป็นคอลัมน์เดียวก่อน `xl` · `GARMENT_PICK` ใช้การ์ดเบิกจริงเพียงจุดเดียวและห้าม generic complete · เสื้อ/วัตถุดิบระดับทั้งใบกับเส้นทางทั้งหมดอยู่ใน inspector แบบ drawer/bottom sheet; query เก่า `?tab=inventory|history` ต้องเปิด inspector ที่ตรงกัน · Station reuse controller/mutation เดียวกันแต่คง PageHeader/summary/หน้าเส้นตรงเดิม และไม่ mount Job Jacket, inspector หรือ MaterialUsage ของ ERP
- `/production/print-runs` คงลำดับ DOM ตามงานจริง: พิมพ์ก่อน ตัดแยก+ติดป้าย ถัดมาคิว และประวัติท้ายหน้า; desktop เป็น workspace สองฝั่ง ส่วนจอแคบเรียงตาม DOM เดิม
- `/production/print-runs` ใช้ Sidebar + `ProductionModuleNav` เป็นลำดับชั้นนำทางอยู่แล้ว จึงไม่วาด breadcrumb ซ้ำเหนือชื่อหน้า
- `/production/films` เป็น inventory หนาแน่นพอดี ไม่ใช้สถิติ hero; `/outsource` เรียงคิวรับกลับตามกำหนดและเรียก `QC_*` เดิมใน data layer ว่า “ตรวจรับ” ใน UI เพื่อไม่ให้สับสนกับ final QC หลัง production

### Station work center และ flow

สถานีมี 5 ค่าแบบล็อก ไม่สร้าง lane ตามข้อมูลหน้างานเอง:

| Station | งานที่รับผิดชอบ |
|---|---|
| `prep` — เตรียมเสื้อ | `GARMENT_PICK` / `GARMENT_RECEIVE` |
| `dtf-print` — พิมพ์ DTF | คิวและรอบพิมพ์ DTF |
| `heat-press` — รีดร้อน | `HEAT_PRESS` หลังผ่าน readiness gate |
| `qc` — ตรวจคุณภาพ | ตรวจจำนวนดีหลัง production จบ |
| `final-pack` — แพ็คสุดท้าย | บันทึกหลักฐานจัดส่งและปิดจำนวนก่อนพร้อมส่ง |

- หน้าแรกของ Station มีตัวเลือก 5 สถานีเพียงชุดเดียว; เมื่อเลือกแล้วเก็บ `station` ใน URL และ first viewport เรียง **กำลังทำ → คิวพร้อมทำ → scan/search แบบ compact** (`dtf-print` ใช้ workspace รอบพิมพ์แทนคิวทั่วไป)
- การสแกนรับเลขออเดอร์ตรงหรือ QR ต้นทาง ERP แล้ว **เปิดบริบทเท่านั้น**; ห้าม claim, เริ่ม, จบ, แพ็ก หรือเปลี่ยนสถานะอัตโนมัติ และเมื่อออเดอร์มีหลาย production ต้องให้ผู้ใช้เลือก record เอง
- คิว Station แสดงเฉพาะงาน active/ready ของสถานี เรียงกำหนดส่งแล้วตาม priority; งานที่ gate ยัง block ต้องไม่หลุดเข้า actionable queue · ใบงาน Station แสดงเฉพาะบริบทและ action ของสถานีปัจจุบัน
- ลำดับหลังผลิตที่ยอมรับมีชุดเดียว: **production → QC → final pack → ready**; การตรวจรับของร้านนอกอยู่ก่อน final QC · `PACKAGING` เป็น compatibility ของข้อมูลเก่าเท่านั้น ห้ามสร้างเป็น `ProductionStep` ใหม่ และ recovery ต้องส่งกลับเข้า QC
- `/factory` เรียง pulse 5 ด่าน **เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็กสุดท้าย** พร้อม active/queue/next, rail ด่วน/ติดปัญหา และผลลัพธ์พร้อมส่ง; QC กับแพ็กต้องเป็นคนละด่านเสมอ
- กฎ due sort, readiness, `evaluateHeatPressGate`, จำนวนที่ทำได้ และ status transition เป็น source of truth ฝั่ง server ห้ามหน้า UI คำนวณกฎธุรกิจคู่ขนาน

### Desktop/touch, permission, cache, error และ no-money contract

- composition ตั้งต้นที่ desktop `1440×900` และจอทัช `1024×768`; `390px` เป็น regression guard ที่ยังต้องใช้ flow ได้ครบและไม่เลื่อนแนวนอน · control บน mobile/`pointer: coarse` ≥44×44px ส่วน fine-pointer desktop ใช้ density 36px ได้
- ทุก `/factory*` ต้องมี session และทุก query เป็น protected procedure; mutation control ต้อง **fail closed** จนรู้ permission และ server guard เป็นด่านสุดท้ายเสมอ
- ไม่มี `manage_production` = Station/print run/film เป็น read-only; `supervise_operations` จึงเห็นงานข้ามผู้รับผิดชอบ และการตัดสินตรวจรับร้านนอกต้องมีทั้ง `manage_production` + `supervise_operations`; final pack ที่สร้าง delivery ต้องมี `manage_production` + `manage_delivery` และการเปลี่ยนเป็นพร้อมส่งต้องมี `update_order_status_production` เพิ่ม
- live queue (`/production`, print runs, Station และ TV) poll ทุก 30 วินาทีตามจอที่กำหนดและ refetch เมื่อ focus/reconnect; initial loading, initial error+retry, empty, blocked และ read-only ต้องแยกกัน · background error ต้องคง cached data พร้อมคำเตือนแทนการล้างจอ
- TV เตือน stale เมื่อไม่ได้ refresh สำเร็จเกิน 2 นาทีและคง snapshot ล่าสุด; pending action ใช้ข้อความ “กำลัง…” + `aria-busy`, error/retry มี label ที่อ่านได้ และ focus/keyboard/reduced-motion ไม่พึ่ง hover
- worklist, print run, film และ outsource ไม่เพิ่มราคา/ยอดออเดอร์/ค่าจ้าง; job traveler ERP แสดงต้นทุนวัตถุดิบได้เฉพาะ `see_finance` ตาม component เดิม · Station/TV ต้องไม่ขนส่งหรือ render เงินแม้ role เป็น OWNER, ไม่ mount `MaterialUsage` และ final pack ไม่ส่ง shipping cost มาที่ client

## ลิสต์หนี้ UI เก่า

`npm run lint` — warning ที่เหลือ (react-hooks compiler/no-img/unused) คือหน้าเก่าที่รอ
รอบเก็บตกปลาย P1 · แตะหน้าไหนเก็บหน้านั้น (boy-scout) · ห้ามเพิ่ม warning ใหม่
