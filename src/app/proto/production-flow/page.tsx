"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Columns2, Factory, FlaskConical, Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { cn } from "@/lib/utils";
import { SCENARIOS } from "./_domain/fixtures";
import { selectOrder, selectOrders } from "./_domain/engine";
import type { CommandResult, FlowCommand, FlowRole } from "./_domain/types";
import { useFlowState } from "./_store";
import { FlowFilters, FlowList, filterOrders, type FlowFilter, type FlowSort } from "./_components/flow-list";
import { FlowDetail } from "./_components/flow-detail";
import { CurrentBaseline } from "./_components/current-baseline";

const VARIANTS = [
  { id: "current", name: "ปัจจุบัน", description: "หน้าปัจจุบันกับข้อมูลจำลองชุดเดียวกัน ใช้ดูข้อจำกัดของการตามยอดและงานขนาน" },
  { id: "a", name: "A · คุมกำหนดส่ง", description: "เห็นทุกออเดอร์ในตารางเดียว เปิดใบเต็มเมื่อจะจัดการ — เทียบงานง่าย แต่ต้องเข้าออกใบ" },
  { id: "b", name: "B · โต๊ะติดตามงาน", description: "เลือกรายการแล้วทำงานด้านขวา — ตามหลายใบต่อเนื่องเร็ว แต่พื้นที่รายละเอียดแคบลง" },
] as const;
type Variant = typeof VARIANTS[number]["id"];
type Fault = "none" | "save" | "stale";

export default function ProductionFlowProto() {
  const params = useSearchParams();
  const variant: Variant = VARIANTS.some(v => v.id === params.get("v")) ? params.get("v") as Variant : "a";
  const scenario = SCENARIOS.find(s => s.id === params.get("s")) ?? SCENARIOS[0]!;
  const role: FlowRole = params.get("role") === "worker" ? "worker" : params.get("role") === "viewer" ? "viewer" : "supervisor";
  const filter = (["all", "attention", "vendor", "unassigned", "packed"].includes(params.get("filter") ?? "") ? params.get("filter") : "all") as FlowFilter;
  const sort = (["due", "quantity", "number"].includes(params.get("sort") ?? "") ? params.get("sort") : "due") as FlowSort;
  const query = params.get("q") ?? "";
  const embedded = params.get("embed") === "1";
  const compare = params.get("compare") === "1" && !embedded;
  const { resolvedTheme, setTheme } = useTheme();
  const { state, command, reset, ready } = useFlowState(scenario);
  const [fault, setFault] = useState<Fault>("none");
  const [lastCommand, setLastCommand] = useState<FlowCommand | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const orders = selectOrders(state, role);
  const visible = filterOrders(orders, filter, query, sort);
  const selectedId = params.get("order") ?? (variant === "b" ? visible[0]?.id : undefined);
  const selected = selectedId ? selectOrder(state, selectedId, role) : undefined;
  const fullDetail = params.get("mode") === "detail" || variant !== "b";
  const mobileSplitDetail = variant === "b" && !fullDetail && Boolean(params.get("order"));
  const choice = VARIANTS.find(v => v.id === variant)!;

  function navigate(values: Record<string, string | null>, push = false) {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    window.history[push ? "pushState" : "replaceState"](null, "", url);
  }
  function openOrder(id: string) {
    navigate({ order: id, op: null }, variant !== "b" || window.matchMedia("(max-width: 1279px)").matches);
  }
  function back() { navigate({ order: null, op: null, mode: null }, true); }
  function run(input: FlowCommand): CommandResult {
    if (fault === "save") return { state, error: "จำลองการบันทึกล้มเหลว — ยอดยังไม่เปลี่ยน เปลี่ยนการทดสอบเป็นปกติแล้วกดบันทึกอีกครั้ง" };
    const result = command(fault === "stale" ? { ...input, expectedRevision: input.expectedRevision - 1 } : input);
    if (!result.error) {
      setLastCommand(input);
      setReceipt(result.duplicate ? "คำสั่งเดิมบันทึกแล้ว ยอดไม่ถูกนับซ้ำ" : "บันทึกข้อมูลจำลองแล้ว หน้ารวมและใบผลิตใช้ยอดเดียวกัน");
    }
    return result;
  }
  function detail(compact = false) {
    if (!selected) return <div className="rounded-xl border border-divider bg-surface p-8 text-center"><p className="font-medium text-strong">ไม่พบใบผลิตนี้ในสถานการณ์ที่เลือก</p><Button className="mt-4" variant="outline" onClick={back}>กลับหน้ารวม</Button></div>;
    return <FlowDetail key={`${scenario.id}:${selected.id}:${role}`} order={selected} role={role} revision={state.revision} clock={state.clock} onCommand={run} selectedOperationId={params.get("op")} onSelectOperation={id => navigate({ op: id })} compact={compact} onBack={compact ? undefined : back} />;
  }
  function clearFilters() { navigate({ q: null, filter: null }); }
  const iframeParams = new URLSearchParams(params.toString());
  iframeParams.set("embed", "1"); iframeParams.delete("compare");
  const frameHref = `/proto/production-flow?${iframeParams.toString()}`;
  const filters = <FlowFilters orders={orders} filter={filter} query={query} sort={sort} compact={variant === "b" && !fullDetail} onFilter={value => navigate({ filter: value, order: null })} onQuery={value => navigate({ q: value || null, order: null })} onSort={value => navigate({ sort: value })} />;

  function testControls(prefix: string) {
    return <details className="relative text-xs text-muted">
      <summary className={cn("inline-flex cursor-pointer items-center gap-2 rounded-md px-2 hover:text-strong", CONTROL_MIN_H)}><FlaskConical className="size-4" aria-hidden="true" />สถานการณ์และการทดสอบ</summary>
      <div className="z-30 mt-2 space-y-3 rounded-lg border border-divider bg-surface p-4 lg:absolute lg:right-0 lg:w-[520px]">
        <p className="text-sm text-secondary">{scenario.description}</p>
        <p>เวลาจำลอง {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(state.clock))} — ผลทดลองเก็บเฉพาะ browser นี้และใช้ร่วมทุกแบบ</p>
        <p>ระบบจริงยังต้องเพิ่มการส่งต่อรายล็อต รับคืนหลายครั้ง และงานแก้ตามจำนวนก่อนใช้ flow นี้</p>
        <div className="flex flex-wrap items-end gap-2"><label htmlFor={`${prefix}flow-fault`} className="min-w-0 flex-1 space-y-1"><span>ทดสอบการบันทึก</span><Select id={`${prefix}flow-fault`} aria-label="ทดสอบการบันทึก" value={fault} onChange={e => setFault(e.target.value as Fault)}><option value="none">ปกติ</option><option value="save">บันทึกล้มเหลว</option><option value="stale">ข้อมูลเปลี่ยนก่อนบันทึก</option></Select></label>{lastCommand && <Button variant="outline" size="sm" onClick={() => { const result = command(lastCommand); setReceipt(result.error ?? (result.duplicate ? "ส่งคำสั่งเดิมซ้ำแล้ว ยอดไม่เพิ่มซ้ำ" : "บันทึกแล้ว")); }}>ลองส่งคำสั่งเดิมซ้ำ</Button>}</div>
      </div>
    </details>;
  }

  function scenarioControls(prefix: string) {
    return <>
      <label htmlFor={`${prefix}flow-scenario`} className="min-w-0 flex-1 text-xs text-secondary lg:max-w-80"><span className="sr-only">ลองสถานการณ์</span><Select id={`${prefix}flow-scenario`} aria-label="ลองสถานการณ์" value={scenario.id} onChange={e => { const next = SCENARIOS.find(s => s.id === e.target.value)!; navigate({ s: next.id, order: next.id === SCENARIOS[0]?.id ? null : next.focusOrderId, op: null, mode: null, q: null, filter: null }); setReceipt(null); setLastCommand(null); }}><>{SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</></Select></label>
      <label htmlFor={`${prefix}flow-role`} className="w-32 shrink-0 text-xs text-secondary"><span className="sr-only">มุมมอง</span><Select id={`${prefix}flow-role`} aria-label="บทบาททดลอง" value={role} onChange={e => navigate({ role: e.target.value })}><option value="supervisor">หัวหน้า</option><option value="worker">คนทำงาน</option><option value="viewer">ดูอย่างเดียว</option></Select></label>
      <Button size="sm" variant="outline" onClick={() => { reset(); setReceipt("เริ่มสถานการณ์ใหม่แล้ว"); setLastCommand(null); setFault("none"); navigate({ op: null }); }}><RotateCcw />เริ่มใหม่</Button>
    </>;
  }

  if (!ready) return <main className="min-h-screen bg-page p-6"><p role="status" className="text-sm text-secondary">กำลังเปิดข้อมูลทดลองที่บันทึกไว้…</p></main>;

  return <div className="min-h-screen bg-page text-strong" data-production-flow-proto="">
    {!embedded && <header className="border-b border-divider bg-surface">
      <div className="mx-auto max-w-[1600px] space-y-2 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/proto" className={cn("inline-flex shrink-0 items-center gap-2 text-sm text-secondary hover:text-strong", CONTROL_MIN_H)}><ArrowLeft className="size-4" aria-hidden="true" /><span className="hidden sm:inline">หน้าลองการผลิต</span><span className="sr-only sm:hidden">หน้าลองการผลิต</span></Link>
          <div className="order-3 flex w-full gap-1 overflow-x-auto rounded-lg bg-surface-muted p-1 lg:order-none lg:w-auto" role="group" aria-label="แบบหน้าลอง">{VARIANTS.map(v => <Button key={v.id} size="sm" className="shrink-0" variant={variant === v.id ? "default" : "ghost"} onClick={() => navigate({ v: v.id, mode: null })} aria-pressed={variant === v.id}>{v.name}</Button>)}</div>
          <span className="ml-auto text-xs text-muted">ข้อมูลจำลอง ไม่เขียนเข้าระบบจริง</span>
          <Button size="sm" variant="ghost" className="hidden shrink-0 lg:inline-flex" onClick={() => navigate({ compare: compare ? null : "1" })} aria-pressed={compare}><Columns2 />{compare ? "กลับหน้าทำงาน" : "เทียบคอม / มือถือ"}</Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="สลับธีม">{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>
        </div>
        <div className="hidden items-center gap-2 lg:flex">{scenarioControls("")}<p className="min-w-0 flex-1 px-2 text-xs leading-relaxed text-secondary">{choice.description}</p>{testControls("")}</div>
        <details className="lg:hidden"><summary className={cn("flex cursor-pointer items-center justify-between gap-2 text-xs text-secondary", CONTROL_MIN_H)}><span>ตัวควบคุมทดลอง</span><span>{role === "supervisor" ? "หัวหน้า" : role === "worker" ? "คนทำงาน" : "ดูอย่างเดียว"} / {scenario.title}</span></summary><div className="space-y-3 pb-2 pt-1"><div className="flex flex-wrap items-center gap-2">{scenarioControls("mobile-")}</div><p className="text-xs leading-relaxed text-secondary">{choice.description}</p>{testControls("mobile-")}</div></details>
      </div>
    </header>}
    {receipt && !embedded && <div role="status" className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2 text-sm text-secondary sm:px-6"><span className="flex items-center gap-2"><Check className="size-4 text-green-700 dark:text-green-400" aria-hidden="true" />{receipt}</span><Button variant="ghost" size="sm" onClick={() => setReceipt(null)}>ปิด</Button></div>}
    {compare ? <main className="overflow-x-auto p-6"><div className="flex min-w-[1520px] items-start gap-6"><section className="w-[1100px] shrink-0"><h1 className="mb-3 text-sm font-medium">คอมพิวเตอร์ 1100px</h1><iframe title="หน้าลองบนคอมพิวเตอร์" src={frameHref} className="h-[950px] w-full rounded-xl border border-divider bg-surface" /></section><section className="w-[390px] shrink-0"><h2 className="mb-3 text-sm font-medium">มือถือ 390px</h2><iframe title="หน้าลองบนมือถือ" src={frameHref} className="h-[950px] w-full rounded-xl border border-divider bg-surface" /></section></div></main> : <main className={cn("mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6 sm:py-5", embedded && "sm:px-5")}>
      {variant === "current" ? <CurrentBaseline state={state} role={role} selectedOrderId={params.get("order") ?? undefined} onSelectOrder={openOrder} onBack={back} /> : <>
        {(!selected || !fullDetail) && <div className={cn("space-y-3", mobileSplitDetail && "hidden xl:block")}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-baseline gap-x-5 gap-y-1"><h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Factory className="size-5 text-secondary" aria-hidden="true" />การผลิต</h1><p className="hidden text-xs text-secondary 2xl:block">ตามงานให้ทันส่ง รู้ว่าติดอะไร และใครต้องรับต่อ</p></div><span className="text-sm text-secondary">{visible.length} ออเดอร์</span></div>{variant !== "b" || fullDetail ? filters : null}</div>}
        {role === "viewer" && <Alert>มุมมองอ่านอย่างเดียว ดูยอดและประวัติได้ แต่บันทึกหรือส่งต่องานไม่ได้</Alert>}
        {variant === "b" && !fullDetail ? <div className="grid items-start gap-5 xl:grid-cols-[330px_minmax(0,1fr)]"><div className={cn("min-w-0 space-y-3 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:overflow-y-auto", mobileSplitDetail && "hidden xl:block")}>{filters}<FlowList orders={visible} clock={state.clock} compact selectedId={selectedId} onOpen={openOrder} onClear={clearFilters} /></div><div className={cn("min-w-0 space-y-3", !mobileSplitDetail && "hidden xl:block")}><div className="flex items-center justify-between"><Button variant="ghost" size="sm" className="-ml-3 xl:hidden" onClick={back}><ArrowLeft />กลับรายการผลิต</Button>{selected && <Button className="ml-auto hidden xl:inline-flex" size="sm" variant="ghost" onClick={() => navigate({ order: selected.id, mode: "detail" }, true)}>เปิดใบเต็ม<ArrowUpRight /></Button>}</div>{detail(true)}</div></div> : selectedId ? detail() : <FlowList orders={visible} clock={state.clock} onOpen={openOrder} onClear={clearFilters} />}
      </>}
    </main>}
    {embedded && <div className="border-t border-divider px-4 py-3 text-xs text-muted">หน้าลอง {choice.name} — ข้อมูลจำลอง</div>}
  </div>;
}
