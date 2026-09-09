"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, Factory, History, UserRound } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Fact, FactList } from "@/components/ui/fact";
import { DueTag } from "@/components/ui/due-tag";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { MoreMenu } from "@/components/ui/more-menu";
import { StatusLabel, type StatusTone } from "@/components/ui/status-label";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { formatDateShort, formatTime } from "@/lib/utils";
import { selectOrder } from "../_domain/engine";
import type { FlowAction, FlowRole, FlowState, LotView, OperationView, OrderView } from "../_domain/types";
import { FlowActionForm, type CommandHandler } from "./flow-action-form";
import { FamiliarList } from "./familiar-list";
import { FamiliarRail } from "./familiar-rail";

export interface FamiliarFlowProps {
  state: FlowState;
  role: FlowRole;
  revision: number;
  clock: string;
  selectedOrderId?: string;
  selectedOperationId?: string | null;
  onSelectOrder: (id: string) => void;
  onSelectOperation: (id: string) => void;
  onBack: () => void;
  onCommand: CommandHandler;
}

const TONES: Record<OperationView["state"], StatusTone> = { ready: "accent", working: "accent", waiting: "neutral", vendor: "warning", inspection: "warning", done: "success", problem: "danger" };
const lotStatus = (lot: LotView) => lot.condition === "available" ? (lot.actions.some(action => action.kind === "transfer") ? "ผ่านขั้นนี้แล้ว" : "รอบันทึกผล") : lot.conditionLabel;
const distinct = (actions: FlowAction[]) => [...new Map(actions.map(action => [action.id, action])).values()];

/** Existing form structure, with the prototype quantity engine behind its controls. */
function FamiliarDetail({ order, ...props }: FamiliarFlowProps & { order: OrderView }) {
  const nextAction = order.actions.find(action => action.label === order.nextAction && action.enabled) ?? order.actions.find(action => action.primary && action.enabled);
  const selected = order.operations.find(op => op.id === props.selectedOperationId)
    ?? order.operations.find(op => op.id === nextAction?.operationId)
    ?? order.operations.find(op => op.state !== "done") ?? order.operations[0];
  const [lotId, setLotId] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<FlowAction | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const lots = selected?.lots ?? [];
  const selectedLot = lots.find(lot => lot.id === lotId)
    ?? lots.find(lot => lot.id === nextAction?.lotId)
    ?? lots.find(lot => lot.actions.some(action => action.primary && action.enabled)) ?? lots[0];
  const unreleased = props.state.orders.find(item => item.id === order.id)?.released === false;
  const actions = distinct([...(selected?.actions ?? order.actions), ...order.actions.filter(action => action.kind === "release")].filter(action => !action.lotId || action.lotId === selectedLot?.id));
  const primary = actions.find(action => action.enabled && action.label === order.nextAction) ?? actions.find(action => action.enabled && action.primary) ?? actions.find(action => action.enabled && !["assign", "issue"].includes(action.kind));
  const liveAction = dialogAction ? order.actions.find(action => action.id === dialogAction.id)
    ?? { ...dialogAction, enabled: false, disabledReason: "ข้อมูลเปลี่ยนแล้ว กรุณาเลือกล็อตจากข้อมูลล่าสุด" } : null;
  const viewOperations = order.operations.filter(op => op.workOrderId === selected?.workOrderId).map(op => unreleased ? { ...op, state: "waiting" as const, statusLabel: "ยังไม่เปิดใบผลิต" } : op);
  const selectedLines = selected?.lines ?? [];
  const unknown = order.unknown;
  const due = <DueTag dueInDays={differenceInBangkokDays(order.dueAt, new Date(props.clock))} dateLabel={formatDateShort(order.dueAt)} />;
  function openAction(action: FlowAction) { setDialogAction(action); setSaved(null); }
  function selectStep(id: string) { props.onSelectOperation(id); setLotId(null); setSaved(null); }

  return <PageShell title={order.number} icon={Factory} tone="production" description={order.customer}
    back={{ href: "/proto/production-flow", label: "กลับหน้าการผลิต" }}
    titleBadge={<StatusLabel label={unreleased ? "รอเปิดใบผลิต" : order.statusLabel} tone={order.status === "packed" ? "success" : order.status === "problem" ? "danger" : "neutral"} />}
    action={<>{primary && <Button onClick={() => openAction(primary)}>{primary.label}</Button>}<MoreMenu size="sm" items={[
      ...actions.filter(action => action.id !== primary?.id).map(action => ({ key: action.id, label: action.label, disabled: !action.enabled, hint: action.disabledReason, onSelect: () => openAction(action) })),
      { key: "history", label: "ประวัติการผลิต", icon: History, onSelect: () => setHistoryOpen(true) },
    ]} /></>}>
    {unknown ? <Alert title="ยังไม่ยืนยันข้อมูลใบเดิม">ยังไม่มีหลักฐานจำนวนและตำแหน่งเสื้อ กรุณาตรวจใบเดิมก่อนบันทึก</Alert> : <>
      {order.workOrders.length > 1 && <div className="max-w-sm"><Select aria-label="เลือกใบผลิต" value={selected?.workOrderId ?? ""} onChange={event => { const operation = order.operations.find(op => op.workOrderId === event.target.value && op.state !== "done") ?? order.operations.find(op => op.workOrderId === event.target.value); if (operation) selectStep(operation.id); }}>{order.workOrders.map(workOrder => <option key={workOrder.id} value={workOrder.id}>{workOrder.number}</option>)}</Select></div>}
      {selected && <FamiliarRail operations={viewOperations} selectedId={selected.id} onSelect={selectStep} />}
      {unreleased ? <Alert title="ยังไม่เปิดใบผลิต">ตรวจสูตรและจำนวนให้ครบ แล้วกดเปิดใบผลิตเพื่อปล่อยงาน</Alert> : selected?.issue || order.blockers.length > 0 ? <Alert variant="warning">{selected?.issue ?? order.blockers[0]}</Alert> : null}
    </>}
    {saved && <p role="status" className="text-sm text-secondary">{saved}</p>}
    <Tabs defaultValue="steps">
      <TabsBar><TabsList><TabsTrigger value="steps">ขั้นตอน</TabsTrigger><TabsTrigger value="items">สินค้า</TabsTrigger></TabsList></TabsBar>
      <TabsContent value="steps" className="pt-5">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            {selected && !unknown ? <Section title={selected.name} action={<StatusLabel label={unreleased ? "ยังไม่เปิดใบผลิต" : selected.statusLabel} tone={unreleased ? "neutral" : TONES[selected.state]} />}>
              {lots.length > 1 && <div className="mb-4 space-y-1.5"><label htmlFor="familiar-lot" className="text-sm font-medium">เลือกส่วนที่ทำรายการ</label><Select id="familiar-lot" value={selectedLot?.id ?? ""} onChange={event => setLotId(event.target.value)}>{lots.map(lot => <option key={lot.id} value={lot.id}>{lot.color} {lot.size} — {lot.qty} ตัว / {lot.location} / {lotStatus(lot)}</option>)}</Select></div>}
              <div className="space-y-4">
                {[...new Set(selectedLines.map(line => line.product))].map(product => <div key={product}>
                  <h3 className="mb-2 text-sm font-semibold text-strong">{product}</h3>
                  <table className="w-full text-left text-sm" aria-label={`ยอดผลิต ${product}`}><thead className={TABLE_HEAD_SURFACE}><tr><th className="py-3 pr-2">สี / ไซซ์</th><th className="px-1 py-3 text-right">จำนวน</th><th className="px-1 py-3 text-right">ผ่าน</th><th className="px-1 py-3 text-right">รอแก้</th><th className="py-3 pl-1 text-right">เสีย</th></tr></thead><tbody className="divide-y divide-divider">{selectedLines.filter(line => line.product === product).map(line => <tr key={line.scopeKey}><td className="py-3 pr-2"><span className="font-medium">{line.size}</span><span className="ml-2 text-secondary">{line.color}</span></td><td className="px-1 py-3 text-right tabular-nums">{line.planned}</td><td className="px-1 py-3 text-right tabular-nums">{line.good}</td><td className="px-1 py-3 text-right tabular-nums">{line.rework}</td><td className="py-3 pl-1 text-right tabular-nums">{line.waste}</td></tr>)}</tbody></table>
                </div>)}
                <FactList columns={2}><Fact label="พร้อมทำต่อ" value={`${selected.qtyReady} ตัว`} /><Fact label="ผ่านขั้นนี้แล้ว" value={`${selected.qtyGood} / ${selected.qtyPlanned} ตัว`} /></FactList>
                {selected.waitingOn.length > 0 && <p className="text-sm text-secondary">{selected.waitingOn.join(" / ")}</p>}
              </div>
              {lots.length > 0 && <div className="mt-4 border-t border-divider pt-4"><div className="space-y-2">{lots.map(lot => <div key={lot.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm"><span className="text-secondary">{lot.color} {lot.size} — {lot.location}{lot.defectReason ? ` (${lot.defectReason})` : ""}</span><span className="tabular-nums">{lotStatus(lot)} {lot.qty} ตัว</span></div>)}</div></div>}
            </Section> : <Section title="ข้อมูลหน้างาน"><p className="text-sm text-secondary">ยังไม่ยืนยันจำนวนรับเข้าและผลผลิต</p></Section>}
            {!unknown && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 text-secondary">ของทั้งออเดอร์</summary><div className="space-y-3 border-t border-divider py-4">{order.lots.map(lot => <Fact key={lot.id} label={`${lot.product} ${lot.color} ${lot.size}`} value={`${lot.location} — ${lot.qty} ตัว`} sub={lotStatus(lot)} />)}</div></details>}
          </div>
          <aside className="space-y-5 xl:sticky xl:top-4">
            {selected && !unknown && <Section title="ข้อกำหนด"><Fact label="ผู้ทำ" value={selected.assignedTo?.name ?? "ยังไม่มอบหมาย"} icon={UserRound} /><ul className="mt-4 space-y-2 text-sm text-secondary">{selected.standards.map(standard => <li key={standard.id} className="flex gap-2"><span aria-hidden="true">•</span><span>{standard.label}</span></li>)}</ul>{!selected.standards.length && <p className="mt-3 text-sm text-secondary">ตรวจสินค้า สี ไซซ์ และจำนวนตามใบงาน</p>}</Section>}
            <Section title="ข้อมูลออเดอร์"><FactList columns={1}><Fact label="ลูกค้า" value={order.customer} /><Fact label="กำหนดส่ง" value={due} /><Fact label="จำนวนทั้งออเดอร์" value={`${order.totalQty} ตัว`} /><Fact label="แพ็กพร้อมส่ง" value={unknown ? "ยังไม่ยืนยัน" : `${order.packedQty} / ${order.totalQty} ตัว`} /></FactList><details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-secondary">แบบเสื้อตัวอย่าง</summary><Image src="/proto-production-flow/uniform.png" alt="แบบเสื้อตัวอย่างด้านหน้าและหลัง" width={320} height={320} className="w-full rounded-lg border border-divider object-contain" /></details></Section>
          </aside>
        </div>
      </TabsContent>
      <TabsContent value="items" className="pt-5"><Section title="รายการสินค้า"><div className="space-y-5">{props.state.orders.find(item => item.id === order.id)?.scopes.map(scope => <div key={scope.key} className="border-b border-divider pb-4 last:border-0"><FactList columns={3}><Fact label="สินค้า" value={scope.product} /><Fact label="สี / ไซซ์" value={`${scope.color} / ${scope.size}`} /><Fact label="จำนวน" value={`${scope.orderedQty} ตัว`} /></FactList><p className="mt-3 text-sm text-secondary">{scope.prints.map(print => `${print.label} ${print.technique} (${print.artworkVersion})`).join(" / ") || "ไม่มีงานพิมพ์"}</p></div>)}</div></Section></TabsContent>
    </Tabs>
    {liveAction && <Dialog open onOpenChange={open => { if (!open) setDialogAction(null); }}><DialogContent className="sm:max-w-xl"><DialogTitle className="sr-only">{liveAction?.label ?? "บันทึกการผลิต"}</DialogTitle><DialogDescription className="sr-only">บันทึกจำนวนจริงของส่วนที่เลือก</DialogDescription>{liveAction && <FlowActionForm key={liveAction.id} action={liveAction} lot={order.lots.find(lot => lot.id === liveAction.lotId)} role={props.role} revision={props.revision} onCommand={props.onCommand} onClose={() => setDialogAction(null)} onSaved={setSaved} />}</DialogContent></Dialog>}
    {historyOpen && <Dialog open onOpenChange={setHistoryOpen}><DialogContent><DialogTitle>ประวัติการผลิต</DialogTitle><DialogDescription>{order.number}</DialogDescription><ol className="space-y-4">{order.history.map(event => <li key={event.id} className="space-y-1 border-b border-divider pb-3"><p className="text-sm font-medium">{event.title}</p><p className="text-sm text-secondary">{event.detail}</p><p className="text-xs text-muted">{event.actor} / {formatTime(event.at)}</p></li>)}</ol></DialogContent></Dialog>}
  </PageShell>;
}

export function FamiliarFlow(props: FamiliarFlowProps) {
  const order = props.selectedOrderId ? selectOrder(props.state, props.selectedOrderId, props.role) : undefined;
  if (!props.selectedOrderId) return <FamiliarList state={props.state} role={props.role} onSelectOrder={props.onSelectOrder} />;
  if (!order) return <Section title="ไม่พบออเดอร์"><Button variant="outline" onClick={props.onBack}><ArrowLeft />กลับหน้าการผลิต</Button></Section>;
  return <div onClickCapture={event => { const anchor = (event.target as HTMLElement).closest('a[href="/proto/production-flow"]'); if (anchor) { event.preventDefault(); event.stopPropagation(); props.onBack(); } }}><FamiliarDetail key={`${order.id}:${props.role}`} {...props} order={order} /></div>;
}
