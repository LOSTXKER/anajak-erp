"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronRight, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fact } from "@/components/ui/fact";
import { ActionZone } from "@/components/ui/action-zone";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MoreMenu } from "@/components/ui/more-menu";
import { DataTable } from "@/components/ui/data-table";
import { FOCUS_INSET, INTERACTIVE_SELECTED, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { defaultFocus, nowSteps, pendingOf, type LeanOrder, type LeanStep } from "../work-order-lean/_data";
import { StepStatus } from "../work-order-desk/_shared";
import { ItemsPanel, DetailsPanel } from "./_reference";
import { ActionDialog, type ResetAction } from "./_action-dialog";

type WorkspaceProps = { order: LeanOrder; boss: boolean; mode: "record" | "desk"; idPrefix: string };
type OpenAction = (action: ResetAction, step?: LeanStep, menuId?: string) => void;

export function Workspace({ order, boss, mode, idPrefix }: WorkspaceProps) {
  const focus = order.steps.length ? defaultFocus(order.steps) : null;
  const [tab, setTab] = useState(mode === "desk" ? "operations" : "overview");
  const [selectedId, setSelectedId] = useState<string | null>(mode === "desk" ? focus?.id ?? null : null);
  const [dialog, setDialog] = useState<{ action: ResetAction; step: LeanStep | null; menuId?: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const selected = order.steps.find((step) => step.id === selectedId) ?? null;
  const openAction: OpenAction = (action, step, menuId) => setDialog({ action, step: step ?? null, menuId });

  function openStep(step: LeanStep) {
    setSelectedId(step.id);
    setTab("operations");
    requestAnimationFrame(() => contentRef.current?.scrollIntoView({ block: "nearest" }));
  }

  return <article className="@container min-w-0 text-strong">
    <header className="space-y-5 px-1 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h1 className="text-xl font-semibold @lg:text-2xl">{order.orderNumber}</h1><span className="text-xs text-secondary">{order.status}</span></div>
          <p className="text-sm text-secondary">{order.customer}</p>
        </div>
        <div id={`${idPrefix}-document-menu`}><MoreMenu label="เมนูใบ" className="min-h-11 shrink-0" items={[{ key: "print", label: "ดูใบสั่งงานสำหรับพิมพ์", icon: Printer, onSelect: () => openAction("print", undefined, `${idPrefix}-document-menu`) }]} /></div>
      </div>
      <div className="grid grid-cols-2 gap-5 @3xl:max-w-md">
        <Fact label="จำนวนทั้งหมด" value={`${order.qty} ตัว`} size="lg" />
        <Fact label="ส่งลูกค้า" value={order.dueLabel} sub={order.dueInDays < 0 ? `เลยกำหนด ${-order.dueInDays} วัน` : undefined} tone={order.dueInDays < 0 ? "danger" : "default"} size="lg" />
      </div>
    </header>

    <Tabs value={tab} onValueChange={setTab} className={cn("card-surface min-w-0 overflow-hidden", RADIUS.surface)}>
      <div className="border-b border-divider px-4 @lg:px-6"><TabsList className="gap-4 sm:gap-4 @lg:gap-7" aria-label="ข้อมูลใบผลิต">
        <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
        <TabsTrigger value="operations">ขั้นงาน</TabsTrigger>
        <TabsTrigger value="items">สินค้าและแบบ</TabsTrigger>
        <TabsTrigger value="details">ข้อมูลใบ</TabsTrigger>
      </TabsList></div>
      <div ref={contentRef} className="scroll-mt-4">
        <TabsContent value="overview" className="p-5 @lg:p-8"><Overview order={order} focus={focus} boss={boss} openStep={openStep} openAction={openAction} showOperations={() => { setSelectedId(null); setTab("operations"); }} /></TabsContent>
        <TabsContent value="operations">
          {order.steps.length ? <div className={cn(mode === "desk" && "@3xl:grid @3xl:grid-cols-[15rem_minmax(0,1fr)]")}>
            {mode === "desk" ? <nav aria-label="เลือกงาน" className={cn("border-divider @3xl:border-r", selected && "hidden @3xl:block")}><div className="border-b border-divider px-5 py-4 text-sm font-semibold">ขั้นงานทั้งหมด <span className="ml-1 font-normal text-secondary">{order.steps.length}</span></div><div className="p-2">{order.steps.map((step) => <button key={step.id} type="button" onClick={() => openStep(step)} aria-pressed={step.id === selectedId} className={cn(FOCUS_INSET, RADIUS.item, "flex min-h-16 w-full items-start gap-3 p-3 text-left transition-colors", step.id === selectedId ? INTERACTIVE_SELECTED : "hover:bg-interactive-hover")}><span className="pt-0.5 text-sm text-secondary">{step.order}</span><span className="min-w-0 space-y-1"><span className="block text-sm font-medium">{step.short}</span><StepStatus step={step} /></span></button>)}</div></nav> : null}
            {selected ? <div className="min-w-0 p-5 @lg:p-8"><Button variant="ghost" className={cn("-ml-3 mb-4 min-h-11 text-secondary", mode === "desk" && "@3xl:hidden")} onClick={() => setSelectedId(null)}><ArrowLeft />ทั้งหมด {order.steps.length} ขั้น</Button><StepDetail key={selected.id} step={selected} order={order} boss={boss} openAction={openAction} idPrefix={idPrefix} /></div>
              : mode === "record" ? <OperationList order={order} openStep={openStep} /> : <p className="hidden p-8 text-sm text-secondary @3xl:block">เลือกขั้นงานเพื่อดูรายละเอียด</p>}
          </div> : <EmptySteps />}
        </TabsContent>
        <TabsContent value="items" className="p-5 @lg:p-8"><ItemsPanel order={order} /></TabsContent>
        <TabsContent value="details" className="p-5 @lg:p-8"><DetailsPanel order={order} /></TabsContent>
      </div>
    </Tabs>
    {dialog ? <ActionDialog action={dialog.action} step={dialog.step} order={order} boss={boss} onClose={() => { const menuId = dialog.menuId; setDialog(null); if (menuId) requestAnimationFrame(() => document.getElementById(menuId)?.querySelector("button")?.focus()); }} /> : null}
  </article>;
}

function Overview({ order, focus, boss, openStep, openAction, showOperations }: { order: LeanOrder; focus: LeanStep | null; boss: boolean; openStep: (step: LeanStep) => void; openAction: OpenAction; showOperations: () => void }) {
  if (!focus) return <EmptySteps />;
  const other = nowSteps(order.steps).filter((step) => step.id !== focus.id);
  const next = order.steps.find((step) => step.state === "todo");
  const vendor = focus.outsource;
  const title = focus.state === "blocked" ? focus.problem?.title ?? "งานติดปัญหา" : focus.state === "waiting" ? `รอรับงาน${focus.short}` : focus.state === "done" ? "ขั้นงานในใบนี้ผ่านครบแล้ว" : focus.short;
  return <div className="space-y-7">
    <section className="max-w-3xl space-y-5" aria-label="งานที่ต้องดูตอนนี้">
      <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold @lg:text-2xl">{title}</h2><StepStatus step={focus} /></div><p className="text-sm text-secondary">{vendor?.vendor ?? focus.label}</p></div>
      {focus.state === "blocked" ? <p className="max-w-prose text-sm text-secondary">{focus.problem?.detail}</p> : null}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Fact label={vendor ? "นัดรับกลับ" : "ผู้รับผิดชอบ"} value={vendor?.backLabel ?? focus.owner ?? "ยังไม่มอบหมาย"} />
        <Fact label={vendor ? "จำนวนที่ส่ง" : "จำนวนตามใบ"} value={`${focus.qtyTotal} ตัว`} />
      </div>
      {focus.note ? <p className="text-sm text-secondary">{focus.note}</p> : null}
      <StepActions step={focus} boss={boss} openAction={openAction} detail={() => openStep(focus)} />
    </section>
    {other.length ? <section className="border-t border-divider pt-6"><h2 className="mb-3 text-sm font-semibold">งานอื่นที่กำลังดำเนินการ</h2><ul className="divide-y divide-divider">{other.map((step) => <li key={step.id}><button type="button" className={cn(FOCUS_INSET, "flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left hover:bg-interactive-hover")} onClick={() => openStep(step)}><span className="min-w-0"><span className="block text-sm font-medium">{step.short}</span><span className="block text-xs text-secondary">{step.outsource?.vendor ?? step.owner ?? step.station ?? "ยังไม่มอบหมาย"}</span></span><span className="flex shrink-0 items-center gap-2"><StepStatus step={step} /><ChevronRight aria-hidden="true" className="size-4 text-secondary" /></span></button></li>)}</ul></section> : null}
    <section className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-5">
      <div className="min-w-0"><p className="text-xs text-secondary">{next ? "ขั้นถัดไป" : "ขั้นงานทั้งหมด"}</p><p className="mt-1 text-sm font-medium">{next?.short ?? `${order.steps.length} ขั้น`}</p>{next ? <p className="mt-1 text-xs text-secondary">{pendingOf(next, order.steps).length ? `รอ ${pendingOf(next, order.steps).map((step) => step.short).join(" และ ")}` : "พร้อมเริ่มงาน"}</p> : null}</div>
      <Button variant="ghost" className="min-h-11" onClick={showOperations}>ดูขั้นงานทั้งหมด<ArrowRight /></Button>
    </section>
  </div>;
}

function OperationList({ order, openStep }: { order: LeanOrder; openStep: (step: LeanStep) => void }) {
  return <section aria-label="ขั้นงานทั้งหมด">
    <div className="flex items-center justify-between gap-3 px-5 py-5 @lg:px-8"><h2 className="font-semibold">ขั้นงานทั้งหมด</h2><p className="text-sm text-secondary">{order.steps.length} ขั้น</p></div>
    <div className="@3xl:hidden"><ul className="divide-y divide-divider">{order.steps.map((step) => <li key={step.id}><button type="button" onClick={() => openStep(step)} className={cn(FOCUS_INSET, "flex min-h-20 w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-interactive-hover")}><span className="min-w-0 space-y-1"><span className="block text-sm font-medium">{step.order}. {step.short}</span><span className="block text-xs text-secondary">{step.outsource?.vendor ?? step.station ?? "ในโรงงาน"}</span></span><span className="flex shrink-0 items-center gap-2"><StepStatus step={step} /><ChevronRight aria-hidden="true" className="size-4 text-secondary" /></span></button></li>)}</ul></div>
    <div className="hidden @3xl:block"><DataTable.Root bordered={false}><DataTable.Head><tr><DataTable.Th>ขั้นงาน</DataTable.Th><DataTable.Th>ผู้รับงาน / สถานี</DataTable.Th><DataTable.Th>สถานะ</DataTable.Th><DataTable.Th>กำหนด</DataTable.Th></tr></DataTable.Head><DataTable.Body>{order.steps.map((step) => <DataTable.Row key={step.id} onClick={() => openStep(step)} className="cursor-pointer hover:bg-interactive-hover"><DataTable.Td><button type="button" className={cn(FOCUS_INSET, "min-h-11 text-left font-medium")} onClick={(event) => { event.stopPropagation(); openStep(step); }}>{step.order}. {step.short}</button></DataTable.Td><DataTable.Td>{step.outsource?.vendor ?? step.owner ?? step.station ?? "ยังไม่มอบหมาย"}</DataTable.Td><DataTable.Td><StepStatus step={step} /></DataTable.Td><DataTable.Td>{step.outsource?.backLabel ?? step.planEnd}</DataTable.Td></DataTable.Row>)}</DataTable.Body></DataTable.Root></div>
  </section>;
}

function StepDetail({ step, order, boss, openAction, idPrefix }: { step: LeanStep; order: LeanOrder; boss: boolean; openAction: OpenAction; idPrefix: string }) {
  const [showInstructions, setShowInstructions] = useState(false);
  const pending = pendingOf(step, order.steps);
  const vendor = step.outsource;
  return <section className="space-y-6" aria-label={`รายละเอียด ${step.short}`}>
    <header className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{step.short}</h2><StepStatus step={step} /></div>{vendor?.work || step.label !== step.short ? <p className="text-sm text-secondary">{vendor?.work ?? step.label}</p> : null}</header>
    {step.problem ? <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700 dark:text-red-300" /><div><h3 className="text-sm font-semibold">{step.problem.title}</h3><p className="mt-1 text-sm text-secondary">{step.problem.detail}</p></div></div> : null}
    {pending.length ? <div className="space-y-1"><p className="text-sm font-medium">{step.state === "active" ? "ทำส่วนที่พร้อมได้" : "ยังเริ่มขั้นนี้ไม่ได้"}</p><p className="text-sm text-secondary">รอ {pending.map((item) => item.short).join(" และ ")}</p>{step.state === "active" ? <p className="text-sm text-secondary">{step.note ?? order.garment}</p> : null}</div> : null}
    <div className="grid grid-cols-2 gap-x-5 gap-y-5">
      <Fact label={vendor ? "ร้านที่รับงาน" : "ผู้รับผิดชอบ"} value={vendor?.vendor ?? step.owner ?? "ยังไม่มอบหมาย"} />
      <Fact label="จำนวนตามใบ" value={`${step.qtyTotal} ตัว`} />
      {vendor ? <><Fact label="ส่งออก" value={vendor.sentOn} /><Fact label="นัดรับกลับ" value={vendor.backLabel} /></> : step.state === "done" ? <><Fact label="จำนวนที่บันทึก" value={`${step.qtyDone} ตัว`} /><Fact label="ผ่านเมื่อ" value={step.completedAt ?? "ไม่ระบุเวลา"} /></> : <Fact label="จุดทำงาน" value={step.station ?? "ในโรงงาน"} />}
    </div>
    {step.note && !(step.state === "active" && pending.length) ? <p className="text-sm text-secondary">{step.note}</p> : null}
    <StepActions step={step} boss={boss} openAction={openAction} menuId={`${idPrefix}-step-menu`} />
    <div className="border-t border-divider pt-4"><Button variant="ghost" className="-ml-3 min-h-11" onClick={() => setShowInstructions(true)}><FileText />ดูข้อกำหนดงาน ({step.checklist.length})</Button></div>
    {showInstructions ? <Instructions step={step} onClose={() => setShowInstructions(false)} /> : null}
  </section>;
}

function StepActions({ step, boss, openAction, detail, menuId }: { step: LeanStep; boss: boolean; openAction: OpenAction; detail?: () => void; menuId?: string }) {
  const current = step.state === "blocked" || step.state === "waiting" || step.state === "active";
  const action = step.state === "blocked" ? boss ? "resolve" : null : step.mode === "screen" && current ? step.outsource ? "receive" : "record" : null;
  const note = step.state === "blocked" && !boss ? "รอหัวหน้าแก้ปัญหา" : step.state === "active" && step.mode === "paper" ? "จดยอดและลงชื่อบนใบสั่งงานกระดาษ" : step.state === "active" && step.mode === "auto" ? "ขั้นนี้ผ่านเมื่อปิดรอบพิมพ์" : undefined;
  if (!current && !detail) return null;
  return <ActionZone note={note} className="@lg:max-w-3xl" menu={!detail && current ? <span id={menuId}><MoreMenu className="min-h-11" items={[
    ...(step.state !== "blocked" ? [{ key: "problem", label: "แจ้งปัญหา", icon: AlertTriangle, onSelect: () => openAction("problem", step, menuId) }] : []),
    { key: "record", label: "บันทึกรายละเอียด", onSelect: () => openAction("record", step, menuId) },
    ...(boss ? [{ key: "assign", label: "มอบหมายงาน", onSelect: () => openAction("assign", step, menuId) }] : []),
  ]} /></span> : undefined}>
    {action ? <Button className="min-h-11" onClick={() => openAction(action, step)}>{action === "resolve" ? "จัดการปัญหา" : action === "receive" ? "รับงานจากร้าน" : step.action}</Button> : null}
    {detail ? <Button variant="ghost" className="min-h-11" onClick={detail}>ดูรายละเอียด<ChevronRight /></Button> : null}
  </ActionZone>;
}

function Instructions({ step, onClose }: { step: LeanStep; onClose: () => void }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>ข้อกำหนดงาน {step.short}</DialogTitle><DialogDescription>รายการอ่านประกอบการทำงาน</DialogDescription></DialogHeader><ul className="list-disc space-y-4 pl-5 text-sm">{step.checklist.map((item) => <li key={item.label}>{item.label}</li>)}</ul></DialogContent></Dialog>;
}

function EmptySteps() {
  return <div className="space-y-2 px-5 py-12 text-center"><FileText aria-hidden="true" className="mx-auto mb-4 size-7 text-secondary" /><h2 className="text-lg font-semibold">ยังไม่มีขั้นงาน</h2><p className="text-sm text-secondary">กำหนดสูตรการผลิตก่อนเริ่มงาน ดูสินค้าและข้อมูลใบได้จากแท็บด้านบน</p></div>;
}
