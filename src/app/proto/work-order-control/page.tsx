"use client";

/**
 * หน้าลอง: หน้าใบสั่งผลิตควรให้หัวหน้า "ลงมือทำ" ได้ตรงนั้นเลยแบบไหน
 *
 * ที่มา (เบสสั่ง 2026-09-01 หลังเปิดดู /production/[id] ในฐานทดลอง):
 * *"ให้หน้านี้หัวหน้าฝ่ายผลิตสามารถควบคุมได้เหมือน station ด้วยดีกว่า … จะได้ไม่ต้อง
 * สลับจอไปมา เพราะพนักงานสกรีนเขาใช้ไม่เป็นหรอก แต่ก็มีไว้ให้ใช้หน้างานตอนสกรีนด้วย"*
 *
 * ⚠️ ของเดิมจงใจไม่มีปุ่มลงมือในหน้านี้ (กติกา PV2.4 "Control Record ไม่มี action แทนพนักงาน")
 * เหตุผลเดิมคือความรับผิดชอบ — ระบบต้องรู้ว่าใครกดทำงาน · ทุกแบบข้างล่างจึงยังบันทึก
 * ผู้รับผิดชอบของขั้นไว้เหมือนเดิม แค่เพิ่มให้หัวหน้ากดแทนได้จากหน้านี้
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoVariant } from "../_kit/use-proto-variant";
import { WorkOrderControlPreview } from "./_preview";
import type { WorkOrderControlVariant } from "./_variants";

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "inline", label: "A · ปุ่มในแถวขั้นงาน" },
  { value: "side", label: "B · แผงลงมือด้านข้าง" },
  { value: "bottom", label: "C · แถบลงมือติดขอบล่าง" },
  { value: "tabs", label: "D · สลับมุมควบคุม/ลงมือ" },
  { value: "flow", label: "B1 · B + ไปขั้นถัดไปเอง" },
  { value: "batch", label: "B2 · B + สั่งหลายขั้นพร้อมกัน" },
  { value: "focus", label: "B3 · B + โหมดหน้างานเต็มจอ" },
] as const;

const VALUES = OPTIONS.map((option) => option.value) as readonly WorkOrderControlVariant[];

const COPY: Record<
  WorkOrderControlVariant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — ดูได้ สั่งการได้ แต่ลงมือไม่ได้",
    idea: "หน้าใบงานเป็นบันทึก ไม่ใช่ที่ทำงาน",
    summary:
      "หัวหน้าเห็นทุกอย่าง (เส้นทางการผลิต · จำนวน · ปัญหา · ประวัติ) และสั่งการได้บางอย่าง — จ่ายงาน สลับลำดับ ตัดสิน QC แก้ปัญหา · แต่ปุ่ม “เริ่มงาน / บันทึกผล / ปิดขั้น” อยู่ที่จอสถานีเท่านั้น",
    tradeoff:
      "ต้องเปิดสองจอและหางานให้เจอเองในจอสถานี · แต่ข้อดีที่เสียไปถ้าเปลี่ยน: ระบบเดิมแยกชัดว่า “ใครกดทำงาน” คือคนหน้างาน ไม่ใช่หัวหน้ากดรวบ",
  },
  inline: {
    name: "A · ปุ่มลงมือในแถวขั้นงาน",
    idea: "เห็นทั้งใบพร้อมกัน กดได้ทุกขั้นที่พร้อม",
    summary:
      "เพิ่มคอลัมน์ “ลงมือ” ท้ายแถว — ขั้นไหนพร้อมก็มีปุ่มของขั้นนั้น (เริ่มงาน / บันทึกผล / ปิดขั้น) · ขั้นที่ยังไม่ถึงคิวขึ้นแม่กุญแจพร้อมเหตุผล · การกรอกจำนวนแยกสี/ไซซ์เปิดเป็นหน้าต่างซ้อน",
    tradeoff:
      "แถวยาวขึ้นและตารางแน่นบนจอแคบ · ปุ่มเล็กกว่าจอสถานี ไม่เหมาะกับจอทัชหน้างานที่กดด้วยนิ้ว · หลายปุ่มบนจอเดียวเพิ่มโอกาสกดผิดขั้น",
  },
  side: {
    name: "B · แผงลงมือด้านข้าง (จอสถานีย่อ)",
    idea: "ซ้ายคือภาพรวม ขวาคืองานที่กำลังทำ",
    summary:
      "กดเลือกขั้นจากตารางทางซ้าย แล้วแผงขวาเปลี่ยนเป็นหน้าจอทำงานของขั้นนั้น — ปุ่มใหญ่ ช่องกรอกจำนวนแยกสี/ไซซ์ครบ พร้อมเตือนเงื่อนไขเฉพาะ (เช่น DTF ต้องเริ่มจากรอบพิมพ์) · แผงเกาะอยู่กับที่เวลาเลื่อนตาราง",
    tradeoff:
      "กินความกว้าง ~400px จึงต้องจอ 1280 ขึ้นไปถึงจะได้สองคอลัมน์ · บนจอแคบแผงตกลงไปอยู่ล่างสุด ต้องเลื่อนหา · เห็นทีละขั้น ถ้าจะกดหลายขั้นรวดต้องคลิกสลับ",
  },
  bottom: {
    name: "C · แถบลงมือติดขอบล่าง",
    idea: "ยกแถบทำงานของจอสถานีมาทั้งแถบ",
    summary:
      "ตารางเต็มความกว้างเหมือนเดิม · เลือกขั้นแล้วแถบล่างจอ (เกาะขอบ ไม่หายเวลาเลื่อน) โชว์ชื่อขั้น จำนวนที่เหลือ และปุ่มใหญ่ — กด “กรอกจำนวน” เพื่อกางช่องแยกสี/ไซซ์ขึ้นมา · เป็นรูปแบบเดียวกับจอสถานีเป๊ะ คนที่ชินจอสถานีใช้ได้ทันที",
    tradeoff:
      "แถบกินพื้นที่ล่างจอตลอดเวลา (สูงขึ้นอีกเมื่อกางช่องกรอก) · บนจอสั้น ๆ เหลือที่ให้ตารางน้อย · ต้องระวังบังปุ่มอื่นที่อยู่ท้ายหน้า",
  },
  tabs: {
    name: "D · สลับมุม ควบคุม / ลงมือ",
    idea: "แยกสองงานออกจากกันในหน้าเดียว",
    summary:
      "มุม “ควบคุม” = ตารางทั้งใบเหมือนเดิม · มุม “ลงมือทำ” = โชว์เฉพาะขั้นที่ทำได้ตอนนี้ เรียงเป็นการ์ดใหญ่พร้อมช่องกรอกและปุ่มครบ (ขั้นที่ยังรออยู่ไม่กินที่) · ป้ายบนปุ่มบอกจำนวนขั้นที่พร้อมทำ",
    tradeoff:
      "ต้องกดสลับมุม — ภาพรวมกับการลงมือไม่ได้อยู่ในสายตาเดียวกัน · เวลามีขั้นพร้อมหลายขั้น การ์ดจะยาวลงไปเรื่อย ๆ",
  },
  flow: {
    name: "B1 · แบบ B + ปิดขั้นแล้วไปต่อเอง",
    idea: "ลดการกลับไปหาในตารางว่าจะทำอะไรต่อ",
    summary:
      "โครงเดียวกับ B ทุกอย่าง แต่ท้ายแผงมีกล่อง “พอปิดขั้นนี้แล้ว ทำต่อได้เลยที่ …” พร้อมปุ่มไปต่อ — กดปิดขั้นแล้วสลับไปขั้นถัดไปในคลิกเดียว ไม่ต้องกวาดตาหาในตาราง",
    tradeoff:
      "ระบบเลือกขั้นถัดไปให้ตามลำดับที่พร้อมทำ ซึ่งอาจไม่ตรงกับที่หัวหน้าอยากทำจริง (เช่นอยากไปดูงานร้านนอกก่อน) · กล่องนี้กินพื้นที่ท้ายแผงตลอดเวลา",
  },
  batch: {
    name: "B2 · แบบ B + สั่งหลายขั้นพร้อมกัน",
    idea: "ขั้นที่เดินขนานกันได้ ควรเริ่มพร้อมกันได้ด้วย",
    summary:
      "เหนือตารางมีกล่องติ๊ก เฉพาะขั้นที่พร้อมทำ (ใบนี้มี 4 ขั้น: รับเสื้อ · สั่งตัดเย็บ · พิมพ์ฟิล์ม · เบิกเสื้อ) ติ๊กแล้วกด “เริ่มงาน 3 ขั้นพร้อมกัน” ทีเดียว · แผงขวายังใช้ทำงานละเอียดทีละขั้นเหมือนเดิม",
    tradeoff:
      "เริ่มพร้อมกันได้ แต่ “บันทึกผล/ปิดขั้น” ยังต้องทีละขั้นอยู่ดี เพราะจำนวนแยกสี/ไซซ์ของแต่ละขั้นไม่เหมือนกัน · กล่องติ๊กเพิ่มของบนจออีกชั้น",
  },
  focus: {
    name: "B3 · แบบ B + โหมดหน้างานเต็มจอ",
    idea: "จอเดียวใช้ได้ทั้งหัวหน้าและหน้างาน",
    summary:
      "แบบ B เป๊ะ แต่เพิ่มปุ่ม “โหมดหน้างาน” ที่หัวแผง — กดแล้วแผงขยายเต็มจอ ตัวหนังสือใหญ่ ปุ่มใหญ่ ไม่มีตารางให้กดผิด เอาไปตั้งข้างเครื่องสกรีนได้เลย · กดกลับหน้าควบคุมได้ตลอด",
    tradeoff:
      "เป็นสองโหมดในหน้าเดียว ต้องสอนว่าปุ่มนี้ทำอะไร · โหมดหน้างานเห็นทีละขั้น ถ้าช่างต้องสลับงานเองต้องกลับมาหน้าควบคุมก่อน",
  },
};

const NOTES = [
  "ข้อมูลในหน้าลองยกโครงจากใบจริง MO-2609-0001 ในฐานทดลอง — สูตรมาตรฐาน 9 ขั้น พร้อมเงื่อนไข “ต้องเสร็จก่อน” ชุดเดียวกัน",
  "ทุกแบบใส่ของครบตามที่ระบบบังคับจริง: ช่องกรอกจำนวน**แยกตามสี/ไซซ์** (ระบบไม่รับยอดรวม) · ป้ายเตือนขั้นที่มีเงื่อนไขเฉพาะ (DTF ต้องเริ่มจากรอบพิมพ์ที่มีหลักฐาน) · ปุ่มแจ้งปัญหาและพักงานแบบเดียวกับจอสถานี",
  "ขั้นที่ยังไม่ถึงคิวกดไม่ได้ทุกแบบ และบอกด้วยว่ารออะไรอยู่ — เป็นกฎที่ server บังคับ ไม่ใช่แค่ซ่อนปุ่ม",
  "จอสถานี /factory/station ยังอยู่เหมือนเดิมทุกแบบ — หน้านี้ไม่ได้มาแทน แค่ทำให้หัวหน้าไม่ต้องสลับจอ",
  "เรื่องที่ต้องตัดสินพร้อมกัน: ถ้าหัวหน้ากดแทนช่าง ระบบควรบันทึกว่า “หัวหน้ากดแทนใคร” — ของเดิมแยกจอไว้เพื่อให้รู้ว่าใครทำงานจริง",
];

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function WorkOrderControlProtoPage() {
  const [variant, setVariant] = useProtoVariant<WorkOrderControlVariant>(
    "v",
    VALUES,
    "current",
  );
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const src = `/proto/work-order-control/view?v=${variant}`;

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
          หน้าใบสั่งผลิต — ให้หัวหน้าลงมือทำได้ตรงนั้นเลยแบบไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          ตอนนี้หัวหน้าดูใบงานได้ครบแต่กดทำงานไม่ได้ ต้องสลับไปจอสถานีแล้วหางานเอง —
          ซึ่งไม่เข้ากับหน้างานจริงที่{" "}
          <strong className="font-semibold text-strong">ช่างสกรีนไม่ได้กดเอง</strong>{" "}
          สี่แบบข้างล่างวางปุ่มลงมือไว้คนละที่ · จอสถานียังอยู่เหมือนเดิมทุกแบบ
          สำหรับใช้หน้างานตอนสกรีน
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
                เปิดขนาดจอทัช/มือถือ (390)
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
            <WorkOrderControlPreview variant={variant} />
          </div>
        </section>

        <section className="card-surface mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
            <li>· ส่วนอื่นของใบงาน (ข้อมูลอ้างอิงที่ล็อกไว้ · ปัญหา · งานส่งแก้ · ประวัติ) — ยังอยู่เหมือนเดิม รอบนี้เทียบเฉพาะ “ที่วางปุ่มลงมือ”</li>
            <li>· หน้าต่างกรอกจำนวนของแบบ A (แบบอื่นกรอกในหน้าเลย จึงเห็นของจริงครบ)</li>
            <li>· การจ่ายงาน/สลับลำดับ/ตัดสิน QC ที่หน้านี้มีอยู่แล้ว — ไม่ได้เอาออกในทุกแบบ</li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
