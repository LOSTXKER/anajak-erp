"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowUpRight, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorkOrderActionsView } from "./_view";
import { useProtoVariant } from "../_kit/use-proto-variant";

const choices = [
  { id: "current", label: "ปัจจุบัน", description: "รางเต็มความกว้าง แถบเตือน และปุ่มถัดไปที่เลื่อนไปหางาน", tradeoff: "ใช้แถบและพฤติกรรมเดิม ส่วนช่องกรอกจำลองเพื่อเทียบจังหวะใช้งาน" },
  { id: "compact", label: "A · ทำในหน้า", description: "รางขนาดพอดีงาน ข้อความอยู่ข้างช่องกรอก บันทึกและส่งต่อจากท้ายงาน", tradeoff: "เห็นงานคู่ครบพร้อมกัน แต่ใบที่มีหลายงานคู่ยังต้องเลื่อนอ่าน" },
  { id: "panel", label: "B · เปิดแผงทำงาน", description: "หัวใบสรุปขั้นปัจจุบัน ปุ่มบนเปิดงานให้กรอกและตรวจทันที", tradeoff: "โฟกัสทีละงานได้ แต่ต้องเปิด–ปิดแผงเมื่อสลับงานคู่" },
] as const;
const variants = choices.map((x) => x.id);
const scenarios = [{ id: "parallel", label: "2 ช่วง / งานคู่" }, { id: "single", label: "ขั้นเดียว" }, { id: "long", label: "5 ช่วง" }] as const;
const phases = [{ id: "start", label: "เริ่มงาน" }, { id: "partial", label: "รับบางส่วน" }, { id: "ready", label: "พร้อมส่งต่อ" }, { id: "problem", label: "ติดปัญหา" }] as const;

export default function WorkOrderActionsProto() {
  const [variant, setVariant] = useProtoVariant("v", variants, "current");
  const [scenario, setScenario] = useProtoVariant("s", scenarios.map((x) => x.id), "parallel");
  const [phase, setPhase] = useProtoVariant("p", phases.map((x) => x.id), "start");
  const { resolvedTheme, setTheme } = useTheme();
  const choice = choices.find((x) => x.id === variant)!;
  const source = `/proto/work-order-actions/view?v=${variant}&s=${scenario}&p=${phase}&theme=${resolvedTheme === "dark" ? "dark" : "light"}`;
  return <main className="min-h-screen bg-page p-4 text-strong sm:p-6">
    <div className="mx-auto max-w-[1800px] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/proto" className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary"><ArrowLeft size={16} /> หน้าลองทั้งหมด</Link>
        <Button variant="outline" aria-label="สลับธีม" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>
      </div>
      <div><h1 className="text-2xl font-semibold">ขั้นสั้นลง ปุ่มพาไปทำงานจริง</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-secondary">ลองรางขั้น ข้อความสถานะ ปุ่มส่งต่อ และ checklist กับใบ 60 ตัว ข้อมูลจำลองทั้งหมด ไม่บันทึกฐานข้อมูล</p></div>
      <div className="flex flex-wrap gap-2" aria-label="รูปแบบ">{choices.map((c) => <Button key={c.id} variant={variant === c.id ? "default" : "outline"} aria-pressed={variant === c.id} onClick={() => setVariant(c.id)}>{c.label}</Button>)}</div>
      <div className="grid gap-3 border-y border-divider py-4 sm:grid-cols-2"><p className="text-base font-medium">{choice.description}</p><p className="text-sm leading-relaxed text-secondary"><strong className="font-medium text-strong">ข้อแลก: </strong>{choice.tradeoff}</p></div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2" aria-label="จำนวนขั้น">{scenarios.map((s) => <Button key={s.id} size="sm" variant={scenario === s.id ? "secondary" : "ghost"} aria-pressed={scenario === s.id} onClick={() => setScenario(s.id)}>{s.label}</Button>)}</div>
        <div className="flex flex-wrap items-center gap-2" aria-label="สถานการณ์">{phases.map((p) => <Button key={p.id} size="sm" variant={phase === p.id ? "secondary" : "ghost"} aria-pressed={phase === p.id} onClick={() => setPhase(p.id)}>{p.label}</Button>)}</div>
      </div>
      <div className="grid items-start gap-5 min-[1500px]:grid-cols-[minmax(0,1fr)_390px]">
        {[{ title: "คอมพิวเตอร์", mobile: false }, { title: "มือถือ 390", mobile: true }].map((frame) => <section key={frame.title} className={cn("min-w-0 space-y-2", frame.mobile && "w-full max-w-[390px]")}>
          <div className="flex items-center justify-between"><h2 className="text-sm font-medium">{frame.title}</h2><a href={source} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-secondary">เปิดเต็มหน้า <ArrowUpRight size={14} /></a></div>
          <div className="max-h-[1000px] w-full overflow-y-auto rounded-2xl border border-divider bg-surface" aria-label={`ลองใบผลิต ${frame.title}`}><WorkOrderActionsView key={source} variant={variant} scenario={scenario} phase={phase} theme={resolvedTheme === "dark" ? "dark" : "light"} /></div>
        </section>)}
      </div>
      <p className="max-w-4xl text-sm leading-relaxed text-secondary">หน้าลองนี้เน้นจังหวะทำงาน ใช้ยอดรวมจำลองแทนแบบฟอร์มใบรับ/รอบพิมพ์เต็ม เมนูมอบหมาย พัก ย้อนขั้น และประวัติทั้งใบไม่ได้แสดงในตัวอย่าง การลงจริงจะคงฟอร์มและสิทธิ์เดิม พร้อมแยกข้อที่คนตรวจเองจากหลักฐานจำนวน</p>
    </div>
  </main>;
}
