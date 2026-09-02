"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, MonitorSmartphone, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import type { Role } from "./_pieces";
import { OPTIONS, Preview, ROLE_OPTIONS, ROLE_VALUES, VALUES, useProtoNav, type Variant } from "./_preview";

/* กติกา: ของเดิมมาก่อน (ถอดไปแล้ว เหลือสรุป) · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด — ใครเป็นคนตัดสินว่าช่างทำใบไหนต่อ */

const COPY: Record<Variant, { name: string; idea: string; worker: string; boss: string; tradeoff: string }> = {
  removed: {
    name: "ที่ถอดไป — จอสถานี 2 รุ่น",
    idea: "5 สถานีตายตัวในโค้ด (legacy) หรือ ERP/MES เต็มรูป (V2)",
    worker: "ของเดิมไม่มีให้เปิดแล้ว — ที่เหลือคือสรุปว่าเคยเป็นอะไร",
    boss: "ทั้งสองรุ่นไม่มีที่ให้หัวหน้า “แก้ให้” ต่อสถานี",
    tradeoff: "สิ่งที่ทางใหม่ต้องไม่ทำหาย: เบิกเสื้อผ่านสต๊อกจริง · DTF ผ่านรอบพิมพ์ · QC บันทึกของเสียพร้อมรูป · ร้านนอกมีนัดรับ · จอสถานีไม่มีเงิน",
  },
  queue: {
    name: "A · หยิบงานเอง",
    idea: "ช่างตัดสินใจเองว่าหยิบใบไหน (คิวเรียงให้แล้ว) · หัวหน้าเข้ามาเฉพาะตอนต้องแก้",
    worker:
      "จอแยก `/station` เต็มจอ ไม่มีเมนูข้าง 3 ชั้น: (1) เลือกสถานีที่ยืนอยู่ — ป้ายใหญ่มีตัวเลขกำลังทำ/พร้อม/ติด (2) คิวของสถานี 3 กลุ่ม กำลังทำ → พร้อมทำ (เรียงกำหนดส่ง) → ติดปัญหา/รอของ ทั้งการ์ดกดได้ (3) หน้าลงมือ: รูป ไซซ์ ลาย ซ้าย · ขั้นนี้ขวา = ตัวเลขทำแล้ว → ข้อกำหนดติ๊กทีละข้อ (ปุ่มใหญ่) → ปุ่มหลักปุ่มเดียว · แจ้งปัญหาแบบกดเลือกเหตุ ไม่ต้องพิมพ์ · กดผิดย้อนกลับเองได้ 5 นาที",
    boss:
      "จอเดียวกัน แต่หน้าแรกเป็น “แผงสถานี” เห็นทุกสถานี + ใครอยู่ + ติดกี่ใบ → เข้าสถานีไหนก็ได้ เห็นทุกคน ทุกการ์ดมีปุ่ม “แก้ให้” (ย้อนขั้น · แก้ยอด · เปลี่ยนคน · ปลดปัญหา · พัก · ผ่านแทน) และเปิดใบเดียวกับช่างแล้วทำแทนได้ · แผงนี้เปิดจากคอมได้ด้วย",
    tradeoff:
      "ช่างยังต้อง “เลือก” 2 ครั้ง (สถานี + ใบ) — เลือกผิดสถานีได้ (แก้ด้วยการจำสถานีต่อจอ) · หัวหน้าไม่ได้คุมลำดับ ช่างอาจหยิบใบง่ายก่อนใบด่วน (คิวเรียงกำหนดส่งช่วยได้ระดับหนึ่ง) · เป็นหน้าใหม่ 1 หน้า (3 ชั้น) ที่ต้องดูแลเพิ่มจากหน้าการผลิตและใบผลิต",
  },
  dispatch: {
    name: "B · หัวหน้าจ่ายงาน",
    idea: "ตัดโอกาสกดมั่วตั้งแต่ต้น — ช่างเห็นแค่ใบที่หัวหน้าจ่าย · หัวหน้าคุมคิวทุกสถานีจากกระดานเดียว",
    worker:
      "จอช่างไม่มีอะไรให้เลือกเลย: เปิดมาเจอ “งานของฉันตอนนี้” ใบเดียว (หน้าลงมือเดียวกับ A) + ถัดไป 2 ใบที่หัวหน้าเรียงไว้ · ไม่มีงาน = ปุ่มเดียว “บอกหัวหน้าว่าว่างแล้ว”",
    boss:
      "กระดานจ่ายงาน: ทุกสถานีเป็นคอลัมน์ มีใครประจำ · ทุกใบมีช่อง “จ่ายให้…” และปุ่มเลื่อนขึ้น/ลง (ลำดับบนสุด = ใบที่ช่างเห็นก่อน) · ปุ่ม “แก้ให้” ชุดเดียวกับ A · กดเลขใบเปิดหน้าลงมือทำแทนได้",
    tradeoff:
      "หัวหน้าต้องจ่ายงานทุกใบทุกวัน — วันที่หัวหน้าไม่อยู่ ช่างจะไม่มีงานขึ้นจอ (ต้องมีทางหนีทีไล่ เช่น จ่ายอัตโนมัติตามสถานีที่ประจำ) · ช่างที่เก่งอยู่แล้วจะรู้สึกถูกจำกัด · ต้องมีที่เก็บ “ลำดับที่หัวหน้าจัด” เพิ่มในฐานข้อมูล (dispatchSequence มีแล้วใน V2 แต่ legacy ไม่มี)",
  },
  workorder: {
    name: "C · ใบผลิตเป็นศูนย์กลาง",
    idea: "ไม่เพิ่มหน้าใหม่ — หน้าการผลิต + ใบผลิตที่เบสเคาะแล้ว เปิดบนจอทัช ต่างกันแค่ขนาดปุ่มและสิทธิ์",
    worker:
      "เปิดหน้าการผลิตเดิมบนจอทัช กดชิปสถานี → การ์ดใหญ่ → เข้าใบผลิตแบบ D (แท็บ + 2 คอลัมน์) ในโหมดจอทัช แล้วหาแท็บ “ขั้นงาน” เลือกขั้นของตัวเองแล้วกดในโซนลงมือ",
    boss: "แก้ให้จากในใบผลิตเดิม ปุ่ม “มอบหมาย / จัดการขั้นที่เลือก” (dialog หัวหน้าที่มีอยู่แล้ว: สถานะ · ยอด · คนทำ · ปลดปัญหา) · ดูภาพรวมสถานีจากโต๊ะงานหัวหน้า `/production` กรองสถานี",
    tradeoff:
      "ช่างเห็นทั้งใบผลิต (7 ขั้น 4 แท็บ ข้อมูลใบ ประวัติ) ทั้งที่ต้องการแค่ขั้นเดียว — คนไม่ถนัดคอมหลงได้ · ไม่มีคิว “ของฉัน” ต้องกวาดตาหาเอง · ชิปสถานีในหน้าการผลิตยังเป็น 5 ค่าตายตัว: เพิ่มสถานี “ตรวจของกลับจากร้าน” แล้วไม่ขึ้นเอง (ลองกดชิปนั้นดูในหน้าลอง) · หัวหน้าไม่มีที่เดียวที่เห็นว่าใครทำอะไรอยู่ต่อสถานี",
  },
};

const NOTES = [
  "ทั้ง 3 ทางใช้ “หน้าลงมือ” เดียวกัน: รูป/ไซซ์/ลาย ซ้าย · ขั้นนี้ขวา (ตัวเลขทำแล้ว → ข้อกำหนดติ๊กทีละข้อ → ปุ่มหลักปุ่มเดียว) · ปุ่มสูง 56–64px · ไม่มีเงิน · แจ้งปัญหากดเลือกเหตุ 6 แบบ · แป้นยอดกด +10/+50/ครบ ไม่ต้องพิมพ์ · กดผิดย้อนกลับเองได้ 5 นาที หลังจากนั้นเป็นเรื่องหัวหน้า",
  "“หัวหน้าแก้ให้” ชุดเดียวกันทุกทาง 7 อย่าง — 6 อย่างมีทางฝั่ง server อยู่แล้ว (updateStep · assignStep · resolveStationProblem) · “ย้ายไปสถานีอื่น/ส่งร้านนอกแทน” ต้องทำเพิ่ม · ทุกอย่างจดชื่อหัวหน้า+เวลา ช่างเห็นในใบว่าใครแก้",
  "ต่อเติมได้ยังไง: สถานี = work center ในหน้าตั้งค่า (seed จริงมี 7: เตรียม · DTF · รีด · ตรวจของกลับจากร้าน · QC · แพ็ก · ร้านนอก) — ทาง A/B อ่านรายการนี้ตรง ๆ เพิ่มสถานีแล้วขึ้นเอง · ปุ่มหลักของแต่ละสถานีเป็น “ช่องเสียบ” (เบิกสต๊อก / รอบพิมพ์ / ตรวจรับ / QC ของเสีย / แพ็ก) ขั้นแบบใหม่ที่ยังไม่มี dialog เฉพาะได้ปุ่ม เริ่ม → บันทึกยอด → ปิดขั้น มาตรฐาน · ข้อกำหนดต่อขั้นมาจากสูตรขั้นงาน (ต้องเพิ่มช่องในฐานข้อมูล — จดไว้ ROADMAP §A)",
  "จอที่ใช้ร่วมกันหลายคน: ตอนนี้เปลี่ยนคน = ออกจากระบบแล้วเข้าใหม่ · ทางที่ง่ายกับช่างคือ PIN 4 หลักต่อคน (งานฝั่งล็อกอิน ยังไม่ทำ — ทุกทางเจอเท่ากัน)",
  "ธีม: ใช้ธีมเดียวกับเว็บ (สว่าง/มืดตามเครื่อง) ไม่ทำธีมมืดพิเศษแบบจอเดิม — เบสตีกลับ “ธีมสีไม่เข้ากับเว็บ” มาแล้ว 09-02 · โฟกัสด้วยขนาด/น้ำหนัก/พื้นจม ไม่ใช่สี",
  "ทาง C ใช้ component ของหน้าลองที่เคาะแล้วตรง ๆ (หน้าการผลิตแบบ A · ใบผลิตแบบ D) จึงเห็นข้อแลกจริง ไม่ใช่วาดให้ดูแย่",
] as const;

const OUT_OF_SCOPE = [
  "ข้างในปุ่มหลักของแต่ละสถานี (dialog เบิกสต๊อก / รอบพิมพ์ / ตรวจรับเสื้อลูกค้า / QC ของเสีย+รูป / แพ็ก+ลัง) ยังไม่ได้ออกแบบใหม่ — ของเดิมมีครบ ใช้ต่อได้หลังเคาะโครง",
  "สแกน QR/เลขออเดอร์เพื่อเปิดงาน (จอเดิมมี) — ใส่ได้ทุกทางเป็นปุ่มเดียวในหัวจอ ยังไม่วาดเพราะไม่ใช่สิ่งที่ต้องเคาะ",
  "การจ่ายงานอัตโนมัติ / ลำดับที่หัวหน้าจัด (ทาง B) ต้องเพิ่มที่เก็บในฐานข้อมูล — ถามก่อนทำ",
  "รูปม็อกอัพเป็นไฟล์ตัวอย่างของ repo (/demo-mockups) · ชื่อลูกค้า/เลขใบเป็นของปลอม",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function StationProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "queue");
  const [role, setRole] = useProtoVariant<Role>("role", ROLE_VALUES, "worker");
  const [empty, toggleEmpty] = useProtoFlag("empty");
  const nav = useProtoNav();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/station/view?v=${variant}&role=${role}&empty=${empty ? "1" : "0"}&st=${nav.station}&s=${nav.screen}${nav.jobId ? `&job=${nav.jobId}` : ""}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">จอสถานีสำหรับพนักงาน + หัวหน้าจัดการได้ทุกสถานี</h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          โจทย์จากเบส (3 ก.ย.): “พนักงานไม่เก่งคอม ต้องดูง่ายใช้ง่าย ดูแล้วรู้ว่าต้องทำอะไร · หัวหน้าผลิตจัดการได้แต่ละสถานี ช่างงงหรือกดมั่วก็แก้ให้ได้เลย · รองรับการต่อเติมในอนาคต” ·
          คำถามที่ต้องเคาะ: <strong>ใครเป็นคนตัดสินว่าช่างทำใบไหนต่อ</strong> — ช่างหยิบเองจากคิว (A) / หัวหน้าจ่ายให้ (B) / ไม่มีจอใหม่ ใช้ใบผลิตเดิม (C)
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            {variant !== "removed" ? (
              <>
                <SegmentedControl options={ROLE_OPTIONS.map((o) => ({ ...o }))} value={role} onChange={setRole} aria-label="ดูในฐานะใคร" />
                <Button variant={empty ? "default" : "outline"} size="sm" onClick={toggleEmpty}>
                  {empty ? "กำลังดูตอนคิวว่าง" : "ดูตอนคิวว่าง"}
                </Button>
              </>
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
            <p className="mt-1.5 text-sm text-secondary">
              <span className="font-medium text-strong">พนักงาน:</span> {copy.worker}
            </p>
            <p className="mt-1.5 text-sm text-secondary">
              <span className="font-medium text-strong">หัวหน้า:</span> {copy.boss}
            </p>
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
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              {variant === "removed" ? "สรุป" : role === "boss" ? "จอหัวหน้า (คอม หรือจอทัช)" : "จอทัชหน้าเครื่อง — กดเล่นได้: เลือกสถานี → คิว → ลงมือ"}
            </p>
            <span className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => window.open(src, "proto-touch", "width=1024,height=768,noopener")} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดขนาดจอทัช (1024×768) <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
                เปิดเต็มหน้าจอ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className={cn("overflow-hidden rounded-2xl bg-bg px-4 py-5 ring-1 ring-inset ring-border sm:px-6")}>
            <Preview variant={variant} role={role} empty={empty} nav={nav} />
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
