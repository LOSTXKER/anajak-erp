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
    name: "ปัจจุบัน — จอจดทุกขั้น และกระดาษก็เซ็นซ้ำ",
    idea: "ระบบต้องรู้ทุกขั้นแบบเรียลไทม์ โดยให้ช่างเป็นคนกด",
    summary:
      "ใบผลิต 7 ขั้น ทุกขั้นกด เริ่ม → ปิดขั้นพร้อมยอด (ร้านนอก: ส่ง → รับกลับ → ตรวจรับ) รวม 16 ครั้งต่อใบ · ใบสั่งงานกระดาษที่มีอยู่แล้วก็มีตารางให้เซ็นทุกขั้นอีกที = จด 2 ที่ · QR บนกระดาษเปิดหน้าออเดอร์ ไม่ใช่ใบผลิต",
    tradeoff: "ที่เบสรู้สึก: กดเพื่อจด ไม่ได้กดเพื่อทำงาน · ช่างไม่กด = ระบบบอกว่างานยังไม่เริ่มทั้งที่รีดไปครึ่งล็อตแล้ว · เวลาต่อขั้นละเอียด แต่เชื่อถือได้เท่าที่ช่างขยันกด",
  },
  three: {
    name: "A · กระดาษเป็นหลัก — ระบบจดแค่ 3 จุด (+ ร้านนอก)",
    idea: "จดเฉพาะจุดที่ “การจด” ทำงานอย่างอื่นให้ด้วย (แนว Printful / Printavo) ที่เหลือเดินตามกระดาษ",
    summary:
      "พิมพ์ DTF เสร็จ = ผ่านเองจากรอบพิมพ์ (0 ครั้ง) · ผล QC ดี/เสีย (1 ครั้ง — ใช้สั่งแก้ + ตัวชี้วัด) · แพ็กเสร็จ (1 ครั้ง — ปลดล็อกส่งของ/ออกบิล) · ร้านนอก ส่งไป/รับกลับ (2 ครั้งต่อร้าน — ของออกจากโรงงาน) · เตรียมเสื้อ/รีดร้อน เดินตามกระดาษ ระบบถือว่าผ่านเมื่อ QC บันทึก · ใบกระดาษพิมพ์จากใบผลิต มีช่องติ๊กข้อกำหนด ยอดดี/เสีย ลงชื่อ · QR เปิดใบผลิต",
    tradeoff: "เวลาของขั้นเตรียม/รีดไม่มีในระบบ → ตัวชี้วัดผลิตเหลือระดับใบ · จอ TV โรงงานเห็น 3 ช่วงแทน 6 · แก้แบบกลางทางต้องตามเก็บกระดาษเก่า · หัวหน้าอยากรู้ว่ารีดถึงไหนต้องเดินไปดูหรือให้ช่างกด “จดเวลาเสร็จ” เอง",
  },
  batch: {
    name: "B · คงทุกขั้น แต่หัวหน้ากรอกจากกระดาษวันละรอบ",
    idea: "ช่างไม่แตะจอเลย ระบบยังรู้ทุกขั้นเท่าเดิม แค่รู้ช้า",
    summary:
      "ใบผลิตหน้าตาเท่าเดิม 7 ขั้น · ช่างเซ็นกระดาษอย่างเดียว · หัวหน้ากด “กรอกจากกระดาษ” ตอนปิดวัน ได้ฟอร์มเดียวกรอกทุกขั้น (เสร็จวันที่ · ยอดดี/เสีย · คนทำ) · ต่อยอดปุ่ม “แก้ให้” ที่มีอยู่แล้ว ไม่ต้องเปลี่ยนกติกาขั้นงาน",
    tradeoff: "ข้อมูลช้าครึ่งวัน — QC เสียเจอตอนเย็น · หัวหน้าเป็นคอขวด (7 ขั้น × ทุกใบ ทุกวัน) · ระบบมีข้อมูลละเอียดแต่เป็นอดีตเสมอ ใช้เตือน/จัดคิวสดไม่ได้",
  },
};

const NOTES = [
  "ตัวเลข “ช่างแตะจอต่อใบ” นับจากปุ่มที่ระบบบังคับจริง: ขั้นในโรงงาน = เริ่ม + ปิดขั้นพร้อมยอด · ร้านนอก = ส่ง + รับกลับ + ตรวจรับ · ไม่นับติ๊กข้อกำหนด (ของจริงตอนนี้ยังไม่บันทึก)",
  "ใบสั่งงานกระดาษ “มีอยู่แล้ว” ในระบบ (พิมพ์จากหน้าออเดอร์) — ทุกทางต่อยอดใบนี้ ไม่ได้สร้างใหม่ · กระดาษในหน้าลองใช้แบบตัวอักษร/เส้น/ตราชุดเดียวกับใบจริง",
  "สวิตช์ “มีร้านนอก”: ใบตัวอย่างมีปักแขน + ป้ายคอ 2 ร้าน — ร้านนอกเป็นจุดที่ทาง A ยังต้องจด เพราะของออกจากโรงงาน · กดสลับเป็น “ทำเองทั้งใบ” จะเห็นว่าทาง A เหลือแตะจอแค่ 2 ครั้ง",
  "หัวหน้า/ช่าง: ช่างไม่มีเมนู “เพิ่มเติม/แก้ให้” และไม่มีปุ่ม “กรอกจากกระดาษ”",
  "ที่มาของทาง A: บันทึกค้นคว้า Printful / Printify / Printavo (bestos records 2026-09-05) — POD ใหญ่มีสถานะ 4-5 อัน สแกนเฉพาะจุดที่ทำงานให้ · ร้านสกรีน B2B ใช้กระดาษ + QR",
] as const;

const OUT_OF_SCOPE = [
  "โหมดหน้างาน (คิวสถานีของช่างบนจอทัช) ไม่อยู่ในหน้าลองนี้ — ถ้าเคาะ A คิวจะเหลือเฉพาะสถานี QC / แพ็ก / ร้านนอก และสถานีรีดร้อนหายไป",
  "ปุ่มทุกปุ่มยังไม่ทำอะไร · ฟอร์มกรอกจากกระดาษ (ทาง B) ยังไม่บันทึก",
  "ยังไม่ตัดสินว่า “จุดที่ต้องจด” เป็นค่าตั้งได้ในสูตรขั้นงาน หรือเป็นกฎตายตัว 3 จุด — เป็นงานฐานข้อมูล ต้องถามเบสก่อนแยกต่างหาก",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function PaperFirstProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "three");
  const [out, toggleOut] = useProtoFlag("out", true);
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/paper-first/view?v=${variant}&out=${out ? "1" : "0"}&boss=${boss ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">กระดาษเป็นหลัก — ระบบต้องจดกี่จุด และช่างต้องแตะจอกี่ครั้ง</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสถาม (5 ก.ย.) “กดติ๊กทีละขั้นดูยุ่งยาก จำเป็นจริงไหม ปกติใช้กระดาษใบงาน” · คำถามที่ต้องเคาะ —{" "}
          <span className="font-medium text-strong">ช่างต้องแตะจออย่างน้อยกี่จุดต่อใบ และกระดาษกับจอแบ่งหน้าที่กันยังไง</span>
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
