"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoVariant } from "../_kit/use-proto-variant";
import { OPTIONS, Preview, VALUES, type Variant } from "./_preview";

/* กติกา: ปัจจุบันมาก่อน · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี */

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  now: {
    name: "ปัจจุบัน — กล่องสี + ตัวหนังสือ 3 บรรทัด",
    idea: "กล่องพื้นสีตามความหมาย ข้างในเป็นตัวหนังสือล้วน ไอคอนมีเฉพาะที่คนเขียนโค้ดนึกได้",
    summary: "ทั้งเว็บ 49 ไฟล์ 72 จุด มีไอคอนแค่ 12 จุด · ใคร/เมื่อไร/ที่ไหน เป็นบรรทัดจางต่อกันด้วยจุด · ปุ่ม (ลองใหม่ · ส่งเข้า QC) ยัดในบรรทัดเดียวกับข้อความ",
    tradeoff: "นี่คือที่เบสบอกว่า “ดูโง่” — ตาไม่รู้จะเริ่มอ่านตรงไหน ทุกกล่องหน้าตาเหมือนกันไม่ว่าจะเป็นปัญหาใหญ่หรือหมายเหตุเล็ก",
  },
  mark: {
    name: "A · ตราไอคอน + ชั้นข้อความ",
    idea: "ทุกกล่องมี “ตรา” ไอคอนสีทึบซ้ายมือเสมอ (เลือกให้อัตโนมัติตามชนิด) → หัวเรื่องหนา → เนื้อความ → ชิปประกอบ → ปุ่มชิดขวา",
    summary:
      "แก้ที่ชิ้นส่วนกลางชิ้นเดียว ทั้ง 72 จุดได้ไอคอนทันทีโดยไม่ต้องไล่แก้ทีละหน้า · ใคร/เมื่อไร/ที่ไหน เป็นชิป (ชั้น 3) แทนบรรทัดจุด · ปุ่มแยกออกจากข้อความชัด · พื้นยังเป็นสีตามความหมายเหมือนเดิม (คนคุ้น)",
    tradeoff: "หน้าที่มีกล่องเตือนหลายอันจะแดง/เหลืองเป็นก้อนใหญ่ (ตราทึบ + พื้นสี) — หน้าใบผลิตที่ติดปัญหา 2 จุดจะดัง · ตรากินที่ 32px ทำให้กล่องสูงขึ้นนิดหน่อยบนมือถือ",
  },
  bar: {
    name: "B · แถบสีข้าง พื้นเรียบ",
    idea: "กล่องเป็นการ์ดขาวเหมือนการ์ดอื่นในหน้า สีบอกความหมายเหลือแค่แถบข้างซ้ายกับไอคอน — สะอาดแบบ Notion/Vercel ที่เบสเคาะไว้",
    summary:
      "โครงเดียวกับ A (ไอคอนอัตโนมัติ · หัวหนา · เนื้อความ · ชิป · ปุ่มขวา) แต่ไม่มีพื้นสี — หน้าไม่แดงทั้งก้อนแม้มีเตือนหลายอัน · เข้ากับกฎ “สีเฉพาะความหมายจริง” และธีมมืดง่ายกว่า",
    tradeoff: "กล่องเตือนกลืนกับการ์ดอื่นได้ถ้าคนไม่มองแถบข้าง — ปัญหาใหญ่ (งานติด) อาจดังไม่พอ · ต้องพึ่งไอคอน+หัวเรื่องให้ทำงานแทนสีพื้น",
  },
};

const NOTES = [
  "ตัวอย่างทั้ง 6 คือข้อความจริงจากหน้าจริง (ใบผลิต · ทุกหน้ารายการ · สูตรขั้นงาน · ออเดอร์) — ครบทั้ง ปัญหา / ข้อมูลค้าง / หมายเหตุ / สำเร็จ / ผิดพลาด / ดูอย่างเดียว และแบบมีปุ่ม-ไม่มีปุ่ม",
  "A กับ B ใช้ API เดียวกับกล่องเดิม + เพิ่มช่อง “ข้อเท็จจริงประกอบ” (ขั้น · คน · เวลา) กับ “ปุ่ม” — ลงของจริง = แก้ไฟล์ alert.tsx ไฟล์เดียว 72 จุดเปลี่ยนตาม แล้วค่อยไล่ย้าย meta/ปุ่มของจุดที่มี (ใบผลิต · โต๊ะงาน · หน้างาน) มาใส่ช่องใหม่",
  "ตัวที่เบสส่งรูปมา (การ์ดปัญหาในใบผลิต) คือตัวอย่างแรก — ดูว่า “ขั้น · แจ้งโดย · เมื่อ” เป็นชิปแล้วอ่านง่ายขึ้นไหม และปุ่ม “แก้ให้” อยู่ตรงนั้นเลย",
  "กดสลับธีมมืดดูด้วย — กล่องสีเดิมในธีมมืดคือจุดที่เบสเห็นในรูป",
] as const;

const OUT_OF_SCOPE = [
  "ป้ายสถานะ (Badge) · ชิป (InfoChip) · แถบเตือนเต็มหน้าตอนโหลดพัง (QueryError) · แผงคำอธิบาย (ContextPanel) — ไม่อยู่ในหน้าลองนี้ ถ้าเบสรู้สึกว่าโง่ด้วยบอกได้",
  "ปุ่มยังไม่ทำอะไร",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function AlertProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "mark");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/alert/view?v=${variant}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">กล่องแจ้งเตือนทั้งเว็บ — เลิกเป็นตัวหนังสือ 3 บรรทัดในกล่องสี</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสทัก (3 ก.ย.) “UI แจ้งเตือนดูโง่ไป และเป็นทั้งเว็บเลย ปัญหาเดิม” · กล่องนี้เป็นชิ้นส่วนกลางชิ้นเดียว (49 ไฟล์ 72 จุด) — แก้ครั้งเดียวเปลี่ยนทั้งเว็บ · คำถามที่ต้องเคาะ —{" "}
          <span className="font-medium text-strong">กล่องแจ้งเตือนควรบอกความสำคัญด้วยอะไร: ตราไอคอนบนพื้นสี หรือแถบข้างบนพื้นเรียบ</span>
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="overflow-x-auto pb-1">
            <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
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
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">6 จุดจริงทั่วเว็บ — วางบนพื้นหน้าปกติ</p>
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
            <Preview variant={variant} />
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
