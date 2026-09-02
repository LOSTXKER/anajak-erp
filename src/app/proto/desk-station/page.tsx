"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { ENTRANCES, STRUCTURE } from "./_data";
import { DETAIL_OPTIONS, DETAIL_VALUES, OPTIONS, Preview, VALUES, type DetailMode, type Variant } from "./_preview";

/* กติกา: ปัจจุบันมาก่อน · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี */

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  now: {
    name: "ปัจจุบัน — ใบผลิต D ที่มีปุ่มลงมือ (ขึ้นเว็บจริง 3 ก.ย.)",
    idea: "ใบผลิตทำได้ทุกอย่าง — ดูก็ได้ กดเริ่ม/ปิดขั้น/ลงยอด/แจ้งปัญหาก็ได้",
    summary:
      "แท็บขั้นงาน คอลัมน์ขวาคือโซนลงมือ: ข้อกำหนด → ปุ่มหลัก → แจ้งปัญหา · หัวใบมีปุ่ม “มอบหมาย” กับ “แจ้งปัญหา” · ปุ่มชุดนี้ซ้ำกับหน้าลงมือของจอสถานีทุกปุ่ม",
    tradeoff: "นี่คือต้นเหตุที่เบสถาม — หัวหน้ามี 2 ที่กดได้เท่ากัน ไม่มีกติกาว่าทำที่ไหน · ช่างเปิดหน้านี้ก็เห็นของทั้งใบ (เสื้อ วัตถุดิบ ประวัติ) ที่ไม่เกี่ยวกับงานตรงหน้า",
  },
  plan: {
    name: "A · คงโครง D — แทนโซนลงมือด้วย “การ์ดที่ยืน”",
    idea: "โครงเดิมทั้งหมด (แท็บ · 2 คอลัมน์ · เลือกขั้นซ้าย ดูขั้นขวา) เปลี่ยนแค่ก้อนล่างขวาจาก “ทำ” เป็น “อยู่ไหน + วางแผน”",
    summary:
      "การ์ดที่ยืน 3 ชั้น: ประโยคเดียวว่างานอยู่ไหนใครถือ (กำลังทำที่พิมพ์ DTF โดยต้น · อยู่ที่ร้านปักสมชาย นัดรับ 1 ก.ย. · ติดปัญหาที่เตรียมเสื้อ) → สถานี/คนทำ/ควรเสร็จ → ปุ่มวางแผนของหัวหน้า (เปลี่ยนคน · เลื่อนควรเสร็จ · นัดรับใหม่ · เปลี่ยนร้าน) + ปุ่ม “ไปทำที่จอสถานี” พาไปงานนั้นตรง ๆ · หัวใบเหลือ “มอบหมาย / แก้แผน” ปุ่มเดียว · ช่างเปิดมาเห็นแต่ “ดูได้อย่างเดียว — ลงมือที่จอสถานี”",
    tradeoff:
      "ทีมที่ชินกับ D แล้ว แทบไม่ต้องเรียนใหม่ — แต่ยังต้องกดเลือกขั้นทีละขั้นถึงจะรู้ว่าอยู่ไหน (คอลัมน์ซ้ายบอกแค่สถานะกับคน) · โซนขวาที่เคย “ทำงาน” กลายเป็นที่อ่านอย่างเดียวสำหรับช่าง อาจรู้สึกว่าหน้าว่างเปล่า",
  },
  table: {
    name: "B · ตารางแผนทั้งใบ — ขั้นงานเป็นตารางเดียวเหมือนหน้าการผลิต",
    idea: "ไม่มีปุ่มลงมือแล้ว 2 คอลัมน์ไม่จำเป็น — ทุกขั้นเป็นแถว เห็น 7 ขั้นพร้อมกันว่าอยู่สถานีไหน ใครทำ ควรเสร็จเมื่อไร",
    summary:
      "ตาราง 6 คอลัมน์ (ขั้น · สถานี · คนทำ · ยอด · ควรเสร็จ · ตอนนี้อยู่ไหน) กวาดตาทีเดียวรู้ทั้งใบ ต่อเนื่องกับหน้าการผลิตที่เบสเคาะ (ตาราง ไม่มีปุ่มในแถว) · กดแถว = รายละเอียดขั้น (ปัญหา · ร้านนอก · การ์ดที่ยืน + ปุ่มวางแผน + ไปทำที่จอสถานี) โผล่ตามสวิตช์ด้านบน — กางใต้แถวที่กด (แนะนำ: ตาไม่ต้องย้าย กดซ้ำเพื่อหุบ) / หน้าต่างเด้ง (ตารางนิ่ง แต่บังหน้า) / แถบใต้ตาราง (แบบแรกที่เบสทักว่าไม่ดี) · แท็บอื่นเหมือน D",
    tradeoff:
      "กางใต้แถว: ตารางยืดลง แถวข้างล่างขยับ (เปิดได้ทีละขั้น) · หน้าต่างเด้ง: ต้องปิดก่อนถึงกดขั้นอื่นได้ และเปิดหน้ามาไม่มีอะไรเลือกไว้ · แถวตารางมีเป้ากดเล็กกว่าการ์ด (หน้านี้ใช้บนคอมเท่านั้น จึงรับได้) · บนมือถือตารางเลื่อนแนวนอน",
  },
};

const NOTES = [
  "ทั้ง A และ B ยึดโครงเดียวกันที่เบสเคาะ: ใบผลิต = ดู + วางแผน · จอสถานี = ลงมือ · ต่างกันแค่ “แท็บขั้นงานควรหน้าตาแบบไหนเมื่อไม่มีปุ่มลงมือ”",
  "“วางแผน” ที่คงไว้บนใบผลิต = สิ่งที่ตัดสินว่า ใคร/เมื่อไร/ร้านไหน: มอบหมาย · ควรเสร็จ · ส่งร้านนอก-นัดรับ-เปลี่ยนร้าน · เสื้อ-วัตถุดิบ · ต้นทุน · “ลงมือ” ที่ย้ายไปจอสถานี = สิ่งที่เปลี่ยนสถานะขั้น: เริ่ม · ลงยอด · ปิดขั้น · เบิกเสื้อ · ตรวจรับของกลับ · แจ้งปัญหา · หัวหน้าแก้ให้ (พัก/เรียงคิว/ข้าม/ลงยอดแทน)",
  "ใบตัวอย่างเดิมของหน้าลองใบผลิต (โปโล 240 ตัว · 7 ขั้น ครบ ผ่านแล้ว/กำลังทำ/รอของกลับ/ติดปัญหา 2 จุด/ยังไม่ถึง) — กดเลือกขั้นต่างสถานะเพื่อดูว่าการ์ดที่ยืนพูดว่าอะไร",
  "สวิตช์ “หัวหน้า/ช่าง” เปลี่ยนแค่ปุ่มวางแผนกับปุ่มหัวใบ — ช่างเห็นหน้าเดียวกันแต่อ่านอย่างเดียว",
] as const;

const OUT_OF_SCOPE = [
  "ปุ่มทุกปุ่มยังไม่ทำอะไร — “ไปทำที่จอสถานี” ของจริงจะพาไป /station?st=…&job=…&step=… ซึ่งจอสถานีรองรับอยู่แล้ว · ปุ่มวางแผน (เปลี่ยนคน · เลื่อนควรเสร็จ · นัดรับใหม่ · เปลี่ยนร้าน) ใช้ dialog เดิมของใบผลิต (โหมดหัวหน้า / ร้านนอก)",
  "ทางเข้า 3 ข้อด้านบน (เมนู · หน้าแรกของช่าง · ลิงก์ตรง) ไม่ได้วาดในหน้าลอง — เป็นงานลงของจริงพร้อมกัน",
  "ยังไม่แตะจอสถานีเอง (แบบ A ที่ขึ้นเว็บจริงแล้ว) — หน้าลองนี้ตอบเฉพาะฝั่งใบผลิต",
  "“ควรเสร็จต่อขั้น” ในหน้าลองคำนวณถอยจากกำหนดส่ง — ของจริงยังไม่มีวันแผนต่อขั้น (หนี้เดิม §A)",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function DeskStationProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "table");
  const [detail, setDetail] = useProtoVariant<DetailMode>("d", DETAIL_VALUES, "row");
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/desk-station/view?v=${variant}&boss=${boss ? "1" : "0"}&d=${detail}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">ใบผลิตหลัง “แบ่งตามที่ยืน” — ดู + วางแผน ไม่มีปุ่มลงมือ</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสถาม (3 ก.ย.) ว่าใบผลิตกับจอสถานีซ้ำกันไหม หัวหน้าจะงงไหมว่าทำอันไหน แล้วเคาะ “A · แบ่งตามที่ยืน”: จอสถานี = ยืนหน้างาน ลงมือ · ใบผลิต = นั่งโต๊ะ ดูและวางแผน ·
          หน้าลองนี้ถามต่อข้อเดียว — <span className="font-medium text-strong">แท็บขั้นงานของใบผลิตควรหน้าตาแบบไหน เมื่อปุ่มลงมือย้ายไปจอสถานีแล้ว</span>
        </p>

        {/* โครงที่เคาะแล้ว — ใคร ยืนไหน เปิดหน้าไหน ทำอะไรได้ */}
        <section className="mt-6 card-surface overflow-hidden rounded-2xl">
          <div className="px-5 pt-4">
            <p className="text-sm font-semibold">โครงที่เบสเคาะ — ใครยืนตรงไหน เปิดหน้าไหน ทำอะไรได้</p>
            <p className="text-xs text-muted">จะลง SPEC.md เป็นกติกาถาวรเมื่อเคาะหน้าตาแท็บขั้นงาน</p>
          </div>
          <div className="mt-3">
            <DataTable.Root className="min-w-0 max-w-full [&_td]:px-3 [&_th]:px-3">
              <DataTable.Head>
                <tr>
                  <DataTable.Th>ใคร</DataTable.Th>
                  <DataTable.Th>ยืนตรงไหน</DataTable.Th>
                  <DataTable.Th>เปิดหน้าไหน</DataTable.Th>
                  <DataTable.Th>ทำอะไรได้</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {STRUCTURE.map((row) => (
                  <DataTable.Row key={row.who} className="align-top">
                    <DataTable.Td className="whitespace-nowrap font-medium text-strong">{row.who}</DataTable.Td>
                    <DataTable.Td className="text-secondary">{row.where}</DataTable.Td>
                    <DataTable.Td className="font-medium text-strong">{row.page}</DataTable.Td>
                    <DataTable.Td className="text-secondary">{row.can.replace(/\*\*/g, "")}</DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable.Root>
          </div>
          <div className="border-t border-divider px-5 py-4">
            <p className="text-xs font-medium text-muted">ทางเข้าที่จะทำพร้อมกัน (ไม่ต้องเคาะ — ตามมาจากโครง)</p>
            <ul className="mt-1.5 space-y-1 text-sm text-secondary">
              {ENTRANCES.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span aria-hidden="true" className="text-muted">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant={boss ? "default" : "outline"} size="sm" onClick={toggleBoss} disabled={variant === "now"}>
              <UserRound /> {boss ? "มองเป็นหัวหน้า" : "มองเป็นช่าง"}
            </Button>
            {variant === "table" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted">กดแถวแล้วรายละเอียดโผล่ที่:</span>
                <SegmentedControl options={DETAIL_OPTIONS.map((o) => ({ ...o }))} value={detail} onChange={setDetail} aria-label="กดแถวแล้วรายละเอียดโผล่ที่ไหน" className="min-w-max" />
              </div>
            ) : null}
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
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">บนคอม (หน้านี้ใช้ที่โต๊ะเท่านั้น — จอทัชใช้จอสถานี)</p>
            <span className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => window.open(src, "proto-mobile", "width=390,height=820,noopener")} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดขนาดมือถือ (390)
              </button>
              <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดเต็มหน้าจอ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className={cn("overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8")}>
            <Preview variant={variant} boss={boss} detail={detail} />
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
