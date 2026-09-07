"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, Printer, Truck, UserRound } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Fact } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { MoreMenu } from "@/components/ui/more-menu";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { BigMockup } from "../_kit/pieces";
import { pendingOf, type LeanOrder, type LeanStep } from "../work-order-lean/_data";

export type DeskProps = { order: LeanOrder; boss: boolean; idPrefix: string };

/** Every control is confined to the static prototype. Never calls a mutation. */
function DemoDialog({ title, onClose, children }: { title: string | null; onClose: () => void; children?: ReactNode }) {
  if (!title) return null;
  return <Dialog open={!!title} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>ตัวอย่างการจัดวางปุ่มในหน้าลอง ยังไม่บันทึกหรือเปลี่ยนสถานะงาน</DialogDescription></DialogHeader>
      {children}
      <Button variant="outline" className="min-h-11" onClick={onClose}>กลับไปดูใบผลิต</Button>
    </DialogContent>
  </Dialog>;
}

export function OrderHeader({ order }: { order: LeanOrder }) {
  const [printing, setPrinting] = useState(false);
  return <header className="flex flex-wrap items-start justify-between gap-4 border-b border-divider pb-5">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-strong @lg:text-2xl">{order.orderNumber}</h1>
        <InfoChip size="sm">{order.status}</InfoChip>
        {order.priority ? <InfoChip size="sm" tone={order.priority === "URGENT" ? "error" : "warning"}>{order.priority === "URGENT" ? "เร่งด่วน" : "สำคัญ"}</InfoChip> : null}
      </div>
      <p className="mt-1.5 text-sm text-secondary">{order.customer}</p>
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div><p className="text-xs text-secondary">ส่งลูกค้า</p><p className={cn("mt-1 text-sm font-semibold", order.dueInDays < 0 ? "text-red-700 dark:text-red-300" : "text-strong")}>{order.dueLabel}</p>
        {order.dueInDays < 0 ? <p className="text-xs text-red-700 dark:text-red-300">เลยกำหนด {-order.dueInDays} วัน</p> : null}
      </div>
      <Button variant="outline" className="min-h-11" onClick={() => setPrinting(true)}><Printer />พิมพ์ใบสั่งงาน</Button>
    </div>
    <DemoDialog title={printing ? "พิมพ์ใบสั่งงาน" : null} onClose={() => setPrinting(false)}><p className="text-sm text-secondary">เมื่อลงหน้าจริง ปุ่มนี้ใช้ใบสั่งงานเดิมของออเดอร์ {order.orderNumber}</p></DemoDialog>
  </header>;
}

export function StepStatus({ step }: { step: LeanStep }) {
  if (step.state === "done") return <span className="inline-flex items-center gap-1.5 text-sm text-secondary"><CheckCircle2 className="size-4 text-green-700 dark:text-green-400" aria-hidden="true" />ผ่านแล้ว</span>;
  if (step.state === "blocked") return <InfoChip size="sm" tone="error" strong icon={AlertTriangle}>ติดปัญหา</InfoChip>;
  if (step.outsource && step.state === "waiting") return <InfoChip size="sm" tone={step.outsource.backInDays < 0 ? "error" : "warning"} strong icon={Truck}>{step.outsource.backInDays < 0 ? `เลยนัดรับ ${-step.outsource.backInDays} วัน` : "อยู่ที่ร้าน"}</InfoChip>;
  if (step.state === "active") return <InfoChip size="sm" tone="info">{step.mode === "paper" ? "ทำตามใบสั่งงาน" : "กำลังทำ"}</InfoChip>;
  return <span className="inline-flex items-center gap-1.5 text-sm text-secondary"><Clock3 className="size-4" aria-hidden="true" />รอขั้นก่อนหน้า</span>;
}

export function StepBody({ step, order, boss, primary = false, compact = false }: { step: LeanStep; order: LeanOrder; boss: boolean; primary?: boolean; compact?: boolean }) {
  const [action, setAction] = useState<string | null>(null);
  const waiting = pendingOf(step, order.steps);
  const current = step.state === "active" || step.state === "waiting" || step.state === "blocked";
  const vendor = step.outsource;
  return <div className={cn("min-w-0 space-y-4", compact && "text-sm")}>
    {step.problem ? <div className="space-y-1"><p className="font-semibold text-red-700 dark:text-red-300">{step.problem.title}</p><p className="text-sm text-secondary">{step.problem.detail}</p></div> : null}
    {current ? <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {vendor ? <>
          <div className="col-span-2"><Fact label="ร้านที่รับงาน" value={vendor.vendor} /></div>
          <Fact size="sm" label="ส่งออก" value={vendor.sentOn} />
          <Fact size="sm" label="นัดรับกลับ" value={vendor.backLabel} />
          <div className="col-span-2"><Fact size="sm" label="งานที่ส่ง" value={`${vendor.work} (${step.qtyTotal} ชิ้น)`} /></div>
        </> : <>
          <Fact size="sm" label="ผู้รับผิดชอบ" value={step.owner ?? "ยังไม่มอบหมาย"} />
          <Fact size="sm" label={step.mode === "paper" ? "จำนวนตามใบ" : "ทำแล้ว"} value={step.mode === "paper" ? `${step.qtyTotal} ตัว` : `${step.qtyDone} / ${step.qtyTotal} ตัว`} />
        </>}
      </div>
      {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
    </> : <>
      {waiting.length > 0 ? <p className="text-sm text-secondary">รอ {waiting.map((s) => s.short).join(" + ")}</p> : null}
      {step.state === "done" ? <p className="text-sm text-secondary">บันทึกครบ {step.qtyDone} ตัว{step.owner ? ` โดย ${step.owner}` : ""}</p> : null}
    </>}
    {(step.startedAt || step.completedAt || (vendor && step.owner)) ? <dl className="grid gap-1 text-xs text-secondary">
      {vendor && step.owner ? <div className="flex flex-wrap gap-x-2"><dt>ผู้ดูแลงาน</dt><dd>{step.owner}</dd></div> : null}
      {step.startedAt && !vendor ? <div className="flex flex-wrap gap-x-2"><dt>เริ่ม</dt><dd>{step.startedAt}</dd></div> : null}
      {step.completedAt ? <div className="flex flex-wrap gap-x-2"><dt>เสร็จ</dt><dd>{step.completedAt}</dd></div> : null}
    </dl> : null}
    <div><h3 className="text-xs font-medium text-secondary">ข้อกำหนดของขั้นนี้</h3>
        <ul className={cn("mt-2 space-y-1.5", !current && "text-secondary")}>{step.checklist.map((item) => <li key={item.label} className="flex gap-2 text-sm text-secondary"><span className="mt-2 size-1 shrink-0 rounded-full bg-current" aria-hidden="true" /><span>{item.label}</span></li>)}</ul>
      </div>
    {current ? <>
      <ActionZone menu={<MoreMenu className="min-h-11" items={[
        { key: "detail", label: "บันทึกรายละเอียด", onSelect: () => setAction("บันทึกรายละเอียด") },
        ...(boss ? [{ key: "assign", label: "มอบหมาย / จัดการขั้นนี้", icon: UserRound, onSelect: () => setAction("มอบหมาย / จัดการขั้นนี้") }] : []),
      ]} />}
        note={step.mode === "paper" && step.state !== "blocked" ? "จดยอดและลงชื่อบนใบสั่งงาน" : step.mode === "auto" ? "ขั้นนี้ผ่านเมื่อปิดรอบพิมพ์" : step.state === "blocked" && !boss ? "รอหัวหน้าแก้ปัญหา" : undefined}>
        {step.state === "blocked" ? boss ? <Button variant={primary ? "destructive" : "outline"} className="min-h-11" onClick={() => setAction("แก้ปัญหาขั้นงาน")}>แก้ปัญหา</Button> : null : step.mode === "screen" ? <Button variant={primary ? "default" : "outline"} className="min-h-11" onClick={() => setAction(step.action)}>{step.action}</Button> : null}
        {step.state !== "blocked" ? <Button variant="ghost" className="min-h-11" onClick={() => setAction("แจ้งปัญหา")}><AlertTriangle />แจ้งปัญหา</Button> : null}
      </ActionZone>
    </> : null}
    <DemoDialog title={action} onClose={() => setAction(null)}><div className="space-y-2"><p className="font-medium">{step.label}</p><p className="text-sm text-secondary">{vendor?.vendor ?? step.owner ?? order.orderNumber}</p>{vendor ? <p className="text-sm text-secondary">ปุ่มรับของในหน้าลองเป็นข้อเสนอ ต้องเชื่อมขั้นตอนรับของและตรวจรับเดิมก่อนใช้จริง</p> : null}</div></DemoDialog>
  </div>;
}

export function ReferencePanel({ order }: { order: LeanOrder }) {
  return <aside className="min-w-0 space-y-6 border-t border-divider pt-6 @5xl:border-l @5xl:border-t-0 @5xl:pl-6 @5xl:pt-0" aria-label="เสื้อ ลาย และข้อมูลใบ">
    <section>
      <div className="flex items-baseline justify-between gap-3"><h2 className="font-semibold text-strong">เสื้อและลาย</h2><span className="text-lg font-semibold tabular-nums text-strong">{order.qty} <span className="text-sm font-normal text-secondary">ตัว</span></span></div>
      <div className="mt-4 space-y-6">{order.items.map((item, index) => <div key={`${item.product}-${index}`} className="space-y-3">
        <BigMockup src={item.mockup} alt={`แบบ ${item.product}`} className="h-40 w-full [&_img]:object-contain" />
        <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-medium text-strong">{item.product}</h3>{order.items.length > 1 ? <span className="shrink-0 text-sm tabular-nums text-secondary">{item.qty} ตัว</span> : null}</div>
        <table className="w-full text-sm"><caption className="sr-only">จำนวนต่อไซซ์ {item.product}</caption><thead className={TABLE_HEAD_SURFACE}><tr className="text-left text-xs"><th className="pb-2 font-normal">ไซซ์ / สี</th><th className="pb-2 text-right font-normal">จำนวน</th></tr></thead><tbody>{item.sizes.map((size) => <tr key={size.size}><td className="py-1.5 text-secondary">{size.size}</td><td className="py-1.5 text-right font-medium tabular-nums">{size.qty}</td></tr>)}</tbody></table>
        <dl className="space-y-2">{item.prints.map((print, i) => <div key={`${print.position}-${i}`} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 text-sm"><dt className="text-secondary">{print.position}</dt><dd className="font-medium">{print.technique}<span className="block text-xs font-normal text-secondary">{print.size}</span></dd></div>)}</dl>
      </div>)}</div>
      <div className="mt-4 flex items-start gap-2 text-sm text-secondary">{order.mockupVersion ? <Check className="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />}<span>{order.mockupVersion ? `แบบอนุมัติ v${order.mockupVersion} โดย ${order.mockupApprovedBy}` : "ยังไม่มีแบบอนุมัติ"}</span></div>
      <p className="mt-3 text-sm text-secondary">{order.garment}</p>
    </section>
    <section className="border-t border-divider pt-5"><h2 className="text-sm font-semibold">ข้อมูลใบ</h2><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-secondary">สูตรขั้นงาน</dt><dd className="mt-1">{order.routing}</dd></div><div><dt className="text-xs text-secondary">เปิดใบ</dt><dd className="mt-1">{order.openedOn}</dd></div></dl>{order.note ? <p className="mt-3 text-sm text-secondary">{order.note}</p> : null}</section>
    {order.mockups.length > 1 ? <section className="border-t border-divider pt-5"><h2 className="text-sm font-semibold">ฉบับม็อกอัพ</h2><ul className="mt-3 space-y-2">{order.mockups.map((m) => <li key={m.version} className="flex justify-between gap-3 text-xs text-secondary"><span>v{m.version}{m.approved ? " อนุมัติ" : " ฉบับก่อน"}</span><span>{m.on}</span></li>)}</ul></section> : null}
  </aside>;
}
