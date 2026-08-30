"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { CalmVariant } from "./_variants/calm";
import { CurrentVariant } from "./_variants/current";
import { DenseVariant } from "./_variants/dense";
import { LeadVariant } from "./_variants/lead";

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: "ปัจจุบัน" มาก่อนเสมอ · ทุกทางต้องมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่แค่สี

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "calm", label: "A · เรียบอย่างเอกสาร" },
  { value: "lead", label: "B · หัวใบนำสายตา" },
  { value: "dense", label: "C · แน่นครบจอ" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

const COPY: Record<
  Variant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — แบบ B ที่ลงจริงแล้ว (2026-08-30)",
    idea: "เบสเคาะแบบ B แล้วสั่งให้หัวใบบางลง → ลงของจริงเรียบร้อย",
    summary:
      "นี่คือ component ตัวจริงของหน้า /orders/[id] (PageHeader + OrderOverviewTab) ต่างจากหน้าจริงแค่ข้อมูลปลอม · หัวใบเหลือ เลขที่ · ป้ายสถานะ/ความเร่งด่วน · แถบสถานะ · ปุ่มขั้นต่อไป (ไม่มีชื่องานแล้ว — เบสสั่ง 2026-08-30) — ส่วนกำหนดส่ง/จำนวน/ยอด อยู่บนสุดของการ์ด “ข้อมูลออเดอร์”",
    tradeoff:
      "หน้าตาก่อนรื้อ (การ์ด “สรุปออเดอร์” เต็มแถวบนสุด + หัวข้อการ์ดตัวหนาเท่ากันหมด) ดูย้อนหลังได้จากประวัติ Git เท่านั้น — หน้าลองนี้ชี้ไปที่ของจริง จึงเปลี่ยนตามของจริงเสมอ",
  },
  calm: {
    name: "A · เรียบอย่างเอกสาร",
    idea: "ใบงานคือของที่ต้องอ่าน ไม่ใช่แดชบอร์ดที่ต้องสแกน",
    summary:
      "ถอดกรอบการ์ดออกทั้งหมด ใช้ที่ว่างกับเส้นบางเป็นตัวแบ่งแทน · ตัวหนังสือใหญ่ขึ้นหนึ่งขั้นทั้งหน้า ป้ายเล็กลงและจางลงจนอ่านเป็น “ป้าย” ทันที · ทุกอย่างเรียงลงมาทางเดียว ไม่ต้องกวาดตาสลับซ้าย-ขวา",
    tradeoff:
      "หน้ายาวขึ้น ต้องเลื่อนมากกว่าเดิม · บนจอกว้างจะเหลือที่ว่างด้านขวาเยอะ · ไม่มีกรอบช่วยแยกเรื่อง ต้องอาศัยหัวข้อกับระยะอย่างเดียว",
  },
  lead: {
    name: "B · หัวใบนำสายตา (เบสเคาะแล้ว · หัวบางลงตามสั่ง 2026-08-30)",
    idea: "หัวใบบอกแค่ “งานนี้คือใบไหน อยู่ขั้นไหน ต้องกดอะไรต่อ” — รายละเอียดไปอยู่ข้างล่าง",
    summary:
      "หัวใบเหลือ เลขที่ · ป้ายสถานะลูกค้า/ความเร่งด่วน · แถบสถานะ 11 ขั้น · ปุ่มขั้นต่อไป — มีแถบสีบางด้านซ้ายเมื่อใบนั้นเร่งด่วน · เนื้อหาที่เหลือเป็นการ์ดเงียบสองคอลัมน์ ตัวเล็กกว่าหัวชัดเจน",
    tradeoff:
      "กำหนดส่ง · จำนวนรวม · ยอดรวม ถูกย้ายลงไปบนสุดของการ์ด “ข้อมูลออเดอร์” (คอลัมน์ขวา) เพราะสามอย่างนี้ไม่มีที่อื่นในหน้า — แลกคือต้องกวาดตาลงไปอีกนิดกว่าจะเห็นยอดกับกำหนดส่ง ไม่ได้เห็นทันทีที่เปิดเหมือนตอนอยู่บนหัว",
  },
  dense: {
    name: "C · แน่นครบจอ",
    idea: "คนเปิดใบงานคือคนที่กำลังคุยโทรศัพท์อยู่ — ต้องหาเจอโดยไม่ต้องเลื่อน",
    summary:
      "อัดลงจอเดียว 3 คอลัมน์ · แถวเป็น “ป้ายซ้าย ค่าขวา” มีเส้นบางทุกแถว ตากวาดลงตามคอลัมน์ป้ายได้เร็ว · หัวใบยุบเหลือแถวเดียว (เลขที่ + ป้าย + ปุ่ม) · ตัวหนังสือเล็กลงหนึ่งขั้น หัวข้อกลุ่มเป็นแถบเทาบาง",
    tradeoff:
      "แน่นตา อ่านนาน ๆ ล้ากว่าสองแบบบน · ค่าไทยยาว (ที่อยู่ ชื่อบริษัท) ดันให้แถวสูงไม่เท่ากันจนคอลัมน์ดูไม่เรียบ · บนมือถือยุบเหลือคอลัมน์เดียว ยาวเท่าเดิม",
  },
};

/** ข้อเท็จจริงที่วัดมาจากของจริง — ไม่ใช่ความเห็น */
const NOTES = [
  "แท็บภาพรวมของจริงวาดได้สูงสุด 30 ช่อง จาก 4 การ์ด — ใบตัวอย่างนี้เปิดครบเกือบทุกช่อง",
  "ทั้ง 4 แบบใช้ “เนื้อหาชุดเดียวกัน” จากไฟล์เดียว จึงไม่มีแบบไหนได้เปรียบเพราะตัดของออก",
  "แถบสถานะ 11 ขั้น · แถบแท็บ 7 แท็บ · ปุ่ม “ขั้นต่อไป” = component ตัวจริงทั้งหมด ป้ายปุ่มมาจากตรรกะจริง",
  "ช่องที่ไม่มีค่าจะหายทั้งแถว (ของจริงทำแบบนี้อยู่แล้ว) — กดปุ่ม “ใบที่เพิ่งเปิด” เพื่อดูตอนข้อมูลยังว่าง",
  "ชื่อบริษัทกับที่อยู่ในใบตัวอย่างยาวเท่าของจริง เพื่อให้เห็นว่าแต่ละแบบตัดบรรทัดอย่างไร",
] as const;

/** สิ่งที่หน้าลองนี้ยังไม่ครอบ — เขียนไว้ให้เห็น ดีกว่าให้มาจับได้ทีหลัง */
const OUT_OF_SCOPE = [
  "เทียบเฉพาะ “แท็บภาพรวม” — อีก 6 แท็บ (รายการ · งานผลิต · จัดส่ง · เงิน & บิล · ม็อกอัพ & ไฟล์ · ประวัติ) ยังไม่แตะ กดไม่ได้ในหน้าลอง",
  "แถบสถานะกับแถบแท็บใช้ของจริงเหมือนกันทั้ง 4 แบบโดยตั้งใจ — จะได้รู้ว่าที่ชอบ/ไม่ชอบมาจากเนื้อหาในแท็บ ไม่ใช่จากของที่เปลี่ยนไปพร้อมกันหลายอย่าง (ยกเว้นแบบ B ที่ย้ายแถบสถานะเข้าไปในหัวใบ ซึ่งเป็นหัวใจของแบบนั้น)",
  "หน้านี้เทียบบนความกว้างจอคอม — ไม่มีกรอบมือถือวางคู่ให้ดู เพราะของจริงตัดสินเลย์เอาต์จาก \"ขนาดหน้าต่างเบราว์เซอร์\" ไม่ใช่ขนาดกล่องที่มันอยู่ ยัดใส่กรอบแคบแล้วจะได้ภาพที่ไม่ตรงกับของจริง · อยากดูตอนจอแคบให้กด \"เปิดเต็มหน้าจอ\" แล้วย่อหน้าต่าง (หรือเปิดลิงก์เดียวกันบนมือถือ)",
  "แบบ A/B/C ตัดบรรทัด \"ดูรายละเอียด ม็อกอัพ การผลิต การส่ง และเอกสารของงานนี้\" ใต้หัวข้อออก — เป็นข้อความคงที่เหมือนกันทุกใบ ไม่ได้บอกอะไรเกี่ยวกับใบที่กำลังเปิด · อยากได้กลับบอกได้ ใส่คืนไม่ยาก",
  "ปุ่มทุกปุ่มกดแล้วยังไม่ทำอะไร (แก้ไข · เปิดหน้าลูกค้า · ดูการจัดส่ง · ขั้นต่อไป)",
  "ยังไม่ได้แตะเมนู ⋯ (ใบสั่งงาน · สำเนา · ลิงก์สถานะลูกค้า · ยกเลิกออเดอร์) — เป็นเมนู ไม่ใช่หน้าตาของหน้า",
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
  if (variant === "calm") return <CalmVariant {...props} />;
  if (variant === "lead") return <LeadVariant {...props} />;
  if (variant === "dense") return <DenseVariant {...props} />;
  return <CurrentVariant {...props} />;
}

export default function OrderDetailProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [thin, toggleThin] = useProtoFlag("thin");
  const [hideMoney, toggleHideMoney] = useProtoFlag("nomoney");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  const src =
    `/proto/order-detail/view?v=${variant}` +
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
          หน้าใบงานควรหน้าตาแบบไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          โครงเดิมทั้งหมด (หัวใบ · แถบสถานะ · แท็บ · เนื้อหาแท็บภาพรวม) แต่จัดหน้าตาใหม่ 3 แบบ
          ที่คิดคนละอย่างว่า &ldquo;สวยและใช้ง่าย&rdquo; แปลว่าอะไร — เลือกมาหนึ่งแบบ
          แล้วค่อยลงมือกับหน้าจริง
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
              {thin ? "ดูใบที่ข้อมูลครบ" : "ดูใบที่เพิ่งเปิด (ข้อมูลยังว่าง)"}
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

        {/* ตัวหน้าจริง — วางบนพื้นเดียวกับเว็บ กว้างเท่าพื้นที่เนื้อหาจริง */}
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              หน้าจริงของแบบที่เลือก
            </p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              เปิดเต็มหน้าจอ (ย่อหน้าต่างเพื่อดูตอนจอแคบได้)
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8">
            <Preview variant={variant} thin={thin} showMoney={!hideMoney} />
          </div>
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
