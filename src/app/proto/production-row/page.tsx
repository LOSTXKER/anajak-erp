"use client";

/**
 * หน้าลอง: แถวในหน้ารวมการผลิตต้องปรับตามผังสายพานคู่ (R3) ไหม
 *
 * เบสถามหลังเลือก R3 ในหน้าใบงาน: *"แล้วหน้ารวมการผลิตต้องปรับด้วยมั้ย"*
 * — เทียบเฉพาะ "คอลัมน์ความคืบหน้า" ส่วนอื่นของหน้ารวมไม่แตะ
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { Section } from "@/components/ui/section";

import { useProtoVariant } from "../_kit/use-proto-variant";
import { ROW_MODES, RowTable, type ProductionRowVariant } from "./_variants";

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "rail", label: "A · รางย่อในแถว" },
  { value: "twolane", label: "B · รางย่อสองสาย" },
  { value: "segment", label: "C · แถบแบ่งช่วงสี" },
] as const;

const COPY: Record<
  ProductionRowVariant,
  { name: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — แถบเปอร์เซ็นต์",
    summary:
      "คอลัมน์ความคืบหน้าเป็น “2/5 ช่วง · 40%” กับแถบยาว — บอกว่าไปได้เท่าไรแล้ว แต่ไม่บอกว่าค้างตรงไหน และไม่บอกว่างานอยู่ในมือเราหรืออยู่ที่ร้าน",
    tradeoff:
      "อ่านง่ายที่สุดและแคบที่สุด · แต่พูดคนละภาษากับผังในใบงาน ซึ่งเล่าเรื่องเป็นเส้นทาง",
  },
  rail: {
    name: "A · รางย่อในแถว",
    summary:
      "ย่อรางเดียวกับในใบงานมาเป็นจุดเล็ก ๆ ในแถว (เตรียมเสื้อ · พิมพ์ฟิล์ม · รีดร้อน · ร้านนอก · QC · แพ็ค) พร้อมบรรทัดบอก “อยู่ที่ …” · จุดสีชุดเดียวกับใบงาน เขียว=ผ่าน · ส้ม=กำลังทำ · แดง=มีปัญหา",
    tradeoff:
      "จุดเล็กมาก ต้องเอาเมาส์ชี้ถึงจะรู้ชื่อจุด (บนจอทัชชี้ไม่ได้ จึงเหลือแค่บรรทัด “อยู่ที่ …”) · เห็นตำแหน่ง แต่ไม่เห็นเปอร์เซ็นต์แล้ว",
  },
  twolane: {
    name: "B · รางย่อสองสาย (เข้าชุดกับ R3)",
    summary:
      "แถวบน = สายเรา · แถวล่าง = สายร้านนอก (มีไอคอนรถนำหน้า) — ภาษาเดียวกับผังสายพานคู่ในใบงานเป๊ะ · เห็นทันทีว่างานใบนี้ติดอยู่ฝั่งไหน ซึ่งแก้คนละวิธี",
    tradeoff:
      "สูงสองบรรทัด ทำให้แถวสูงขึ้นเล็กน้อย · ใบที่ไม่มีงานร้านนอกจะเหลือแถวเดียว ดูไม่สมมาตรกับใบอื่น",
  },
  segment: {
    name: "C · แถบเดียวแบ่งช่วงสี",
    summary:
      "แถบเดียวเหมือนเดิมแต่แบ่งเป็นช่วงตามขั้นจริง แล้วย้อมสีตามสถานะแต่ละช่วง · ใต้แถบบอกชื่อขั้นที่ค้างอยู่",
    tradeoff:
      "กะทัดรัดที่สุดในสามแบบใหม่ แต่ช่วงมีความกว้างเท่ากันหมด จึงไม่สื่อว่าขั้นไหนใช้เวลานานกว่ากัน · ไม่แยกสายเรา/ร้านนอก",
  },
};

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function ProductionRowProtoPage() {
  const [variant, setVariant] = useProtoVariant<ProductionRowVariant>("v", ROW_MODES, "current");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          หน้ารวมการผลิตต้องปรับตามผังสายพานคู่ไหม
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-secondary">
          เบสเลือกผังสายพานคู่ (R3) ในหน้าใบงานแล้ว — หน้ารวมยัง<strong className="font-semibold text-strong">ใช้งานได้ปกติ ไม่พัง</strong>{" "}
          แต่มีสองจุดที่พูดคนละภาษากับใบงาน: ① ความคืบหน้าเป็นเปอร์เซ็นต์ ไม่บอกว่าค้างตรงไหนของเส้นทาง
          ② ในแถวไม่มีอะไรบอกว่างานอยู่ที่ร้านนอก ทั้งที่งานสองแบบนี้ตามคนละวิธี ·
          เทียบเฉพาะคอลัมน์เดียว ส่วนอื่นของหน้ารวมไม่แตะ
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

        <section className="mt-6">
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6">
            <Section title="งานผลิต" bordered={false}>
              <RowTable mode={variant} />
            </Section>
          </div>
        </section>

        <section className="card-surface mt-8 rounded-2xl p-5 text-xs text-secondary">
          <p className="text-sm font-semibold text-strong">สิ่งที่ต้องรู้</p>
          <ul className="mt-2 space-y-1.5">
            <li>· จุดบนรางมาจาก rail ตัวจริงของระบบ (เตรียมเสื้อ · พิมพ์ฟิล์ม · รีดร้อน · ร้านนอก · ตรวจ QC · แพ็ค) — ใบไหนไม่มีขั้นนั้นจุดจะหายไปเอง ไม่ได้วาดตายตัว</li>
            <li>· สีจุดใช้ชุดเดียวกับผังในใบงาน เพื่อให้สองหน้าพูดภาษาเดียวกัน</li>
            <li>· คอลัมน์ “สถานะ” (ขั้นที่ค้างอยู่) ไม่ได้แตะในหน้าลองนี้ — ยังเป็นแบบที่เบสเคาะไว้แล้ว</li>
            <li>· ถ้าเลือกแบบ B ต้องยอมให้แถวสูงขึ้นเล็กน้อย (สองบรรทัด)</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
