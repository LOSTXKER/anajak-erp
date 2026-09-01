"use client";

/**
 * หน้าลอง: จอรวมการผลิตแบบ canvas — เห็นทั้งโรงงานในภาพเดียว
 *
 * เบสสั่ง 2026-09-01: *"หน้ารวมการผลิต อยากได้ฟีล canvas ที่เห็นภาพรวมของโรงงานทั้งหมด
 * แต่ละ node แต่ละสาย รวมถึงสายนอกโรงงาน"*
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoVariant } from "../_kit/use-proto-variant";
import {
  CANVAS_COMPONENTS,
  CANVAS_MODES,
  type FactoryCanvasVariant,
} from "./_variants";

const OPTIONS = [
  { value: "flow", label: "A · ผังสายการผลิต" },
  { value: "map", label: "B · แผนที่โรงงาน" },
  { value: "board", label: "C · กระดานตามสถานี" },
] as const;

const COPY: Record<
  FactoryCanvasVariant,
  { name: string; summary: string; tradeoff: string }
> = {
  flow: {
    name: "A · ผังสายการผลิต",
    summary:
      "node เรียงตามทางเดินงานจริง มีเส้นเชื่อม — เส้นหนาขึ้นเมื่องานไหลผ่านเยอะ · แถบบนคือในโรงงาน แถบล่าง (เส้นประ) คือนอกโรงงาน · แต่ละ node บอกจำนวนใบ เลยกำหนด และแถบภาระเทียบกับจุดที่หนักสุด",
    tradeoff:
      "เป็นเส้นเดียวเรียงยาว ถ้าสถานีเยอะจะกินความกว้าง · ยังไม่เห็นตัวงานว่าใบไหนอยู่ตรงไหน ต้องกดเข้าไปดู",
  },
  map: {
    name: "B · แผนที่โรงงาน (โซนตามพื้นที่)",
    summary:
      "จัดเป็นโซนเหมือนเดินในโรงงานจริง: รับเข้า → โซนพิมพ์ → โซนรีด → ตรวจ+ส่ง ทั้งหมดอยู่ในกรอบ “ในโรงงาน Anajak” · งานที่อยู่ร้านรับจ้างอยู่ในกรอบเส้นประ **นอกกรอบโรงงาน** — เห็นทันทีว่าอะไรอยู่ในมือเรา อะไรอยู่ในมือคนอื่น",
    tradeoff:
      "โซนถูกกำหนดไว้ล่วงหน้า ถ้าเพิ่มขั้นใหม่ในสูตรต้องบอกว่าขั้นนั้นอยู่โซนไหน (ไม่งั้นไปกองรวมท้ายกรอบ) · ไม่มีเส้นเชื่อมบอกลำดับ ต้องรู้ flow อยู่แล้ว",
  },
  board: {
    name: "C · กระดานตามสถานี (เห็นตัวงาน)",
    summary:
      "คอลัมน์ = สถานี · การ์ด = ใบงานจริงที่กองอยู่ตรงนั้น (เลขออเดอร์ + ชื่อลูกค้า) ใบที่เลยกำหนดมีขอบแดง · คอลัมน์ร้านนอกใช้กรอบเส้นประแยกจากสายในโรงงาน",
    tradeoff:
      "เห็นตัวงานจริงแต่กินที่มากที่สุด ต้องเลื่อนแนวนอน · เหมาะกับหัวหน้ามากกว่าจอ TV เพราะตัวหนังสือเล็ก",
  },
};

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function FactoryCanvasProtoPage() {
  const [variant, setVariant] = useProtoVariant<FactoryCanvasVariant>("v", CANVAS_MODES, "flow");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const Canvas = CANVAS_COMPONENTS[variant];

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          จอรวมการผลิตแบบ canvas — เห็นทั้งโรงงานในภาพเดียว
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary">
          ของเดิมที่มีอยู่แล้ว (จอโรงงาน <code className="rounded bg-surface-muted px-1">/factory</code>) เป็นกริดการ์ดศูนย์งาน
          บอกภาระแต่ละจุดได้ แต่<strong className="font-semibold text-strong">ไม่มีเส้นทาง ไม่เห็นว่างานไหลไปไหน
          และไม่แยกในโรงงาน/นอกโรงงาน</strong> — สามแบบนี้เติมสิ่งที่ขาด ตัวเลขยังมาจากชุดเดิมทั้งหมด
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              options={OPTIONS.map((option) => ({ ...option }))}
              value={variant}
              onChange={setVariant}
              aria-label="เลือกแบบที่จะดู"
              className="min-w-max"
            />
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

        <div className="mt-5 border-l-2 border-blue-600 pl-4 dark:border-blue-400">
          <h2 className="text-lg font-semibold">{copy.name}</h2>
          <p className="mt-1.5 text-sm text-secondary">{copy.summary}</p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">ข้อแลก:</span> {copy.tradeoff}
          </p>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl bg-bg p-5 ring-1 ring-inset ring-border sm:p-6">
          <Canvas />
        </section>

        <section className="card-surface mt-8 rounded-2xl p-5 text-xs text-secondary">
          <p className="text-sm font-semibold text-strong">สิ่งที่ต้องรู้</p>
          <ul className="mt-2 space-y-1.5">
            <li>· ตัวเลขทุกตัวมาจาก board ตัวจริง (จำนวนใบค้าง + เลยกำหนดรายสถานี) — ไม่มีเลขแต่งขึ้นเอง</li>
            <li>· สถานีที่ไม่มีงานจะจางลง แต่ยังอยู่ในผัง เพื่อให้ตำแหน่งของแต่ละจุดนิ่งทุกวัน</li>
            <li>· รายชื่อสถานีมาจากสูตรขั้นงาน — วันที่แก้สูตรในหน้าตั้งค่า ผังนี้เปลี่ยนตามเอง</li>
            <li>· ยังไม่ได้ทำให้กดที่ node แล้วเปิดรายการงาน — ถ้าเลือกแบบไหนแล้วค่อยต่อ</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
