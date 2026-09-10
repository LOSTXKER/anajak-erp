"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ArrowRight, Check, ChevronRight, CircleAlert, ClipboardCheck, RotateCcw } from "lucide-react";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Fact, FactList } from "@/components/ui/fact";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWorkSimulation, MANUAL_CHECKS, type Step, type Scenario, type Phase } from "./_model";

type Variant = "current" | "compact" | "panel";
type Simulation = ReturnType<typeof useWorkSimulation>;
const quantityLabel = { receive: "เสื้อที่ใช้ผลิตได้", print: "ฟิล์มดีที่ตัดแยกแล้ว", outsource: "งานที่รับกลับและตรวจผ่าน", press: "เสื้อที่รีดแล้ว", finish: "งานที่ทำเสร็จ" };
const saveLabel = { receive: "บันทึกยอดรับ", print: "บันทึกผลพิมพ์", outsource: "บันทึกผลตรวจรับ", press: "บันทึกยอดรีด", finish: "บันทึกยอดงาน" };

function ManualChecks({ step, sim, baseline = false }: { step: Step; sim: Simulation; baseline?: boolean }) {
  const id = useId();
  const values = sim.checks[step.id] ?? [];
  const hideTicks = baseline && ["receive", "print", "outsource"].includes(step.kind);
  return <div>
    <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3"><h3 className="text-sm font-semibold">{baseline ? "เช็คลิสต์" : "ตรวจด้วยตัวเอง"}</h3>{!hideTicks && <span className="text-sm tabular-nums text-secondary">{values.length}/{MANUAL_CHECKS[step.kind].length} ข้อ</span>}</div>
    <div className="divide-y divide-divider">{MANUAL_CHECKS[step.kind].map((text, index) => <label key={text} htmlFor={`${id}-${index}`} className={cn("flex min-h-11 items-start gap-3 py-3 text-sm leading-relaxed", !hideTicks && "cursor-pointer")}>
      {!hideTicks && <Checkbox id={`${id}-${index}`} className="mt-0.5 h-5 w-5" checked={values.includes(index)} disabled={sim.heldStepId === step.id || sim.done} onChange={() => sim.toggleCheck(step.id, index)} />}
      <span>{text}</span>
    </label>)}</div>
    {!baseline && <p className="border-t border-divider pt-3 text-xs leading-relaxed text-secondary">ผู้ตรวจ: บาส — ติ๊กเมื่อทำจริง การบันทึกจำนวนไม่ติ๊กให้อัตโนมัติ</p>}
  </div>;
}

function QuantityForm({ step, sim, value, onChange }: { step: Step; sim: Simulation; value: string | undefined; onChange: (value: string) => void }) {
  const draft = value ?? String(sim.quantities[step.id] ?? 0);
  const setDraft = onChange;
  const [error, setError] = useState("");
  const id = useId();
  const saved = sim.quantities[step.id] ?? 0;
  function save() {
    const qty = Number(draft);
    if (!draft.trim() || !Number.isInteger(qty) || qty < 0 || qty > 60) { setError("ใส่จำนวนเต็มตั้งแต่ 0 ถึง 60"); return; }
    if (sim.saveQty(step.id, qty)) { setError(""); onChange(String(qty)); }
  }
  return <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-4">
    <div className="flex items-end justify-between gap-4"><label htmlFor={id} className="text-sm font-medium">{quantityLabel[step.kind]}</label><div className="text-xl font-semibold tabular-nums">{saved}<span className="ml-1 text-sm font-normal text-secondary">/ 60</span></div></div>
    <p className="text-sm text-secondary">{saved === 60 ? "จำนวนครบแล้ว ตรวจรายการด้านขวาก่อนส่งต่อ" : `ยังขาด ${60 - saved} ${step.kind === "print" ? "ชุด" : "ตัว"} — บันทึกบางส่วนได้`}</p>
    <div className="flex items-start gap-2"><Input id={id} type="number" min={0} max={60} step={1} value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} disabled={sim.heldStepId === step.id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="max-w-[160px]" /><Button type="button" variant="outline" disabled={sim.heldStepId === step.id} onClick={() => setDraft("60")}>ใส่ครบ 60</Button></div>
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-4"><Button type="submit" variant="outline" disabled={sim.heldStepId === step.id}>{saveLabel[step.kind]}</Button></div>
  </form>;
}

function CompactRail({ sim }: { sim: Simulation }) {
  return <ol className="flex flex-wrap items-start gap-x-3 gap-y-4" aria-label="เส้นทางผลิต">
    {sim.groups.map((group, index) => {
      const complete = sim.done || index < sim.index;
      const current = !sim.done && index === sim.index;
      return <li key={group.id} aria-current={current ? "step" : undefined} className="flex min-w-0 max-w-full items-start gap-3">
        <div className="flex max-w-[220px] items-start gap-3">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium", current ? "border-blue-600 bg-blue-600 text-white" : "border-divider bg-surface text-secondary")}>{complete ? <Check size={16} aria-label="เสร็จแล้ว" /> : index + 1}</span>
          <div className="min-w-0 pt-1"><p className={cn("text-sm leading-relaxed", current ? "font-semibold text-strong" : "text-secondary")}>{group.label}</p><span className="text-xs text-secondary">{complete ? "เสร็จแล้ว" : current ? group.steps.length > 1 ? "ทำคู่กันได้" : "กำลังทำ" : "รอขั้นก่อน"}</span></div>
        </div>
        {index < sim.groups.length - 1 && <ChevronRight size={16} className="mt-2 shrink-0 text-secondary" aria-hidden="true" />}
      </li>;
    })}
  </ol>;
}

function ProgressSummary({ sim, onOpen, dirtyIds }: { sim: Simulation; onOpen: (id: string) => void; dirtyIds: string[] }) {
  const target = sim.current.steps.find((s) => dirtyIds.includes(s.id) && sim.heldStepId !== s.id) ?? sim.current.steps.find((s) => sim.heldStepId !== s.id && ((sim.quantities[s.id] ?? 0) < 60 || (sim.checks[s.id]?.length ?? 0) < MANUAL_CHECKS[s.kind].length)) ?? sim.current.steps[0];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm text-secondary">{sim.done ? "ครบทุกขั้นผลิต" : `ขั้น ${sim.index + 1} จาก ${sim.groups.length}`}</p><h2 className="mt-1 text-xl font-semibold">{sim.done ? "พร้อมตรวจคุณภาพ" : sim.current.label}</h2></div>
      {!sim.done && (sim.canAdvance ? <Button onClick={() => sim.advance()}>{sim.index + 1 < sim.groups.length ? `ส่งต่อ: ${sim.groups[sim.index + 1].label}` : "ปิดขั้นผลิต"}<ArrowRight /></Button> : <Button onClick={() => onOpen(target.id)} disabled={sim.heldStepId === target.id}>ทำงาน: {target.label}<ArrowRight /></Button>)}
    </div>
    <ol aria-label="เส้นทางผลิต" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-divider pt-4">{sim.groups.map((g, i) => <li key={g.id} aria-current={!sim.done && i === sim.index ? "step" : undefined} className={cn("flex items-center gap-2 text-sm", !sim.done && i === sim.index ? "font-semibold" : "text-secondary")}>{i < sim.index || sim.done ? <Check size={14} /> : <span className="tabular-nums">{i + 1}</span>}{g.label}</li>)}</ol>
  </div>;
}

export function WorkOrderActionsView({ variant, scenario, phase, theme }: { variant: Variant; scenario: Scenario; phase: Phase; theme: "light" | "dark" }) {
  const [reset, setReset] = useState(0);
  const { setTheme } = useTheme();
  useEffect(() => { setTheme(theme); }, [theme, setTheme]);
  return <div className={theme}><div data-preview-variant={variant} data-preview-theme={theme} className="min-h-screen bg-page text-strong" style={{ colorScheme: theme }}><WorkSurface key={reset} variant={variant} scenario={scenario} phase={phase} onReset={() => setReset((x) => x + 1)} /></div></div>;
}

function WorkSurface({ variant, scenario, phase, onReset }: { variant: Variant; scenario: Scenario; phase: Phase; onReset: () => void }) {
  const savedSim = useWorkSimulation(scenario, phase, variant === "current");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dirtyIds = savedSim.current.steps.filter((step) => drafts[step.id] !== undefined && drafts[step.id] !== String(savedSim.quantities[step.id] ?? 0)).map((step) => step.id);
  const sim: Simulation = { ...savedSim, canAdvance: savedSim.canAdvance && dirtyIds.length === 0,
    advance: () => dirtyIds.length === 0 && savedSim.advance(),
  };
  const draftProps = (step: Step) => ({ value: drafts[step.id], onChange: (value: string) => setDrafts((before) => ({ ...before, [step.id]: value })) });
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"steps" | "items">("steps");
  const workRef = useRef<HTMLDivElement>(null);
  const next = sim.groups[sim.index + 1];
  const selected = sim.current.steps.find((s) => s.id === openId);
  const completeCount = sim.current.steps.filter((s) => sim.quantities[s.id] === 60 && !dirtyIds.includes(s.id) && ((variant === "current" && ["receive", "print", "outsource"].includes(s.kind)) || sim.checks[s.id]?.length === MANUAL_CHECKS[s.kind].length)).length;
  const blocked = sim.current.steps.filter((s) => (sim.quantities[s.id] ?? 0) < 60).map((s) => `${s.label} ยังขาด ${60 - (sim.quantities[s.id] ?? 0)}`);
  const pendingChecks = sim.current.steps.reduce((sum, s) => sum + ((variant === "current" && ["receive", "print", "outsource"].includes(s.kind)) ? 0 : MANUAL_CHECKS[s.kind].length - (sim.checks[s.id]?.length ?? 0)), 0);
  const status = sim.held ? sim.problemReason : dirtyIds.length ? "มียอดที่แก้ไว้ บันทึกก่อนส่งต่อ" : blocked.length ? blocked.join(" / ") : pendingChecks ? `จำนวนครบแล้ว เหลือตรวจด้วยตัวเอง ${pendingChecks} ข้อ` : "ตรวจครบแล้ว พร้อมส่งต่อ";
  function advance() { if (sim.advance()) workRef.current?.focus({ preventScroll: true }); }
  return <main className="@container mx-auto max-w-[1440px] space-y-6 p-4 sm:p-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-xl font-semibold">ORD-2609-0026</h1><p className="mt-1 text-sm text-secondary">เสื้อกิจกรรม Cotton สีขาว 60 ตัว</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={onReset}><RotateCcw /> เริ่มใหม่</Button>{variant === "current" && !sim.done && next && <Button variant="outline" aria-disabled onClick={() => workRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>ถัดไป: {next.label}</Button>}</div>
    </header>
    {variant === "current" ? <OrderStatusBar flowSteps={sim.groups.map((g) => g.label)} currentStepIndex={sim.index} internalStatus={sim.current.label} customerStatus="PRODUCING" revisions={[]} blockers={sim.done ? [] : [status]} /> : variant === "compact" ? <CompactRail sim={sim} /> : <ProgressSummary sim={sim} onOpen={setOpenId} dirtyIds={dirtyIds} />}
    {sim.message && <p role="status" className="flex items-start gap-2 text-sm text-secondary">{sim.held ? <CircleAlert size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}{sim.message}</p>}
    <div className="flex gap-5 border-b border-divider" role="tablist" aria-label="ส่วนของใบผลิต">{(["steps", "items"] as const).map((name) => <button key={name} role="tab" aria-selected={tab === name} className={cn("min-h-11 border-b-2 px-1 text-sm font-medium", tab === name ? "border-blue-600 text-strong" : "border-transparent text-secondary")} onClick={() => setTab(name)}>{name === "steps" ? "ขั้นตอน" : "สินค้า"}</button>)}</div>
    <div hidden={tab !== "items"} className="space-y-4"><Section title="เสื้อยืด Cotton 100% สีขาว"><FactList columns={3}><Fact label="S" value="15 ตัว" /><Fact label="M" value="24 ตัว" /><Fact label="L" value="21 ตัว" /></FactList></Section><p className="text-sm text-secondary">DTF หน้าอก 20 × 25 ซม. แบบอนุมัติ v1</p><p className="text-sm text-secondary">ตัวอย่างนี้ย่อแท็บสินค้าไว้เพื่อเทียบเฉพาะการลงมือผลิต ของจริงยังใช้ตารางสินค้าและภาพแบบเดิม</p></div>
    <div hidden={tab !== "steps"} ref={workRef} tabIndex={-1} className="space-y-5 outline-none">
      {sim.done ? <Section title="ผลิตครบแล้ว พร้อมส่งเข้า QC" icon={ClipboardCheck}><p className="text-sm text-secondary">งานทุกช่วงครบ 60 ตัว และผู้ทำตรวจรายการครบแล้ว จุดนี้จบการจำลองการผลิต</p><Button variant="outline" className="mt-5" onClick={onReset}>ลองจากต้นอีกครั้ง</Button></Section> : <>
        {sim.held && variant !== "current" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-surface p-4"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" /><div><p className="font-medium">พักงานชั่วคราว</p><p className="mt-1 text-sm text-secondary">{status}</p></div></div><Button variant="outline" onClick={() => sim.resolveProblem()}>จำลองแก้ปัญหาแล้ว</Button></div>}
        {sim.current.steps.length > 1 && <p className="text-sm font-medium">สองงานนี้ทำคู่กันได้ — ครบทั้งสองงานจึงส่งต่อไปรีด</p>}
        <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">{sim.current.steps.map((step) => <Section key={step.id} title={step.label} meta={variant === "panel" ? `${sim.quantities[step.id] ?? 0} / 60` : undefined}>
            {variant === "panel" ? <div className="space-y-4"><FactList columns={2}><Fact label="จำนวนที่บันทึก" value={`${sim.quantities[step.id] ?? 0} / 60`} /><Fact label="ตรวจด้วยตัวเอง" value={`${sim.checks[step.id]?.length ?? 0} / ${MANUAL_CHECKS[step.kind].length} ข้อ`} /></FactList>{dirtyIds.includes(step.id) && <p className="text-sm text-secondary">มียอดที่แก้ค้างไว้ ยังไม่ได้บันทึก</p>}<Button variant="outline" disabled={sim.heldStepId === step.id} onClick={() => setOpenId(step.id)}>เปิดงาน{step.label}<ArrowRight /></Button></div> : <QuantityForm step={step} sim={sim} {...draftProps(step)} />}
          </Section>)}</div>
          <aside className="space-y-5">{sim.current.steps.map((step) => <Section key={step.id} title={sim.current.steps.length > 1 ? step.label : undefined}><ManualChecks step={step} sim={sim} baseline={variant === "current"} /></Section>)}<Section title="ข้อมูลใบ"><FactList columns={1}><Fact label="ผู้ทำ" value="บาส" /><Fact label="กำหนดส่ง" value="15 ก.ย. 2569" /><Fact label="สถานะใบ" value="กำลังผลิต" /></FactList></Section></aside>
        </div>
        {variant !== "panel" && <div className="flex flex-wrap items-center justify-between gap-4 border-t border-divider pt-5"><div><p className="font-medium">{completeCount} / {sim.current.steps.length} งานพร้อมส่งต่อ</p><p className="mt-1 text-sm text-secondary">{status}</p></div>{sim.canAdvance ? <Button onClick={advance}>{next ? `ส่งต่อ: ${next.label}` : "ปิดขั้นผลิต"}<ArrowRight /></Button> : sim.held && variant === "current" ? <Button variant="outline" onClick={() => sim.resolveProblem()}>จำลองแก้ปัญหาแล้ว</Button> : null}</div>}
      </>}
    </div>
    {selected && <Dialog open onOpenChange={(open) => { if (!open) setOpenId(null); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{selected.label}</DialogTitle><DialogDescription>บันทึกจำนวนและตรวจรายการของงานนี้ จำนวนที่บันทึกจะไม่ติ๊กข้อคุณภาพให้</DialogDescription></DialogHeader><div className="space-y-6"><QuantityForm key={selected.id} step={selected} sim={sim} {...draftProps(selected)} /><ManualChecks step={selected} sim={sim} /><div className="flex justify-end border-t border-divider pt-4"><Button onClick={() => setOpenId(null)}>กลับไปดูทั้งใบ</Button></div></div></DialogContent></Dialog>}
  </main>;
}
