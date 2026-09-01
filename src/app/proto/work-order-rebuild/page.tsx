"use client";

/**
 * หน้าลอง: รื้อหน้าใบสั่งผลิตใหม่จากศูนย์ — ควรเป็นหน้าแบบไหน
 *
 * ที่มา: เบสเปิด /production/demo-production-blocked-stock แล้วบอก (2026-09-02)
 * *"ฉันว่าหน้านี้ต้องออกแบบใหม่อะ มันเยอะ และรกไปอะ ทำ proto มาหน่อย รื้อใหม่หมดเลย"*
 *
 * หน้าลองรอบก่อน (/proto/work-order-density) แค่ย้ายกองเดิมไปซ่อนในแท็บ — เบสสั่งต่อว่า
 * "รื้อใหม่หมด" · รอบนี้จึงเริ่มจากคำถามว่า "หัวหน้าเปิดหน้านี้มาเพื่ออะไร" แล้ววางหน้าใหม่
 * สามแบบที่ **คิดคนละแบบ** ไม่ใช่กล่องเดิมสลับที่
 *
 * สิ่งที่ไม่รื้อ (เพราะเบสเคาะไปแล้วและเป็นเรื่อง "วิธีทำงาน" ไม่ใช่หน้าตา):
 * หัวหน้ากดแทนช่างได้ · ปุ่มมาจากสิทธิ์ที่ server อนุญาต · ขั้นที่ต้องมีหลักฐานทำที่จอสถานี
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { WorkOrderRebuildPreview } from "./_preview";
import type { WorkOrderRebuildVariant } from "./_variants";

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "table", label: "A · ตารางเดียว" },
  { value: "station", label: "B · จอสถานี (รอบแรก)" },
  { value: "station2", label: "B+ · จอสถานี ขัดแล้ว" },
  { value: "rail", label: "C · รางเดียว" },
] as const;

const VALUES = OPTIONS.map((option) => option.value) as readonly WorkOrderRebuildVariant[];

const COPY: Record<
  WorkOrderRebuildVariant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — แปดกองเรียงลงมา",
    idea: "เอาทุกอย่างที่รู้เกี่ยวกับใบนี้มากองไว้ให้ครบ",
    summary:
      "เปิดมาเจอตามลำดับ: แถบเวลาอัปเดต → การ์ดข้อมูลใบ 5 ช่อง → ผังสายพานคู่ + รายการขั้นทั้งหมด → แผงลงมือ → ข้อมูลอ้างอิง → ตารางจำนวน → ปัญหา → ประวัติ · ใบนี้มี 5 ขั้น แต่ 5 ขั้นถูกวาดซ้ำ 4 รอบ และตารางจำนวนคือ ครีม S/M/L ชุดเดิมทำซ้ำ 5 ครั้ง · ยาว 3,359 จุดภาพบนจอกว้าง 1,440 — ประมาณ 3 หน้าจอครึ่ง",
    tradeoff:
      "ข้อดีที่จะเสียไปถ้าเปลี่ยน: ทุกอย่างอยู่บนหน้าเดียวจริง ๆ ไม่ต้องกดอะไรก็เห็นหมด · ตารางจำนวน 7 คอลัมน์ของทุกขั้นดูพร้อมกันได้",
  },
  table: {
    name: "A · ตารางเดียว — หนึ่งขั้นคือหนึ่งแถว",
    idea: "ใบสั่งผลิตคือตารางของขั้นงาน ไม่ใช่กองของกล่อง",
    summary:
      "ทั้งหน้าเหลือตารางเดียว: คิว · ขั้น · สถานะ · จำนวน · เวลา · ปุ่มลงมือ อยู่ในแถวเดียวกัน · กดแถวไหน แถวนั้นกางออกให้เห็นจำนวนแยกสี/ไซซ์ ปัญหา ประวัติ และปุ่มรอง (มอบหมาย · จัดคิว · แจ้งปัญหา) ของขั้นนั้น — กองแยกท้ายหน้าไม่มีอีก · ผังสองสายย่อเหลือชิปหนึ่งบรรทัดใต้หัว กดชิปก็กางแถวนั้น · ข้อมูลอ้างอิงกับประวัติทั้งใบเหลือสองกล่องเล็กท้ายหน้า · ยาว 1,688 จุดภาพ (ใบใหญ่ 2,329) — สั้นลงครึ่งหนึ่งโดยไม่ซ่อนอะไรไว้ในแท็บ",
    tradeoff:
      "ผังสองสายแบบการ์ด (R3) ที่เบสเคาะไว้เหลือแค่ชิปแถวเดียว · กางได้ทีละแถว อยากดูจำนวนทุกขั้นพร้อมกันต้องกดทีละแถว · ตารางหกคอลัมน์บนจอแคบต้องกลายเป็นการ์ดเรียง",
  },
  station: {
    name: "B · จอสถานีของหัวหน้า — เลือกซ้าย ทำกลาง ดูขวา",
    idea: "เบสบอกว่าอยากคุมงานในหน้านี้ได้เหมือนจอสถานี — ก็ทำหน้านี้ให้เป็นจอสถานีไปเลย",
    summary:
      "สามคอลัมน์จบในจอเดียว: ซ้าย = รายการขั้นแบ่งสายเรา/สายร้านนอก · กลาง = ขั้นที่เลือก มีปุ่มใหญ่ ช่องกรอกจำนวน และแท็บ จำนวน / ปัญหา / ประวัติ ของขั้นนั้น · ขวา = ข้อมูลใบ (ออเดอร์ กำหนดส่ง ความคืบหน้า ข้อมูลอ้างอิง ประวัติทั้งใบ) · ใบปกติไม่ต้องเลื่อนหน้าเลย · จอแคบ: รายการซ้ายกลายเป็นชิปแถวเดียวข้างบน แผงกลางตามมา ข้อมูลใบไปอยู่ล่างสุด · ยาว 1,011 จุดภาพ (ใบใหญ่ 1,095) — สั้นสุดในสามแบบ และแทบไม่ยาวขึ้นเมื่อใบใหญ่",
    tradeoff:
      "เห็นทีละขั้น — ตารางจำนวนของทุกขั้นพร้อมกันไม่มี · บนจอ 1,280 สามคอลัมน์แน่น · ต้องกดเลือกขั้นก่อนถึงจะเห็นอะไรมากกว่าชื่อกับสถานะ",
  },
  station2: {
    name: "B+ · จอสถานีของหัวหน้า — โครงเดิม ขัดหน้าตาให้ดูโฟกัส",
    idea: "เบสเลือก B แล้วบอกว่า “ดีได้กว่านี้ อะไรๆ ก็เป็น text ธรรมดา” — ของทุกชิ้นอยู่ที่เดิม เปลี่ยนน้ำหนักทางสายตา",
    summary:
      "ขวา: กำหนดส่ง / ปัญหาค้าง / ผ่านแล้ว / จำนวน เป็นกล่องสี 4 ช่องแบบเดียวกับกล่องประวัติลูกค้าในใบงาน (ตัวเลขใหญ่ มีไอคอน ปัญหาค้างเป็นกล่องแดงเมื่อมีเรื่อง) · ซ้าย: รายการขั้นเป็นบันไดมีเลขคิวบนราง สีตามสถานะ ขั้นที่เลือกมีขีดน้ำเงินริมซ้าย และแถบความคืบหน้าเล็กใต้ชื่อ · กลาง: หัวขั้นมีเลขคิวในวงกลมสีสถานะ บรรทัดข้อมูลมีไอคอน (ศูนย์งาน · คน · เวลา) “รับงานต่อจาก” เป็นป้าย และปุ่มกับช่องกรอกอยู่ในโซน “ลงมือกับขั้นนี้” พื้นจมของตัวเอง",
    tradeoff:
      "สีบนหน้ามากขึ้น (กล่องสี 4 ช่อง + วงกลมสถานะ) — ถ้าวันหนึ่งใบมีปัญหาหลายเรื่องพร้อมกัน สีแดงจะขึ้นหลายจุด · สูงกว่า B เดิมเล็กน้อยเพราะกล่องสีกับโซนลงมือกินที่",
  },
  rail: {
    name: "C · รางเดียว — อ่านจากบนลงล่างเป็นเรื่องเล่า",
    idea: "ของทุกชิ้นเป็นของขั้นใดขั้นหนึ่ง ก็ให้มันอยู่กับขั้นนั้น ไม่ต้องมีกองแยก",
    summary:
      "รางเส้นเดียวจาก “ปล่อยผลิต” ไปถึง “ส่งมอบ” · ขั้นที่เดินขนานกันได้วางเคียงกันบนราง · กล่องของแต่ละขั้นมีทุกอย่างของขั้นนั้น: ปุ่มลงมือ ช่องกรอก จำนวนแยกสี/ไซซ์ ปัญหา ประวัติ · ขั้นที่กำลังทำ/พร้อมทำ/ติดปัญหากางไว้ให้เลย ขั้นที่ยังไม่ถึงคิวพับเป็นบรรทัดเดียว · ของทั้งใบ (ข้อมูลอ้างอิง ประวัติของใบ) อยู่ที่โหนดแรก “ปล่อยผลิต” · ยาว 1,646 จุดภาพ (ใบใหญ่ 3,374 เพราะกาง 4 ขั้นที่ทำพร้อมกัน)",
    tradeoff:
      "ไม่มีตารางรวมจำนวน/ปัญหา/ประวัติทั้งใบ — อยากดูรวมต้องไล่ทีละกล่อง · ยาวขึ้นตามจำนวนขั้นที่กำลังทำพร้อมกัน · ผังสองสายแบบแถวบน/แถวล่างหายไป ร้านนอกเหลือเป็นกล่องเส้นประบนรางเดียวกัน",
  },
};

/** ของทุกชิ้นที่หน้าจริงมี — ตารางนี้คือคำสัญญาว่าไม่มีอะไรถูกตัดทิ้งเงียบ ๆ */
const WHERE_THINGS_GO: { thing: string; a: string; b: string; c: string }[] = [
  {
    thing: "แถบ “อัปเดตล่าสุด”",
    a: "มุมขวาของกล่องหัวใบ",
    b: "ท้ายคอลัมน์ขวา",
    c: "มุมขวาของกล่องหัวใบ",
  },
  {
    thing: "การ์ดข้อมูลใบ 5 ช่อง (ออเดอร์ · กำหนดส่ง · ปัญหาค้าง · ความคืบหน้า)",
    a: "ยุบเป็นบรรทัดเดียวใต้หัว",
    b: "คอลัมน์ขวา “ใบนี้”",
    c: "ยุบเป็นบรรทัดเดียวใต้หัว",
  },
  {
    thing: "ผังสายพานคู่",
    a: "ย่อเป็นชิปสองสายหนึ่งบรรทัด",
    b: "รายการซ้ายแบ่งสองสาย (จอแคบเป็นชิป)",
    c: "รางเดียว ร้านนอกเป็นกล่องเส้นประ + ข้อความจุดบรรจบ",
  },
  {
    thing: "รายการขั้นงาน (คิว · ศูนย์งาน · คน · รับงานต่อจาก · ปัญหา · จำนวน · เวลา)",
    a: "คือตัวตารางเอง",
    b: "ซ้าย = ชื่อ/สถานะ/จำนวน · กลาง = ที่เหลือ",
    c: "หัวกล่องของแต่ละขั้น",
  },
  {
    thing: "แผงลงมือ (เริ่มงาน · บันทึกผล · ปิดขั้น · พักงาน · ช่องกรอกแยกสี/ไซซ์ · ทำที่จอสถานี)",
    a: "ปุ่มหลักในแถว · ช่องกรอกกับปุ่มรองในแถวที่กาง",
    b: "คอลัมน์กลาง ปุ่มใหญ่",
    c: "ในกล่องขั้นที่กาง ปุ่มใหญ่",
  },
  {
    thing: "ปุ่มมอบหมาย · จัดคิว · แจ้งปัญหา · เปิดใบงานร้านนอก",
    a: "ในแถวที่กาง",
    b: "คอลัมน์กลาง ใต้ปุ่มใหญ่",
    c: "ในกล่องขั้นที่กาง",
  },
  {
    thing: "ข้อมูลอ้างอิงที่ล็อกไว้ (3 สำเนา · ปล่อยเมื่อ · ฉบับ)",
    a: "กล่องเล็กท้ายหน้า (ซ้าย)",
    b: "คอลัมน์ขวา",
    c: "โหนด “ปล่อยผลิต” บนสุดของราง (กดกาง)",
  },
  {
    thing: "จำนวนตามขั้นงาน (ตาราง 7 คอลัมน์)",
    a: "ในแถวที่กาง เต็ม 7 คอลัมน์",
    b: "แท็บ “จำนวน” ของขั้นที่เลือก เต็ม 7 คอลัมน์",
    c: "ในกล่องขั้น แบบย่อ (สี/ไซซ์ · ดี/เป้า · เสีย · ส่งแก้)",
  },
  {
    thing: "ปัญหาและข้อยกเว้น (+ ปุ่มตัดสินของที่พักไว้ · วางแผนงานแก้ · จัดการปัญหา)",
    a: "ที่บล็อก = แถบแดงบนสุด · ที่เหลืออยู่ในแถวที่กาง",
    b: "แถบแดงบนสุด · แท็บ “ปัญหา” (มีจุดแดงเมื่อค้าง)",
    c: "แถบแดงบนสุด · ในกล่องขั้น",
  },
  {
    thing: "ประวัติการทำงาน",
    a: "ของขั้น = ในแถวที่กาง · ทั้งใบ = กล่องเล็กท้ายหน้า (3 ล่าสุด)",
    b: "ของขั้น = แท็บ “ประวัติ” · ทั้งใบ = คอลัมน์ขวา (5 ล่าสุด)",
    c: "ของขั้น = ในกล่องขั้น · ของใบ = โหนด “ปล่อยผลิต”",
  },
  {
    thing: "งานส่งแก้ (โผล่เฉพาะใบที่มี)",
    a: "ยังไม่ได้วาด — ใบตัวอย่างไม่มี",
    b: "ยังไม่ได้วาด — ใบตัวอย่างไม่มี",
    c: "ยังไม่ได้วาด — ใบตัวอย่างไม่มี",
  },
];

const NOTES = [
  "ใบตัวอย่าง = ใบที่เบสเปิดดูจริง MO-2609-0008 (Bangkok Run Club · 40 ตัว · ครีม S14/M13/L13) — จำนวนแถว สถานะ และข้อความปัญหายกมาจากฐานทดลองตรง ๆ",
  "ปุ่มทุกปุ่มมาจากสิทธิ์ที่ server อนุญาตเหมือนของจริง — ขั้นเตรียมงานกับ DTF จึงขึ้นว่า “ทำที่จอสถานี” ไม่ใช่ปุ่มปลอม · มอบหมาย/จัดคิว ขึ้นทุกขั้นที่ยังไม่เสร็จตามกติกาของ server สำหรับหัวหน้า",
  "แถบแดง “ปัญหาที่บล็อกงาน” อยู่บนสุดทุกแบบ — เรื่องที่ต้องรู้ก่อนอย่างอื่น ไม่ควรต้องเลื่อนไปหา",
  "กดปุ่ม “ใบใหญ่” เพื่อดูตอนของเยอะจริง: 9 ขั้นมีสายร้านนอก · จำนวน 27 แถว · ปัญหา 3 · ประวัติ 19 — ทุกแบบต้องไม่พังตอนนั้น",
  "ตัวเลขความยาววัดจริงบนจอกว้าง 1,440 จุดภาพ (ใบเล็ก · กางขั้นแรกที่ทำได้ไว้เหมือนกันทุกแบบ) — ของจริง 3,367 · A 1,688 · B 1,011 · B+ 1,150 · C 1,646 · บนจอ 390 ไม่มีแบบไหนล้นแนวนอน",
  "หน้านี้รื้อ “การจัดวางทั้งหน้า” แต่ไม่รื้อสิ่งที่เบสเคาะไปแล้วเรื่องวิธีทำงาน: หัวหน้ากดแทนช่างได้ · ขั้นที่ต้องมีหลักฐานทำที่จอสถานี · ปุ่มมาจาก server",
];

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderRebuildProtoPage() {
  const [variant, setVariant] = useProtoVariant<WorkOrderRebuildVariant>("v", VALUES, "current");
  const [big, toggleBig] = useProtoFlag("big");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-order-rebuild/view?v=${variant}${big ? "&big=1" : ""}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/proto"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          รื้อหน้าใบสั่งผลิตใหม่จากศูนย์ — ควรเป็นหน้าแบบไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          รอบก่อนแค่ย้ายกองเดิมไปซ่อนในแท็บ เบสบอกว่า{" "}
          <strong className="font-semibold text-strong">“รื้อใหม่หมดเลย”</strong> · รอบนี้เริ่มจากคำถามว่า
          หัวหน้าเปิดหน้านี้มาเพื่ออะไร — <strong className="font-semibold text-strong">รู้ว่างานอยู่ไหน ติดอะไร แล้วสั่งได้เลย</strong>{" "}
          — แล้ววางหน้าใหม่สามแบบที่คิดคนละแบบ: ตาราง / จอสถานี / ราง · ของทุกชิ้นของหน้าจริงยังอยู่ครบ
          ดูตารางท้ายหน้าว่าย้ายไปอยู่ไหน
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              options={OPTIONS.map((option) => ({ ...option }))}
              value={variant}
              onChange={setVariant}
              aria-label="เลือกแบบที่จะดู"
              className="min-w-max"
            />
          </div>
          <span className="flex items-center gap-2">
            <Button variant={big ? "default" : "outline"} size="sm" onClick={toggleBig} aria-pressed={big}>
              {big ? "กำลังดูใบใหญ่ (9 ขั้น)" : "ลองใบใหญ่ (9 ขั้น · มีร้านนอก)"}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={isDark ? "ดูแบบโหมดสว่าง" : "ดูแบบโหมดมืด"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Moon /> : <Sun />}
            </Button>
          </span>
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-l-2 border-blue-600 pl-4 dark:border-blue-400">
            <p className="text-xs font-medium text-muted">วิธีคิด: {copy.idea}</p>
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
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">บนคอม</p>
            <span className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.open(src, "proto-mobile", "width=390,height=820,noopener")}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดขนาดจอทัช/มือถือ (390)
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดเต็มหน้าจอ
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8">
            <WorkOrderRebuildPreview variant={variant} big={big} />
          </div>
        </section>

        <section className="card-surface mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">ของทุกชิ้นที่หน้าจริงมี ย้ายไปอยู่ไหน</h2>
          <p className="mt-1 text-xs text-muted">
            รื้อการจัดวาง ไม่ได้รื้อของ — ทั้งสามแบบยังมีของครบเท่าเดิม แค่คนละที่ · B+ วางของที่เดียวกับ B ทุกชิ้น ต่างกันแค่หน้าตา
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className={cn(TABLE_HEAD_SURFACE, "text-muted")}>
                <tr className="border-b border-divider">
                  <th className="py-2 pr-3 font-medium">ของบนหน้า</th>
                  <th className="py-2 pr-3 font-medium">A · ตารางเดียว</th>
                  <th className="py-2 pr-3 font-medium">B / B+ · จอสถานีของหัวหน้า</th>
                  <th className="py-2 font-medium">C · รางเดียว</th>
                </tr>
              </thead>
              <tbody>
                {WHERE_THINGS_GO.map((row) => (
                  <tr key={row.thing} className="border-b border-divider last:border-0">
                    <td className="py-2 pr-3 font-medium text-strong">{row.thing}</td>
                    <td className="py-2 pr-3 text-secondary">{row.a}</td>
                    <td className="py-2 pr-3 text-secondary">{row.b}</td>
                    <td className="py-2 text-secondary">{row.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-surface mt-5 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
            <li>· ปุ่มทุกปุ่มวาดไว้เฉย ๆ กดแล้วไม่เกิดอะไร (หน้าลองไม่ต่อฐานข้อมูล) — หน้าต่างมอบหมาย/จัดคิว/เปิดใบงานร้านนอก ยังไม่ได้วาด</li>
            <li>· กล่อง “งานส่งแก้” — ใบตัวอย่างทั้งสองใบไม่มี ของจริงโผล่เฉพาะใบที่มี</li>
            <li>· ใบที่ยังเป็นร่าง (แถบ “ยังปล่อยผลิตไม่ได้” และปุ่มปล่อยผลิต) — ใบตัวอย่างปล่อยผลิตไปแล้ว</li>
            <li>· หน้าจอตอนโหลด/ตอนหลุดเน็ต (โครงสีเทา · แถบ “ข้อมูลล่าสุดอาจยังไม่ครบ”) — ไม่เกี่ยวกับเรื่องที่กำลังเลือก</li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
