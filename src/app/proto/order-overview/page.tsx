"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { OrderShell } from "./_shell";
import { CoverVariant } from "./_variants/cover";
import { CurrentVariant } from "./_variants/current";
import { PairVariant } from "./_variants/pair";
import { StripVariant } from "./_variants/strip";

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: "ปัจจุบัน" มาก่อนเสมอ · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่แค่สี/ระยะ

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "strip", label: "A · แถบลายบนสุด" },
  { value: "pair", label: "B · ลายคู่ข้อมูล" },
  { value: "cover", label: "C · ลายคือหน้าปก" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

const COPY: Record<
  Variant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — แบบ B ที่ลงจริงแล้ว (2026-08-31)",
    idea: "เบสเลือกแบบ B แล้วลงของจริงในวันเดียวกัน",
    summary:
      "component ตัวจริงของหน้า /orders/[id] (OrderOverviewTab + OrderArtworkCardView) ต่างจากหน้าจริงแค่ข้อมูลปลอม — ซ้ายบนสุดคือการ์ด “งานนี้พิมพ์อะไร” (รูปย่อทุกด้าน กดขยายได้ · สถานะแบบ · รายละเอียดงาน · สรุปจำนวนไฟล์) ตามด้วยการ์ดลูกค้าที่ประวัติเหลือบรรทัดเดียว · ขวาเป็นข้อมูลออเดอร์ · จัดส่ง · แบรนด์ · บรรทัดเวลา",
    tradeoff:
      "หน้าตาก่อนมีลาย (ที่ต้องกดข้ามไปแท็บม็อกอัพทุกครั้ง) ดูย้อนหลังได้จากประวัติ Git เท่านั้น — หน้าลองนี้ชี้ไปที่ของจริง จึงเปลี่ยนตามของจริงเสมอ · บนมือถือลายยังอยู่ถัดจากบล็อกข้อมูลออเดอร์/จัดส่ง เพราะกติกาเดิมบังคับให้กำหนดส่ง/ยอดมาก่อนเสมอ",
  },
  strip: {
    name: "A · แถบลายบนสุด",
    idea: "เติมของที่ขาด ไม่รื้ออะไรเลย",
    summary:
      "เพิ่มแถบ “ลายและไฟล์งาน” เตี้ย ๆ ไว้บนสุด — รูปย่อทุกด้านเรียงซ้าย (กดขยายได้) · ป้ายสถานะแบบ · จำนวนไฟล์ลูกค้า/ไฟล์พิมพ์ · ปุ่มไปแท็บม็อกอัพ ส่วนข้างล่างคือของเดิมทั้งดุ้น ไม่ขยับสักช่อง",
    tradeoff:
      "เสี่ยงน้อยที่สุด (ของเดิมไม่ถูกแตะเลย) แต่ยังเป็นแบบเดียวที่ทำให้หน้ายาวขึ้น เพราะแถบใหม่ไปวางทับบนของเดิมที่ยังยาวเท่าเดิม · บนมือถือต้องเลื่อนผ่านแถบลายก่อนถึงกำหนดส่ง/ยอด",
  },
  pair: {
    name: "B · ลายคู่ข้อมูล",
    idea: "ภาพรวมตอบ 3 คำถาม — ทำอะไร · ให้ใคร · ส่งเมื่อไหร่เท่าไร",
    summary:
      "ซ้ายบนสุดเป็นการ์ด “งานนี้พิมพ์อะไร”: รูปย่อทุกด้าน + สถานะแบบ + รายละเอียดงาน + สรุปจำนวนไฟล์ รวมอยู่ในการ์ดเดียว เพราะพูดเรื่องเดียวกัน · การ์ดลูกค้าย่อลง: ประวัติ 4 ช่อง (ยอดสะสม · จำนวนครั้ง · สั่งล่าสุด · วงเงิน) ยุบเป็นบรรทัดเดียวใต้ชื่อ ค่าอยู่ครบไม่ได้ตัดทิ้ง · คอลัมน์ขวาเหมือนของจริงทุกช่อง",
    tradeoff:
      "ได้ลายเข้ามาฟรี ๆ โดยหน้าไม่ยาวขึ้นเลย แต่ก็ไม่สั้นลงด้วย — โครงยังเป็นสองคอลัมน์เหมือนเดิม คนที่รู้สึกว่า “ข้อมูลเยอะไป” จะยังรู้สึกเหมือนเดิม · ไฟล์เห็นแค่จำนวน ต้องกดเข้าแท็บม็อกอัพถึงจะรู้ชื่อไฟล์ · ประวัติลูกค้าบรรทัดเดียวอ่านเร็ว แต่เทียบตัวเลขยากกว่าตอนแยกช่อง",
  },
  cover: {
    name: "C · ลายคือหน้าปก",
    idea: "ภาพรวมคือหน้าปกของงาน ไม่ใช่แฟ้มข้อมูล",
    summary:
      "เรียงตามลำดับที่คนถามจริง — ① แถบข้อเท็จจริงบนสุดไม่มีการ์ด (กำหนดส่ง · จำนวน · ยอด · ลูกค้า · สถานะแบบ) ② แถบลายบนพื้นจม สามช่องแนวนอน: รูปย่อ · รายละเอียดงาน · รายชื่อไฟล์ทั้งหมด (ไฟล์พิมพ์ติดกุญแจ) ③ ข้อมูลที่เหลือยุบเป็นแถวป้าย-ค่าตัวเล็กสามคอลัมน์ — ทุกช่องที่ของจริงมียังอยู่ครบ ไม่มีอันไหนหาย",
    tradeoff:
      "แบบเดียวที่หน้าสั้นลงกว่าเดิมทั้งที่เพิ่มลายกับไฟล์เข้ามา แต่แลกด้วยการรื้อโครงแท็บใหม่ทั้งแท็บ (ของเดิมเหลือแค่เนื้อหา ไม่เหลือรูปทรง) · แถวเล็กเรียงถี่ ตาทำงานหนักกว่าเมื่ออ่านนาน ๆ · ค่าไทยยาว (ที่อยู่ · หมายเหตุ) ทำให้แถวสูงไม่เท่ากันจนคอลัมน์ดูไม่เรียบ",
  },
};


/** ความสูงทั้งหน้าของใบตัวอย่างเดียวกัน วัดด้วยเบราว์เซอร์จริง 2026-08-31 (ธีมสว่าง · เห็นเงิน) */
const HEIGHTS = [
  { value: "current", name: "ก่อนมีลาย (ของจริงเดิม)", desktop: "1,605 px", mobile: "3,677 px" },
  { value: "strip", name: "A · แถบลายบนสุด", desktop: "1,795 px (+12%)", mobile: "4,049 px (+10%)" },
  { value: "pair", name: "B · ลายคู่ข้อมูล", desktop: "1,605 px (เท่าเดิม)", mobile: "3,629 px (−1%)" },
  { value: "cover", name: "C · ลายคือหน้าปก", desktop: "1,550 px (−3%)", mobile: "3,386 px (−8%)" },
] as const;

/** ข้อเท็จจริงที่วัดมาจากของจริง — ไม่ใช่ความเห็น */
const NOTES = [
  "รูปลายทุกแบบเป็นรูปย่อ (48–64 px) ตามที่เบสสั่ง 2026-08-31 — “ให้เห็นเล็ก ๆ ผ่านก็ได้ ถ้าอยากรู้ค่อยกดไปดู” · กดรูปแล้วขยายเต็มจอได้จริงทุกใบ",
  "รูปม็อกอัพในหน้านี้เดินผ่านสูตรจริงของระบบ (mockupImages / mockupCoverImage) และตัวดูรูปตัวจริง — เลือกรูปและนับรูปเหมือนหน้าจริงทุกประการ",
  "ใบตัวอย่างมีม็อกอัพ 3 เวอร์ชัน: v3 ลูกค้าอนุมัติแล้ว (3 ด้าน) · v2 ขอแก้ (2 ด้าน) · v1 เป็นเวอร์ชันยุคเก่าที่มีแค่รูปปกใบเดียว — ของจริงมีใบแบบนี้อยู่เต็มฐาน ทุกแบบต้องรอด",
  "ไฟล์แนบมีทั้งที่ดูตัวอย่างได้ (รูป) และดูไม่ได้ (.ai / .pdf / .dst) — ของจริงต้องขึ้นไอคอนแทนรูปแตก และไฟล์พิมพ์ชั้น 3 ต้องมีสัญลักษณ์ว่าเป็นของภายใน",
  "ไฟล์ที่ลูกค้าอัปเองผ่านลิงก์ (uploadedById = null) ติดป้าย “ลูกค้าส่ง” เหมือนของจริง",
  "ทั้ง 4 แบบใช้ข้อมูลชุดเดียวกันจากไฟล์เดียว จึงไม่มีแบบไหนได้เปรียบเพราะตัดของออก",
  "หัวใบ · แถบสถานะ · แถบแท็บ · ปุ่มขั้นต่อไป = ของจริงทั้งหมด และเหมือนกันทุกแบบโดยตั้งใจ",
] as const;

/** สิ่งที่หน้าลองนี้ยังไม่ครอบ — เขียนไว้ให้เห็น ดีกว่าให้มาจับได้ทีหลัง */
const OUT_OF_SCOPE = [
  "เทียบเฉพาะ “แท็บภาพรวม” — อีก 6 แท็บยังหน้าตาเดิม และกดไม่ได้ในหน้าลอง",
  "แท็บ “ม็อกอัพ & ไฟล์” ตัวจริง (อัปม็อกอัพ · อนุมัติแทนลูกค้า · ลิงก์ให้ลูกค้าดู · ลบไฟล์) ไม่ถูกแตะเลย — สิ่งที่เพิ่มในภาพรวมคือ “ที่ดู” ไม่ใช่ “ที่จัดการ” ม็อกอัพยังมีบ้านเดียวเหมือนเดิม",
  "รูปในหน้าลองเป็นภาพวาดปลอมที่ทำขึ้นให้ตรงกับใบตัวอย่าง (โปโลกรมท่า ปักอกซ้าย + DTF หลัง) — ของจริงเป็นรูปถ่าย/ไฟล์กราฟิกจาก R2 ซึ่งสัดส่วนไม่เท่ากันทุกใบ รูปย่อจึงครอบเป็นสี่เหลี่ยมจัตุรัส (ตัดขอบ) เหมือนรูปย่อที่ระบบใช้อยู่ ส่วนตอนกดขยายเห็นเต็มรูปไม่ตัด",
  "ปุ่มทุกปุ่มกดแล้วยังไม่ทำอะไร (แก้ไข · เปิดหน้าลูกค้า · ดูการจัดส่ง · ไปแท็บม็อกอัพ) — ยกเว้นกดรูปเพื่อขยาย ซึ่งทำงานจริง",
  "ยังไม่ได้แตะเมนู ⋯ และแถบเตือนนอกแท็บ (ส่งแบบไม่ระบุผู้ส่ง · หมายเหตุใบนี้)",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

function Preview({
  variant,
  thin,
  showMoney,
}: {
  variant: Variant;
  thin: boolean;
  showMoney: boolean;
}) {
  const props = { thin, showMoney };
  return (
    <OrderShell {...props}>
      {variant === "strip" ? (
        <StripVariant {...props} />
      ) : variant === "pair" ? (
        <PairVariant {...props} />
      ) : variant === "cover" ? (
        <CoverVariant {...props} />
      ) : (
        <CurrentVariant {...props} />
      )}
    </OrderShell>
  );
}

export default function OrderOverviewProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [thin, toggleThin] = useProtoFlag("thin");
  const [hideMoney, toggleHideMoney] = useProtoFlag("nomoney");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  const src =
    `/proto/order-overview/view?v=${variant}` +
    `&thin=${thin ? "1" : "0"}` +
    `&money=${hideMoney ? "0" : "1"}`;

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
          ภาพรวมออเดอร์ — กระชับแต่ครบ และเห็นลายตั้งแต่เปิด
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          วันนี้เปิดใบงานมาแล้วยังไม่รู้ว่างานนี้พิมพ์อะไร ต้องกดไปอีกแท็บก่อนเสมอ — สามแบบข้างล่างคิดคนละอย่างว่า
          “เอาลายมาไว้ในภาพรวม” ควรแลกกับอะไร เลือกมาหนึ่งแบบแล้วค่อยลงมือกับหน้าจริง
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
            <Button variant="outline" size="sm" onClick={toggleThin}>
              {thin ? "ดูใบที่ข้อมูลครบ" : "ดูใบที่เพิ่งเปิด (ยังไม่มีม็อกอัพ)"}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleHideMoney}>
              {hideMoney ? "ดูแบบเจ้าของ (เห็นเงิน)" : "ดูแบบช่าง (ไม่เห็นเงิน)"}
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

        {/* จอคอม */}
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              บนคอม
            </p>
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
            <Preview variant={variant} thin={thin} showMoney={!hideMoney} />
          </div>
        </section>

        {/* ความยาวหน้าที่วัดจากของจริง — โจทย์คือ "กระชับ" ตัวเลขจึงต้องอยู่ตรงหน้า ไม่ใช่ความรู้สึก */}
        <section className="mt-8 card-surface rounded-2xl p-5">
          <h2 className="text-sm font-semibold">ยาวแค่ไหน (วัดจากหน้าจริง)</h2>
          <p className="mt-1 text-xs text-muted">
            ความสูงทั้งหน้าของใบตัวอย่างใบเดียวกัน วัดด้วยเบราว์เซอร์เมื่อ 31 ส.ค. 2569 ตอนเทียบ
            (ก่อนลงของจริง) — ยิ่งน้อยยิ่งต้องเลื่อนน้อย · แถว “ก่อนมีลาย” คือหน้าเดิมที่ยังต้อง
            กดข้ามไปแท็บม็อกอัพ ตอนนี้ของจริงเป็นแบบ B แล้ว
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-left text-xs">
                  <th className="py-2 pr-3 font-medium">แบบ</th>
                  <th className="py-2 pr-3 font-medium">บนคอม (จอ 1280)</th>
                  <th className="py-2 font-medium">บนมือถือ (จอ 375)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {HEIGHTS.map((row) => (
                  <tr key={row.name} className={row.value === variant ? "font-medium text-strong" : "text-secondary"}>
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.desktop}</td>
                    <td className="py-2 tabular-nums">{row.mobile}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            อยากดูของจริงบนจอแคบ: กด “เปิดขนาดมือถือ” ข้างบน (เปิดหน้าต่างกว้าง 390 จริง)
            หรือเปิดลิงก์เดียวกันบนมือถือ — หน้าลองไม่ฝังกรอบมือถือไว้ในหน้า เพราะเว็บนี้ตั้งค่า
            ห้ามถูกฝังใน iframe ไว้กัน clickjacking และไม่ควรเจาะรูนั้นเพื่อหน้าลอง
          </p>
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
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
