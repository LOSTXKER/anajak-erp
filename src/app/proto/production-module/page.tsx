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

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: ของเดิมมาก่อน (ถอดไปแล้ว จึงเหลือสรุป) · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี

const COPY: Record<
  Variant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  removed: {
    name: "ที่ถอดไป — 6 หน้า 3 ทางเข้า",
    idea: "แยกตามคนใช้: หัวหน้ามีหน้า ช่างมีจอ ทีวีมีกระดาน",
    summary:
      "ของเดิมไม่มีให้เปิดแล้ว (ถอดออกจากเว็บจริง 2 ก.ย.) — ที่เหลือคือสรุปว่าเคยมีอะไรและอะไรที่ทำให้ต้องรื้อ ใช้เป็นตัวตั้งเทียบว่าทางใหม่แก้ตรงนั้นได้จริงไหม",
    tradeoff:
      "สิ่งที่ของเดิมทำได้ดีและทางใหม่ต้องไม่ทำหาย: ตัวกรองขั้นงานแบบสายพานที่เบสเคาะไว้ · คอลัมน์เส้นทางงานแบ่งช่วงสี · จอสถานีที่มีปุ่มลงมือปุ่มเดียวและไม่มีเงิน",
  },
  desk: {
    name: "A · โต๊ะงานหัวหน้า",
    idea: "หน้าเดียว — ตัวเลขใหญ่ 4 ช่องคือตัวกรอง แล้วรายการเรียงตาม “ต้องทำอะไรต่อ”",
    summary:
      "เปิดมาเห็น 4 ตัวเลขทันที: เลยกำหนด · ติดปัญหา · ของร้านนอกครบกำหนด · พร้อมส่ง — กดตัวเลขไหน รายการข้างล่างเหลือแค่กองนั้น · รายการไม่เรียงตามสถานะออเดอร์ แต่จัดเป็น “กอง” ตามความรีบ (ติดปัญหา → ของร้านนอกครบกำหนด → ลงมือได้ → รอของกลับ → พร้อมส่ง) ตารางแยกตอนนี้อยู่ที่ ผู้รับผิดชอบ และร้านนอกเป็นคนละคอลัมน์ · ไม่มีปุ่มท้ายแถว ใช้ hover กับลูกศรเพื่อสื่อว่าทั้งแถวจะกดเปิดดูใบผลิต · รอบพิมพ์ คลังฟิล์ม คิวร้านนอก ไม่มีหน้าแยกอีก — เป็นกองบนโต๊ะเดียวกัน · โหมดหน้างาน = โต๊ะเดียวกันย่อเหลือสถานีของฉัน การ์ดใหญ่ ปุ่มสูง 56px",
    tradeoff:
      "ไม่เห็นภาพโรงงานทั้งสาย (สถานีไหนงานกอง) — ต้องอ่านจากชิปตัวเลขเล็ก ๆ ใต้ตัวเลขใหญ่ · หน้ายาวเมื่องานล้น (ลองกด “งานล้น”) เพราะทุกกองอยู่หน้าเดียว · รอบพิมพ์ DTF ที่เคยเป็น workspace ของตัวเอง ต้องยุบเป็น dialog จากปุ่ม “เปิดรอบพิมพ์” — คนที่คุ้นหน้ารอบพิมพ์เดิมจะเสียที่ยืน",
  },
  flow: {
    name: "B · สายพาน",
    idea: "หน้าแรกคือผังการผลิตเอง — สถานีเรียงซ้ายไปขวา ร้านนอกเป็นอีกแถว กดสถานีไหนเห็นคิวนั้น",
    summary:
      "แถวบนคือ 5 สถานีในโรงงาน แต่ละช่องมีตัวเลขใหญ่ + เลยกำหนด/ติดกี่ใบ · แถวล่างคือร้านนอกแยกตามร้าน บอกว่ามีกี่งาน กลับเร็วสุดวันไหน เลยนัดรับหรือยัง (กรอบแดง) · กดช่องไหน คิวข้างล่างเปลี่ยนเป็นของช่องนั้น พร้อมปุ่มของสถานีนั้นปุ่มเดียว · “จอสถานี” ไม่ใช่แอปแยกอีกต่อไป — เป็นหน้านี้ที่เปิดค้างไว้ที่ช่องเดียว ช่องใหญ่ขึ้น การ์ดใหญ่ขึ้น (กด “โหมดหน้างาน”) หัวหน้ากับช่างจึงเห็นภาพเดียวกัน",
    tradeoff:
      "ต้องกดสองครั้งกว่าจะเห็นใบ (เลือกสถานีก่อน) — ไม่มี “ทั้งหมด” ให้กวาดตาทีเดียว · ใบที่เดินสองสายพร้อมกัน (DTF ในโรงงาน + ปักที่ร้าน) โผล่สองช่อง ต้องยอมให้นับซ้ำ · สายพานยาวเกินจอมือถือ ต้องเลื่อนซ้าย-ขวา (จอทัชโรงงาน 1024 พอดี คอมพอดี) · ร้านนอกแยกตามร้านดีตอนมี 2–4 ร้าน ถ้าร้านเยอะแถวล่างจะยาว",
  },
  schedule: {
    name: "C · ตารางเวลา",
    idea: "คำถามของหัวหน้าคือ “ทันไหม” — วางทุกใบบนแกนวัน ไม่ใช่บนสถานะ",
    summary:
      "ซ้ายคือใบงาน ขวาคือ 10 วัน (2 วันที่ผ่านมาถึงอีก 7 วัน) · แต่ละขั้นเป็นแท่งสีตามสถานะ (เขียวผ่าน · ส้มกำลังทำ · แดงติด · เทารอ) วางตามวันที่ควรเสร็จ · ของที่ส่งร้านนอกเป็นแท่งลายเฉียงมีรถ + วันกลับ เลยนัดรับ = กรอบแดง · เส้นน้ำเงิน = วันนี้ · เส้นแดง = กำหนดส่ง — ใบไหนแท่งยังไม่ถึงเส้นแดงแต่วันนี้เลยไปแล้ว = ไม่ทัน เห็นโดยไม่ต้องอ่านเลข · ชิปกรองขั้นงานยังอยู่ (สูตรสายพานเดิม) · โหมดหน้างานเหมือน A/B แต่การ์ดเรียงตาม “วันที่ต้องเสร็จขั้นนี้”",
    tradeoff:
      "ข้อแลกใหญ่สุด: ของจริง **ยังไม่มีวันแผนต่อขั้น** — หน้าลองคำนวณถอยหลังจากกำหนดส่ง (แพ็กวันสุดท้าย QC ก่อน 1 วัน…) ถ้าเอาแบบนี้ต้องเพิ่มข้อมูลแผนต่อขั้น (สูตรมาตรฐานเป็นตัวตั้ง แก้รายใบได้) · แท่งเล็กอ่านยากบนมือถือ ต้องเลื่อนแนวนอน · เห็นภาพรวมดีแต่ “กดลงมือ” ไม่มีปุ่มในแถว ต้องเปิดใบหรือสลับโหมดหน้างาน",
  },
};

/** ข้อเท็จจริงที่ทั้งสามทางยึดร่วมกัน */
const NOTES = [
  "ทั้งสามทางใช้ใบตัวอย่างชุดเดียวกัน — เฉพาะที่เปิดใบผลิตแล้ว 7 ใบ (กด “งานล้น” = 15 ใบ) + รอเปิดใบผลิต 2 ใบ · รวมเคสขอบครบ: เลยกำหนด · ด่วน · ไม่กำหนดส่ง · ติดปัญหาเสื้อไม่พอ · QC ไม่ผ่าน · blind ship · ยังไม่มีม็อกอัพ · ชื่อบริษัทยาว",
  "ร้านนอกมี 4 ร้านในตัวอย่าง: ปัก (เลยนัดรับ 1 วัน) · ตัดเย็บ (กลับ 4 ก.ย.) · สกรีน (กลับ 2 ก.ย.) · ป้ายคอ (เลยนัดรับ 3 วัน) และมี 1 ใบที่ DTF เดินในโรงงานพร้อมกับปักที่ร้าน — ตามที่เบสเคาะ 2026-09-01 ว่าเดินขนานได้",
  "ทุกทางมี “โหมดหน้างาน” ปุ่มเดียวกัน (สวิตช์ข้างบน) — จอทัชโรงงาน 1024×768 ธีมมืด ปุ่มลงมือสูง 56px หนึ่งใบหนึ่งปุ่ม ไม่มีเงินโดยโครงสร้าง · ใบที่ติดปัญหา/รอของกลับ ปุ่มหลักถูกล็อกและบอกเหตุ",
  "รูปย่อ · ป้าย · ปุ่ม · ชิปกรอง · หัวหน้า · สถานะว่าง = component ตัวจริงของระบบ · สิ่งที่เขียนใหม่มีแค่ “แถบเส้นทางงาน” “ตัวเลขใหญ่/ช่องสถานี” และ “การ์ดจอทัช” ซึ่งเป็นของที่กำลังเทียบ",
  "สีสถานะขั้นงาน (เขียว/ส้ม/แดง/เทา) ใช้สูตรเดียวกับคอลัมน์ “เส้นทางงาน” แบบ C ที่เบสเคาะ 2026-09-02 ไม่ได้คิดสีใหม่",
] as const;

const OUT_OF_SCOPE = [
  "หน้าใบผลิต /production/[id] ยังไม่ได้ออกแบบใหม่ (ROADMAP §A) — hover กับลูกศรใน A แสดงรูปแบบการกดดูเท่านั้น หน้าลองจึงยังไม่พา ID ตัวอย่างไปหาใบจริง · รูปร่างของหน้าใบควรตามทางที่เลือกจากหน้านี้ก่อน",
  "ปุ่มลงมือทุกปุ่มกดแล้วยังไม่ทำอะไร (เปิดรอบพิมพ์ · เริ่มรีด · รับของกลับ · แจ้งปัญหา) — สิ่งที่เทียบคือ “เปิดมาเห็นอะไร กดจากไหน” ไม่ใช่ตัว dialog",
  "รอบพิมพ์ DTF / คลังฟิล์ม ในทุกทางถูกยุบเป็นปุ่ม “เปิดรอบพิมพ์” ที่สถานีพิมพ์ — ยังไม่ได้วาดข้างในของรอบพิมพ์ ถ้าเบสเห็นว่ารอบพิมพ์ต้องมีหน้าของตัวเอง บอกได้",
  "การสแกน QR เพื่อเปิดบริบท (จอสถานีเดิมมี) ยังไม่ได้ใส่ — ใส่ได้ทุกทางเป็นปุ่มเดียว ไม่ใช่สิ่งที่ทำให้ทางต่างกัน",
  "รูปม็อกอัพเป็นไฟล์ตัวอย่างของ repo (/demo-mockups) — ของจริงเป็นรูปที่กราฟิกอัปโหลด สัดส่วนไม่เท่ากันทุกใบ",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function ProductionModuleProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "desk");
  const [busy, toggleBusy] = useProtoFlag("busy");
  const [station, toggleStation] = useProtoFlag("station");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  const src =
    `/proto/production-module/view?v=${variant}` +
    `&busy=${busy ? "1" : "0"}` +
    `&station=${station ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          โมดูลผลิตใหม่ — เปิดมา 3 วินาทีแรกควรเห็นอะไร และช่างลงมือจากหน้าไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          ของเดิม 6 หน้า 3 ทางเข้าถอดออกหมดแล้ว (2 ก.ย.) · สามทางข้างล่างคิดคนละอย่างว่า “หน้าแรกของการผลิต”
          คืออะไร — โต๊ะที่กองงานไว้ตรงหน้า / ผังสายพานที่กดเข้าสถานี / ตารางเวลาที่บอกว่าทันไหม ·
          ทุกทางรวมรอบพิมพ์ ร้านนอก และจอสถานีเข้ามาในหน้าเดียว ไม่แยกหน้าอีก · เลือกมาหนึ่งทางแล้วค่อยลงมือกับของจริง
        </p>

        {/* แถวควบคุม */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl
                options={OPTIONS.map((option) => ({ ...option }))}
                value={variant}
                onChange={setVariant}
                aria-label="เลือกแบบที่จะดู"
                className="min-w-max"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleBusy}>
              {busy ? "งานปกติ (7 ใบ)" : "งานล้น (15 ใบ)"}
            </Button>
            <Button variant={station ? "default" : "outline"} size="sm" onClick={toggleStation}>
              <MonitorSmartphone /> {station ? "กำลังดูโหมดหน้างาน (จอทัช)" : "โหมดหน้างาน (จอทัช)"}
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={isDark ? "ดูแบบโหมดสว่าง" : "ดูแบบโหมดมืด"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Moon /> : <Sun />}
          </Button>
        </div>

        {/* คำอธิบายแบบที่เลือกอยู่ */}
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

        {/* จอ */}
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              {station ? "จอทัชหน้างาน (ธีมมืดเสมอ)" : "บนคอมของหัวหน้า"}
            </p>
            <span className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.open(src, "proto-touch", "width=1024,height=768,noopener")}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดขนาดจอทัชโรงงาน (1024×768)
                <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => window.open(src, "proto-mobile", "width=390,height=820,noopener")}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดขนาดมือถือ (390)
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
          <div
            className={cn(
              "overflow-hidden rounded-2xl px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8",
              station ? "dark bg-bg text-strong" : "bg-bg",
            )}
          >
            <Preview variant={variant} busy={busy} station={station} />
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
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง ·
            เปิดลิงก์บนมือถือได้ (หน้าลองไม่ฝังกรอบมือถือไว้ในหน้า เพราะเว็บนี้กันการฝังใน iframe)
          </p>
        </section>
      </div>
    </main>
  );
}
