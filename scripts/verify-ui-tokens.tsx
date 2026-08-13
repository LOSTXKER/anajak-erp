/**
 * ตรวจว่า "ภาษาหน้าตา" ที่รวมไว้ที่เดียว (ui/tokens.ts) ออกมาเป็นคลาสจริงตามที่ตั้งใจ
 * รัน: npx tsx scripts/verify-ui-tokens.tsx
 *
 * ทำไมต้อง render จริง ไม่ใช่อ่านโค้ด: cn()/twMerge ตัดสิน "ตัวหลังชนะ" ตามลำดับ
 * argument — วางสลับที่แล้วคลาสหายเงียบๆ โดย tsc/lint ไม่รู้เรื่อง (เจอมาแล้วรอบนี้:
 * เขียน size="sm" ไว้หน้า text-base ทำให้ text-xs ไม่มีผล)
 */
// tsx คอมไพล์ JSX เป็น React.createElement (classic runtime) — ต้อง import React ตรงๆ
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
import {
  ACTIVE_FILTER,
  FOCUS_BUTTON,
  FOCUS_FIELD,
  FOCUS_INSET,
  INTERACTIVE_CHROME_HOVER,
  INTERACTIVE_CHROME_PRESSED,
  RAISED_CONTROL_SURFACE,
  SUNK_PANEL,
} from "../src/components/ui/tokens";
import {
  CONTROL_H,
  CONTROL_H_SM,
} from "../src/components/ui/control-size";

let failed = 0;
const globalsSource = readFileSync("src/app/globals.css", "utf8");

type Rgb = [number, number, number];

function colorValues(name: string): string[] {
  return [...globalsSource.matchAll(new RegExp(`--color-${name}:\\s*([^;]+);`, "g"))]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function hexRgb(value: string): Rgb {
  const hex = value.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`สีไม่ใช่ hex 6 หลัก: ${value}`);
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as Rgb;
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index]! * (1 - alpha)),
  ) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
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
  }
}

function checkContrastWindow(
  name: string,
  foreground: Rgb,
  background: Rgb,
  minimum: number,
  maximum: number,
) {
  const ratio = contrast(foreground, background);
  if (ratio < minimum || ratio > maximum) {
    failed++;
    console.log(
      `❌ ${name}: ${ratio.toFixed(2)}:1 (ต้องอยู่ระหว่าง ${minimum}–${maximum}:1)`,
    );
  }
}

function check(name: string, html: string, must: string[], mustNot: string[] = []) {
  const cls = /class="([^"]*)"/.exec(html)?.[1] ?? "";
  const set = new Set(cls.split(/\s+/));
  // ลงท้ายด้วย "-" = เช็คแค่ว่า "มีคลาสตระกูลนี้อยู่" ไม่สนว่าเฉดไหน
  const has = (c: string) =>
    c.endsWith("-") ? [...set].some((x) => x.startsWith(c)) : set.has(c);
  const missing = must.filter((c) => !has(c));
  const extra = mustNot.filter((c) => has(c));
  if (missing.length || extra.length) {
    failed++;
    console.log(`❌ ${name}`);
    if (missing.length) console.log(`   ขาด: ${missing.join(" ")}`);
    if (extra.length) console.log(`   ไม่ควรมี: ${extra.join(" ")}`);
    console.log(`   ได้จริง: ${cls}`);
  } else {
    console.log(`✅ ${name}`);
  }
}

const h = CONTROL_H.split(" ");
const hSm = CONTROL_H_SM.split(" ");

// ① ช่องกรอก/ช่องเลือก/กล่องข้อความ = ตระกูลเดียวกัน พื้นขาว+ขอบ resting อ่อน
// label/content/context บอกว่าเป็น control; เส้นช่วยเห็นรูปทรงแต่ห้ามเข้มจนฟอร์มเป็นตาราง
const FIELD = [
  "border-field-border",
  "bg-field",
  "placeholder:text-placeholder",
  "focus-visible:border-blue-500",
  "focus-visible:ring-blue-500/20",
  "dark:focus-visible:border-blue-300",
  "aria-invalid:border-red-500",
  "aria-invalid:bg-red-50/50",
  "aria-invalid:focus-visible:border-red-500",
  "aria-invalid:focus-visible:ring-red-500/30",
  "dark:aria-invalid:border-red-400",
];
// ห้าม field กลับไปยืมพื้น structural หรือปล่อย boundary โปร่งใส
const FIELD_NO = ["border-transparent", "border-border", "bg-surface-muted", "bg-[var(--field-bg)]"];
check("ช่องกรอก (Input)", renderToStaticMarkup(<Input />), [...h, ...FIELD, "rounded-[10px]"], [...FIELD_NO, "rounded-2xl"]);
check(
  "ช่องเลือก (Select)",
  renderToStaticMarkup(<Select value="" onChange={() => {}}><option value="">ก</option></Select>),
  [...h, ...FIELD, "rounded-[10px]"],
  [...FIELD_NO, "rounded-2xl"],
);
check("กล่องข้อความ (Textarea)", renderToStaticMarkup(<Textarea />), [...FIELD, "rounded-[10px]", "min-h-24"], [...FIELD_NO, "rounded-2xl"]);
{
  const dateHtml = renderToStaticMarkup(
    <DatePicker
      value=""
      onChange={() => {}}
      aria-invalid
      aria-describedby="date-error"
    />,
  );
  const dateTrigger = dateHtml.match(/<button[^>]*data-invalid="true"[^>]*>/)?.[0] ?? "";
  check(
    "ช่องวันที่รับสถานะผิดจาก Field",
    dateTrigger,
    [
      ...FIELD,
      "data-[invalid=true]:border-red-500",
      "data-[invalid=true]:focus-visible:ring-red-500/30",
    ],
  );
  if (!dateTrigger.includes('aria-describedby="date-error"')) {
    failed++;
    console.log("❌ ช่องวันที่ไม่ส่งต่อคำอธิบาย error จาก Field");
  }
}
check(
  "ช่องกรอกผิดต้องมีเส้น/พื้น/วงโฟกัสแดง",
  renderToStaticMarkup(<Input aria-invalid />),
  [
    "aria-invalid:border-red-500",
    "aria-invalid:bg-red-50/50",
    "aria-invalid:focus-visible:border-red-500",
    "aria-invalid:focus-visible:ring-red-500/30",
    "dark:aria-invalid:border-red-400",
  ],
);

// ② ทรงแคปซูลสำหรับแถบเครื่องมือ
check("ช่องกรอกทรงแคปซูล", renderToStaticMarkup(<Input shape="pill" />), ["rounded-full"], ["rounded-[10px]"]);
check(
  "ช่องเลือกทรงแคปซูล",
  renderToStaticMarkup(<Select shape="pill" value="" onChange={() => {}}><option value="">ก</option></Select>),
  ["rounded-full"],
  ["rounded-[10px]"],
);
check(
  "ช่องเลือก inline โปร่งตอนพักแต่คงเส้น focus จริง",
  renderToStaticMarkup(<Select surface="inline" value="" onChange={() => {}}><option value="">ก</option></Select>),
  ["border-transparent", "bg-transparent", "focus-visible:border-blue-500", "focus-visible:ring-2"],
  ["border-0", "border-field-border", "bg-field", "shadow-sm"],
);

// Toolbar บนผืนหน้าต้องยกขึ้นจาก page ด้วย surface+เงา ไม่ใช้ field-border เข้ม
// และเมื่อกรองอยู่ selected blue ต้องชนะพื้น surface โดยเงายังคงอยู่
{
  const searchHtml = renderToStaticMarkup(
    <SearchInput surface="raised" />,
  );
  const searchControl = searchHtml.match(/<input[^>]*class="[^"]*shadow-sm[^"]*"[^>]*>/)?.[0] ?? "";
  check(
    "ช่องค้นหาแบบยกบนผืนหน้า",
    searchControl,
    ["bg-surface", "shadow-sm", "border-transparent"],
    ["border-border", "border-field-border"],
  );
}
{
  const dateHtml = renderToStaticMarkup(
    <DateRangePicker
      from="2026-08-01"
      to="2026-08-31"
      onChange={() => {}}
    />,
  );
  const dateTrigger = dateHtml.match(/<button[^>]*aria-label="ช่วงวันที่:[^"]*"[^>]*>/)?.[0] ?? "";
  check(
    "ช่วงวันที่ active คงเงาและให้ selected surface ชนะ",
    dateTrigger,
    ["bg-interactive-selected", "border-border", "shadow-sm"],
    ["bg-surface", "border-field-border"],
  );
}
{
  const filterHtml = renderToStaticMarkup(
    <FilterPopover
      activeCount={1}
      onClear={() => {}}
      resultLabel="ดูผลลัพธ์"
    >
      ตัวเลือก
    </FilterPopover>,
  );
  const filterTrigger = filterHtml.match(/<button[^>]*aria-haspopup="dialog"[^>]*>/)?.[0] ?? "";
  check(
    "ปุ่มตัวกรอง active คงเงาและให้ selected surface ชนะ",
    filterTrigger,
    ["bg-interactive-selected", "border-border", "shadow-sm"],
    ["bg-surface", "border-field-border"],
  );
}

// ③ ขนาดเล็ก — ความสูงยุบมาเท่ามาตรฐานแล้ว (2026-08-03 รอบ "ปรับสัดส่วน":
// จอเดียวเคยมี 2 ความสูงปนกัน 32/36px ยืนติดกัน ขอบล่างไม่ตรง) เหลือต่างแค่ขนาดอักษร
// แก้ 2026-08-03: เดิมด่านนี้บังคับ "text-xs" เปล่า (12px ทั้งมือถือ) ซึ่งขัด DESIGN.md
// "mobile input ต้อง 16px กัน browser zoom" — iOS Safari ซูมจอทุกครั้งที่แตะช่อง แล้วไม่ซูมกลับ
// (audit /orders/new 2026-08-03 · ชุด dense ทำถูกอยู่แล้ว sm เป็นตัวเดียวที่ตกหล่น)
// ห้าม text-xs เปล่ากลับมา — จึงใส่ไว้ในลิสต์ "ต้องไม่มี" เหมือน dense
check("ช่องกรอกขนาดเล็ก", renderToStaticMarkup(<Input size="sm" />), [...hSm, "sm:text-xs"], ["sm:h-8", "sm:min-h-8", "text-xs"]);
check(
  "ช่องเลือกขนาดเล็ก",
  renderToStaticMarkup(<Select size="sm" value="" onChange={() => {}}><option value="">ก</option></Select>),
  [...hSm, "sm:text-xs"],
  ["sm:h-8", "sm:min-h-8", "text-xs"],
);

// (CONTROL_H_SM = CONTROL_H แล้ว — ห้าม sm:h-8 กลับมา ไม่งั้นได้ 2 ความสูงปนกันอีก)

// ③.๒ ขนาด dense สำหรับ editable grid — สูงมาตรฐาน + อักษร xs เฉพาะเดสก์ท็อป
check("ช่องกรอกขนาด dense", renderToStaticMarkup(<Input size="dense" />), [...h, "sm:text-xs"], ["text-xs"]);
check(
  "ช่องเลือกขนาด dense",
  renderToStaticMarkup(<Select size="dense" value="" onChange={() => {}}><option value="">ก</option></Select>),
  [...h, "sm:text-xs"],
  ["text-xs"],
);

// ④ ความสูงที่สั่งทับผ่าน className ต้องยังทับได้ (เหตุผลที่ token เป็น TS ไม่ใช่ CSS)
check("สั่งความสูงทับเองได้", renderToStaticMarkup(<Input className="h-20 min-h-20" />), ["h-20", "min-h-20"], ["h-11", "min-h-11"]);

// ⑤ ปุ่ม = วงแหวนโฟกัสคนละสูตรกับช่องกรอก (ชัดกว่า + เว้นขอบ)
check("ปุ่ม", renderToStaticMarkup(<Button>ก</Button>), [
  ...h,
  "rounded-full",
  "focus-visible:ring-2",
  "focus-visible:ring-blue-500",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-", // ผูกช่องว่างรอบวงแหวนกับสีพื้น ไม่ล็อกเป็นขาวตายตัว
], [
  "focus-visible:ring-blue-500/15",
  "focus-visible:ring-offset-white",
]);
check("ปุ่มขนาดเล็ก", renderToStaticMarkup(<Button size="sm">ก</Button>), hSm, ["sm:h-8", "sm:min-h-8"]);
check(
  "ปุ่มรองตอบสนองด้วย interaction semantic",
  renderToStaticMarkup(<Button variant="ghost">ก</Button>),
  [
    "hover:bg-interactive-hover",
    "hover:text-strong",
    "active:bg-interactive-pressed",
    "dark:focus-visible:ring-blue-400",
  ],
  ["hover:bg-slate-50", "hover:bg-slate-100"],
);
for (const variant of ["outline", "secondary", "subtle"] as const) {
  check(
    `ปุ่มรอง ${variant} แยกจาก field/structural surface`,
    renderToStaticMarkup(<Button variant={variant}>ก</Button>),
    ["border-border", "bg-surface", "shadow-sm"],
    ["border-transparent", "border-field-border", "bg-field", "bg-surface-muted"],
  );
}
check(
  "field disabled ใช้ muted surface โดยไม่จางทั้งก้อน",
  renderToStaticMarkup(<Input disabled />),
  ["disabled:border-border", "disabled:bg-surface-muted", "disabled:text-muted", "disabled:shadow-none", "disabled:opacity-100"],
  ["disabled:opacity-50"],
);
check(
  "ปุ่ม disabled ใช้ muted surface โดยไม่จางทั้งก้อน",
  renderToStaticMarkup(<Button variant="outline" disabled>ก</Button>),
  ["disabled:border-border", "disabled:bg-surface-muted", "disabled:text-muted", "disabled:shadow-none", "disabled:opacity-100"],
  ["disabled:opacity-50"],
);
check(
  "ปุ่มอันตรายโหมดมืดไม่ย้อนเป็นแดงอ่อน",
  renderToStaticMarkup(<Button variant="destructive">ลบ</Button>),
  ["dark:bg-red-700", "dark:hover:bg-red-800", "dark:active:bg-red-900"],
  ["dark:bg-red-600", "dark:hover:bg-red-500"],
);

// สถานะเลือกของชิปต้องไม่พึ่งสีอย่างเดียว — aria-pressed บอก assistive tech
// และเครื่องหมายถูกบอกคนที่มองเห็น (เก็บพื้นที่ไอคอนไว้ทั้งสองสถานะ ไม่ให้ label กระโดด)
{
  const selected = renderToStaticMarkup(
    <FilterChip selected onClick={() => {}}>เลือกแล้ว</FilterChip>,
  );
  const idle = renderToStaticMarkup(
    <FilterChip selected={false} onClick={() => {}}>ยังไม่เลือก</FilterChip>,
  );
  if (
    !selected.includes('aria-pressed="true"') ||
    !selected.includes("lucide-check") ||
    selected.includes("invisible") ||
    !idle.includes('aria-pressed="false"') ||
    !idle.includes("lucide-check") ||
    !idle.includes("invisible")
  ) {
    failed++;
    console.log("❌ ชิปตัวกรองต้องมี aria-pressed + เครื่องหมายถูกที่ไม่พึ่งสีอย่างเดียว");
  } else {
    console.log("✅ ชิปตัวกรองบอก selected ด้วย aria-pressed + เครื่องหมายถูก");
  }
}

// semantic surface ต้องถูกระบุผ่าน API ของ primitive ไม่ส่ง class สี/เงาจาก caller
{
  const surfaceOffenders: string[] = [];
  const allowedRaisedOwners = new Set([
    "src/components/ui/input.tsx",
    "src/components/ui/select.tsx",
    "src/components/ui/tokens.ts",
  ]);

  function walkControlCallers(dir: string) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walkControlCallers(path);
        continue;
      }
      if (!/\.tsx$/.test(name)) continue;
      const source = readFileSync(path, "utf8");

      if (
        source.includes("RAISED_CONTROL_SURFACE") &&
        !allowedRaisedOwners.has(path)
      ) {
        surfaceOffenders.push(`${path} (import/class patch ของ raised surface)`);
      }

      for (const match of source.matchAll(/<SearchInput\b([\s\S]*?)\/>/g)) {
        const attrs = match[1] ?? "";
        if (!/surface="(?:field|raised)"/.test(attrs)) {
          const line = source.slice(0, match.index).split("\n").length;
          surfaceOffenders.push(`${path}:${line} (SearchInput ไม่ระบุ semantic surface)`);
        }
      }

      for (const match of source.matchAll(/<Select\b([\s\S]*?)>/g)) {
        const attrs = match[1] ?? "";
        const line = source.slice(0, match.index).split("\n").length;
        if (attrs.includes('shape="pill"') && !attrs.includes('surface="raised"')) {
          surfaceOffenders.push(`${path}:${line} (Select ทรง toolbar ไม่ใช้ surface=raised)`);
        }
        if (
          /(?:border-transparent|bg-surface-muted)/.test(attrs) &&
          !attrs.includes('surface="inline"')
        ) {
          surfaceOffenders.push(`${path}:${line} (caller ทับ surface ของ Select)`);
        }
      }

      for (const match of source.matchAll(/<(?:Input|Textarea|DatePicker)\b([\s\S]*?)\/?\s*>/g)) {
        const attrs = match[1] ?? "";
        if (/(?:border-transparent|bg-surface-muted)/.test(attrs)) {
          const line = source.slice(0, match.index).split("\n").length;
          surfaceOffenders.push(`${path}:${line} (caller ทับ surface ของ field)`);
        }
      }
    }
  }
  walkControlCallers("src");

  if (surfaceOffenders.length > 0) {
    failed++;
    console.log("❌ semantic surface ของ field/toolbar ยังรั่วไปอยู่ที่ caller");
    surfaceOffenders.forEach((offender) => console.log(`   ${offender}`));
  } else {
    console.log("✅ field/toolbar ระบุ semantic role ผ่าน primitive โดยไม่มี class patch");
  }
}

// ⑥ หัวตารางอ่าน semantic surface/divider ชุดเดียวทั้งสองธีม
check(
  "หัวตารางบนกล่อง",
  renderToStaticMarkup(
    <table>
      <DataTable.Head>
        <tr><DataTable.Th>หัว</DataTable.Th></tr>
      </DataTable.Head>
    </table>,
  ),
  ["border-divider", "bg-surface", "text-muted"],
  ["bg-slate-50", "bg-slate-100"],
);

// ⑦ ด่านธีมมืด: ในโซนที่สลับธีมได้ ห้ามมีตัวหนังสือ slate เข้มระดับหลัก (900/700/500)
// ที่ไม่มีคู่ dark: บนบรรทัดเดียวกัน — ใช้ semantic token แทน (text-strong /
// text-secondary / text-muted ใน globals.css) · เคยหลุด 186 จุดจนตัวหนังสือจมใน
// ธีมมืด (audit 2026-08-03) · โซน (print)/(public)/components/print เป็น forced-light
// ไม่เข้าด่านนี้
{
  const roots = ["src/app/(dashboard)", "src/app/factory", "src/components"];
  const skip = [
    join("src", "components", "print"),
    // shell รุ่นเก่าไม่มี caller แล้ว แต่ยังไม่ลบเพราะกติกา repo ต้องขออนุญาตก่อน
    join("src", "components", "layout", "sidebar.tsx"),
    join("src", "components", "layout", "topbar.tsx"),
    join("src", "components", "layout", "mobile-sidebar.tsx"),
  ];
  const offenders: string[] = [];
  const bare = /text-slate-(900|700|500)(?![\d/])/;
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (skip.some((s) => p.startsWith(s))) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) {
        readFileSync(p, "utf8")
          .split("\n")
          .forEach((line, i) => {
            const hasDarkPair =
              line.includes("dark:text-") || line.includes("dark:hover:[&_.text-slate-");
            if (bare.test(line) && !hasDarkPair) {
              offenders.push(`${p}:${i + 1}`);
            }
          });
      }
    }
  }
  roots.forEach(walk);
  if (offenders.length) {
    failed++;
    console.log(`❌ ตัวหนังสือ slate หลักไม่มีคู่ dark: (ใช้ text-strong/secondary/muted แทน) — ${offenders.length} จุด`);
    offenders.slice(0, 20).forEach((o) => console.log(`   ${o}`));
    if (offenders.length > 20) console.log(`   ...และอีก ${offenders.length - 20} จุด`);
  } else {
    console.log("✅ ไม่มีตัวหนังสือ slate หลักที่ลืมธีมมืดในโซนสลับธีม");
  }
}

// ⑦.๒ สี action ตอนชี้ต้องมีคู่สำหรับ dark theme — ค่า 600/700 ฝั่ง light
// ถูกออกแบบให้อ่านบนพื้นขาว แต่จมบน blue-black ได้ แม้ base จะใช้ semantic ถูกแล้ว
{
  const roots = ["src/app/(dashboard)", "src/app/factory", "src/components"];
  const skip = [
    join("src", "components", "print"),
    join("src", "components", "layout", "sidebar.tsx"),
    join("src", "components", "layout", "topbar.tsx"),
    join("src", "components", "layout", "mobile-sidebar.tsx"),
  ];
  const offenders: string[] = [];
  const coloredHover = /(?:hover|group-hover):text-(?:blue|red|amber|yellow|green)-(?:500|600|700|800)/;
  function walkActionText(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (skip.some((s) => p.startsWith(s))) continue;
      if (statSync(p).isDirectory()) walkActionText(p);
      else if (/\.tsx?$/.test(name)) {
        readFileSync(p, "utf8")
          .split("\n")
          .forEach((line, index) => {
            if (
              coloredHover.test(line) &&
              !line.includes("dark:hover:text-") &&
              !line.includes("dark:group-hover:text-")
            ) {
              offenders.push(`${p}:${index + 1}`);
            }
          });
      }
    }
  }
  roots.forEach(walkActionText);
  if (offenders.length) {
    failed++;
    console.log(`❌ สีข้อความ action ตอนชี้ไม่มีคู่ dark — ${offenders.length} จุด`);
    offenders.slice(0, 20).forEach((o) => console.log(`   ${o}`));
  } else {
    console.log("✅ สีข้อความ action ตอนชี้มีคู่ light/dark ครบ");
  }
}

// ⑧ hover/pressed เป็น semantic state แยกจากพื้น structural
// เบสจับจากจอจริงว่าของเดิมใช้ slate-100 เท่ากับ surface-muted (#f2f2f4) พอดี
// จึงชี้แล้วกลืน ด่านนี้กันไม่ให้ component เขียน neutral utility เองจนกลับไปชนพื้นอีก
{
  const roots = ["src/app/(dashboard)", "src/app/factory", "src/components"];
  const skip = [
    join("src", "components", "print"),
    join("src", "components", "layout", "sidebar.tsx"),
    join("src", "components", "layout", "topbar.tsx"),
    join("src", "components", "layout", "mobile-sidebar.tsx"),
  ];
  const offenders: string[] = [];
  const blueHoverOffenders: string[] = [];
  const oldNeutralInteraction =
    /(?:hover|active|group-hover|group-active|data-\[highlighted\]):bg-(?:slate-[0-9]+|white|black)(?:\/[0-9.\[\]]+)?/;
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (skip.some((s) => p.startsWith(s))) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) {
        readFileSync(p, "utf8")
          .split("\n")
          .forEach((line, index) => {
            if (oldNeutralInteraction.test(line)) offenders.push(`${p}:${index + 1}`);
            const blueState = /(?:dark:)?(hover|active|group-hover|group-active|data-\[highlighted\]):(bg|text|border)-blue-[0-9]+(?:\/[0-9]+)?/g;
            const baseClasses = line.replace(/\S*(?:hover|active|group-hover|group-active|data-\[highlighted\]):\S*/g, "");
            for (const match of line.matchAll(blueState)) {
              const property = match[2]!;
              const alreadyBlue = new RegExp(`(?:^|[\\s\"'])${property}-blue-[0-9]+`).test(baseClasses);
              if (!alreadyBlue) blueHoverOffenders.push(`${p}:${index + 1}`);
            }
            const darkBaseCanMaskHover =
              /dark:bg-(?!interactive-hover)/.test(line) &&
              line.includes("hover:bg-interactive-hover") &&
              !/dark:(?:group-)?hover:bg-interactive-hover/.test(line);
            const darkBaseCanMaskPressed =
              /dark:bg-(?!interactive-pressed)/.test(line) &&
              line.includes("active:bg-interactive-pressed") &&
              !/dark:(?:group-)?active:bg-interactive-pressed/.test(line);
            if (darkBaseCanMaskHover || darkBaseCanMaskPressed) {
              offenders.push(`${p}:${index + 1} (dark base ทับ interaction)`);
            }
          });
      }
    }
  }
  roots.forEach(walk);

  const surfaceMuted = colorValues("surface-muted");
  const hover = colorValues("interactive-hover");
  const pressed = colorValues("interactive-pressed");
  const chrome = colorValues("chrome");
  const chromeHover = colorValues("interactive-chrome-hover");
  const chromePressed = colorValues("interactive-chrome-pressed");
  const tokenCountsValid = hover.length === 2 && pressed.length === 2 && surfaceMuted.length === 2;
  const chromeTokenCountsValid =
    chrome.length === 2 && chromeHover.length === 2 && chromePressed.length === 2;
  const tokenLayersValid = tokenCountsValid && hover.every((value, index) =>
    new Set([surfaceMuted[index], value, pressed[index]]).size === 3
  );
  const chromeTokenLayersValid = chromeTokenCountsValid && chromeHover.every((value, index) =>
    new Set([chrome[index], value, chromePressed[index]]).size === 3
  );
  const interactionIsNeutral = [...hover, ...pressed, ...chromeHover, ...chromePressed].every((value) => {
    const channels = hexRgb(value);
    return Math.max(...channels) - Math.min(...channels) <= 6;
  });
  const surface = colorValues("surface");
  const stateContrastIsBalanced = tokenCountsValid && surface.length === 2 && hover.every((value, index) => {
    const hoverFromSurface = contrast(hexRgb(value), hexRgb(surface[index]!));
    const pressedFromHover = contrast(hexRgb(pressed[index]!), hexRgb(value));
    const hoverCeiling = index === 0 ? 1.13 : 1.25;
    return hoverFromSurface >= 1.1 && hoverFromSurface <= hoverCeiling && pressedFromHover >= 1.05;
  });
  const chromeStateContrastIsBalanced = chromeTokenCountsValid && chromeHover.every((value, index) => {
    const hoverFromChrome = contrast(hexRgb(value), hexRgb(chrome[index]!));
    const pressedFromHover = contrast(hexRgb(chromePressed[index]!), hexRgb(value));
    return hoverFromChrome >= 1.1 && hoverFromChrome <= 1.25 && pressedFromHover >= 1.05;
  });
  const chromeTokensAreWired =
    INTERACTIVE_CHROME_HOVER.includes("bg-interactive-chrome-hover") &&
    INTERACTIVE_CHROME_PRESSED.includes("bg-interactive-chrome-pressed");
  const shellSource = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  const navigationHelperSource =
    shellSource.match(/function sidebarNavItemClass[\s\S]*?function MoreMenu/)?.[0] ?? "";
  const navigationContractIsWired =
    navigationHelperSource.includes("INTERACTIVE_CHROME_HOVER") &&
    navigationHelperSource.includes("INTERACTIVE_HOVER") &&
    navigationHelperSource.includes("INTERACTIVE_CHROME_PRESSED") &&
    navigationHelperSource.includes("INTERACTIVE_SELECTED") &&
    navigationHelperSource.includes("FOCUS_INSET") &&
    navigationHelperSource.includes("group-hover/sidebar-item:text-secondary") &&
    !navigationHelperSource.includes("hover:bg-");
  const darkSurfacesAreNeutral = [
    "bg",
    "chrome",
    "surface",
    "surface-muted",
    "surface-elevated",
    "field",
    "slate-200",
    "slate-300",
    "slate-600",
    "slate-700",
    "slate-800",
    "slate-900",
    "slate-950",
  ]
    .every((name) => {
      const value = colorValues(name)[1];
      if (!value) return false;
      const channels = hexRgb(value);
      return Math.max(...channels) - Math.min(...channels) <= 6;
    });
  const sunkIsStructural =
    SUNK_PANEL === "bg-surface-muted" &&
    !/(?:hover|active|focus|data-\[)/.test(SUNK_PANEL) &&
    !globalsSource.includes(".sunk-panel");
  const raisedControlIsSeparate =
    RAISED_CONTROL_SURFACE.includes("border-transparent") &&
    RAISED_CONTROL_SURFACE.includes("bg-surface") &&
    RAISED_CONTROL_SURFACE.includes("shadow-sm") &&
    !RAISED_CONTROL_SURFACE.includes("field");
  const brandBlueIsLocked = colorValues("blue-600")[0]?.toLowerCase() === "#3973b2";
  const selectedStaysBlue = [
    ...colorValues("interactive-selected"),
    ...colorValues("interactive-selected-text"),
  ].every((value) => {
    const [red, green, blue] = hexRgb(value);
    return blue - red >= 20 && blue - green >= 10;
  });
  const focusStaysBlue = [FOCUS_FIELD, FOCUS_BUTTON, FOCUS_INSET]
    .every((token) => token.includes("blue-"));
  const selectedControlStaysSelected =
    ACTIVE_FILTER.includes("hover:bg-interactive-selected") &&
    ACTIVE_FILTER.includes("active:bg-interactive-selected") &&
    !ACTIVE_FILTER.includes("hover:bg-interactive-hover") &&
    !ACTIVE_FILTER.includes("active:bg-interactive-pressed");
  if (
    offenders.length ||
    blueHoverOffenders.length ||
    !tokenCountsValid ||
    !chromeTokenCountsValid ||
    !tokenLayersValid ||
    !chromeTokenLayersValid ||
    !interactionIsNeutral ||
    !stateContrastIsBalanced ||
    !chromeStateContrastIsBalanced ||
    !chromeTokensAreWired ||
    !navigationContractIsWired ||
    !darkSurfacesAreNeutral ||
    !brandBlueIsLocked ||
    !selectedStaysBlue ||
    !focusStaysBlue ||
    !selectedControlStaysSelected ||
    !sunkIsStructural ||
    !raisedControlIsSeparate
  ) {
    failed++;
    console.log("❌ interaction state ยังผูกกับพื้นเทา หรือ token light/dark ไม่ครบ");
    offenders.forEach((o) => console.log(`   ${o}`));
    blueHoverOffenders.forEach((o) => console.log(`   interaction เปลี่ยน neutral เป็นฟ้า: ${o}`));
    if (
      !tokenCountsValid ||
      !chromeTokenCountsValid ||
      !tokenLayersValid ||
      !chromeTokenLayersValid
    ) {
      console.log(`   surface=${surfaceMuted.join("/")}, hover=${hover.join("/")}, pressed=${pressed.join("/")}`);
      console.log(`   chrome=${chrome.join("/")}, pressed=${chromePressed.join("/")}`);
    }
    if (!interactionIsNeutral) {
      console.log(`   hover/pressed ต้องเป็น neutral gray: ${[...hover, ...pressed, ...chromePressed].join("/")}`);
    }
    if (!stateContrastIsBalanced) {
      console.log("   hover ต้องเห็นบน surface แบบเบา และ pressed ต้องชัดกว่า hover");
    }
    if (!chromeStateContrastIsBalanced || !chromeTokensAreWired || !navigationContractIsWired) {
      console.log("   navigation hover ต้องมีพื้นขาวนวลและคง pressed/selected/focus ที่มองเห็น");
    }
    if (!darkSurfacesAreNeutral) {
      console.log("   พื้น Dark ต้องเป็น neutral gray ไม่ใช่ blue-black");
    }
    if (!brandBlueIsLocked || !selectedStaysBlue || !focusStaysBlue) {
      console.log("   น้ำเงิน #3973b2 ต้องสงวนอยู่ที่ primary/selected/focus");
    }
    if (!selectedControlStaysSelected) {
      console.log(`   selected control ต้องไม่กลับเป็น neutral ตอนชี้/กด: ${ACTIVE_FILTER}`);
    }
    if (!sunkIsStructural) {
      console.log(`   SUNK_PANEL ต้องไม่มี interaction state: ${SUNK_PANEL}`);
    }
    if (!raisedControlIsSeparate) {
      console.log(`   raised control ต้องเป็น surface+เงาและไม่ใช้ field-border: ${RAISED_CONTROL_SURFACE}`);
    }
  } else {
    console.log("✅ navigation/surface hover ขาวนวล · pressed แยกชั้น · primary/selected/focus ยังเป็นน้ำเงิน");
  }
}

// ⑨ ด่านสีจริง — class ถูกไม่ได้แปลว่าสีอ่านออก จึงคำนวณ WCAG จาก token กลาง
{
  const themes = [0, 1] as const;
  const surfaces = ["bg", "surface", "surface-muted", "interactive-hover", "interactive-pressed", "interactive-selected"] as const;
  const texts = ["strong", "secondary", "muted"] as const;
  const fields = colorValues("field");
  const fieldBorders = colorValues("field-border");
  if (
    fields.length !== 2 ||
    fieldBorders.length !== 2 ||
    fields[0] !== colorValues("surface")[0] ||
    globalsSource.includes(".sunk-panel")
  ) {
    failed++;
    console.log("❌ field ต้องมี Light/Dark อย่างละค่า, Light เป็นขาว และห้าม ancestor เปลี่ยนสีตามบริบท");
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
    const restingWindows = theme === 0
      ? {
          field: [1.45, 1.8],
          surface: [1.45, 1.8],
          "surface-muted": [1.3, 1.65],
          bg: [1.35, 1.7],
        }
      : {
          field: [1.65, 2.2],
          surface: [1.35, 1.8],
          "surface-muted": [1.45, 1.9],
          bg: [1.5, 2.0],
        };
    for (const adjacent of ["field", "surface", "surface-muted", "bg"] as const) {
      const [minimum, maximum] = restingWindows[adjacent];
      checkContrastWindow(
        `${theme === 0 ? "light" : "dark"} ขอบ resting field บน ${adjacent}`,
        hexRgb(fieldBorders[theme]!),
        hexRgb(colorValues(adjacent)[theme]!),
        minimum,
        maximum,
      );
    }

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
  for (const shade of ["blue-500", "red-500", "amber-500", "green-500"]) {
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
  for (const shade of ["blue-600", "red-600", "amber-600", "green-600"]) {
    checkContrast(`${shade} บน surface`, hexRgb(colorValues(shade)[0]!), lightSurface, 4.5);
  }

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

// ⑩ พื้นผิวหลักต้องไร้กรอบ — 406c0e6 เคยเติม zero-offset ring 1px กลับเข้า
// card ทั้ง base+hover โดยขัดกับ contract minimal และ comment ข้าง primitive
{
  const blocks = [...globalsSource.matchAll(
    /(?:\.dark\s+)?\.card-surface(?:-hover:hover)?\s*\{([^}]*)\}/g,
  )].map((match) => match[1] ?? "");
  const offenders = blocks.filter((block) =>
    /0\s+0\s+0\s+(?:0\.5|1)px|--color-border(?:-strong)?/.test(block),
  );
  if (blocks.length !== 4 || offenders.length > 0) {
    failed++;
    console.log("❌ card-surface ต้องใช้เงาลึกเท่านั้น ห้ามวงขอบรอบ base/hover");
  } else {
    console.log("✅ card-surface ไม่มีวงขอบทั้ง base/hover และ Light/Dark");
  }

  const cardHoverBlock =
    globalsSource.match(/\.card-surface-hover:hover\s*\{([^}]*)\}/)?.[1] ?? "";
  const cardActiveBlock =
    globalsSource.match(/\.card-surface-hover:active\s*\{([^}]*)\}/)?.[1] ?? "";
  if (
    !cardHoverBlock.includes("background-color: var(--color-interactive-hover)") ||
    !cardActiveBlock.includes("background-color: var(--color-interactive-pressed)")
  ) {
    failed++;
    console.log("❌ card-surface-hover ต้องมี semantic hover/pressed เต็ม hit area ทั้ง Light/Dark");
  } else {
    console.log("✅ card-surface-hover มี semantic hover/pressed เต็ม hit area ทั้ง Light/Dark");
  }

  const callerOffenders: string[] = [];
  const cardOverrideOffenders: string[] = [];
  function walkCardCallers(dir: string) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walkCardCallers(path);
      } else if (/\.tsx?$/.test(name)) {
        const source = readFileSync(path, "utf8");
        source
          .split("\n")
          .forEach((line, index) => {
            if (
              line.includes("card-surface") &&
              (/(?:^|\s)border(?:\s|["'`])|(?:hover|focus|active):border-(?!transparent)/.test(line) ||
                /(?:^|\s)(?:dark:)?hover:bg-(?!interactive-hover)/.test(line))
            ) {
              callerOffenders.push(`${path}:${index + 1}`);
            }
          });
        for (const match of source.matchAll(/<Card\b[^>]*className\s*=\s*"([^"]*)"/g)) {
          const classes = match[1] ?? "";
          if (/(?:^|\s)border(?:\s|$)|(?:^|\s)(?:hover:|focus:|active:)?border-(?!transparent)/.test(classes)) {
            const line = source.slice(0, match.index).split("\n").length;
            cardOverrideOffenders.push(`${path}:${line}`);
          }
        }
      }
    }
  }
  walkCardCallers("src");
  const allCallerOffenders = [...callerOffenders, ...cardOverrideOffenders];
  if (allCallerOffenders.length > 0) {
    failed++;
    console.log("❌ caller ของ card-surface เติมเส้นรอบหรือ hover สีเขียนมือกลับเอง");
    allCallerOffenders.forEach((offender) => console.log(`   ${offender}`));
  } else {
    console.log("✅ caller ของ card-surface ไม่มีเส้นรอบ และใช้เฉพาะ semantic hover");
  }

  const ordersStatusSource = readFileSync(
    "src/components/orders/order-status-flow-bar.tsx",
    "utf8",
  );
  const detailStatusSource = readFileSync(
    "src/components/orders/detail/order-status-bar.tsx",
    "utf8",
  );
  const statusWrappers = [
    ordersStatusSource.match(/className="([^"]*card-surface[^"]*)"/)?.[1] ?? "",
    detailStatusSource.match(/className="([^"]*card-surface[^"]*)"/)?.[1] ?? "",
  ];
  if (
    statusWrappers.some(
      (classes) =>
        !classes.includes("card-surface") ||
        /(?:^|\s)border(?:\s|$)|(?:^|\s)ring-(?!0)/.test(classes),
    )
  ) {
    failed++;
    console.log("❌ status rail ต้องอยู่บน card surface มีเงา แต่ห้ามเส้นรอบตกแต่ง");
  } else {
    console.log("✅ status rail อยู่บน card surface โดยไม่มีเส้นรอบตกแต่ง");
  }

  const desktopStatusSource =
    ordersStatusSource.match(/function DesktopStatusButton[\s\S]*?\n}\n\nexport function/)?.[0] ?? "";
  if (
    !desktopStatusSource.includes("hover:bg-interactive-hover") ||
    !desktopStatusSource.includes("active:bg-interactive-pressed") ||
    !desktopStatusSource.includes("group-hover:text-secondary")
  ) {
    failed++;
    console.log("❌ ขั้นสถานะ desktop ต้องชี้ด้วยพื้นขาวนวล และคง pressed/selected feedback");
  } else {
    console.log("✅ ขั้นสถานะ desktop ชี้ด้วยพื้นขาวนวล โดยคง pressed/selected feedback");
  }
}

/* ── การ์ดชุดงานตอนยังว่าง: 3 ส่วนต้องหน้าตาเดียวกัน ────────────────────────
   เบสเจอบนของจริง 2026-08-04 ว่า "ลาย/ส่วนเสริม ไม่เหมือนสินค้าในชุดงาน" —
   ต้นเหตุคือมีเส้นทางลัดซ่อนอยู่ (ลายกับส่วนเสริมว่างพร้อมกัน = ยุบเป็นปุ่มจาง 2 อัน
   แทนทั้งสองส่วน) ที่ tsc/lint มองไม่เห็น · ล็อกไว้ด้วยการ render จริงแล้วนับ */
{
  // tsx แปลง JSX เป็น React.createElement แบบ classic — ไฟล์ในแอปไม่ได้ import React เอง
  // จึงต้องวางไว้บน global ก่อน แล้วค่อย require (import ปกติถูกยกขึ้นไปบนสุด)
  (globalThis as Record<string, unknown>).React = React;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { OrderItemCard } = require("../src/components/orders/new/order-item-card");
  const { EMPTY_ITEM } = require("../src/types/order-form");
  const noop = () => {};
  const html = renderToStaticMarkup(
    React.createElement(OrderItemCard, {
      item: EMPTY_ITEM, itemIdx: 0, canRemove: false, isExpanded: true,
      compact: true, appearance: "intake", allItems: [EMPTY_ITEM],
      printCatalog: [], addonCatalog: [],
      onUpdateItem: noop, onRemoveItem: noop, onAddPrint: noop, onRemovePrint: noop,
      onUpdatePrint: noop, onAddAddon: noop, onRemoveAddon: noop, onUpdateAddon: noop,
      onOpenPicker: noop, onSetItems: noop,
    })
  );
  const cards = [...html.matchAll(/class="([^"]*border-dashed[^"]*)"/g)].map((m) => m[1]);
  const problems: string[] = [];
  for (const t of ["รายการที่ 1", "สินค้าในชุดงาน", "ลายและงานพิมพ์", "ส่วนเสริมในชุดงาน"]) {
    if (!html.includes(t)) problems.push(`ไม่เจอข้อความ "${t}"`);
  }
  // เบสสั่งตัดทิ้ง 2026-08-04 — หัวข้อบอกอยู่แล้วว่าส่วนนี้คืออะไร การ์ดบอกว่ากดแล้วได้อะไร
  for (const t of ["ยังไม่มีสินค้า", "ยังไม่มีลาย", "ยังไม่มีส่วนเสริม"]) {
    if (html.includes(t)) problems.push(`ยังมีข้อความ "${t}" (เบสสั่งเอาออก)`);
  }
  // การ์ดต้องกินเต็มแถว (เบส: "พื้นที่ปุ่ม CTA เอาเต็มแถวเลย")
  if (cards.some((c) => !c.split(/\s+/).includes("w-full"))) {
    problems.push("การ์ดขอบประบางใบไม่ได้ w-full");
  }
  // สินค้า 3 ใบ + ลาย 1 + ส่วนเสริม 1 · ทุกใบต้องใช้คลาสชุดเดียวกันเป๊ะ
  if (cards.length !== 5) problems.push(`การ์ดขอบประควรมี 5 ใบ แต่ได้ ${cards.length}`);
  if (new Set(cards).size > 1) problems.push("การ์ดขอบประใช้คลาสไม่เหมือนกันทุกใบ");
  if (html.includes("<thead")) problems.push('ตอนว่างต้องไม่มีหัวตาราง (เบสเคาะ "เอาหัวตารางออก")');
  if (problems.length) {
    failed++;
    console.log("❌ การ์ดชุดงานตอนว่าง 3 ส่วนไม่เหมือนกัน");
    problems.forEach((x) => console.log(`   ${x}`));
  } else {
    console.log("✅ การ์ดชุดงานตอนว่าง — สินค้า/ลาย/ส่วนเสริม หน้าตาเดียวกัน");
  }
}

console.log(failed ? `\n❌ ไม่ผ่าน ${failed} ข้อ` : "\n✅ ผ่านครบ");
process.exit(failed ? 1 : 0);
