"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { CASES, CASE_VALUES, COPY, OPTIONS, Preview, VALUES, type Case, type Variant } from "./_preview";

export default function ResetComparison() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "record");
  const [scenario, setScenario] = useProtoVariant<Case>("case", CASE_VALUES, "overdue");
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { setTheme } = useTheme();
  return <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-8"><div className="mx-auto max-w-[1600px] space-y-7">
    <header className="space-y-3"><Link className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary" href="/proto"><ArrowLeft className="size-4" />หน้าลองทั้งหมด</Link><h1 className="text-2xl font-semibold">ใบผลิต จัดใหม่แบบ ERP</h1><p className="text-sm text-secondary">ข้อมูลตัวอย่างและการบันทึกจำลอง</p></header>
    <div className="space-y-4 border-b border-divider pb-5"><div className="flex flex-wrap items-center justify-between gap-3"><SegmentedControl aria-label="แบบการจัดหน้า" options={[...OPTIONS]} value={variant} onChange={setVariant} className="max-w-full flex-wrap [&_button]:min-h-11" /><Button asChild variant="outline" className="min-h-11"><Link href={`/proto/work-order-reset/view?v=${variant}&case=${scenario}&boss=${boss ? 1 : 0}`}><ExternalLink />เปิดเต็มหน้า</Link></Button></div>
      <div className="flex flex-wrap items-center gap-3"><SegmentedControl aria-label="ข้อมูลตัวอย่าง" options={[...CASES]} value={scenario} onChange={setScenario} className="max-w-full flex-wrap [&_button]:min-h-11" /><Button variant="outline" className="min-h-11" aria-pressed={boss} onClick={toggleBoss}>{boss ? "มุมหัวหน้า" : "มุมช่าง"}</Button><Button variant="ghost" className="min-h-11" onClick={() => setTheme("light")}><Sun />สว่าง</Button><Button variant="ghost" className="min-h-11" onClick={() => setTheme("dark")}><Moon />มืด</Button></div>
      <div className="space-y-1 text-sm"><p>{COPY[variant].idea}</p><p className="text-secondary">ข้อแลก: {COPY[variant].tradeoff}</p></div>
    </div>
    <div className="grid items-start gap-10 min-[1600px]:grid-cols-[minmax(0,1fr)_390px]"><section aria-label="ตัวอย่างจอคอมพิวเตอร์" className="min-w-0"><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="desktop" /></section><section aria-label="ตัวอย่างจอมือถือ" className="w-full max-w-[390px] space-y-4"><h2 className="text-sm font-medium text-secondary">มือถือ 390 px</h2><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="mobile" /></section></div>
    <footer className="max-w-3xl space-y-2 border-t border-divider py-5 text-xs text-secondary"><p>ข้อมูลสินค้าและแบบอยู่ในแท็บ ข้อกำหนดเปิดจากรายละเอียดงาน เมนูใบใช้ดูตัวอย่างเอกสารพิมพ์ ทุกฟอร์มบันทึกจำลองและไม่เปลี่ยนสถานะจริง</p><p>กติกาการผลิต สิทธิ์ การรับกลับ และการจดบนกระดาษยังต้องใช้ controller เดิมเมื่อเลือกลงหน้าจริง ไม่มีการต่อฐานข้อมูลในหน้าลองนี้</p></footer>
  </div></main>;
}
