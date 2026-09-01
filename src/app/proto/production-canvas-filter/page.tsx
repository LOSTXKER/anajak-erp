"use client";

/**
 * หน้าลอง: เอาผังโรงงานมาเป็น "ตัวกรอง" ของหน้ารวมการผลิต
 * เบสเสนอเอง 2026-09-01: *"เอา A เป็น filter แทน ได้เห็นภาพรวม โครงสร้างโรงงานด้วย"*
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoVariant } from "../_kit/use-proto-variant";
import {
  FILTER_COMPONENTS,
  FILTER_MODES,
  type CanvasFilterVariant,
} from "./_variants";

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้ (แถบ 4 มุม)" },
  { value: "canvas", label: "A · ผังเต็มเป็นตัวกรอง" },
  { value: "compact", label: "A ย่อ · ผังเตี้ยเป็นตัวกรอง" },
] as const;

const COPY: Record<CanvasFilterVariant, { name: string; summary: string; tradeoff: string }> = {
  current: {
    name: "ของจริงตอนนี้ — แถบ 4 มุม",
    summary:
      "“ทุกงาน · ศูนย์งาน · ปัญหา · งานร้านนอก” เป็นแถบสลับมุมมอง แล้วมีตัวกรองละเอียดซ่อนในปุ่มกรองอีกที",
    tradeoff:
      "เตี้ยและคุ้นตา แต่ไม่บอกอะไรเลยเกี่ยวกับโครงสร้างโรงงาน — ต้องกดเข้าไปดูทีละมุมถึงจะรู้ว่างานกองอยู่ไหน",
  },
  canvas: {
    name: "A · ผังเต็มเป็นตัวกรอง",
    summary:
      "ผังโรงงานทำหน้าที่เป็นตัวกรองเลย — กด node ไหนตารางกรองเฉพาะงานในจุดนั้น กดซ้ำเพื่อล้าง · เห็นโครงสร้าง (ในโรงงาน / นอกโรงงาน) จำนวนงานค้าง และเลยกำหนดรายจุด พร้อมกันในที่เดียว · มุมข้าม (ทุกงาน · ต้องจัดการ) ยังอยู่ด้านบน",
    tradeoff:
      "**กินความสูงเยอะ** — วัดจริงแล้วงานใบแรกมาถึงที่ 671px เทียบกับแถบเดิม 166px (สูงขึ้น ~4 เท่า) · บนจอทัชต้องเลื่อนแนวนอนดูสายที่ยาว",
  },
  compact: {
    name: "A ย่อ · ผังเตี้ยเป็นตัวกรอง",
    summary:
      "โครงเดียวกับ A แต่ node ยุบเป็นชิปบรรทัดเดียว (ไอคอน · ชื่อ · จำนวน · เลยกำหนด) ยังแยกกรอบในโรงงาน/นอกโรงงานอยู่ · ได้โครงสร้างเหมือนกันแต่สูงประมาณครึ่งเดียว",
    tradeoff:
      "ไม่มีแถบภาระให้เทียบว่าจุดไหนหนักกว่ากัน (เหลือแค่ตัวเลข) · ชิปเล็กลง กดยากกว่าบนจอทัช · งานใบแรกมาถึงที่ 342px เทียบกับแถบเดิม 166px — สูงขึ้นเท่าตัว แต่ได้โครงสร้างมาแลก",
  },
};

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function ProductionCanvasFilterProtoPage() {
  const [variant, setVariant] = useProtoVariant<CanvasFilterVariant>("v", FILTER_MODES, "current");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const View = FILTER_COMPONENTS[variant];

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          เอาผังโรงงานมาเป็นตัวกรองของหน้ารวมการผลิต
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary">
          ไอเดียของเบสเอง: แทนที่จะมีแถบ 4 มุมที่ไม่บอกอะไร ให้{" "}
          <strong className="font-semibold text-strong">ผังโรงงานทำหน้าที่เป็นตัวกรองเลย</strong> —
          กดจุดไหนก็เห็นงานในจุดนั้น และได้เห็นโครงสร้างการผลิตไปพร้อมกันโดยไม่เพิ่มพื้นที่ใหม่ ·
          ตารางข้างล่างใช้คอลัมน์ “เส้นทางงาน” แบบ C ที่เบสเคาะไว้แล้ว
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
          <View />
        </section>

        <section className="card-surface mt-8 rounded-2xl p-5 text-xs text-secondary">
          <p className="text-sm font-semibold text-strong">สิ่งที่ต้องรู้</p>
          <ul className="mt-2 space-y-1.5">
            <li>· กดจุดในผังแล้วตารางกรองจริง (ลองกดดูได้) · กดซ้ำที่จุดเดิมเพื่อล้างตัวกรอง</li>
            <li>· “ทุกงาน” กับ “ต้องจัดการ” ยังต้องอยู่ เพราะเป็นคำถามข้ามสาย ไม่ใช่คำถามว่างานอยู่จุดไหน</li>
            <li>· จุดที่ไม่มีงานยังอยู่ในผัง (จางลง) เพื่อให้ตำแหน่งนิ่งทุกวัน — และตัวผังเองก็บอกโครงสร้างการผลิตอยู่แล้วแม้วันนั้นจะว่าง</li>
            <li>· <strong className="font-medium text-strong">วัดจริงบนจอ 1440:</strong> งานใบแรกมาถึงที่ — แถบเดิม 166px · ผังย่อ 342px · ผังเต็ม 671px (บทเรียนจากรอบก่อน: ยิ่งกินที่ก่อนถึงงาน ยิ่งต้องเลื่อนกว่าจะเห็นงานจริง)</li>
            <li>· ตัวกรองละเอียดเดิม (สถานะงาน · สถานะปัญหา) ยังไม่ได้ใส่ในหน้าลองนี้ — ถ้าเลือกแบบไหนแล้วค่อยตัดสินว่าจะเก็บไว้ในปุ่มกรองเหมือนเดิมหรือยุบเข้าผัง</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
