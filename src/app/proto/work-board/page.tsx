"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { protoJobs, type ProtoJob } from "../_kit/demo-jobs";
import { CurrentVariant } from "./_variants/current";
import { TodayVariant } from "./_variants/today";
import { BoardVariant } from "./_variants/board";
import { PaneVariant } from "./_variants/pane";

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: "ปัจจุบัน" มาก่อนเสมอ · ทุกทางต้องมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่สี

const OPTIONS = [
  { value: "current", label: "ปัจจุบัน" },
  { value: "today", label: "A · กองตามเวลา" },
  { value: "board", label: "B · กระดานช่วงงาน" },
  { value: "pane", label: "C · รายการ + แผงข้าง" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

const COPY: Record<
  Variant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ปัจจุบัน — สองหน้าเล่าเรื่องออเดอร์ชุดเดียวกัน",
    idea: "แยกตามแผนก: ขายดูหน้าออเดอร์ · ผลิตดูหน้าการผลิต",
    summary:
      "ออเดอร์ใบเดียวกันโผล่สองหน้า คนละคอลัมน์ คนละตัวกรอง ต้องรู้ล่วงหน้าว่าเรื่องที่จะทำอยู่หน้าไหน · หน้าออเดอร์เรียงตามสถานะ/วันที่ ไม่มีช่อง “ต้องทำอะไรต่อ” เลย ต้องเปิดเข้าไปอ่านเอง · หน้าผลิตมีช่องนั้นแล้ว แต่ลงมือไม่ได้จากหน้า ต้องคลิกเข้าใบงานอีก 2–3 ชั้น",
    tradeoff:
      "ข้อดีที่เสียไปถ้าเลิกใช้: ตารางกรองละเอียดที่สุด (ช่องทาง ประเภท ช่วงวันที่ ยอดเงิน) และคุ้นมือทีมแล้ว",
  },
  today: {
    name: "A · กองตามเวลา",
    idea: "เวลาเป็นตัวจัดลำดับ ไม่ใช่สถานะ",
    summary:
      "หน้าเดียวรวมออเดอร์กับการผลิต แล้วจัดกองว่า เลยกำหนด / ส่งวันนี้ / พรุ่งนี้ / สัปดาห์นี้ / ยังมีเวลา / ยังไม่กำหนดส่ง · ทุกแถวบอกงานถัดไปกับคนรับผิดชอบ และมีปุ่มลงมือในแถวเลย ไม่ต้องเปิดเข้าไปหา",
    tradeoff:
      "ไม่เห็นว่างานไปกองที่ช่วงไหนของสายผลิต (คอขวด) · งานที่ยังไม่กำหนดส่งตกไปกองท้ายสุด ถ้าไม่ตั้งใจเลื่อนดูจะลืม · แถวสูงกว่าตาราง เห็นพร้อมกันได้น้อยใบกว่า",
  },
  board: {
    name: "B · กระดานช่วงงาน",
    idea: "เห็นทั้งโรงงานในจอเดียว",
    summary:
      "คอลัมน์เดินซ้ายไปขวาตามสายจริง: รับงาน → ออกแบบ → เตรียมเสื้อ → DTF → ร้านนอก → QC → แพ็ค/ส่ง · หัวคอลัมน์บอกจำนวนและจำนวนที่เลยกำหนด เห็นคอขวดทันที · รูปลายพิมพ์ใหญ่พอจำงานได้จากภาพ",
    tradeoff:
      "7 คอลัมน์กว้างเกินจอ ต้องเลื่อนซ้าย-ขวาเสมอ · การ์ดใส่ข้อมูลได้น้อยกว่าแถวตาราง (ยอดเงิน/การชำระไม่มีที่) · งานผสมที่เดินหลายสายพร้อมกัน (DTF + ปักร้านนอก) ต้องเลือกโชว์ที่เดียว ไม่งั้นนับซ้ำ · บนมือถือเห็นทีละคอลัมน์",
  },
  pane: {
    name: "C · รายการ + แผงข้าง",
    idea: "เคลียร์งานรวดเดียว — คลิกเดียวต่อหนึ่งใบ",
    summary:
      "ซ้ายเป็นรายการงานแคบ ขวาเป็นใบที่เลือกพร้อมปุ่มลงมือ ไม่ต้องเปิด-ถอยหน้า · ออเดอร์กับการผลิตเป็นหน้าเดียวกัน ต่างกันแค่ “มุมที่มอง” ที่ชิปด้านบน (กดแล้วกรองจริงในหน้าลองนี้)",
    tradeoff:
      "บนมือถือวางคู่กันไม่ได้ ต้องถอยกลับไปเป็นเปิดหน้าเต็มเหมือนเดิม — ความเร็วได้เฉพาะบนคอม · แผงขวาแคบกว่าหน้าเต็ม ตารางรายการสินค้า/ไซซ์จะอึดอัด · จอทัชโรงงานกดเป้าเล็กในรายการซ้ายยาก",
  },
};

/** ข้อเท็จจริงที่วัดมาจากของจริง — ไม่ใช่ความเห็น */
const NOTES = [
  "หน้า /orders ตอนนี้มีตัวกรอง 6 ตัว (ค้นหา · ช่วงวันที่ · ช่องทาง · ประเภท · สถานะ · เรียง) สำหรับทีม 5 คน",
  "ออเดอร์ใบเดียวโผล่ทั้ง /orders และ /production — และในใบยังมีแท็บ “งานผลิต” เล่าเรื่องเดิมอีกที่",
  "หน้าผลิตมีช่อง “ต้องทำต่อ + เจ้าของถัดไป” อยู่แล้ว (มาจาก lib/production-worklist.ts) แต่หน้าออเดอร์ไม่มี",
  "รูปม็อกอัพในตารางตอนนี้สูง 40px — ในโรงงานสกรีน ลายพิมพ์คือสิ่งที่จำงานได้เร็วที่สุด",
  "ทำเองมีแค่ DTF (พิมพ์ฟิล์ม → รีดร้อน) ที่เหลือเป็นร้านนอก — สายงานจึงมีช่วง “รอของกลับ” ที่ไม่มีใครลงมือได้",
] as const;

/** สิ่งที่หน้าลองนี้ยังไม่ครอบ — เขียนไว้ให้เห็น ดีกว่าให้มาจับได้ทีหลัง */
const OUT_OF_SCOPE = [
  "หน้าในใบงาน /orders/[id] (7 แท็บ) ยังไม่ได้รื้อในรอบนี้ — รูปร่างของมันขึ้นกับว่าเลือกทางไหนก่อน",
  "จอทัชโรงงาน /factory และโหมดสถานี ยังไม่ได้แตะ — เป็นคนละงานคนละจอ",
  "ช่องค้นหาในหน้าลองกดพิมพ์ไม่ได้ (ของจริงค้นได้อยู่แล้ว ไม่ใช่สิ่งที่กำลังเทียบ) · ปุ่มลงมือกดแล้วยังไม่ทำอะไร",
  "รูปม็อกอัพใช้ไฟล์ตัวอย่างของ repo (/demo-mockups) — ของจริงเป็นภาพลายพิมพ์ที่กราฟิกอัปโหลด",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

function Preview({
  variant,
  jobs,
  device,
}: {
  variant: Variant;
  jobs: ProtoJob[];
  device: "desktop" | "mobile";
}) {
  if (variant === "today") return <TodayVariant jobs={jobs} device={device} />;
  if (variant === "board") return <BoardVariant jobs={jobs} device={device} />;
  if (variant === "pane") return <PaneVariant jobs={jobs} device={device} />;
  return <CurrentVariant jobs={jobs} device={device} />;
}

export default function WorkBoardProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [busy, toggleBusy] = useProtoFlag("busy");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const jobs = protoJobs(busy);

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <Link
          href="/proto"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          เปิดคอมมาทำงาน ควรเจอหน้าตาแบบไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          ตอนนี้งานใบเดียวกันอยู่สองหน้า (ออเดอร์ / การผลิต) และทั้งสองหน้าเป็น
          &ldquo;ตารางที่ต้องกรองเอง&rdquo; — เปิดมาแล้วยังต้องอ่านทีละแถวเพื่อหาว่าต้องทำอะไรต่อ
          หน้านี้วางสามทางที่คิดคนละแบบเทียบกับของเดิม เลือกมาหนึ่งทางแล้วค่อยลงมือของจริง
        </p>

        {/* แถวควบคุม: เลือกทาง · สลับปริมาณงาน · สลับธีม */}
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
              {busy ? "ดูตอนงานปกติ (12 ใบ)" : "ดูตอนงานล้น (24 ใบ)"}
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

        {/* คำอธิบายทางที่เลือกอยู่ — อ่านก่อนดูภาพ */}
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
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

        {/* คอมกับมือถืออยู่ในสายตาเดียวกัน */}
        <section className="mt-8 grid gap-8 min-[1700px]:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0">
            <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">
              บนคอม (กว้างเท่าพื้นที่เนื้อหาจริงหลังหักแถบเมนูซ้าย)
            </p>
            <div className={cn("min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-inset ring-border")}>
              <Preview variant={variant} jobs={jobs} device="desktop" />
            </div>
          </div>
          <div className="w-full max-w-[390px]">
            <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">
              บนมือถือ (390px)
            </p>
            <div className="rounded-[2rem] bg-surface-muted p-3 ring-1 ring-inset ring-border">
              <div className="overflow-hidden rounded-3xl bg-surface p-3">
                <Preview variant={variant} jobs={jobs} device="mobile" />
              </div>
            </div>
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
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอม (ชื่อลูกค้ายกมาจากชุดทดสอบ ไม่ใช่ลูกค้าจริง)
            และไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
