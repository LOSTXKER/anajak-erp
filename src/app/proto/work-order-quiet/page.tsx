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
    name: "ปัจจุบัน — ทุกอย่างที่ระบบรู้ โชว์หมดทุกแถว",
    idea: "โปร่งใส: ให้เห็นกติกาที่อยู่เบื้องหลังทุกขั้น",
    summary:
      "แถวละ 4–5 ชิป (สถานะ · จดที่ไหน · สถานี · คนทำ) — คำว่า “เตรียมเสื้อ” โผล่ 3 ครั้งในแถวเดียว · เหนือรายการมีแถบใบสั่งงาน 2 บรรทัด (ม็อกอัพ · พิมพ์ · “ตอนนี้: หลัง X → ก่อน Y”) · ฝั่งขวาซ้ำชิปชุดเดิมอีกรอบ + ข้อกำหนด 3 ข้อทุกขั้นแม้ปิดไปแล้ว + ปุ่ม “ผ่านแล้ว” ที่กดไม่ได้",
    tradeoff:
      "ที่ทีมผลิตรู้สึก: “จดในระบบ / จดบนกระดาษ / ถือว่าผ่าน / อื่นๆ” เป็นศัพท์ที่ฉันตั้งตอนออกแบบ ไม่ใช่คำที่ใช้ในโรงงาน · ขั้นที่ปิดไปแล้วกินครึ่งจอ · ของที่ต้องรู้จริง (ขั้นไหนถึงคิว ใครทำ เสร็จกี่ตัว) จมอยู่ในป้าย",
  },
  cut: {
    name: "A · ตัดออก — เหลือแค่ ขั้นไหนถึงคิว ใครทำ เสร็จกี่ตัว",
    idea: "ของที่ช่างไม่ต้องรู้ ไม่ต้องอยู่บนจอ",
    summary:
      "แถวละชิปเดียว เฉพาะขั้นที่กำลังทำ/ติด/รอของ · ชื่อคนเป็นตัวหนังสือไม่ใช่ชิป · ขั้นที่ผ่านแล้ว = เครื่องหมายถูกที่ตัวเลข ไม่มีชิป · ขั้นที่ทำตามกระดาษไม่มีชิปเลย บอกแค่ “ดูจากกระดาษ” · ไม่มีชิปสถานี (ชื่อขั้นบอกอยู่แล้วว่าร้านนอก) · แถบใบสั่งงานเหลือ 1 บรรทัด ตัด “ตอนนี้: หลัง X → ก่อน Y” ทิ้ง · ฝั่งขวาไม่ซ้ำฝั่งซ้าย: ขั้นที่ปิดแล้วเหลือยอด + วันปิด ไม่มีข้อกำหนด ไม่มีปุ่ม · ข้อกำหนดโชว์เฉพาะขั้นที่ต้องกดในระบบ ใช้ชื่อ “ก่อนกดปุ่ม ทำให้ครบ” · แท็บเปลี่ยนชื่อ “สินค้าและลาย / รายละเอียดใบ”",
    tradeoff:
      "หัวหน้าเสียการมองปราดเดียวว่าขั้นไหนจดที่ไหน (ต้องรู้จากชื่อขั้น) · จอ TV / รายงานที่อ้าง “ถือว่าผ่าน” ต้องหาที่โชว์ใหม่ · ข้อกำหนดมาตรฐานของขั้นกระดาษไม่มีบนจอเลย (อยู่บนใบสั่งงานที่เดียว)",
  },
  fold: {
    name: "B · พับไว้ — หน้าแรกเห็นเท่า A แต่กดกางได้ทุกอย่าง",
    idea: "ไม่ทิ้งข้อมูล แค่ย้ายไปชั้นสอง",
    summary:
      "รายการขั้นเหมือน A ทุกอย่าง · ฝั่งขวาเอาโซนลงมือขึ้นก่อน (เปิดมาเห็นปุ่มทันที ไม่ต้องเลื่อน) · ใต้ตัวเลขมีแถว “รายละเอียดของขั้นนี้” กดกางค่อยเห็น จดที่ไหน · สถานี · ข้อกำหนด · เวลาเริ่ม/เสร็จ · แถบใบสั่งงานก็มี “ระบบรู้ว่าอยู่ช่วงไหน” กดกางเห็น “ตอนนี้: …” ได้",
    tradeoff:
      "หัวหน้าต้องกดเพิ่ม 1 ครั้งต่อขั้นถ้าอยากเห็นกติกา · ของที่ซ่อนอยู่ = คนใหม่ไม่รู้ว่ามี · ศัพท์ “จดในระบบ / จดบนกระดาษ / อื่นๆ” ยังอยู่แค่ซ่อน ถ้าจะเปลี่ยนเป็นคำโรงงานต้องทำแยกอีกรอบ",
  },
};

const NOTES = [
  "ใบตัวอย่างชุดเดียวกับหน้าลองกระดาษเป็นหลัก (ORD-2608-0061 · 7 ขั้น) แต่ให้ QC/แพ็กเป็นขั้น “อื่นๆ” เหมือนฐานทดลองที่เบสเปิดดู 6 ก.ย. — ป้าย “อื่นๆ” คือค่าสำรองตอนระบบหาสถานีไม่เจอ ไม่ใช่ดีไซน์ · ของจริงแก้แล้ววันนี้: หาสถานีไม่เจอ = ไม่โชว์ป้าย",
  "บรรทัด “ตอนนี้: หลัง X → ก่อน Y” ของจริงคำนวณจากขั้นที่จดในระบบเท่านั้น — กับใบนี้จึงออกมาเป็น “หลังพิมพ์ฟิล์ม DTF → ก่อนเตรียมเสื้อ” ทั้งที่รีดไปครึ่งล็อตแล้ว · นี่คือเหตุผลที่ A ตัดทิ้ง B พับไว้ (รายการขั้นบอกอยู่แล้วว่าถึงไหน)",
  "ปุ่ม “มองเป็นช่าง”: ช่างที่ล็อกอินบัญชีตัวเองจะถูกพาไปหน้างาน /production/floor ไม่เห็นหน้านี้เลย — ที่ทีมเห็นหน้านี้เพราะใช้บัญชีเบส/หัวหน้าร่วมกัน · หน้าลองนี้จึงเทียบสายตาหัวหน้าเป็นหลัก แต่มีสวิตช์ให้ดูว่าช่างจะเห็นอะไรถ้ายังใช้บัญชีร่วม (ไม่มีปุ่มพิมพ์ · ไม่มีเมนูแก้ให้)",
  "A กับ B ใช้รายการขั้น (ฝั่งซ้าย) แบบเดียวกัน ต่างกันที่ฝั่งขวากับแถบใบสั่งงาน — ถ้าเบสชอบรายการของ A แต่อยากเก็บข้อมูลไว้ให้หัวหน้า = B",
  "โครง D (หัวใบ 4 ช่อง · แท็บ · 2 คอลัมน์) และแท็บอีก 3 แท็บไม่แตะ — เบสบอก “แบบเดิมดีละ” (3 ก.ย.) · เปลี่ยนแค่ชื่อแท็บใน A/B",
  "กดเลือกขั้นฝั่งซ้ายได้ทุกขั้น — ลองกด “พิมพ์ฟิล์ม DTF” (ปิดแล้ว) เทียบ 3 ทางว่าขั้นที่จบไปแล้วกินที่เท่าไร · ลองกด “รีดร้อน” (ทำตามกระดาษ) เทียบว่าจอบอกอะไร",
] as const;

const OUT_OF_SCOPE = [
  "หน้างาน /production/floor ของช่าง — ถ้าทีมบ่นจากจอนั้นด้วย เป็นอีกใบงาน (บอกฉันได้ว่าบ่นตอนเปิดหน้าไหน)",
  "เปลี่ยนคำ “จดในระบบ / จดบนกระดาษ / ถือว่าผ่าน” เป็นคำที่โรงงานใช้จริง — ทำได้ทั้ง A และ B แต่ต้องถามทีมก่อนว่าเรียกว่าอะไร",
  "ปุ่มทุกปุ่มยังไม่ทำอะไร · ข้อมูลตายตัวในไฟล์ ไม่ต่อฐานข้อมูล",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderQuietProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "cut");
  const [out, toggleOut] = useProtoFlag("out", true);
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-order-quiet/view?v=${variant}&out=${out ? "1" : "0"}&boss=${boss ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">ใบผลิตเงียบลง — ทีมผลิตบอก “ใช้ยาก อะไรไม่รู้เต็ม”</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสส่งรูป (6 ก.ย.) หัวหน้าและช่างบ่นทั้งคู่ · คำถามที่ต้องเคาะ —{" "}
          <span className="font-medium text-strong">เปิดใบผลิตมาแล้วควรเห็นอะไรบ้าง: ตัดศัพท์ภายในและของซ้ำทิ้งถาวร หรือพับไว้ให้หัวหน้ากดดู</span>
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
