"use client";

/**
 * หน้าลอง: แถบกรองควรแยก "หมวด" ของขั้นงานยังไง + ช่องเรียงบนคอมควรเป็นอะไร
 *
 * ที่มาสองคำถามในหน้าเดียว (เบสถามต่อกันวันเดียวกัน 2026-08-31):
 * ① "เราแยก หมวดหมู่ สถานะหน่อยดีมั้ย" — ตอนนี้ 12 ขั้นเรียงเรียบ ๆ ไม่บอกว่าอันไหน
 *    งานที่โรงงานทำเอง (เตรียมเสื้อ · DTF) อันไหนอยู่ร้านนอก (อีก 6 สาย)
 * ② "แล้วนี่มีทำไม" (ชี้ช่อง “ต้องจัดการก่อน ▾”) — ช่องเรียงบนคอมที่เหลือแค่สองตัวเลือก
 *    บวกบรรทัดที่กดไม่ได้ ทั้งสองเรื่องอยู่บนแถบเดียวกัน จึงให้เคาะพร้อมกันในหน้าเดียว
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { PROTO_TODAY_LABEL } from "../production-list/_data";
import {
  ProductionGroupsPreview,
  type ProductionSortControl,
} from "./_preview";

/* ------------------------------------------------- คำถามที่ 1: แยกหมวดยังไง */

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "label", label: "A · ป้ายกำกับหมวด" },
  { value: "rows", label: "B · ร้านนอกแยกแถว" },
  { value: "fold", label: "C · ร้านนอกยุบปุ่มเดียว" },
  { value: "pipeline", label: "D · เส้นทางงาน" },
  { value: "groupfirst", label: "E · หมวดก่อน แล้วกางขั้น" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

const COPY: Record<
  Variant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — 12 ขั้นเรียงต่อกัน",
    idea: "ทุกขั้นเท่ากันหมด",
    summary:
      "ทั้งหมด · ต้องจัดการ แล้วต่อด้วยขั้นงาน 12 ขั้นเรียงตามทางเดินงาน ตัดขึ้นบรรทัดใหม่บนคอม (สองแถว) · ขั้นที่ไม่มีงานขึ้นเลข 0 และจางลง",
    tradeoff:
      "อ่านแล้วไม่รู้ว่าขั้นไหนคืองานที่เราทำเอง ขั้นไหนอยู่ร้านนอก — ทั้งที่เวลางานช้า สองอย่างนี้แก้คนละวิธี (งานในโรงงานเร่งคนได้ · งานร้านนอกต้องโทรตาม) · ตาต้องกวาดหา “ตรวจ QC” ที่ไปอยู่ปลายแถวที่สอง",
  },
  label: {
    name: "A · ป้ายกำกับหมวด",
    idea: "บอกหมวดด้วยตัวหนังสือคั่น",
    summary:
      "ปุ่มชุดเดิมทุกปุ่ม แต่มีป้ายตัวเล็กคั่นหน้าแต่ละหมวด: ก่อนเริ่ม · ในโรงงาน · ร้านนอก · หลังผลิต (ป้ายกดไม่ได้ เป็นหัวข้อเฉย ๆ)",
    tradeoff:
      "ยาวขึ้นอีกเพราะป้ายกินที่ประมาณ 4 ช่วงคำ · แถบยังเป็นสองแถวบนคอมเหมือนเดิม และตำแหน่งปุ่มขยับตามความยาวของป้าย",
  },
  rows: {
    name: "B · ร้านนอกแยกลงแถวล่าง",
    idea: "แถวบน = งานที่เราคุมเอง · แถวล่าง = งานที่รอคนอื่น",
    summary:
      "แถวบนคือขั้นที่ดูทุกวัน (รอเปิดใบผลิต · เตรียมเสื้อ · DTF · ตรวจ QC · กำลังแพ็ค · พร้อมส่ง) · แถวล่างคือร้านนอกทั้ง 6 สาย มีป้าย “ร้านนอก” พร้อมจำนวนใบรวมนำหน้า",
    tradeoff:
      "สองแถวกลายเป็นโครงถาวร (สูงเท่าเดิมกับตอนนี้ แต่แบ่งมีความหมาย) · ขั้น QC/แพ็ค/ส่ง ขึ้นมาอยู่แถวบนซึ่งผิดจากลำดับเวลาจริงของงาน",
  },
  fold: {
    name: "C · ร้านนอกยุบเป็นปุ่มเดียว",
    idea: "แถบสั้นที่สุด แลกกับกดสองชั้น",
    summary:
      "ร้านนอก 6 สายยุบเหลือปุ่มเดียว “ร้านนอก + จำนวนใบ” (นับใบไม่ซ้ำ ไม่ใช่บวกเลขทุกสาย) กดแล้วกางเป็นรายสายในแถวที่สอง · แถบหลักเหลือ 9 ปุ่ม จบในแถวเดียวบนคอม",
    tradeoff:
      "อยากดูเฉพาะ “งานปัก” ต้องกดสองครั้ง · เลยกำหนดของแต่ละสายซ่อนอยู่ในปุ่มรวม เห็นแค่ยอดรวม",
  },
  pipeline: {
    name: "D · เส้นทางงาน (ตัวเลขนำหน้า)",
    idea: "อ่านแถบเป็นสายพาน ไม่ใช่รายการปุ่ม",
    summary:
      "เรียงตามทางเดินงานจริงเหมือนเดิม แต่มีลูกศรเล็ก ๆ คั่นให้เห็นทิศทาง และสลับให้ “ตัวเลขนำ ชื่อรอง” — กวาดตารอบเดียวเห็นว่ากองบวมช่วงไหนของสาย · ขั้นที่ส่งร้านนอกมีไอคอนรถเกาะที่ตัวปุ่ม ไม่ได้แยกกลุ่ม",
    tradeoff:
      "ไม่มีหัวข้อหมวดให้เกาะสายตาเหมือน A/B — บอกได้แค่ “ขั้นนี้ส่งร้าน” ทีละปุ่ม · ตัวเลขเด่นกว่าชื่อ คนที่ยังไม่ชินชื่อขั้นจะอ่านช้ากว่าเดิมช่วงแรก",
  },
  groupfirst: {
    name: "E · หมวดก่อน แล้วค่อยกางขั้น",
    idea: "ทุกหมวดยุบได้เท่ากันหมด ไม่ได้พิเศษเฉพาะร้านนอก",
    summary:
      "แถบหลักเหลือ 4 ปุ่มหมวด (ก่อนเริ่ม · ในโรงงาน · ร้านนอก · หลังผลิต) กดหมวดแล้วขั้นข้างในกางในแถวที่สอง · กรองได้ทั้งระดับหมวด (ทั้งหมวดเลย) และระดับขั้น",
    tradeoff:
      "สั้นที่สุดในทุกแบบ แต่ต้องกดสองชั้นทุกครั้งที่อยากดูขั้นเดียว · จำนวนในปุ่มหมวดเป็นจำนวนใบไม่ซ้ำ จึงไม่เท่ากับผลบวกของขั้นข้างใน (ถูกแล้ว แต่ต้องอธิบายให้คนใช้เข้าใจ)",
  },
};

/* ------------------------------------------- คำถามที่ 2: ช่องเรียงบนคอม */

const SORT_OPTIONS = [
  { value: "select", label: "ของจริงตอนนี้ (ช่องเลือก)" },
  { value: "toggle", label: "ยุบเป็นปุ่มสลับ" },
  { value: "none", label: "เอาออก" },
] as const;

const SORT_VALUES = SORT_OPTIONS.map((option) => option.value) as readonly ProductionSortControl[];

const SORT_COPY: Record<ProductionSortControl, string> = {
  select:
    "ช่อง “ต้องจัดการก่อน ▾” ที่เบสชี้ — ข้างในมีสองตัวเลือกที่กดได้ (ต้องจัดการก่อน · ด่วนก่อน) บวกบรรทัด “เรียงจากหัวตาราง” ที่กดไม่ได้ ซึ่งเป็นแค่ป้ายบอกว่าตอนนี้เรียงจากหัวตารางอยู่",
  toggle:
    "เปลี่ยนเป็นปุ่มสองอันวางข้างกัน กดค้างไว้ได้ทีละอัน กดซ้ำ = เลิก (กลับไปเรียงตามกำหนดส่ง) — เห็นทันทีว่าเลือกอะไรอยู่โดยไม่ต้องเปิดช่อง แต่กินที่กว้างกว่าเดิม",
  none:
    "ไม่มีช่องเรียงบนคอมเลย — เรียงจากหัวตารางอย่างเดียว (เลขออเดอร์ · ความคืบหน้า · จำนวน · กำหนดส่ง) แลกกับที่ “ต้องจัดการก่อน” กับ “ด่วนก่อน” หายไปทั้งคู่ เพราะไม่มีคอลัมน์ไหนแทนได้",
};

/** ข้อเท็จจริงที่ต้องรู้ก่อนตัดสิน */
const NOTES = [
  "โรงงานทำเองแค่ 2 ขั้น (เตรียมเสื้อ · DTF) อีก 6 สายเป็นร้านนอกทั้งหมด (ตัดเย็บ · DTG · สกรีน · ปัก · Sublimation · ป้ายคอ) — เส้นแบ่งนี้มาจาก OUTSOURCE_LANES ตัวจริงในระบบ ไม่ได้จัดกลุ่มเอง",
  "ปุ่มร้านนอกรวมในแบบ C นับ “จำนวนใบไม่ซ้ำ” — งานใบเดียวที่ส่งทั้งปักและป้ายคอนับเป็นหนึ่ง ไม่ใช่สอง (ถ้าบวกเลขทุกสายจะได้ตัวเลขที่มากกว่างานจริง)",
  "แถบตอนนี้กว้าง 1,590px บนช่องกว้าง 1,178px จึงตัดเป็นสองแถวบนคอม · บนมือถือทุกแบบยังเลื่อนแนวนอนเหมือนเดิม (ตัดบรรทัดบนจอเล็ก = แถบสูง 4–5 แถว)",
  "ช่องเรียงบนมือถือไม่ได้อยู่ในคำถามนี้ — มันต้องมีทุกแบบ เพราะมือถือไม่มีหัวตารางให้กดเรียง",
  "ถ้าวันหนึ่งโรงงานทำปักเอง: แบบ B กับ C ผูกโครงแถบไว้กับคำว่า “ร้านนอก” (แถวล่าง / ปุ่มยุบ) จึงต้องกลับมาแก้หน้าตาอีกรอบ · แบบ A · D · E ย้ายขั้นข้ามหมวดได้เองตามข้อมูล ไม่ต้องรื้อโครง",
  `ชุดตัวอย่าง 12 ใบ (กดปุ่มเพื่อดูตอนงานล้น 24 ใบ) · “วันนี้” ตรึงไว้ที่ ${PROTO_TODAY_LABEL}`,
];

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function ProductionGroupsProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [sortControl, setSortControl] = useProtoVariant<ProductionSortControl>(
    "sort",
    SORT_VALUES,
    "select",
  );
  const [busy, toggleBusy] = useProtoFlag("busy");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  const src = `/proto/production-groups/view?v=${variant}&sort=${sortControl}&busy=${
    busy ? "1" : "0"
  }`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/proto"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          แถบกรองควรแยกหมวดยังไง — และช่องเรียงข้าง ๆ ควรเหลืออะไร
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          ตอนนี้แถบมีขั้นงาน 12 ขั้นเรียงต่อกันเรียบ ๆ อ่านแล้วไม่รู้ว่าอันไหนคือ{" "}
          <strong className="font-semibold text-strong">งานที่โรงงานทำเอง</strong> (เตรียมเสื้อ · DTF)
          อันไหน <strong className="font-semibold text-strong">อยู่ร้านนอก</strong> (อีก 6 สาย) —
          ซึ่งเวลางานช้า สองอย่างนี้แก้คนละวิธี · เลือกแบบการแยกหมวดข้างล่าง
          และเลือกด้วยว่าช่องเรียงบนคอม (ช่องที่เบสถามว่ามีทำไม) จะเก็บ ยุบ หรือเอาออก
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
              {busy ? "ดูสัปดาห์ปกติ (12 ใบ)" : "ดูตอนงานล้น (24 ใบ)"}
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

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-secondary">ช่องเรียงบนคอม:</span>
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              options={SORT_OPTIONS.map((option) => ({ ...option }))}
              value={sortControl}
              onChange={setSortControl}
              aria-label="เลือกแบบของช่องเรียงบนคอม"
              className="min-w-max"
            />
          </div>
        </div>

        {/* คำอธิบายแบบที่เลือกอยู่ */}
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-l-2 border-blue-600 pl-4 dark:border-blue-400">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              วิธีคิด: {copy.idea}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{copy.name}</h2>
            <p className="mt-1.5 text-sm text-secondary">{copy.summary}</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">ข้อแลก:</span> {copy.tradeoff}
            </p>
            <p className="mt-3 border-t border-divider pt-3 text-sm text-secondary">
              <span className="font-medium text-strong">ช่องเรียงที่เลือกอยู่:</span>{" "}
              {SORT_COPY[sortControl]}
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

        {/* ของจริงที่กำลังเทียบ */}
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">บนคอม</p>
            <span className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  window.open(src, "proto-mobile", "width=390,height=820,noopener")
                }
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดขนาดมือถือ (390)
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
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
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8">
            <ProductionGroupsPreview
              variant={variant}
              sortControl={sortControl}
              busy={busy}
            />
          </div>
        </section>

        {/* หมวดของขั้นงาน — ที่มาของการแบ่ง */}
        <section className="card-surface mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หมวดมาจากไหน</h2>
          <p className="mt-1 text-xs text-muted">
            ไม่ได้จัดกลุ่มเอง — ยกจากข้อมูลจริงในระบบ (`OUTSOURCE_LANES` และชนิดของขั้นงาน)
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-left text-xs">
                  <th className="py-2 pr-3 font-medium">หมวด</th>
                  <th className="py-2 pr-3 font-medium">มีขั้นอะไรบ้าง</th>
                  <th className="py-2 font-medium">เวลาช้า แก้ยังไง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider text-secondary">
                <tr>
                  <td className="py-2 pr-3 font-medium text-strong">ก่อนเริ่ม</td>
                  <td className="py-2 pr-3">รอเปิดใบผลิต</td>
                  <td className="py-2">เปิดใบผลิต / เคลียร์ด่านมัดจำ</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-strong">ในโรงงาน</td>
                  <td className="py-2 pr-3">เตรียมเสื้อ · DTF</td>
                  <td className="py-2">จัดคนเพิ่ม / สลับคิวเครื่อง</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-strong">ร้านนอก</td>
                  <td className="py-2 pr-3">
                    ตัดเย็บ · DTG · สกรีน · ปัก · Sublimation · ป้ายคอ
                  </td>
                  <td className="py-2">โทรตามร้าน / เปลี่ยนร้าน — เร่งเองไม่ได้</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-strong">หลังผลิต</td>
                  <td className="py-2 pr-3">ตรวจ QC · กำลังแพ็ค · พร้อมส่ง</td>
                  <td className="py-2">เร่งตรวจ/แพ็ก หรือแจ้งขนส่ง</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* คำถามที่เบสถามระหว่างดู: อนาคตทำปักเองแล้วจะรองรับไหม */}
        <section className="card-surface mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">
            ถ้าวันหนึ่งเราทำปักเอง (หรือสกรีน/ตัดเย็บเอง) ระบบรองรับไหม
          </h2>
          <p className="mt-2 text-xs text-secondary">
            <span className="font-medium text-strong">รองรับ แต่เป็นการแก้โค้ด ไม่ใช่ติ๊กในหน้าตั้งค่า</span>{" "}
            — ตอนนี้ “สายไหนคือร้านนอก” เขียนตายไว้ที่เดียวใน{" "}
            <code className="rounded bg-surface-muted px-1">src/lib/production-steps.ts</code>{" "}
            (ค่า OUTSOURCE_LANES และ OUTSOURCE_STEP_TYPES) เอา “ปัก” ออกจากสองชุดนี้
            แล้วผลจะไหลไปเองทั้งระบบ: ป้าย “ร้านนอก” ในใบผลิต · ชิปในแถบกรองนี้ ·
            ปุ่ม “ส่งร้าน/ผ่านรวด” ของขั้นนั้น
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-secondary">
            <li>
              ·{" "}
              <span className="font-medium text-strong">จุดที่ต้องคิดเพิ่ม ไม่ใช่แค่ลบชื่อออก:</span>{" "}
              ด่านรีดร้อนตอนนี้ถือว่า “เสื้อพร้อม” = เตรียมเสื้อจบ + งานร้านนอกทุกสายจบ ·
              ถ้าปักย้ายมาทำเอง ปักจะหลุดจากเงื่อนไขนี้ทันที ทั้งที่ความจริงยังต้องปักก่อนรีดอยู่ดี
              → ต้องเปลี่ยนเงื่อนไขเป็น “ขั้นที่ต้องเสร็จก่อนรีด” แทนคำว่า “ร้านนอก”
            </li>
            <li>
              ·{" "}
              <span className="font-medium text-strong">ของจริงอาจไม่ใช่ทำเองทั้งหมด:</span>{" "}
              งานเยอะหรืองานด่วนอาจยังส่งร้านอยู่ — ค่าตายระดับ “สายงาน” ตอบไม่ได้
              แต่ระบบมีความจริงรายใบอยู่แล้ว (ใบสั่งร้านนอกผูกกับขั้นงานตรง ๆ)
              จึงเปลี่ยนไปอ่านว่า “ขั้นนี้ถูกส่งร้านหรือทำเอง” ได้ทันทีเมื่อถึงวันนั้น
            </li>
            <li>
              ·{" "}
              <span className="font-medium text-strong">ผลต่อการเลือกวันนี้:</span> แบบ B และ C
              ผูกโครงแถบเข้ากับคำว่า “ร้านนอก” ถาวร (แถวล่าง/ปุ่มยุบ) วันนั้นต้องกลับมาแก้หน้าตาอีกรอบ ·
              A · D · E ย้ายขั้นข้ามหมวดได้เองตามข้อมูล
            </li>
          </ul>
        </section>

        <section className="card-surface mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
            <li>· ตารางข้างล่างแถบ — เพิ่งเคาะไปแล้ว รอบนี้ไม่แตะ</li>
            <li>· ช่องค้นหาและตัวบอกเวลาอัปเดต — เหมือนกันทุกแบบ</li>
            <li>
              · การจำว่า “กางร้านนอกค้างไว้” ข้ามการรีเฟรช (แบบ C) — หน้าลองยังไม่เก็บใน URL
              ถ้าเลือกแบบ C ค่อยทำตอนลงของจริง
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
