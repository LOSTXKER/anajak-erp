# มาตรฐาน UI Anajak ERP (P1.0)

## Visual identity contract — Vercel Panel System (2026-08-23)

- ทุก `PageHeader` มาตรฐานมี module marker จาก Lucide แบบเส้น neutral ขนาดเล็ก โดยไม่มีพื้น กรอบ เงา หรือสีประจำหมวด; `<h1>` ต้องมีข้อความจริงเพียงชุดเดียวและ marker เป็นของตกแต่งที่ `aria-hidden` พร้อมชื่อหน้าเดิมเป็น accessible name
- ความแตกต่างของโมดูลมาจาก icon, scale, composition, ภาพงานจริง และลำดับข้อมูล ไม่ใช้สีเป็นโครงหน้า; น้ำเงิน Anajak สงวนให้ primary action, link และ focus ส่วน active navigation ใช้ neutral fill และสีสถานะใช้เฉพาะความหมายจริง
- registry table/list ใช้ข้อความเป็นหลักและไม่วาด object icon หรือ initials ซ้ำกับชื่อ; รายการออเดอร์ใช้เฉพาะม็อกอัพจริงล่าสุด และเว้นว่างเมื่อไม่มีรูปโดยไม่ถอยไปใช้ artwork, initials หรือ placeholder icon; ช่องจำนวน เงิน วันที่ และสถานะไม่ต้องมี icon
- ทุก `PageHeader`/`PageShell` มี `description` สั้นหนึ่งประโยคใต้หัวข้อโดยอัตโนมัติจาก `pageDescriptionForLabel`; หน้าเฉพาะ override ได้เมื่อบริบทต่างกัน · `description` บอกว่าหน้านี้ใช้ทำอะไร, `meta` เป็นข้อเท็จจริงเฉพาะรายการ/สถานะ และ `help` ใช้เฉพาะสูตร กติกา หรือรายละเอียดเสริมที่ยาว · `Section` ไม่รับ `description` เพื่อไม่ให้ทุกกล่องมีข้อความซ้ำจนรก
- `HelpTip` ใช้ Radix Popover เปิดด้วย click/tap/Enter/Space ปิดด้วย Escape/คลิกนอกและคืน focus; เนื้อหาไม่เกิน 2–3 ประโยค ส่วน error, validation, permission denial, blocker, กฎหมาย และผลกระทบจาก action ต้องเห็นตรงหน้า
- `ContextPanel` ใช้กับคำอธิบายสำคัญที่ต้องเห็นค้างและไม่มี live-region role; error/warning/success ที่เกิดตาม state ยังใช้ `Alert`/`QueryError` เดิม
- `Alert`, `ContextPanel`, `AddCard`, mobile record และพื้นที่ loading ใช้ panel geometry เดียวกันคือมุม 8px ขอบ semantic และไม่มีเงาตกแต่ง; ห้ามสร้าง visual island มุม 12–16px แทรกใน panel 8px
- Production control/detail และ Station ใช้ panel geometry เดียวกับหลังบ้าน แม้ Station จะคงเป้ากดใหญ่และลำดับ current/ready/blocked; status pill, switch และ overlay ที่ลอยจริงเป็นข้อยกเว้นตามหน้าที่ ไม่ใช่รูปทรงเริ่มต้น
- Factory TV ใช้ geometry 8px ชุดเดียวกับ Production/Station แม้คง dark-first และ density สำหรับจอแขวน · dialog หลังบ้านใช้ overlay กลาง แต่ panel/summary/list ภายในกลับเป็น 8px + semantic token; Product Picker ใช้ `FilterChip` ข้อความ+เส้นใต้เหมือนตัวกรองอื่น
- dialog แบบ conditional mount เก็บ element ที่เปิดไว้ใน `DialogContent` กลางและคืน focus เมื่อปิด/Escape; caller ไม่ต้องสร้าง focus recovery ซ้ำ เว้นแต่ workflow มี target เฉพาะที่ชัดกว่า
- Public token ใช้ masthead กลางและรักษา blind-ship; print ใช้ `DocHeader` กลาง มีตราประเภทเอกสารที่ขาวดำยังแยกได้ และไม่เปลี่ยน contract ข้อมูล/กฎหมาย/ยอดรวม
- ห้ามแสดงคำสั่ง CLI, ชื่อ environment หรือศัพท์ implementation ต่อผู้ใช้ เช่น `npm run ...` และ `demo-local`; ใช้คำงานจริง เช่น “ข้อมูลสำหรับทดลอง” และ “คืนข้อมูลตัวอย่าง”

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

Vercel Panel System ใช้ workspace เป็นฉากหลังและ panel เป็นขอบเขตข้อมูล: Light workspace off-white `#fafafa`
กับ chrome/panel ขาว; Dark workspace ดำ `#000` กับ panel `#0a0a0a` · `Section` ที่มีขอบและ `DataTable`
รวมเนื้อหาที่สัมพันธ์กันใน panel เส้น 1px มุม 8px โดยไม่มีเงาตกแต่ง · menu/dialog เป็นชั้นลอยสูงสุด ·
น้ำเงิน Anajak `#3973b2` สงวนให้ primary, link และ focus; active navigation ใช้ neutral fill

| บทบาท | Light | Dark | utility |
|---|---|---|---|
| พื้น workspace/fallback หลังบ้าน | `#fafafa` | `#000` | `.app-workspace` + `bg-bg` |
| navbar/sidebar | `#fff` | `#000` | `bg-chrome` |
| panel/card | `#fff` + ขอบ `#e5e5e5` | `#0a0a0a` + ขอบ `#2e2e2e` | `bg-surface` / `card-surface` |
| menu/dialog | `#fff` | `#171717` | `bg-surface-elevated` / `overlay-surface` |
| กล่องจมเชิงโครงสร้าง/disabled/หัวตาราง | `#fafafa` | `#111` | `bg-surface-muted` / `SUNK_PANEL` / `TABLE_HEAD_SURFACE` |
| ช่องกรอก | `#fff` + ขอบ `#d4d4d4` | `#0a0a0a` + ขอบ `#3a3a3a` | `FIELD_SURFACE` |
| พื้นที่เพิ่ม/อัปโหลด | ขอบประ `slate-300` | ขอบประ `slate-700` | `DASHED` / `DASHED_INTERACTIVE` — resting เบา; hover/focus ค่อยเน้น |
| control บน toolbar | ขาว + ขอบบาง | panel dark + ขอบบาง | prop `surface="raised"` → `RAISED_CONTROL_SURFACE` |
| ปุ่มรอง | ขาว + ขอบบาง | panel dark + ขอบบาง | `Button outline/secondary/subtle` |
| ขอบทั่วไป / เส้นคั่น | `#e5e5e5` / `#ededed` | `#2e2e2e` / `#262626` | `border-border` / `border-divider` |
| Hover | `#f3f3f3` | `#1a1a1a` | `bg-interactive-hover` / `INTERACTIVE_HOVER` |
| Pressed | `#ebebeb` | `#242424` | `bg-interactive-pressed` / `INTERACTIVE_PRESSED` |
| Hover บน navbar/sidebar | `#ebebeb` | `#1a1a1a` | `bg-interactive-chrome-hover` / `INTERACTIVE_CHROME_HOVER` |
| Pressed บน navbar/sidebar | `#e1e1e1` | `#242424` | `bg-interactive-chrome-pressed` / `INTERACTIVE_CHROME_PRESSED` |
| Selected | `#d2e4f6` | `#173c61` | `bg-interactive-selected text-interactive-selected-text` |

สีบริบททุกตัวประกาศที่ token กลางและต้องผ่านคู่ `solid/surface/text/border` ทั้ง Light/Dark:

| บริบท | solid | ใช้กับ |
|---|---|---|
| Brand/Sales | `#3973b2` | งานขาย ลูกค้า ออเดอร์ และ CTA/selected/focus ทั้งระบบ |
| Production | `#0f766e` | marker ฝ่ายผลิต work center และร้านนอก |
| Product | `#a66a12` | สินค้า แพทเทิร์น บรรจุภัณฑ์ และบริการ |
| Finance | `#6d5bd0` | บิล ภาษี ลูกหนี้ และรายงาน |
| System | `#59636f` | ตั้งค่า ผู้ใช้ ประวัติ และระบบ |

สีบริบทเป็น cue บน marker/icon/shortcut เท่านั้น; active navigation ยังเป็นน้ำเงิน และ `StatusLabel` ยังใช้ neutral/active/success/warning/danger เดิม เอกสารพิมพ์ไม่รับสีบริบท

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

- navigation, control, menu option, row และ clickable card ใช้ neutral hover/pressed ครอบ hit area จริง; active navigation ใช้ neutral filled row ไม่ใช้แถบน้ำเงิน
- clickable card compose `card-surface-hover` เพื่อเปลี่ยน neutral fill/เส้นขอบโดยไม่ขยับตำแหน่งและไม่มีเงา; ห้ามเขียนสี/เงาซ้ำที่ caller
- ของที่กดได้จริง compose `INTERACTIVE_PRESSED` ให้ตอนกดเข้มกว่า hover; selected/current คงพื้นฟ้า
- ของที่ถูกเลือกใช้ `INTERACTIVE_SELECTED` — ห้ามใช้ hover เป็น selected เพราะความหมายคนละอย่าง
- Primary action ใช้ `blue-600` → hover `blue-700` → pressed `blue-800`; น้ำเงิน 600 ต้องคง `#3973b2`
- Minimal = workspace เป็นฉากเรียบและใช้ panel เฉพาะกลุ่มเนื้อหาที่อ่านเป็นหน่วยเดียว: `Section` ที่มีขอบและ `DataTable` ใช้ `card-surface`; หัว/แถวคั่นด้วย divider · panel ไม่มีเงา · field/toolbar/secondary action ใช้พื้น panel+ขอบบาง · overlay ลอยสูงสุด
- รายการงานในฟอร์มใช้หนึ่ง `card-surface` ต่อหนึ่งรายการโดยตรงบน workspace · ห้ามวาง card ใหญ่ครอบ list แล้วเติม card รอบรายการซ้ำ · CTA “เพิ่มรายการ” อยู่ก่อน list ทั้งหน้าเปิดงานและหน้าแก้ไข
- ช่องกรอกใช้ `FIELD_SURFACE` เสมอ — `border-field-border bg-field` ไม่มีเงา; resting boundary ต้องอยู่ในช่วงที่ guard ล็อกไว้ไม่ให้จางจนกลืนหรือเข้มจนเป็นตาราง · focus/error ใช้เส้น contrast สูงและเปลี่ยนสีเส้นเดิมโดยความสูงไม่ขยับ · ห้าม ancestor เปลี่ยนสี field ตามตำแหน่ง
- กล่องเพิ่มของ/อัปโหลดใช้ `DASHED_INTERACTIVE`; placeholder ที่อ่านอย่างเดียวใช้ `DASHED` — ขอบประตอนพักต้องอ่อนกว่าขอบเน้น เพราะพื้นที่ก้อนใหญ่ขยายน้ำหนักของเส้น; hover/pressed/focus เป็นผู้บอก interaction แทน · ห้ามใช้ `border-strong` เป็น resting state
- `SearchInput`/`Select` ที่อยู่บน `Toolbar` ยังระบุ `surface="raised"` เพื่อ semantic contract แต่หน้าตาเป็น control ขอบบางไร้เงา; ใน form/dialog ระบุ/default `field`; action ในแถวที่ตั้งใจโปร่งใช้ `surface="inline"`
- field และ Button ที่ disabled ใช้ muted fill/text + `shadow-none` โดยไม่ลด opacity ทั้งก้อน เพื่อให้ยังอ่านค่าที่ล็อกอยู่ได้; icon-only/checkbox/switch คง feedback disabled ของ primitive ตัวเอง
- สีสถานะใช้เฉพาะ **blue / red / amber / green** ผ่าน `Badge`, `Alert`, `StatusLabel`, `TINT`
- `slate-*` เป็น compatibility ramp สำหรับ markup เก่า ไม่ใช่ทางหลักของ component ใหม่
- public token บังคับ Light และใช้ masthead neutral แบบไอคอนเส้น ไม่มีแถบสี/icon tile/เงา; panel มุม 8px และสีใช้เฉพาะ primary, focus หรือสถานะจริง
- เอกสารใน `.print-page` ล็อก grayscale + ความกว้าง A4 และ hierarchy เอกสารของตัวเอง ไม่รับหน้าตา dashboard card · preview บนจอคงเงากระดาษ 4px ได้, จอแคบเลื่อนภายใน `.print-viewport`, และ `@media print` ต้องถอดเงา/มุม/พื้นรองออกทั้งหมด

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
| badge อื่น | `ui/badge.tsx` | alias violet/saffron/teal ใช้ได้เมื่อบอกประเภทข้อมูล; สถานะจริงยังใช้ default/accent/success/warning/destructive/outline |
| ว่างเปล่า | `ui/empty-state.tsx` | ทุก list ที่ว่างต้องมี |
| โหลด/พัง | `ui/skeleton.tsx` + `ui/query-error.tsx` | ทุก query หลักของหน้า |
| หัวข้อกลุ่ม/สถิติ | `ui/section.tsx` · `ui/stat-card.tsx` | StatCard รับ `tone`/`href` สำหรับเลขเสี่ยง (ตัวเลขที่ต้องเด่น+กดไปดูได้ — UX4.3) |
| ฟอร์ม | `ui/field.tsx` ครอบ `input\|textarea\|select\|switch` + Zod เมื่อมี validation ซับซ้อน | label/id/required/help/description/error/aria ต้องมาจาก Field · static guidance ใช้ `help`; `description` เหลือเฉพาะ dynamic/actionable ที่ต้องเห็น · **`native-select` ถูกยุบเข้า `ui/select.tsx` แล้ว** ไม่มีไฟล์นั้น |
| คำอธิบายเสริม | `ui/help-tip.tsx` | วางข้างหัวข้อ/label เฉพาะข้อมูลที่ต้องย้อนดู; ห้ามซ่อนคำเตือน กฎหมาย validation หรือผลกระทบจาก action |
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

`Card` มาตรฐานใช้ inset แนวนอน 20px (`px-5`), หัวเริ่มที่ 16px และเว้นถึงเนื้อหา 12–16px, เนื้อหาจบที่ 20px; ใช้ระยะนี้กับ panel หลักก่อน override และห้ามลด/เพิ่มเพียงเพื่อชดเชยมุมหรือเงาของระบบเก่า

**มุมโค้ง — ใช้ `RADIUS` จาก `ui/tokens.ts` เท่านั้น** (แก้ข้อมูลผิด 2026-08-02: เอกสารเคยบอกว่าปุ่ม/ช่องกรอกเป็น 8px ซึ่งไม่ตรงของจริง ทำตามแล้วมุมไม่เท่าหน้าอื่น):

| ของชิ้นไหน | ค่า |
|---|---|
| ชิ้นเล็กในรายการ (ตัวเลือกในเมนู · ปุ่มในแถบสลับ) | `RADIUS.item` = 8px |
| กล่องย่อยในการ์ด · รูปย่อ | `RADIUS.inner` = 8px |
| panel/card · กล่องเด้ง | `RADIUS.surface` = 8px; `Section` ที่มี `bordered` เป็น panel |
| ช่องกรอกทรงเหลี่ยม | `RADIUS.field` = 8px |
| **ปุ่ม / ช่องค้นหา / compatibility `pill`** | 8px |
| **สวิตช์** | `RADIUS.pill` = มนเต็ม |
| **ตัวกรองไม่เกิน 5 ตัวเลือก** | ไม่มีกรอบ/พื้น/radius · ข้อความสี neutral + เส้นใต้สถานะเลือก |

**ขนาดตัวอักษร** ใช้บันได 8 ขั้นใน `globals.css` (`text-2xs` … `text-3xl`) — **ห้ามสั่งเป็น px ดิบ มีด่าน lint ดักไว้**
หัวเรื่องหน้า = `PageHeader` (`text-2xl` = 24px · แก้ข้อมูลผิด 2026-08-02: เอกสารเคยเขียน `text-[26px]` ซึ่ง**ด่าน lint ตีตกทันที**ทั้งที่ทำตามเอกสารเป๊ะ) — ทุกหน้าใช้ผ่าน component นี้ **ห้ามเขียน `<h1>` เอง** · หัว section ภายในหน้า = `Section`

## Interaction / navigation / state contract (UX0)

- Sidebar และ Command Palette อ่านจาก navigation registry เดียว: label/icon/href/permission/search aliases/visibility อยู่ที่เดียว · active route ใช้ exact หรือ longest match ห้าม `startsWith` ทื่อจนติดหลายเมนู
- desktop Sidebar กว้าง 240px เป็นโครงแบน: ใช้ชื่อหมวดตัวเล็กกับระยะห่างเท่านั้น ไม่มีพื้นครอบหมวด ไม่มี marker สี และใช้น้ำเงิน Anajak เฉพาะ active item · แสดงหมวด **ภาพรวม / งานขาย / การผลิต / สินค้า / การเงิน / ระบบ** ที่ผู้ใช้มีสิทธิ์ตลอดและเลื่อนภายในเอง · ห้ามซ่อนเมนูหลัง disclosure “เมนูทั้งหมด”; mobile คง bottom navigation 4 งานหลัก + “เพิ่มเติม”
- list state ที่แชร์/ย้อนกลับได้อยู่ใน URL: `q`, `status`, `sort`, `page` + filter เฉพาะหน้า · Orders รองรับ `attention=overdue|due-soon|stuck`
- query ต้องแยก loading/error/empty ชัดเจน; error มี retry และ live announcement · ห้ามแสดง error เป็น “ไม่มีข้อมูล”
- dialog/sheet ต้องมี viewport gutter, `max-height`, body scroll, Escape, focus trap และคืน focus ให้ trigger
- action สำคัญห้ามพึ่ง hover; ปุ่มลบ/แก้ต้องมองเห็นและแตะได้บน coarse pointer
- public token pages บังคับ light theme เพื่อให้เอกสารลูกค้าอ่านได้แน่นอน แม้เครื่องตั้ง system dark
- animation ต้องเคารพ `prefers-reduced-motion`; ทุกหน้าหลังบ้านมี skip link ไป `<main id="main-content">`

## ม็อกอัพของออเดอร์ — บ้านเดียว ใช้ร่วมทุกจอ (2026-08-22)

> "ม็อกอัพ" = ไฟล์ชั้น 2 (APPROVAL) ตาม `src/lib/file-layers.ts` เก็บใน `DesignVersion`
> **หนึ่งเวอร์ชัน = หลายรูป** (`DesignVersionFile` — หน้า/หลัง/แขน) ลูกค้าอนุมัติทั้งชุดครั้งเดียว
> ไม่เปลี่ยนชื่อตาราง `design_versions` โดยตั้งใจ: audit log, token ที่ส่งลูกค้าไปแล้ว และ migration
> เดิมอ้างชื่อนี้อยู่ · เปลี่ยนเฉพาะคำที่หน้าจอเรียก

- ทุกจอที่แสดงม็อกอัพต้องเรียก `src/components/mockup/` ชุดเดียว — `MockupPanel` (จัดการเต็ม) ·
  `MockupGallery` (อ่านอย่างเดียว) · `MockupThumbnail` (รูปปกในแถวรายการ) · `OrderMockupHandoff` (แถบสรุปพาไปบ้านจริง)
  **ห้ามสร้างตัวที่สอง** — ก่อนหน้านี้หน้าออเดอร์มีสองชุด ยิง `design.listByOrder` ซ้ำ และคนอ่านไม่รู้ว่าอันไหนของจริง
- `MockupThumbnail` ไม่มีรูปให้แสดงช่องว่างขอบประ + `ImageOff` อย่างสงบในขนาดเดิม ทั้งหน้าออเดอร์และคิวผลิต · ห้ามเว้นพื้นที่ล่องหนหรือเปลี่ยนเป็น object icon/initials เพราะคนต้องแยก “ยังไม่มีม็อกอัพ” ออกจาก “มีรูปแล้ว” ได้ทันที
- สูตรอ่านม็อกอัพอยู่ที่ `src/lib/mockup.ts` ที่เดียว (`mockupImages` / `mockupCoverImage` / `orderMockupCover`)
  ห้ามจอไหนคำนวณเอง · `files` ว่าง = เวอร์ชันก่อน migration ต้องถอยไปใช้ `fileUrl` เป็นรูปปกเสมอ ไม่ backfill
- **บ้านของม็อกอัพคือหน้าออเดอร์แท็บ `ม็อกอัพ & ไฟล์`** เท่านั้น — จัดเรียงตามชั้นไฟล์: ชั้น 2 ม็อกอัพ (บนสุด
  เพราะเป็นของที่คนเปิดแท็บนี้มาหา) แล้วค่อยชั้น 1 ไฟล์ดิบลูกค้า และชั้น 3 ไฟล์พิมพ์ในการ์ด "ไฟล์อื่นของออเดอร์"
- แท็บ `งานผลิต` และ `/production/[id]` **อ่านอย่างเดียว** — ห้ามมีปุ่มอัป/อนุมัติ/สร้างลิงก์ลูกค้าซ้ำ
  (`MockupPanel readOnly` ตัดทั้งปุ่มและก้อนค่าแก้แบบออกทั้งหมด — no-money contract)
- ไฟล์ที่เบราว์เซอร์แสดงไม่ได้ (`.ai/.psd/.pdf`) **ต้องแนบรูปตัวอย่างก่อนส่งลูกค้า** — บังคับที่ dialog อัป
  (`canSubmitMockupSet`) ไม่ใช่ปล่อยให้ลูกค้าตัดสินทั้งที่มองไม่เห็นแบบ
- ทุกรูปในชุดต้องติด approval token ผ่าน `withFileToken` และ `/api/files` ต้องอนุญาตครบทั้งชุด —
  allowlist **กว้างเท่าที่หน้าโชว์ ไม่กว้างกว่านั้น** (ลิงก์สถานะกับใบงานร้านนอกยังโชว์แค่รูปปก จึงไม่ขยาย)
- จอสถานีแสดงม็อกอัพเป็น **ข้อมูลอ้างอิงรอง** ต่อจากจุดงาน และต้องคงข้อความ `ห้ามวางตำแหน่งจากภาพนี้`
  (ขนาด/จุดวางยึดตัวเลขในใบงานเสมอ — `verify:ui` ล็อกไว้)

## Canonical Production V2 (`PRODUCTION_V2_ENABLED`)

Production V2 ใช้ `manufacturing` read/command contract เป็นแหล่งความจริงเดียว โดยเก็บ `Production` และ `ProductionStep` เป็น Manufacturing Order/Operation Job เพื่อรักษา FK ของข้อมูลเดิม · schema/command source อยู่ที่ `prisma/schema.prisma`, `src/server/services/manufacturing-*.ts` และ `src/server/routers/manufacturing.ts`; UI ห้ามคำนวณ dependency, readiness, permission หรือสถานะถัดไปซ้ำ

### บ้านและเจ้าของงาน

| บ้าน | เจ้าของและสิ่งที่ทำได้ |
|---|---|
| `/production` | หัวหน้า/ออฟฟิศค้นทุกใบผลิต, filter/sort/paginate และเปิดมุม Work Center, Exception, Outsource ภายในหน้าเดียว |
| `/production/[id]` | Control Record สำหรับ identity/due risk/routing snapshot/operation ledger/readiness/quantity/exception/assignment/resequence/audit; ไม่มี execution command ของพนักงาน |
| `/factory/station` | พนักงานเลือก Work Center แล้วทำ current job, ดู approved mockup+quantity, ใช้ primary action เดียว, แจ้งปัญหา และไป same-order handoff |
| `/factory` | TV อ่านอย่างเดียว แสดง WIP/load/late/exception ของ Work Center โดยไม่มี link, button หรือ mutation |
| Order / My Tasks | Order Production tab เหลือ summary+deep link; My Tasks route ตาม role ไป Control Record หรือ exact Station job |
| route legacy | print runs, films และ outsource redirect เข้า `/production`; component เก่า mount ได้เฉพาะเมื่อ flag ปิดใน rollback window |

### Data, command และ state contract

- RoutingVersion ที่ release แล้วแก้ไม่ได้; Manufacturing Order เก็บ routing/instruction/approved mockup snapshot และ operation dependency ที่ผ่าน cycle validation · ทุก lane ต้องมี path มารวมที่ Final Pack เดียวซึ่งเป็น terminal operation
- quantity แยกรายสินค้า/สี/ไซซ์/ตำแหน่งพิมพ์ พร้อม planned/good/scrap/rework; good เท่านั้นปลด successor และทุก reject ต้องมี disposition
- `OperationEvent` เป็น append-only; command ใช้ `commandId` + `expectedRevision` และ transaction/lock order ชุดเดียวเพื่อให้ retry ไม่เพิ่ม quantity, stock หรือ event ซ้ำ
- `availableCommands` และ `blockedReason` มาจาก server ตาม actor/work-center membership/assignment; Station และ Factory DTO ใช้ safe mapper ที่ไม่มีราคา ต้นทุน ค่าจ้างหรือค่าขนส่ง
- Order status เขียนผ่าน transition service จาก release/completion/QC/pack/delivery event; generic `order.updateStatus` ปฏิเสธ production-owned targets เมื่อ flag เปิด และปฏิเสธ hold/cancel/flow target จาก record จริงแม้ปิด flag หากออเดอร์มี V2 Work Order
- เมื่อสร้าง Manufacturing Order แล้ว item/variant/print definition และหลักฐานรับเสื้อบน Order เป็น read-only; writer เก่าต้องตรวจ ownership หลัง topology+order lock เพื่อไม่ให้ snapshot หน้างาน stale
- DTF batch commit ตรวจ full membership+revision แล้วรายงาน film good/scrap/reprint ต่อ quantity line; QC fail สร้าง exact defect/exception/rework target และต้องตรวจซ้ำก่อนเดินต่อ
- Final Pack completion เดิน Order เป็น READY_TO_SHIP เฉพาะเมื่อทุก enabled operation จบแล้ว; Office Delivery เท่านั้นสร้าง shipment/tracking และยืนยันส่งด้วย `ship_orders`
- scan/QR เปิด order context เท่านั้น; handoff เป็น navigation ที่ผู้ใช้ยืนยันเองและไม่ claim/start/complete
- capacity ที่ไม่มี standard time ต้องแสดง “ยังไม่ประเมิน”; ห้ามเดาค่าเพื่อเติม UI

### Visual และ verification contract

- ERP ใช้ light workspace เป็นค่าแนะนำและสีเฉพาะ semantic; Station/TV ใช้ high-contrast dark surface · สถานะต้องมีข้อความ/ไอคอนร่วมกับสี
- Production list ใช้ server-side cursor pagination; mobile เปลี่ยนเป็น scan-first cards, tablet ยอมให้ table container เลื่อนในตัวโดย document ห้าม overflow
- initial loading/error+retry/empty, cached-stale และ success ต้องแยกกัน; refresh/deep link/Back/Escape/focus/reduced-motion ใช้งานได้
- verification source คือ `scripts/verify-ui-tokens.tsx`, test ใกล้ service/router/component, `scripts/verify-production-v2-migration.sql` และ `scripts/verify-manufacturing-v2.ts`; cutover ยังต้องรอ walkthrough ของเบสและห้าม merge main/deploy ก่อนรับงาน

## Legacy factory rollback contract (ใช้เฉพาะเมื่อปิด `PRODUCTION_V2_ENABLED`)

> งานโรงงานเป็นโมดูลเดียวที่ใช้ record, permission, readiness และ transition ฝั่ง server ชุดเดียวกัน แต่แยกคำถามตามจอ:
> หัวหน้าตัดสินลำดับที่ `/production`, พนักงานลงมือที่ `/factory/station` และทั้งโรงงานดู pulse แบบอ่านอย่างเดียวที่ `/factory` ·
> presentation ห้ามสร้าง controller, lifecycle หรือข้อมูลตัวอย่างอีกชุด

### Route, shell และ local navigation contract

| Route | Shell | หน้าที่ของจอ |
|---|---|---|
| `/production` | shared dashboard `AppShell` | worklist แบบ exception-first หนึ่งออเดอร์ต่อหนึ่งแถว สำหรับตอบว่า “งานไหนต้องจัดการก่อน” |
| `/production/[id]` | shared dashboard `AppShell` | exception control record ของหัวหน้า: attention, plan/actual, owner, blocker, readiness, handoff และหลักฐานทั้งใบ; routine execution ไป Station · inspector มีแท็บ **เสื้อและวัตถุดิบ / ม็อกอัพ / เส้นทางทั้งหมด** |
| `/production/print-runs` | shared dashboard `AppShell` | workspace รอบ DTF ตามลำดับ **กำลังพิมพ์ → ตัดแยก/ติดป้าย → คิวพิมพ์ → ประวัติ 7 วัน** |
| `/production/films` | shared dashboard `AppShell` | คลังฟิล์มแบบ compact: ลาย/ลูกค้า, ต้นทาง, คงเหลือ และการหยิบใช้ |
| `/outsource` | shared dashboard `AppShell` | คิวส่งร้าน/รับกลับ/**ตรวจรับจากร้าน**/ประวัติ; การตรวจรับนี้มาก่อน QC ขั้นสุดท้ายของออเดอร์ |
| `/factory/station` | full-screen Dark; ไม่มี ERP sidebar/top bar | เลือกหนึ่งใน 5 สถานี แล้วลงมือเฉพาะ action ของสถานีและสถานะปัจจุบัน |
| `/factory` | full-screen Dark TV | pulse 5 ด่านแบบ read-only หนึ่ง viewport; ไม่มี action หรือ mutation path |

- สี่หน้ารวม/พื้นที่หัวหน้าใน `AppShell` ใช้ `ProductionModuleNav` ชุดเดียวและลำดับเดียว: **คิวผลิต / รอบพิมพ์ DTF / คลังฟิล์ม / งานร้านนอก**; ทางเข้าเสริม **โหมดสถานี / จอโรงงาน** อยู่ท้ายแถบและไม่สร้าง sidebar ฝ่ายผลิตอีกชุด · control record `/production/[id]` มี breadcrumb กลับคิวและ handoff ไป work center ที่เกี่ยวข้อง แต่ไม่เพิ่ม local nav ซ้ำ
- `/production` ใช้ `production.kanban` กับ `user.me`; filter `ทั้งหมด`, `ต้องจัดการ`, `กำลังผลิต`, `รอ QC`, `แพ็ก / พร้อมส่ง`, จำนวน, search และ sort derive จาก board ชุดเดียว โดยเก็บ `view`, `q`, `sort` ใน URL
- `/production` มีสรุปวันนี้ 3 ตัวเลขเหนือชิปตัวกรอง: **เลยกำหนด / ครบกำหนดวันนี้ / กำลังลงมือ** — นับจาก `board.jobs` ทั้งกระดาน **ห้ามนับจากรายการที่กรองแล้ว** ไม่งั้นตัวเลขที่ใช้ตัดสินใจขยับใต้มือทุกครั้งที่เปลี่ยนมุมมอง · ห้ามเพิ่มยอดเงินหรือสถิติรายเดือนในแถบนี้ (หน้านี้ตัดสินลำดับงานวันนี้ ไม่ใช่รายงานผู้บริหาร)
- ทุกแถวคิว (ทั้งตาราง desktop และการ์ดมือถือ) นำหน้าด้วยรูปม็อกอัพผ่าน `MockupThumbnail` + `orderMockupCover` — หัวหน้าจำงานจากภาพเร็วกว่าเลขออเดอร์ · ไม่มีม็อกอัพอนุมัติให้ถอยไปรูปลาย/คลังลาย ไม่มีเลยจึงเป็นกรอบว่าง
- worklist เรียง exception ก่อนและไม่ทำให้ออเดอร์ผสมซ้ำหลายแถว; แถวเปิดปลายทางจริงตามสถานะ: ใบผลิต, หน้าออเดอร์แท็บผลิต/QC, หน้า delivery หรือ dialog เปิดใบผลิตตามสิทธิ์
- `/production/[id]` ฝั่ง ERP เป็น **exception control record**: หัวใบกระชับแสดงสถานะ จำนวน ความคืบหน้า และ deadline; attention แสดงข้อยกเว้นจริงเพียงเรื่องนำ; operation ledger แสดงทุก lane พร้อม actual/owner/blocker; readiness/handoff/activity เป็นข้อมูลรองเพื่อให้หัวหน้าตัดสินใจโดยไม่ทำ routine operation แทนสถานี · ฟิลด์ที่ schema/DTO ยังไม่มี เช่น production owner, per-operation plan/SLA และ audit actor/source ห้ามสร้างข้อมูลตัวอย่างหรือแสดงกรอบ data-gap ของทีมพัฒนาบน default surface: ซ่อนเมื่อไม่ช่วยตัดสินใจ และบอกขอบเขตหลักฐานด้วยภาษาผู้ใช้แบบข้อความรองเมื่อจำเป็น · งานร้านนอกที่ยัง active และเลย `expectedBackAt` ต้องยกเป็น warning attention ก่อน `IN_PROGRESS` ทั่วไป · ปุ่มบน default surface จำกัดที่มอบหมาย/แก้ exception และเปิดบริบท Station; operation ที่ยังไม่มี parity เช่น QC rework ที่ไม่มี target work center หรือ DTF deviation ที่ยังไม่มี event model ต้องเป็น read-only/หนี้ Phase ถัดไป ไม่คืน routine fallback บน ERP · compatibility inventory deep link คงได้เฉพาะ supervisor recovery ที่มี audit และไม่อยู่บน default control surface
- `/factory/station` เป็น **current-job-first execution surface**: งานที่เปิดอยู่เป็นผืนหลักพร้อม operation/จำนวน/spec และ one primary action; rail ขวาที่ 1024px แยกกำลังทำอื่น/พร้อมถัดไป/ติดปัญหาและตัด record ปัจจุบันออก; scan อยู่ใน railเมื่อมี current และอยู่ใต้ queueเมื่อยังไม่ได้เปิดงาน · `GARMENT_PICK` เดินผ่านบริการเบิก/คืน Stock, `GARMENT_RECEIVE` เดินผ่าน Goods Receipt evidence, DTF เดินผ่าน Print Run, QC/Pack ใช้ controller เฉพาะ และ `HEAT_PRESS` คง readiness gate · `แจ้งปัญหา` เป็น semantic command ที่ server derive work center/source จาก step, lock step→production→order, ตรวจ PRODUCING/ownership, บันทึก FAILED+เหตุผล+audit+notification ใน transaction เดียว และไม่รับ station/source จาก client
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

- หน้าแรกของ Station มีตัวเลือก 5 สถานีเพียงชุดเดียว; เมื่อเลือกแล้วเก็บ `station` ใน URL · ยังไม่เปิดงานให้เรียง **กำลังทำ → พร้อมทำ → ติดปัญหา → scan**; เมื่อเปิดงานให้ current job นำและย้ายสรุปคิว/พร้อม/blocked/scan ไป rail (`dtf-print` ใช้ workspace รอบพิมพ์แทนคิวทั่วไป)
- การสแกนรับเลขออเดอร์ตรงหรือ QR ต้นทาง ERP แล้ว **เปิดบริบทเท่านั้น**; ห้าม claim, เริ่ม, จบ, แพ็ก หรือเปลี่ยนสถานะอัตโนมัติ และเมื่อออเดอร์มีหลาย production ต้องให้ผู้ใช้เลือก record เอง
- เมื่อขั้นที่เปิดอยู่จบและหลุดจาก work center เดิม ให้คงออเดอร์เดิมใน main pane แล้วแสดง handoff ที่ผู้ใช้กดยืนยันเอง: เลือก production เดิมก่อน, fallback ไป order เดิมเมื่อ production จบ, current/ready มาก่อน blocked และหลาย lane ต้องมีตัวเลือก ไม่ยุบเหลือคำว่า “ขั้นถัดไป” เดียว · DTF ready ส่งเข้า batch workspace พร้อมโฟกัส queue row เดิม; DTF active คง exact production context · งาน unmapped/CUSTOM/outsource/owner อื่นต้องหยุดพร้อมทางกลับ ERP ไม่เดาสถานี
- handoff ใช้ `factory.stationQueue` เป็นภาพรวมและ `factory.stationQueueContext` เป็น exact no-money snapshot ของ record ที่เปิดอยู่ จึงไม่ติด `take: 200`; เมื่อ mutation ทำให้คิว refresh ต้อง sync exact snapshot แล้วจึงเสนอทางต่อ · navigation ใช้ `replace` เพื่อไม่ให้ Back กลับสถานีที่ปิดแล้ว และห้ามผูก mutation ใหม่กับการเปลี่ยนหน้า
- คิว Station แสดง active/ready/blocked ของสถานี เรียงกำหนดส่งแล้วตาม priority; blocked ต้องอยู่คนละกลุ่มพร้อม `waitingOn` หรือ step note จริงและห้ามหลุดเข้า actionable queue · พนักงานเห็นเฉพาะงานของตน/ยังไม่มอบหมาย ส่วน `supervise_operations` เห็นข้าม owner · ใบงาน Station แสดงเฉพาะบริบทและ action ของสถานีปัจจุบัน
- ลำดับหลังผลิตที่ยอมรับมีชุดเดียว: **production → QC → final pack → ready**; การตรวจรับของร้านนอกอยู่ก่อน final QC · `PACKAGING` เป็น compatibility ของข้อมูลเก่าเท่านั้น ห้ามสร้างเป็น `ProductionStep` ใหม่ และ recovery ต้องส่งกลับเข้า QC
- `/factory` เรียง pulse 5 ด่าน **เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็กสุดท้าย** พร้อม active/queue/next, rail ด่วน/ติดปัญหา และผลลัพธ์พร้อมส่ง; QC กับแพ็กต้องเป็นคนละด่านเสมอ
- กฎ due sort, readiness, `evaluateHeatPressGate`, จำนวนที่ทำได้ และ status transition เป็น source of truth ฝั่ง server ห้ามหน้า UI คำนวณกฎธุรกิจคู่ขนาน

### Desktop/touch, permission, cache, error และ no-money contract

- composition ตั้งต้นที่ desktop `1440×900` และจอทัช `1024×768`; `390px` เป็น regression guard ที่ยังต้องใช้ flow ได้ครบและไม่เลื่อนแนวนอน · control บน mobile/`pointer: coarse` ≥44×44px ส่วน fine-pointer desktop ใช้ density 36px ได้
- ทุก `/factory*` ต้องมี session และทุก query เป็น protected procedure; mutation control ต้อง **fail closed** จนรู้ permission และ server guard เป็นด่านสุดท้ายเสมอ
- ไม่มี `manage_production` = Station/print run/film เป็น read-only; `supervise_operations` จึงเห็นงานข้ามผู้รับผิดชอบ และการตัดสินตรวจรับร้านนอกต้องมีทั้ง `manage_production` + `supervise_operations`; final pack ที่สร้าง delivery ต้องมี `manage_production` + `manage_delivery` และการเปลี่ยนเป็นพร้อมส่งต้องมี `update_order_status_production` เพิ่ม
- live queue (`/production`, print runs, Station และ TV) poll ทุก 30 วินาทีตามจอที่กำหนดและ refetch เมื่อ focus/reconnect; initial loading, initial error+retry, empty, blocked และ read-only ต้องแยกกัน · background error ต้องคง cached data พร้อมคำเตือนแทนการล้างจอ
- TV เตือน stale เมื่อไม่ได้ refresh สำเร็จเกิน 2 นาทีและคง snapshot ล่าสุด; pending action ใช้ข้อความ “กำลัง…” + `aria-busy`, error/retry มี label ที่อ่านได้ และ focus/keyboard/reduced-motion ไม่พึ่ง hover
- worklist, control record, print run, film และ outsource ไม่เพิ่มราคา/ยอดออเดอร์/ค่าจ้าง · Station/TV ต้องไม่ขนส่งหรือ render เงินแม้ role เป็น OWNER, ไม่ mount `MaterialUsage` และ final pack ไม่ส่ง shipping cost มาที่ client; compatibility deep link ของ ERP อาจเปิดข้อมูลวัตถุดิบเดิมได้เฉพาะ `see_finance` แต่ไม่อยู่บน default control surface

## ลิสต์หนี้ UI เก่า

`npm run lint` — warning ที่เหลือ (react-hooks compiler/no-img/unused) คือหน้าเก่าที่รอ
รอบเก็บตกปลาย P1 · แตะหน้าไหนเก็บหน้านั้น (boy-scout) · ห้ามเพิ่ม warning ใหม่
