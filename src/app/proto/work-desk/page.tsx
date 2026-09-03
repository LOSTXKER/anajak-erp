"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { OPTIONS, Preview, VALUES, type Variant } from "./_preview";

/* กติกา: ปัจจุบันมาก่อน · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี */

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  now: {
    name: "ปัจจุบัน — ใบผลิต D (แท็บ + 2 คอลัมน์) หลังโครงใหม่",
    idea: "หัวหน้าทำครบในใบผลิต: เลือกขั้นซ้าย ลงมือ/แก้ให้ขวา",
    summary:
      "โต๊ะงาน → กดแถว → ใบผลิต: หัวใบ 4 ช่อง → แท็บขั้นงาน (รายการซ้าย กดเลือก / ขั้นที่เลือก + โซนลงมือ + แก้ให้ ขวา) · ทำอะไร / ข้อมูลใบ / ประวัติ อยู่แท็บอื่น",
    tradeoff: "เห็นทีละขั้น — อยากรู้ว่า 7 ขั้นใครทำ อยู่ไหน ทันไหม ต้องกดทีละแถว · ทุกครั้งที่ดูงานต้องเข้า-ออกหน้าใบผลิต (2 หน้าไป-กลับ)",
  },
  table: {
    name: "A · ใบผลิตเป็นตารางขั้นงาน — กางแถวแล้วลงมือได้เลย",
    idea: "เปิดใบมาเห็นทั้ง 7 ขั้นในตารางเดียว (สถานี · คนทำ · ยอด · ควรเสร็จ · ตอนนี้อยู่ไหน) กดแถว = โซนลงมือ + แก้ให้ กางใต้แถวนั้น",
    summary:
      "หัวใบ + การ์ดปัญหาเหมือน D → ตารางขั้นงานอยู่บนสุดเสมอ ไม่ต้องกดแท็บ · แถวที่กาง: ซ้าย ตัวเลข/ปัญหา/ร้านนอก · ขวา ข้อกำหนด → ปุ่มหลัก · แจ้งปัญหา · แก้ให้ · เปิดมากางขั้นที่ต้องทำตอนนี้ให้ก่อน กดซ้ำหุบ · ข้อมูลอ้างอิง (ทำอะไร / ข้อมูลใบ / ประวัติ) เป็นแท็บใต้ตาราง · หน้าตาเดียวกับหน้าการผลิตที่เบสเคาะ (ตาราง ไม่มีปุ่มในแถว กดแถวกาง)",
    tradeoff: "ตารางยืดขึ้นลงตอนกาง/หุบ แถวข้างล่างขยับ · ทำอะไร/ข้อมูลใบ ต้องเลื่อนลงมาใต้ตาราง · ยังต้องเข้าหน้าใบผลิตจากโต๊ะงานอยู่ (2 หน้าไป-กลับเหมือนเดิม)",
  },
  panel: {
    name: "B · โต๊ะงาน + แผงข้าง — ไม่ต้องออกจากหน้าการผลิต",
    idea: "ใบผลิตไม่ใช่หน้า แต่เป็นแผงที่เปิดข้างตารางโต๊ะงาน — ดู ลงมือ แก้ให้ แล้วกดแถวถัดไปได้ทันที",
    summary:
      "กดแถวในโต๊ะงาน → แผงข้างเปิดทางขวา (ตารางซ้ายย่อคอลัมน์ให้ที่) : เลขที่/ลูกค้า/กำหนดส่ง/ติดปัญหา → การ์ดปัญหา → ตารางขั้นงานแบบย่อ กางแถวแล้วลงมือ/แก้ให้ได้เหมือน A · กดแถวอื่นแผงเปลี่ยนใบทันที · “เปิดใบเต็ม” ไปหน้าใบผลิตเมื่ออยากดูทำอะไร/ประวัติ/วัตถุดิบ",
    tradeoff:
      "จอต้องกว้าง (1280 ขึ้นไป) — จอเล็กแผงตกไปอยู่ใต้ตาราง · ในแผงเห็นขั้นงานอย่างเดียว ทำอะไร/ประวัติ/วัตถุดิบต้องกด “เปิดใบเต็ม” · ตารางโต๊ะงานเสียคอลัมน์ จำนวน/เส้นทาง/ร้านนอก ไปตอนแผงเปิด · ของจริงต้องโหลดใบทีละใบตอนกดแถว (ช้ากว่าเดิมนิดหน่อยตอนสลับ)",
  },
};

const NOTES = [
  "ทั้ง A และ B อยู่บนโครงใหม่ที่เบสเคาะ (หัวหน้าทำครบจากใบผลิต · ช่างมีโหมดหน้างานของตัวเอง) — เทียบเฉพาะ “หัวหน้าเปิดโมดูลผลิตมาแล้ว ควรจัดยังไงให้ดู-วางแผน-ลงมือ-แก้ให้ ได้ลื่นที่สุด”",
  "ตารางขั้นงานทั้ง A/B ใช้ท่าเดียวกับหน้าการผลิตที่เบสเคาะ 2 ก.ย. (ตารางมีคอลัมน์ ไม่มีปุ่มในแถว กดแถว) และแบบ “กางใต้แถว” ที่เบสดูจากหน้าลองก่อนหน้า — ต่างกันแค่ตารางนี้อยู่ที่ไหน: ในหน้าใบผลิต (A) หรือในแผงข้างโต๊ะงาน (B)",
  "ใบตัวอย่างเดิม (โปโล 240 ตัว · 7 ขั้น ครบ ผ่านแล้ว/กำลังทำ/รอของกลับ/ติดปัญหา 2 จุด/ยังไม่ถึง) · โต๊ะงานใน B ใช้ 12 ใบตัวอย่างของหน้าลองโมดูลผลิต แต่แผงข้างแสดง 7 ขั้นชุดเดียวกันทุกแถว (เลขที่/ลูกค้า/กำหนดส่งเปลี่ยนตามแถว)",
  "สวิตช์ “หัวหน้า/ช่าง” เปลี่ยนแค่ปุ่ม “แก้ให้” — ของจริงช่างไม่ได้เปิดหน้านี้อยู่แล้ว (ถูกพาไปโหมดหน้างาน)",
] as const;

const OUT_OF_SCOPE = [
  "ปุ่มทุกปุ่มยังไม่ทำอะไร — ของจริงใช้ปุ่ม/dialog ชุดเดิม (controller + แก้ให้/แจ้งปัญหา ที่ลงไปแล้ว)",
  "โหมดหน้างานของช่างไม่อยู่ในหน้าลองนี้ (ขึ้นแล้ว ไม่เปลี่ยน)",
  "ใน B ตัวเลข 4 ช่อง/ชิปสถานี/ค้นหา ของโต๊ะงานตัดออกให้เห็นเฉพาะตาราง+แผง — ของจริงยังอยู่ครบ",
  "รูปม็อกอัพเป็นไฟล์ตัวอย่างของ repo (/demo-mockups)",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkDeskProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "table");
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-desk/view?v=${variant}&boss=${boss ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">จัดโมดูลผลิตของหัวหน้าใหม่ — ดู วางแผน ลงมือ แก้ให้ ให้ลื่นกว่านี้</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสถาม (3 ก.ย.) “ถ้าลองจัดใหม่ดูให้ดีกว่านี้ได้มั้ย” หลังโครงใหม่ลงไปแล้วแต่หน้าตาแทบไม่เปลี่ยน · คำถามที่ต้องเคาะ —{" "}
          <span className="font-medium text-strong">หัวหน้าเปิดโมดูลผลิตมาแล้ว ควรจัดยังไงให้ดู-วางแผน-ลงมือ-แก้ให้ ได้ในที่เดียวและเร็วที่สุด</span>
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant={boss ? "default" : "outline"} size="sm" onClick={toggleBoss} disabled={variant === "now"}>
              <UserRound /> {boss ? "มองเป็นหัวหน้า" : "มองเป็นช่าง"}
            </Button>
          </div>
          <Button variant="outline" size="icon-sm" aria-label={isDark ? "ดูแบบโหมดสว่าง" : "ดูแบบโหมดมืด"} onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Moon /> : <Sun />}
          </Button>
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="border-l-2 border-blue-600 pl-4 dark:border-blue-400">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">วิธีคิด: {copy.idea}</p>
            <h2 className="mt-1 text-lg font-semibold">{copy.name}</h2>
            <p className="mt-1.5 text-sm text-secondary">{copy.summary}</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">ข้อแลก:</span> {copy.tradeoff}
            </p>
          </div>
          <div className="card-surface rounded-2xl p-4 text-sm">
            <p className="font-medium">สิ่งที่ต้องรู้ก่อนตัดสิน</p>
            <ul className="mt-2 space-y-1.5 text-xs text-secondary">
              {NOTES.map((note) => (
                <li key={note} className="flex gap-1.5">
                  <span aria-hidden="true" className="text-muted">·</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">บนคอม (หน้าหัวหน้า — จอทัชใช้โหมดหน้างาน)</p>
            <span className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => window.open(src, "proto-mobile", "width=390,height=820,noopener")} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดขนาดมือถือ (390)
              </button>
              <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดเต็มหน้าจอ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8">
            <Preview variant={variant} boss={boss} />
          </div>
        </section>

        <section className="mt-10 card-surface rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
            {OUT_OF_SCOPE.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden="true" className="text-muted">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง</p>
        </section>
      </div>
    </main>
  );
}
