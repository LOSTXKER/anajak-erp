"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Layers, Moon, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { OPTIONS, Preview, VALUES, type Variant } from "./_preview";

/* กติกา: ปัจจุบันมาก่อน · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี */

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  now: {
    name: "ปัจจุบัน — แบบ E ที่ลงของจริงเมื่อวาน (6 ก.ย.)",
    idea: "โชว์ทุกอย่างที่ระบบรู้ แยกกล่องตามเรื่อง",
    summary:
      "หัวใบ (เลขที่ · สถานะ · เร่งด่วน · ลูกค้า) → ตัวเลข 4 ช่อง (จำนวน · กำหนดส่ง · ผ่านแล้ว · ติดปัญหา) → การ์ดแผนที่ (มีหัว “เส้นทางงาน” ⓘ + ชิปม็อกอัพ + ปุ่มพิมพ์) → แถบเสื้อ → หัวข้อ “ตอนนี้ทำได้ 1 อย่าง” → การ์ดขั้น (ชิป 3 · ทำแล้ว/เริ่ม/เสร็จ · ร้านนอก 3 ช่อง · หมายเหตุ · ข้อกำหนด 3 ข้อ · โซนลงมือ) → กล่อง “ถัดไป” → พับ 3 กล่อง",
    tradeoff:
      "ที่เบสรู้สึกว่าเยอะ: ของเดียวกันโผล่ 2–3 ที่ (30 ตัว ×3 · สถานะขั้นในแผนที่+ชิป+ถัดไป · “ร้านนอก” ในชื่อ+ชิป+คำบรรยาย · ผ่าน/ติดปัญหาในตัวเลขและในแผนที่) · มีช่องที่ไม่มีค่า (“ยังไม่เสร็จ” · ทำแล้ว 0/30 ทั้งที่ของอยู่ที่ร้าน) · ใบนี้เลยนัดรับร้าน 3 วันแล้ว แต่ไม่มีที่ไหนเขียนว่า “เลยนัด” — ชิปวันที่เป็นสีแดงเฉย ๆ",
  },
  cut: {
    name: "A · ตัดของซ้ำ — โครง E เดิม เอาที่โชว์ซ้ำและช่องว่างเปล่าออกให้หมด",
    idea: "เบสเพิ่งเคาะ E เมื่อวาน — อย่ารื้อโครง แค่ให้ทุกอย่างมีที่เดียว",
    summary:
      "ตัวเลข 4 ช่องหาย (จำนวน + กำหนดส่งย้ายขึ้นบรรทัดหัวใบ · ผ่านแล้ว/ติดปัญหา อ่านจากสีในแผนที่) · แผนที่ไม่มีหัว ไม่มี ⓘ (ชิปม็อกอัพไปอยู่ชื่อกล่องพับ) · เสื้อเป็นบรรทัดเดียวไม่มีกล่อง · การ์ดขั้นไม่มีชิปสถานะ/โหมดจด/สถานี · โชว์เฉพาะช่องที่มีค่า (ร้านนอกไม่โชว์ 0/30 · ไม่มี “ยังไม่เสร็จ”) · นัดรับกลับเขียนว่า “เลยนัด 3 วัน” · ข้อกำหนดเหลือข้อที่ยังไม่ทำ (ทั้งชุดอยู่ใน ⓘ) · กล่อง “ถัดไป” หาย (แผนที่บอกอยู่แล้ว) · ปุ่มหลัก “รับของกลับ + ตรวจรับ” โผล่ในโซนลงมือ · **ไม่มีกล่องพับ**: เสื้อและลาย (รูป · ไซซ์ · ตำแหน่ง · ม็อกอัพที่อนุมัติ · ที่มาของเสื้อ) · ข้อมูลใบ · ประวัติต่อขั้น อยู่คอลัมน์ขวาบนคอม จอแคบต่อท้าย",
    tradeoff:
      "หน้ายังเป็นกล่องซ้อนกัน 2–3 ชั้น (แผนที่ · หัวข้อ · การ์ด) — เบาลงแต่โครงไม่เปลี่ยน ถ้าที่เบสไม่ชอบคือ “จังหวะกล่องเยอะ” A จะยังรู้สึกคล้ายเดิม · ใบซับซ้อนยังมีการ์ด 4 ใบ (ติดปัญหา 2 + ทำได้ 2) และคอลัมน์งานแคบลงเพราะแบ่งที่ให้คอลัมน์ขวา การ์ดจึงเรียงลงล่างแทนวางคู่",
  },
  one: {
    name: "B · ใบเดียว — ทั้งหน้าคือการ์ดเดียว แผนที่ทำหน้าที่แท็บ",
    idea: "อะไรที่ต้องอ่านคู่กันให้อยู่ในกรอบเดียว — แผนที่กับขั้นที่กำลังทำเป็นของชิ้นเดียว",
    summary:
      "การ์ดเดียวจากบนลงล่าง: หัวใบ (เลขที่ · ลูกค้า · กำหนดส่ง · จำนวน · พิมพ์) → แผนที่เส้นทาง — ขั้นที่กดสว่างขึ้นเหมือนแท็บ → (ใบที่มีหลายสาย: แถวชิป “ตอนนี้ 4 สาย” กดสลับ) → เนื้อของขั้นที่เลือกต่อลงมาเลย ไม่มีหัวข้อ “ตอนนี้ทำได้” ไม่มีกรอบซ้อน · **คอลัมน์ขวาในการ์ดเดียวกัน** = เสื้อและลาย · ข้อมูลใบ · ประวัติ (ไม่พับ ไม่มีลิงก์กระโดด) · เปิดมาเลือกขั้นที่เร่งสุดให้ (ติดปัญหา → ของอยู่ที่ร้าน → กำลังทำ)",
    tradeoff:
      "เห็นทีละขั้น — ใบซับซ้อนที่มี 4 สายพร้อมกัน ต้องกด 3 ครั้งถึงเห็นครบ (E โชว์ทุกใบพร้อมกัน) · การ์ดใบเดียวกินทั้งจอ บนมือถือเลื่อนยาว (แผนที่ + ขั้น + คอลัมน์ขวาต่อกัน) · แผนที่กับเนื้อขั้นผูกกันด้วยสี ถ้ากดขั้นที่ปิดแล้วเนื้อจะเป็นแค่ “ปิดขั้นแล้ว” บรรทัดเดียว",
  },
  head: {
    name: "C · พาดหัวก่อน — ประโยคเดียวบอกว่างานอยู่ไหน แล้วค่อยมีอย่างอื่น",
    idea: "คนเปิดใบมาถามคำถามเดียว “งานอยู่ไหน ต้องทำอะไร” — ให้หน้าตอบเป็นภาษาคนก่อนโชว์โครงสร้าง",
    summary:
      "บรรทัดบนเป็นพาดหัวตัวใหญ่ที่ระบบเขียนเอง (“ของอยู่ที่โรงปักศรีนครินทร์ — เลยนัด 3 วัน”) + บรรทัดรอง (“ส่งลูกค้าเลยกำหนดแล้ว 1 วัน · ร้านแจ้งเครื่องปักเสีย…”) + ปุ่มใหญ่ปุ่มเดียวข้างใต้ · แผนที่ย่อเป็นแถบเล็ก (ชื่อสั้น ไม่มีคำบรรยาย) · งานที่ทำได้ตอนนี้เป็นรายการแถวละบรรทัด (จุดสถานะ · ชื่อ + คน · ข้อเท็จจริง 1 อย่าง · ป้ายนัด/ยอด · ปุ่มเล็ก) กดชื่อเพื่อเปิดรายละเอียด · คอลัมน์ขวา = เสื้อและลาย · ข้อมูลใบ · ประวัติ (ไม่พับ)",
    tradeoff:
      "พาดหัวต้องมีกติกาเขียนประโยคครบทุกสถานะ (ติดปัญหา / ของอยู่ที่ร้าน / กำลังทำ / รอกัน / ครบ) — สถานะแปลก ๆ อาจได้ประโยคที่อ่านแล้วแหม่ง · แผนที่เล็กลงจนสายขนานเห็นยากกว่า E · ปุ่มในรายการเป็นปุ่มเล็ก ไม่ใช่ปุ่มใหญ่ในโซนลงมือ (จอทัชหน้างานใช้ /production/floor อยู่แล้ว) · หัวใบธรรมดา (เลขที่ · ลูกค้า) ถูกลดเป็นบรรทัดเล็ก",
  },
};

const NOTES = [
  "เบสตอบ (7 ก.ย. ค่ำ) “ไม่ชอบการหุบพับ จัดให้อยู่ในหน้าเดียวกันให้ได้” → A/B/C ไม่มีกล่องพับแล้ว: เสื้อและลาย · ข้อมูลใบ · ประวัติ อยู่คอลัมน์ขวาบนคอม (กรอบกว้าง) และต่อท้ายบนจอแคบ · ข้อกำหนดที่ทำแล้วนับเป็นตัวเลขต่อท้าย ไม่ซ่อนใน ⓘ · เฉพาะ “ปัจจุบัน” ยังพับ 3 กล่องเพราะเป็นของจริงวันนี้",
  "ใบหลักคือ ORD-2609-0009 ในฐานทดลอง (ใบที่เบสเปิดดู 7 ก.ย.) ลอกตัวเลข/ชื่อ/วันที่จากจอจริง — ปุ่ม “ใบซับซ้อน” สลับเป็นโปโล 7 ขั้น 4 สาย ติดปัญหา 2 (ใบเดียวกับที่เคาะ E) ไว้ดูว่าทางที่เบาลงยังรับทางขนานได้ไหม",
  "ของจริงวันนี้เรียกขั้นที่ของอยู่ที่ร้านว่า “กำลังทำ” (เลขน้ำเงินในแผนที่ + ชิป) ทั้งที่โซนลงมือบอก “อยู่ที่ร้านนอก” — A/B/C เปลี่ยนเป็นรถบรรทุกสีส้ม “อยู่ที่ร้าน” ให้ตรงความจริง",
  "ปุ่ม “รับของกลับ + ตรวจรับ” ใน A/B/C ยังไม่มีในของจริง — หน้าร้านนอกถูกถอดออก 2 ก.ย. (รอออกแบบใหม่) ตอนนี้ขั้นร้านนอกในใบผลิตไม่มีปุ่มหลักเลย ถ้าเคาะทางไหนต้องต่อ dialog รับของตอนลงจริง (ถามก่อน)",
  "“กล่องที่เห็นทันที” นับกล่อง/การ์ดที่มีขอบของตัวเองก่อนกดอะไร (ปัจจุบันรวมกล่องพับ 3 กล่อง · A/B/C นับคอลัมน์ขวาเป็น 1) · “ข้อมูลซ้ำ” นับจากใบหลัก: 30 ตัว ×3 · สถานะขั้น ×3 · ร้านนอก ×3 · ผ่าน/ติดปัญหา ×2 = ซ้ำ 8 ที่ · “กดกี่ครั้งเห็นครบทั้งใบ” = ปัจจุบันต้องกางกล่องพับ 3 ครั้ง · B ต้องกดสลับขั้นตามจำนวนสาย",
  "ทั้ง 4 ทางไม่แตะกติกา “ทำได้ตอนนี้” (selectNowSteps) · โซนลงมือ · dialog · สิทธิ์ — ที่ต่างคือการจัดวางล้วน ๆ · ป้ายสถานะออเดอร์ (“กำลังผลิต”) ใน A/B/C ย้ายไปกล่อง “ข้อมูลใบ” เพราะหน้านี้คือใบผลิตอยู่แล้ว",
  "ขนาดจอในหน้าลองอ่านจากความกว้างของกรอบ (ไม่ใช่หน้าต่าง) — กรอบมือถือ 390 ข้างล่างจึงพับจริงโดยไม่ต้องย่อหน้าต่าง · ปุ่ม “เปิดขนาดมือถือ (390)” เปิดหน้าต่างจริงไว้เช็คซ้ำ",
] as const;

const OUT_OF_SCOPE = [
  "โหมดหน้างานของช่าง (/production/floor) — ไม่แตะ · ปุ่ม “มองเป็นช่าง” แค่ซ่อนเมนูแก้ให้/ปุ่มปลดปัญหา",
  "การ์ดเบิกเสื้อ (GarmentPickCard) · ตารางวัตถุดิบ (MaterialUsage) — ของจริงมี หน้าลองย่อเป็นบรรทัด “ที่มาของเสื้อ” ในคอลัมน์ขวา ไม่จำลองทั้งตาราง",
  "แถบเตือนหัวใบ (กระดาษที่สแกนเป็นฉบับเก่า · ขั้นที่จดในระบบครบแล้ว ส่งเข้า QC) — ใบตัวอย่างไม่เข้าเงื่อนไข จึงไม่โผล่ทั้ง 4 ทาง",
  "ทุกปุ่มยังไม่ทำอะไร · ช่องติ๊กข้อกำหนดยังอ่านอย่างเดียวเหมือนของจริง v1",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderLeanProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "cut");
  const [complex, toggleComplex] = useProtoFlag("complex", false);
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-order-lean/view?v=${variant}&complex=${complex ? "1" : "0"}&boss=${boss ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">ใบผลิตเบาลง — เบสบอก “ยังดูเยอะไปอยู่”</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสเปิดใบ ORD-2609-0009 (7 ก.ย.) หลังลงแบบ E ไปเมื่อวาน แล้วบอก “ยังดูเยอะไปอยู่ ช่วยรื้อจัดใหม่ — ไม่ชอบการหุบพับ จัดให้อยู่ในหน้าเดียวกันให้ได้” · คำถามที่ต้องเคาะ —{" "}
          <span className="font-medium text-strong">ทุกอย่างอยู่หน้าเดียวไม่พับเหมือนกันทั้ง 3 ทาง — จะเบาลงด้วยการตัดของซ้ำบนโครงเดิม (A) · รวมทุกอย่างเป็นการ์ดเดียวเห็นทีละขั้น (B) · หรือให้ประโยคเดียวนำก่อนแล้วค่อยเห็นโครง (C)</span>
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant={complex ? "default" : "outline"} size="sm" onClick={toggleComplex}>
              <Layers /> {complex ? "ใบซับซ้อน · 7 ขั้น 4 สาย ติดปัญหา 2" : "ใบนี้ · 4 ขั้น ร้านนอกเลยนัด"}
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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">บนคอม (กว้างเท่าใบผลิตจริง)</p>
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
            <Preview variant={variant} complex={complex} boss={boss} idPrefix="desk" />
          </div>
        </section>

        <section className="mt-8">
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">บนมือถือ (390px)</p>
          <div className="w-full max-w-[390px] overflow-hidden rounded-[2rem] bg-bg p-3 ring-1 ring-inset ring-border">
            <Preview variant={variant} complex={complex} boss={boss} idPrefix="mobile" numbers={false} />
          </div>
        </section>

        <section className="mt-10 card-surface rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
            {OUT_OF_SCOPE.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden="true" className="text-muted">
                  ·
                </span>
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
