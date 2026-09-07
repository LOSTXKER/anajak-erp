"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Layers, Link2, Moon, Smartphone, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { OPTIONS, VALUES, type Variant } from "./_engine";
import { Preview } from "./_preview";

/* กติกา: ปัจจุบันมาก่อน · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี */

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  now: {
    name: "ปัจจุบัน — แผนที่เส้นทาง + “ตอนนี้ทำอะไร” (แบบ E ที่เคาะ 6 ก.ย.)",
    idea: "จอบอกว่าตอนนี้ทำอะไรได้บ้าง งานที่เดินพร้อมกันเห็นเป็นคนละแถว",
    summary: "หัวใบตัวเลข 4 ช่อง → แผนที่เส้นทาง → การ์ด “ตอนนี้ทำได้” สายละใบ → ถัดไป → ลาย/ข้อมูลใบ/ประวัติ พับไว้ท้าย · ปุ่มลงมืออยู่ในการ์ดของแต่ละงาน",
    tradeoff: "เบสเปิดใบ ORD-2609-0009 แล้วบอก “ยังดูเยอะ” · ไม่มีปุ่มขั้นต่อไปที่เดียวบนหัวใบ · หน้าตาคนละแบบกับหน้าออเดอร์ ทีมต้องเรียนรู้ 2 แบบ",
  },
  seq: {
    name: "A · ทีละขั้นตามเลข — รางนับทุกขั้นเป็นช่อง 1 2 3 (เบสเคาะ 8 ก.ย.) + ช่องคู่ให้ดู",
    idea: "ใบผลิตเดินเหมือนออเดอร์: ยืนอยู่ช่องเดียว กดปุ่มบนถึงไปช่องถัดไป",
    summary: "รอบ 2 (เบสสั่ง 8 ก.ย. หลังเคาะ A): หัวใบเหมือนหน้าออเดอร์ (เลขที่ · ป้าย · ใบสั่งงาน · ปุ่มขั้นต่อไป · เมนู ⋯) → ราง 1 2 3 → ซ้าย = แท็บ ลายและเสื้อ (แท็บแรก) / ข้อมูลใบ / ประวัติ · ขวา = เช็คลิสต์ของขั้นที่ยืนอยู่ ติ๊กได้จริง + รายการทุกขั้นแบบย่อ · ปุ่มบนกดได้เมื่อติ๊กครบ · แท็บขั้นงานและตารางเดิมถอดออก · ย้อนกลับอยู่ในเมนู ⋯",
    tradeoff: "งานที่เดินพร้อมกันถูกบังคับให้เรียงเป็นแถวเดียว — ปิด “ช่องคู่” แล้วดูใบ 7 ขั้น: รางยืนที่พิมพ์ฟิล์ม (ช่อง 2) ส่วนปักแขนที่อยู่ร้านจริงขึ้นว่า “ยังไม่ถึง” · เปิดช่องคู่ = ฟิล์ม + ปักแขน รวมเป็นช่อง 2 ช่องเดียว ปุ่มบนคือขั้นที่กดได้ก่อน อีกขั้นมีปุ่มเล็กในฟอร์ม ครบทั้งคู่รางเลื่อนเอง · ทุกขั้นต้องกดปิดในระบบ รวมขั้นที่เบสเคาะไว้ (5 ก.ย.) ว่าจดบนกระดาษ",
  },
  gate: {
    name: "B · ราง = ด่าน — ขั้นที่ทำพร้อมกันรวมเป็นช่องเดียว ปุ่มบนคือ “ปิดด่าน”",
    idea: "รางนับ “ด่าน” ไม่ใช่ “ขั้น” — ด่านแรกคืองานเตรียมที่เดินพร้อมกันได้ทั้งหมด",
    summary: "หัวใบ/แท็บเหมือน A · ราง = เตรียมงาน (เสื้อ · ฟิล์ม · ร้านนอก ทำพร้อมกัน) → รีดร้อน → QC → แพ็ก · ในด่านที่มีหลายงาน แต่ละงานมีปุ่มเล็กของตัวเองในฟอร์ม · ปุ่มบนหัวใบ “ปิดด่าน → ช่องถัดไป” กดได้เมื่อครบทุกงาน",
    tradeoff: "ปุ่มบนหัวใบไม่ได้กดทุกครั้ง — ตอนอยู่ด่านเตรียมงานต้องกดปุ่มเล็กในฟอร์มแทน (มี 2 ที่ให้กด) · ใบ 7 ขั้นเหลือราง 4 ช่อง ตัวเลขช่องไม่ตรงกับเลขขั้นบนใบสั่งงานกระดาษ",
  },
  record: {
    name: "C · ราง = เฉพาะจุดที่ระบบจด — ตามกติกากระดาษเป็นหลักที่เบสเคาะ 5 ก.ย.",
    idea: "รางโชว์เฉพาะที่ต้องแตะจอจริง (เบิก/รับเสื้อ · ร้านนอก · ส่งเข้า QC) ที่เหลืออยู่บนกระดาษ",
    summary: "หัวใบ/แท็บเหมือน A · ราง = เบิกเสื้อ → ปักแขน (ร้าน) → ป้ายคอ (ร้าน) → ส่งเข้า QC · ขั้นกระดาษ (รีดร้อน · QC · แพ็ก) รวมอยู่ในช่องสุดท้าย ไม่มีปุ่ม — ปุ่มบน “ส่งเข้า QC” ถือว่าผ่านให้ทีเดียว · กดน้อยสุด (ใบ 7 ขั้นกด 5 ครั้ง)",
    tradeoff: "รางไม่มีรีดร้อน/พิมพ์ฟิล์ม — เปิดใบมาไม่รู้ว่างานในโรงอยู่ตรงไหน ต้องดูกระดาษ · ราง C กับราง A/B ต่างจากใบสั่งงานกระดาษคนละแบบ · ต้องโชว์คำว่า “จดในระบบ/จดบนกระดาษ” ที่ทีมเคยทักว่าไม่รู้เรื่อง",
  },
};

const NOTES = [
  "รอบ 5 (8 ก.ย. ดึก): เบส “แยกแถบขั้นตอนกับเสื้อดีกว่า” → กลับเป็นแท็บ: ลายและเสื้อ (แท็บแรก) · ขั้นตอน (เช็คลิสต์ซ้าย + ทุกขั้นขวา · จุดแดงเมื่อยังติ๊กไม่ครบ) · ข้อมูลใบ · ประวัติ · ใต้รางบอกว่าต้องไปติ๊กที่แท็บขั้นตอนอีกกี่ข้อ · ถ้าอยากให้ขั้นตอนเป็นแท็บแรกแทน บอกคำเดียว",
  "รอบ 4: แท็บลายและเสื้อ = OrderItemsDisplay ตัวจริงของหน้าออเดอร์ (ไม่โชว์เงิน ไม่มีปุ่มแก้ไข) — เบสชี้รูปแท็บรายการว่า “ใช้แบบหน้านี้เลย”",
  "รอบ 2 (8 ก.ย. ค่ำ): เบสสั่ง “ลายและเสื้อมาแท็บแรก · ขั้นงานอยู่หน้าเดียวกันฝั่งขวาเป็นเช็คลิสต์ · ต้องติ๊กให้ครบถึงจะไปขั้นถัดไปได้ โดยกด CTA ข้างบนเป็นหลัก” — ทำตามนั้นทุกทาง (B/C เก็บไว้เทียบ) · ปุ่มบนโชว์ตลอดแต่กดไม่ได้จนกว่าจะติ๊กครบ (ต่างจากกติกา DESIGN ที่ห้ามวางปุ่มกดไม่ได้ — ลงจริงต้องเคาะว่าจะซ่อนหรือโชว์จาง) · ขั้นที่ไม่ได้ “ปิด” (เริ่มทำ · ส่งร้าน · เปิดรอบพิมพ์) ไม่ต้องติ๊กก่อน",
  "ของจริง: ติ๊กเช็คลิสต์ยังไม่บันทึกลงฐาน (หนี้เดิม ROADMAP §A — ต้องเพิ่ม schema ผลติ๊กต่อขั้น ⚠️ ถามก่อน) · หน้าลองนี้จำลองให้ติ๊กได้เพื่อให้เห็นจังหวะกด",
  "ช่องคู่ (เบสขอดู 8 ก.ย.): ตั้งในสูตรขั้นงานว่าขั้นนี้ “เดินคู่กับขั้นก่อน” → รางรวมสองขั้นเป็นช่องเดียว ตัวเลขช่องเดียว · ไม่มีปุ่ม “ปิดด่าน” เพิ่ม (ต่างจาก B) · มีเฉพาะจุดที่ตั้งไว้ ที่เหลือยังเป็นรางเส้นเดียว · ใบ 4 ขั้นไม่มีคู่ ปุ่มนี้จึงไม่มีผล · ของจริงต้องเพิ่มช่องตั้งค่าในสูตร (schema เล็ก ๆ ⚠️ ถามก่อน)",
  "ลองกดปุ่มขั้นต่อไปบนหัวใบได้เลย ขั้นจะเดินจริงในหน้า (ไม่บันทึกฐาน) · ย้อนกลับอยู่ในเมนู ⋯ ข้างปุ่ม — รีเฟรชหน้า = กลับสภาพเริ่มต้น",
  "ราง 1 2 3 · หัวใบ · แท็บ · การ์ด = ชิ้นส่วนตัวจริงของหน้าออเดอร์ (import มาไม่ได้วาดใหม่) — ที่เขียนใหม่คือฟอร์มของช่องที่ยืนอยู่และตารางทุกขั้น",
  "ย้อนกลับ: ของจริงตอนนี้ server ไม่รับ (ขั้นที่ปิดแล้วแก้ไม่ได้ — production.updateStep) · ต้องเพิ่มคำสั่ง “เปิดขั้นใหม่” ที่จดว่าใครย้อนเมื่อไหร่ · เป็นงาน server ที่ต้องขอเบสก่อนแยกต่างหาก ไม่ว่าเคาะทางไหน",
  "ปุ่มบนหัวใบมาจากกติกาเดิม (เริ่มทำ / ปิดขั้น / ส่งร้านนอก / รับกลับ / เบิกเสื้อ / บันทึกตรวจรับ / ส่งเข้า QC / จัดการปัญหา) — ไม่มีทางลัดสถานะใหม่ · ปุ่มที่กดไม่ได้จะไม่โผล่ ประโยคใต้รางบอกแทนว่าติดอะไร",
  "ปุ่ม “มองเป็นช่าง”: ไม่มีย้อนกลับ ไม่มีมอบหมาย/พักงาน ขั้นติดปัญหาไม่มีปุ่ม (รอหัวหน้า) — ของจริงช่างจะถูกพาไป /production/floor อยู่แล้ว กรอบนี้แค่ให้เห็นว่าโครงเดียวกันรับสิทธิ์ช่างได้",
  "ใบ 7 ขั้นคือเคสที่ทำให้ 3 ทางต่างกันจริง (ทำเอง DTF + ร้านนอก 2 ขั้น เดินพร้อมกัน + ขั้นกระดาษ) · ใบ 4 ขั้นคือใบที่เบสเปิดดูจริง 3 ทางแทบเหมือนกัน",
] as const;

const OUT_OF_SCOPE = [
  "กดขั้นอื่นในรายการย่อฝั่งขวาเพื่อดู/แก้ขั้นที่ไม่ใช่ช่องที่ยืนอยู่ — ยังไม่ทำ (รางอ่านอย่างเดียวตามกติกาหน้าออเดอร์ · ถ้าต้องการค่อยเพิ่ม)",
  "ยอด “ทำแล้ว x/y ตัว” ยังกรอกในหน้าลองไม่ได้ — ของจริงใช้แผ่นกรอกยอดเดิม (StepQtySheet) ตอนกดปิดขั้น",
  "หน้างานของช่าง /production/floor ไม่อยู่ในหน้าลองนี้",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderFormProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "seq");
  const [case7, toggleCase] = useProtoFlag("big", false);
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const [pair, togglePair] = useProtoFlag("pair", true);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const query = `v=${variant}&big=${case7 ? "1" : "0"}&boss=${boss ? "1" : "0"}&pair=${pair ? "1" : "0"}`;
  const src = `/proto/work-order-form/view?${query}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">ใบผลิตแบบฟอร์ม — แถบสถานะ + ปุ่มขั้นต่อไป เหมือนหน้าออเดอร์</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสสั่ง (8 ก.ย.): ใบผลิตให้มีฟอร์มคล้ายหน้าออเดอร์ แถบสถานะบน ปุ่มขั้นต่อไปบน ต้องกดถึงไปขั้นถัดไป ย้อนได้ · คำถามที่ต้องเคาะ:{" "}
          <span className="font-medium text-strong">รางจะนับ “ขั้น” ยังไง ในเมื่อบางขั้นทำพร้อมกันได้ และบางขั้นเบสเคาะไว้ว่าจดบนกระดาษ</span>
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant={case7 ? "default" : "outline"} size="sm" onClick={toggleCase}>
              <Layers /> {case7 ? "ใบ 7 ขั้น (DTF + ร้านนอก 2 ขั้น)" : "ใบ 4 ขั้น (ORD-2609-0009)"}
            </Button>
            <Button variant={boss ? "default" : "outline"} size="sm" onClick={toggleBoss}>
              <UserRound /> {boss ? "มองเป็นหัวหน้า" : "มองเป็นช่าง"}
            </Button>
            {variant === "seq" ? (
              <Button variant={pair ? "default" : "outline"} size="sm" onClick={togglePair}>
                <Link2 /> {pair ? "ช่องคู่: เปิด" : "ช่องคู่: ปิด"}
              </Button>
            ) : null}
          </div>
          <Button variant="outline" size="icon-sm" aria-label={isDark ? "ดูแบบโหมดสว่าง" : "ดูแบบโหมดมืด"} onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Moon /> : <Sun />}
          </Button>
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
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
            {/* เว็บตั้ง X-Frame-Options: DENY จึงฝังกรอบมือถือข้างกันไม่ได้ — เปิดเป็นหน้าต่างเล็ก 390 แทน (แบบเดียวกับหน้าลองชุดก่อน) */}
            {variant !== "now" ? (
              <>
                <button type="button" onClick={() => window.open(src, "proto-mobile", "width=390,height=820,noopener")} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> เปิดขนาดมือถือ (390)
                </button>
                <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                  เปิดเต็มหน้าจอ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8">
            <Preview variant={variant} case7={case7} boss={boss} />
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
