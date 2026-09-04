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
    name: "ปัจจุบัน — 4 ปุ่มน้ำหนักเท่ากันในแถวเดียว",
    idea: "ทุกอย่างที่ทำกับขั้นนี้ได้ เป็นปุ่มเรียงกัน",
    summary: "ลงมือ · บันทึกรายละเอียด · แจ้งปัญหา · แก้ให้ ขนาดเท่ากันหมด · ตอนลงมือไม่ได้ ก็ยังมีปุ่มเทา “ลงมือไม่ได้ตอนนี้” · คำอธิบายเงื่อนไขถูกบีบไว้ซ้ายจนเหลือคำละบรรทัด",
    tradeoff: "ที่เบสทัก: ตาไม่รู้ว่าปุ่มไหนคือปุ่ม “ทำ” · ปุ่มที่กดไม่ได้ก็กินที่เท่าปุ่มที่กดได้ · ของที่นาน ๆ ใช้ (บันทึกรายละเอียด · แก้ให้) ดังเท่าของที่ใช้ทุกวัน",
  },
  menu: {
    name: "A · หนึ่งปุ่มหลัก + เมนูรวม",
    idea: "แยกตามความถี่: สิ่งที่ทำทุกวันเป็นปุ่ม สิ่งที่นาน ๆ ทำซ่อนในเมนู “เพิ่มเติม” · ไม่มีปุ่มที่กดไม่ได้ — ให้ประโยคสถานะพูดแทน",
    summary:
      "ประโยคสถานะเต็มแถวอยู่บน (มีไอคอนบอกอารมณ์ รอ/ทำ/ติด/เสร็จ) → แถวปุ่ม: ปุ่มหลักน้ำเงิน 1 ตัว (ถ้าลงมือได้) · แจ้งปัญหา เป็นปุ่มเบา · “เพิ่มเติม” ชิดขวา กดแล้วเห็น บันทึกรายละเอียด + รายการแก้ให้ทั้งหมด (แก้ยอด · เปลี่ยนคน · พัก · คืนคิว · ผ่านแทน) · ขั้นติดปัญหา: ปุ่มหลักเป็น “ปลดปัญหา / เปลี่ยนคน” สีแดง · ขั้นผ่านแล้ว: เหลือประโยคเดียว ไม่มีปุ่ม",
    tradeoff: "แก้ให้/บันทึกรายละเอียด ต้องกด 2 ครั้ง (เปิดเมนูก่อน) · ต้องสร้างเมนูดรอปดาวน์เป็นชิ้นส่วนกลางใหม่ 1 ชิ้น (ตอนนี้ยังไม่มี) · ช่างที่ใช้จอทัชต้องเรียนรู้ว่า “เพิ่มเติม” มีอะไร",
  },
  head: {
    name: "B · ปุ่มหลักขึ้นหัวการ์ด",
    idea: "ปุ่ม “ทำ” ตัวเดียวอยู่มุมขวาบนของการ์ดขั้น — ตาเจอตั้งแต่ยังไม่เลื่อนลง · ข้างล่างเหลือแถบสถานะเงียบ ๆ กับลิงก์รองตัวเล็ก",
    summary:
      "หัวการ์ด: ชื่อขั้น + ชิป ซ้าย · ปุ่มหลักน้ำเงินขวา (แทนที่ชื่อคนทำ ซึ่งย้ายไปอยู่ในประโยคสถานะ) · ท้ายการ์ด: เส้นคั่นบาง → ไอคอน + ประโยคสถานะ ซ้าย · แจ้งปัญหา · บันทึกรายละเอียด · แก้ให้ เป็นปุ่มโปร่งตัวเล็ก ขวา · ไม่มีพื้นจม ไม่มีเมนู ทุกอย่างเห็นหมดแต่เบา",
    tradeoff: "ปุ่มหลักอยู่ไกลจากข้อกำหนดที่ต้องติ๊กก่อนกด (ติ๊กข้างล่าง ปุ่มอยู่ข้างบน) · บนจอทัช/มือถือปุ่มมุมขวาบนเล็กกว่าที่ควร ต้องมีท่าเฉพาะ · ปุ่มรองยังมี 3 ตัว แค่เบาลง ไม่ได้น้อยลง",
  },
};

const NOTES = [
  "4 สถานะที่ขั้นจริงเจอ: รอขั้นก่อนหน้า (ตัวที่เบสส่งรูป) · กำลังทำ ลงมือได้ · ติดปัญหา · ผ่านแล้ว — ทางที่ดีต้องดูดีทุกสถานะ ไม่ใช่แค่ตอนมีปุ่มหลัก",
  "กรอบการ์ด (ชื่อขั้น · ชิป · ตัวเลข · ข้อกำหนด) คือของจริงชุดเดิม เปลี่ยนเฉพาะโซนปุ่ม · โซนนี้ (ActionZone) ใช้ทั้งใบผลิต หน้างาน ออเดอร์ — เคาะแล้วเปลี่ยนตามทั้งเว็บ",
  "สวิตช์หัวหน้า/ช่าง: ช่างไม่มี “แก้ให้” (ของจริงช่างใช้หน้างาน ไม่ได้เปิดใบผลิต แต่โซนเดียวกันไปโผล่ที่หน้างานด้วย)",
  "เมนู “เพิ่มเติม” ในแบบ A กดเปิดได้จริง (ใช้ตัวเมนูมาตรฐานของระบบ ยังไม่ได้แต่งเป็นชิ้นส่วนกลาง)",
] as const;

const OUT_OF_SCOPE = ["ปุ่มทุกปุ่มยังไม่ทำอะไร · ข้อกำหนดยังติ๊กไม่ได้ (เหมือนของจริงตอนนี้)", "โซนลงมือบนจอทัชหน้างาน (ปุ่มสูง 64px เต็มแถว) ไม่อยู่ในหน้าลองนี้ — ถ้าเคาะ A/B จะทำท่าจอทัชให้เข้ากัน"] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function ActionZoneProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "menu");
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/action-zone/view?v=${variant}&boss=${boss ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">โซนลงมือของขั้นงาน — ปุ่มเยอะ อัดกัน ควรจัดยังไง</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสส่งรูป (3 ก.ย.) “UI CTA ดูเยอะ และมันดูอัดกัน” — โซนลงมือของขั้นที่เลือกในใบผลิตมี 4 ปุ่มเท่ากัน + คำอธิบายบีบซ้าย · คำถามที่ต้องเคาะ —{" "}
          <span className="font-medium text-strong">ปุ่ม “ทำ” ตัวเดียวควรอยู่ตรงไหน และปุ่มรองควรหายไปไหน</span>
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant={boss ? "default" : "outline"} size="sm" onClick={toggleBoss}>
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
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">การ์ด “ขั้นที่เลือก” ของใบผลิต — 4 สถานะ</p>
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
        </section>
      </div>
    </main>
  );
}
