"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { CASES, CASE_VALUES, OPTIONS, Preview, VALUES, type Case, type Variant } from "./_preview";

const COPY: Record<Variant, { idea: string; tradeoff: string }> = {
  now: { idea: "ตัวเลขสรุป แผนที่ และรายละเอียดขั้นงาน แสดงเป็นกล่องแยกกัน", tradeoff: "ข้อมูลขั้นงานซ้ำหลายตำแหน่ง รายละเอียดบางส่วนต้องกดกาง" },
  flow: { idea: "งานที่ต้องดูขึ้นก่อน ทุกขั้นมีรายละเอียดในตำแหน่งเดียว เสื้อและลายอยู่ข้างกัน", tradeoff: "อ่านตามความสำคัญได้เร็ว แต่ต้องเลื่อนลงดูขั้นที่ผ่านแล้ว" },
  ledger: { idea: "เรียงทุกขั้นในตารางเดียว เทียบสถานะ ผู้รับงาน และวันนัดได้เป็นแนวเดียวกัน", tradeoff: "เห็นลำดับงานชัด แต่แถวที่มีรายละเอียดมากทำให้ตารางยาว" },
};

export default function WorkOrderDeskPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "flow");
  const [scenario, setScenario] = useProtoVariant<Case>("case", CASE_VALUES, "overdue");
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { setTheme } = useTheme();
  const fullUrl = `/proto/work-order-desk/view?v=${variant}&case=${scenario}&boss=${boss ? "1" : "0"}`;
  return <main className="min-h-screen bg-bg px-4 py-6 text-strong sm:px-8">
    <div className="mx-auto max-w-[1440px] space-y-6">
      <header>
        <Link href="/proto" className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary hover:text-strong"><ArrowLeft className="size-4" />หน้าลองทั้งหมด</Link>
        <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">ใบผลิต จัดใหม่</h1><span className="text-xs text-secondary">ข้อมูลตัวอย่าง / ยังไม่เปลี่ยนหน้าจริง</span></div>
        <p className="mt-2 text-sm text-secondary">ลดข้อมูลซ้ำ ให้แต่ละขั้นมีที่เดียว ทั้ง A และ B ไม่มีส่วนหุบพับ</p>
      </header>
      <div className="space-y-4 border-b border-divider pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl aria-label="แบบการจัดหน้า" value={variant} onChange={setVariant} options={[...OPTIONS]} className="max-w-full flex-wrap [&_button]:min-h-11" />
          <div className="flex flex-wrap items-center gap-1"><Button variant="ghost" className="min-h-11" onClick={() => setTheme("light")}><Sun />สว่าง</Button><Button variant="ghost" className="min-h-11" onClick={() => setTheme("dark")}><Moon />มืด</Button><Button asChild variant="outline" className="min-h-11"><Link href={fullUrl}><ExternalLink />ดูเต็มหน้า</Link></Button></div>
        </div>
        <div className="flex flex-wrap items-center gap-3"><SegmentedControl aria-label="ข้อมูลตัวอย่าง" value={scenario} onChange={setScenario} options={[...CASES]} className="max-w-full flex-wrap [&_button]:min-h-11" /><Button variant="outline" className="min-h-11" aria-pressed={boss} onClick={toggleBoss}>{boss ? "มุมหัวหน้า" : "มุมช่าง"}</Button></div>
        <div className="space-y-1 text-sm"><p className="font-medium">{COPY[variant].idea}</p><p className="text-secondary">ข้อแลก: {COPY[variant].tradeoff}</p></div>
      </div>
      <section aria-label="ตัวอย่างจอคอมพิวเตอร์" className="rounded-xl border border-divider p-4 sm:p-6"><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="desktop" /></section>
      <section className="space-y-4 border-t border-divider pt-6" aria-label="ตัวอย่างจอมือถือ"><h2 className="text-lg font-semibold">มือถือ 390 px</h2><div className="w-full max-w-[390px] rounded-xl border border-divider p-4"><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="mobile" /></div></section>
      <footer className="max-w-3xl space-y-2 border-t border-divider py-5 text-sm text-secondary">
        <p>ปุ่มลงมือและเมนูเปิดคำอธิบายจำลอง ไม่บันทึกข้อมูล ปุ่มรับของกลับเป็นข้อเสนอที่ยังต้องเชื่อมขั้นตอนเดิมก่อนใช้จริง</p>
        <p>เวลางานอยู่กับแต่ละขั้น ข้อกำหนดเป็นรายการอ่านอย่างเดียว ข้อมูลเสื้อและลายแสดงทุกชุด ส่วนตรวจรับเสื้อและเบิกวัตถุดิบย่อเป็นสรุปในหน้าลองนี้</p>
        <Link href="/proto/work-order-lean" className="inline-flex min-h-11 items-center underline underline-offset-4">ดูหน้าลองรอบก่อน</Link>
      </footer>
    </div>
  </main>;
}
