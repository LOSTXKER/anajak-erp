/**
 * ตรวจสัญญาการใช้งานของ UI: ข้อมูล สิทธิ์ semantics การอ่าน และการเข้าถึง.
 * รัน: npx tsx scripts/verify-ui-tokens.tsx — ไม่ต่อฐานข้อมูล.
 * สี มุม เงา ความหนาแน่น จำนวนกล่อง และตำแหน่งจัดวางเลือกตามงานได้.
 * การจัดวาง/การล้น/focus ที่เกิดจาก interaction ต้องตรวจใน browser ตาม SPEC;
 * static checks นี้ไม่อ้างว่าใช้แทนการลองหน้าจอจริงได้.
 */
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Factory } from "lucide-react";
import Link from "next/link";
import { Select } from "../src/components/ui/select";
import { Input } from "../src/components/ui/input";
import { Textarea } from "../src/components/ui/textarea";
import { DatePicker } from "../src/components/ui/date-picker";
import { DateRangePicker } from "../src/components/ui/date-range-picker";
import { SearchInput } from "../src/components/ui/search-input";
import { FilterPopover } from "../src/components/ui/filter-popover";
import { Button } from "../src/components/ui/button";
import { DataTable } from "../src/components/ui/data-table";
import { FilterChip } from "../src/components/ui/filter-chip";
import { Field } from "../src/components/ui/field";
import { TablePagination } from "../src/components/ui/table-pagination";
import { PageHeader } from "../src/components/page-header";
import { Section } from "../src/components/ui/section";
import { ContextPanel } from "../src/components/ui/context-panel";
import { HelpTip } from "../src/components/ui/help-tip";
import { ListSkeleton, ListPageSkeleton } from "../src/components/ui/page-skeleton";
import { PageShell } from "../src/components/page-shell";

let failed = 0;
let passed = 0;
const globalsSource = readFileSync("src/app/globals.css", "utf8");
const sourceOf = (path: string) => readFileSync(path, "utf8");
const render = (node: React.ReactNode) => renderToStaticMarkup(node);

function assert(name: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}`);
  }
}

function tsxFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsxFilesUnder(path) : name.endsWith(".tsx") ? [path] : [];
  });
}

function withoutSourceComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

type Rgb = [number, number, number];
function colorValues(name: string): string[] {
  return [...globalsSource.matchAll(new RegExp(`--color-${name}:\\s*([^;]+);`, "g"))]
    .map((match) => match[1]!.trim());
}
function hexRgb(value: string): Rgb {
  const hex = value.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`สีไม่ใช่ hex 6 หลัก: ${value}`);
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as Rgb;
}
function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) => Math.round(channel * alpha + background[index]! * (1 - alpha))) as Rgb;
}
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(foreground: Rgb, background: Rgb): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function checkContrast(name: string, foreground: Rgb, background: Rgb, minimum: number) {
  const ratio = contrast(foreground, background);
  if (ratio < minimum) {
    failed++;
    console.log(`❌ ${name}: ${ratio.toFixed(2)}:1 (ต้องอย่างน้อย ${minimum}:1)`);
  } else passed++;
}

// ตรวจค่าที่ render หลัง cn/twMerge; อนุญาตความสูงต่างกัน ตราบใดที่ไม่ต่ำกว่าเป้ากด.
function classesOf(html: string): string[] {
  return (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);
}
function lengthPx(value: string): number | undefined {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 4;
  const arbitrary = /^\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(value);
  return arbitrary ? Number(arbitrary[1]) * (arbitrary[2] === "rem" ? 16 : 1) : undefined;
}
function minimumControlHeight(classes: string[], prefixes: string[]): number {
  let height = 0;
  let minimum = 0;
  for (const prefix of prefixes) {
    for (const property of ["h-", "min-h-"] as const) {
      const value = classes.find((name) => name.startsWith(prefix + property));
      if (!value) continue;
      const pixels = lengthPx(value.slice((prefix + property).length));
      if (pixels === undefined) continue;
      if (property === "h-") height = pixels;
      else minimum = pixels;
    }
  }
  return Math.max(height, minimum);
}
function fontPixels(classes: string[]): number {
  const font = classes.find((name) => /^text-(?:2xs|xs|sm|base|lg|xl|[2-9]xl|\[\d)/.test(name));
  if (!font) return 0;
  const name = font.slice(5);
  if (name.startsWith("[")) return lengthPx(name) ?? 0;
  const value = globalsSource.match(new RegExp(`--text-${name}:\\s*([0-9.]+)(px|rem);`));
  return value ? Number(value[1]) * (value[2] === "rem" ? 16 : 1) : 0;
}
function hasFocusIndicator(classes: string[]): boolean {
  return classes.some((name) => /focus-visible:(?:ring-(?:[1-9]|\[)|outline-(?:[1-9]|\[)|border-(?!0|transparent))/.test(name));
}

// ตรวจขั้นต่ำที่มีผลต่อการอ่าน โดยไม่ตรึงขนาดหัวข้อ น้ำหนัก หรือ tracking ของงานใหม่.
for (const role of ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl"]) {
  const pixels = fontPixels([`text-${role}`]);
  const leading = globalsSource.match(new RegExp(`--text-${role}--line-height:\\s*([0-9.]+)(px|rem)?;`));
  const linePixels = leading ? Number(leading[1]) * (leading[2] === "rem" ? 16 : leading[2] === "px" ? 1 : pixels) : 0;
  assert(`ตัวอักษร ${role}: มีขนาดและความสูงบรรทัดพออ่านภาษาไทย`, pixels >= (role === "2xs" ? 11 : 12) && linePixels >= pixels * 1.2);
}
const microControlOffenders = tsxFilesUnder("src")
  .filter((path) => !path.startsWith("src/app/proto/") && !path.startsWith("src/app/(print)/") && !path.startsWith("src/components/print/"))
  .filter((path) => /<(?:Button|Input|Select|Textarea|Link|button|a|Label|label)\b[^>]*\btext-2xs\b/.test(withoutSourceComments(sourceOf(path))));
assert(`ตัวอักษร 11px ไม่ใช้กับคำสั่งหรือ label${microControlOffenders.length ? `: ${microControlOffenders.join(", ")}` : ""}`, microControlOffenders.length === 0);

for (const size of ["default", "sm", "dense"] as const) {
  for (const [name, html] of [
    ["Input", render(<Input size={size} aria-label="จำนวน" />)],
    ["Select", render(<Select size={size} aria-label="ประเภท" defaultValue="a"><option value="a">ก</option></Select>)],
  ]) {
    const cls = classesOf(html!);
    assert(`${name} ${size}: มือถืออ่านได้อย่างน้อย 16px`, fontPixels(cls) >= 16);
    assert(`${name} ${size}: เป้ากดมือถือ 44px / desktop 36px / coarse 44px`,
      minimumControlHeight(cls, [""]) >= 44 &&
      minimumControlHeight(cls, ["", "sm:"]) >= 36 &&
      minimumControlHeight(cls, ["", "sm:", "[@media(pointer:coarse)]:"]) >= 44);
    assert(`${name} ${size}: มีตัวบอก focus`, hasFocusIndicator(cls));
  }
}
for (const size of ["default", "sm", "lg", "icon", "icon-sm"] as const) {
  const html = render(<Button size={size} aria-label="ดำเนินการ">ดำเนินการ</Button>);
  const cls = classesOf(html);
  assert(`Button ${size}: เป้ากดมือถือ/desktop/coarse และ focus`,
    minimumControlHeight(cls, [""]) >= 44 &&
    minimumControlHeight(cls, ["", "sm:"]) >= 36 &&
    minimumControlHeight(cls, ["", "sm:", "[@media(pointer:coarse)]:"]) >= 44 &&
    hasFocusIndicator(cls));
}
assert("Textarea: มือถืออ่านได้และ focus ชัด", fontPixels(classesOf(render(<Textarea />))) >= 16 && hasFocusIndicator(classesOf(render(<Textarea />))));
assert("disabled control ส่งสถานะ native จริง", /<input[^>]*disabled=""/.test(render(<Input disabled />)) && /<button[^>]*disabled=""/.test(render(<Button disabled>บันทึก</Button>)));
const linkedButton = render(<Button asChild><Link href="/orders">เปิดออเดอร์</Link></Button>);
assert("Button asChild คงลิงก์จริงโดยไม่ซ้อนปุ่ม", linkedButton.includes('href="/orders"') && !linkedButton.includes("<button"));
const tallerControl = classesOf(render(<Input className="h-20 min-h-20" />));
assert("caller เพิ่มพื้นที่ control ได้", minimumControlHeight(tallerControl, [""]) >= 80);

const field = render(<Field id="verify-quantity" label="จำนวน" description="กรอกยอดที่นับได้" error="กรอกจำนวนก่อนบันทึก" required><Input aria-describedby="existing-help" /></Field>);
assert("Field เชื่อม label/help/error กับ control และประกาศ invalid", field.includes('for="verify-quantity"') && field.includes('id="verify-quantity"') && field.includes('aria-describedby="existing-help verify-quantity-description verify-quantity-error"') && field.includes('aria-errormessage="verify-quantity-error"') && field.includes('aria-invalid="true"') && field.includes('aria-required="true"') && field.includes('role="alert"'));
const dateHtml = render(<DatePicker value="" onChange={() => {}} aria-invalid aria-describedby="date-error" />);
const dateTrigger = dateHtml.match(/<button[^>]*data-invalid="true"[^>]*>/)?.[0] ?? "";
assert("DatePicker ส่งสถานะผิดและ error description", dateTrigger.includes('aria-describedby="date-error"'));
const searchHtml = render(<SearchInput surface="raised" aria-label="ค้นหาสินค้า" />);
assert("SearchInput ส่ง accessible name ถึงช่องกรอก", /<input[^>]*aria-label="ค้นหาสินค้า"/.test(searchHtml));
const rangeHtml = render(<DateRangePicker from="2026-08-01" to="2026-08-31" onChange={() => {}} />);
assert("ช่วงวันที่มีปุ่มพร้อมชื่อช่วงที่เลือก", /<button[^>]*aria-label="ช่วงวันที่:[^"]+"/.test(rangeHtml));
const filterHtml = render(<FilterPopover activeCount={1} onClear={() => {}} resultLabel="ดูผลลัพธ์">ตัวเลือก</FilterPopover>);
assert("ตัวกรองประกาศปุ่มเปิด dialog", /<button[^>]*aria-haspopup="dialog"/.test(filterHtml));
for (const selected of [true, false]) {
  const html = render(<FilterChip selected={selected} onClick={() => {}} icon={<Factory aria-hidden="true" />}>งานผลิต</FilterChip>);
  assert(`FilterChip selected=${selected}: สถานะ ชื่อ และไอคอนที่ caller ส่งไม่หาย`, html.includes(`aria-pressed="${selected}"`) && html.includes("งานผลิต") && html.includes("lucide-factory") && /<button\b/.test(html));
}

const header = render(<PageHeader title="ควบคุมการผลิต" />);
const context = render(<ContextPanel title="ข้อมูลประกอบ">ข้อความคงที่</ContextPanel>);
const help = render(<HelpTip label="อายุหนี้">นับจากวันครบกำหนด</HelpTip>);
assert("หัวหน้ามี heading และข้อมูลคงที่ไม่ประกาศเป็น alert", /<h1[^>]*>ควบคุมการผลิต<\/h1>/.test(header) && !context.includes('role="alert"') && !help.includes('role="alert"'));
assert("คำช่วยเสริมเปิดได้จากปุ่มที่มีชื่อ", /<button[^>]*aria-label="ดูคำอธิบาย: อายุหนี้"/.test(help));
const guidance = "ตรวจยอดรับจริงก่อนยืนยัน หากนับผิดให้แก้ยอดพร้อมเหตุผล";
for (const [name, html] of [
  ["PageHeader", render(<PageHeader title="ตรวจรับ" description={guidance} />)],
  ["Section", render(<Section title="จำนวนต่อไซซ์" description={guidance}>รายการเสื้อ</Section>)],
]) {
  assert(`${name}: คำช่วยที่ส่งมาต้องเป็นข้อความที่มองเห็น`, html!.includes(guidance) && !html!.includes(`description="${guidance}"`));
}

const shellSource = sourceOf("src/components/layout/app-shell.tsx");
assert("Sidebar ใช้สิทธิ์จาก registry กลาง", shellSource.includes('groupedNavigationItems("sidebar", me?.permissions)'));
assert("Sidebar ที่ย่อมีชื่อและสถานะเปิดปิด", shellSource.includes("aria-label={sidebarCollapsed ? item.label : undefined}") && shellSource.includes("aria-expanded={!collapsed}") && shellSource.includes('aria-controls="app-sidebar-navigation"'));
assert("เมนูประกาศหน้าปัจจุบันและมี skip link", shellSource.includes('aria-current=') && shellSource.includes('href="#main-content"') && shellSource.includes('id="main-content"'));
assert("Sidebar จดจำสถานะโดยคง SSR hydration", shellSource.includes("useSyncExternalStore"));
const ordersSource = sourceOf("src/components/orders/orders-page.tsx");
assert("ทะเบียนออเดอร์อ่านภาพผ่านตัวเลือกรูปและรูปย่อชุดกลาง", ordersSource.includes("MockupThumbnail") && ordersSource.includes("mockupCoverImage"));
const dashboardSources = tsxFilesUnder("src/app/(dashboard)").map((path) => withoutSourceComments(sourceOf(path))).join("\n");
assert("ข้อความ dashboard ไม่หลุดคำสั่งพัฒนาหรือชื่อโหมดภายใน", !/npm run db:seed:demo|demo local|demo-local/i.test(dashboardSources));
for (const [name, html] of [["ListSkeleton", render(<ListSkeleton />)], ["ListPageSkeleton", render(<ListPageSkeleton />)]]) {
  assert(`${name}: ประกาศว่ากำลังโหลดและไม่ปลอมเป็นข้อมูลจริง`, html!.includes('role="status"') && /aria-label="กำลัง/.test(html!));
}
const shellLoading = render(<PageShell title="งานผลิต" loading skeleton={<ListSkeleton />}>ข้อมูลจริง</PageShell>);
const shellError = render(<PageShell title="งานผลิต" error={{ message: "โหลดไม่สำเร็จ", onRetry: noopForShell }}>ข้อมูลจริง</PageShell>);
function noopForShell() {}
assert("หน้ากำลังโหลดคงบริบทและไม่แสดงข้อมูลจริงเป็นผลสำเร็จ", shellLoading.includes("งานผลิต") && shellLoading.includes('role="status"') && !shellLoading.includes("ข้อมูลจริง"));
assert("หน้า error คงบริบท เหตุผล และทางลองใหม่", shellError.includes("งานผลิต") && shellError.includes("โหลดไม่สำเร็จ") && shellError.includes("ลองใหม่") && !shellError.includes("ข้อมูลจริง"));

const table = render(<DataTable.Root><DataTable.Head><tr><DataTable.Th>จำนวน</DataTable.Th><DataTable.SortableTh direction="desc" onSort={() => {}}>กำหนดส่ง</DataTable.SortableTh></tr></DataTable.Head><DataTable.Body><tr><DataTable.Td>30 ตัว</DataTable.Td><DataTable.Td>12 ก.ย.</DataTable.Td></tr></DataTable.Body></DataTable.Root>);
assert("DataTable คง table/head/body/cell semantics และ sortable header", table.includes("<table") && table.includes("<thead") && table.includes("<tbody") && /<th[^>]*scope="col"/.test(table) && table.includes('aria-sort="descending"') && table.includes('<button type="button"') && table.includes("30 ตัว"));
assert("ตารางมีขอบเขตเลื่อนแนวนอนภายใน", table.includes("overflow-x-auto"));
const tableSource = sourceOf("src/components/ui/data-table.tsx");
assert("ลิงก์แถวเคารพ control การเลือกข้อความ และข้อมูลที่ยังไม่บันทึก", tableSource.includes("requestAppNavigation") && tableSource.includes('t.closest("a,button,input,select,textarea,label,') && tableSource.includes("window.getSelection()?.toString()"));
const semanticOffenders = tsxFilesUnder("src").filter((path) => /<Link\b[^>]*\brole=["']listitem["'][^>]*>/.test(withoutSourceComments(sourceOf(path))));
assert(`Link คงบทบาทลิงก์ ไม่มี role=listitem ทับ${semanticOffenders.length ? `: ${semanticOffenders.join(", ")}` : ""}`, semanticOffenders.length === 0);
for (const page of [1, 2, 3]) {
  const html = render(<TablePagination page={page} totalPages={3} total={45} limit={20} onPageChange={() => {}} />);
  const previous = html.match(/<button[^>]*aria-label="หน้าก่อนหน้า"[^>]*>/)?.[0] ?? "";
  const next = html.match(/<button[^>]*aria-label="หน้าถัดไป"[^>]*>/)?.[0] ?? "";
  assert(`แบ่งหน้า ${page}: landmark และปุ่มขอบเขตถูกต้อง`, html.includes('<nav aria-label="การแบ่งหน้า"') && Boolean(previous) && Boolean(next) && previous.includes('disabled=""') === (page === 1) && next.includes('disabled=""') === (page === 3));
}
assert("รายการหน้าเดียวไม่แสดงปุ่มแบ่งหน้าที่ใช้ไม่ได้", render(<TablePagination page={1} totalPages={1} total={1} onPageChange={() => {}} />) === "");

const providersSource = sourceOf("src/components/providers.tsx");
assert("theme bootstrap แยก SSR executable / client data block ครบทุก provider", providersSource.includes('type: typeof window === "undefined" ? "text/javascript" : "text/plain"') && (providersSource.match(/scriptProps=\{THEME_BOOTSTRAP_SCRIPT_PROPS\}/g)?.length ?? 0) === 2);
const pickerSource = sourceOf("src/components/product-picker.tsx");
const dialogSource = sourceOf("src/components/ui/dialog.tsx");
assert("picker มี expanded/controls และจัดการ focus เมื่อเปิดปิด", pickerSource.includes("onOpenAutoFocus") && pickerSource.includes("onCloseAutoFocus") && pickerSource.includes("aria-expanded={isExpanded}") && pickerSource.includes("aria-controls={`product-variants-${product.id}`}"));
assert("Dialog คง focus return, viewport scroll และ reduced motion", dialogSource.includes("returnFocusElement") && dialogSource.includes("onCloseAutoFocus={handleCloseAutoFocus}") && /max-h-/.test(dialogSource) && /overflow-y-auto/.test(dialogSource) && dialogSource.includes("motion-reduce:animate-none"));
assert("global reduced motion ปิดการเคลื่อนไหวที่ไม่จำเป็น", globalsSource.includes("prefers-reduced-motion"));

for (const tone of ["brand", "production", "product", "finance", "system"]) {
  for (const theme of [0, 1]) {
    checkContrast(`${tone} ${theme ? "Dark" : "Light"} text/surface`, hexRgb(colorValues(`module-${tone}-text`)[theme]!), hexRgb(colorValues(`module-${tone}-surface`)[theme]!), 4.5);
  }
  checkContrast(`${tone} marker/white`, hexRgb(colorValues(`module-${tone}-solid`)[0]!), [255, 255, 255], 3);
}

// ⑨ ด่านสีจริง — class ถูกไม่ได้แปลว่าสีอ่านออก จึงคำนวณ WCAG จาก token กลาง
{
  const themes = [0, 1] as const;
  // chrome + chrome-hover เข้ามาในลิสต์ตั้งแต่ chrome เป็นเทา (UI-2026 เฟส 1) —
  // ก่อนหน้านี้ chrome เป็นขาว/ดำสนิทจึงไม่มีใครคิดว่าต้องเช็ก
  // chrome-pressed จงใจไม่อยู่ในลิสต์: ทุกจุดที่ใช้ต้องมากับ INTERACTIVE_CHROME_PRESSED
  // ซึ่งพ่วง active:text-strong มาแล้ว (มีด่านแยกด้านล่างห้ามเขียน active:bg-... เอง)
  const surfaces = ["bg", "surface", "surface-muted", "field", "interactive-hover", "interactive-pressed", "interactive-selected", "chrome", "interactive-chrome-hover"] as const;
  const texts = ["strong", "secondary", "muted"] as const;
  const fields = colorValues("field");
  const fieldBorders = colorValues("field-border");
  if (
    fields.length !== 2 ||
    fieldBorders.length !== 2
  ) {
    failed++;
    console.log("❌ field ต้องมีสีพื้นและขอบครบทั้ง Light/Dark");
  }

  for (const theme of themes) {
    for (const text of texts) {
      const foreground = hexRgb(colorValues(text)[theme]!);
      for (const surface of surfaces) {
        checkContrast(
          `${theme === 0 ? "light" : "dark"} ${text} บน ${surface}`,
          foreground,
          hexRgb(colorValues(surface)[theme]!),
          4.5,
        );
      }
    }

    checkContrast(
      `${theme === 0 ? "light" : "dark"} placeholder บน field`,
      hexRgb(colorValues("placeholder")[theme]!),
      hexRgb(colorValues("field")[theme]!),
      4.5,
    );
    // ขอบตอนพักไม่มีเพดานความเข้ม: ความชัดของ control ตรวจด้วย focus/error
    // และทดสอบบนจอจริง ไม่ใช้ช่วง contrast ต่ำบังคับให้ทุกฟอร์มมีหน้าตาเดียวกัน.
    const focusColor = theme === 0 ? "blue-500" : "blue-300";
    const errorColor = theme === 0 ? "red-500" : "red-400";
    checkContrast(
      `${theme === 0 ? "light" : "dark"} ขอบ focus บน field`,
      hexRgb(colorValues(focusColor)[0]!),
      hexRgb(fields[theme]!),
      3,
    );
    checkContrast(
      `${theme === 0 ? "light" : "dark"} ขอบ error บน field`,
      hexRgb(colorValues(errorColor)[0]!),
      hexRgb(fields[theme]!),
      3,
    );
    checkContrast(
      `${theme === 0 ? "light" : "dark"} selected text`,
      hexRgb(colorValues("interactive-selected-text")[theme]!),
      hexRgb(colorValues("interactive-selected")[theme]!),
      4.5,
    );
    checkContrast(
      `${theme === 0 ? "light" : "dark"} switch ปิดบน surface`,
      hexRgb(colorValues("border-strong")[theme]!),
      hexRgb(colorValues("surface")[theme]!),
      3,
    );
  }

  const white = hexRgb("#ffffff");
  for (const surface of surfaces) {
    checkContrast(
      `compat text-slate-400 บน ${surface}`,
      hexRgb(colorValues("slate-400")[0]!),
      hexRgb(colorValues(surface)[0]!),
      4.5,
    );
  }
  for (const surface of surfaces) {
    checkContrast(
      `compat text-slate-400 บน dark ${surface}`,
      hexRgb(colorValues("slate-400")[1]!),
      hexRgb(colorValues(surface)[1]!),
      4.5,
    );
  }
  // amber-500 ถูกถอดออกจากชุดนี้ตั้งใจ (UI-2026 เฟส 1 · เบสเคาะ 2026-08-25):
  // บทบาทใหม่คือ "สัญญาณล้วน" (จุดสถานะ/แท่ง/วงแหวน) ที่มีข้อความกำกับเสมอ
  // เหลืองอำพันจริงบนขาวได้แค่ ~2.1:1 จะบังคับ 4.5:1 ไม่ได้โดยไม่ทุบให้เป็นน้ำตาล
  // (ซึ่งคือปัญหาเดิม) · แทนที่ด้วยด่านห้ามใช้เป็นตัวหนังสือด้านล่าง + amber-600 ที่ 3:1
  for (const shade of ["blue-500", "red-500", "green-500"]) {
    checkContrast(
      `${shade} legacy text บน light surface`,
      hexRgb(colorValues(shade)[0]!),
      hexRgb(colorValues("surface")[0]!),
      4.5,
    );
    checkContrast(
      `${shade} legacy text บน dark surface`,
      hexRgb(colorValues(shade)[1]!),
      hexRgb(colorValues("surface")[1]!),
      4.5,
    );
  }
  for (const shade of ["blue-600", "blue-700", "blue-800", "red-700", "red-800", "red-900"]) {
    checkContrast(`ข้อความขาวบน ${shade}`, white, hexRgb(colorValues(shade)[0]!), 4.5);
  }

  const lightSurface = hexRgb(colorValues("surface")[0]!);
  for (const shade of ["blue-600", "red-600", "green-600"]) {
    checkContrast(`${shade} บน surface`, hexRgb(colorValues(shade)[0]!), lightSurface, 4.5);
  }
  // amber-600 = ไอคอน/สัญญาณ non-text (WCAG 1.4.11 = 3:1) ไม่ใช่ตัวหนังสือ
  // ตัวหนังสือเหลืองใช้ amber-700 ซึ่งถูกเช็กที่ 4.5:1 ผ่าน lightTints ด้านล่าง
  checkContrast("amber-600 ไอคอน บน surface", hexRgb(colorValues("amber-600")[0]!), lightSurface, 3);
  checkContrast("amber-700 ตัวหนังสือ บน surface", hexRgb(colorValues("amber-700")[0]!), lightSurface, 4.5);
  checkContrast("amber-700 ตัวหนังสือ บน bg", hexRgb(colorValues("amber-700")[0]!), hexRgb(colorValues("bg")[0]!), 4.5);

  const lightTints = [
    ["blue-800", "blue-50"],
    ["green-800", "green-50"],
    ["amber-800", "amber-50"],
    ["red-700", "red-50"],
  ] as const;
  for (const [foreground, background] of lightTints) {
    checkContrast(`${foreground} บน ${background}`, hexRgb(colorValues(foreground)[0]!), hexRgb(colorValues(background)[0]!), 4.5);
  }
  checkContrast(
    "blue-700 บน blue-100",
    hexRgb(colorValues("blue-700")[0]!),
    hexRgb(colorValues("blue-100")[0]!),
    4.5,
  );

  const darkSurface = hexRgb(colorValues("surface-elevated")[1]!);
  const darkTints = [
    ["blue-200", "blue-950"],
    ["green-200", "green-950"],
    ["amber-200", "amber-950"],
    ["red-200", "red-950"],
  ] as const;
  for (const [foreground, background] of darkTints) {
    const translucentTint = composite(hexRgb(colorValues(background)[0]!), darkSurface, 0.4);
    checkContrast(`${foreground} บน ${background}/40 dark`, hexRgb(colorValues(foreground)[0]!), translucentTint, 4.5);
  }

  checkContrast(
    "focus light บน selected",
    hexRgb(colorValues("blue-500")[0]!),
    hexRgb(colorValues("interactive-selected")[0]!),
    3,
  );
  checkContrast(
    "focus dark บน selected",
    hexRgb(colorValues("blue-400")[0]!),
    hexRgb(colorValues("interactive-selected")[1]!),
    3,
  );

  if (failed === 0) console.log("✅ contrast ของ text/control/focus/status ผ่านทั้ง light และ dark");
}


// Print/public มีขอบเขตข้อมูลต่างจาก dashboard; คง A4 และ blind shipping.
const statusPublicSource = sourceOf("src/app/(public)/status/[token]/page.tsx");
assert("print/public คงธีมเอกสารและ A4 โดยไม่บังคับ masthead/radius", providersSource.includes('const PUBLIC_LIGHT_PREFIXES = [...PUBLIC_CUSTOMER_PREFIXES, "/print"]') && globalsSource.includes("width: 210mm") && globalsSource.includes("@media print") && globalsSource.includes("overflow-x: auto"));
assert("blind ship ไม่แสดง footer หรือเครื่องหมาย Anajak", statusPublicSource.includes("hideFooter={d.isBlindShip}") && sourceOf("src/components/public/public-page.tsx").includes("hideBrandMark = hideFooter"));

// สัญญาฟอร์มเดียวสำหรับ create/edit ป้องกัน writer แยกชุดและการทำข้อมูลหาย.
const createSource = sourceOf("src/components/orders/new/order-create-page.tsx");
const editSource = sourceOf("src/components/orders/edit/order-edit-route.tsx");
const detailSource = sourceOf("src/components/orders/detail/order-detail-page.tsx");
assert("create/edit ใช้ฟอร์มและ saveForm mutation ชุดเดียว", editSource.includes('mode="edit"') && editSource.includes('from "@/components/orders/new/order-create-page"') && createSource.includes("trpc.order.saveForm.useMutation") && createSource.includes('category: "FEE"'));
const legacyImplementations = new Set(["src/components/orders/order-items-editor.tsx", "src/components/orders/order-info-edit-dialog.tsx"]);
const legacyCallers = tsxFilesUnder("src").filter((path) => !legacyImplementations.has(path) && /(?:from\s+|import\s*\()\s*["'][^"']*(?:order-items-editor|order-info-edit-dialog)/.test(sourceOf(path)));
assert(`ไม่มี caller กลับไปใช้ writer รุ่นเก่า${legacyCallers.length ? `: ${legacyCallers.join(", ")}` : ""}`, legacyCallers.length === 0 && !detailSource.includes("OrderItemsEditor") && !detailSource.includes("OrderInfoEditDialog"));
const itemsHeaderSource = sourceOf("src/components/orders/new/order-items-list-header.tsx");
assert("เพิ่มรายการแล้วพาไปยังรายการใหม่ด้วย scroll/focus", itemsHeaderSource.includes('type="button"') && itemsHeaderSource.includes("scrollIntoView") && itemsHeaderSource.includes(".focus("));

// tsx ใช้ classic runtime ในชิ้นส่วนแอป จึงติดตั้ง React ก่อนโหลด fixture/component.
(globalThis as Record<string, unknown>).React = React;
/* eslint-disable @typescript-eslint/no-require-imports */
const { OrderItemCard } = require("../src/components/orders/new/order-item-card");
const { EMPTY_ITEM } = require("../src/types/order-form");
const noop = () => {};
const itemHtml = render(React.createElement(OrderItemCard, {
  cardId: "verify-order-item-1", item: EMPTY_ITEM, itemIdx: 0, canRemove: false,
  isExpanded: true, compact: true, allItems: [EMPTY_ITEM], printCatalog: [], addonCatalog: [],
  onUpdateItem: noop, onRemoveItem: noop, onAddPrint: noop, onRemovePrint: noop,
  onUpdatePrint: noop, onAddAddon: noop, onRemoveAddon: noop, onUpdateAddon: noop,
  onOpenPicker: noop, onSetItems: noop,
}));
for (const label of ["รายการที่ 1", "สินค้าในชุดงาน", "ลายและงานพิมพ์", "ส่วนเสริมในชุดงาน"]) {
  assert(`รายการงานว่างยังมีทางเริ่ม: ${label}`, itemHtml.includes(label));
}

const { OrderOverviewTab } = require("../src/components/orders/detail/order-overview-tab") as typeof import("../src/components/orders/detail/order-overview-tab");
const { OrderArtworkCardView } = require("../src/components/orders/detail/order-artwork-card") as typeof import("../src/components/orders/detail/order-artwork-card");
const { PREVIEW_ORDER, PREVIEW_ARTWORK } = require("../src/app/proto/ui-reset/_order-data") as typeof import("../src/app/proto/ui-reset/_order-data");
const overviewProps: React.ComponentProps<typeof OrderOverviewTab> = {
  order: PREVIEW_ORDER, showMoney: true, totalAmount: 5992, totalQuantity: 30,
  onOpenMoney: noop, onOpenDelivery: noop, onEditInfo: noop, onOpenCustomer: noop,
  channelColor: { bg: "bg-green-50", text: "text-green-700" }, isMarketplace: false,
  artwork: <OrderArtworkCardView latest={PREVIEW_ARTWORK} versionCount={2} rawCount={2} printCount={0} description={PREVIEW_ORDER.description} onOpenFiles={noop} />,
};
for (const variant of ["current", "a", "b"] as const) {
  const html = render(<OrderOverviewTab {...overviewProps} variant={variant} />);
  for (const label of ["แก้ไขข้อมูลออเดอร์", "แก้ไขที่อยู่จัดส่ง", "เปิดหน้าลูกค้า", "มาตรฐานลูกค้า:", "5,992", "87,342.5"]) {
    assert(`ภาพรวม ${variant} คงข้อมูล/ทางทำงาน: ${label}`, html.includes(label));
  }
  const restrictedHtml = render(<OrderOverviewTab {...overviewProps} variant={variant} showMoney={false} onOpenMoney={undefined} onEditInfo={undefined} />);
  for (const hidden of ["ยอดรวม", "ซื้อสะสม", "วงเงินเครดิต", "87,342.5", "5,992", "แก้ไขข้อมูลออเดอร์", "แก้ไขที่อยู่จัดส่ง"]) {
    assert(`ภาพรวม ${variant} ไม่ render เมื่อไม่มีสิทธิ์: ${hidden}`, !restrictedHtml.includes(hidden));
  }
  const emptyHtml = render(<OrderOverviewTab {...overviewProps} variant={variant} order={{ ...PREVIEW_ORDER, deadline: null, estimatedQuantity: null }} totalAmount={0} totalQuantity={0} />);
  assert(`ภาพรวม ${variant}: ยังไม่ตีราคา/ยังไม่มีรายการ/ยังไม่กำหนดส่ง ไม่ปลอมเป็นค่าที่มีแล้ว`, emptyHtml.includes("ยังไม่ตีราคา") && emptyHtml.includes("ยังไม่มีรายการ") && emptyHtml.includes("ยังไม่กำหนดส่ง"));
  const zeroPriceHtml = render(<OrderOverviewTab {...overviewProps} variant={variant} totalAmount={0} />);
  assert(`ภาพรวม ${variant}: มีสินค้าแต่ยอดศูนย์ต้องบอกให้ตรวจราคา`, zeroPriceHtml.includes("ยอดเป็นศูนย์ — ตรวจสอบราคา"));
  const marketplaceHtml = render(<OrderOverviewTab {...overviewProps} variant={variant} isMarketplace order={{ ...PREVIEW_ORDER, platformFee: 123.45 }} />);
  const restrictedMarketplaceHtml = render(<OrderOverviewTab {...overviewProps} variant={variant} isMarketplace showMoney={false} order={{ ...PREVIEW_ORDER, platformFee: 123.45 }} />);
  assert(`ภาพรวม ${variant}: ค่าธรรมเนียม marketplace อยู่เฉพาะผู้เห็นเงิน`, marketplaceHtml.includes("123.45") && !restrictedMarketplaceHtml.includes("123.45"));
}
const overviewSource = sourceOf("src/components/orders/detail/order-overview-tab.tsx");
const artworkSource = sourceOf("src/components/orders/detail/order-artwork-card.tsx");
assert("ภาพรวมใช้สูตรรูปย่อกลางและไม่เพิ่ม writer ของม็อกอัพ/ไฟล์", artworkSource.includes("MockupThumbRow") && !/useMutation|design\.(upload|approve)|attachment\.(create|delete)/.test(artworkSource) && detailSource.includes("<OrderArtworkCard"));
assert("เงิน/edit คง permission และ URL กลับไปงานเดิม", overviewSource.includes("isMarketplace && showMoney && order.platformFee != null") && overviewSource.includes("showMoney && hasCustomerHistory") && detailSource.includes('onOpenMoney={canSeeMoney ? () => changeTab("money") : undefined}') && /onEditInfo=\{\s*canUseEditForm\s*\?/.test(detailSource) && detailSource.includes('openInfoEditPage(section, "overview")') && detailSource.includes('router.push(buildOrderEditHref(id, { tab: "intake", focus, returnTab }))') && detailSource.includes('onOpenDelivery={() => changeTab("delivery")}'));
assert("หัวออเดอร์คงเลขใบ ไม่กลับไปใช้ชื่อที่ถอดจากระบบ", !/order\.title/.test(detailSource));

console.log(`\nverify-ui-tokens: ผ่าน ${passed} · ตก ${failed}`);
process.exit(failed ? 1 : 0);
