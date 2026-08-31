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
import { join, sep } from "node:path";
import { Factory } from "lucide-react";
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
  ACTIVE_UNDERLINE,
  DASHED,
  DASHED_INTERACTIVE,
  FOCUS_BUTTON,
  FOCUS_FIELD,
  FOCUS_INSET,
  INTERACTIVE_CHROME_HOVER,
  INTERACTIVE_CHROME_PRESSED,
  INTERACTIVE_PAGE_HOVER,
  INTERACTIVE_PAGE_PRESSED,
  RAISED_CONTROL_SURFACE,
  SUNK_PANEL,
} from "../src/components/ui/tokens";
import {
  CONTROL_H,
  CONTROL_H_SM,
} from "../src/components/ui/control-size";
import { PageHeader } from "../src/components/page-header";
import { ContextPanel } from "../src/components/ui/context-panel";
import { HelpTip } from "../src/components/ui/help-tip";
import { VISUAL_TONE_CLASSES } from "../src/lib/visual-tone";

let failed = 0;
const globalsSource = readFileSync("src/app/globals.css", "utf8");

function tsxFilesUnder(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...tsxFilesUnder(path));
    else if (name.endsWith(".tsx")) files.push(path);
  }
  return files;
}

/** เว้นจำนวนบรรทัดเดิมไว้เพื่อให้รายงาน file:line ยังชี้ถูก แต่ไม่สแกนข้อความใน comment */
function withoutSourceComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

/** อ่านเฉพาะ opening tag โดยไม่หยุดผิดที่ลูกศร `=>` ใน JSX expression */
function jsxOpeningTags(
  source: string,
  tag:
    | "Button"
    | "Input"
    | "Select"
    | "Textarea"
    | "Link"
    | "button"
    | "a"
    | "Label"
    | "label",
) {
  const tags: Array<{ index: number; text: string }> = [];
  const needle = `<${tag}`;
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(needle, cursor);
    if (start < 0) break;
    const boundary = source[start + needle.length];
    if (boundary && !/[\s/>]/.test(boundary)) {
      cursor = start + needle.length;
      continue;
    }

    let braces = 0;
    let quote: "\"" | "'" | "`" | null = null;
    let escaped = false;
    let end = start + needle.length;
    for (; end < source.length; end++) {
      const char = source[end]!;
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") quote = char;
      else if (char === "{") braces++;
      else if (char === "}") braces = Math.max(0, braces - 1);
      else if (char === ">" && braces === 0) {
        end++;
        break;
      }
    }
    tags.push({ index: start, text: source.slice(start, end) });
    cursor = Math.max(end, start + needle.length);
  }
  return tags;
}

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

{
  const layoutSource = readFileSync("src/app/layout.tsx", "utf8");
  const labelSource = readFileSync("src/components/ui/label.tsx", "utf8");
  const dialogSource = readFileSync("src/components/ui/dialog.tsx", "utf8");
  const pageHeaderSource = readFileSync("src/components/page-header.tsx", "utf8");
  const dataTableSource = readFileSync("src/components/ui/data-table.tsx", "utf8");
  const buttonSource = readFileSync("src/components/ui/button.tsx", "utf8");
  const expectedScale = [
    ["2xs", "11px", "1.125rem"],
    ["xs", "12px", "1.125rem"],
    ["sm", "14px", "1.375rem"],
    ["base", "16px", "1.5rem"],
    ["lg", "18px", "1.75rem"],
    ["xl", "20px", "1.875rem"],
    ["2xl", "24px", "1.3"],
    ["3xl", "28px", "1.25"],
  ] as const;
  const roleContractOk =
    expectedScale.every(
      ([role, size, lineHeight]) =>
        globalsSource.includes(`--text-${role}: ${size};`) &&
        globalsSource.includes(`--text-${role}--line-height: ${lineHeight};`),
    ) &&
    layoutSource.includes('weight: ["400", "500", "600", "700"]') &&
    !layoutSource.includes('"300"') &&
    pageHeaderSource.includes("text-2xl font-semibold text-strong") &&
    dialogSource.includes("text-lg font-semibold text-strong") &&
    labelSource.includes("text-sm font-medium text-secondary") &&
    dataTableSource.includes('table className="w-full text-sm"') &&
    buttonSource.includes("text-sm font-semibold");

  const compressedType: string[] = [];
  const primitiveOverrides: string[] = [];
  const invalidMicroType: string[] = [];
  const printRoots = ["src/app/(print)/", "src/components/print/"];
  const statusMicroFiles = new Set([
    "src/components/ui/status-label.tsx",
    "src/components/orders/detail/order-status-bar.tsx",
    "src/components/production/production-route-rail.tsx",
    "src/components/production/production-freshness.tsx",
  ]);
  /* หน้าลอง (/proto) ไม่อยู่ในด่านนี้ — เป็นที่ทดลอง "หน้าตา" ก่อนเคาะ จึงต้อง
     ลองระยะตัวอักษร/ความสูงบรรทัดนอกบันไดกลางได้ · ไม่มีผู้ใช้จริงเห็น (noindex,
     ข้อมูลปลอม) และเมื่อเคาะแล้วโค้ดจะถูกเขียนใหม่ในของจริงซึ่งโดนด่านนี้เต็ม ๆ */
  for (const path of tsxFilesUnder("src")) {
    if (path.startsWith("src/app/proto/")) continue;
    const source = readFileSync(path, "utf8");
    const lineOf = (index: number) => source.slice(0, index).split("\n").length;

    for (const tag of ["Button", "Input", "Select", "Textarea"] as const) {
      for (const opening of jsxOpeningTags(source, tag)) {
        const codeOnly = opening.text
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
          .replace(/\/\/[^\n]*/g, "");
        const callerShrinksDesktop = /\b(?:[a-z0-9-]+:)*text-(?:2xs|xs)\b/.test(codeOnly);
        const callerShrinksMobileControl =
          tag !== "Button" && /(?:["'\s,(])text-sm\b/.test(codeOnly);
        if (callerShrinksDesktop || callerShrinksMobileControl) {
          primitiveOverrides.push(`${path}:${lineOf(opening.index)} (${tag})`);
        }
      }
    }
    for (const tag of ["Link", "button", "a", "Label", "label"] as const) {
      for (const opening of jsxOpeningTags(source, tag)) {
        const codeOnly = opening.text
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
          .replace(/\/\/[^\n]*/g, "");
        if (/\btext-2xs\b/.test(codeOnly)) {
          primitiveOverrides.push(`${path}:${lineOf(opening.index)} (${tag})`);
        }
      }
    }

    if (printRoots.some((root) => path.startsWith(root))) continue;
    withoutSourceComments(source).split("\n").forEach((line, index) => {
      const hasTrackingOverride =
        /\btracking-(?:tighter|tight|wide|wider|widest)\b/.test(line) ||
        /\btracking-\[[^\]]+\]/.test(line);
      const hasCompressedLeading = /\bleading-(?:tight|snug)\b/.test(line);
      const hasNonNumericLeadingNone =
        /\bleading-none\b/.test(line) && !/\btabular-nums\b/.test(line);
      if (hasTrackingOverride || hasCompressedLeading || hasNonNumericLeadingNone) {
        compressedType.push(`${path}:${index + 1}`);
      }
      if (
        /\btext-2xs\b/.test(line) &&
        !/\btabular-nums\b/.test(line) &&
        !statusMicroFiles.has(path)
      ) {
        invalidMicroType.push(`${path}:${index + 1}`);
      }
    });
  }

  if (
    !roleContractOk ||
    compressedType.length ||
    primitiveOverrides.length ||
    invalidMicroType.length
  ) {
    failed++;
    console.log("❌ typography ต้องใช้ role กลางของ Prompt และ caller ห้ามบีบข้อความ/primitive ลงเอง");
    if (!roleContractOk) console.log("   role scale/font weights/primitive contract ไม่ตรงค่าที่เคาะ");
    compressedType.slice(0, 20).forEach((offender) => console.log(`   ${offender} (tracking/leading)`));
    primitiveOverrides.slice(0, 20).forEach((offender) => console.log(`   ${offender} (font-size override)`));
    invalidMicroType.slice(0, 20).forEach((offender) => console.log(`   ${offender} (11px outside status/counter)`));
  } else {
    console.log("✅ typography ใช้ Prompt role กลาง · 11px เฉพาะ status/counter · control primitive ไม่ถูก caller ลดขนาด");
  }
}

{
  const headerHtml = renderToStaticMarkup(<PageHeader title="ควบคุมการผลิต" />);
  const contextHtml = renderToStaticMarkup(
    <ContextPanel title="ข้อมูลประกอบ">ข้อความคงที่</ContextPanel>,
  );
  const helpHtml = renderToStaticMarkup(
    <HelpTip label="อายุหนี้">นับจากวันครบกำหนด</HelpTip>,
  );
  if (
    !headerHtml.includes("page-module-mark") ||
    // สีประจำหมวดกลับมาแล้ว 2026-08-31 (แบบ B) — หน้าผลิตต้องได้โทน production
    // แบบ "พื้นอ่อน" เท่านั้น · กล่องสีทึบ (.solid) ถูกปฏิเสธไปแล้ว 23 ส.ค. ห้ามกลับมา
    !headerHtml.includes("bg-module-production-surface") ||
    !headerHtml.includes('data-page-description=""') ||
    !headerHtml.includes("ดูคิวผลิต งานที่ติดขัด และขั้นตอนที่ต้องจัดการต่อ") ||
    headerHtml.includes("bg-module-production-solid") ||
    headerHtml.includes("shadow-sm") ||
    !headerHtml.includes("data-page-identity") ||
    contextHtml.includes('role="alert"') ||
    helpHtml.includes('role="alert"') ||
    !helpHtml.includes("ดูคำอธิบาย: อายุหนี้")
  ) {
    failed++;
    console.log("❌ visual identity กลางต้องใช้ไอคอนเส้นเรียบและ ContextPanel ห้ามปลอมเป็น alert");
  } else {
    console.log("✅ visual identity กลางใช้ไอคอนเส้นเรียบและ semantic role ถูกต้อง");
  }
}

{
  const registrySources = [
    "src/components/orders/orders-page.tsx",
    "src/app/(dashboard)/customers/page.tsx",
    "src/app/(dashboard)/quotations/page.tsx",
    "src/app/(dashboard)/billing/page.tsx",
    "src/app/(dashboard)/settings/users/page.tsx",
    "src/app/(dashboard)/outsource/page.tsx",
  ].map((file) => readFileSync(file, "utf8"));
  const ordersSource = registrySources[0]!;
  if (
    registrySources.some((source) => source.includes("EntityMark")) ||
    !ordersSource.includes("MockupThumbnail") ||
    !ordersSource.includes("mockupCoverImage") ||
    ordersSource.includes('data-order-mockup="empty"') ||
    ordersSource.includes("reserveSpace") ||
    ordersSource.includes("orderMockupCover")
  ) {
    failed++;
    console.log("❌ registry ต้องไร้ object icon และออเดอร์ต้องใช้ MockupThumbnail ชุดเดียวกับคิวผลิตทั้งรูปจริง/ช่องว่าง");
  } else {
    console.log("✅ registry ไร้ object icon และออเดอร์ใช้ MockupThumbnail ชุดเดียวกับคิวผลิต");
  }
}

{
  const appShellSource = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  const sidebarBrandHeaderSource =
    appShellSource.match(
      /<div\s+data-sidebar-brand-header[\s\S]*?<\/div>/,
    )?.[0] ?? "";
  const sidebarNavigationSource =
    appShellSource.match(
      /<nav\s+id="app-sidebar-navigation"[\s\S]*?<\/nav>/,
    )?.[0] ?? "";
  const sidebarCollapseButtonSource =
    appShellSource.match(
      /function SidebarCollapseButton[\s\S]*?\n}\n\nfunction sidebarNavIconClass/,
    )?.[0] ?? "";
  if (
    // ความกว้างเมนูซ้ายมาจากตัวแปร ไม่ใช่ค่าคงที่ ตั้งแต่มีโหมดหุบ/กาง (2026-08-26)
    // ยังล็อกไว้ว่าคอลัมน์ขวาต้อง minmax(0,1fr) และค่าทั้งสองสถานะต้องประกาศจริง
    !appShellSource.includes('lg:grid-cols-[var(--app-sidebar-w)_minmax(0,1fr)]') ||
    !appShellSource.includes('"--app-sidebar-w": sidebarCollapsed ? "4rem" : "15rem"') ||
    // สถานะหุบต้องมาจาก store ภายนอก ไม่ใช่ useState+useEffect (กัน SSR/client ต่างกัน)
    !appShellSource.includes("useSyncExternalStore") ||
    // หุบแล้วชื่อเมนูหายจากจอ ต้องเหลือชื่อไว้ให้เมาส์และเครื่องอ่านหน้าจอ
    !appShellSource.includes("title={sidebarCollapsed ? item.label : undefined}") ||
    // แถบบน หัวเมนูซ้าย และแถวแรกของกริด ต้องสูงเท่ากันทั้งสามที่เสมอ
    // ไม่งั้นเส้นล่างของตรากับของแถบบนจะไม่ต่อกันเป็นเส้นเดียวข้ามจอ (เคยพลาดมาแล้ว)
    !appShellSource.includes("grid-rows-[3.5rem_minmax(0,1fr)]") ||
    (appShellSource.match(/flex h-14 /g)?.length ?? 0) !== 2 ||
    // ตอนหุบต้องจองรางแถบเลื่อนสองข้าง ไม่งั้นแถบเลื่อน 10px ดันไอคอนไปทางซ้าย 5px
    // และต้องถอดระยะขอบข้างของ nav ออกด้วย ไม่งั้นเนื้อที่จริงเหลือ 19px
    // จนปุ่มเมนูถูกบีบเหลือกว้าง 24px สูง 36px = อ่านเป็นเม็ดยา (วัดจริง 2026-08-26)
    !appShellSource.includes('sidebarCollapsed && "px-0 [scrollbar-gutter:stable_both-edges]"') ||
    // ปุ่มเมนูตอนหุบต้องเป็นสี่เหลี่ยมจัตุรัส 40px วางกลางราง
    !appShellSource.includes('collapsed && "mx-auto h-10 w-10 justify-center gap-0 px-0 py-0"') ||
    // ตอนหุบ ตราหายทั้งก้อน เหลือปุ่มยืนกลางราง 64px (เบสเคาะ 2026-08-28)
    // ราง 64px วางตรา 28px กับเป้ากด 36px คู่กันไม่ได้โดยไม่ทับกัน — เรขาคณิต ไม่ใช่รสนิยม
    // ห้ามกลับไปคง sr-only ให้ตราตอนหุบ เพราะตราจะแย่งที่กับปุ่มอีก
    !sidebarBrandHeaderSource.includes("{!sidebarCollapsed && (") ||
    !sidebarBrandHeaderSource.includes('sidebarCollapsed ? "justify-center px-0" : "pl-6 pr-1"') ||
    sidebarBrandHeaderSource.includes('sidebarCollapsed && "sr-only"') ||
    // ปุ่มอยู่ในหัวเมนูตำแหน่งเดียวทั้งสองสถานะ ห้ามย้ายข้ามเส้นแบ่งไป topbar อีก
    // visual/hit area/feedback ใช้ Button มาตรฐานชุดเดียว ไม่คาบ divider หรือสร้าง focus proxy
    !sidebarBrandHeaderSource.includes("relative flex h-14") ||
    !sidebarCollapseButtonSource.includes("data-sidebar-collapse-toggle") ||
    sidebarCollapseButtonSource.includes("data-sidebar-collapse-slot") ||
    sidebarCollapseButtonSource.includes("data-sidebar-collapse-placement") ||
    sidebarCollapseButtonSource.includes("absolute left-full") ||
    !appShellSource.includes(
      '<aside className="hidden min-h-0 border-r border-divider bg-chrome lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col">',
    ) ||
    !appShellSource.includes(
      'className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-1 items-center gap-2 px-4 sm:px-6 lg:px-8"',
    ) ||
    !sidebarCollapseButtonSource.includes('!collapsed && "ml-auto"') ||
    !sidebarCollapseButtonSource.includes('type="button"') ||
    !sidebarCollapseButtonSource.includes('variant="ghost"') ||
    sidebarCollapseButtonSource.includes("variant={null}") ||
    !sidebarCollapseButtonSource.includes('size="icon"') ||
    !sidebarCollapseButtonSource.includes("onClick={() => writeSidebarCollapsed(!collapsed)}") ||
    !sidebarCollapseButtonSource.includes("aria-expanded={!collapsed}") ||
    !sidebarCollapseButtonSource.includes('aria-controls="app-sidebar-navigation"') ||
    !sidebarCollapseButtonSource.includes("aria-label={label}") ||
    !sidebarCollapseButtonSource.includes("bg-transparent p-0") ||
    !sidebarCollapseButtonSource.includes("text-muted") ||
    !sidebarCollapseButtonSource.includes("INTERACTIVE_CHROME_HOVER") ||
    !sidebarCollapseButtonSource.includes("INTERACTIVE_CHROME_PRESSED") ||
    // ไอคอนตัวเดียวจบตามมาตรฐาน shadcn — ไอคอนคู่ทำให้ต้องเดาว่ามันบอกสถานะตอนนี้
    // หรือผลลัพธ์เมื่อกด · สถานะบอกด้วย aria-expanded + ชื่อปุ่มแทน
    !sidebarCollapseButtonSource.includes("<PanelLeft ") ||
    sidebarCollapseButtonSource.includes("PanelLeftOpen") ||
    sidebarCollapseButtonSource.includes("PanelLeftClose") ||
    !sidebarCollapseButtonSource.includes('className="!size-4"') ||
    sidebarCollapseButtonSource.includes("ChevronLeft") ||
    sidebarCollapseButtonSource.includes("<ChevronRight") ||
    sidebarCollapseButtonSource.includes("-right-") ||
    sidebarCollapseButtonSource.includes("-translate-y-1/2") ||
    sidebarCollapseButtonSource.includes("data-sidebar-collapse-handle") ||
    sidebarCollapseButtonSource.includes("rounded-r-md") ||
    sidebarCollapseButtonSource.includes("border-divider bg-chrome") ||
    sidebarCollapseButtonSource.includes("pl-3") ||
    sidebarCollapseButtonSource.includes("translate-x-") ||
    sidebarCollapseButtonSource.includes("data-sidebar-collapse-visual") ||
    sidebarCollapseButtonSource.includes("group/sidebar-collapse") ||
    sidebarCollapseButtonSource.includes("focus-visible:ring-0") ||
    sidebarCollapseButtonSource.includes("justify-start") ||
    sidebarCollapseButtonSource.includes("rounded-full") ||
    sidebarCollapseButtonSource.includes(" border ") ||
    sidebarCollapseButtonSource.includes(" border-") ||
    sidebarCollapseButtonSource.includes("border-border-strong") ||
    sidebarCollapseButtonSource.includes("<SidebarBrandMark") ||
    // ปุ่มตัวเดิมต้องอยู่ในหัว sidebar ตลอดเพื่อรักษา focus ตอนกาง/หุบ
    // และห้ามมี SidebarCollapseButton แทรกอยู่ใน nav ไม่ว่าจะใช้ class อะไร
    !sidebarBrandHeaderSource.includes("<SidebarCollapseButton") ||
    !sidebarBrandHeaderSource.includes("collapsed={sidebarCollapsed}") ||
    !/<\/Link>\s*\)\}\s*<SidebarCollapseButton/.test(sidebarBrandHeaderSource) ||
    appShellSource.includes("aria-pressed={collapsed}") ||
    !sidebarNavigationSource ||
    sidebarNavigationSource.includes("<SidebarCollapseButton") ||
    !appShellSource.includes("aria-label={sidebarCollapsed ? item.label : undefined}") ||
    // จุดกะพริบตอนกดเมนูถูกถอดออกถาวร (เบสสั่ง 2026-08-26 "ไม่ชอบเวลากดเลือกหัวข้อแล้วมีจุด")
    // loading.tsx เป็นสัญญาณ "ระบบรับรู้แล้ว" หลักอยู่แล้ว · เช็คการใช้งานจริง ไม่ใช่คำในคอมเมนต์
    appShellSource.includes("<NavPendingMark") ||
    appShellSource.includes("useLinkStatus") ||
    !appShellSource.includes("SidebarGroupLabel") ||
    appShellSource.includes("data-active-group") ||
    appShellSource.includes('groupActive && "bg-surface-muted"') ||
    /* ⚠️ ข้อนี้เคยห้ามคำว่า NAVIGATION_GROUP_TONE ทั้งไฟล์ (ตั้งไว้ตอน "make sidebar
       minimal" 23 ส.ค. ซึ่งถอดของสองอย่างออก: **แท่งสีทึบข้างหัวหมวด** กับไอคอน
       ที่ได้สีเฉพาะตอนถูกเลือก) — ตั้งแต่เบสเคาะแบบ B "สีบอกหมวด" (31 ส.ค.)
       เมนูซ้ายคือที่ที่สีหมวดทำงานหนักที่สุด ไอคอนจึงได้สีประจำหมวด **ตลอดเวลา**
       (ไม่ใช่เฉพาะตอนเลือก — สีบอก "หมวดอะไร" ไม่ได้บอก "เลือกอยู่ไหม")

       สิ่งที่ยังห้ามเหมือนเดิมและคือใจความจริงของข้อนี้: หมวดต้องไม่มีพื้นครอบ
       และต้องไม่มีแท่งสีทึบข้างหัวหมวด — โครงเมนูยังแบน */
    /\.solid\b/.test(appShellSource) ||
    !appShellSource.includes("NAVIGATION_GROUP_TONE[item.group]") ||
    !appShellSource.includes('aria-label="เมนูหลักบนมือถือ"') ||
    !appShellSource.includes('groupedNavigationItems("sidebar", me?.permissions)')
  ) {
    failed++;
    console.log("❌ Sidebar ต้องเป็นโครงแบน ไม่มีพื้น/สีครอบหมวด และคง mobile navigation/permission registry เดิม");
  } else {
    console.log("✅ Sidebar เป็นโครงแบน minimal และคง navigation contract เดิม");
  }
}

{
  /* หัวจอสองตัวนี้เคยถูกล็อกด้วยกฎเดียวกัน ("ไอคอนเส้นล้วน ไม่มีพื้น") แต่บทบาทของมันคนละอย่าง
     - จอสถานี: ไอคอนคือ "สถานีไหน" — เปลี่ยนตามสถานีจริง จึงเป็นไอคอนโมดูลและต้องเป็นเส้นล้วนต่อไป
     - Factory TV: ไอคอนเดิมเป็นรูปโรงงานประดับเฉย ๆ ไม่ได้บอกอะไร · ตั้งแต่ 2026-08-26 ที่ตรงนั้น
       คือ "ตราสัญลักษณ์" เพราะจอนี้ไม่มี sidebar/topbar ทั้งจอจึงไม่เคยมีคำว่า Anajak อยู่เลย
       ตราไม่อยู่ใต้กติกาสงวนสี (เหตุผลเดียวกับที่โลโก้บนแถบบนหลุดไปเป็นเทาแล้วต้องคืน)
     ข้อห้ามพื้นโมดูลทึบกับเงายังใช้กับทั้งคู่เหมือนเดิม */
  const stationShellSource = readFileSync(
    "src/components/factory/station-mode-shell.tsx",
    "utf8",
  );
  const factoryBoardSources = [
    readFileSync("src/app/factory/page.tsx", "utf8"),
    readFileSync("src/components/factory/manufacturing-factory-board.tsx", "utf8"),
  ];
  const noSolidModuleFill = [stationShellSource, ...factoryBoardSources].every(
    (source) =>
      !source.includes("bg-module-production-solid") && !source.includes("shadow-sm"),
  );
  if (
    !noSolidModuleFill ||
    !stationShellSource.includes("text-module-production-text") ||
    !factoryBoardSources.every(
      (source) => source.includes("bg-blue-600 text-white") && source.includes("Anajak Print"),
    )
  ) {
    failed++;
    console.log(
      "❌ หัวจอสถานีต้องเป็นไอคอนเส้นล้วน · หัว Factory TV ต้องมีตรา Anajak · ห้ามพื้นโมดูลทึบหรือเงา",
    );
  } else {
    console.log("✅ หัวจอสถานีเป็นไอคอนเส้นล้วน · หัว Factory TV มีตรา Anajak");
  }
}

{
  const primary = colorValues("anajak-blue")[0];
  const toneNames = ["brand", "production", "product", "finance", "system"] as const;
  const missingToneClass = toneNames.some((tone) =>
    Object.values(VISUAL_TONE_CLASSES[tone]).some((value) => !value.includes(`module-${tone}`)),
  );
  if (primary !== "#3973b2" || missingToneClass) {
    failed++;
    console.log("❌ Industrial Fresh ต้องคง Anajak Blue และอ้าง module token กลาง");
  } else {
    console.log("✅ Industrial Fresh คง Anajak Blue และใช้ module token กลาง");
  }

  for (const tone of toneNames) {
    const foregrounds = colorValues(`module-${tone}-text`);
    const backgrounds = colorValues(`module-${tone}-surface`);
    checkContrast(`${tone} Light text/surface`, hexRgb(foregrounds[0]!), hexRgb(backgrounds[0]!), 4.5);
    checkContrast(`${tone} Dark text/surface`, hexRgb(foregrounds[1]!), hexRgb(backgrounds[1]!), 4.5);
    checkContrast(`${tone} marker/white`, hexRgb(colorValues(`module-${tone}-solid`)[0]!), [255, 255, 255], 3);
  }
}

{
  const headerSource = readFileSync("src/components/page-header.tsx", "utf8");
  const shellSource = readFileSync("src/components/page-shell.tsx", "utf8");
  const sectionSource = readFileSync("src/components/ui/section.tsx", "utf8");
  const identitySource = readFileSync("src/lib/page-identity.tsx", "utf8");
  const shellHeaderContract = shellSource.slice(0, shellSource.indexOf("  // ---- สถานะของหน้า ----"));
  const pageHelpSources = [
    readFileSync("src/app/(dashboard)/outsource/page.tsx", "utf8"),
    readFileSync("src/app/(dashboard)/production/films/page.tsx", "utf8"),
    readFileSync("src/components/production/print-runs-screen.tsx", "utf8"),
    readFileSync("src/app/(dashboard)/settings/company/page.tsx", "utf8"),
    readFileSync("src/app/(dashboard)/settings/vendors/page.tsx", "utf8"),
  ].join("\n");
  if (
    !/description\?\s*:/.test(headerSource) ||
    !/description\?\s*:/.test(shellHeaderContract) ||
    /description\?\s*:/.test(sectionSource) ||
    !headerSource.includes("data-page-description") ||
    !identitySource.includes("pageDescriptionForLabel") ||
    /help=\"(?:ติดตามกำหนดรับ|ค้นหาฟิล์ม|เปิดรอบจากคิว|ข้อมูลนี้ใช้บนหัวเอกสาร|ทะเบียนร้านสำหรับงาน)/.test(pageHelpSources)
  ) {
    failed++;
    console.log("❌ ทุกหน้าต้องมี description สั้นที่เห็นตรง และ Section/คำอธิบายทั่วไปห้ามสร้าง tooltip เกินจำเป็น");
  } else {
    console.log("✅ ทุกหน้ามี description สั้น ส่วน meta/HelpTip แยกตามหน้าที่");
  }
}

{
  const dashboardSources = readdirSync("src/app/(dashboard)", { recursive: true })
    .filter((name): name is string => typeof name === "string" && name.endsWith("page.tsx"))
    .map((name) => readFileSync(join("src/app/(dashboard)", name), "utf8"))
    .join("\n");
  const forbiddenCopy = [/npm run db:seed:demo/, /demo local/i, /demo-local/i];
  if (forbiddenCopy.some((pattern) => pattern.test(dashboardSources))) {
    failed++;
    console.log("❌ dashboard มีคำสั่งพัฒนาหรือชื่อโหมดภายในหลุดไปยังข้อความ UI");
  } else {
    console.log("✅ dashboard ไม่มีคำสั่งพัฒนาหรือชื่อโหมดภายในในข้อความ UI");
  }
}

check(
  "ขอบประตอนพักเบาแบบเดิมและมีคู่ Dark",
  `<div class="${DASHED}"></div>`,
  ["border", "border-dashed", "border-slate-300", "dark:border-slate-700"],
  ["border-border-strong"],
);
check(
  "ขอบประที่กดได้ยกเส้นขึ้นทั้ง Light/Dark",
  `<button class="${DASHED_INTERACTIVE}"></button>`,
  ["border-slate-300", "dark:border-slate-700", "hover:border-border-strong", "dark:hover:border-border-strong"],
  ["border-border-strong"],
);
checkContrastWindow(
  "light ขอบประ resting บน surface",
  hexRgb(colorValues("slate-300")[0]!),
  hexRgb(colorValues("surface")[0]!),
  1.35,
  1.85,
);
checkContrastWindow(
  "dark ขอบประ resting บน surface",
  hexRgb(colorValues("slate-700")[1]!),
  hexRgb(colorValues("surface")[1]!),
  1.25,
  1.95,
);

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
check("ช่องกรอก (Input)", renderToStaticMarkup(<Input />), [...h, ...FIELD, "rounded-md"], [...FIELD_NO, "rounded-2xl", "rounded-lg"]);
check(
  "ช่องเลือก (Select)",
  renderToStaticMarkup(<Select value="" onChange={() => {}}><option value="">ก</option></Select>),
  [...h, ...FIELD, "rounded-md"],
  [...FIELD_NO, "rounded-2xl"],
);
check("กล่องข้อความ (Textarea)", renderToStaticMarkup(<Textarea />), [...FIELD, "rounded-md", "min-h-24"], [...FIELD_NO, "rounded-2xl", "rounded-lg"]);
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

// ② compatibility shape เดิมต้องถูกยุบเป็น control ทรงธรรมดา
check("ช่องกรอก compatibility pill ใช้ทรงธรรมดา", renderToStaticMarkup(<Input shape="pill" />), ["rounded-md"], ["rounded-full"]);
check(
  "ช่องเลือก compatibility pill ใช้ทรงธรรมดา",
  renderToStaticMarkup(<Select shape="pill" value="" onChange={() => {}}><option value="">ก</option></Select>),
  ["rounded-md"],
  ["rounded-full"],
);
check(
  "ช่องเลือก inline โปร่งตอนพักแต่คงเส้น focus จริง",
  renderToStaticMarkup(<Select surface="inline" value="" onChange={() => {}}><option value="">ก</option></Select>),
  ["border-transparent", "bg-transparent", "focus-visible:border-blue-500", "focus-visible:ring-2"],
  ["border-0", "border-field-border", "bg-field", "shadow-sm"],
);

// Toolbar ยืนบน workspace off-white จึงใช้พื้น panel ขาว + boundary บางแบบ Vercel
{
  const searchHtml = renderToStaticMarkup(
    <SearchInput surface="raised" />,
  );
  const searchControl = searchHtml.match(/<input[^>]*>/)?.[0] ?? "";
  check(
    "ช่องค้นหาแบบยกบนผืนหน้า",
    searchControl,
    ["bg-surface", "shadow-none", "border-field-border"],
    ["bg-transparent", "shadow-sm", "border-transparent"],
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
    "ช่วงวันที่ active คงรูปทรงเรียบและใช้ Anajak Blue",
    dateTrigger,
    ["border-blue-600", "text-blue-700", "bg-transparent", "shadow-none"],
    ["bg-interactive-selected", "shadow-sm"],
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
    "ปุ่มตัวกรอง active คงรูปทรงเรียบและใช้ Anajak Blue",
    filterTrigger,
    ["border-blue-600", "text-blue-700", "bg-transparent", "shadow-none"],
    ["bg-interactive-selected", "shadow-sm"],
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
  "rounded-md",
  "focus-visible:ring-2",
  "focus-visible:ring-blue-500",
  "focus-visible:ring-offset-2",
  // ช่องว่างรอบวงแหวนต้องโปร่ง ให้โชว์พื้นที่อยู่ข้างหลังจริง ไม่ว่าปุ่มจะไปยืนบนพื้นอะไร
  // (เคยผูกกับ ring-offset-bg แล้วปุ่มในการ์ดขาวได้แถบเทาคาด หลังผืนงานเปลี่ยนเป็นเทา)
  "focus-visible:ring-offset-transparent",
], [
  "focus-visible:ring-blue-500/15",
  "focus-visible:ring-offset-white",
  "focus-visible:ring-offset-bg",
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
    ["border-border", "bg-surface", "shadow-none"],
    ["border-transparent", "border-field-border", "bg-field", "bg-transparent", "bg-surface-muted", "shadow-sm"],
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

// ตัวกรองพักเป็น neutral; สถานะเลือกใช้เส้น+ข้อความ Anajak Blue โดยไม่วาดพื้น/กล่อง/เงา
// และ aria-pressed บอก assistive tech
{
  const selected = renderToStaticMarkup(
    <FilterChip selected onClick={() => {}}>เลือกแล้ว</FilterChip>,
  );
  const idle = renderToStaticMarkup(
    <FilterChip selected={false} onClick={() => {}}>ยังไม่เลือก</FilterChip>,
  );
  const selectedWithIcon = renderToStaticMarkup(
    <FilterChip
      selected
      onClick={() => {}}
      icon={<Factory aria-hidden="true" className="h-4 w-4" />}
    >
      เลือกแล้ว
    </FilterChip>,
  );
  const idleWithIcon = renderToStaticMarkup(
    <FilterChip
      selected={false}
      onClick={() => {}}
      icon={<Factory aria-hidden="true" className="h-4 w-4" />}
    >
      ยังไม่เลือก
    </FilterChip>,
  );
  if (
    !selected.includes('aria-pressed="true"') ||
    !selected.includes("border-b-2") ||
    !selected.includes("border-blue-600") ||
    !selected.includes("text-blue-700") ||
    !selected.includes("dark:border-blue-400") ||
    !selected.includes("dark:text-blue-400") ||
    !selected.includes("font-semibold") ||
    !selected.includes("bg-transparent") ||
    selected.includes("rounded-lg") ||
    selected.includes("rounded-full") ||
    selected.includes("shadow-sm") ||
    selected.includes("bg-interactive-selected") ||
    selected.includes("text-interactive-selected-text") ||
    selected.includes("border-slate-900") ||
    selected.includes("dark:border-white") ||
    selected.includes("lucide-check") ||
    !idle.includes('aria-pressed="false"') ||
    idle.includes("invisible") ||
    idle.includes("lucide-check") ||
    !selectedWithIcon.includes("lucide-factory") ||
    selectedWithIcon.includes("lucide-check") ||
    !idleWithIcon.includes("lucide-factory") ||
    idleWithIcon.includes("lucide-check")
  ) {
    failed++;
    console.log("❌ ตัวกรองต้องพักเป็น neutral และใช้เส้น+ข้อความ Anajak Blue เมื่อเลือก โดยไม่มีพื้น/กล่อง/เงา");
  } else {
    console.log("✅ ตัวกรองพักเป็น neutral และใช้ Anajak Blue เมื่อเลือก พร้อม aria-pressed/icon");
  }
}

// next-themes ต้องคง bootstrap ที่ execute ได้ตอน SSR เพื่อกันธีมกระพริบ
// แต่ทุก provider ที่อาจ mount ใหม่ฝั่ง client ต้องส่งเป็น data block ให้ React 19.2
// ไม่พยายาม execute <script> ที่เพิ่งสร้างระหว่าง Fast Refresh/Suspense
{
  const providersSource = readFileSync("src/components/providers.tsx", "utf8");
  const scriptPropUsages =
    providersSource.match(
      /scriptProps=\{THEME_BOOTSTRAP_SCRIPT_PROPS\}/g,
    ) ?? [];

  if (
    !providersSource.includes(
      'type: typeof window === "undefined" ? "text/javascript" : "text/plain"',
    ) ||
    scriptPropUsages.length !== 2
  ) {
    failed++;
    console.log(
      "❌ theme bootstrap ต้อง execute ตอน SSR และเป็น data block ทุก client remount",
    );
  } else {
    console.log(
      "✅ theme bootstrap แยก SSR executable / client data block ครบทุก provider",
    );
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

// ⑥ ตารางอ่านสี/ขนาดจาก contract กลาง: หัวโปร่งตาม surface แม่ และข้อมูลทุกระดับ 14px
check(
  "หัวตารางโปร่งตามพื้นแม่และใช้ divider กลาง",
  renderToStaticMarkup(
    <table>
      <DataTable.Head>
        <tr><DataTable.Th>หัว</DataTable.Th></tr>
      </DataTable.Head>
    </table>,
  ),
  ["border-divider", "bg-transparent", "text-secondary"],
  ["bg-surface", "bg-surface-muted", "bg-slate-50", "bg-slate-100"],
);

check(
  "ข้อมูลทุกระดับในเซลล์ตารางเป็น 14px",
  renderToStaticMarkup(
    <table>
      <DataTable.Body>
        <tr><DataTable.Td><span>ข้อมูลรอง</span></DataTable.Td></tr>
      </DataTable.Body>
    </table>,
  ),
  [
    "divide-y",
    "divide-divider",
    "[&amp;_td]:text-sm",
    "[&amp;_td_:not(:is(button,button_*,input,input_*,select,select_*,textarea,textarea_*,[role=combobox],[role=combobox]_*))]:text-sm",
  ],
);

{
  const offenders: string[] = [];
  const rawTableOffenders: string[] = [];
  const semanticOffenders: string[] = [];
  for (const path of tsxFilesUnder("src")) {
    const source = withoutSourceComments(readFileSync(path, "utf8"));
    for (const match of source.matchAll(/<DataTable\.Head\b([^>]*)>/g)) {
      if (/\bbg-[\w[\]/.-]+/.test(match[1] ?? "")) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${path}:${line} (caller ทับสีหัวตาราง)`);
      }
    }
    for (const match of source.matchAll(/<DataTable\.Body\b([^>]*)>/g)) {
      if (/\[&_td(?:_\*)?\]:text-/.test(match[1] ?? "")) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${path}:${line} (caller ทับขนาดข้อมูลตาราง)`);
      }
    }
    for (const match of source.matchAll(/<DataTable\.Head\b[^>]*>([\s\S]*?)<\/DataTable\.Head>/g)) {
      if ((match[1] ?? "").includes("<DataTable.Row")) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${path}:${line} (หัวตารางใช้ Row ที่มี hover)`);
      }
    }
    for (const match of source.matchAll(/<Link\b[^>]*\brole=["']listitem["'][^>]*>/g)) {
      const line = source.slice(0, match.index).split("\n").length;
      semanticOffenders.push(`${path}:${line}`);
    }

    const isDashboardRawTable =
      !path.includes(`${sep}components${sep}print${sep}`) &&
      !path.includes(`${sep}app${sep}(print)${sep}`) &&
      !path.includes(`${sep}app${sep}(public)${sep}`) &&
      !path.endsWith(`${sep}components${sep}ui${sep}data-table.tsx`);
    if (isDashboardRawTable) {
      for (const match of source.matchAll(/<thead\b([^>]*)>/g)) {
        if (!(match[1] ?? "").includes("TABLE_HEAD_SURFACE")) {
          const line = source.slice(0, match.index).split("\n").length;
          rawTableOffenders.push(`${path}:${line}`);
        }
      }
    }
  }

  if (offenders.length > 0) {
    failed++;
    console.log("❌ DataTable caller ยังทับ contract สีหัว/ขนาดข้อมูลกลาง");
    offenders.forEach((offender) => console.log(`   ${offender}`));
  } else {
    console.log("✅ DataTable caller ไม่ทับ contract สีหัว/ขนาดข้อมูลกลาง");
  }

  if (rawTableOffenders.length > 0) {
    failed++;
    console.log("❌ compact table หลังบ้านยังไม่ใช้ TABLE_HEAD_SURFACE กลาง");
    rawTableOffenders.forEach((offender) => console.log(`   ${offender}`));
  } else {
    console.log("✅ compact table หลังบ้านใช้ TABLE_HEAD_SURFACE กลางครบ");
  }

  if (semanticOffenders.length > 0) {
    failed++;
    console.log("❌ mobile list ห้ามใช้ role=listitem ทับบทบาท Link");
    semanticOffenders.forEach((offender) => console.log(`   ${offender}`));
  } else {
    console.log("✅ mobile list แยก listitem container โดยคงบทบาท Link");
  }
}

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
  const page = colorValues("bg");
  // hover วัดเทียบ --color-surface = พื้นที่แถวจริงไปยืน (UI-2026 เฟส 6 · 2026-08-26)
  //
  // เฟส 1 เคยบังคับให้ผ่านบน --color-bg ด้วย เพราะตอนนั้นทะเบียนออเดอร์ถอดกล่องครอบ
  // แถวจึงนั่งบนผืนหน้าตรง ๆ · เบสกลับคำตัดสินใจนั้นแล้ว ("การ์ดครอบ") แถวกลับไปอยู่
  // บนการ์ดขาวหมด และผืนหน้ากลายเป็นเทาจริง (#f1f2f4) — เงื่อนไขเดิมจึงบังคับให้
  // hover ต้องเข้มพอสำหรับพื้นเทา และอ่อนพอสำหรับพื้นขาวพร้อมกัน ซึ่งเป็นไปไม่ได้
  //
  // ⚠️ ของที่กดได้และ "ไม่ได้อยู่ในการ์ด" ต้องไม่ใช้คู่นี้ — ถ้ายืนบน chrome ใช้ชุด
  // chrome-* ถ้ายืนบนผืนหน้าเปล่า ๆ ให้ห่อการ์ดก่อน อย่าปรับ token ให้ผ่านทั้งสองพื้น
  //
  // เพดาน 1.16 ในธีมสว่าง: hover ที่หนักกว่านั้นจะอ่านเป็น "ถูกเลือกอยู่"
  // ไปแข่งกับ interactive-selected
  const stateContrastIsBalanced =
    tokenCountsValid && surface.length === 2 && page.length >= 2 &&
    hover.every((value, index) => {
      const hoverFromSurface = contrast(hexRgb(value), hexRgb(surface[index]!));
      const pressedFromHover = contrast(hexRgb(pressed[index]!), hexRgb(value));
      const hoverCeiling = index === 0 ? 1.16 : 1.25;
      return (
        hoverFromSurface >= 1.1 &&
        hoverFromSurface <= hoverCeiling &&
        pressedFromHover >= 1.05
      );
    });
  const chromeStateContrastIsBalanced = chromeTokenCountsValid && chromeHover.every((value, index) => {
    const hoverFromChrome = contrast(hexRgb(value), hexRgb(chrome[index]!));
    const pressedFromHover = contrast(hexRgb(chromePressed[index]!), hexRgb(value));
    return hoverFromChrome >= 1.1 && hoverFromChrome <= 1.25 && pressedFromHover >= 1.05;
  });
  /* พื้นที่สาม: ของที่กดได้แล้วยืนบน "ผืนงาน" ตรง ๆ (ปุ่มแบ่งหน้า · ปุ่มย้อนกลับบนหัวหน้า)
     เพิ่มด่านนี้ 2026-08-26 หลังพบว่าตอนผืนงานเปลี่ยนเป็นเทาจริง คู่ที่ใช้บนการ์ดขาว
     เหลือแค่ 1.03 เท่าบนผืนงาน = ชี้แล้วจอไม่ขยับ และตอนนั้นไม่มีด่านไหนจับได้เลย */
  const pageHover = colorValues("interactive-page-hover");
  const pagePressed = colorValues("interactive-page-pressed");
  const pageStateContrastIsBalanced =
    pageHover.length === 2 &&
    pagePressed.length === 2 &&
    page.length >= 2 &&
    pageHover.every((value, index) => {
      const hoverFromPage = contrast(hexRgb(value), hexRgb(page[index]!));
      const pressedFromHover = contrast(hexRgb(pagePressed[index]!), hexRgb(value));
      return hoverFromPage >= 1.1 && hoverFromPage <= 1.3 && pressedFromHover >= 1.05;
    });
  /* โครงร่างตอนโหลดต้องสูงเท่าแถวจริง ไม่งั้นพอข้อมูลมาถึงจอกระโดดทุกหน้ารายการ
     ตัวเลขนี้เคยเป็น 69px แล้วขยับเป็น 75px ตอนแถวหายใจขึ้นในเฟส 10
     ด่านนี้จับแค่ว่า "ทั้งสองที่พูดตรงกัน" — ถ้าเปลี่ยนความหนาแน่นอีกต้องวัดใหม่ */
  const skeletonSource = readFileSync("src/components/ui/page-skeleton.tsx", "utf8");
  const cellPaddingMatchesSkeleton =
    skeletonSource.includes("h-[75px]") &&
    readFileSync("src/components/ui/data-table.tsx", "utf8").includes('"px-6 py-4 text-sm text-secondary"');

  const pageTokensAreWired =
    INTERACTIVE_PAGE_HOVER.includes("bg-interactive-page-hover") &&
    INTERACTIVE_PAGE_PRESSED.includes("bg-interactive-page-pressed") &&
    // คู่ของผืนงานต้องไม่ใช่ค่าเดียวกับอีกสองคู่ ไม่งั้นการแยกคู่ก็ไม่มีความหมาย
    // (ส่วน chrome กับ surface "เท่ากันได้" ในธีมสว่าง เพราะทั้งคู่เป็นพื้นขาวจริง ๆ
    //  ตั้งแต่เบสสั่งให้กรอบเว็บเป็นขาว 2026-08-26 — ไม่ใช่ของหลุด)
    pageHover[0] !== hover[0] &&
    pageHover[0] !== chromeHover[0] &&
    pageHover[1] !== hover[1] &&
    // ของที่ยืนบนผืนงานจริง ๆ ต้องประกาศตัวว่าใช้คู่นี้ (กันคนลบทิ้งแล้วลืม)
    // เช็คการ "ใช้งานจริง" ไม่ใช่แค่บรรทัด import — ไม่งั้นลบออกจาก className แล้วด่านยังเขียว
    // ปุ่มก่อนหน้า/ถัดไป ต้องได้ครบทั้งสองปุ่ม — นับจำนวน ไม่ใช่แค่ includes
    // (includes เฉย ๆ ปล่อยให้ลบออกจากปุ่มเดียวแล้วด่านยังเขียว ทดสอบแล้วเป็นอย่างนั้นจริง)
    (readFileSync("src/components/ui/table-pagination.tsx", "utf8").match(
      /cn\(INTERACTIVE_PAGE_HOVER, INTERACTIVE_PAGE_PRESSED\)/g,
    )?.length ?? 0) === 2 &&
    readFileSync("src/components/page-header.tsx", "utf8")
      .includes("cn(INTERACTIVE_PAGE_HOVER, INTERACTIVE_PAGE_PRESSED,");
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
    // แบบ ก (เบสเคาะ 2026-08-26) — เมนูที่กำลังเปิดอยู่ต้องเป็น "เทากลาง + ขีดแบรนด์"
    // ไม่ใช่พิลฟ้าแบบเดิม · สัญญานี้กลับด้านจากของเดิมทั้งสองฝั่ง จงใจ ไม่ใช่ของหลุด
    navigationHelperSource.includes(
      'onChrome ? "bg-interactive-chrome-pressed" : "bg-interactive-pressed"',
    ) &&
    !navigationHelperSource.includes("bg-interactive-selected") &&
    navigationHelperSource.includes("font-medium text-strong") &&
    navigationHelperSource.includes('active\n    ? "text-strong"') &&
    // เทาล้วนอย่างเดียวไม่พอ — ถ้าขีดแบรนด์หาย แถบเมนูจะไม่เหลือ Anajak เลย
    navigationHelperSource.includes("before:bg-blue-600") &&
    navigationHelperSource.includes("dark:before:bg-blue-400") &&
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
    RAISED_CONTROL_SURFACE.includes("border-field-border") &&
    RAISED_CONTROL_SURFACE.includes("bg-surface") &&
    RAISED_CONTROL_SURFACE.includes("shadow-none");
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
  const activeFilterStaysBranded =
    ACTIVE_FILTER.includes("border-blue-600") &&
    ACTIVE_FILTER.includes("text-blue-700") &&
    ACTIVE_FILTER.includes("dark:border-blue-400") &&
    ACTIVE_FILTER.includes("dark:text-blue-400") &&
    ACTIVE_FILTER.includes("bg-transparent") &&
    ACTIVE_FILTER.includes("hover:bg-interactive-hover") &&
    ACTIVE_FILTER.includes("active:bg-interactive-pressed") &&
    !ACTIVE_FILTER.includes("bg-interactive-selected") &&
    ACTIVE_UNDERLINE.includes("border-blue-600") &&
    ACTIVE_UNDERLINE.includes("text-blue-700") &&
    ACTIVE_UNDERLINE.includes("dark:border-blue-400") &&
    ACTIVE_UNDERLINE.includes("dark:text-blue-400");
  if (
    offenders.length ||
    blueHoverOffenders.length ||
    !tokenCountsValid ||
    !chromeTokenCountsValid ||
    !tokenLayersValid ||
    !chromeTokenLayersValid ||
    !pageStateContrastIsBalanced ||
    !pageTokensAreWired ||
    !cellPaddingMatchesSkeleton ||
    !interactionIsNeutral ||
    !stateContrastIsBalanced ||
    !chromeStateContrastIsBalanced ||
    !chromeTokensAreWired ||
    !navigationContractIsWired ||
    !darkSurfacesAreNeutral ||
    !brandBlueIsLocked ||
    !selectedStaysBlue ||
    !focusStaysBlue ||
    !activeFilterStaysBranded ||
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
    if (!activeFilterStaysBranded) {
      console.log(`   active filter/current ต้องใช้ Anajak Blue: ${ACTIVE_FILTER} / ${ACTIVE_UNDERLINE}`);
    }
    if (!sunkIsStructural) {
      console.log(`   SUNK_PANEL ต้องไม่มี interaction state: ${SUNK_PANEL}`);
    }
    if (!raisedControlIsSeparate) {
      console.log(`   toolbar control ต้องเป็น boundary ธรรมดาไร้เงา: ${RAISED_CONTROL_SURFACE}`);
    }
  } else {
    console.log("✅ navigation/surface hover ขาวนวล · pressed แยกชั้น · primary/selected/focus ยังเป็นน้ำเงิน");
  }
}

// ── Desktop Sidebar ต้องแสดงทุกหมวดที่มีสิทธิ์โดยไม่ซ่อนใน disclosure
{
  const shellSource = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  const sidebarStart = shellSource.indexOf('<aside className="hidden');
  const sidebarEnd = shellSource.indexOf("<main", sidebarStart);
  const desktopSidebarSource = shellSource.slice(sidebarStart, sidebarEnd);
  const sidebarGroupsStayVisible =
    shellSource.includes('const sidebarGroups = useMemo(') &&
    desktopSidebarSource.includes("sidebarGroups.map((group)") &&
    desktopSidebarSource.includes("activeSidebarRef") &&
    shellSource.includes('scrollIntoView({ block: "nearest" })') &&
    !desktopSidebarSource.includes("<details") &&
    !desktopSidebarSource.includes("เมนูทั้งหมด") &&
    !shellSource.includes("PRIMARY_NAV_IDS") &&
    !shellSource.includes("allMenuOpen");
  const mobileNavigationStaysCompact =
    shellSource.includes("const MOBILE_NAV_IDS") &&
    shellSource.includes("<MoreMenu") &&
    shellSource.includes("<span>เพิ่มเติม</span>");

  if (!sidebarGroupsStayVisible || !mobileNavigationStaysCompact) {
    failed++;
    console.log("❌ Sidebar desktop ต้องเปิดทุกหมวด ส่วนมือถือยังใช้เมนูเพิ่มเติม");
  } else {
    console.log("✅ Sidebar desktop เปิดทุกหมวดและคงเมนูเพิ่มเติมบนมือถือ");
  }
}

// ⑨ ด่านสีจริง — class ถูกไม่ได้แปลว่าสีอ่านออก จึงคำนวณ WCAG จาก token กลาง
{
  const themes = [0, 1] as const;
  // chrome + chrome-hover เข้ามาในลิสต์ตั้งแต่ chrome เป็นเทา (UI-2026 เฟส 1) —
  // ก่อนหน้านี้ chrome เป็นขาว/ดำสนิทจึงไม่มีใครคิดว่าต้องเช็ก
  // chrome-pressed จงใจไม่อยู่ในลิสต์: ทุกจุดที่ใช้ต้องมากับ INTERACTIVE_CHROME_PRESSED
  // ซึ่งพ่วง active:text-strong มาแล้ว (มีด่านแยกด้านล่างห้ามเขียน active:bg-... เอง)
  const surfaces = ["bg", "surface", "surface-muted", "interactive-hover", "interactive-pressed", "interactive-selected", "chrome", "interactive-chrome-hover"] as const;
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

  // ด่านแทนการเช็ก contrast ของ amber-500: ห้ามเอา "สัญญาณ" ไปใช้เป็นตัวหนังสือ/ไอคอนเดี่ยว
  {
    const offenders: string[] = [];
    const walkSource = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walkSource(full); continue; }
        if (!/\.tsx?$/.test(entry)) continue;
        readFileSync(full, "utf8").split("\n").forEach((line, index) => {
          if (/(?:^|[\s"'`:])(?:dark:)?text-(?:amber|yellow)-500\b/.test(line)) {
            offenders.push(`${full}:${index + 1}`);
          }
        });
      }
    };
    walkSource("src");
    if (offenders.length) {
      failed++;
      console.log(`❌ amber/yellow-500 เป็นสีสัญญาณ ห้ามใช้เป็นตัวหนังสือ (ใช้ 700 คู่ dark:400) — ${offenders.slice(0, 8).join(", ")}`);
    } else {
      console.log("✅ สีเตือน: 500 เป็นสัญญาณ · 600 ไอคอน · 700 ตัวหนังสือ");
    }
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

// ⑩ การ์ดแยกตัวด้วยเงา ไม่ใช่เส้น (เฟส 10 · เบสเคาะ "นุ่มเต็มที่" 2026-08-26)
//
// กติกาเดิมคือ "panel ห้ามมีเงาตกแต่ง" ซึ่งตั้งไว้ตอนที่เงาถูกใช้เป็นของประดับ
// ให้ทุกอย่างลอยพร่ำเพรื่อ · ที่นี่เงาทำหน้าที่ต่างออกไป: มันคือ **วิธีแยกกล่อง**
// แทนเส้น ด่านจึงเปลี่ยนจาก "ห้ามมีเงา" เป็น "ต้องมีเงาชุดกลางชุดเดียว และห้ามแรง"
// — เพดานคือ blur ไม่เกิน 20px และ alpha ไม่เกิน 0.2 ในธีมสว่าง
// ถ้าไม่คุมเพดาน มันจะไหลกลับไปเป็นเงาประดับแบบที่เคยรื้อทิ้งไปแล้ว
{
  const cardBlock =
    globalsSource.match(/\.card-surface\s*\{([^}]*)\}/)?.[1] ?? "";
  const darkCardBlock =
    globalsSource.match(/\.dark\s+\.card-surface\s*\{([^}]*)\}/)?.[1] ?? "";
  const lightShadow = globalsSource.match(/--shadow-card:\s*([^;]+);/)?.[1] ?? "";
  const shadowAlphas = [...lightShadow.matchAll(/\/\s*([0-9.]+)\)/g)].map((m) => Number(m[1]));
  const shadowBlurs = [...lightShadow.matchAll(/(\d+)px\s+-?\d*px?\s*rgb/g)].map((m) => Number(m[1]));
  if (
    // การ์ดต้องผูกกับตัวแปรกลาง ไม่ใช่เขียนเงา/เส้นเองรายที่
    !cardBlock.includes("border: 1px solid var(--color-card-edge)") ||
    !darkCardBlock.includes("border-color: var(--color-card-edge)") ||
    !cardBlock.includes("box-shadow: var(--shadow-card)") ||
    !darkCardBlock.includes("box-shadow: var(--shadow-card)") ||
    // เพดานกันเงาไหลกลับไปเป็นของประดับ
    shadowAlphas.some((alpha) => alpha > 0.2) ||
    shadowBlurs.some((blur) => blur > 20)
  ) {
    failed++;
    console.log("❌ card-surface ต้องแยกตัวด้วยเงาชุดกลาง (--shadow-card) ที่ไม่แรงเกินเพดาน และผูกขอบกับ --color-card-edge");
  } else {
    console.log("✅ card-surface เป็น bordered panel ไม่มี decorative shadow");
  }

  const cardHoverBlock =
    globalsSource.match(/\.card-surface-hover:hover\s*\{([^}]*)\}/)?.[1] ?? "";
  const cardActiveBlock =
    globalsSource.match(/\.card-surface-hover:active\s*\{([^}]*)\}/)?.[1] ?? "";
  if (
    !cardHoverBlock.includes("background-color: var(--color-interactive-hover)") ||
    !cardHoverBlock.includes("border-color: var(--color-border-strong)") ||
    cardHoverBlock.includes("transform:") ||
    !cardActiveBlock.includes("background-color: var(--color-interactive-pressed)") ||
    !cardActiveBlock.includes("box-shadow: none")
  ) {
    failed++;
    console.log("❌ card-surface-hover ต้องเปลี่ยน fill/border โดยไม่ยกหรือใส่เงา");
  } else {
    console.log("✅ card-surface-hover เปลี่ยน fill/border โดยไม่ยกหรือใส่เงา");
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

  const panelPrimitiveSources = [
    "src/components/ui/card.tsx",
    "src/components/ui/stat-card.tsx",
    "src/components/ui/alert.tsx",
    "src/components/ui/context-panel.tsx",
    "src/components/ui/add-card.tsx",
  ].map((path) => [path, readFileSync(path, "utf8")] as const);
  /* มุมการ์ดขยับเป็น 16px (rounded-2xl) แล้ว 2026-08-26 — เฟส 10 "นุ่มเต็มที่"
     ที่ยังห้ามเหมือนเดิมคือ **utility เงา** (shadow-sm ฯลฯ) เพราะเงาของการ์ด
     ต้องมาจาก .card-surface ชุดเดียว ไม่ใช่ใครนึกจะใส่ก็ใส่รายที่
     และห้าม rounded-3xl (24px) ซึ่งเลยจุดที่อ่านเป็น "การ์ด" ไปเป็น "ก้อนกลม" */
  const panelPrimitiveOffenders = panelPrimitiveSources.filter(
    ([, source]) => /rounded-3xl|shadow-sm|shadow-md|shadow-lg/.test(source),
  );
  const cardPrimitiveSource = panelPrimitiveSources[0]?.[1] ?? "";
  if (
    panelPrimitiveOffenders.length > 0 ||
    !cardPrimitiveSource.includes("px-5 pb-3 pt-4") ||
    !cardPrimitiveSource.includes("px-5 pb-5 pt-0")
  ) {
    failed++;
    console.log("❌ primitive panel/alert/context ต้องไม่ใส่ utility เงาเอง ไม่เกิน rounded-2xl และคงจังหวะขอบ 20px ชุดเดียว");
    panelPrimitiveOffenders.forEach(([path]) => console.log(`   ${path}`));
  } else {
    console.log("✅ primitive panel/alert/context ใช้มุม 16px เงามาจาก card-surface ชุดเดียว และจังหวะขอบ 20px");
  }

  const productionPanelSource = readFileSync(
    "src/components/production/production-control-record.tsx",
    "utf8",
  );
  const stationPanelSources = [
    "src/components/factory/station-mode-screen.tsx",
    "src/components/factory/station-current-layout.tsx",
    "src/components/factory/station-queue-view.tsx",
    "src/components/factory/manufacturing-station-screen.tsx",
    "src/components/factory/manufacturing-factory-board.tsx",
    "src/components/factory/dtf-batch-dialog.tsx",
    "src/components/production-v2/production-v2-workspace.tsx",
    "src/components/production-v2/production-v2-control-record.tsx",
    "src/components/production-v2/production-v2-control-actions.tsx",
    "src/components/production-v2/create-work-order-dialog.tsx",
    "src/components/production/legacy-production-page.tsx",
    "src/components/production/legacy-production-detail-page.tsx",
    "src/components/production/legacy-film-stock-page.tsx",
    "src/components/production/legacy-print-runs-page.tsx",
    "src/components/outsource/legacy-outsource-page.tsx",
  ].map((path) => [path, readFileSync(path, "utf8")] as const);
  /* มุมการ์ดเป็น 16px (rounded-2xl) ทั้งระบบแล้ว 2026-08-26 · ที่ยังห้ามคือ utility เงา
     เพราะเงาต้องมาจาก .card-surface ชุดเดียว และห้าม rounded-3xl ที่เลยความเป็นการ์ด */
  const stationPanelOffenders = stationPanelSources.filter(
    ([, source]) => /rounded-3xl|shadow-sm|shadow-md|shadow-lg/.test(source),
  );
  if (
    /rounded-3xl|shadow-sm|shadow-md|shadow-lg/.test(productionPanelSource) ||
    !productionPanelSource.includes('className="card-surface overflow-hidden rounded-2xl"') ||
    stationPanelOffenders.length > 0
  ) {
    failed++;
    console.log("❌ Production/Station panel หลักต้องไม่ใส่ utility เงาเอง และใช้มุมการ์ดชุดกลาง (rounded-2xl)");
    stationPanelOffenders.forEach(([path]) => console.log(`   ${path}`));
  } else {
    console.log("✅ Production/Station panel หลักใช้มุมการ์ดชุดกลางและไม่ใส่ utility เงาเอง");
  }

  const factoryTvSource = readFileSync("src/app/factory/page.tsx", "utf8");
  const operationalDialogSources = [
    "src/components/orders/billing/create-invoice-dialog.tsx",
    "src/components/orders/billing/record-payment-dialog.tsx",
    "src/components/orders/delivery/create-delivery-dialog.tsx",
    "src/components/orders/order-info-edit-dialog.tsx",
    "src/components/production/create-production-dialog.tsx",
    "src/components/production/step-outsource-dialog.tsx",
    "src/components/goods-receipt/goods-receipt-dialog.tsx",
    "src/components/sync-dialog.tsx",
  ].map((path) => [path, readFileSync(path, "utf8")] as const);
  const operationalDialogOffenders = operationalDialogSources.filter(
    ([, source]) => /rounded-(?:xl|2xl|3xl)|shadow-sm/.test(source),
  );
  if (
    /rounded-(?:xl|2xl|3xl)|shadow-sm/.test(factoryTvSource) ||
    operationalDialogOffenders.length > 0
  ) {
    failed++;
    console.log("❌ Factory TV และ dialog หลังบ้านต้องใช้มุม 8px โดยไม่คืน decorative shadow");
    operationalDialogOffenders.forEach(([path]) => console.log(`   ${path}`));
  } else {
    console.log("✅ Factory TV และ dialog หลังบ้านใช้มุม 8px โดยไม่คืน decorative shadow");
  }

  const productPickerSource = readFileSync("src/components/product-picker.tsx", "utf8");
  const orderFilesSource = readFileSync(
    "src/components/orders/detail/order-files-card.tsx",
    "utf8",
  );
  const dialogPrimitiveSource = readFileSync("src/components/ui/dialog.tsx", "utf8");
  if (
    !productPickerSource.includes("<FilterChip") ||
    productPickerSource.includes("INTERACTIVE_SELECTED") ||
    /rounded-xl/.test(productPickerSource) ||
    !productPickerSource.includes("returnFocusRef") ||
    !productPickerSource.includes("onOpenAutoFocus") ||
    !productPickerSource.includes("onCloseAutoFocus") ||
    !productPickerSource.includes("aria-expanded={isExpanded}") ||
    !productPickerSource.includes("aria-controls={`product-variants-${product.id}`}") ||
    !productPickerSource.includes("max-h-[90dvh]") ||
    !productPickerSource.includes("motion-reduce:animate-none") ||
    /hover:shadow-md/.test(orderFilesSource) ||
    !dialogPrimitiveSource.includes("returnFocusElement") ||
    !dialogPrimitiveSource.includes("onCloseAutoFocus={handleCloseAutoFocus}")
  ) {
    failed++;
    console.log("❌ picker/filter/file/dialog interaction ต้อง minimal ไม่มี hover shadow และคืน focus");
  } else {
    console.log("✅ picker/filter/file/dialog interaction minimal ไม่มี hover shadow และคืน focus");
  }

  const publicShellSource = readFileSync(
    "src/components/public/public-page.tsx",
    "utf8",
  );
  const publicErrorSource = readFileSync(
    "src/components/public-link-error.tsx",
    "utf8",
  );
  const publicRoutePaths = [
    "src/app/(public)/quote/[token]/page.tsx",
    "src/app/(public)/status/[token]/page.tsx",
    "src/app/(public)/upload/[token]/page.tsx",
    "src/app/(public)/approve/design/[token]/page.tsx",
    "src/app/(public)/job/[token]/job-share-view.tsx",
  ];
  const publicRouteSources = publicRoutePaths.map(
    (path) => [path, readFileSync(path, "utf8")] as const,
  );
  const publicVisualOffenders = publicRouteSources.filter(
    ([, source]) =>
      /rounded-(?:xl|2xl|3xl)|shadow-sm|(?:text|bg|border)-slate-|hover:bg-slate-/.test(
        source,
      ),
  );
  if (
    /VISUAL_TONE_CLASSES|rounded-\[14px\]|shadow-sm|absolute inset-x-0 top-0/.test(
      publicShellSource,
    ) ||
    /rounded-\[14px\]|shadow-sm|absolute inset-x-0 top-0/.test(publicErrorSource) ||
    publicVisualOffenders.length > 0
  ) {
    failed++;
    console.log("❌ public token ต้องใช้ neutral masthead, semantic token และมุม 8px");
    publicVisualOffenders.forEach(([path]) => console.log(`   ${path}`));
  } else {
    console.log("✅ public token ใช้ neutral masthead, semantic token และมุม 8px");
  }

  const providersSource = readFileSync("src/components/providers.tsx", "utf8");
  const publicGlobalsSource = readFileSync("src/app/globals.css", "utf8");
  const printDocumentSource = readFileSync(
    "src/components/print/print-document.tsx",
    "utf8",
  );
  const statusPublicSource = readFileSync(
    "src/app/(public)/status/[token]/page.tsx",
    "utf8",
  );
  if (
    !providersSource.includes('const PUBLIC_LIGHT_PREFIXES = [...PUBLIC_CUSTOMER_PREFIXES, "/print"]') ||
    !publicGlobalsSource.includes("width: 210mm") ||
    !publicGlobalsSource.includes("@media print") ||
    !publicGlobalsSource.includes("overflow-x: auto") ||
    !publicGlobalsSource.includes("box-shadow: none") ||
    !printDocumentSource.includes("<DocumentStamp") ||
    !statusPublicSource.includes("hideFooter={d.isBlindShip}")
  ) {
    failed++;
    console.log("❌ print/public ต้องคง A4 light-only, grayscale และ blind-ship contract");
  } else {
    console.log("✅ print/public คง A4 light-only, grayscale และ blind-ship contract");
  }

  // หน้า detail คง structural divider; FlowFilterBar อยู่ใน panel ของ caller จึงไม่วาดเส้นซ้ำ
  const ordersStatusSource = readFileSync(
    "src/components/ui/flow-filter-bar.tsx",
    "utf8",
  );
  const detailStatusSource = readFileSync(
    "src/components/orders/detail/order-status-bar.tsx",
    "utf8",
  );
  if (
    ordersStatusSource.includes("border-y border-divider") ||
    ordersStatusSource.includes("border-l border-slate") ||
    ordersStatusSource.includes("border-b-2 border-slate-100 pb-1") ||
    ordersStatusSource.includes("ratioMax") ||
    ordersStatusSource.includes("style={{ width:") ||
    ordersStatusSource.includes("card-surface") ||
    !ordersStatusSource.includes("border-b border-divider pb-1") ||
    ordersStatusSource.includes("กดสถานะเพื่อกรอง · กดซ้ำเพื่อล้างตัวกรอง") ||
    !ordersStatusSource.includes("เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง") ||
    // 2026-08-30 เบสสั่ง "ไม่ต้องมีเส้นแบ่ง" — รางในหน้าใบงานแยกกลุ่มด้วยระยะเท่านั้น
    // (เส้นล่างเดิมไปชนกับเส้นใต้แถบแท็บที่อยู่ถัดลงไป กลายเป็นเส้นคู่ที่ไม่ได้แบ่งอะไร)
    detailStatusSource.includes("border-y border-divider") ||
    detailStatusSource.includes("border-t border-divider") ||
    detailStatusSource.includes("card-surface")
  ) {
    failed++;
    console.log("❌ status rail ต้องใช้ hairline เฉพาะจัดกลุ่มและห้ามคืน divider/progress track ซ้ำ");
  } else {
    console.log("✅ status rail ใช้ hairline/interaction cue โดยไม่มีข้อความค้างหรือ track ซ้ำ");
  }

  const orderStatusFilterSource = readFileSync(
    "src/components/orders/order-status-filter.tsx",
    "utf8",
  );
  if (
    !orderStatusFilterSource.includes('className="hidden xl:block"') ||
    !orderStatusFilterSource.includes("<details") ||
    !orderStatusFilterSource.includes("ACTIVE_UNDERLINE") ||
    orderStatusFilterSource.includes("PopoverPrimitive.Content")
  ) {
    failed++;
    console.log("❌ ตัวกรองสถานะ Orders ต้องคืน flow เต็มบน desktop และ quick+details บนจอแคบ");
  } else {
    console.log("✅ ตัวกรองสถานะ Orders ใช้ flow เต็มบน desktop และ quick+details บนจอแคบ");
  }

  const desktopStatusSource =
    ordersStatusSource.match(/function DesktopItemButton[\s\S]*?\n}\n\nexport function/)?.[0] ?? "";
  if (
    !desktopStatusSource.includes("border-b-2") ||
    !desktopStatusSource.includes("ACTIVE_UNDERLINE") ||
    !desktopStatusSource.includes("border-transparent") ||
    !desktopStatusSource.includes("INTERACTIVE_HOVER") ||
    !desktopStatusSource.includes("cursor-pointer") ||
    desktopStatusSource.includes("border-slate-900") ||
    desktopStatusSource.includes("dark:border-white")
  ) {
    failed++;
    console.log("❌ ขั้นสถานะ desktop ต้องพักเป็น neutral และใช้ Anajak Blue เมื่อเลือก");
  } else {
    console.log("✅ ขั้นสถานะ desktop พักเป็น neutral และใช้ Anajak Blue เมื่อเลือก");
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
      cardId: "verify-order-item-1",
      item: EMPTY_ITEM, itemIdx: 0, canRemove: false, isExpanded: true,
      compact: true, allItems: [EMPTY_ITEM],
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
  if (html.indexOf("ลายและงานพิมพ์") > html.indexOf("สินค้าในชุดงาน")) {
    problems.push("ลายและงานพิมพ์ต้องอยู่เหนือสินค้าในชุดงาน");
  }
  // เบสสั่งตัดทิ้ง 2026-08-04 — หัวข้อบอกอยู่แล้วว่าส่วนนี้คืออะไร การ์ดบอกว่ากดแล้วได้อะไร
  for (const t of ["ยังไม่มีสินค้า", "ยังไม่มีลาย", "ยังไม่มีส่วนเสริม"]) {
    if (html.includes(t)) problems.push(`ยังมีข้อความ "${t}" (เบสสั่งเอาออก)`);
  }
  // การ์ดต้องกินเต็มแถว (เบส: "พื้นที่ปุ่ม CTA เอาเต็มแถวเลย")
  if (cards.some((c) => !c.split(/\s+/).includes("w-full"))) {
    problems.push("การ์ดขอบประบางใบไม่ได้ w-full");
  }
  for (const card of cards) {
    const classes = new Set(card.split(/\s+/));
    for (const expected of [
      "border-slate-300",
      "dark:border-slate-700",
      "hover:border-border-strong",
      "dark:hover:border-border-strong",
    ]) {
      if (!classes.has(expected)) problems.push(`การ์ดขอบประขาด state ${expected}`);
    }
    if (classes.has("border-border-strong")) {
      problems.push("การ์ดขอบประใช้ strong boundary ตั้งแต่ resting");
    }
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

/* ── รายการงาน: หนึ่งรายการต่อหนึ่ง card + CTA อยู่ก่อน list ───────────────
   หน้าเปิดงานและหน้าแก้ไขใช้ form/state ชุดเดียวกัน แต่เคยวาง CTA คนละตำแหน่ง
   และซ้อน outer card + inner border จนหลายรายการอ่านเป็นก้อนเดียว */
{
  const orderItemSource = readFileSync(
    "src/components/orders/new/order-item-card.tsx",
    "utf8",
  );
  const createSource = readFileSync(
    "src/components/orders/new/order-create-page.tsx",
    "utf8",
  );
  const editRouteSource = readFileSync(
    "src/components/orders/edit/order-edit-route.tsx",
    "utf8",
  );
  const detailSource = readFileSync(
    "src/components/orders/detail/order-detail-page.tsx",
    "utf8",
  );
  const listHeaderSource = readFileSync(
    "src/components/orders/new/order-items-list-header.tsx",
    "utf8",
  );
  const appShellSource = readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8",
  );
  const itemWrapper =
    orderItemSource.match(/<article[\s\S]*?<OrderItemRow/)?.[0] ?? "";
  const legacyImplementations = new Set([
    "src/components/orders/order-items-editor.tsx",
    "src/components/orders/order-info-edit-dialog.tsx",
  ]);
  const legacyCallers: string[] = [];
  function walkLegacyOrderEditors(dir: string) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walkLegacyOrderEditors(path);
      } else if (
        /\.(?:ts|tsx)$/.test(name) &&
        !legacyImplementations.has(path)
      ) {
        const source = readFileSync(path, "utf8");
        if (
          /(?:from\s+|import\s*\()\s*["'][^"']*(?:order-items-editor|order-info-edit-dialog)/.test(
            source,
          )
        ) {
          legacyCallers.push(path);
        }
      }
    }
  }
  walkLegacyOrderEditors("src");

  const problems: string[] = [];
  if (
    orderItemSource.includes("isIntake") ||
    orderItemSource.includes("appearance?:") ||
    createSource.includes("appearance=")
  ) {
    problems.push("create/edit ต้องไม่มี presentation branch แยกใน OrderItemCard");
  }
  if (
    !createSource.includes('width="wide"') ||
    !editRouteSource.includes('width="wide"') ||
    !editRouteSource.includes('mode="edit"') ||
    !editRouteSource.includes('from "@/components/orders/new/order-create-page"')
  ) {
    problems.push("create/edit ต้องใช้ OrderFormPage ตัวเดียวและ PageShell wide เท่ากัน");
  }
  if (
    !createSource.includes("<OrderCatalogAlert") ||
    !createSource.includes("<OrderFeeSection") ||
    !createSource.includes("<OrderPriceSummary") ||
    !createSource.includes("<OrderFormActionBar") ||
    !createSource.includes('category: "FEE"') ||
    !createSource.includes('mode: "edit"') ||
    !createSource.includes("trpc.order.saveForm.useMutation") ||
    detailSource.includes("OrderItemsEditor") ||
    detailSource.includes("OrderInfoEditDialog") ||
    detailSource.includes("editingItems") ||
    detailSource.includes("showInfoEditDialog")
  ) {
    problems.push("create/edit ต้องใช้ runtime ชุดกลาง และ detail ห้าม mount editor/dialog รุ่นเก่า");
  }

  const intakeTabStart = createSource.indexOf(
    '<TabsContent value="intake"',
  );
  const intakeTabEnd = createSource.indexOf(
    '<TabsContent value="items"',
    intakeTabStart,
  );
  const intakeTabSource = createSource.slice(intakeTabStart, intakeTabEnd);
  const intakeCardEnd = intakeTabSource.indexOf("</Section>");
  const shippingSectionStart = intakeTabSource.indexOf(
    "<OrderShippingSection",
  );
  const shippingSectionEnd = intakeTabSource.indexOf(
    "/>",
    shippingSectionStart,
  );
  const shippingCall = intakeTabSource.slice(
    shippingSectionStart,
    shippingSectionEnd,
  );
  if (
    !intakeTabSource.includes('className="mt-6 space-y-4"') ||
    intakeCardEnd < 0 ||
    shippingSectionStart < intakeCardEnd ||
    shippingCall.includes("embedded")
  ) {
    problems.push(
      "การจัดส่งต้องเป็น sibling card แยกจากข้อมูลรับเรื่องใน shared form",
    );
  }
  if (legacyCallers.length > 0) {
    problems.push(
      `ห้ามเรียก editor/dialog รุ่นเก่าจากไฟล์อื่น: ${legacyCallers.join(", ")}`,
    );
  }
  if (
    !itemWrapper.includes('role="listitem"') ||
    !itemWrapper.includes("card-surface") ||
    /(?:^|\s)border(?:\s|["'`])|(?:^|\s)ring-(?!0)/.test(itemWrapper)
  ) {
    problems.push("OrderItemCard ต้องเป็น listitem บน card-surface โดยไม่มี border/ring");
  }

  const headerIndex = createSource.indexOf("<OrderItemsListHeader");
  const listIndex = createSource.indexOf('role="list"', headerIndex);
  const mapIndex = createSource.indexOf("items.map", listIndex);
  if (headerIndex < 0 || listIndex < 0 || mapIndex < 0 || headerIndex > listIndex) {
    problems.push("shared form: CTA ต้องอยู่ก่อน role=list และ items.map");
  }

  if (
    createSource.includes("เพิ่มชุดงาน") ||
    createSource.includes("เพิ่มรายการงานอีกชุด")
  ) {
    problems.push("ต้องไม่มี CTA รุ่นเก่าซ้ำท้าย list");
  }
  if (
    !listHeaderSource.includes('type="button"') ||
    !listHeaderSource.includes("เพิ่มรายการ") ||
    !listHeaderSource.includes("w-full") ||
    !listHeaderSource.includes("scrollIntoView") ||
    !listHeaderSource.includes(".focus(")
  ) {
    problems.push("shared header ต้องมี CTA mobile เต็มแถวและพา focus ไป card ใหม่");
  }
  // บันไดความลึก — กฎที่ยังจริงทั้งสองธีมมีสองข้อ (แก้ 2026-08-26 · UI-2026 เฟส 6):
  //   1) ผืนงาน (bg) เป็น "พื้นจม" การ์ด (surface) ต้องลอยเหนือมันเสมอ
  //   2) Light workspace ต้องเป็น near-white แต่ยังต่างจาก chrome/card เล็กน้อย
  //      แต่ **ไม่บังคับทิศ** เพราะสองธีมวางตัวคนละฝั่งโดยตั้งใจ:
  //        สว่าง  chrome ขาว = การ์ดขาว ลอยเหนือ near-white (เบสสั่งให้ขาวขึ้น 2026-08-27)
  //        มืด    chrome เกือบดำ จมใต้ผืนงาน               (ของเดิม ไม่ได้ถูกทัก)
  //
  // ประวัติ: เฟส 1 (2026-08-25) เคยล็อกว่า chrome < bg < surface ทั้งสองธีม
  // เพื่อให้ "อ่านทิศเดียวกัน" · เบสดูของจริงบนจอกว้างสองรอบแล้วสั่งให้ธีมสว่าง
  // กลับไปเป็นกรอบขาว ก่อนเฟส 11 จะขยับผืน Light เป็น near-white ตามหน้าจริง
  // การ์ดยังมี edge+shadow กลางเป็นขอบเขต จึงไม่ย้อนกลับไปเป็นขาวลอยบนขาวแบบ 2026-08-03
  {
    const relLum = (value: string) => luminance(hexRgb(value));
    const chromeColors = colorValues("chrome");
    const pageColors = colorValues("bg");
    const surfaceColors = colorValues("surface");
    // --color-bg ถูกประกาศซ้ำใน .app-workspace ด้วย จึงมีมากกว่า 2 ค่า —
    // index 0/1 ยังเป็นคู่ light/dark ของ @theme ตามลำดับการประกาศในไฟล์
    const hasAll =
      chromeColors.length >= 2 && pageColors.length >= 2 && surfaceColors.length >= 2;
    const cardFloatsAbovePage =
      hasAll &&
      [0, 1].every((theme) => relLum(pageColors[theme]!) < relLum(surfaceColors[theme]!));
    // ธีมสว่างตั้งใจให้อยู่ในช่วง near-white 1.04–1.08 เทียบขาว
    // การ์ดแยกชั้นหลักด้วย edge+shadow ซึ่งมีด่านบังคับแยกอยู่แล้วด้านบน
    // ธีมมืดแยกด้วย "เส้นขอบ" มาตลอด — chrome กับ bg ต่างกันแค่ 1.02 เท่า
    // บังคับ 1.1 กับธีมมืดด้วยจะเป็นการแต่งกฎให้ตรงกับธีมสว่างโดยไม่มีใครเคยตัดสินใจ
    // จึงบังคับแค่ "ต้องไม่ใช่ค่าเดียวกัน" เพื่อไม่ให้ใครยุบสองชั้นนี้เป็นชั้นเดียว
    const chromeReadsAgainstPage =
      hasAll &&
      contrast(hexRgb(chromeColors[0]!), hexRgb(pageColors[0]!)) >= 1.04 &&
      contrast(hexRgb(chromeColors[0]!), hexRgb(pageColors[0]!)) <= 1.08 &&
      chromeColors[1] !== pageColors[1];
    // ทิศของแต่ละธีมยังล็อกไว้ เพื่อไม่ให้ใครสลับกลับเงียบ ๆ ทีละธีม
    const lightChromeIsRaised = hasAll && relLum(chromeColors[0]!) > relLum(pageColors[0]!);
    const darkChromeIsSunk = hasAll && relLum(chromeColors[1]!) < relLum(pageColors[1]!);
    if (
      !cardFloatsAbovePage ||
      !chromeReadsAgainstPage ||
      !lightChromeIsRaised ||
      !darkChromeIsSunk ||
      pageColors[1] === "#000000" ||
      !appShellSource.includes("app-workspace") ||
      !globalsSource.includes(".app-workspace") ||
      !globalsSource.includes(`--color-bg: ${pageColors[0]}`)
    ) {
      problems.push(
        "บันไดความลึก: การ์ดต้องลอยเหนือผืนงานทั้งสองธีม · Light workspace ต้องเป็น near-white ต่างจาก chrome/card 1.04–1.08 เท่า · Dark chrome ยังจมใต้ผืนงานและต้องไม่ใช่ค่าเดียวกับผืนงาน · ห้าม Dark เป็นดำสนิท · .app-workspace ต้องผูกกับค่า --color-bg เดียวกัน",
      );
    }
  }

  if (problems.length) {
    failed++;
    console.log("❌ ฟอร์มรายการ create/edit ยังใช้โครงหรือความกว้างคนละชุด");
    problems.forEach((problem) => console.log(`   ${problem}`));
  } else {
    console.log("✅ ฟอร์มรายการ create/edit ใช้โครงร่วมและความกว้างตาม host");
  }
}

/* ── ภาพรวมออเดอร์: สรุปก่อน + optional ว่างไม่สร้าง field dump ───────────
   หลัง edit ย้ายไปหน้าเต็ม แท็บนี้ต้องเป็น read surface ไม่ใช่ฟอร์มแบบอ่านอย่างเดียว */
{
  const overviewSource = readFileSync(
    "src/components/orders/detail/order-overview-tab.tsx",
    "utf8",
  );
  const detailSource = readFileSync(
    "src/components/orders/detail/order-detail-page.tsx",
    "utf8",
  );
  const summaryIndex = overviewSource.indexOf(
    'data-order-overview-card="summary"',
  );
  const customerIndex = overviewSource.indexOf(
    'data-order-overview-card="customer"',
  );
  const shippingIndex = overviewSource.indexOf(
    'data-order-overview-card="shipping"',
  );
  const problems: string[] = [];

  /* ลำดับ DOM = ลำดับที่มือถือซ้อนกัน · สรุปต้องมาก่อนการ์ดลูกค้าที่ยาวมาก
     ไม่งั้นบนมือถือกว่าจะเห็นกำหนดส่ง/ยอดต้องเลื่อนผ่านที่อยู่กับประวัติลูกค้าทั้งหมด */
  if (
    summaryIndex < 0 ||
    customerIndex < 0 ||
    shippingIndex < 0 ||
    !(summaryIndex < shippingIndex && shippingIndex < customerIndex)
  ) {
    problems.push("DOM ต้องเรียงสรุปออเดอร์ → การจัดส่ง → ลูกค้า");
  }
  if (
    !overviewSource.includes('className="space-y-5"') ||
    !overviewSource.includes("grid items-start gap-5") ||
    // คอลัมน์สรุปมาก่อนใน DOM แล้วดันไปขวาบนจอกว้าง — ถอด col-start ออกเมื่อไหร่
    // มือถือยังถูกอยู่ แต่จอคอมจะกลายเป็นสรุปอยู่ซ้าย/ลูกค้าอยู่ขวา ซึ่งไม่ใช่ที่เบสเคาะ
    !overviewSource.includes("xl:col-start-2 xl:row-start-1") ||
    !overviewSource.includes("xl:col-start-1 xl:row-start-1") ||
    !overviewSource.includes(
      '"grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5 lg:grid-cols-3"',
    )
  ) {
    problems.push(
      "แท็บภาพรวมต้องเป็นสองคอลัมน์โดยคอลัมน์สรุปมาก่อนใน DOM และสามค่าหลักเป็น 2×2 บนมือถือ",
    );
  }
  /* หัวข้อการ์ดในแท็บนี้ต้องเงียบ (compact) — หัวใบเป็นจุดเดียวที่เสียงดัง
     ถ้าการ์ดกลับไปหัวหนาเท่าเดิม ลำดับความสำคัญที่เบสเคาะไว้จะหายทันที */
  if ((overviewSource.match(/\n\s+compact\n/g) ?? []).length < 4) {
    problems.push("หัวข้อการ์ดในแท็บภาพรวมต้องเป็น compact ทุกใบ");
  }
  /* หัวใบ (2026-08-30 เบสสั่ง "ข้างบนไม่ต้องมีอะไรเยอะ มีแค่สถานะและ CTA ก็พอ")
     — ต้องเป็นแผ่นเดียวที่ห่อ PageHeader + แถบสถานะ · และห้ามมีข้อเท็จจริง
     ตัวใหญ่กลับขึ้นไปอีก · 2026-08-30 เบสสั่งเอาระบบชื่องานออกทั้งหมด
     → หัวใบไม่มีบรรทัดรองแล้ว (description ต้องเป็น null ตายตัว) */
  const railSource = readFileSync(
    "src/components/orders/detail/order-status-bar.tsx",
    "utf8",
  );
  if (
    !detailSource.includes('data-order-head=""') ||
    // minimal = ยืนบนผืนหน้าตรง ๆ · ห่อด้วยการ์ด/พื้น/เงาเมื่อไหร่ = ย้อนคำสั่งเบส
    /data-order-head[\s\S]{0,400}?card-surface/.test(detailSource) ||
    !detailSource.includes("description={null}") ||
    !detailSource.includes("titleBadge={") ||
    /order\.title/.test(detailSource) ||
    detailSource.includes("<SummaryFact") ||
    // ส่วนบนไม่มีเส้นแบ่งเลย — แยกกลุ่มด้วยระยะอย่างเดียว
    /border-(?:y|t) border-divider/.test(railSource) ||
    // แถบสถานะต้องกว้างเท่าการ์ดข้างล่าง — จุดหัวชิดซ้ายสุด จุดท้ายชิดขวาสุด
    // (เบสสั่ง 2026-08-30 "processbar เอาความกว้างให้เท่ากับส่วนอื่นๆ")
    !railSource.includes('isFirst ? "items-start pl-0" : isLast ? "items-end pr-0"') ||
    // เส้นเชื่อมต้องเป็นชิ้นเดียวต่อหนึ่งช่วง — เคยแตกเป็น before+after แล้วเบสเจอ
    // เส้นขาดครึ่งช่วงบนเครื่องตัวเอง (2026-08-30 "ทำไมเส้นไม่ต่อกัน")
    railSource.includes("after:absolute") ||
    railSource.includes("before:absolute") ||
    /* เรขาคณิตของรางต้องเป็น inline style — คลาส Tailwind ค่าเฉพาะ (flex-[...] /
       before:left-[calc(...)]) มีผลก็ต่อเมื่อ CSS ถูก generate มาแล้ว เครื่องที่ CSS
       ยังไม่อัปเดตจะได้รางเพี้ยน (เบสเจอกับตา 2 รอบ 2026-08-30) */
    !railSource.includes('flex: isFirst || isLast ? "0.5 1 12px" : "1 1 0%"') ||
    /flex-\[0\.5|before:left-\[|before:right-\[/.test(railSource) ||
    // ของที่ใช้บ่อยต้องเป็นปุ่มจริงบนหัว ไม่ใช่ซ่อนในเมนู ⋯
    !detailSource.includes("aria-label=\"พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)\"") ||
    !detailSource.includes("aria-label=\"คัดลอกลิงก์สถานะสำหรับลูกค้า\"") ||
    // ไอคอนขนาดในเมนู (h-4 w-4) = ร่องรอยว่าสองรายการนี้ถูกยัดกลับเข้าเมนู ⋯ อีก
    // (เช็คข้อความตรง ๆ ไม่ได้ — ข้อความ toast ตอนคัดลอกสำเร็จใช้คำเดียวกัน)
    detailSource.includes('<ClipboardList className="h-4 w-4" />') ||
    detailSource.includes('<Share2 className="h-4 w-4" />') ||
    // เมนู ⋯ ต้องหายไปเมื่อไม่มีรายการให้เลือก ไม่ใช่กดแล้วเจอกล่องว่าง
    !detailSource.includes("hasOverflowMenu")
  ) {
    problems.push(
      "หัวใบต้องเป็น minimal (ไม่มีพื้น/กรอบ/เส้นแบ่ง) และ CTA ที่ใช้บ่อยต้องเป็นปุ่มจริง ไม่ซ่อนในเมนู ⋯",
    );
  }
  /* การ์ด "งานนี้พิมพ์อะไร" (เบสเคาะแบบ B จากหน้าลอง /proto/order-overview 2026-08-31)
     — คำถามแรกของคนเปิดใบงานคือ "งานนี้พิมพ์ลายอะไร" เดิมต้องกดข้ามไปแท็บม็อกอัพทุกครั้ง
     ข้อบังคับที่ห้ามหลุด:
     ① การ์ดต้องอยู่บนสุดของคอลัมน์ซ้าย (มาก่อนการ์ดลูกค้าในลำดับ DOM = ลำดับที่มือถือซ้อน)
     ② รูปต้องมาจาก MockupThumbRow ซึ่งใช้สูตรเลือกรูปกลาง — วาด <img> เองเมื่อไหร่
        จอนี้จะโชว์คนละรูปกับแท็บม็อกอัพ/ใบสั่งผลิตทันที
     ③ เป็น "ที่ดู" ไม่ใช่ "ที่จัดการ" — ห้ามมี mutation ของม็อกอัพ/ไฟล์ในการ์ดนี้
        (ม็อกอัพมีบ้านเดียวคือแท็บม็อกอัพ & ไฟล์ · กติกาเดิมตั้งแต่ 2026-08-22)
     ④ รายละเอียดงานอยู่ในการ์ดนี้ ไม่ใช่การ์ดตัวหนังสือลอยอีกใบ */
  const artworkIndex = overviewSource.indexOf("{artwork}");
  const artworkSource = readFileSync(
    "src/components/orders/detail/order-artwork-card.tsx",
    "utf8",
  );
  if (
    artworkIndex < 0 ||
    !(artworkIndex < customerIndex) ||
    !overviewSource.includes("artwork?: React.ReactNode") ||
    overviewSource.includes('data-order-overview-card="description"') ||
    !artworkSource.includes('data-order-overview-card="artwork"') ||
    !artworkSource.includes("MockupThumbRow") ||
    /useMutation|design\.(upload|approve)|attachment\.(create|delete)/.test(artworkSource) ||
    !detailSource.includes("<OrderArtworkCard")
  ) {
    problems.push(
      "การ์ด “งานนี้พิมพ์อะไร” ต้องอยู่บนสุดคอลัมน์ซ้าย ใช้รูปย่อจากสูตรกลาง และห้ามมีปุ่มจัดการม็อกอัพ/ไฟล์",
    );
  }
  /* ประวัติลูกค้า = กล่องสีประจำหมวดสี่ช่อง (แบบ B "สีบอกหมวด" · เบสเคาะ 2026-08-31)
     เดิมเป็นบรรทัดตัวหนังสือเทาใต้ชื่อ ซึ่งเบสทักเองว่าอ่านเป็น "text โง่ ๆ"
     สองข้อที่ห้ามหลุดไม่ว่าหน้าตาจะเปลี่ยนอีกกี่รอบ:
       ① gate เงินครอบทั้งก้อน — ช่างต้องไม่เห็นแม้แต่หัวข้อ
       ② กล่องต้องใช้สีจาก VISUAL_TONE_CLASSES ไม่ใช่คลาสสีที่เขียนเอง */
  if (
    !overviewSource.includes("customerHistoryCells") ||
    !overviewSource.includes(
      "showMoney && hasCustomerHistory && customerHistoryCells.length > 0",
    ) ||
    !overviewSource.includes("VISUAL_TONE_CLASSES[cell.tone].soft") ||
    overviewSource.includes('<Group label="ประวัติลูกค้า"')
  ) {
    problems.push(
      "ประวัติลูกค้าต้องเป็นกล่องสีประจำหมวด และยัง gate ด้วย showMoney ทั้งก้อน",
    );
  }
  if (
    !overviewSource.includes("if (!filled && !emptyText) return null") ||
    overviewSource.includes('emptyText ?? "-"') ||
    overviewSource.includes('"ยังไม่จอง"') ||
    !overviewSource.includes('"ยังไม่ตีราคา"')
  ) {
    problems.push("optional ว่างต้องหาย และ empty state หลักต้องบอกความหมายตรง");
  }
  if (
    !overviewSource.includes(
      "isMarketplace && showMoney && order.platformFee != null",
    ) ||
    !overviewSource.includes("showMoney && hasCustomerHistory") ||
    !/\{showMoney && \(\s*<SummaryFact[\s\S]*?label="ยอดรวม"/.test(
      overviewSource,
    ) ||
    !detailSource.includes(
      'onOpenMoney={canSeeMoney ? () => changeTab("money") : undefined}',
    ) ||
    !/onEditInfo=\{\s*canUseEditForm\s*\?/.test(detailSource) ||
    !detailSource.includes('openInfoEditPage(section, "overview")') ||
    !detailSource.includes(
      'router.push(buildOrderEditHref(id, { tab: "intake", focus, returnTab }))',
    ) ||
    !detailSource.includes("onOpenDelivery={() => changeTab(\"delivery\")}")
  ) {
    problems.push(
      "เงิน/edit ต้อง gate เดิม พร้อม focus/return URL และ tracking ต้องเปิดแท็บจัดส่งจริง",
    );
  }

  if (problems.length) {
    failed++;
    console.log("❌ ภาพรวมออเดอร์กลับไปเป็น field dump หรือเรียงผิดลำดับ");
    problems.forEach((problem) => console.log(`   ${problem}`));
  } else {
    console.log("✅ ภาพรวมออเดอร์สรุปก่อนและแสดงเฉพาะข้อมูลที่มีความหมาย");
  }
}

/* ── sticky action ต้องไม่วางทับพื้นที่กรอกทุกขนาดจอ ───────────────────────
   Regression 2026-08-14: popup เลื่อนทั้งก้อนจน footer ทับ textarea และ
   /orders/new ปัก action bar จนทับ field ทั้ง desktop/mobile ตั้งแต่ยังไม่เลื่อน */
{
  const customerDialogSource = readFileSync(
    "src/components/customers/customer-edit-dialog.tsx",
    "utf8",
  );
  const orderCreateSource = readFileSync(
    "src/components/orders/new/order-create-page.tsx",
    "utf8",
  );
  const orderEditRouteSource = readFileSync(
    "src/components/orders/edit/order-edit-route.tsx",
    "utf8",
  );
  const orderActionBarSource = readFileSync(
    "src/components/orders/new/order-form-action-bar.tsx",
    "utf8",
  );
  const problems: string[] = [];

  if (
    !customerDialogSource.includes("grid-rows-[auto_minmax(0,1fr)]") ||
    !customerDialogSource.includes("gap-0 overflow-clip p-0 pr-0") ||
    !customerDialogSource.includes("flex min-h-0 flex-col overflow-clip") ||
    customerDialogSource.includes("max-h-[90dvh]") ||
    !customerDialogSource.includes('data-dialog-body=""') ||
    !customerDialogSource.includes("min-h-0 flex-1 overflow-y-auto") ||
    !customerDialogSource.includes('data-dialog-fields=""') ||
    !customerDialogSource.includes("space-y-4 px-5 sm:px-6") ||
    !customerDialogSource.includes('className="static z-auto px-5 sm:px-6"')
  ) {
    problems.push("popup แก้ลูกค้าต้องแยก 3 พื้นที่และจัด padding ให้พอดีกรอบ");
  }
  if (
    !orderCreateSource.includes('data-order-submit-bar=""') ||
    orderCreateSource.includes('className="card-surface sticky') ||
    orderCreateSource.includes("bottom-[var(--app-bottom-nav-offset)]")
  ) {
    problems.push("action bar หน้าเปิดงานต้องอยู่ท้าย form โดยไม่ sticky ทับ field");
  }
  if (
    !orderActionBarSource.includes('data-order-form-action-bar=""') ||
    !orderEditRouteSource.includes('mode="edit"') ||
    orderActionBarSource.includes('"card-surface sticky')
  ) {
    problems.push("action bar หน้าแก้ออเดอร์ต้องใช้ shared form ใน document flow โดยไม่ทับ field");
  }

  if (problems.length) {
    failed++;
    console.log("❌ sticky action ยังทับพื้นที่กรอก");
    problems.forEach((problem) => console.log(`   ${problem}`));
  } else {
    console.log("✅ action bar แยกจากพื้นที่กรอกทุกขนาดจอ");
  }
}

/* ── Production Control + Station current-job contract ─────────────────────
   ERP เป็น exception/control record; routine execution อยู่ Station และทั้งสอง
   ต้อง fail-closed จากข้อมูล/สิทธิ์จริง ไม่สร้าง readiness หรือ owner ปลอม */
{
  const productionBoardRouteSource = readFileSync(
    "src/app/(dashboard)/production/page.tsx",
    "utf8",
  );
  const productionBoardSource = readFileSync(
    "src/components/production/legacy-production-page.tsx",
    "utf8",
  );
  const productionDetailSource = readFileSync(
    "src/components/production/production-detail-screen.tsx",
    "utf8",
  );
  const productionControlSource = readFileSync(
    "src/components/production/production-control-record.tsx",
    "utf8",
  );
  const productionRouteRailSource = readFileSync(
    "src/components/production/production-route-rail.tsx",
    "utf8",
  );
  const productionControlProjectionSource = readFileSync(
    "src/lib/production-control.ts",
    "utf8",
  );
  const stepUpdateDialogSource = readFileSync(
    "src/components/production/step-update-dialog.tsx",
    "utf8",
  );
  const productionDetailRouteSource = readFileSync(
    "src/app/(dashboard)/production/[id]/page.tsx",
    "utf8",
  );
  const productionDetailPageSource = readFileSync(
    "src/components/production/legacy-production-detail-page.tsx",
    "utf8",
  );
  const productionDetailTabsSource = readFileSync(
    "src/lib/production-detail-tabs.ts",
    "utf8",
  );
  const pageShellSource = readFileSync("src/components/page-shell.tsx", "utf8");
  const productionStepActionsSource = readFileSync(
    "src/lib/production-step-actions.ts",
    "utf8",
  );
  const productionModuleNavSource = readFileSync(
    "src/components/production/production-module-nav.tsx",
    "utf8",
  );
  const productionWorklistSource = readFileSync(
    "src/components/production/production-control-worklist.tsx",
    "utf8",
  );
  const dataTableSource = readFileSync(
    "src/components/ui/data-table.tsx",
    "utf8",
  );
  const garmentPickSource = readFileSync(
    "src/components/production/garment-pick-card.tsx",
    "utf8",
  );
  const materialUsageSource = readFileSync(
    "src/components/material-usage.tsx",
    "utf8",
  );
  const createProductionSource = readFileSync(
    "src/components/production/create-production-dialog.tsx",
    "utf8",
  );
  const outsourceRouteSource = readFileSync(
    "src/app/(dashboard)/outsource/page.tsx",
    "utf8",
  );
  const outsourceSource = readFileSync(
    "src/components/outsource/legacy-outsource-page.tsx",
    "utf8",
  );
  const filmStockRouteSource = readFileSync(
    "src/app/(dashboard)/production/films/page.tsx",
    "utf8",
  );
  const filmStockSource = readFileSync(
    "src/components/production/legacy-film-stock-page.tsx",
    "utf8",
  );
  const stockSyncSource = readFileSync(
    "src/server/routers/stock-sync.ts",
    "utf8",
  );
  const productRouterSource = readFileSync(
    "src/server/routers/product.ts",
    "utf8",
  );
  const controlSizeSource = readFileSync(
    "src/components/ui/control-size.ts",
    "utf8",
  );
  const buttonSource = readFileSync("src/components/ui/button.tsx", "utf8");
  const dialogSource = readFileSync("src/components/ui/dialog.tsx", "utf8");
  const dialogFooterSource = readFileSync(
    "src/components/ui/dialog-submit-footer.tsx",
    "utf8",
  );
  const productionDesignSource = readFileSync(
    "src/components/production/production-design-card.tsx",
    "utf8",
  );
  const printRunDialogSource = readFileSync(
    "src/components/production/print-runs-screen.tsx",
    "utf8",
  );
  const printRunViewSource = readFileSync(
    "src/components/production/print-runs-page-view.tsx",
    "utf8",
  );
  const productionV2WorkspaceSource = readFileSync(
    "src/components/production-v2/production-v2-workspace.tsx",
    "utf8",
  );
  const productionV2ControlSource = readFileSync(
    "src/components/production-v2/production-v2-control-record.tsx",
    "utf8",
  );
  const manufacturingStationSource = readFileSync(
    "src/components/factory/manufacturing-station-screen.tsx",
    "utf8",
  );
  const manufacturingFactorySource = readFileSync(
    "src/components/factory/manufacturing-factory-board.tsx",
    "utf8",
  );
  const problems: string[] = [];

  if (
    !productionBoardRouteSource.includes("productionV2Enabled()") ||
    !productionBoardRouteSource.includes("<ProductionV2Workspace />") ||
    !productionBoardRouteSource.includes("<LegacyProductionPage />") ||
    !productionDetailRouteSource.includes("<ProductionV2ControlRecord") ||
    !productionDetailRouteSource.includes("<LegacyProductionDetailPage") ||
    !outsourceRouteSource.includes('redirect("/production?view=outsource")') ||
    !filmStockRouteSource.includes(
      'redirect("/production?view=work-centers&center=DTF_PRINT")',
    ) ||
    !productionV2WorkspaceSource.includes(
      "trpc.manufacturing.controlList.useInfiniteQuery",
    ) ||
    !productionV2WorkspaceSource.includes("query.fetchNextPage()") ||
    !productionV2WorkspaceSource.includes("QueryError") ||
    !productionV2ControlSource.includes("trpc.manufacturing.workOrder.useQuery") ||
    !manufacturingStationSource.includes("availableCommands") ||
    !manufacturingStationSource.includes("primaryStationCommand") ||
    !manufacturingStationSource.includes(
      "trpc.manufacturing.stationHandoff.useQuery",
    ) ||
    !manufacturingStationSource.includes(
      "trpc.manufacturing.stationOrderContext.useQuery",
    ) ||
    manufacturingStationSource.includes(
      "trpc.manufacturing.workOrder.useQuery",
    ) ||
    !manufacturingFactorySource.includes("trpc.manufacturing.workCenterLoad.useQuery")
  ) {
    problems.push(
      "Production V2 ต้องมี canonical list/control/station/TV หลัง flag และ legacy route ต้องเหลือแค่ rollback/redirect",
    );
  }

  if (
    !productionBoardSource.includes("const meQuery = trpc.user.me.useQuery()") ||
    !productionBoardSource.includes("loading={isLoading || meQuery.isLoading}") ||
    !productionBoardSource.includes("meQuery.isError && !me") ||
    !productionBoardSource.includes("onRetry: () => meQuery.refetch()") ||
    !productionBoardSource.includes("isError && !orders") ||
    !productionBoardSource.includes("onRetry: () => refetch()") ||
    !productionBoardSource.includes(
      "canSupervise && orders !== undefined && !isError && !meQuery.isError;",
    ) ||
    !productionBoardSource.includes("canCreateProduction={canCreateProduction}") ||
    !productionBoardSource.includes("createOrderId && canCreateProduction") ||
    !createProductionSource.includes("{isError ? (")
  ) {
    problems.push(
      "บอร์ดผลิตต้องรอ permission มี error+retry และปิดการสร้างเมื่อข้อมูลล่าสุดไม่พร้อม",
    );
  }

  if (
    !productionModuleNavSource.includes("<DropdownMenu.Root>") ||
    !productionModuleNavSource.includes('aria-label="เมนูงานผลิต"') ||
    !productionModuleNavSource.includes("MODULE_ITEMS.map") ||
    !productionModuleNavSource.includes("WORKSPACE_ITEMS.map") ||
    productionModuleNavSource.includes("data-production-module-nav") ||
    productionModuleNavSource.includes("no-scrollbar -mb-px") ||
    !productionBoardSource.includes("action={<ProductionModuleNav />}")
  ) {
    problems.push(
      "โมดูลผลิตต้องไม่มี visible tab row และรวมทางเข้าสลับพื้นที่ไว้ในเมนูเดียวข้างหัวหน้า",
    );
  }

  if (
    !productionWorklistSource.includes("<DataTable.Head>\n        <tr>") ||
    productionWorklistSource.includes(
      "<DataTable.Head>\n        <DataTable.Row>",
    ) ||
    (productionWorklistSource.match(/<DataTable\.SortableTh/g) ?? []).length !== 4 ||
    !productionWorklistSource.includes('sortColumn("orderNumber")') ||
    !productionWorklistSource.includes('sortColumn("progress")') ||
    !productionWorklistSource.includes('sortColumn("totalQuantity")') ||
    !productionWorklistSource.includes('sortColumn("deadline")') ||
    !productionWorklistSource.includes("PRODUCTION_WORKLIST_SORT_OPTIONS.map") ||
    !dataTableSource.includes(
      "cursor-pointer touch-manipulation items-center",
    ) ||
    !dataTableSource.includes("[@media(pointer:coarse)]:min-h-11")
  ) {
    problems.push(
      "หัวตารางผลิตต้องใช้ SortableTh 4 คอลัมน์โดยไม่ย้อมพื้นทั้งแถวและคงเป้าแตะ 44px",
    );
  }

  if (
    (productionDetailSource.match(/<PageShell\b/g) ?? []).length !== 1 ||
    !productionDetailSource.includes('width="full"') ||
    !productionDetailSource.includes("header={<></>}") ||
    !pageShellSource.includes("header?: ReactNode") ||
    !pageShellSource.includes("{header ?? (") ||
    productionDetailSource.includes("ProductionModuleNav") ||
    productionDetailSource.includes("PageHeader") ||
    !productionDetailSource.includes("<ProductionControlRecord") ||
    !productionDetailSource.includes('data-station-current-job=""') ||
    !productionDetailSource.includes(
      "loading={productionQuery.isLoading || meQuery.isLoading}",
    ) ||
    !productionDetailSource.includes("meQuery.isError && !me") ||
    !productionDetailSource.includes(
      "productionQuery.isError && !production && !productionNotFound",
    ) ||
    !productionDetailSource.includes(
      'productionQuery.error?.data?.code === "NOT_FOUND"',
    ) ||
    !productionDetailSource.includes('error.data?.code !== "NOT_FOUND"') ||
    !productionDetailSource.includes("onRetry: () => meQuery.refetch()") ||
    !productionDetailSource.includes("onRetry: () => productionQuery.refetch()") ||
    !productionDetailSource.includes("<RecordNotFound") ||
    !productionControlSource.includes('data-production-control-record=""') ||
    !productionControlSource.includes('data-production-step-flow=""') ||
    !productionControlSource.includes("selectedStepId={selectedStep.id}") ||
    !productionControlSource.includes("ขั้นก่อนหน้า") ||
    !productionControlSource.includes("ขั้นถัดไป") ||
    !productionRouteRailSource.includes('aria-current={selected ? "step" : undefined}') ||
    productionRouteRailSource.includes("<button") ||
    productionRouteRailSource.includes("onSelectStep") ||
    productionControlSource.includes("บันทึกเส้นทางการผลิต") ||
    productionControlSource.includes("กิจกรรมและหลักฐาน") ||
    productionControlSource.includes("border-dashed") ||
    productionControlSource.includes("ข้อมูลที่ต้องเพิ่ม")
  ) {
    problems.push(
      "ใบผลิตต้องแยก ERP control record กับ Station current job, ไม่เผย developer data-gap และคง loading/error/permission fail-closed",
    );
  }

  if (
    !productionDetailPageSource.includes("normalizeProductionDetailTab(rawTab)") ||
    !productionDetailSource.includes('surface === "erp" ? (') ||
    !productionDetailSource.includes("onManageStep={openManagerStep}") ||
    !productionDetailSource.includes("mode={selectedStepMode}") ||
    !stepUpdateDialogSource.includes('mode?: "operation" | "manager"') ||
    !stepUpdateDialogSource.includes('const managerOnly = mode === "manager"') ||
    !stepUpdateDialogSource.includes("trpc.production.assignProductionStep") ||
    !stepUpdateDialogSource.includes("trpc.production.resolveStationProblem") ||
    !stepUpdateDialogSource.includes("ผู้รับผิดชอบปัจจุบัน") ||
    !stepUpdateDialogSource.includes("แก้ปัญหาแล้ว ส่งกลับสถานี") ||
    !stepUpdateDialogSource.includes("{!managerOnly ? (") ||
    stepUpdateDialogSource.includes('managerOnly ? "หมายเหตุสำหรับทีม"') ||
    !productionDetailSource.includes("canReportStationProblem") ||
    !productionDetailSource.includes("trpc.production.reportStationProblem") ||
    !productionDetailSource.includes("<GoodsReceiptDialog") ||
    !productionDetailSource.includes('receiptType="CUSTOMER_GARMENT"') ||
    !productionDetailSource.includes('stationCurrentNowStep?.group === "current"') ||
    !productionDetailSource.includes("stationCurrentNowStep.waitingOn.length === 0") ||
    !productionDetailSource.includes("stationCurrentActionTarget?.printRunItems.length === 0") ||
    !productionDetailSource.includes("factoryStationKeyForStep(stationProblemTarget.stepType) === station") ||
    !productionDetailSource.includes("legacyReadinessUnknown={legacyGarmentReadinessUnknown}") ||
    !productionControlSource.includes("GarmentControlEvidence") ||
    !productionControlSource.includes('kind: "unknown"') ||
    !productionControlProjectionSource.includes('kind: "not-applicable"') ||
    !productionControlProjectionSource.includes('kind: "known"') ||
    !productionControlProjectionSource.includes("requiresAttention") ||
    !productionControlProjectionSource.includes("factoryStationKeyForStep") ||
    !productionControlProjectionSource.includes("overdueOutsourceDays") ||
    !productionControlProjectionSource.includes("OUTSOURCE_AWAITING_RETURN_STATUSES") ||
    !productionControlProjectionSource.includes('activeOutsource.status === "RECEIVED_BACK"') ||
    !productionStepActionsSource.includes('["DTF_PRINT", "GARMENT_RECEIVE"]') ||
    !productionDetailTabsSource.includes('{ key: "inventory", label: "เบิกของ" }') ||
    (productionDetailSource.match(/<MaterialUsage\b/g) ?? []).length !== 1 ||
    !materialUsageSource.includes('const Surface = embedded ? "div" : Card;')
  ) {
    problems.push(
      "ERP ต้องแสดง evidence/exception จริง ส่วน Station ใช้ command และ service เฉพาะทางโดยไม่ข้าม readiness",
    );
  }

  if (
    !garmentPickSource.includes("garmentPickQuery.isLoading") ||
    !garmentPickSource.includes(
      "garmentPickQuery.isError && !garmentPickQuery.data",
    ) ||
    !garmentPickSource.includes("garmentPickQuery.refetch()") ||
    !garmentPickSource.includes("legacyReadinessUnknown?: boolean") ||
    !garmentPickSource.includes("ไม่มีรายการเสื้อที่ตรวจยอดจากสต๊อคได้") ||
    !garmentPickSource.includes("const totalNeeded = data.lines.reduce") ||
    !garmentPickSource.includes("const fulfilledQty = data.lines.reduce") ||
    !garmentPickSource.includes("const missingQty = data.lines.reduce") ||
    !garmentPickSource.includes("เบิกสุทธิ") ||
    !garmentPickSource.includes("ยังขาด") ||
    !materialUsageSource.includes("materialsQuery.isLoading") ||
    !materialUsageSource.includes("materialsQuery.isError && !materialsQuery.data") ||
    !materialUsageSource.includes("materialsQuery.data !== undefined") ||
    !materialUsageSource.includes("searchQuery.isError && !searchQuery.data") ||
    !materialUsageSource.includes("searchQuery.data !== undefined") ||
    !materialUsageSource.includes("searchQuery.refetch()") ||
    !materialUsageSource.includes("readOnly?: boolean") ||
    !materialUsageSource.includes("!readOnly && localMaterials.length > 0")
  ) {
    problems.push("ข้อมูลเสื้อ/วัตถุดิบต้องแยก loading, error+retry และ success-empty");
  }

  if (
    !outsourceSource.includes("currentQcFailTarget !== null") ||
    !outsourceSource.includes(
      'currentQcFailTarget.availableCommands.includes("failQc")',
    ) ||
    !outsourceSource.includes(
      'currentShareTarget?.availableCommands.includes("share")',
    ) ||
    !outsourceSource.includes(
      'currentReceiveTarget.availableCommands.includes("receiveBack")',
    ) ||
    !outsourceSource.includes("enabled: !ordersStale") ||
    !filmStockSource.includes("const canWrite = canManage && !listStale") ||
    !filmStockSource.includes("consuming && canWrite")
  ) {
    problems.push("dialog งานร้านนอกและคลังฟิล์มต้องปิดทันทีเมื่อสิทธิ์หรือข้อมูล stale");
  }

  if (
    !stockSyncSource.includes('"see_finance"') ||
    !stockSyncSource.includes("redactCostFields(") ||
    !productRouterSource.includes('"see_finance"') ||
    !productRouterSource.includes("variants: product.variants.map") ||
    !productRouterSource.includes("redactCostFields(variant, false)")
  ) {
    problems.push("API วัตถุดิบต้องตัดต้นทุนทั้งรายการหลักและ variant ก่อนถึง browser ช่าง");
  }

  if (
    (controlSizeSource.match(/\[@media\(pointer:coarse\)\]:min-h-11/g) ?? [])
      .length < 3 ||
    !buttonSource.includes("[@media(pointer:coarse)]:min-w-11") ||
    !dialogSource.includes("[@media(pointer:coarse)]:w-11")
  ) {
    problems.push("control/ปุ่มปิด dialog ต้องคงเป้ากด 44px บน pointer coarse ทุกความกว้าง");
  }

  if (
    !dialogFooterSource.includes("pendingLabel?: ReactNode") ||
    !dialogFooterSource.includes("aria-busy={pending || undefined}") ||
    !dialogFooterSource.includes("pending ? (pendingLabel ?? submitLabel) : submitLabel") ||
    !printRunDialogSource.includes('pendingLabel="กำลังปิดรอบ..."')
  ) {
    problems.push("dialog mutation ต้องประกาศ busy และมีข้อความ pending ที่ไม่พึ่ง spinner");
  }

  if (
    !productionDesignSource.includes("missingApprovalIsReference?: boolean") ||
    !productionDesignSource.includes("ไม่บล็อกขั้นปัจจุบัน") ||
    productionDesignSource.includes('text-slate-400">{pr.designNote}') ||
    printRunDialogSource.includes('block text-xs text-slate-400') ||
    printRunViewSource.includes('border-slate-300 bg-surface')
  ) {
    problems.push("ข้อความรองและขอบ control บนหน้าผลิตต้องใช้ token ที่ผ่าน contrast");
  }

  if (problems.length) {
    failed++;
    console.log("❌ หน้าผลิตหลักยังแยก state/permission/touch contract ไม่ครบ");
    problems.forEach((problem) => console.log(`   ${problem}`));
  } else {
    console.log("✅ หน้าผลิตหลักแยก state/permission และคง touch target บนจอทัช");
  }
}

/* ── รอบพิมพ์: ทางเดินหน้างาน + workspace สองฝั่ง ─────────────────────────
   PRINTED ใหม่กว่าเคยดัน PRINTING ลงล่างเพราะรวม activeRuns ก้อนเดียว และ
   desktop เคยวางรอบ/คิวเต็มแถวต่อกันจนช่างมองสองอย่างพร้อมกันไม่ได้ */
{
  const printRunsControllerSource = readFileSync(
    "src/components/production/print-runs-screen.tsx",
    "utf8",
  );
  const printRunsViewSource = readFileSync(
    "src/components/production/print-runs-page-view.tsx",
    "utf8",
  );
  const printRunsSource = `${printRunsControllerSource}\n${printRunsViewSource}`;
  const queueRowStart = printRunsViewSource.indexOf("function QueueRow");
  const queueRowSource = printRunsViewSource.slice(queueRowStart);
  const printingIndex = printRunsViewSource.indexOf('stage="printing"');
  const printedIndex = printRunsViewSource.indexOf('stage="printed"');
  const queueIndex = printRunsViewSource.indexOf('data-print-run-queue=""');
  const historyIndex = printRunsViewSource.indexOf('data-print-run-history=""');
  const selectionIndex = printRunsViewSource.indexOf(
    'data-print-run-selection-bar=""',
  );
  const queueListIndex = printRunsViewSource.indexOf(
    'data-print-run-queue-list=""',
    queueIndex,
  );
  const problems: string[] = [];

  const { PrintRunsPageView } = require(
    "../src/components/production/print-runs-page-view",
  );
  const noop = () => {};
  const queueFixture = Array.from({ length: 24 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      stepId: `queue-${number}`,
      productionId: `production-${number}`,
      orderId: `order-${number}`,
      orderNumber: `ORD-VERIFY-${number}`,
      orderName: `งานทดสอบ ${number}`,
      customerName: `ลูกค้าทดสอบ ${number}`,
      dueDate: `2099-08-${number}T03:00:00.000Z`,
      qtyDone: 0,
      qtyTotal: 10,
      remaining: 10,
      design: {
        versionNumber: 1,
        fileUrl: `/api/files/verify/queue-${number}.pdf`,
        thumbnailUrl: null,
      },
    };
  });
  const runFixture = (status: string, runNumber: string) => ({
    id: runNumber,
    runNumber,
    status,
    note: null,
    createdAt: "2026-08-15T02:00:00.000Z",
    printedAt: status === "PRINTING" ? null : "2026-08-15T03:00:00.000Z",
    completedAt:
      status === "COMPLETED" || status === "CANCELLED"
        ? "2026-08-15T04:00:00.000Z"
        : null,
    blockedReason: null,
    createdBy: { name: "ช่างทดสอบ" },
    items: [
      {
        id: `${runNumber}-item`,
        qty: 5,
        extraQty: status === "COMPLETED" ? 1 : 0,
        order: {
          orderNumber: `ORD-${runNumber}`,
          title: "งานในรอบทดสอบ",
          internalStatus: "PRODUCING",
          designs: [
            {
              versionNumber: 2,
              fileUrl: `/api/files/verify/${runNumber}.pdf`,
              thumbnailUrl: null,
            },
          ],
        },
      },
    ],
  });
  const picked = { "queue-02": 4, "queue-24": 3 };
  const selection = {
    picked,
    entries: [queueFixture[1], queueFixture[23]],
    total: 7,
    hasInvalidQty: false,
    note: "ม้วนทดสอบ",
    createPending: false,
    onNoteChange: noop,
    onCreate: noop,
    onToggle: noop,
    onFocusAction: noop,
    onQtyChange: noop,
  };
  const viewProps = {
    queue: queueFixture,
    printingRuns: [runFixture("PRINTING", "FR-VERIFY-PRINTING")],
    printedRuns: [runFixture("PRINTED", "FR-VERIFY-PRINTED")],
    historyRuns: [
      runFixture("COMPLETED", "FR-VERIFY-COMPLETED"),
      runFixture("CANCELLED", "FR-VERIFY-CANCELLED"),
    ],
    queueError: false,
    listError: false,
    onRetryQueue: noop,
    onRetryList: noop,
    actionNoteRef: { current: null },
    selection,
    runActions: {
      busy: false,
      onMarkPrinted: noop,
      onCancel: noop,
      onComplete: noop,
    },
  };
  const managerHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, { ...viewProps, canManage: true }),
  );
  const readOnlyHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, { ...viewProps, canManage: false }),
  );
  const pendingHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, {
      ...viewProps,
      canManage: true,
      selection: { ...selection, createPending: true },
    }),
  );
  const emptyHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, {
      ...viewProps,
      queue: [],
      printingRuns: [],
      printedRuns: [],
      historyRuns: [],
      canManage: true,
      selection: {
        ...selection,
        picked: {},
        entries: [],
        total: 0,
      },
    }),
  );
  const errorHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, {
      ...viewProps,
      queue: [],
      printingRuns: [],
      printedRuns: [],
      historyRuns: [],
      canManage: true,
      queueError: true,
      listError: true,
      selection: {
        ...selection,
        picked: {},
        entries: [],
        total: 0,
      },
    }),
  );
  const blockedRun = {
    ...runFixture("PRINTING", "FR-VERIFY-BLOCKED"),
    blockedReason: "หยุดรอบนี้ — งาน ORD-BLOCKED อยู่สถานะ พักงาน",
  };
  const blockedHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, {
      ...viewProps,
      queue: [],
      printingRuns: [blockedRun],
      printedRuns: [],
      historyRuns: [],
      canManage: true,
      selection: { ...selection, picked: {}, entries: [], total: 0 },
    }),
  );
  const blockedPrintedHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, {
      ...viewProps,
      queue: [],
      printingRuns: [],
      printedRuns: [{ ...blockedRun, status: "PRINTED" }],
      historyRuns: [],
      canManage: true,
      selection: { ...selection, picked: {}, entries: [], total: 0 },
    }),
  );
  const staleHtml = renderToStaticMarkup(
    React.createElement(PrintRunsPageView, {
      ...viewProps,
      canManage: true,
      canManageQueue: false,
      canManageRuns: false,
      queueStale: true,
      listStale: true,
    }),
  );
  const renderedPrintingIndex = managerHtml.indexOf('data-print-run-stage="printing"');
  const renderedPrintedIndex = managerHtml.indexOf('data-print-run-stage="printed"');
  const renderedQueueIndex = managerHtml.indexOf('data-print-run-queue=""');
  const renderedHistoryIndex = managerHtml.indexOf('data-print-run-history=""');
  const renderedSelectionIndex = managerHtml.indexOf('data-print-run-selection-bar=""');
  const renderedQueueListIndex = managerHtml.indexOf('data-print-run-queue-list=""');
  const renderedRows = [
    ...managerHtml.matchAll(/data-print-run-queue-row="([^"]+)"/g),
  ].map((match) => match[1]);

  if (
    printRunsControllerSource.includes("breadcrumb=") ||
    !printRunsControllerSource.includes(
      'action={surface === "erp" ? <ProductionModuleNav /> : undefined}',
    )
  ) {
    problems.push("หน้ารอบพิมพ์ต้องใช้เมนูงานผลิตข้างหัวหน้าโดยไม่มี breadcrumb ซ้ำ");
  }

  if (
    !(
      renderedPrintingIndex < renderedPrintedIndex &&
      renderedPrintedIndex < renderedQueueIndex &&
      renderedQueueIndex < renderedHistoryIndex
    ) ||
    !managerHtml
      .slice(renderedPrintingIndex, renderedPrintedIndex)
      .includes("FR-VERIFY-PRINTING") ||
    !managerHtml
      .slice(renderedPrintedIndex, renderedQueueIndex)
      .includes("FR-VERIFY-PRINTED")
  ) {
    problems.push("fixture populated ต้อง render รอบตามลำดับสถานะจริง");
  }
  if (
    renderedRows.length !== queueFixture.length ||
    renderedRows.join(",") !== queueFixture.map((entry) => entry.stepId).join(",")
  ) {
    problems.push("fixture คิวยาวต้อง render ครบและรักษาลำดับจาก service");
  }
  if (
    renderedSelectionIndex < renderedQueueIndex ||
    renderedSelectionIndex > renderedQueueListIndex ||
    !managerHtml.includes("เลือก 2 งาน · รวม 7 ชิ้น") ||
    (managerHtml.match(/aria-pressed="true"/g) ?? []).length !== 2 ||
    !managerHtml.includes('id="print-run-qty-queue-02"') ||
    !managerHtml.includes('id="print-run-qty-queue-24"') ||
    !managerHtml.includes("เปิดรอบพิมพ์") ||
    !managerHtml.includes("พิมพ์จบทั้งม้วน") ||
    !managerHtml.includes("ตัดแยก+ติดป้ายเสร็จ")
  ) {
    problems.push("fixture ผู้จัดการต้องเห็น selection และ action ครบ");
  }
  if (
    !managerHtml.slice(renderedQueueIndex, renderedHistoryIndex).includes("sticky z-20") ||
    !managerHtml.slice(renderedQueueIndex, renderedHistoryIndex).includes("top-3") ||
    !managerHtml
      .slice(renderedQueueIndex, renderedHistoryIndex)
      .includes("card-surface overflow-clip rounded-2xl")
  ) {
    problems.push("fixture คิวยาวต้องคง sticky bar ใต้ ancestor ที่ไม่เป็น scroll container");
  }
  if (
    (readOnlyHtml.match(/data-print-run-queue-row=/g) ?? []).length !==
      queueFixture.length ||
    !readOnlyHtml.includes("ORD-VERIFY-01") ||
    !readOnlyHtml.includes("ORD-VERIFY-24") ||
    readOnlyHtml.includes("data-print-run-selection-bar") ||
    readOnlyHtml.includes("aria-pressed=") ||
    readOnlyHtml.includes('id="print-run-qty-') ||
    readOnlyHtml.includes("<button")
  ) {
    problems.push("fixture read-only ต้องเห็นคิวครบโดยไม่มี selection หรือ mutation action");
  }
  if (
    !pendingHtml.includes('aria-busy="true"') ||
    !pendingHtml.includes("กำลังเปิดรอบ…") ||
    !pendingHtml.includes('aria-hidden="true"') ||
    !pendingHtml.includes("motion-reduce:animate-none")
  ) {
    problems.push("ปุ่มเปิดรอบระหว่างรอต้องประกาศ busy และหยุด animation เมื่อ reduce motion");
  }
  if (
    !emptyHtml.includes("ตอนนี้เครื่องยังไม่มีรอบพิมพ์") ||
    !emptyHtml.includes("ไม่มีรอบที่รอตัดแยก") ||
    !emptyHtml.includes("คิวพิมพ์ว่าง") ||
    !emptyHtml.includes("ยังไม่มีรอบที่ปิดเสร็จหรือยกเลิกใน 7 วันล่าสุด") ||
    emptyHtml.includes('role="alert"') ||
    emptyHtml.includes("data-print-run-selection-bar")
  ) {
    problems.push("fixture empty ต้องแยกข้อความครบทั้ง 4 ช่วงโดยไม่มี error/selection ปน");
  }
  if (
    (errorHtml.match(/role="alert"/g) ?? []).length !== 3 ||
    (errorHtml.match(/ลองใหม่/g) ?? []).length !== 3 ||
    errorHtml.includes("ตอนนี้เครื่องยังไม่มีรอบพิมพ์") ||
    errorHtml.includes("คิวพิมพ์ว่าง") ||
    errorHtml.includes("ยังไม่มีรอบที่ปิดเสร็จหรือยกเลิกใน 7 วันล่าสุด")
  ) {
    problems.push("fixture error ต้องมี retry แยก stage/queue/history และไม่ปลอมเป็น empty");
  }
  if (
    !blockedHtml.includes("หยุดรอบนี้") ||
    !blockedHtml.includes("พักงาน") ||
    blockedHtml.includes("พิมพ์จบทั้งม้วน") ||
    !blockedHtml.includes("ยกเลิกรอบ") ||
    blockedPrintedHtml.includes("พิมพ์จบทั้งม้วน") ||
    blockedPrintedHtml.includes("ตัดแยก+ติดป้ายเสร็จ") ||
    blockedPrintedHtml.includes("ยกเลิกรอบ")
  ) {
    problems.push("active run ที่ถูกบล็อกต้องเดินต่อไม่ได้ แต่ PRINTING ยังยกเลิกเพื่อ recovery ได้");
  }
  if (
    (staleHtml.match(/ข้อมูลเดิมยังแสดงอยู่ แต่อาจไม่ใช่สถานะล่าสุด/g) ?? []).length !== 2 ||
    !staleHtml.includes("FR-VERIFY-PRINTING") ||
    !staleHtml.includes("ORD-VERIFY-01") ||
    staleHtml.includes("เปิดรอบพิมพ์") ||
    staleHtml.includes("พิมพ์จบทั้งม้วน") ||
    staleHtml.includes("ตัดแยก+ติดป้ายเสร็จ")
  ) {
    problems.push("background error ต้องคง cached queue/list พร้อม stale warning และ fail closed");
  }

  if (
    printingIndex < 0 ||
    printedIndex < 0 ||
    queueIndex < 0 ||
    historyIndex < 0 ||
    !(printingIndex < printedIndex &&
      printedIndex < queueIndex &&
      queueIndex < historyIndex)
  ) {
    problems.push("DOM ต้องเรียงกำลังพิมพ์ → รอตัดแยก → คิว → ประวัติ");
  }
  if (
    !printRunsSource.includes('data-print-run-workspace=""') ||
    !printRunsSource.includes(
      "lg:grid-cols-[minmax(18rem,4fr)_minmax(0,6fr)] xl:grid-cols-[minmax(22rem,5fr)_minmax(0,7fr)]",
    ) ||
    !printRunsSource.includes("splitPrintRunsByStage(runs)") ||
    printRunsSource.includes("activeRuns") ||
    printRunsSource.includes(".sort(")
  ) {
    problems.push(
      "desktop ต้องเห็นรอบกับคิวพร้อมกัน แยกสถานะ และคงลำดับคิวจาก service",
    );
  }
  if (
    !printRunsSource.includes("meQuery.isLoading") ||
    !printRunsSource.includes("meQuery.isError && !me") ||
    !printRunsSource.includes("const permissionStale = meQuery.isError && Boolean(me)") ||
    !printRunsSource.includes("!permissionStale && permAllows") ||
    !printRunsSource.includes("canManage && !listQuery.isError && completing") ||
    !printRunsSource.includes("queueQuery.isError && !queueQuery.data") ||
    !printRunsSource.includes("listQuery.isError && !listQuery.data") ||
    !printRunsSource.includes("ดูอย่างเดียว")
  ) {
    problems.push("permission loading/error/read-only ต้องไม่กลายเป็นคิวเลือกได้ชั่วคราว");
  }
  if (
    queueRowStart < 0 ||
    queueRowSource.indexOf("<DesignThumb") < 0 ||
    queueRowSource.indexOf("<button") < 0 ||
    queueRowSource.indexOf("<DesignThumb") > queueRowSource.indexOf("<button") ||
    /<button[\s\S]*?<DesignThumb/.test(queueRowSource)
  ) {
    problems.push("ลิงก์ไฟล์ลายต้องเป็น sibling ก่อนปุ่มเลือกแถว ห้ามซ้อนใน button");
  }
  if (
    !printRunsSource.includes('size === "md" ? "h-14 w-14" : "h-11 w-11"') ||
    !printRunsSource.includes(
      'PRINT_RUN_CONTROL_H = "h-11 min-h-11 sm:h-11 sm:min-h-11"',
    ) ||
    !queueRowSource.includes("min-h-[80px]") ||
    !queueRowSource.includes("PRINT_RUN_CONTROL_H") ||
    queueRowSource.includes("h-10")
  ) {
    problems.push("thumbnail/แถวเลือก/ช่องจำนวนต้องมีเป้ากดอย่างน้อย 44px");
  }
  if (
    !printRunsSource.includes('aria-live="polite"') ||
    !printRunsSource.includes('aria-label="โน้ตรอบพิมพ์"') ||
    !queueRowSource.includes("aria-invalid={invalid || undefined}") ||
    !queueRowSource.includes("ไปที่แถบเปิดรอบ") ||
    !queueRowSource.includes("onFocusAction")
  ) {
    problems.push("selection/validation ต้องประกาศสถานะและมีทาง keyboard ไป action bar");
  }
  if (
    selectionIndex < queueIndex ||
    queueListIndex < 0 ||
    selectionIndex > queueListIndex ||
    !printRunsSource.includes('stationMode ? "top-32" : "top-3"') ||
    !printRunsSource.includes('className="card-surface overflow-clip rounded-2xl"')
  ) {
    problems.push("แถบเปิดรอบต้องอยู่ในบริบทคิวและตามเห็นทันทีเมื่อเลือกงาน");
  }

  if (problems.length) {
    failed++;
    console.log("❌ รอบพิมพ์กลับไปเรียงงานหรือวาง workspace ผิด");
    problems.forEach((problem) => console.log(`   ${problem}`));
  } else {
    console.log("✅ รอบพิมพ์เรียงตามหน้างานและเห็นรอบกับคิวพร้อมกัน");
  }
}

/* ── Station Mode: current job + ready/blocked rail ไม่มี sidebar/เงิน ───────
   Scan เปิดบริบทเท่านั้น; current ถูกตัดออกจาก rail และ blocked ต้องแสดงเหตุจริง
   แยกจาก ready ส่วน mutation ทุกก้อนยังผ่าน service/server guard เฉพาะทาง */
{
  const stationPageSource = readFileSync(
    "src/components/factory/station-mode-screen.tsx",
    "utf8",
  );
  const stationShellSource = readFileSync(
    "src/components/factory/station-mode-shell.tsx",
    "utf8",
  );
  const stationCurrentLayoutSource = readFileSync(
    "src/components/factory/station-current-layout.tsx",
    "utf8",
  );
  const stationQueueSource = readFileSync(
    "src/components/factory/station-queue-view.tsx",
    "utf8",
  );
  const stationOrderSource = readFileSync(
    "src/components/factory/station-order-workspace.tsx",
    "utf8",
  );
  const stationGarmentPreviewSource = readFileSync(
    "src/components/factory/station-garment-preview.tsx",
    "utf8",
  );
  const factoryRouterSource = readFileSync(
    "src/server/routers/factory.ts",
    "utf8",
  );
  const orderRouterSource = readFileSync(
    "src/server/routers/order.ts",
    "utf8",
  );
  const productionRouterSource = readFileSync(
    "src/server/routers/production.ts",
    "utf8",
  );
  const deliveryDialogSource = readFileSync(
    "src/components/orders/delivery/create-delivery-dialog.tsx",
    "utf8",
  );
  const packingReadinessSource = readFileSync(
    "src/server/services/packing-readiness.ts",
    "utf8",
  );
  const jobTicketSource = readFileSync(
    "src/app/(print)/print/job-ticket/[id]/page.tsx",
    "utf8",
  );
  const productionSummarySource = readFileSync(
    "src/components/orders/production-summary-card.tsx",
    "utf8",
  );
  const factoryBoardSource = readFileSync(
    "src/server/services/factory-board.ts",
    "utf8",
  );
  const ownerPulseSource = readFileSync(
    "src/server/services/owner-pulse.ts",
    "utf8",
  );
  const productionDetailSource = readFileSync(
    "src/components/production/production-detail-screen.tsx",
    "utf8",
  );
  const stepQtySource = readFileSync(
    "src/components/production/step-qty-sheet.tsx",
    "utf8",
  );
  const qcSource = readFileSync(
    "src/components/qc/order-qc-section.tsx",
    "utf8",
  );
  const garmentServiceSource = readFileSync(
    "src/server/services/garment-pick.ts",
    "utf8",
  );
  const problems: string[] = [];

  if (
    stationPageSource.includes("AppShell") ||
    stationPageSource.includes("Sidebar") ||
    !stationShellSource.includes('href="/production"') ||
    !stationShellSource.includes("จอประจำสถานี")
  ) {
    problems.push("Station Mode ต้องเต็มจอ ไม่มี sidebar ใหม่ และกลับ ERP ได้");
  }
  if (
    !stationPageSource.includes('htmlFor="factory-station-scan"') ||
    !stationPageSource.includes("resolveStationScan.fetch({ value })") ||
    !stationPageSource.includes("data-station-scan=") ||
    stationPageSource.includes("resolveStationScan.useMutation")
  ) {
    problems.push("สแกนต้องมีชื่อช่องและเปิดข้อมูลแบบ read-only เท่านั้น");
  }
  if (
    !stationPageSource.includes(
      "const nextStation = station ?? result.station;",
    )
  ) {
    problems.push("สแกนต้องคงสถานีที่เลือกไว้ และใช้สถานีจาก QR เฉพาะเมื่อยังไม่ได้เลือก");
  }
  if (
    !stationPageSource.includes("trpc.factory.stationQueue.useQuery") ||
    stationPageSource.includes("trpc.production.kanban.useQuery") ||
    !stationPageSource.includes("const permissionStale = meQuery.isError && Boolean(me)") ||
    !stationPageSource.includes("!permissionStale && permAllows") ||
    !stationPageSource.includes("canManageProduction &&")
  ) {
    problems.push("คิว Station ต้องเป็น no-money DTO และทุก action ต้องเริ่มจากสิทธิ์ผลิต");
  }
  if (
    !stationPageSource.includes("<ProductionDetailScreen") ||
    !stationPageSource.includes('surface="station"') ||
    !stationPageSource.includes("station={station}") ||
    !stationPageSource.includes('<PrintRunsScreen surface="station"') ||
    !stationOrderSource.includes("<OrderQcSection") ||
    !stationOrderSource.includes("showShippingCost={false}") ||
    !stationOrderSource.includes("trpc.factory.markReadyToShip.useMutation") ||
    stationOrderSource.includes("trpc.order.updateStatus.useMutation")
  ) {
    problems.push("ใบผลิต/รอบ DTF/QC/แพ็กต้องใช้ controller จริงร่วมกับ ERP และไม่มีเงิน");
  }
  if (
    !stationPageSource.includes("<StationCurrentLayout") ||
    !stationPageSource.includes(
      "selection={{ productionId, orderId, stepId: selectedStepId }}",
    ) ||
    !stationPageSource.includes("showBlocked: true") ||
    !stationPageSource.includes("renderScanPanel(true)") ||
    !stationPageSource.includes("renderScanPanel(false)") ||
    !stationPageSource.includes('variant={compact ? "outline" : "default"}') ||
    !stationCurrentLayoutSource.includes('data-station-region="current"') ||
    !stationCurrentLayoutSource.includes("data-station-queue-rail") ||
    !stationQueueSource.includes("groupStationQueueItems") ||
    !stationQueueSource.includes('status: "active" | "ready" | "blocked"') ||
    !stationQueueSource.includes("[...item.waitingOn, item.note]") ||
    !productionDetailSource.includes("lg:min-h-[calc(100dvh-8rem)]")
  ) {
    problems.push("Station ต้องให้งานปัจจุบันนำ ตัดงานซ้ำออกจาก rail และแยก ready/blocked จากเหตุจริง");
  }
  if (
    !stationPageSource.includes('canCountQc={canManageProduction}') ||
    !stationPageSource.includes('canCreateDelivery={canCreateDelivery}') ||
    !stationPageSource.includes('canAdvancePacking={canAdvancePacking}') ||
    !stationOrderSource.includes(
      'canCount={canCountQc && station === "qc" && !contextStale}',
    ) ||
    !stationOrderSource.includes('canUseStation={station === "final-pack"}') ||
    !stationOrderSource.includes("เปิดสถานี QC ก่อน") ||
    !stationOrderSource.includes("เปิดสถานีแพ็กสุดท้ายก่อน") ||
    !stationPageSource.includes('aria-live="polite"') ||
    !stationPageSource.includes("productionChoiceSummary") ||
    !stationPageSource.includes("setMultiple(null)") ||
    !productionDetailSource.includes("factoryStationKeyForStep(step.stepType) === station") ||
    !productionDetailSource.includes("stationBlockMessage") ||
    !productionDetailSource.includes('order?.internalStatus === "PRODUCING"') ||
    !productionDetailSource.includes("trpc.production.reportStationProblem") ||
    !productionRouterSource.includes("reportStationProblem: protectedProcedure") ||
    !productionRouterSource.includes("factoryStationKeyForStep(existing.stepType)") ||
    !productionRouterSource.includes('source: "STATION"') ||
    !productionRouterSource.includes('operation: "REPORT_PROBLEM"')
  ) {
    problems.push("action Station ต้องตรงสถานี/สถานะและตัวเลือกหลายใบต้องแยกกันชัด");
  }
  if (
    !stationOrderSource.includes('["ON_HOLD", "CANCELLED"]') ||
    !stationOrderSource.includes("ห้ามเริ่ม เบิก ปิดขั้น หรือแพ็กต่อ") ||
    !productionRouterSource.includes('liveOrder.internalStatus !== "PRODUCING"') ||
    !garmentServiceSource.includes('liveOrder.internalStatus !== "PRODUCING"')
  ) {
    problems.push("งานพัก/ยกเลิกต้องอ่านได้แต่เขียน step หรือเบิกเสื้อต่อไม่ได้");
  }
  if (
    !stepQtySource.includes("validateStepQtyInput(value, remaining)") ||
    !stepQtySource.includes("aria-invalid={validation.error !== null || undefined}") ||
    !productionRouterSource.includes("nextQtyDone > nextQtyTotal") ||
    !qcSource.includes("qtyGoodOverLimit") ||
    !qcSource.includes("ของดีสะสมครบยอด — งานจะเข้าคิวแพ็ก") ||
    !qcSource.includes("[idempotencyKey, setIdempotencyKey]") ||
    !qcSource.includes("setIdempotencyKey(crypto.randomUUID())") ||
    !qcSource.includes("idempotencyKey,")
  ) {
    problems.push("จำนวนผลิต/QC เกินต้องถูกปฏิเสธ คำอธิบายต้องตรง server และ QC retry ต้องใช้ key เดิมเฉพาะรอบนั้น");
  }
  if (
    !stationOrderSource.includes("StationQcReference") ||
    !stationOrderSource.includes("<StationGarmentPreview") ||
    !stationOrderSource.includes("BLIND SHIP — ห้ามใส่เอกสารหรือชื่อ Anajak ในกล่อง") ||
    !factoryRouterSource.includes("approvedDesign: row.designs[0] ?? null") ||
    !factoryRouterSource.includes("const workGroups = row.items.map") ||
    !factoryRouterSource.includes("workGroups,") ||
    !stationGarmentPreviewSource.includes('data-station-approved-reference=""') ||
    // เดิมด่านนี้ล็อกทั้งประโยค "ใช้เป็นไฟล์อ้างอิงเท่านั้น ห้ามวางตำแหน่งจากภาพนี้" ซึ่งครึ่งแรก
    // ผูกกับข้อจำกัดที่หมดไปแล้ว (2026-08-22: ม็อกอัพระบุตำแหน่งต่อรูปได้ ระบบไม่ได้เดาอีกต่อไป)
    // สิ่งที่ต้องกันไม่ให้หลุดคือคำสั่ง "ห้ามวางตำแหน่งจากภาพนี้" — ช่างต้องยึดตัวเลขในใบงาน
    !stationGarmentPreviewSource.includes("ห้ามวางตำแหน่งจากภาพนี้") ||
    !stationGarmentPreviewSource.includes("แผนภาพบอกด้านเท่านั้น · ไม่ระบุตำแหน่งย่อย") ||
    !stationGarmentPreviewSource.includes("รูปลายแยกในใบงาน · ไม่ใช่ภาพวางบนเสื้อ") ||
    !stationGarmentPreviewSource.includes("ห้ามเดาจุดวาง") ||
    !stationGarmentPreviewSource.includes("data-station-work-group") ||
    !stationGarmentPreviewSource.includes("data-station-no-shirt-diagram")
  ) {
    problems.push("โต๊ะ QC ต้องเห็นแบบอนุมัติ/ตำแหน่งอย่างซื่อสัตย์ และโต๊ะแพ็กต้องคงคำเตือน blind ship");
  }
  if (
    !factoryRouterSource.includes("stationOrderSelect") ||
    /totalAmount|shippingCost|estimatedCost/.test(
      factoryRouterSource.slice(
        factoryRouterSource.indexOf("const stationOrderSelect"),
        factoryRouterSource.indexOf("const scannedProductionSelect"),
      ),
    ) ||
    !stationOrderSource.includes("nonReturnedDeliveryCount") ||
    !orderRouterSource.includes("assertOrderPackingReadyToShip") ||
    !productionRouterSource.includes("const updateStepResultSelect") ||
    !deliveryDialogSource.includes("? { shippingCost: parseFloat(shippingCost) || 0 }") ||
    !deliveryDialogSource.includes(": {}")
  ) {
    problems.push("station payload ต้องไม่มีเงิน และพร้อมส่งต้องมีหลักฐานแพ็กฝั่ง server");
  }
  if (
    !stationShellSource.includes("min-h-11") ||
    !stationPageSource.includes("canManageProduction") ||
    !stationPageSource.includes("canCreateDelivery") ||
    !stationPageSource.includes("canAdvancePacking") ||
    !stationOrderSource.includes(
      "const canWritePack = canUseStation && !writeBlocked && !packStale;",
    ) ||
    !stationOrderSource.includes("disabled={!canWritePack || !canCreateDelivery}") ||
    !stationOrderSource.includes("disabled={!canWritePack || !canAdvancePacking || !complete")
  ) {
    problems.push("จอทัชและ read-only ต้องคง target 44px พร้อม fail-closed ทุก action");
  }
  if (
    !factoryRouterSource.includes('live.internalStatus !== "PACKING"') ||
    !factoryRouterSource.includes("factoryStationKeyForOrderStatus(row.internalStatus)") ||
    !packingReadinessSource.includes("packingLineKey(line.description") ||
    !packingReadinessSource.includes("packingLineKey(product.description")
  ) {
    problems.push("สแกนหลังผลิตและด่านแพ็กต้องใช้สถานะสดพร้อมแยกสินค้า/ไซส์/สี");
  }
  if (
    !jobTicketSource.includes("productionWorkflowSteps(") ||
    !productionSummarySource.includes("productionWorkflowSteps(") ||
    !factoryBoardSource.includes('stepType: { not: "PACKAGING" }') ||
    !ownerPulseSource.includes('stepType: { not: "PACKAGING" }')
  ) {
    problems.push("PACKAGING รุ่นเก่าต้องไม่กลับมาเป็นคำสั่งผลิตก่อน QC บนทุกผิวงาน");
  }

  const { StationQueueView } = require(
    "../src/components/factory/station-queue-view",
  );
  const { Shirt } = require("lucide-react");
  const now = "2099-08-16T00:00:00.000Z";
  const queueHtml = renderToStaticMarkup(
    React.createElement(StationQueueView, {
      stationLabel: "เตรียมเสื้อ",
      stationDescription: "fixture",
      icon: Shirt,
      onOpen: () => {},
      items: [
        {
          key: "active",
          orderId: "order-active",
          productionId: "production-active",
          orderNumber: "ORD-STATION-ACTIVE",
          title: "กำลังทำ",
          customerName: "ลูกค้า A",
          deadline: now,
          priority: "NORMAL",
          stepLabel: "เบิกเสื้อ",
          status: "active",
          qtyDone: 10,
          qtyTotal: 20,
          overdue: false,
          waitingOn: [],
          note: null,
        },
        {
          key: "ready",
          orderId: "order-ready",
          productionId: "production-ready",
          orderNumber: "ORD-STATION-READY",
          title: "พร้อมทำ",
          customerName: "ลูกค้า B",
          deadline: now,
          priority: "NORMAL",
          stepLabel: "เบิกเสื้อ",
          status: "ready",
          qtyDone: 0,
          qtyTotal: 20,
          overdue: false,
          waitingOn: [],
          note: null,
        },
        {
          key: "blocked",
          orderId: "order-blocked",
          productionId: "production-blocked",
          orderNumber: "ORD-STATION-BLOCKED",
          title: "ติดปัญหา",
          customerName: "ลูกค้า C",
          deadline: now,
          priority: "NORMAL",
          stepLabel: "รีดร้อน",
          status: "blocked",
          qtyDone: 0,
          qtyTotal: 20,
          overdue: false,
          waitingOn: ["รอเสื้อจากสถานีเตรียมเสื้อ"],
          note: null,
        },
      ],
    }),
  );
  if (
    queueHtml.indexOf("กำลังทำ") < 0 ||
    queueHtml.indexOf("คิวพร้อมทำ") < queueHtml.indexOf("กำลังทำ") ||
    queueHtml.indexOf("ORD-STATION-ACTIVE") > queueHtml.indexOf("ORD-STATION-READY") ||
    queueHtml.indexOf("งานติดปัญหา") < queueHtml.indexOf("คิวพร้อมทำ") ||
    !queueHtml.includes("รอเสื้อจากสถานีเตรียมเสื้อ")
  ) {
    problems.push("DOM คิวสถานีต้องเรียงกำลังทำ → พร้อม → blocked และแสดงเหตุจริง");
  }

  if (problems.length) {
    failed++;
    console.log("❌ Station Mode หลุด current/rail/scan/permission/ลำดับงาน");
    problems.forEach((problem) => console.log(`   ${problem}`));
  } else {
    console.log("✅ Station Mode ไม่มี sidebar/เงิน และแยก current/ready/blocked จากข้อมูลจริง");
  }
}

console.log(failed ? `\n❌ ไม่ผ่าน ${failed} ข้อ` : "\n✅ ผ่านครบ");
process.exit(failed ? 1 : 0);
