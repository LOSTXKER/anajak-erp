"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Sun, Truck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { OPTIONS, Preview, VALUES, type Variant } from "./_preview";

/* กติกา: ปัจจุบันมาก่อน · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี */

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  now: {
    name: "ปัจจุบัน — แท็บ + 2 คอลัมน์ (แบบ D ที่เคาะ 3 ก.ย.)",
    idea: "ภาพรวมซ้าย ลงมือขวา แยกเรื่องเป็นแท็บ",
    summary: "หัวใบตัวเลข 4 ช่อง → แท็บ ขั้นงาน / ทำอะไร / ข้อมูลใบ / ประวัติ → แท็บขั้นงาน: รายการขั้นซ้าย (กดเลือก) · ขั้นที่เลือกขวา + โซนลงมือ · เสื้อ/ลายอยู่คนละแท็บกับขั้นงาน",
    tradeoff: "ที่ทีมผลิตรู้สึก: เปิดมาต้องรู้ก่อนว่าแท็บไหนมีอะไร · กดขั้นทีละขั้นถึงเห็นยอด/คน · แถวละ 4–5 ชิปเป็นศัพท์ภายใน · จอไม่เหมือนใบสั่งงานที่ถืออยู่ ต้องแปลไปมา",
  },
  paper: {
    name: "C · จอเหมือนกระดาษ — ใบสั่งงานใบเดียวกับที่ทีมถือ แค่มีชีวิต",
    idea: "ทีมอ่านใบสั่งงานกระดาษออกอยู่แล้ว → จอวางเหมือนกระดาษ จะได้ไม่ต้องเรียนรู้ใหม่",
    summary:
      "หน้าเดียวเลื่อนลงอ่านจบ ไม่มีแท็บ ไม่มีชิปศัพท์ · หัวใบวางเหมือนหัวกระดาษ (เลขงาน · กำหนดส่ง · จำนวน · ผ่านกี่ขั้น · ม็อกอัพ) · ปัญหาเป็นการ์ดแดงถัดลงมา · เสื้อและลาย (รูป 3 สี + ไซซ์ + ตำแหน่งพิมพ์) · ตารางขั้นตอนคอลัมน์เดียวกับกระดาษ (ขั้น · ทำอะไรก่อนปิด · ยอด · เสร็จ · ลงชื่อ/ลงมือ) — แถวที่ต้องกดในระบบมีปุ่มอยู่ในช่องที่กระดาษให้เซ็น แถวที่จดบนกระดาษเขียนว่า “เขียนบนใบ” · ร้านนอกแยกตารางเหมือนกระดาษ",
    tradeoff:
      "ไม่มีแท็บ = ข้อมูลใบ / ประวัติ / วัตถุดิบ หายไปจากหน้านี้ (ต้องไปหน้าออเดอร์หรือตั้งค่า) · ตารางกว้าง บนมือถือต้องเลื่อนซ้ายขวาในกรอบ (คอลัมน์ “ทำอะไรก่อนปิด” ซ่อนบนจอเล็ก) · หัวหน้าแก้ให้ต้องกดปุ่มเล็กในแถว ไม่มีโซนลงมือใหญ่ · ช่างกับหัวหน้าเห็นเหมือนกันหมด",
  },
  one: {
    name: "D · ทีละขั้น — จอบอกสิ่งเดียว: ขั้นนี้ ทำกับเสื้อตัวไหน กดอะไร",
    idea: "คนหน้างานมาถึงใบนี้เพื่อทำ 1 ขั้น ไม่ได้มาอ่านทั้งใบ",
    summary:
      "แถบขั้น 1–7 บนสุดเป็นทางเดียวที่ใช้เลือกขั้น (ผ่านแล้ว = ถูกเขียว · ติด = แดง) · ผืนใหญ่ผืนเดียว: ซ้าย = เสื้อที่กำลังทำ (รูป 3 สี · ไซซ์รวม · ตำแหน่งพิมพ์) · ขวา = ขั้นที่เปิด (ชื่อใหญ่ · ยอด · ปัญหา · ข้อกำหนดเป็นช่องติ๊กใหญ่ · ปุ่มเดียวสูง 56px) · “ถัดไป” หนึ่งบรรทัด · ตารางทั้งใบแบบ C พับไว้ท้ายหน้าให้หัวหน้ากดดู",
    tradeoff:
      "หัวหน้าเห็นภาพรวม 7 ขั้นแค่จากแถบเล็ก ต้องกดทีละขั้นเพื่อดูยอด/คน (หรือกดกางตารางท้าย) · ใกล้หน้างานของช่างมาก จนหัวหน้ากับช่างเห็นหน้าเดียวกัน — ถ้าเบสชอบ อาจยุบหน้างาน /production/floor รวมกับใบผลิตได้ (งานใหญ่) · ต่างจาก “B ตอนนี้ทำอะไร” ที่เคยเสนอ 2 ก.ย. ตรงที่ไม่มีรายการขั้นข้าง ๆ เลย",
  },
};

const NOTES = [
  "นี่คือรื้อโครงจริง (เบสสั่ง 6 ก.ย. “ลองเปลี่ยน redesign เลย”) — ต่างจากหน้าลอง /proto/work-order-quiet ที่แค่ตัดชิปบนโครง D เดิม · ทั้ง C และ D ไม่มีแท็บ ไม่มี 2 คอลัมน์ซ้าย-ขวาแบบเดิม",
  "ต่างจากที่เคยเสนอ 2 ก.ย. (/proto/work-order: A ตารางขั้นงาน · B ตอนนี้ทำอะไร · C ไทม์ไลน์) ยังไง — ตอนนั้นเทียบ “อะไรควรนำสายตา” ในโครงแท็บ · รอบนี้เทียบ “ทีมต้องเรียนรู้จอนี้ใหม่แค่ไหน”: C ลอกกระดาษทั้งใบ (ไม่ใช่แค่ตาราง) · D ไม่มีรายการขั้นข้าง ๆ (B เดิมมี)",
  "ตัวเลข “กดกี่ครั้งถึงเห็นครบทุกขั้น”: ปัจจุบัน = เข้าแท็บขั้นงาน + กดขั้นที่เหลือทีละขั้น · C = 0 (เลื่อนอย่างเดียว) · D = กดแถบขั้นทีละขั้น (หรือกดกางตารางท้าย 1 ครั้ง)",
  "ศัพท์ภายในนับจากคำที่ทีมทัก 6 ก.ย.: จดในระบบ / จดบนกระดาษ / ถือว่าผ่าน / อื่นๆ / “ตอนนี้: หลัง X → ก่อน Y” / ม็อกอัพอนุมัติ v3 — C และ D ใช้คำบนกระดาษแทน (เขียนบนใบ · เซ็นบนใบ · ผ่านเอง)",
  "ปุ่ม “มองเป็นช่าง”: ไม่มีปุ่มพิมพ์ ไม่มีเมนูแก้ให้ ไม่มีปุ่มปลดปัญหา · ปุ่ม “ทำเองทั้งใบ”: ตัดร้านนอก 2 ขั้น ดูว่าตารางร้านนอก (C) หายไปแล้วหน้าเป็นยังไง",
  "กดเลือกขั้นได้ทุกขั้น (ปัจจุบัน = รายการซ้าย · D = แถบบน) — ลองกด “พิมพ์ฟิล์ม DTF” (ปิดแล้ว) กับ “รีดร้อน” (ตามกระดาษ) เทียบ",
] as const;

const OUT_OF_SCOPE = [
  "หน้างาน /production/floor ของช่าง — ถ้าเคาะ D ต้องคุยต่อว่าจะยุบรวมไหม (งานใหญ่ · ถามก่อน)",
  "แท็บ ข้อมูลใบ / ประวัติ / วัตถุดิบ ที่หายไปใน C — ยังไม่ตัดสินว่าไปอยู่ไหน (ท้ายหน้า · หน้าออเดอร์ · หรือปุ่มเล็ก)",
  "ช่องติ๊กข้อกำหนดยังไม่บันทึกจริง (ของจริง v1 อ่านอย่างเดียว — เหมือนเดิม) · ปุ่มทุกปุ่มยังไม่ทำอะไร",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderRedesignProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "paper");
  const [out, toggleOut] = useProtoFlag("out", true);
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-order-redesign/view?v=${variant}&out=${out ? "1" : "0"}&boss=${boss ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">รื้อใบผลิตใหม่ — ทีมต้องเรียนรู้จอนี้ใหม่แค่ไหน</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสสั่ง (6 ก.ย.) “ลองเปลี่ยน redesign เลย” หลังทีมผลิตบอกใช้ยาก · คำถามที่ต้องเคาะ —{" "}
          <span className="font-medium text-strong">ใบผลิตควรวางเหมือนกระดาษที่ทีมถือ (อ่านทั้งใบ) หรือบอกทีละขั้นให้คนหน้างาน (ทำ 1 อย่าง)</span>
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant={out ? "default" : "outline"} size="sm" onClick={toggleOut}>
              <Truck /> {out ? "มีร้านนอก 2 ขั้น" : "ทำเองทั้งใบ"}
            </Button>
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
          <div className="mb-2 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => window.open(src, "proto-mobile", "width=390,height=820,noopener")} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
              เปิดขนาดมือถือ (390)
            </button>
            <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
              เปิดเต็มหน้าจอ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8">
            <Preview variant={variant} out={out} boss={boss} />
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
