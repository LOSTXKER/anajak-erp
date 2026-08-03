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
import {
  CONTROL_H,
  CONTROL_H_SM,
} from "../src/components/ui/control-size";

let failed = 0;
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

// ① ช่องกรอก/ช่องเลือก/กล่องข้อความ = ตระกูลเดียวกัน พื้น+โฟกัสชุดเดียว
// แก้ 2026-08-04 (เบสเคาะ "คือไม่ต้องมีเส้นเยอะ"): ไม่มีเส้นขอบ · เห็นว่าเป็นช่อง
// ด้วยพื้น `--field-bg` ที่บริบทเลือกสีให้ (การ์ดขาว→เทาจม #eceff2 · .sunk-panel→ขาว)
// border-transparent ต้องอยู่ — FOCUS_FIELD เปลี่ยนสีขอบตอนโฟกัส
const FIELD = [
  "border-transparent",
  "bg-[var(--field-bg)]",
  "focus-visible:border-blue-500",
  "focus-visible:ring-blue-500/15",
];
// ห้ามพื้นตายตัวกลับมา — จางไป (slate-100) ก็กลืนพื้น · ขาวตายตัว (bg-surface) ก็ต้องพึ่งเส้น
const FIELD_NO = ["bg-slate-100", "bg-surface", "border-slate-200"];
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

// ⑥ หัวตารางบน surface ใช้สีเดียวกับกล่องใน light และคงชั้นเดิมใน dark
check(
  "หัวตารางบนกล่อง",
  renderToStaticMarkup(
    <table>
      <DataTable.Head>
        <tr><DataTable.Th>หัว</DataTable.Th></tr>
      </DataTable.Head>
    </table>,
  ),
  ["bg-surface", "dark:bg-white/[0.03]"],
  ["bg-slate-50", "bg-slate-100"],
);

// ⑦ ด่านธีมมืด: ในโซนที่สลับธีมได้ ห้ามมีตัวหนังสือ slate เข้มระดับหลัก (900/700/500)
// ที่ไม่มีคู่ dark: บนบรรทัดเดียวกัน — ใช้ semantic token แทน (text-strong /
// text-secondary / text-muted ใน globals.css) · เคยหลุด 186 จุดจนตัวหนังสือจมใน
// ธีมมืด (audit 2026-08-03) · โซน (print)/(public)/components/print เป็น forced-light
// ไม่เข้าด่านนี้
{
  const roots = ["src/app/(dashboard)", "src/app/factory", "src/components"];
  const skip = [join("src", "components", "print")];
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
            if (bare.test(line) && !line.includes("dark:text-")) {
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

console.log(failed ? `\n❌ ไม่ผ่าน ${failed} ข้อ` : "\n✅ ผ่านครบ");
process.exit(failed ? 1 : 0);
