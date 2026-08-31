"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { PROTO_TODAY_LABEL } from "./_data";
import { ProductionListPreview } from "./_preview";

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: "ของจริงตอนนี้" มาก่อนเสมอ · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่แค่สี/ระยะ

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "dense", label: "A · แน่น" },
  { value: "focus", label: "B · ชัด" },
  { value: "bar", label: "C · แถบเดียว" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

const COPY: Record<
  Variant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้",
    idea: "สิ่งที่เปิด /production แล้วเจอวันนี้",
    summary:
      "การ์ดตัวเลข 5 ใบสูง 87px (บนมือถือกลายเป็น 3 แถว) · ตารางหกคอลัมน์: ออเดอร์ (รูปม็อกอัพ + เลข + ลูกค้า) · ต้องทำต่อ (เหตุผล + เจ้าของถัดไป + ป้ายสายงาน) · ความคืบหน้าเป็นแท่งเปอร์เซ็นต์ · จำนวน (โผล่เฉพาะจอกว้างมาก) · กำหนดส่ง · ลูกศร · แถวสูงจริง 107px (โค้ดตั้งไว้ 82px แต่เนื้อในสามบรรทัดดันให้สูงกว่านั้น) จึงเห็นงานได้ 5 แถวต่อหนึ่งจอ",
    tradeoff:
      "อ่านง่ายและคุ้นมือแล้ว แต่ต้องเลื่อนลง 328px กว่าจะถึงงานใบแรก · การ์ดที่เลือกอยู่บอกด้วยสีเส้นขอบอย่างเดียว ซึ่งแทบมองไม่เห็น · แท่งเปอร์เซ็นต์บอกว่า “เดินไปกี่ช่วง” แต่ไม่บอกว่า “ค้างอยู่ช่วงไหน”",
  },
  dense: {
    name: "A · แน่น",
    idea: "หน้านี้คือรายการงาน ไม่ใช่แดชบอร์ด",
    summary:
      "การ์ดกรองบีบจาก 87px เหลือ 56px (ไอคอน–ชื่อ–ตัวเลข อยู่บรรทัดเดียว) และแถวตารางลดจาก 107px เหลือ 63px โดยยกของที่เคยอยู่คนละบรรทัดมาต่อกัน — เจ้าของถัดไปกับสายงานย้ายมาอยู่บรรทัดเดียวกันใต้เหตุผล · แท่งความคืบหน้าเหลือแท่งสั้นกับ “3/5” · วันที่กับป้ายกำหนดส่งอยู่บรรทัดเดียวกัน · ผลคือเห็น 9 แถวต่อจอ แทนที่จะเป็น 5 และทั้งหน้าสั้นลงจาก 1,676px เหลือ 1,129px",
    tradeoff:
      "ได้จำนวนงานต่อจอเกือบเท่าตัว แต่ตัวเลขบนการ์ดเล็กลงจนไม่ทำหน้าที่ “ป้ายบอกสถานการณ์” อีกต่อไป · ข้อความยาว (ชื่อบริษัทเต็ม เหตุผลยาว) โดนตัดคำมากกว่าเดิม เพราะเหลือบรรทัดเดียว · การ์ดกรองเตี้ยลงเหลือสูง 56px ซึ่งเป็นข้อเสียบนจอทัชในโรงงานที่นิ้วต้องกดโดน",
  },
  focus: {
    name: "B · ชัด",
    idea: "ขนาดเท่าเดิม แต่ให้ความเร่งด่วนอ่านได้จากหางตา",
    summary:
      "การ์ดที่เลือกอยู่ย้อมพื้นทั้งใบ + มีขีดสีบนหัว (ไม่ใช่แค่เส้นขอบ) และเพิ่มบรรทัดขยายว่ากองนั้น “เลยกำหนดกี่ใบ” · ในตาราง แถวมีแถบสีทางซ้ายตามความเร่ง (แดง/เหลือง/ไม่มี) · คอลัมน์ “ต้องทำต่อ” กว้างและหนาที่สุด · เปลี่ยนแท่งเปอร์เซ็นต์เป็น “รางช่วงงาน” 6 จุด (เตรียมเสื้อ · พิมพ์ฟิล์ม · รีดร้อน · ร้านนอก · ตรวจ QC · แพ็ค) พร้อมบรรทัด “อยู่ที่ …”",
    tradeoff:
      "ไม่ได้ช่วยเรื่อง “เห็นงานกี่แถว” เลย — แถวเตี้ยลง 4px แต่การ์ดสูงขึ้น 19px เพราะมีบรรทัดขยาย สุทธิแล้วยังเห็น 5 แถวเท่าเดิม ใครที่รู้สึกว่าหน้านี้เห็นงานน้อยไป จะยังรู้สึกเหมือนเดิม · วันที่งานแดงเยอะ ๆ แถบสีซ้ายจะกลายเป็นแถบแดงยาวจนไม่ช่วยแยกอะไร · จุดบนรางเล็ก ต้องเอาเมาส์ชี้ถึงจะรู้ชื่อช่วง (บนมือถือชี้ไม่ได้ จึงเหลือแค่บรรทัด “อยู่ที่ …”)",
  },
  bar: {
    name: "C · แถบเดียว",
    idea: "เอาการ์ดออก แล้วให้รายการบอกเวลาแทน",
    summary:
      "ตัวกรอง 5 มุมยุบเป็นแถบเดียวสูง 36px ในแถบเครื่องมือ (ใช้ปุ่มกรองตัวจริงของระบบ มีตัวเลขติดในชิป) — ไม่มีการ์ดเลย · ตารางแบ่งหัวข้อตามกำหนดส่ง: เลยกำหนดแล้ว · ส่งวันนี้ · ส่งพรุ่งนี้ · ภายในสัปดาห์นี้ · หลังจากนั้น · ยังไม่กำหนดส่ง · คอลัมน์จำนวนโผล่ตั้งแต่จอกลาง (ของเดิมต้องจอกว้างมาก) และในแถวเหลือแค่วันที่ เพราะหัวข้อกลุ่มบอกความเร่งแล้ว",
    tradeoff:
      "ได้ระเบียบเรื่องเวลามาเต็ม ๆ แต่ไม่ได้พื้นที่คืนอย่างที่คิด — ถึงการ์ด 87px จะหายไป แถบตัวกรองกับแถบเครื่องมือก็กินคืนเกือบหมด งานใบแรกมาถึงเร็วขึ้นแค่ 29px และยังเห็น 5 แถวเท่าเดิม ส่วนทั้งหน้ากลับ **ยาวขึ้น** เป็น 1,755px เพราะหัวข้อกลุ่มมาคั่น · เสียตัวเลขสรุปตัวใหญ่ไปเลย (เหลือเลขจิ๋วในชิป) · การจัดกลุ่มทับการเรียง — กด “เรียงตามจำนวน” ที่หัวตารางจะเรียงภายในกลุ่มเท่านั้น ไม่ใช่ทั้งตาราง",
  },
};

/** ข้อเท็จจริงที่วัดมาจากของจริง ไม่ใช่ความเห็น */
const NOTES = [
  "ทั้งสี่แบบอ่านจากข้อมูลก้อนเดียวกัน ที่เดินผ่าน buildProductionBoard() ตัวจริง — เหตุผล “ต้องทำต่อ” เจ้าของถัดไป ป้ายสายงาน ตัวเลขบนการ์ด และลำดับการเรียง จึงมาจากสูตรเดียวกับหน้าจริงทุกบรรทัด ไม่มีข้อความไหนแต่งขึ้นเอง",
  "หัวหน้า เมนูโมดูลผลิต ช่องค้นหา ช่องเรียง ตัวบอกเวลาอัปเดต ป้าย และรูปย่อม็อกอัพ = component ตัวจริงทั้งหมด และเหมือนกันทุกแบบโดยตั้งใจ",
  "จอจริงของหน้านี้คือคอมของเบสกับจอทัชในโรงงาน (ไม่ใช่มือถือช่าง) — ขนาดปุ่มบนจอทัชจึงเป็นข้อแลกจริงของแบบ A ไม่ใช่เรื่องรอง",
  "ชุดตัวอย่างมี 12 ใบ = ปริมาณงานสัปดาห์ปกติ · กดปุ่ม “ดูตอนงานล้น” เป็น 24 ใบ = ช่วงเปิดเทอม ซึ่งเป็นตอนที่ความแตกต่างเรื่องความหนาแน่นมีผลจริง",
  "มีครบทุกสถานะขอบที่หน้าจริงเจอ: เลยกำหนด · ส่งวันนี้ · ด่วน · ไม่กำหนดส่ง · ขั้นงานพัง · รีดร้อนติดรอของร้านนอก · คิวติดด่านมัดจำ · งานผสมสามสายจนป้ายล้นเป็น “+1” · ชื่อบริษัทยาวจนต้องตัดคำ · ออเดอร์ที่ยังไม่มีม็อกอัพ (ขึ้นกรอบประว่าง)",
  `“วันนี้” ของหน้าลองตรึงไว้ที่ ${PROTO_TODAY_LABEL} — ตัวเลข “เลยกำหนด/ส่งวันนี้” จึงนิ่ง ไม่เปลี่ยนตามวันที่เปิดดู`,
] as const;

/** สิ่งที่หน้าลองนี้ยังไม่ครอบ — เขียนไว้ให้เห็น ดีกว่าให้มาจับได้ทีหลัง */
const OUT_OF_SCOPE = [
  "เทียบเฉพาะ “การ์ดกรอง” กับ “ตาราง” ตามที่สั่ง — หัวหน้า เมนูโมดูล แถบเตือนข้อมูลไม่สด และหน้าต่างสร้างใบผลิต ไม่ได้ถูกแตะเลย",
  "กดแถวแล้วจะพาไปหน้าใบผลิตจริง ซึ่งจะขึ้นว่าไม่พบข้อมูล เพราะรหัสในหน้าลองเป็นของปลอม — เป็นแบบนี้เหมือนกันทั้งสี่แบบ",
  "หน้าจริงมีการคืนโฟกัสกลับไปที่แถวเดิมหลังกดย้อนกลับ (จำด้วย sessionStorage) — แบบ A/B/C ยังไม่ได้ทำส่วนนั้น ถ้าเคาะแบบไหนจะยกมาให้ครบตอนลงของจริง",
  "สถานะโหลด / โหลดพัง / ไม่มีสิทธิ์ ใช้ของจริงชุดเดียวกันทุกแบบ จึงไม่ได้เอามาเทียบ",
  "แบบ C ยังไม่ได้ทำให้หัวข้อกลุ่มเกาะอยู่บนสุดตอนเลื่อน (sticky) — ถ้าเคาะ C ค่อยตัดสินใจเรื่องนั้นอีกที",
] as const;

/** วัดด้วยเบราว์เซอร์จริง จอ 1440x900 · ธีมสว่าง · ชุดตัวอย่าง 12 ใบ (31 ส.ค. 2569) */
const MEASURED = [
  {
    value: "current",
    name: "ของจริงตอนนี้",
    filter: "87 px",
    row: "107 px",
    firstRow: "328 px",
    rowsPerScreen: "5 แถว",
    page: "1,676 px",
  },
  {
    value: "dense",
    name: "A · แน่น",
    filter: "56 px",
    row: "63 px",
    firstRow: "308 px",
    rowsPerScreen: "9 แถว",
    page: "1,129 px",
  },
  {
    value: "focus",
    name: "B · ชัด",
    filter: "106 px",
    row: "103 px",
    firstRow: "347 px",
    rowsPerScreen: "5 แถว",
    page: "1,647 px",
  },
  {
    value: "bar",
    name: "C · แถบเดียว",
    filter: "36 px (ในแถบเครื่องมือ)",
    row: "103 px",
    firstRow: "299 px",
    rowsPerScreen: "5 แถว",
    page: "1,755 px",
  },
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function ProductionListProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [busy, toggleBusy] = useProtoFlag("busy");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  const src = `/proto/production-list/view?v=${variant}&busy=${busy ? "1" : "0"}`;

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
          หน้าควบคุมการผลิต — การ์ดกรองกับตาราง ควรเป็นแบบไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          โจทย์คือ “ทำหน้านี้ใหม่ เฉพาะการ์ดกรองกับตาราง” — โครงหน้าและข้อมูลเท่าเดิมทุกช่อง
          สามแบบข้างล่างคิดคนละอย่างว่า “ใหม่” ควรแปลว่าอะไร: เห็นงานเยอะขึ้น ·
          เห็นสิ่งที่ต้องแตะก่อนชัดขึ้น · หรือเอาการ์ดออกไปเลยแล้วให้รายการบอกเวลาแทน
          เลือกมาหนึ่งแบบแล้วค่อยลงมือกับหน้าจริง
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
            <ProductionListPreview variant={variant} busy={busy} />
          </div>
        </section>

        {/* ตัวเลขที่วัดจากของจริง — โจทย์เรื่องความหนาแน่นต้องตัดสินด้วยตัวเลข ไม่ใช่ความรู้สึก */}
        <section className="card-surface mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">กินที่เท่าไร เห็นงานกี่แถว (วัดจากเบราว์เซอร์จริง)</h2>
          <p className="mt-1 text-xs text-muted">
            วัดบนจอ 1440x900 ธีมสว่าง ชุดตัวอย่าง 12 ใบ · “กว่าจะถึงงานใบแรก” นับจากขอบบนของหน้า
            ลงมาถึงขอบบนของแถวแรก · “เห็นกี่แถว” คือจำนวนแถวที่อยู่ครบทั้งแถวในจอโดยไม่ต้องเลื่อน ·
            แบบ C มีหัวข้อกลุ่มมาคั่นด้วย จึงยาวกว่าตอนไม่จัดกลุ่ม
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-left text-xs">
                  <th className="py-2 pr-3 font-medium">แบบ</th>
                  <th className="py-2 pr-3 font-medium">แถบตัวกรองสูง</th>
                  <th className="py-2 pr-3 font-medium">แถวสูง</th>
                  <th className="py-2 pr-3 font-medium">กว่าจะถึงงานใบแรก</th>
                  <th className="py-2 pr-3 font-medium">เห็นกี่แถว</th>
                  <th className="py-2 font-medium">ทั้งหน้า</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {MEASURED.map((row) => (
                  <tr
                    key={row.value}
                    className={
                      row.value === variant ? "font-medium text-strong" : "text-secondary"
                    }
                  >
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.filter}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.row}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.firstRow}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.rowsPerScreen}</td>
                    <td className="py-2 tabular-nums">{row.page}</td>
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
