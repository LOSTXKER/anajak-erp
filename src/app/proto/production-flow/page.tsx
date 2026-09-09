"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { ArrowLeft, Check, FlaskConical, Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";
import { SCENARIOS } from "./_domain/fixtures";
import type { CommandResult, FlowCommand, FlowRole } from "./_domain/types";
import { useFlowState } from "./_store";
import { FamiliarFlow } from "./_components/familiar-flow";
import { CurrentBaseline } from "./_components/current-baseline";

type Fault = "none" | "save" | "stale";

export default function ProductionFlowProto() {
  const params = useSearchParams();
  // Previous A/B links now open the familiar structure requested by the user.
  const variant = params.get("v") === "current" ? "current" : "familiar";
  const scenario = SCENARIOS.find(s => s.id === params.get("s")) ?? SCENARIOS[0]!;
  const role: FlowRole = params.get("role") === "worker" ? "worker" : params.get("role") === "viewer" ? "viewer" : "supervisor";
  const selectedOrderId = params.get("order") ?? undefined;
  const embedded = params.get("embed") === "1";
  const { resolvedTheme, setTheme } = useTheme();
  const { state, command, reset, ready } = useFlowState(scenario);
  const [fault, setFault] = useState<Fault>("none");
  const [lastCommand, setLastCommand] = useState<FlowCommand | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  function navigate(values: Record<string, string | null>, push = false) {
    const url = new URL(window.location.href);
    url.searchParams.set("v", variant);
    url.searchParams.delete("compare");
    url.searchParams.delete("mode");
    Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    window.history[push ? "pushState" : "replaceState"](null, "", url);
  }
  function openOrder(id: string) { navigate({ order: id, op: null }, true); }
  function back() { navigate({ order: null, op: null }, true); }
  function run(input: FlowCommand): CommandResult {
    if (fault === "save") return { state, error: "จำลองการบันทึกล้มเหลว — ยอดยังไม่เปลี่ยน เปลี่ยนการทดสอบเป็นปกติแล้วกดบันทึกอีกครั้ง" };
    const result = command(fault === "stale" ? { ...input, expectedRevision: input.expectedRevision - 1 } : input);
    if (!result.error) {
      setLastCommand(input);
      setReceipt(result.duplicate ? "คำสั่งเดิมบันทึกแล้ว ยอดไม่ถูกนับซ้ำ" : "บันทึกข้อมูลจำลองแล้ว หน้ารวมและใบผลิตใช้ยอดเดียวกัน");
    }
    return result;
  }

  if (!ready) return <main className="min-h-screen bg-page p-6"><p role="status" className="text-sm text-secondary">กำลังเปิดข้อมูลทดลองที่บันทึกไว้…</p></main>;

  return (
    <div className="min-h-screen bg-page text-strong" data-production-flow-proto="">
      {!embedded ? (
        <header className="relative border-b border-divider bg-surface">
          <div className="mx-auto flex max-w-[1600px] items-center gap-1.5 px-3 py-2 sm:gap-3 sm:px-6">
            <Link href="/proto" className={cn("inline-flex shrink-0 items-center gap-2 pr-1 text-sm text-secondary hover:text-strong", CONTROL_MIN_H)} aria-label="หน้าลองการผลิต"><ArrowLeft className="size-4" aria-hidden="true" /><span className="hidden md:inline">หน้าลองการผลิต</span></Link>
            <Button size="sm" variant={variant === "familiar" ? "default" : "ghost"} onClick={() => navigate({ v: "familiar" })} aria-pressed={variant === "familiar"}>โครงเดิม</Button>
            <Button size="sm" variant={variant === "current" ? "outline" : "ghost"} onClick={() => navigate({ v: "current" })} aria-pressed={variant === "current"}>ปัจจุบัน</Button>
            <span className="ml-auto hidden text-xs text-muted lg:inline">ข้อมูลจำลอง ไม่เขียนเข้าระบบจริง</span>
            <details className="ml-auto lg:ml-0">
              <summary aria-label="ทดลองสถานการณ์" className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 text-xs text-secondary hover:text-strong", CONTROL_MIN_H)}><FlaskConical className="size-4" aria-hidden="true" /><span className="hidden sm:inline">ทดลองสถานการณ์</span><span className="sm:hidden">ทดลอง</span></summary>
              <div className="absolute left-3 right-3 top-full z-40 mt-2 space-y-4 rounded-xl border border-divider bg-surface p-4 sm:left-auto sm:right-6 sm:w-[560px]">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                  <label htmlFor="flow-scenario" className="min-w-0 space-y-1 text-xs text-secondary"><span>ลองสถานการณ์</span><Select id="flow-scenario" aria-label="ลองสถานการณ์" value={scenario.id} onChange={event => { const next = SCENARIOS.find(item => item.id === event.target.value)!; navigate({ s: next.id, order: next.id === SCENARIOS[0]?.id ? null : next.focusOrderId, op: null, q: null, filter: null }); setReceipt(null); setLastCommand(null); }}>
                    {SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </Select></label>
                  <label htmlFor="flow-role" className="space-y-1 text-xs text-secondary"><span>มุมมอง</span><Select id="flow-role" aria-label="บทบาททดลอง" value={role} onChange={event => navigate({ role: event.target.value })}><option value="supervisor">หัวหน้า</option><option value="worker">คนทำงาน</option><option value="viewer">ดูอย่างเดียว</option></Select></label>
                </div>
                <p className="text-sm leading-relaxed text-secondary">{scenario.description}</p>
                <div className="flex flex-wrap items-end gap-3 border-t border-divider pt-3">
                  <label htmlFor="flow-fault" className="min-w-0 flex-1 space-y-1 text-xs text-secondary"><span>ทดสอบการบันทึก</span><Select id="flow-fault" aria-label="ทดสอบการบันทึก" value={fault} onChange={event => setFault(event.target.value as Fault)}><option value="none">ปกติ</option><option value="save">บันทึกล้มเหลว</option><option value="stale">ข้อมูลเปลี่ยนก่อนบันทึก</option></Select></label>
                  <Button size="sm" variant="outline" onClick={() => { reset(); setReceipt("เริ่มสถานการณ์ใหม่แล้ว"); setLastCommand(null); setFault("none"); navigate({ op: null }); }}><RotateCcw />เริ่มใหม่</Button>
                </div>
                {lastCommand ? <Button variant="outline" size="sm" onClick={() => { const result = command(lastCommand); setReceipt(result.error ?? (result.duplicate ? "ส่งคำสั่งเดิมซ้ำแล้ว ยอดไม่เพิ่มซ้ำ" : "บันทึกแล้ว")); }}>ลองส่งคำสั่งเดิมซ้ำ</Button> : null}
                <div className="space-y-1 text-xs leading-relaxed text-muted"><p>ข้อมูลจำลอง ไม่เขียนเข้าระบบจริง ผลทดลองเก็บเฉพาะ browser นี้</p><p>เวลาจำลอง {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(state.clock))}</p><p>ระบบจริงยังต้องเพิ่มการส่งต่อรายล็อต รับคืนหลายครั้ง และงานแก้ตามจำนวนก่อนใช้ flow นี้</p></div>
              </div>
            </details>
            <Button size="icon-sm" variant="ghost" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="สลับธีม">{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>
          </div>
        </header>
      ) : null}
      {receipt && !embedded ? <div role="status" className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2 text-sm text-secondary sm:px-6"><span className="flex items-center gap-2"><Check className="size-4 shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" />{receipt}</span><Button variant="ghost" size="sm" onClick={() => setReceipt(null)}>ปิด</Button></div> : null}
      <main className={cn("mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6 sm:py-5", embedded && "sm:px-5")}>
        {variant === "current" ? <CurrentBaseline state={state} role={role} selectedOrderId={selectedOrderId} onSelectOrder={openOrder} onBack={back} /> : <>
          {role === "viewer" ? <Alert>มุมมองอ่านอย่างเดียว ดูยอดและประวัติได้ แต่บันทึกหรือส่งต่องานไม่ได้</Alert> : null}
          <FamiliarFlow state={state} role={role} selectedOrderId={selectedOrderId} onSelectOrder={openOrder} onBack={back} revision={state.revision} clock={state.clock} onCommand={run} selectedOperationId={params.get("op")} onSelectOperation={id => navigate({ op: id })} />
        </>}
      </main>
      {embedded ? <div className="border-t border-divider px-4 py-3 text-xs text-muted">หน้าลอง {variant === "current" ? "ปัจจุบัน" : "โครงเดิม"} — ข้อมูลจำลอง</div> : null}
    </div>
  );
}
