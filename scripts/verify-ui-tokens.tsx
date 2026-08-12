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
import { Button } from "../src/components/ui/button";
import { DataTable } from "../src/components/ui/data-table";
import { SUNK_PANEL } from "../src/components/ui/tokens";
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

// ① ช่องกรอก/ช่องเลือก/กล่องข้อความ = ตระกูลเดียวกัน พื้น+ขอบ+โฟกัสชุดเดียว
// เบสเคาะสุดท้าย 2026-08-04 หลังเห็นจอจริงทั้งสองแบบ: "พื้นขาว มีขอบบางๆ ธีมมืดสลับ"
// (ลองพื้นเทาไร้ขอบแล้ว — ช่องกลืนกับพื้น/กล่องรอบตัวง่ายเกิน)
const FIELD = [
  "border-field-border",
  "bg-field",
  "placeholder:text-placeholder",
  "focus-visible:border-blue-500",
  "focus-visible:ring-blue-500/20",
  "dark:focus-visible:border-blue-300",
];
// ห้ามย้อนไปพื้นเทา/ไร้ขอบ — เคยลองแล้วเบสตีกลับทั้งสองรอบ
const FIELD_NO = ["bg-slate-100", "border-transparent", "bg-[var(--field-bg)]"];
check("ช่องกรอก (Input)", renderToStaticMarkup(<Input />), [...h, ...FIELD, "rounded-[10px]"], [...FIELD_NO, "rounded-2xl"]);
check(
  "ช่องเลือก (Select)",
  renderToStaticMarkup(<Select value="" onChange={() => {}}><option value="">ก</option></Select>),
  [...h, ...FIELD, "rounded-[10px]"],
  [...FIELD_NO, "rounded-2xl"],
);
check("กล่องข้อความ (Textarea)", renderToStaticMarkup(<Textarea />), [...FIELD, "rounded-[10px]", "min-h-24"], [...FIELD_NO, "rounded-2xl"]);

// ② ทรงแคปซูลสำหรับแถบเครื่องมือ
check("ช่องกรอกทรงแคปซูล", renderToStaticMarkup(<Input shape="pill" />), ["rounded-full"], ["rounded-[10px]"]);
check(
  "ช่องเลือกทรงแคปซูล",
  renderToStaticMarkup(<Select shape="pill" value="" onChange={() => {}}><option value="">ก</option></Select>),
  ["rounded-full"],
  ["rounded-[10px]"],
);

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
check(
  "ปุ่มอันตรายโหมดมืดไม่ย้อนเป็นแดงอ่อน",
  renderToStaticMarkup(<Button variant="destructive">ลบ</Button>),
  ["dark:bg-red-700", "dark:hover:bg-red-800", "dark:active:bg-red-900"],
  ["dark:bg-red-600", "dark:hover:bg-red-500"],
);

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

// ⑧ hover/pressed เป็น interaction state ไม่ใช่พื้น structural
// เบสจับจากจอจริงว่าของเดิมใช้ slate-100 เท่ากับ surface-muted (#f2f2f4) พอดี
// จึงชี้แล้วกลืน ด่านนี้กันไม่ให้ component กลับไปผูก state กับ neutral ramp อีก
{
  const roots = ["src/app/(dashboard)", "src/app/factory", "src/components"];
  const skip = [
    join("src", "components", "print"),
    join("src", "components", "layout", "sidebar.tsx"),
    join("src", "components", "layout", "topbar.tsx"),
    join("src", "components", "layout", "mobile-sidebar.tsx"),
  ];
  const offenders: string[] = [];
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
            const darkBaseCanMaskHover =
              /dark:bg-(?!interactive-hover)/.test(line) &&
              line.includes("hover:bg-interactive-hover") &&
              !line.includes("dark:hover:bg-interactive-hover");
            const darkBaseCanMaskPressed =
              /dark:bg-(?!interactive-pressed)/.test(line) &&
              line.includes("active:bg-interactive-pressed") &&
              !line.includes("dark:active:bg-interactive-pressed");
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
  const tokenCountsValid = hover.length === 2 && pressed.length === 2 && surfaceMuted.length === 2;
  const tokenLayersValid = tokenCountsValid && hover.every((value, index) =>
    new Set([surfaceMuted[index], value, pressed[index]]).size === 3
  );
  const sunkIsStructural = !/(?:hover|active|focus|data-\[)/.test(SUNK_PANEL);
  if (offenders.length || !tokenCountsValid || !tokenLayersValid || !sunkIsStructural) {
    failed++;
    console.log("❌ interaction state ยังผูกกับพื้นเทา หรือ token light/dark ไม่ครบ");
    offenders.forEach((o) => console.log(`   ${o}`));
    if (!tokenCountsValid || !tokenLayersValid) {
      console.log(`   surface=${surfaceMuted.join("/")}, hover=${hover.join("/")}, pressed=${pressed.join("/")}`);
    }
    if (!sunkIsStructural) {
      console.log(`   SUNK_PANEL ต้องไม่มี interaction state: ${SUNK_PANEL}`);
    }
  } else {
    console.log("✅ interaction hover/pressed แยกจากพื้น structural และมีครบสองธีม");
  }
}

// ⑨ ด่านสีจริง — class ถูกไม่ได้แปลว่าสีอ่านออก จึงคำนวณ WCAG จาก token กลาง
{
  const themes = [0, 1] as const;
  const surfaces = ["bg", "surface", "surface-muted", "interactive-hover", "interactive-pressed", "interactive-selected"] as const;
  const texts = ["strong", "secondary", "muted"] as const;

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
    for (const adjacent of ["surface", "surface-muted"] as const) {
      checkContrast(
        `${theme === 0 ? "light" : "dark"} ขอบ field บน ${adjacent}`,
        hexRgb(colorValues("field-border")[theme]!),
        hexRgb(colorValues(adjacent)[theme]!),
        3,
      );
    }
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
