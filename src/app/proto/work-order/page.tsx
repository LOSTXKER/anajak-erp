"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, MonitorSmartphone, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { OPTIONS, Preview, VALUES, type Variant } from "./_preview";

/* กติกา: ของเดิมมาก่อน (ถอดไปแล้ว เหลือสรุป) · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี */

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  removed: {
    name: "ที่ถอดไป — ใบผลิต 2 แบบ + หน้าลอง 20 กว่าแบบ",
    idea: "แท็บ 4 แท็บ + แถวข้อความ (legacy) หรือ ERP/MES เต็มรูป (V2)",
    summary: "ของเดิมไม่มีให้เปิดแล้ว — ที่เหลือคือสรุปว่าเคยเป็นอะไร และโจทย์ 2 ข้อที่เบสตั้งใหม่: เห็นภาพรวมการผลิตทั้งหมด + ลงมือได้อย่างมีประสิทธิภาพ มีมาตรฐาน",
    tradeoff: "สิ่งที่ทางใหม่ต้องไม่ทำหาย: เบิกเสื้อผ่านสต๊อกจริง · DTF ผ่านรอบพิมพ์ · QC บันทึกของเสียพร้อมรูป · ร้านนอกมีนัดรับและตรวจรับ · ทุก mutation ผ่านสิทธิ์และกติกาฝั่ง server เดิม",
  },
  tabs: {
    name: "D · แท็บ + 2 คอลัมน์ (ตามที่เบสสั่ง 3 ก.ย.)",
    idea: "แบ่งหน้าเป็นแท็บตามคำถาม แล้วทุกแท็บวางข้อมูล 2 คอลัมน์ — ตาไม่ต้องเลื่อนยาว",
    summary:
      "หัวใบ (ตัวเลข 4 ช่อง + การ์ดปัญหา) อยู่บนสุดทุกแท็บ → แถบแท็บ 4 แท็บ (ขั้นงาน · ทำอะไร · ข้อมูลใบ · ประวัติ · แท็บที่มีของค้างมีจุดแดง) → เนื้อหาแต่ละแท็บ 2 คอลัมน์: ขั้นงาน = รายการขั้นซ้าย (กดเลือก) / ขั้นที่เลือก + โซนลงมือมาตรฐานขวา · ทำอะไร = สินค้า/สี/ไซซ์ ซ้าย / ลาย-ตำแหน่ง + ม็อกอัพ ขวา · ข้อมูลใบ = ออเดอร์/สูตร ซ้าย / เสื้อ-วัตถุดิบ + ร้านนอก + หมายเหตุ ขวา · ประวัติ = เหตุการณ์ ซ้าย / แผนเทียบจริงต่อขั้น ขวา · ใช้แท็บชุดเดียวกับหน้าออเดอร์",
    tradeoff:
      "ภาพรวม “ทั้งใบ” ไม่ได้อยู่ในจอเดียวอีกต่อไป — ต้องกดแท็บถึงเห็นทำอะไร/ประวัติ (หัวใบ 4 ช่องกับการ์ดปัญหาคือสิ่งเดียวที่เห็นทุกแท็บ) · 2 คอลัมน์บนจอทัช 1024 ยังพอดี แต่มือถือยุบเป็นคอลัมน์เดียว · ต้องตัดสินว่าอะไรอยู่แท็บไหนให้ทีมจำได้ (หน้าลองนี้จัดตามคำถาม: ทำอะไร → ถึงไหน → รายละเอียด → ย้อนหลัง)",
  },
  table: {
    name: "A · ตารางขั้นงาน",
    idea: "ใบผลิตคือตารางเดียว — เหมือนหน้าการผลิตที่เบสเพิ่งเคาะ ต่อเนื่องกันทั้งโมดูล",
    summary:
      "หัวใบ = ตัวเลข 4 ช่อง (จำนวน · กำหนดส่ง · ผ่านแล้ว x/y · ติดปัญหา) → ปัญหาที่ค้างเป็นการ์ดแดงทันที → ตารางขั้นงาน 7 คอลัมน์ (ขั้น · สถานะ · ยอด · ผู้รับผิดชอบ · ควรเสร็จ · ร้านนอก) ทุกขั้นหน้าตาเดียวกัน · กดแถวไหน = กางโซนลงมือมาตรฐานของขั้นนั้นใต้แถว (ข้อกำหนดจากสูตร → ติ๊กครบ → ปุ่มหลักปุ่มเดียว) · เปิดมาขั้นที่ต้องทำกางไว้ให้ก่อน · “ทำอะไร” (สินค้า/ไซซ์/ลาย) กับข้อมูลใบอยู่ล่างตาราง",
    tradeoff:
      "ตารางเก่งเรื่อง “เห็นทุกขั้นเท่ากัน” แต่ไม่ได้บอกเสียงดังว่า “ตอนนี้ต้องทำขั้นไหน” — ต้องอาศัยแถวที่กางอยู่กับสีชิป · โซนลงมือกางในตารางทำให้ตารางสูงขึ้น-ลง ตาต้องหาที่ใหม่ทุกครั้งที่สลับขั้น · บนจอทัชแถวตารางเป้ากดเล็กกว่าการ์ด",
  },
  focus: {
    name: "B · ตอนนี้ทำอะไร",
    idea: "ช่างมาถึงใบนี้เพื่อทำขั้นถัดไป ไม่ใช่มาอ่าน — ขั้นปัจจุบันเป็นผืนใหญ่ ภาพรวมอยู่ข้าง ๆ",
    summary:
      "หัวใบเหมือน A → ซ้ายคือ “ขั้นที่ต้องทำตอนนี้” ผืนใหญ่: ชื่อขั้น สถานะ ตัวเลขทำแล้ว/ทั้งหมด ร้านนอก(ถ้ามี) ปัญหา(ถ้ามี) ข้อกำหนดมาตรฐาน ปุ่มหลักปุ่มเดียว → ใต้ลงมาคือ “ทำอะไร” แบบย่อ · ขวาคือรายการขั้นทั้งหมดแบบสั้น (จุดสี + ชื่อ + ยอด) กดสลับขั้นที่จะทำได้ + ข้อมูลใบ · โซนลงมืออยู่ที่เดียวเสมอ ไม่ย้ายที่",
    tradeoff:
      "ภาพรวมถูกย่อไปอยู่คอลัมน์ขวา — หัวหน้าที่อยากกวาดตาทั้ง 7 ขั้นพร้อมรายละเอียด (ใครทำ ถึงไหน ควรเสร็จเมื่อไร) ต้องกดทีละขั้น · ใบที่มีปัญหาหลายขั้นพร้อมกัน เห็นทีละอัน · บนมือถือคอลัมน์ขวาตกไปอยู่ล่าง ต้องเลื่อนไกลถึงจะเห็นขั้นอื่น",
  },
  timeline: {
    name: "C · ไทม์ไลน์",
    idea: "“มาตรฐาน” = ทุกการลงมือถูกบันทึกเป็นเหตุการณ์ — ใบผลิตคือเรื่องเล่าตามเวลา ผ่านมาแล้ว → ตอนนี้ → ถัดไป",
    summary:
      "หัวใบเหมือน A → เส้นเวลาแนวตั้ง แต่ละขั้นเป็นการ์ดมีวันแผนคู่วันจริง (เห็นทันทีว่าช้ากว่าแผนไหม) · ขั้นที่ผ่านแล้วมีติ๊กเขียว ขั้นปัจจุบันกางโซนลงมือมาตรฐาน ขั้นถัดไปพับ · คอลัมน์ขวา = ทำอะไร · ข้อมูลใบ · **ประวัติการลงมือทุกครั้ง** (ใครทำอะไรเมื่อไร) ซึ่ง A/B ไม่มี",
    tradeoff:
      "หน้ายาวที่สุด (7 การ์ด + ประวัติ) · การ์ดที่พับอยู่บอกได้น้อยกว่าแถวตาราง (ไม่มีคอลัมน์ให้ไล่ตา) · แผน-จริงต่อขั้นต้องเพิ่มข้อมูล “วันแผนต่อขั้น” ในของจริง (ตอนนี้ยังไม่มี — หน้าลองคำนวณถอยจากกำหนดส่ง) · ประวัติต้องดึง audit log มาแสดง ซึ่งของจริงมีแต่ยังไม่เคยเอาขึ้นจอ",
  },
};

const NOTES = [
  "ใบตัวอย่างใบเดียวกันทั้ง 3 ทาง: โปโล 240 ตัว 3 สี 5 ไซซ์ · DTF ทำเอง + ปักแขนร้านนอก (เดินขนาน) + ป้ายคอร้านนอก · มีขั้นผ่านแล้ว/กำลังทำ/รอของกลับ/ติดปัญหา 2 จุด (เสื้อขาดไซซ์ L · ป้ายคอเลยนัดรับ)/ยังไม่ถึง ครบทุกสถานะที่ใบจริงเจอ",
  "“ลงมืออย่างมีมาตรฐาน” ในทุกทาง = โซนลงมือหน้าตาเดียวกันทุกขั้น: ข้อกำหนดของขั้น (จากสูตรขั้นงานที่ตั้งค่าได้) ต้องติ๊กครบ → ปุ่มหลักปุ่มเดียว (เบิก / เปิดรอบพิมพ์ / บันทึกยอด / ตรวจรับ / บันทึกผลตรวจ / แพ็ก) → ปุ่มรอง “แจ้งปัญหา” · ขั้นที่ติด/รอของ ปุ่มหลักล็อกและบอกเหตุ",
  "ตัวเลขใหญ่ · ป้ายกำหนดส่ง · ชิปสถานะ · ช่องข้อเท็จจริง · โซนลงมือ = ชิ้นส่วนชุดใหม่ (Metric / DueTag / InfoChip / Fact / ActionZone) ตามกฎ 3 ชั้น — ไม่มีบรรทัดไหนต่อข้อมูล 3 อย่างด้วยจุด",
  "สวิตช์ “จอทัช” เปลี่ยนเป็นธีมมืด + ปุ่มลงมือเต็มแถว (ช่างใช้ที่หน้าเครื่อง) · ทั้ง 3 ทางเป็นหน้าเดียวกันสำหรับหัวหน้าและช่าง ต่างกันแค่สิทธิ์ว่าปุ่มไหนกดได้",
  "ไม่เอาของที่เบสสั่งลบกลับมา: ไม่มีผังสายพานเป็นพระเอก · ไม่มีจอสถานีแยก · แท็บในทาง D เป็นแท็บชุดเดียวกับหน้าออเดอร์ (ไม่ใช่ 4 แท็บแบบใบเดิมที่ซ่อนขั้นงานไว้ในแท็บ)",
] as const;

const OUT_OF_SCOPE = [
  "ปุ่มทุกปุ่มยังไม่ทำอะไร (เบิก · เปิดรอบพิมพ์ · บันทึกยอด · ตรวจรับ · แจ้งปัญหา · มอบหมาย) — ที่เทียบคือ “เปิดมาเห็นอะไร ลงมือจากไหน” · ข้างในของแต่ละปุ่ม (dialog เบิกสต๊อก / รอบพิมพ์ / QC ของเสีย) ค่อยออกแบบหลังเคาะโครง",
  "ข้อกำหนดมาตรฐานต่อขั้นในหน้าลองเป็นตัวอย่าง — ของจริงต้องเพิ่มช่อง “checklist” ในสูตรขั้นงาน (/settings/routings) แล้วสำเนาลงใบตอนเปิด",
  "แท็บเบิกของ/วัตถุดิบ (MaterialUsage) กับม็อกอัพหลายเวอร์ชันของใบเดิม ยังไม่ได้วาง — ถ้าเบสต้องการให้อยู่ในหน้านี้ บอกได้",
  "รูปม็อกอัพเป็นไฟล์ตัวอย่างของ repo (/demo-mockups)",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "tabs");
  const [touch, toggleTouch] = useProtoFlag("touch");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-order/view?v=${variant}&touch=${touch ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">ใบผลิตใหม่ — เห็นภาพรวมทั้งใบ และลงมือได้อย่างมีมาตรฐาน</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          โจทย์จากเบส (2 ก.ย.): “ต้องเห็นภาพรวมการผลิตออเดอร์นี้ทั้งหมด และทำงานการผลิตได้อย่างมีประสิทธิภาพ มีมาตรฐาน” ·
          ทาง D ทำตามที่เบสสั่งเพิ่ม 3 ก.ย. (“แบ่งเป็นแท็บ · ข้อมูล 2 คอลัมน์”) · A/B/C เก็บไว้เทียบว่าอะไรควรนำสายตา — ตารางทุกขั้นเท่ากัน / ขั้นที่ต้องทำตอนนี้ / เส้นเวลา
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant={touch ? "default" : "outline"} size="sm" onClick={toggleTouch}>
              <MonitorSmartphone /> {touch ? "กำลังดูแบบจอทัช" : "จอทัชหน้าเครื่อง"}
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
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">{touch ? "จอทัชหน้าเครื่อง (ธีมมืด)" : "บนคอม"}</p>
            <span className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => window.open(src, "proto-touch", "width=1024,height=768,noopener")} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดขนาดจอทัช (1024×768) <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => window.open(src, "proto-mobile", "width=390,height=820,noopener")} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดขนาดมือถือ (390)
              </button>
              <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดเต็มหน้าจอ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className={cn("overflow-hidden rounded-2xl px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8", touch ? "dark bg-bg text-strong" : "bg-bg")}>
            <Preview variant={variant} touch={touch} />
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
