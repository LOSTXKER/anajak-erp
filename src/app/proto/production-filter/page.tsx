"use client";

/**
 * หน้าลอง: แถบกรองเหนือตารางในหน้าควบคุมการผลิต ควรเป็นอะไร
 *
 * ที่มา: เบสส่งภาพแถบกรองของจริงมาถามว่า "แล้ว filter ข้างบนเราควรทำใหม่มั้ย"
 * ตัวเลขในภาพนั้นฟ้องเอง — ทั้งหมด 20 · กำลังผลิต 19 · รอ QC 0 · แพ็ก 1
 * แปลว่าปุ่มที่กดแล้วผลต่างจากเดิมจริง ๆ มีอยู่ปุ่มเดียวคือ "ต้องจัดการ"
 *
 * ตารางข้างล่างแถบกรองเป็นชุดเดียวกันทุกแบบ (แบบ C ที่ลงของจริงไปแล้ว)
 * เพื่อให้สายตาเทียบเฉพาะแถบกรอง ไม่ใช่เทียบตาราง
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { productionWorklistCounts } from "@/lib/production-worklist";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import {
  PROTO_BOARD,
  PROTO_BOARD_BUSY,
  PROTO_TODAY_LABEL,
} from "../production-list/_data";
import { ProductionFilterPreview } from "./_preview";

/* --------------------------------------------------------------- ทางเลือก */

const OPTIONS = [
  { value: "current", label: "แบบเดิม (ก่อน 31 ส.ค.)" },
  { value: "lane", label: "A · ตามสายงาน ✓ ของจริง" },
  { value: "two", label: "B · สองปุ่ม + ดรอปดาวน์" },
  { value: "none", label: "C · ไม่มีปุ่มกรอง" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

const COPY: Record<
  Variant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "แบบเดิม — ก่อน 31 ส.ค. 2569",
    idea: "กรองด้วย “สถานะของออเดอร์”",
    summary:
      "ห้าปุ่ม: ทั้งหมด · ต้องจัดการ · กำลังผลิต · รอ QC · แพ็ก/พร้อมส่ง · สามปุ่มหลังแบ่งกองเดียวกันแบบไม่ทับกัน (บวกกันแล้วเท่ากับทั้งหมดพอดี) จึงเป็นการหั่นตามปลายทางของงาน ไม่ใช่ตามสิ่งที่ค้างอยู่",
    tradeoff:
      "ในโรงงานนี้เกือบทุกใบมีสถานะ “กำลังผลิต” ตลอด — วันที่เบสส่งภาพมาคือ 19 จาก 20 ใบ กดแล้วจึงแทบไม่ต่างจากไม่กด · “รอ QC” เป็น 0 แต่ยังกินที่อยู่ทุกวัน · เหลือปุ่มที่ทำงานจริงปุ่มเดียวคือ “ต้องจัดการ”",
  },
  lane: {
    name: "A · ตามสายงาน — เบสเคาะแล้ว ลงของจริง 31 ส.ค. 2569",
    idea: "กรองด้วย “ตอนนี้ค้างอยู่ขั้นไหน”",
    summary:
      "ปุ่มกลายเป็นขั้นงานจริงที่มีงานค้างอยู่ — รอเปิดใบผลิต · เตรียมเสื้อ · DTF · ปัก · ป้ายคอ · ตรวจ QC · กำลังแพ็ค · พร้อมส่ง — ตัวเลขคือจำนวนใบในขั้นนั้น และถ้าขั้นไหนมีงานเลยกำหนดจะมีเลขแดงเกาะเพิ่ม · ยังคง “ทั้งหมด” กับ “ต้องจัดการ” ไว้ข้างหน้าเพราะเป็นคำถามคนละชนิด · สายที่ส่งร้านนอกใช้ไอคอนรถ (ม่วง) แยกจากสายที่ทำเองในโรงงาน",
    tradeoff:
      "ปุ่มเยอะขึ้น — ชุดตัวอย่างนี้มี 8 สาย รวมเป็น 10 ปุ่ม บนจอแคบต้องเลื่อนแถบไปทางขวา · ขั้นที่ไม่มีงานจะจางแต่ยังอยู่ (ถ้าซ่อน ปุ่มจะเต้นหายไปมาเวลากรอง) · งานใบเดียวที่เดินสองสายพร้อมกันจะถูกนับในทั้งสองปุ่ม ตัวเลขรวมจึงมากกว่าจำนวนใบ",
  },
  two: {
    name: "B · สองปุ่ม + ดรอปดาวน์",
    idea: "เหลือเฉพาะปุ่มที่คนกดจริง",
    summary:
      "บนแถบเหลือ “ทั้งหมด” กับ “ต้องจัดการ” เท่านั้น · ขั้นงานทั้งหมดย้ายไปอยู่ในช่องเลือกทางขวาของแถบ (ทุกขั้นงาน ▾) ซึ่งบอกจำนวนในวงเล็บ",
    tradeoff:
      "แถบสะอาดที่สุดในสามแบบที่ยังกรองได้ แต่ต้องกดเปิดถึงจะรู้ว่ามีขั้นไหนบ้างและกองอยู่กี่ใบ — เปิดหน้ามาแล้วไม่เห็นภาพรวมของสายงานเลย · เลยกำหนดรายขั้นก็ไม่เห็น ต้องเลือกทีละขั้นแล้วดูตาราง",
  },
  none: {
    name: "C · ไม่มีปุ่มกรอง",
    idea: "ตารางบอกความเร่งอยู่แล้ว ไม่ต้องมีแถบ",
    summary:
      "ตัดแถบทิ้งทั้งแถว เหลือช่องค้นหากับช่องเรียง · การหาเฉพาะกลุ่มใช้หัวข้อกลุ่มในตาราง (เลยกำหนดแล้ว · ส่งวันนี้ · ส่งพรุ่งนี้ …) และช่องค้นหาแทน",
    tradeoff:
      "ประหยัดที่สุดและไม่มีปุ่มหลอก แต่เวลาอยากดูเฉพาะ “งานที่อยู่ร้านนอก” หรือ “ที่ต้องจัดการ” ต้องกวาดตาทั้งตารางเอง — ปุ่ม “ต้องจัดการ” ที่ใช้งานจริงก็หายไปด้วย",
  },
};

/** ข้อเท็จจริงที่วัดมาจากของจริง ไม่ใช่ความเห็น */
const NOTES = [
  "ตัวเลขในภาพที่เบสส่งมา (หน้าจริง 31 ส.ค.): ทั้งหมด 20 · ต้องจัดการ 1 · กำลังผลิต 19 · รอ QC 0 · แพ็ก/พร้อมส่ง 1 — สามปุ่มหลังบวกกันได้ 20 พอดี แปลว่ามันคือการหั่นกองเดียวกัน ไม่ใช่ตัวกรองอิสระ",
  "ชุดตัวอย่างในหน้าลองนี้กระจายกว่าของจริง (กำลังผลิต 8 จาก 12 ใบ) — ของจริงกองอยู่ที่ “กำลังผลิต” หนักกว่านี้มาก ปัญหาที่เบสเห็นจึงแรงกว่าที่หน้าลองแสดง",
  "ทุกแบบใช้ปุ่มกรอง (FilterChip) ช่องเลือก (Select) และแถบเครื่องมือตัวจริงของระบบ · รายชื่อสายงานกับจำนวนมาจาก buildProductionBoard() ตัวเดียวกับที่จอโรงงาน /factory ใช้ ไม่ได้ตั้งชื่อหรือคิดเลขใหม่",
  "ตารางข้างล่างเหมือนกันทุกแบบโดยตั้งใจ = แบบ C ที่เบสเคาะไปแล้ว รวมถึงคอลัมน์สถานะที่เพิ่งเปลี่ยนเป็น “ขั้นที่ค้างอยู่” บรรทัดเดียวตามที่เบสสั่งเมื่อวันนี้",
  "แบบ A นับงานผสม (ใบเดียวเดินสองสาย) ในทุกสายที่มันค้างอยู่ ตามความจริงของหน้างาน — ไม่ได้ยุบให้เหลือสายเดียวเพื่อให้เลขสวย",
  "จอจริงของหน้านี้คือคอมของเบสกับจอทัชในโรงงาน — ปุ่มที่ต้องเลื่อนแถบแนวนอนบนจอทัชเป็นข้อแลกจริงของแบบ A",
  `“วันนี้” ของหน้าลองตรึงไว้ที่ ${PROTO_TODAY_LABEL} เหมือนหน้าลองอื่น ตัวเลขจึงนิ่ง ไม่เปลี่ยนตามวันที่เปิดดู`,
];

const OUT_OF_SCOPE = [
  "ช่องค้นหา ช่องเรียง และตัวบอกเวลาอัปเดต — ไม่ได้อยู่ในคำถามรอบนี้ จึงเหมือนกันทุกแบบ",
  "ตารางและคอลัมน์ในแถว — เพิ่งเคาะไปแล้ว (แบบ C + คอลัมน์สถานะบรรทัดเดียว) รอบนี้ไม่แตะ",
  "จอโรงงาน /factory ซึ่งมีตัวกรองสายงานเป็นคอลัมน์อยู่แล้ว — ถ้าเลือกแบบ A สองหน้านี้จะพูดภาษาเดียวกันพอดี แต่ยังไม่ได้รวมเป็นหน้าเดียว",
];

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function ProductionFilterProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [busy, toggleBusy] = useProtoFlag("busy");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  /* ตารางข้างล่างคำนวณสดจากข้อมูลชุดเดียวกับที่เห็นบนจอ — ไม่มีเลขไหนพิมพ์ทิ้งไว้
     ให้ล้าสมัย ถ้าข้อมูลตัวอย่างเปลี่ยน ตารางนี้เปลี่ยนตามเอง */
  const board = busy ? PROTO_BOARD_BUSY : PROTO_BOARD;
  const counts = productionWorklistCounts(board);
  const lensRows = [
    { label: "ทั้งหมด", count: counts.all },
    { label: "ต้องจัดการ", count: counts.attention },
    { label: "กำลังผลิต", count: counts.production },
    { label: "รอ QC", count: counts.qc },
    { label: "แพ็ก / พร้อมส่ง", count: counts.packing },
  ];
  const stationRows = board.stations.map((station) => ({
    label: station.label,
    count: station.count,
    overdue: station.overdue,
  }));

  const src = `/proto/production-filter/view?v=${variant}&busy=${busy ? "1" : "0"}`;

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
          แถบกรองเหนือตารางในหน้าควบคุมการผลิต ควรเป็นอะไร
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          ปุ่มกรองตอนนี้ถามว่า{" "}
          <strong className="font-semibold text-strong">“ใบไหนสถานะอะไร”</strong> ซึ่งในโรงงานนี้
          เกือบทุกใบตอบเหมือนกันว่า “กำลังผลิต” (วันที่เบสส่งภาพมาคือ 19 จาก 20 ใบ) —
          กดแล้วแทบไม่ต่างจากไม่กด ส่วน “รอ QC” เป็น 0 แต่ยังกินที่อยู่ทุกวัน
          สามแบบข้างล่างจึงลองคนละคำตอบว่าแถบนี้ควรถามอะไรแทน:{" "}
          <strong className="font-semibold text-strong">ค้างอยู่ขั้นไหน</strong> ·
          เหลือเฉพาะปุ่มที่กดจริง · หรือไม่ต้องมีแถบเลย —{" "}
          <strong className="font-semibold text-strong">
            เบสตอบ “เอา A” และลงของจริงแล้วเมื่อ 31 ส.ค. 2569
          </strong>{" "}
          หน้านี้จึงเหลือไว้เป็นภาพตอนตัดสินใจ (ช่อง “แบบเดิม” คือของก่อนเปลี่ยน ไม่ใช่ของจริงตอนนี้แล้ว)
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
            <ProductionFilterPreview variant={variant} busy={busy} />
          </div>
        </section>

        {/* ปุ่มไหนกรองได้จริงแค่ไหน — ตัดสินด้วยตัวเลข ไม่ใช่ความรู้สึก */}
        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="card-surface rounded-2xl p-5">
            <h2 className="text-sm font-semibold">
              ปุ่มแบบเดิม (สถานะออเดอร์) — กดแล้วเหลือกี่ใบ
            </h2>
            <p className="mt-1 text-xs text-muted">
              จากชุดตัวอย่างที่เห็นบนจอ {counts.all} ใบ · ปุ่มที่เหลือใกล้เคียงทั้งหมด
              คือปุ่มที่กดแล้วแทบไม่ได้กรองอะไร
            </p>
            <table className="mt-3 w-full text-sm">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-left text-xs">
                  <th className="py-2 pr-3 font-medium">ปุ่ม</th>
                  <th className="py-2 pr-3 font-medium">เหลือ</th>
                  <th className="py-2 font-medium">คิดเป็น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {lensRows.map((row) => (
                  <tr key={row.label} className="text-secondary">
                    <td className="py-2 pr-3">{row.label}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.count} ใบ</td>
                    <td className="py-2 tabular-nums">
                      {Math.round((row.count / counts.all) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-surface rounded-2xl p-5">
            <h2 className="text-sm font-semibold">ปุ่มแบบ A (ขั้นงาน) — กองอยู่ขั้นละกี่ใบ</h2>
            <p className="mt-1 text-xs text-muted">
              รายชื่อและจำนวนมาจากบอร์ดจริง โชว์เฉพาะขั้นที่มีงานอยู่ ·
              คอลัมน์ขวาคือจำนวนที่เลยกำหนดในขั้นนั้น
            </p>
            <table className="mt-3 w-full text-sm">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-left text-xs">
                  <th className="py-2 pr-3 font-medium">ขั้นงาน</th>
                  <th className="py-2 pr-3 font-medium">กองอยู่</th>
                  <th className="py-2 font-medium">เลยกำหนด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {stationRows.map((row) => (
                  <tr key={row.label} className="text-secondary">
                    <td className="py-2 pr-3">{row.label}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.count} ใบ</td>
                    <td className="py-2 tabular-nums">
                      {row.overdue > 0 ? (
                        <span className="font-medium text-red-700 dark:text-red-300">
                          {row.overdue} ใบ
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-surface mt-10 rounded-2xl p-5">
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
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
