"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock3, Flag, History, Layers3, MapPin, PackageCheck, Shirt, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fact, FactList } from "@/components/ui/fact";
import { Metric } from "@/components/ui/metric";
import { DueTag } from "@/components/ui/due-tag";
import { StatusLabel, type StatusTone } from "@/components/ui/status-label";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_INSET, INTERACTIVE_HOVER, INTERACTIVE_SELECTED, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { cn, formatDateShort, formatTime } from "@/lib/utils";
import type { FlowAction, FlowRole, LotView, OperationView, OrderView } from "../_domain/types";
import { FlowActionForm, type CommandHandler } from "./flow-action-form";

export interface FlowDetailProps {
  order: OrderView;
  role: FlowRole;
  revision: number;
  clock: string;
  onCommand: CommandHandler;
  selectedOperationId?: string | null;
  onSelectOperation: (id: string) => void;
  compact?: boolean;
  onBack?: () => void;
}

const STATE_TONE: Record<OperationView["state"], StatusTone> = {
  ready: "accent", waiting: "neutral", working: "accent", vendor: "warning", inspection: "warning", done: "success", problem: "danger",
};
const ORDER_TONE: Record<OrderView["status"], StatusTone> = {
  ready: "accent", working: "accent", waiting: "warning", problem: "danger", packed: "success", unknown: "neutral",
};
const number = (value: number) => value.toLocaleString("th-TH");

function uniqueActions(actions: FlowAction[]) {
  return [...new Map(actions.map((action) => [action.id, action])).values()];
}

function OperationButton({ operation, selected, onSelect, horizontal }: { operation: OperationView; selected: boolean; onSelect: () => void; horizontal?: boolean }) {
  const Icon = operation.state === "done" ? CheckCircle2 : operation.state === "problem" ? Flag : operation.state === "vendor" ? Truck : operation.state === "waiting" ? Clock3 : Circle;
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={cn("group flex min-h-20 items-start gap-3 rounded-lg p-3 text-left transition-colors", FOCUS_INSET, selected ? INTERACTIVE_SELECTED : INTERACTIVE_HOVER, horizontal ? "w-48 shrink-0" : "w-full")}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", operation.state === "done" ? "text-green-600 dark:text-green-400" : operation.state === "problem" ? "text-red-600 dark:text-red-400" : selected ? "text-blue-600 dark:text-blue-400" : "text-muted")} />
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block text-sm font-medium leading-snug text-strong">{operation.name}</span>
        <StatusLabel label={operation.statusLabel} tone={STATE_TONE[operation.state]} />
        <span className="block text-xs tabular-nums text-secondary">{operation.qtyReady > 0 ? `พร้อมทำ ${number(operation.qtyReady)} ตัว` : operation.qtyAtVendor > 0 ? `อยู่ร้าน ${number(operation.qtyAtVendor)} ตัว` : operation.qtyAwaitingInspection > 0 ? `รอตรวจรับ ${number(operation.qtyAwaitingInspection)} ตัว` : `ผ่าน ${number(operation.qtyGood)}/${number(operation.qtyPlanned)} ตัว`}</span>
      </span>
      {selected ? <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" /> : null}
    </button>
  );
}

function RouteNavigator({ order, selectedId, onSelect, horizontal = false }: { order: OrderView; selectedId: string; onSelect: (id: string) => void; horizontal?: boolean }) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!horizontal || !nav) return;
    const button = nav.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!button) return;
    const frame = nav.getBoundingClientRect();
    const item = button.getBoundingClientRect();
    if (item.left < frame.left || item.right > frame.right) nav.scrollTo({ left: nav.scrollLeft + item.left - frame.left - (nav.clientWidth - button.offsetWidth) / 2, behavior: "auto" });
  }, [selectedId, horizontal]);
  return (
    <nav ref={navRef} aria-label="เลือกขั้นการผลิต" className={cn(horizontal ? "overflow-x-auto" : "space-y-5")}>
      <div className={cn(horizontal && "flex gap-5 pb-2")}>
        {order.workOrders.map((workOrder) => {
          const operations = order.operations.filter((operation) => operation.workOrderId === workOrder.id);
          const parallelRoots = operations.filter((operation) => operation.predecessorIds.length === 0);
          return (
            <div key={workOrder.id} className={cn(horizontal ? "shrink-0" : "mb-5 last:mb-0")}>
              {order.workOrders.length > 1 ? <p className="mb-2 px-3 text-xs font-medium tabular-nums text-muted">{workOrder.number}</p> : null}
              {parallelRoots.length > 1 ? <p className={cn("mb-2 px-3 text-xs leading-relaxed text-secondary", horizontal && "max-w-96")}>เริ่มคู่กันได้: {parallelRoots.map((operation) => operation.name).join(" / ")}</p> : null}
              <div className={cn(horizontal ? "flex gap-1" : "space-y-1")}>
                {operations.map((operation) => <OperationButton key={operation.id} operation={operation} selected={operation.id === selectedId} onSelect={() => onSelect(operation.id)} horizontal={horizontal} />)}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function QuantityTable({ operation }: { operation: OperationView }) {
  return (
    <>
      <div className="divide-y divide-divider sm:hidden" aria-label={`จำนวนตามไซซ์ ขั้น${operation.name}`}>
        {operation.lines.map((line) => (
          <div key={line.scopeKey} className="space-y-3 py-4">
            <div className="space-y-1"><p className="text-sm font-semibold text-strong">{line.size} <span className="font-normal text-secondary">{line.color}</span></p><p className="text-xs leading-relaxed text-secondary">{line.product}</p>{line.printLabel ? <p className="text-xs text-muted">{line.printLabel} (จำลอง)</p> : null}</div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-3">
              <Metric value={number(line.planned)} label="เป้าหมาย" size="sm" />
              <Metric value={number(line.ready)} label="พร้อมทำ" size="sm" />
              <Metric value={number(line.good)} label="ผ่านแล้ว" size="sm" />
              <Fact label="รอแก้" value={`${number(line.rework)} ตัว`} tone={line.rework > 0 ? "warning" : "muted"} />
              <Fact label="เสีย" value={`${number(line.waste)} ตัว`} tone={line.waste > 0 ? "danger" : "muted"} />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">จำนวนตามสินค้าและไซซ์ของขั้น{operation.name}</caption>
        <thead className={cn(TABLE_HEAD_SURFACE, "border-b border-divider text-xs font-medium text-muted")}>
          <tr>
            <th className="min-w-36 py-3 pr-4 font-medium">สินค้า / ไซซ์</th>
            <th className="whitespace-nowrap px-2 py-3 text-right font-medium">เป้าหมาย</th>
            <th className="whitespace-nowrap px-2 py-3 text-right font-medium">พร้อมทำ</th>
            <th className="whitespace-nowrap px-2 py-3 text-right font-medium">ผ่านแล้ว</th>
            <th className="whitespace-nowrap py-3 pl-2 text-right font-medium">แก้ / เสีย</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {operation.lines.map((line) => (
            <tr key={line.scopeKey}>
              <td className="py-3 pr-4">
                <p className="font-medium text-strong">{line.size} <span className="font-normal text-secondary">{line.color}</span></p>
                <p className="mt-0.5 max-w-64 text-xs leading-relaxed text-secondary">{line.product}</p>
                {line.printLabel ? <p className="mt-0.5 text-xs text-muted">{line.printLabel} (จำลอง)</p> : null}
              </td>
              <td className="px-2 py-3 text-right tabular-nums text-secondary">{number(line.planned)}</td>
              <td className="px-2 py-3 text-right font-semibold tabular-nums text-strong">{number(line.ready)}</td>
              <td className="px-2 py-3 text-right tabular-nums text-secondary">{number(line.good)}</td>
              <td className="py-3 pl-2 text-right tabular-nums"><span className={line.rework > 0 ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted"}>{number(line.rework)}</span><span className="px-1 text-muted">/</span><span className={line.waste > 0 ? "font-medium text-red-700 dark:text-red-300" : "text-muted"}>{number(line.waste)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

function Lots({ lots, onAction, onSelectOperation }: { lots: LotView[]; onAction: (action: FlowAction) => void; onSelectOperation?: (id: string) => void }) {
  return (
    <div className="divide-y divide-divider">
      {lots.map((lot) => (
        <div key={lot.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><p className="text-sm font-medium text-strong">{lot.label}</p><span className="text-sm font-semibold tabular-nums text-strong">{number(lot.qty)} ตัว</span></div>
            <p className="flex items-center gap-1.5 text-xs text-secondary"><MapPin aria-hidden className="size-3.5 shrink-0" />{lot.location}</p>
            <p className="text-xs text-secondary">{lot.conditionLabel}{lot.source === "replacement" ? " • เสื้อชดเชย" : ""}</p>
            {lot.parentLotId ? <p className="text-xs text-muted">แยกจากล็อตเดิม</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {onSelectOperation ? <Button type="button" variant="ghost" size="sm" onClick={() => onSelectOperation(lot.operationId)}>ดูขั้นนี้<ChevronRight /></Button> : null}
            {lot.actions.filter((action) => action.enabled).map((action) => <Button key={action.id} type="button" variant="outline" size="sm" onClick={() => onAction(action)}>{action.label}<ArrowRight /></Button>)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A and B share this exact surface and the same engine-owned action descriptors. */
export function FlowDetail({ order, role, revision, clock, onCommand, selectedOperationId, onSelectOperation, compact = false, onBack }: FlowDetailProps) {
  const executionActions = order.actions.filter((action) => action.enabled && action.primary && !["assign", "issue"].includes(action.kind));
  const nextExecution = executionActions.find((action) => ["resolve", "outsource"].includes(action.kind)) ?? executionActions[0];
  const selected = order.operations.find((operation) => operation.id === selectedOperationId) ?? order.operations.find((operation) => operation.id === nextExecution?.operationId) ?? order.operations.find((operation) => operation.state !== "done" && (operation.state === "problem" || operation.qtyReady > 0 || operation.qtyAtVendor > 0 || operation.qtyAwaitingInspection > 0)) ?? order.operations.find((operation) => operation.state !== "done") ?? order.operations[0];
  const [actionSession, setActionSession] = useState<FlowAction | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const actionTrigger = useRef<HTMLElement | null>(null);
  const actions = uniqueActions([...order.actions, ...order.operations.flatMap((operation) => operation.actions), ...order.lots.flatMap((lot) => lot.actions)]);
  const activeAction = actionSession ? actions.find((action) => action.id === actionSession.id) ?? { ...actionSession, enabled: false, disabledReason: "สถานะของล็อตนี้เปลี่ยนแล้ว ค่าที่กรอกยังอยู่ ตรวจข้อมูลล่าสุดก่อนเลือกทำรายการใหม่" } : null;
  const selectedActions = selected ? uniqueActions([...selected.actions, ...order.actions.filter((action) => !action.operationId || action.operationId === selected.id)]) : order.actions;
  const primaryAction = selectedActions.find((action) => action.enabled && action.primary && !["assign", "issue"].includes(action.kind)) ?? selectedActions.find((action) => action.enabled && action.primary) ?? selectedActions.find((action) => action.enabled && !action.supervisorOnly);
  const secondaryActions = selectedActions.filter((action) => action.enabled && action.id !== primaryAction?.id);
  const blockedActions = selectedActions.filter((action) => !action.enabled && action.disabledReason);
  const relevantLots = selected?.lots ?? [];
  const dueInDays = differenceInBangkokDays(order.dueAt, new Date(clock));
  const decision = order.blockers[0];
  const products = selected ? [...new Set(selected.lines.map((line) => line.product))] : [];
  const printLabels = selected ? [...new Set(selected.lines.map((line) => line.printLabel).filter(Boolean))] : [];
  const Heading = compact ? "h2" : "h1";
  const lotLocations = [...new Set(order.lots.map((lot) => lot.location))].map((location) => ({ location, lots: order.lots.filter((lot) => lot.location === location) }));

  function openAction(action: FlowAction) {
    actionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActionSession(action);
    setSaved(null);
    if (action.operationId && action.operationId !== selected?.id) onSelectOperation(action.operationId);
  }

  function closeAction() {
    setActionSession(null);
    requestAnimationFrame(() => {
      const trigger = actionTrigger.current;
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector<HTMLButtonElement>('[data-flow-action-area] button:not([disabled])')?.focus();
    });
  }

  return (
    <article className="min-w-0 space-y-5" aria-label={`รายละเอียดการผลิต ${order.number}`}>
      <header className="space-y-4 border-b border-divider pb-5">
        {onBack ? <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-3"><ArrowLeft />กลับรายการผลิต</Button> : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><Heading className="text-xl font-semibold tabular-nums tracking-tight text-strong sm:text-2xl">{order.number}</Heading><StatusLabel label={order.statusLabel} tone={ORDER_TONE[order.status]} /></div>
            <p className="text-sm leading-relaxed text-secondary">{order.customer}</p>
          </div>
          <DueTag dueInDays={dueInDays} dateLabel={formatDateShort(order.dueAt)} size="md" />
        </div>
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <Metric value={number(order.totalQty)} unit="ตัว" label="ต้องส่งลูกค้า" size="md" />
          {order.unknown ? <Fact label="ยอดหน้างาน" value="ยังไม่ยืนยันจำนวน" sub="รอหลักฐานการผลิตและตำแหน่งเสื้อ" /> : <>
            <Metric value={number(order.packedQty)} unit="ตัว" label="แพ็กพร้อมส่ง" size="md" tone={order.packedQty === order.totalQty ? "success" : "default"} />
            {order.reworkQty > 0 ? <Metric value={number(order.reworkQty)} unit="ตัว" label="รอแก้ / ตรวจซ้ำ" size="md" tone="warning" /> : null}
            {order.missingQty > 0 ? <Metric value={number(order.missingQty)} unit="ตัว" label="เสื้อยังขาด" size="md" tone="warning" /> : null}
          </>}
          <Fact icon={UserRound} label="ผู้ดูแลงาน" value={order.owner || "ยังไม่มอบหมาย"} className="sm:ml-auto" />
        </div>
      </header>

      {decision ? (
        <div className="space-y-2">
          <Alert variant="warning" title={decision}>{order.nextAction}</Alert>
          {order.blockers.length > 1 ? <details className="text-xs text-secondary"><summary className="cursor-pointer py-1">อีก {order.blockers.length - 1} เรื่องที่ต้องจัดการ</summary><ul className="mt-1 list-disc space-y-1 pl-4">{order.blockers.slice(1).map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></details> : null}
        </div>
      ) : order.unknown ? <p role="status" className="rounded-lg border border-divider bg-surface-muted p-4 text-sm text-secondary">{order.summary}</p> : nextExecution ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-divider bg-surface-muted px-4 py-3"><div className="min-w-0 space-y-1"><p className="text-xs text-secondary">ต้องจัดการตอนนี้</p><p className="text-sm font-semibold text-strong">{nextExecution.label}</p><p className="text-xs text-secondary">{order.operations.find((operation) => operation.id === nextExecution.operationId)?.name}</p></div><Button type="button" size="sm" variant="outline" onClick={() => openAction(nextExecution)}>เปิดงานนี้<ArrowRight /></Button></div> : null}

      {order.unknown ? <section className="space-y-3 rounded-xl border border-divider p-5"><h3 className="text-sm font-semibold text-strong">ตรวจหลักฐานก่อนเริ่มบันทึก</h3><p className="text-sm leading-relaxed text-secondary">{order.summary}</p><FactList columns={3}><Fact label="จำนวนผ่าน / เสีย" value="ยังไม่ทราบ" /><Fact label="สถานที่ของเสื้อ" value="ยังไม่ยืนยัน" /><Fact label="แพ็กพร้อมส่ง" value="ยังไม่ทราบ" /></FactList></section> : selected ? (
        <div className={cn("min-w-0 gap-6", !compact && "xl:grid xl:grid-cols-[220px_minmax(0,1fr)]")}>
          {!compact ? <aside className="hidden xl:block"><h3 className="mb-3 px-3 text-sm font-semibold text-strong">เส้นทางการผลิต</h3><RouteNavigator order={order} selectedId={selected.id} onSelect={onSelectOperation} /></aside> : null}
          <div className="min-w-0 space-y-5">
            <div className={cn("border-b border-divider pb-3", !compact && "xl:hidden")}><h3 className="mb-2 text-sm font-semibold text-strong">เส้นทางการผลิต</h3><RouteNavigator order={order} selectedId={selected.id} onSelect={onSelectOperation} horizontal /></div>

            <section className="card-surface min-w-0 overflow-hidden rounded-xl" aria-labelledby="flow-selected-step-title">
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5"><h3 id="flow-selected-step-title" className="text-lg font-semibold text-strong">{selected.name}</h3><p className="text-sm text-secondary">{selected.station}</p></div>
                  <StatusLabel label={selected.statusLabel} tone={STATE_TONE[selected.state]} />
                </div>
                <FactList columns={3} className="grid-cols-3">
                  <Fact label="ผู้ทำขั้นนี้" icon={UserRound} value={selected.assignedTo?.name ?? "ยังไม่มีคนรับ"} />
                  <Fact label="พร้อมทำต่อ" value={`${number(selected.qtyReady)} ตัว`} tone={selected.qtyReady > 0 ? "default" : "muted"} />
                  <Fact label="ผ่านขั้นนี้แล้ว" value={`${number(selected.qtyGood)} / ${number(selected.qtyPlanned)} ตัว`} />
                </FactList>
                {selected.waitingOn.length > 0 ? <p className="flex items-start gap-2 text-sm leading-relaxed text-secondary"><Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><span>{selected.waitingOn.join(" • ")}</span></p> : null}
                {selected.predecessorIds.length > 0 ? <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className="py-1 text-muted">รับต่อจาก</span>{selected.predecessorIds.map((id) => { const predecessor = order.operations.find((operation) => operation.id === id); return predecessor ? <button key={id} type="button" onClick={() => onSelectOperation(id)} className={cn("inline-flex items-center gap-1 rounded px-1 text-secondary underline-offset-4 hover:underline", CONTROL_MIN_H, FOCUS_INSET)}>{predecessor.state === "done" ? <Check className="size-3.5 text-green-600 dark:text-green-400" aria-hidden /> : <Circle className="size-3 text-muted" aria-hidden />}{predecessor.name}</button> : null; })}</div> : null}
                {selected.issue ? <Alert variant="error" title="ปัญหาที่แจ้งไว้">{selected.issue}</Alert> : null}
              </div>

              <div className="border-t border-divider p-4 sm:p-5" data-flow-action-area="">
                {activeAction && (!activeAction.operationId || activeAction.operationId === selected.id) ? <FlowActionForm key={activeAction.id} action={activeAction} lot={order.lots.find((lot) => lot.id === activeAction.lotId)} role={role} revision={revision} onCommand={onCommand} onClose={closeAction} onSaved={setSaved} /> : (
                  <ActionZone note={selected.summary} icon={selected.state === "done" ? PackageCheck : selected.state === "vendor" ? Truck : undefined}>
                    {primaryAction ? <Button type="button" onClick={() => openAction(primaryAction)}>{primaryAction.label}<ArrowRight /></Button> : null}
                    {secondaryActions.map((action) => <Button key={action.id} type="button" variant="outline" size="sm" onClick={() => openAction(action)}>{action.label}</Button>)}
                  </ActionZone>
                )}
                {saved ? <p role="status" className="mt-3 flex items-start gap-2 text-sm text-green-700 dark:text-green-300"><CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />{saved}</p> : null}
                {role === "viewer" ? <p className="mt-3 text-xs text-secondary">มุมดูงาน — การบันทึกและตัดสินใจอยู่กับผู้รับผิดชอบ</p> : !primaryAction && secondaryActions.length === 0 && blockedActions[0] ? <p className="mt-3 text-sm text-secondary">{blockedActions[0].disabledReason}</p> : null}
              </div>
              <div className="border-t border-divider px-4 py-4 sm:px-5">
                <div className="mb-4 space-y-3">
                  <div className="min-w-0 space-y-1"><p className="text-sm font-medium text-strong">{products.join(" / ") || "รายการเสื้อในใบผลิต"}</p>{printLabels.map((label) => <p key={label} className="text-xs leading-relaxed text-secondary">{label} (จำลอง)</p>)}</div>
                  <figure className="overflow-hidden rounded-lg border border-border">
                    <div className="relative h-28 bg-white sm:h-56"><Image src="/proto-production-flow/uniform.png" alt="ภาพตัวอย่างเสื้อ NORTHSTAR ด้านหน้าและด้านหลัง พร้อมดาวที่แขน" fill sizes="(max-width: 640px) 90vw, 720px" className="object-contain" /></div>
                    <figcaption className="border-t border-divider px-3 py-2 text-xs text-secondary">แบบเสื้อตัวอย่าง</figcaption>
                  </figure>
                  <details>
                    <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-secondary">ขยายดูแบบหน้า–หลัง</summary>
                    <div className="relative h-80 overflow-hidden rounded-lg border border-border bg-white sm:h-96"><Image src="/proto-production-flow/uniform.png" alt="แบบเสื้อตัวอย่างขนาดใหญ่ เห็นลายด้านหน้า ด้านหลัง และตำแหน่งดาวที่แขน" fill sizes="(max-width: 640px) 90vw, 1000px" className="object-contain" /></div>
                  </details>
                </div>
                <QuantityTable operation={selected} />
              </div>
              {selected.standards.length > 0 ? <details className="border-t border-divider px-4 sm:px-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-secondary">ข้อกำหนดขั้นนี้ <ChevronDown aria-hidden className="size-4" /></summary><ul className="space-y-2 pb-4">{selected.standards.map((standard) => <li key={standard.id} className="flex items-start gap-2 text-sm leading-relaxed text-secondary"><Check aria-hidden className="mt-1 size-3.5 shrink-0 text-muted" />{standard.label}</li>)}</ul></details> : null}
            </section>

            {relevantLots.length > 0 ? <section className="card-surface rounded-xl p-4 sm:p-5"><h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-strong"><Layers3 aria-hidden className="size-4 text-muted" />ของอยู่ที่ไหน<span className="ml-auto text-xs font-normal text-muted">{relevantLots.length} ล็อต</span></h3><Lots lots={relevantLots} onAction={openAction} /></section> : null}
          </div>
        </div>
      ) : <section className="space-y-4 rounded-xl border border-divider p-5"><div className="flex items-start gap-3"><Shirt className="size-5 text-muted" aria-hidden /><div><p className="text-sm font-medium text-strong">ยังไม่มีเส้นทางการผลิต</p><p className="mt-1 text-sm text-secondary">{order.nextAction}</p></div></div>{activeAction ? <FlowActionForm key={activeAction.id} action={activeAction} lot={order.lots.find((lot) => lot.id === activeAction.lotId)} role={role} revision={revision} onCommand={onCommand} onClose={() => setActionSession(null)} onSaved={setSaved} /> : <ActionZone>{primaryAction ? <Button type="button" onClick={() => openAction(primaryAction)}>{primaryAction.label}<ArrowRight /></Button> : null}{secondaryActions.map((action) => <Button key={action.id} type="button" variant="outline" onClick={() => openAction(action)}>{action.label}</Button>)}</ActionZone>}{saved ? <p role="status" className="text-sm text-green-700 dark:text-green-300">{saved}</p> : null}</section>}

      {order.lots.length > 0 ? <details className="border-t border-divider pt-1"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium text-secondary"><Layers3 className="size-4" aria-hidden />ของทั้งออเดอร์<span className="ml-auto text-xs font-normal tabular-nums text-muted">{order.lots.length} ล็อต / {lotLocations.length} จุด</span><ChevronDown className="size-4" aria-hidden /></summary><div className="space-y-5 pb-4">{lotLocations.map((group) => <section key={group.location}><h3 className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-2 text-sm font-medium text-strong"><span className="flex items-center gap-2"><MapPin className="size-4 text-muted" aria-hidden />{group.location}</span><span className="tabular-nums">{number(group.lots.reduce((total, lot) => total + lot.qty, 0))} ตัว</span></h3><Lots lots={group.lots} onAction={openAction} onSelectOperation={onSelectOperation} /></section>)}</div></details> : null}

      <details className="border-t border-divider pt-1">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium text-secondary"><History className="size-4" aria-hidden />ประวัติการทำงาน<span className="ml-auto text-xs font-normal tabular-nums text-muted">{order.history.length} รายการ</span><ChevronDown className="size-4" aria-hidden /></summary>
        {order.history.length > 0 ? <ol className="divide-y divide-divider pb-3">{order.history.map((entry) => <li key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[110px_minmax(0,1fr)]"><div className="text-xs tabular-nums text-muted">{formatDateShort(entry.at)}<span className="ml-2 sm:ml-0 sm:block">{formatTime(entry.at)}</span></div><div className="space-y-1"><p className="text-sm font-medium text-strong">{entry.title}</p><p className="text-sm leading-relaxed text-secondary">{entry.detail}</p><p className="text-xs text-muted">{entry.actor}</p></div></li>)}</ol> : <p className="pb-4 text-sm text-muted">ยังไม่มีรายการบันทึก</p>}
      </details>
    </article>
  );
}
