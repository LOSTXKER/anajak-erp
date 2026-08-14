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
| การ์ด · ส่วน · กล่องเด้ง | `RADIUS.surface` = 16px |
| ช่องกรอกทรงเหลี่ยม | `RADIUS.field` = 10px |
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

## Prototype world — ERP Command Center (/redesign)

> **ขอบเขต ณ 2026-08-14:** world นี้ ship แล้วเฉพาะต้นแบบหลัง login ที่ `/redesign` และ Order Workbench ที่ `/redesign/orders/[id]` · เป็น shell/composition ใหม่เพื่อทดลองกับข้อมูลจริง แต่ `/orders/[id]` และ route เดิมยังเป็น canonical · **ไม่ใช่สิทธิ์ให้ restyle public, print, factory หรือทุก canonical route** และไม่ทับกฎ P1.0 ด้าน accessibility, state, permission และ business invariant ด้านบน

### การเลื่อนขึ้นเป็นระบบหลัก

- promote ได้ทีละ surface เมื่อมีใบงานใน `ROADMAP.md` และเบสเคาะจาก render จริงแล้วเท่านั้น; จนกว่าจะมีมตินั้น `/redesign` ต้องอยู่แยกและมีทางกลับระบบหลัก
- ตอน promote ให้ย้าย topology/interaction ที่พิสูจน์แล้วพร้อม auth, permission, navigation registry, query และ URL จริง · ห้ามคัดเฉพาะหน้าตาแล้วสร้างข้อมูลหรือกฎธุรกิจชุดที่สอง
- token ชุดนี้ scope ใต้ `.redesign-shell`; ห้ามย้ายเข้า `globals.css` หรือแทน semantic token P1.0 เงียบ ๆ · การยกเป็น token กลางต้องมีใบงาน design-system และตรวจ Light/Dark + route ที่ได้รับผลครบก่อน

### World และ token เฉพาะต้นแบบ

**North star:** สายการผลิตสดบนกริดแบบ Swiss industrial manual — Anajak cobalt + กระดาษใบงาน + เส้น blueprint + หมึกเข้ม · seed key `953c4cb7` · ใช้ฟอนต์ Prompt และไอคอนเส้นเดิม

| บทบาท | Light | Dark |
|---|---|---|
| brand / top bar | `#3973b2` | `#3973b2` |
| brand deep | `#305f93` | `#305f93` |
| workspace (`--redesign-canvas`) | `#f4f7fa` | `#151b21` |
| work paper (`--redesign-paper`) | `#fff` | `#202a34` |
| ink / muted | `#13202c` / `#5b6572` | `#f5f7fa` / `#a4adb7` |
| blueprint rule / strong | `#dbe4ec` / `#bccbd8` | `#304253` / `#49647c` |
| sunk surface | `#edf2f7` | `#1a242e` |
| hover / pressed | `#eaf0f5` / `#dce7f0` | `#293847` / `#32485a` |

พื้นผิวเป็นกระดาษเกือบแบน มีเงาตกลงเบา ๆ; control/item โค้ง 8px และ sheet 12px · เส้นโครง 1px, rail ที่ผ่านแล้ว 2px · **ห้าม gradient, glow, hero card หรือเส้นหนาตกแต่ง** · Dark คือกระดาษทำงาน blue-charcoal กับกฎ cobalt; Light คงกระดาษขาว

### Topology ที่ ship

- shell ใช้ top bar cobalt สูง 64px + sidebar 256px บน desktop; mobile ใช้ bottom nav คงที่ 5 จุด (`แดชบอร์ด`, `งานของฉัน`, `ออเดอร์`, `การผลิต`, `ทั้งหมด`) ตามรายการและสิทธิ์จาก navigation registry เดิม
- macro flow มี 7 ช่วง: **รับงาน → อาร์ตเวิร์ก → ความพร้อม → DTF ภายใน → งานร้านนอก → QC / แพ็ค → ส่ง / ปิด** · DTF กับร้านนอกเป็น alternate lanes; งานผสมติดทั้งสองเลน
- desktop (`xl` ขึ้นไป): Flow Matrix เป็นพระเอก มี recent order **5 แถวเต็ม** พร้อม legend และ capacity strip; exception docket อยู่ข้างกันใน first viewport
- mobile: เรียง **ข้อยกเว้น → สรุปจำนวน 7 ช่วง → การ์ดออเดอร์ล่าสุด** · ห้ามย่อ desktop matrix ลงมือถือ

### Order Workbench — surface extension ที่ ship

- แถวออเดอร์ใน Command Center เปิด `/redesign/orders/[id]`; หน้านี้เป็น decision cockpit แบบ read-only ส่วน `/orders/[id]` ยังเป็น source of truth ของ controller, mutation และงานเชิงลึกทั้งหมด
- desktop เรียง **action docket + dispatch facts → lifecycle 7 ช่วง → work brief + operation snapshots**; mobile เรียง **identity → action → warnings → facts → lifecycle → brief → snapshots** และไม่ใช้แท็บแนวนอน
- ใช้ `order.getById`, `user.me`, `production.orderContext` แบบมีเงื่อนไข และ `billing.listByOrder` แบบมีเงื่อนไขผ่าน pure view model; ขั้นถัดไปอิง `getOrderNextStep` กับ `order-tabs` เดิม และทุก deep action กลับ canonical route โดยไม่สร้าง status mutation ซ้ำ
- เป้าหมายการผลิตเจาะ record เมื่อไม่กำกวมเท่านั้น: มี active production หนึ่งรายการ หรือทั้งออเดอร์มีใบผลิตเดียว; กรณีอื่นกลับ canonical production tab เพื่อไม่เดาผิด
- ข้อมูลเงิน fail closed: โหลดและแสดงเฉพาะ `see_order_money`; สรุปบิลคำนวณจาก `billing.listByOrder` รวม adjustment เท่านั้น, payment detail ใน readiness ถูก sanitize ฝั่ง server สำหรับคนไม่มีสิทธิ์ และออเดอร์ `SHIPPED` ของคนไม่มีสิทธิ์ใช้คำแนะนำทั่วไปโดยไม่เผยข้อมูลเงิน
- แยก loading, not found, error+retry และ empty จริง; mobile target ขั้นต่ำ 44px, มี `<h1>`, ordered lifecycle พร้อม `aria-current`, และตรวจทั้ง Light/Dark โดยไม่ล้นแนวนอน
- หลักฐาน: `.impeccable/review/order-workbench-desktop.png` และ `.impeccable/review/order-workbench-mobile.png`; ผ่าน typecheck, targeted lint, 73 files / 711 tests, `verify:ui`, detector ว่าง, production build และ browser desktop/mobile Light + mobile Dark โดยไม่มี console/hydration error · final reviewer รอบแรก HOLD พบ 2 P1 + 1 P2, แก้แล้วรอบยืนยัน **SHIP · remaining clear**

### Interaction และ data truth

- แถว matrix ใช้ hover และ `focus-within` ช่วยอ่าน rail ทั้งเส้น; ผ่านแล้ว = cobalt check+เส้น, ปัจจุบัน = วงขอบ+จุด, ยังไม่ถึง = วงเปล่า, ไม่เกี่ยว = วงเส้นประพร้อมขีดลบ, พัก/ระบุไม่ได้ = วงเส้นประเปล่า · motion ปิดเมื่อผู้ใช้เลือก reduced motion
- ออเดอร์, ข้อยกเว้น, ค้นหา, CTA และ drill-through ทุกจุดเปิด record/route จริง · loading, error+retry, empty และกรณีไม่มีสิทธิ์ต้องแยกกัน
- แหล่งข้อมูลมีเฉพาะ `analytics.dashboard`, `analytics.ownerPulse`, `user.me`, navigation registry, `buildDashboardAttentionItems` และ status/permission helper เดิม · เงิน เมนู และ owner pulse ต้อง fail closed ตามสิทธิ์
- เว็บ custom-print แบบ self-serve ในอนาคตเป็นเพียง source ของออเดอร์เข้าสายงานเดียวกัน ไม่ใช่หลังบ้านอีกชุด · **ห้ามมี source badge ฝั่งผู้ใช้จนกว่าจะมี field/API จริง**

### ห้ามคัดจาก comp/ต้นแบบไปใช้ตรง ๆ

- ห้ามใช้โลโก้ตัว A ใน comp; brand ที่ ship ใช้ Printer mark + wordmark “Anajak ERP” เดิม
- ห้ามคัดข้อมูลตัวอย่าง ตัวเลข ชื่อลูกค้า จำนวนแถว หรือ source badge จากภาพ comp
- ห้ามคัด matrix ไปมือถือ, สร้าง dashboard การ์ดทั่วไปแทน flow, หรือเปิด POD back office แยก
- ห้ามนำ palette/shell นี้ไปครอบ public, print, factory หรือ canonical route ก่อนผ่านกติกา promotion ข้างต้น

## ลิสต์หนี้ UI เก่า

`npm run lint` — warning ที่เหลือ (react-hooks compiler/no-img/unused) คือหน้าเก่าที่รอ
รอบเก็บตกปลาย P1 · แตะหน้าไหนเก็บหน้านั้น (boy-scout) · ห้ามเพิ่ม warning ใหม่
