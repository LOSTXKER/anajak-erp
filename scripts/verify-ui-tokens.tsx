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
import { Select } from "../src/components/ui/select";
import { Input } from "../src/components/ui/input";
import { Textarea } from "../src/components/ui/textarea";
import { Button } from "../src/components/ui/button";
import {
  CONTROL_H,
  CONTROL_H_SM,
} from "../src/components/ui/control-size";

let failed = 0;
function check(name: string, html: string, must: string[], mustNot: string[] = []) {
  const cls = /class="([^"]*)"/.exec(html)?.[1] ?? "";
  const set = new Set(cls.split(/\s+/));
  // ลงท้ายด้วย "-" = เช็คแค่ว่า "มีคลาสตระกูลนี้อยู่" ไม่สนว่าเฉดไหน
  // (เพิ่ม 2026-08-02 — ของเดิมเทียบตรงตัวอย่างเดียว ทำให้พอเปลี่ยนเฉดสีให้ผ่านเกณฑ์
  //  อ่านออก เทสก็แดงทั้งที่จอถูกต้อง · เทสนี้ควรกัน "ลืมใส่" ไม่ใช่ "ห้ามเปลี่ยนสี")
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

// ① ช่องกรอก/ช่องเลือก/กล่องข้อความ = ตระกูลเดียวกัน ขอบ+พื้น+โฟกัสชุดเดียว
//
// เช็คว่า "มีขอบ + มีพื้น + มีสีตัวอักษร" ไม่ใช่ล็อกว่าต้องเป็นเฉดไหน
// (แก้ 2026-08-02 ตอนเบสเลือกให้ขอบเข้มขึ้นทั้งระบบ — ของเดิมล็อก border-slate-200/70
//  ไว้ พอเปลี่ยนขอบตามที่เบสเคาะ เทสก็แดงทั้งที่จอถูกต้อง · สิ่งที่ต้องกันคือ
//  "ลืมใส่ขอบ/พื้น/สีตัวอักษร" แบบที่ช่องวันที่เคยพลาด ไม่ใช่ห้ามเปลี่ยนเฉด)
const FIELD = [
  "border", // ต้องมีความหนาขอบ ไม่ใช่สั่งแต่สี
  "border-slate-", // ต้องมีสีขอบฝั่งสว่าง
  "dark:border-slate-", // และคู่โหมดมืด
  "bg-white",
  "dark:bg-slate-950",
  "text-slate-900", // สีตัวอักษรฝั่งสว่าง — ช่องวันที่เคยตกข้อนี้ไปตัวเดียวในระบบ
  "dark:text-slate-100",
  "focus-visible:border-blue-500",
  "focus-visible:ring-blue-500/15",
];
check("ช่องกรอก (Input)", renderToStaticMarkup(<Input />), [...h, ...FIELD, "rounded-2xl"]);
check(
  "ช่องเลือก (Select)",
  renderToStaticMarkup(<Select value="" onChange={() => {}}><option value="">ก</option></Select>),
  [...h, ...FIELD, "rounded-2xl"],
);
check("กล่องข้อความ (Textarea)", renderToStaticMarkup(<Textarea />), [...FIELD, "rounded-2xl", "min-h-24"]);

// ② ทรงแคปซูลสำหรับแถบเครื่องมือ
check("ช่องกรอกทรงแคปซูล", renderToStaticMarkup(<Input shape="pill" />), ["rounded-full"], ["rounded-2xl"]);
check(
  "ช่องเลือกทรงแคปซูล",
  renderToStaticMarkup(<Select shape="pill" value="" onChange={() => {}}><option value="">ก</option></Select>),
  ["rounded-full"],
  ["rounded-2xl"],
);

// ③ ขนาดเล็กสำหรับแถวตาราง — ต้องได้ทั้งความสูงและขนาดอักษร (ลำดับ cn() ถูก)
check("ช่องกรอกขนาดเล็ก", renderToStaticMarkup(<Input size="sm" />), [...hSm, "text-xs", "sm:text-xs"], ["sm:h-9", "sm:min-h-9"]);
check(
  "ช่องเลือกขนาดเล็ก",
  renderToStaticMarkup(<Select size="sm" value="" onChange={() => {}}><option value="">ก</option></Select>),
  [...hSm, "text-xs", "sm:text-xs"],
  ["sm:h-9", "sm:min-h-9"],
);

// (CONTROL_H_SM = "h-11 min-h-11 sm:h-8 sm:min-h-8" — มือถือยังเป็น 44px เป้านิ้ว
//  เล็กเฉพาะเดสก์ท็อป จึงห้ามเช็คว่าไม่มี h-11)

// ④ ความสูงที่สั่งทับผ่าน className ต้องยังทับได้ (เหตุผลที่ token เป็น TS ไม่ใช่ CSS)
check("สั่งความสูงทับเองได้", renderToStaticMarkup(<Input className="h-20 min-h-20" />), ["h-20", "min-h-20"], ["h-11", "min-h-11"]);

// ⑤ ปุ่ม = วงแหวนโฟกัสคนละสูตรกับช่องกรอก (ชัดกว่า + เว้นขอบ)
//
// เช็ค "โครงสร้าง" ไม่ใช่ "เฉดสี" (แก้ 2026-08-02 จาก audit สี)
// ของเดิมล็อกไว้ว่าต้องเป็น ring-blue-500/40 + ring-offset-white เป๊ะๆ — พอ audit
// สั่งให้เลิกใช้วงแหวนจางและเลิกล็อกช่องว่างเป็นสีขาวตายตัว **เทสแดงทั้งที่จอถูกต้อง**
// คนที่มาเจอจะสรุปว่า "แก้แล้วพัง" แล้วถอย · สิ่งที่เทสนี้ต้องกันคือ "ลืมใส่วงแหวน"
// กับ "ใช้สูตรของช่องกรอกมาใส่ปุ่ม" — ไม่ใช่ห้ามเปลี่ยนเฉดสี
check("ปุ่ม", renderToStaticMarkup(<Button>ก</Button>), [
  ...h,
  "rounded-full",
  "focus-visible:ring-2",
  "focus-visible:ring-blue-500",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-", // ต้องผูกช่องว่างรอบวงแหวนกับสีพื้น ไม่ใช่ปล่อยว่าง
], [
  "focus-visible:ring-blue-500/15", // สูตรช่องกรอก — ห้ามหลุดมาอยู่บนปุ่ม
  "focus-visible:ring-offset-white", // ล็อกขาวตายตัว = โหมดมืดได้แถบขาวคาดรอบปุ่ม
]);
check("ปุ่มขนาดเล็ก", renderToStaticMarkup(<Button size="sm">ก</Button>), hSm, ["sm:h-9", "sm:min-h-9"]);

console.log(failed ? `\n❌ ไม่ผ่าน ${failed} ข้อ` : "\n✅ ผ่านครบ");
process.exit(failed ? 1 : 0);
