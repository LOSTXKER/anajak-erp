"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { ExternalLink, Factory, Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { CASES, CASE_VALUES, COPY, OPTIONS, Preview, VALUES, type Case, type Variant } from "./_preview";

export default function ResetComparison() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "record");
  const [scenario, setScenario] = useProtoVariant<Case>("case", CASE_VALUES, "overdue");
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { setTheme } = useTheme();
  return <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-8"><div className="mx-auto max-w-[1600px] space-y-6">
    <div className={cn("card-surface overflow-hidden", RADIUS.surface)}>
    <div className="border-b border-divider px-5 py-4 sm:px-6"><PageHeader title="ใบผลิต จัดใหม่แบบ ERP" description="ข้อมูลตัวอย่างและการบันทึกจำลอง" icon={Factory} tone="production" back={{ href: "/proto", label: "หน้าลองทั้งหมด" }} /></div>
    <div className="space-y-4 px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><SegmentedControl aria-label="แบบการจัดหน้า" options={[...OPTIONS]} value={variant} onChange={setVariant} className="max-w-full flex-wrap [&_button]:min-h-11" /><Button asChild variant="outline" className="min-h-11"><Link href={`/proto/work-order-reset/view?v=${variant}&case=${scenario}&boss=${boss ? 1 : 0}`}><ExternalLink />เปิดเต็มหน้า</Link></Button></div>
      <div className="flex flex-wrap items-center gap-3"><SegmentedControl aria-label="ข้อมูลตัวอย่าง" options={[...CASES]} value={scenario} onChange={setScenario} className="max-w-full flex-wrap [&_button]:min-h-11" /><Button variant="outline" className="min-h-11" aria-pressed={boss} onClick={toggleBoss}>{boss ? "มุมหัวหน้า" : "มุมช่าง"}</Button><Button variant="ghost" className="min-h-11" onClick={() => setTheme("light")}><Sun />สว่าง</Button><Button variant="ghost" className="min-h-11" onClick={() => setTheme("dark")}><Moon />มืด</Button></div>
      <div className="space-y-1 text-sm"><p>{COPY[variant].idea}</p><p className="text-secondary">ข้อแลก: {COPY[variant].tradeoff}</p></div>
    </div></div>
    <div className="grid items-start gap-6 min-[1600px]:grid-cols-[minmax(0,1fr)_390px]"><section aria-label="ตัวอย่างจอคอมพิวเตอร์" className="min-w-0"><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="desktop" /></section><section aria-label="ตัวอย่างจอมือถือ" className="w-full max-w-[390px]"><h2 className="sr-only">มือถือ 390 px</h2><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="mobile" /></section></div>
    <footer className={cn("card-surface space-y-2 px-5 py-4 text-xs text-secondary sm:px-6", RADIUS.surface)}><p>ข้อมูลสินค้าและแบบอยู่ในแท็บ ข้อกำหนดเปิดจากรายละเอียดงาน ปุ่มใบสั่งงานใช้ดูตัวอย่างเอกสารพิมพ์ ทุกฟอร์มบันทึกจำลองและไม่เปลี่ยนสถานะจริง</p><p>กติกาการผลิต สิทธิ์ การรับกลับ และการจดบนกระดาษยังต้องใช้ controller เดิมเมื่อเลือกลงหน้าจริง ข้อมูลใบผลิตเป็นข้อมูลตัวอย่างที่กำหนดไว้</p></footer>
  </div></main>;
}
