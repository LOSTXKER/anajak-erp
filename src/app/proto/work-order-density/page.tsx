"use client";

/**
 * หน้าลอง: ใบสั่งผลิต "เยอะและรกไป" — ตัดของบนหน้าให้เหลือเท่าไหร่
 *
 * ที่มา (เบสเปิด /production/demo-production-blocked-stock แล้วบอก 2026-09-02):
 * *"ฉันว่าหน้านี้ต้องออกแบบใหม่อะ มันเยอะ และรกไปอะ"*
 *
 * ⚠️ ของบนหน้านี้ไม่ได้ "เกิน" เพราะใครใส่มั่ว — ทุกกองมีเหตุผลของมันตอนที่ใส่
 * สามทางข้างล่างจึงไม่ตัดของทิ้ง แต่ย้ายที่อยู่ให้ของโผล่มาตอนที่ต้องใช้
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
import { WorkOrderDensityPreview } from "./_preview";
import type { WorkOrderDensityVariant } from "./_variants";

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "tabs", label: "A · ท้ายหน้ายุบเป็นแท็บ" },
  { value: "context", label: "B · ผังคือรายการ" },
  { value: "split", label: "C · แยกลงมือ/ข้อมูล" },
] as const;

const VALUES = OPTIONS.map((option) => option.value) as readonly WorkOrderDensityVariant[];

const COPY: Record<
  WorkOrderDensityVariant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — แปดกองเรียงลงมา",
    idea: "เอาทุกอย่างที่รู้เกี่ยวกับใบนี้มากองไว้ให้ครบ",
    summary:
      "เปิดมาเจอตามลำดับ: แถบเวลาอัปเดต → การ์ดข้อมูลใบ 5 ช่อง → เส้นทางการผลิต (ผัง + รายการขั้นทั้งหมด) → แผงลงมือ → ข้อมูลอ้างอิงที่ล็อกไว้ → จำนวนตามขั้นงาน → ปัญหา → ประวัติ · ใบที่เบสเปิดดูมี 5 ขั้น แต่ 5 ขั้นนั้นถูกวาดซ้ำ 4 รอบ (ผัง · รายการ · แผงขวา · หัวข้อในตารางจำนวน) และตารางจำนวนคือ ครีม S/M/L ชุดเดิมทำซ้ำ 5 ครั้ง = 15 แถว · ยาว 3,359 จุดภาพ บนจอกว้าง 1,440 (ใบใหญ่ 5,300) — ประมาณ 3 หน้าจอครึ่ง",
    tradeoff:
      "ข้อดีที่จะเสียไปถ้าเปลี่ยน: ทุกอย่างอยู่บนหน้าเดียวจริง ๆ กด Ctrl+F เจอหมด ไม่ต้องจำว่าอะไรอยู่แท็บไหน · เวลาสอบย้อนหลังว่า “ตอนนั้นเกิดอะไร” หน้านี้ตอบได้ในจอเดียว",
  },
  tabs: {
    name: "A · ครึ่งบนคงเดิม ท้ายหน้ายุบเป็นกล่องเดียว",
    idea: "แตะให้น้อยที่สุด — เอาแค่ของท้ายหน้าที่ไม่ค่อยได้ใช้มาซ้อนกัน",
    summary:
      "ครึ่งบน (การ์ดข้อมูลใบ · ผัง · รายการขั้น · แผงลงมือ · ข้อมูลอ้างอิง) เหมือนเดิมทุกจุด · สามกองท้ายหน้า (จำนวน · ปัญหา · ประวัติ) รวมเป็นกล่องเดียวมีปุ่มสลับ พร้อมตัวเลขบนปุ่มว่ามีกี่รายการ และจุดแดงเมื่อมีปัญหาที่ยังไม่จบ — เปิดมาชี้ที่ “ปัญหา” ให้เลยถ้ามีของค้าง · ยาว 1,656 จุดภาพ (ใบใหญ่ 2,915) — สั้นลงครึ่งหนึ่ง",
    tradeoff:
      "หน้าสั้นลงประมาณครึ่งหนึ่ง แต่ของที่ซ้ำกันอยู่ครึ่งบน (ผังกับรายการขั้นพูดเรื่องเดียวกัน) ยังซ้ำเหมือนเดิม · ของในแท็บที่ไม่ได้เปิดอยู่ต้องกดถึงจะเห็น",
  },
  context: {
    name: "B · ผังคือรายการ · ของของขั้นไหนไปอยู่กับขั้นนั้น",
    idea: "หน้าเดียวควรตอบว่า “ตอนนี้ทำอะไร” ไม่ใช่กองทุกอย่างที่เคยเกิด",
    summary:
      "ตัดรายการขั้นที่ซ้ำกับผังออก — เหลือผังเป็นตัวเดียวที่บอกเส้นทาง · กดขั้นไหน แผงขวาก็โตขึ้นเป็นทุกอย่างของขั้นนั้น (ปุ่มลงมือ · จำนวนแยกสี/ไซซ์ · ปัญหาของขั้นนี้ · ประวัติของขั้นนี้) · ปัญหาที่บล็อกงานเด้งเป็นแถบแดงบนสุดแทนที่จะรอให้เลื่อนไปเจอท้ายหน้า · การ์ดข้อมูลใบ 5 ช่องยุบเหลือบรรทัดเดียว เพราะเลขใบกับลูกค้าอยู่บนหัวหน้าแล้ว · ยาว 1,002 จุดภาพ (ใบใหญ่ 1,250) — จบในจอเดียวบนคอม",
    tradeoff:
      "ดูของทั้งใบพร้อมกันไม่ได้อีก — อยากรู้ว่า “ทั้งใบทำได้กี่ตัวแล้ว” ต้องกดไล่ทีละขั้น · ตารางจำนวน 7 คอลัมน์ (เป้าหมาย/ดี/เสีย/ส่งแก้) หายไปจากหน้าหลัก เหลือรูปย่อในแผง · เปลี่ยนเยอะสุดในสามแบบ",
  },
  split: {
    name: "C · สองมุมใหญ่ — มาทำงาน กับ มาดูข้อมูล",
    idea: "หน้าเดียวรับสองงานที่ไม่เกี่ยวกัน ก็แยกให้มันเป็นสองงาน",
    summary:
      "มุม “ลงมือทำ” (เปิดมาเจออันนี้) = แถบปัญหาที่บล็อก + ผัง + แผงลงมือ เท่านั้น · มุม “ข้อมูลใบนี้” = ของที่เหลือทั้งหมดไม่ตัดอะไรเลย (การ์ดข้อมูลใบ · ข้อมูลอ้างอิง · จำนวนเต็มตาราง · ปัญหา · ประวัติ) · จุดแดงบนปุ่มมุมบอกว่ามีของค้าง · มุมทำงานยาว 721 จุดภาพ (ใบใหญ่ 810) — เปิดมาเจอทุกอย่างในจอแรก",
    tradeoff:
      "ตอนทำงานจะมองข้อมูลอ้างอิงหรือจำนวนทั้งใบไปด้วยไม่ได้ ต้องสลับมุม · คนที่เปิดหน้านี้เพื่อ “ดูว่าเกิดอะไรขึ้นบ้าง” ต้องกดอีกทีทุกครั้ง · ถ้าวันหนึ่งอยากพิมพ์ใบนี้ออกมา ต้องรวมสองมุมกลับเองอยู่ดี",
  },
};

/** ของทุกชิ้นที่หน้าจริงมี — ตารางนี้คือคำสัญญาว่าไม่มีอะไรถูกตัดทิ้งเงียบ ๆ */
const WHERE_THINGS_GO: { thing: string; a: string; b: string; c: string }[] = [
  {
    thing: "การ์ดข้อมูลใบ 5 ช่อง (ออเดอร์ · กำหนดส่ง · ปัญหาค้าง · ความคืบหน้า)",
    a: "เหมือนเดิม",
    b: "ยุบเป็นบรรทัดเดียวใต้หัวหน้า",
    c: "อยู่มุม “ข้อมูลใบนี้”",
  },
  {
    thing: "ผังสายพานคู่",
    a: "เหมือนเดิม",
    b: "เหมือนเดิม (เป็นตัวหลัก)",
    c: "อยู่มุม “ลงมือทำ”",
  },
  {
    thing: "รายการขั้นงานใต้ผัง (ตัวที่ซ้ำกับผัง)",
    a: "เหมือนเดิม",
    b: "ตัดออก — ผังทำหน้าที่แทน",
    c: "ตัดออก — ผังทำหน้าที่แทน",
  },
  {
    thing: "แผงลงมือทำ",
    a: "เหมือนเดิม",
    b: "โตขึ้น มีของของขั้นนั้นครบ",
    c: "อยู่มุม “ลงมือทำ”",
  },
  {
    thing: "ข้อมูลอ้างอิงที่ล็อกไว้",
    a: "เหมือนเดิม",
    b: "ย้ายลงล่างคู่กับประวัติ",
    c: "อยู่มุม “ข้อมูลใบนี้”",
  },
  {
    thing: "จำนวนตามขั้นงาน (ตาราง 7 คอลัมน์)",
    a: "อยู่ในแท็บ “จำนวน”",
    b: "แยกไปอยู่ในแผงของแต่ละขั้น",
    c: "อยู่มุม “ข้อมูลใบนี้” เต็มตาราง",
  },
  {
    thing: "ปัญหาและข้อยกเว้น",
    a: "อยู่ในแท็บ “ปัญหา” + จุดแดง",
    b: "ตัวที่บล็อก = แถบแดงบนสุด · ที่เหลืออยู่ในแผงของขั้น",
    c: "แถบแดงในมุมทำงาน + รายการเต็มในมุมข้อมูล",
  },
  {
    thing: "ประวัติการทำงาน",
    a: "อยู่ในแท็บ “ประวัติ”",
    b: "ของขั้น = ในแผง · ทั้งใบ = กล่องล่าง 5 รายการล่าสุด",
    c: "อยู่มุม “ข้อมูลใบนี้”",
  },
  {
    thing: "งานส่งแก้",
    a: "เหมือนเดิม (โผล่เฉพาะใบที่มี — ใบตัวอย่างนี้ไม่มี)",
    b: "เหมือนเดิม",
    c: "เหมือนเดิม",
  },
];

const NOTES = [
  "ใบตัวอย่าง = ใบที่เบสเปิดดูจริง MO-2609-0008 (Bangkok Run Club · 40 ตัว · ครีม S14/M13/L13) — จำนวนแถว สถานะ และข้อความปัญหายกมาจากฐานทดลองตรง ๆ",
  "ปุ่มในแผงลงมือมาจากสิทธิ์ที่ server อนุญาตเหมือนของจริง — ขั้นเตรียมงานกับ DTF จึงขึ้นว่า “ทำที่จอสถานี” ไม่ใช่ปุ่มปลอม",
  "กดปุ่ม “ใบใหญ่” เพื่อดูตอนของเยอะจริง: 9 ขั้นมีสายร้านนอก · จำนวน 27 แถว · ปัญหา 3 · ประวัติ 19 — ทุกแบบต้องไม่พังตอนนั้น",
  "ตัวเลขความยาวในคำอธิบายแต่ละแบบวัดจริงจากหน้านี้บนจอกว้าง 1,440 จุดภาพ (ใบตัวอย่างเล็ก) — ของจริงตอนนี้ยาว 3,359 · A 1,656 · B 1,002 · C 721",
  "หน้านี้เทียบเฉพาะ “ของเยอะไป” ไม่ได้เสนอเปลี่ยนวิธีทำงาน — ผังสายพานคู่กับแผงลงมือที่เบสเคาะไปแล้วยังอยู่ครบทุกแบบ",
];

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderDensityProtoPage() {
  const [variant, setVariant] = useProtoVariant<WorkOrderDensityVariant>(
    "v",
    VALUES,
    "current",
  );
  const [big, toggleBig] = useProtoFlag("big");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-order-density/view?v=${variant}${big ? "&big=1" : ""}`;

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
          หน้าใบสั่งผลิต — ตัดของบนหน้าให้เหลือเท่าไหร่
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          ใบที่เบสเปิดดูมีแค่ <strong className="font-semibold text-strong">5 ขั้น</strong>{" "}
          กับ <strong className="font-semibold text-strong">เสื้อสีเดียว 3 ไซซ์</strong>{" "}
          แต่หน้ายาว 8 กอง เพราะ 5 ขั้นนั้นถูกวาดซ้ำ 4 รอบ และจำนวน 3 บรรทัดถูกทำซ้ำครบทุกขั้นเป็น
          15 แถว · สามแบบข้างล่างลดของบนหน้าคนละวิธี{" "}
          <strong className="font-semibold text-strong">โดยไม่ตัดของทิ้ง</strong> —
          ดูตารางท้ายหน้าว่าของแต่ละชิ้นย้ายไปอยู่ไหน
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
            <Button
              variant={big ? "default" : "outline"}
              size="sm"
              onClick={toggleBig}
              aria-pressed={big}
            >
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
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              วิธีคิด: {copy.idea}
            </p>
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
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">บนคอม</p>
            <span className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  window.open(src, "proto-mobile", "width=390,height=820,noopener")
                }
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
            <WorkOrderDensityPreview variant={variant} big={big} />
          </div>
        </section>

        <section className="card-surface mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">ของทุกชิ้นที่หน้าจริงมี ย้ายไปอยู่ไหน</h2>
          <p className="mt-1 text-xs text-muted">
            ไม่มีอะไรถูกตัดทิ้ง — ทั้งสามแบบยังมีของครบเท่าเดิม แค่คนละที่
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className={cn(TABLE_HEAD_SURFACE, "text-muted")}>
                <tr className="border-b border-divider">
                  <th className="py-2 pr-3 font-medium">ของบนหน้า</th>
                  <th className="py-2 pr-3 font-medium">A · ท้ายหน้ายุบเป็นแท็บ</th>
                  <th className="py-2 pr-3 font-medium">B · ผังคือรายการ</th>
                  <th className="py-2 font-medium">C · แยกลงมือ/ข้อมูล</th>
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
            <li>
              · ปุ่มจ่ายงาน/สลับลำดับคิว/ตัดสิน QC ที่ของจริงมีในแต่ละแถว — วาดไว้เป็นปุ่มเฉย ๆ
              กดแล้วไม่เกิดอะไร (หน้าลองไม่ต่อฐานข้อมูล)
            </li>
            <li>
              · ใบที่ยังเป็นร่าง (มีแถบ “ยังปล่อยผลิตไม่ได้” และปุ่มปล่อยผลิต) — ใบตัวอย่างปล่อยผลิตไปแล้ว
            </li>
            <li>
              · หน้าจอตอนโหลด/ตอนหลุดเน็ต (โครงสีเทา · แถบ “ข้อมูลล่าสุดอาจยังไม่ครบ”) —
              ไม่เกี่ยวกับเรื่องที่กำลังเลือก
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
