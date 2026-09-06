"use client";

/**
 * ชิ้นส่วนร่วมของหน้าลอง "ใบผลิตเบาลง" — ปุ่ม ชิป ตัวเลข การ์ดปัญหา โซนลงมือ = component ตัวจริง
 * ที่เขียนเองคือ "การจัดวาง" ซึ่งเป็นสิ่งที่กำลังเทียบ · ทุกปุ่มยังไม่ทำอะไร (ข้อมูลปลอม)
 *
 * mode="current" = ลอกของจริงวันนี้ทีละชิ้น (work-order-page.tsx แบบ E) · mode="lean" = ชิ้นที่ทาง A/B/C ใช้ร่วมกัน
 * เบส (09-07 ค่ำ) "ไม่ชอบการหุบพับ จัดให้อยู่ในหน้าเดียวกัน" → A/B/C ไม่มีกล่องพับ: ลาย/ข้อมูลใบ/ประวัติ เป็น ReferenceRail อยู่บนหน้าเสมอ
 * ขนาดจอในหน้าลองอ่านจาก "ความกว้างของกรอบ" (@container) ไม่ใช่หน้าต่าง — กรอบมือถือ 390 ในหน้าเดียวกันจึงพับจริง
 */

import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Factory, FileText, History, MessageSquareText, MonitorSmartphone, Pencil, Printer, Shirt, Truck, UserRound, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Fact } from "@/components/ui/fact";
import { HelpTip } from "@/components/ui/help-tip";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { Section, ToneMark } from "@/components/ui/section";
import { FOCUS_BUTTON, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { BigMockup } from "../_kit/pieces";
import { RECORD_MODE_LABEL, isDone, pendingOf, problemSteps, shortWaitList, upcomingSteps, type LeanOrder, type LeanStep } from "./_data";
import { NodeMark, RouteMap, viewFor } from "./_map";

const noop = () => {};

/** รายการในเมนู "เพิ่มเติม" ของจริง (step-command-dialogs.fixCommands) */
const FIX_ITEMS: Omit<MoreMenuItem, "onSelect">[] = [
  { key: "edit", label: "บันทึกรายละเอียด", hint: "แก้ยอด หมายเหตุ และเวลาของขั้นนี้", icon: Pencil },
  { key: "qty", label: "แก้ยอดที่บันทึก", icon: Wrench },
  { key: "owner", label: "เปลี่ยนคนทำ", icon: UserRound },
  { key: "hold", label: "พักงานนี้ไว้ก่อน", icon: Clock },
  { key: "pass", label: "ผ่านขั้นนี้แทนช่าง", icon: CheckCircle2, danger: true },
];
const PAPER_DONE_ITEM: Omit<MoreMenuItem, "onSelect"> = { key: "paper-done", label: "จดว่าเสร็จแล้ว (จากกระดาษ)", hint: "ใส่ตามที่ช่างเขียนไว้ — ไม่บังคับ ส่งเข้า QC ก็ถือว่าผ่านให้", icon: FileText };
const PAPER_NOTE = "ทำตามใบสั่งงาน — ติ๊กและเขียนยอดบนกระดาษ ในระบบไม่ต้องกด";

/* ───────────────────────── หัวใบ ───────────────────────── */

function BackButton() {
  return (
    <button type="button" aria-label="กลับหน้าการผลิต" className={cn(FOCUS_BUTTON, "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-interactive-hover hover:text-strong")}>
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function PriorityBadge({ order }: { order: LeanOrder }) {
  if (!order.priority) return null;
  return (
    <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">
      {order.priority === "URGENT" ? "เร่งด่วน" : "สำคัญ"}
    </Badge>
  );
}

/** หัวใบของจริง (PageShell): ปุ่มกลับ · ไอคอนหมวด · เลขที่ + ป้ายสถานะ + ป้ายความสำคัญ · ชื่อลูกค้าใต้ */
export function HeadCurrent({ order, action }: { order: LeanOrder; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1">
          <BackButton />
        </span>
        <span className="mt-1">
          <ToneMark icon={Factory} tone="production" />
        </span>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tabular-nums text-strong">
            {order.orderNumber}
            <Badge variant="accent" size="sm">
              {order.status}
            </Badge>
            <PriorityBadge order={order} />
          </h1>
          <p className="mt-1 text-sm text-secondary">{order.customer}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

/** หัวใบแบบเบา: เลขที่ + ลูกค้า ซ้าย · กำหนดส่ง + จำนวน + พิมพ์ ขวา — ตัวเลข 4 ช่องหายไป (ผ่าน/ติดปัญหา อ่านจากแผนที่แทน) */
export function HeadLean({ order, className }: { order: LeanOrder; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tabular-nums text-strong">
            {order.orderNumber}
            <PriorityBadge order={order} />
          </h1>
          <p className="text-sm text-secondary">{order.customer}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DueTag dueInDays={order.dueInDays} dateLabel={order.dueLabel} size="lg" />
        <Metric value={order.qty.toLocaleString("th-TH")} unit="ตัว" size="md" icon={Shirt} />
        <Button variant="outline" size="sm">
          <Printer /> พิมพ์ใบสั่งงาน
        </Button>
      </div>
    </div>
  );
}

/** ตัวเลข 4 ช่องของจริง — จำนวน · กำหนดส่ง · ผ่านแล้ว · ติดปัญหา */
export function StatCards({ order }: { order: LeanOrder }) {
  const done = order.steps.filter(isDone).length;
  const problems = problemSteps(order.steps).length;
  return (
    <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
      <div className="card-surface rounded-2xl p-4">
        <Metric label="จำนวนที่ต้องผลิต" value={order.qty.toLocaleString("th-TH")} unit="ตัว" size="lg" icon={Shirt} />
      </div>
      <div className="card-surface rounded-2xl p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <CalendarCheck className="h-4 w-4" aria-hidden="true" /> กำหนดส่ง
        </p>
        <div className="mt-2">
          <DueTag dueInDays={order.dueInDays} dateLabel={order.dueLabel} size="lg" />
        </div>
      </div>
      <div className="card-surface rounded-2xl p-4">
        <Metric label="ผ่านแล้ว" value={`${done}/${order.steps.length}`} unit="ขั้น" size="lg" icon={CheckCircle2} tone={done === order.steps.length ? "success" : "default"} />
      </div>
      <div className="card-surface rounded-2xl p-4">
        <Metric label="ติดปัญหา" value={problems} unit="ขั้น" size="lg" icon={AlertTriangle} tone={problems > 0 ? "danger" : "muted"} />
      </div>
    </div>
  );
}

/** การ์ดแผนที่ของจริง — หัว "เส้นทางงาน" + ⓘ + ชิปม็อกอัพ + ปุ่มพิมพ์ แล้วค่อยแผนที่ */
export function MapCardCurrent({ order, focusId, onFocus }: { order: LeanOrder; focusId: string | null; onFocus: (id: string | null) => void }) {
  return (
    <div className="card-surface rounded-2xl p-4 @md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-strong">เส้นทางงาน</p>
        <HelpTip label="เส้นทางงาน">สายที่เดินพร้อมกันอยู่คนละแถว เส้นวิ่งมารวมที่ขั้นที่ต้องรอกัน — กดขั้นไหนเพื่อเปิดขั้นนั้น</HelpTip>
        <span className="ml-auto inline-flex flex-wrap items-center gap-2">
          {order.mockupVersion !== null ? (
            <InfoChip size="sm" tone="success" icon={CheckCircle2}>
              ม็อกอัพอนุมัติ v{order.mockupVersion}
            </InfoChip>
          ) : (
            <InfoChip size="sm" tone="warning">
              ยังไม่มีม็อกอัพอนุมัติ
            </InfoChip>
          )}
          <Button variant="outline" size="sm">
            <Printer /> พิมพ์ใบสั่งงาน
          </Button>
        </span>
      </div>
      <RouteMap steps={order.steps} focusId={focusId} onFocus={onFocus} honest={false} fullNames />
    </div>
  );
}

/* ───────────────────────── เสื้อ (ของจริง) ───────────────────────── */

/** แถบเสื้อของจริง — กล่องจม ชื่อสินค้า + จำนวน + ชิปไซซ์ */
export function ShirtStrip({ order }: { order: LeanOrder }) {
  return (
    <div className={cn(SUNK_PANEL, RADIUS.inner, "px-4 py-3")}>
      <ul className="divide-y divide-divider">
        {order.items.map((item) => (
          <li key={item.product} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-medium text-strong">{item.product}</p>
              <Metric value={item.qty.toLocaleString("th-TH")} unit="ตัว" size="sm" />
            </div>
            <InfoChipRow className="mt-1.5">
              {item.sizes.map((v) => (
                <InfoChip key={v.size} size="sm">
                  {v.size} <span className="font-semibold">{v.qty}</span>
                </InfoChip>
              ))}
            </InfoChipRow>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────── ชิ้นส่วนในการ์ดขั้น ───────────────────────── */

export function Owner({ step }: { step: LeanStep }) {
  return step.owner ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
      <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      {step.owner}
    </span>
  ) : (
    <span className="text-sm text-muted">ยังไม่มีคนรับ</span>
  );
}

/** การ์ดปัญหาของจริง (ProblemCard): หัว "งานติดปัญหา" + ขั้น + ผู้รับผิดชอบ */
export function ProblemCardCurrent({ step }: { step: LeanStep }) {
  return (
    <Alert variant="error" title="งานติดปัญหา" meta={[{ label: "ขั้น", value: step.label }, ...(step.owner ? [{ label: "ผู้รับผิดชอบ", value: step.owner }] : [])]}>
      {step.problem?.detail ?? step.note ?? "ยังไม่ระบุเหตุ"}
    </Alert>
  );
}

/** การ์ดปัญหาแบบเบา: หัวคือชื่อปัญหา (ไม่ใช่คำว่า "งานติดปัญหา") · ขั้น/คนอยู่ในการ์ดขั้นอยู่แล้ว */
export function ProblemCardLean({ step }: { step: LeanStep }) {
  if (!step.problem) return null;
  return (
    <Alert variant="error" title={step.problem.title} meta={[{ label: "แจ้งเมื่อ", value: step.problem.since }]}>
      {step.problem.detail}
    </Alert>
  );
}

function StateChipCurrent({ step }: { step: LeanStep }) {
  const view = viewFor(step, false);
  const label = view === "done" ? "ผ่านแล้ว" : view === "active" ? "กำลังทำ" : view === "blocked" ? "ติดปัญหา" : view === "waiting" ? "รอ" : "ยังไม่ถึง";
  const tone = view === "done" ? "success" : view === "active" ? "info" : view === "blocked" ? "error" : view === "waiting" ? "warning" : "neutral";
  return (
    <InfoChip size="md" tone={tone} strong={view === "active" || view === "blocked"} icon={step.kind === "outsource" ? Truck : Wrench}>
      {label}
    </InfoChip>
  );
}

const RECORD_MODE_ICON = { screen: MonitorSmartphone, paper: FileText, auto: Printer } as const;
const RECORD_MODE_TONE = { screen: "info", paper: "neutral", auto: "success" } as const;

function OutsourceFacts({ step, lean }: { step: LeanStep; lean: boolean }) {
  const o = step.outsource;
  if (!o) return null;
  const overdue = o.backInDays < 0;
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 @md:grid-cols-3">
      <Fact icon={Truck} label="ร้านนอก" value={o.vendor} sub={`ส่งไป ${o.sentOn}`} />
      <Fact label="งานที่ส่ง" value={o.work} sub={`${step.qtyTotal.toLocaleString("th-TH")} ชิ้น`} />
      <div>
        <p className="text-xs font-medium text-muted">นัดรับกลับ</p>
        <InfoChip tone={overdue ? "error" : "info"} strong={overdue || lean} icon={CalendarCheck} className="mt-1">
          {lean && overdue ? `เลยนัด ${-o.backInDays} วัน · ${o.backLabel}` : o.backLabel}
        </InfoChip>
      </div>
    </div>
  );
}

/** โซนลงมือ — ActionZone ตัวจริง กติกาปุ่มลอกจาก StepDetail ของจริง · lean = เพิ่มปุ่ม "รับของกลับ" ให้ขั้นที่ของอยู่ที่ร้าน */
export function Zone({ step, boss, mode }: { step: LeanStep; boss: boolean; mode: "current" | "lean" }) {
  const done = step.state === "done";
  const stuck = step.state === "blocked";
  const paper = step.mode === "paper" && !done && !stuck;
  const atVendor = step.state === "waiting" && !!step.outsource;
  const menu = boss && !done ? <MoreMenu items={[...(paper ? [PAPER_DONE_ITEM] : []), ...FIX_ITEMS].map((item) => ({ ...item, onSelect: noop }))} /> : null;
  const report =
    !done && !stuck ? (
      <Button variant="ghost">
        <AlertTriangle /> แจ้งปัญหา
      </Button>
    ) : null;

  if (done) return <ActionZone note={`ปิดขั้นแล้ว ${step.completedAt ?? ""}${step.owner ? ` · โดย ${step.owner}` : ""}`} icon={CheckCircle2} tone="success" />;
  if (stuck) {
    return (
      <ActionZone note="แก้ปัญหาก่อน จึงลงมือขั้นนี้ต่อได้" icon={AlertTriangle} tone="error" menu={menu}>
        {boss ? (
          <Button variant="destructive">
            <Wrench /> ปลดปัญหา / เปลี่ยนคน
          </Button>
        ) : null}
      </ActionZone>
    );
  }
  if (step.state === "todo") {
    return (
      <ActionZone note="ยังไม่ถึงคิวขั้นนี้ — ทำขั้นก่อนหน้าให้จบก่อน" icon={Clock} tone="neutral" menu={menu}>
        {report}
      </ActionZone>
    );
  }
  if (atVendor) {
    if (mode === "current") {
      return (
        <ActionZone note="อยู่ที่ร้านนอก" icon={Clock} tone="neutral" menu={menu}>
          {report}
        </ActionZone>
      );
    }
    return (
      <ActionZone note={`ของอยู่ที่${step.outsource!.vendor} — กดเมื่อของกลับมาถึงโรงงาน`} icon={Truck} tone="info" menu={menu}>
        <Button>{step.action}</Button>
        {report}
      </ActionZone>
    );
  }
  if (paper) {
    return (
      <ActionZone note={PAPER_NOTE} icon={FileText} tone="neutral" menu={menu}>
        {report}
      </ActionZone>
    );
  }
  if (step.mode === "auto") return <ActionZone note="ผ่านเองเมื่อปิดรอบพิมพ์ — ขั้นนี้ไม่ต้องกด" icon={Printer} tone="success" menu={menu} />;
  return (
    <ActionZone note="พร้อมลงมือ — ทำครบข้อกำหนดแล้วค่อยกดปุ่ม" icon={MonitorSmartphone} tone="info" menu={menu}>
      <Button>{step.action}</Button>
      {report}
    </ActionZone>
  );
}

/** การ์ดขั้นของจริง (StepDetail แบบ E) — ลอกทีละบรรทัด: ชิป 3 · ช่อง 3 · ร้านนอก 3 · หมายเหตุ · ข้อกำหนด 3 · โซนลงมือ */
export function StepCardCurrent({ step, boss }: { step: LeanStep; boss: boolean }) {
  return (
    <Section
      title={step.label}
      meta={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StateChipCurrent step={step} />
          <InfoChip size="md" tone={RECORD_MODE_TONE[step.mode]} icon={RECORD_MODE_ICON[step.mode]}>
            {RECORD_MODE_LABEL[step.mode]}
          </InfoChip>
          {step.station ? (
            <InfoChip size="md" icon={step.kind === "outsource" ? Truck : step.lane === "shirt" ? Shirt : Wrench}>
              {step.station}
            </InfoChip>
          ) : null}
        </span>
      }
      action={<Owner step={step} />}
      tone="production"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 @md:grid-cols-3">
          <div>
            <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
          </div>
          <Fact label="เริ่มเมื่อ" value={step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
          <Fact label="เสร็จเมื่อ" value={step.completedAt ?? "ยังไม่เสร็จ"} tone={step.completedAt ? "success" : "muted"} />
        </div>
        {step.outsource ? <OutsourceFacts step={step} lean={false} /> : null}
        {step.note && step.state !== "blocked" ? <p className="text-sm text-secondary">{step.note}</p> : null}
        <div>
          <p className="flex items-center justify-between text-xs font-medium text-muted">
            <span>ข้อกำหนดมาตรฐานของขั้นนี้</span>
            {step.mode === "paper" ? <span>ช่องติ๊กอยู่บนใบสั่งงาน</span> : null}
          </p>
          <ul className="mt-1.5 space-y-1">
            {step.checklist.map((item) => (
              <li key={item.label} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="text-strong">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <Zone step={step} boss={boss} mode="current" />
      </div>
    </Section>
  );
}

/** ข้อเท็จจริงเฉพาะที่มีค่า — ไม่มีช่อง "ยังไม่เสร็จ/ยังไม่เริ่ม" · ร้านนอกไม่โชว์ 0/30 เพราะของอยู่ที่ร้าน */
function LeanFacts({ step }: { step: LeanStep }) {
  if (step.outsource && step.state !== "done") return <OutsourceFacts step={step} lean />;
  if (step.state === "done") {
    return (
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 @md:grid-cols-3">
        <div>
          <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone="success" />
        </div>
        <Fact label="ปิดขั้นเมื่อ" value={step.completedAt ?? "—"} tone="success" />
      </div>
    );
  }
  if (step.mode === "paper") {
    return (
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 @md:grid-cols-3">
        <Fact label="ควรเสร็จ" value={step.planEnd} />
        <Fact icon={FileText} label="ยอดและเวลา" value="บนใบสั่งงาน" sub="ช่างเขียนตอนทำ" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 @md:grid-cols-3">
      <div>
        <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
      </div>
      <Fact label="ควรเสร็จ" value={step.planEnd} />
    </div>
  );
}

/** ข้อกำหนด — เหลือเฉพาะข้อที่ยังไม่ทำ · ที่ทำแล้วนับเป็นตัวเลขต่อท้าย (ไม่ซ่อนใน ⓘ — เบสไม่เอาของพับ) */
function Remaining({ step }: { step: LeanStep }) {
  if (step.state === "done") return null;
  const left = step.checklist.filter((c) => !c.done);
  if (left.length === 0) return null;
  const done = step.checklist.length - left.length;
  return (
    <div>
      <p className="text-xs font-medium text-muted">
        {step.mode === "paper" ? "ก่อนปิดขั้น — ติ๊กบนใบสั่งงาน" : "ก่อนปิดขั้น"}
        {done > 0 ? (
          <span>
            {" "}
            · ทำแล้ว {done} จาก {step.checklist.length}
          </span>
        ) : null}
      </p>
      <ul className="mt-1.5 space-y-1">
        {left.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-strong">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** การ์ดขั้นแบบเบา — ชื่อ + คน · ปัญหา · ข้อเท็จจริงที่มีค่า · หมายเหตุ · ที่เหลือก่อนปิด · โซนลงมือ (ไม่มีชิปสถานะ — แผนที่บอกแล้ว) */
export function StepLean({ step, boss, big = false, bare = false, className }: { step: LeanStep; boss: boolean; big?: boolean; bare?: boolean; className?: string }) {
  return (
    <article className={cn(!bare && "card-surface rounded-2xl p-5", "space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className={cn("font-semibold text-strong", big ? "text-2xl" : "text-xl")}>{step.label}</h2>
        <Owner step={step} />
      </div>
      <ProblemCardLean step={step} />
      <LeanFacts step={step} />
      {step.note && !step.problem ? (
        <p className="flex items-start gap-2 text-sm text-strong">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          {step.note}
        </p>
      ) : null}
      <Remaining step={step} />
      <Zone step={step} boss={boss} mode="lean" />
    </article>
  );
}

/* ───────────────────────── ถัดไป (ของจริง) ───────────────────────── */

/** กล่อง "ถัดไป — ยังไม่ถึงคิว" ของจริง */
export function NextPanel({ steps, onFocus }: { steps: LeanStep[]; onFocus: (id: string) => void }) {
  const upcoming = upcomingSteps(steps);
  if (upcoming.length === 0) return null;
  return (
    <div className={cn(SUNK_PANEL, RADIUS.inner, "p-4")}>
      <p className="text-xs font-medium text-muted">ถัดไป — ยังไม่ถึงคิว</p>
      <ul className="mt-2 space-y-1.5">
        {upcoming.map((s) => {
          const pending = pendingOf(s, steps);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <button type="button" onClick={() => onFocus(s.id)} className={cn(FOCUS_BUTTON, "rounded font-medium text-strong hover:underline")}>
                {s.label}
              </button>
              <span className="text-secondary">{pending.length > 0 ? `รอ ${shortWaitList(pending.map((p) => p.label))}` : "ยังไม่ถึงคิว"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BackToNow({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <ArrowLeft /> กลับไปดู “ตอนนี้ทำอะไร”
    </Button>
  );
}

/* ───────────────────────── กล่องพับของจริง (เฉพาะทาง "ปัจจุบัน") ───────────────────────── */

function Disclosure({ summary, icon: Icon, children }: { summary: string; icon: typeof History; children: React.ReactNode }) {
  return (
    <details className="group card-surface rounded-2xl">
      <summary className={cn(FOCUS_BUTTON, "flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-5 text-sm font-medium text-strong transition-colors hover:bg-interactive-hover [&::-webkit-details-marker]:hidden")}>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        {summary}
      </summary>
      <div className="border-t border-divider px-5 py-5">{children}</div>
    </details>
  );
}

/** 3 กล่องพับท้ายใบของจริง (ลาย · ข้อมูลใบ · ประวัติ) — เนื้อในจำลองพอให้เห็นว่ากางแล้วเจออะไร */
export function FoldedCurrent({ order }: { order: LeanOrder }) {
  const outsourced = order.steps.filter((s) => s.outsource);
  return (
    <>
      <Disclosure summary="ลายและม็อกอัพที่อนุมัติ" icon={ClipboardCheck}>
        <div className="grid gap-5 @md:grid-cols-[auto_minmax(0,1fr)]">
          <BigMockup src={order.items[0]?.mockup ?? null} alt={`ม็อกอัพ ${order.orderNumber}`} className="h-40 w-40" />
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 @md:grid-cols-2">
            <Fact label="ม็อกอัพอนุมัติ" value={order.mockupVersion !== null ? `v${order.mockupVersion}` : "ยังไม่มี"} sub={order.mockupVersion !== null ? `โดย ${order.mockupApprovedBy}` : undefined} />
            {order.items[0]?.prints.map((p) => (
              <Fact key={p.position} label={`${p.position} · ${p.technique}`} value={p.size} />
            ))}
          </div>
        </div>
      </Disclosure>
      <Disclosure summary="ข้อมูลใบ — ออเดอร์ วัตถุดิบ และงานร้านนอก" icon={FileText}>
        <div className="grid gap-5 @2xl:grid-cols-2">
          <Section title="ออเดอร์และใบผลิต" icon={ClipboardCheck} tone="production">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 @md:grid-cols-2">
              <Fact label="ลูกค้า" value={order.customer} />
              <Fact label="สถานะออเดอร์" value={order.status} />
              <Fact label="กำหนดส่ง" value={order.dueLabel} icon={CalendarCheck} />
              <Fact label="ความสำคัญ" value={order.priority === "URGENT" ? "เร่งด่วน" : order.priority === "HIGH" ? "สำคัญ" : "ปกติ"} />
              <Fact label="สถานะใบผลิต" value={order.productionStatus} />
              <Fact label="ขั้นทั้งหมด" value={`${order.steps.length} ขั้น`} sub={`ร้านนอก ${outsourced.length} ขั้น`} />
            </div>
            {order.note ? (
              <Alert variant="warning" className="mt-4" title="หมายเหตุใบผลิต">
                {order.note}
              </Alert>
            ) : null}
          </Section>
          <div className="space-y-5">
            <Section title="เสื้อและวัตถุดิบ" icon={Shirt} tone="product">
              <p className="text-sm text-secondary">{order.garment}</p>
            </Section>
            <Section title="งานร้านนอกในใบนี้" icon={Truck} tone="production" meta={`${outsourced.length} งาน`}>
              {outsourced.length > 0 ? (
                <ul className="divide-y divide-divider">
                  {outsourced.map((s) => (
                    <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="mb-2 text-sm font-medium text-strong">{s.label}</p>
                      <OutsourceFacts step={s} lean={false} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">ยังไม่มีขั้นที่ส่งร้านนอก</p>
              )}
            </Section>
          </div>
        </div>
      </Disclosure>
      <Disclosure summary="ประวัติ — เวลาจริงต่อขั้น · ม็อกอัพทุกเวอร์ชัน" icon={History}>
        <div className="grid gap-5 @2xl:grid-cols-2">
          <Section title="เวลาจริงต่อขั้น" icon={History} tone="system">
            <ol className="divide-y divide-divider">
              {order.steps.map((s) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-strong">{s.label}</span>
                    <span className="block text-xs text-muted">{s.owner ?? "ยังไม่มีคนรับ"}</span>
                  </span>
                  <InfoChipRow>
                    {s.startedAt ? (
                      <InfoChip size="sm" tone="info">
                        เริ่ม {s.startedAt}
                      </InfoChip>
                    ) : null}
                    {s.completedAt ? (
                      <InfoChip size="sm" tone="success">
                        เสร็จ {s.completedAt}
                      </InfoChip>
                    ) : null}
                    {!s.startedAt && !s.completedAt ? <InfoChip size="sm">ยังไม่เริ่ม</InfoChip> : null}
                  </InfoChipRow>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="ม็อกอัพทุกเวอร์ชัน" icon={ClipboardCheck} tone="production">
            <ul className="divide-y divide-divider">
              {order.mockups.map((m) => (
                <li key={m.version} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span className="font-medium text-strong">v{m.version}</span>
                  <span className="text-secondary">{m.on}</span>
                  <InfoChip size="sm" tone={m.approved ? "success" : "neutral"} strong={m.approved}>
                    {m.approved ? `อนุมัติ · ${m.by}` : "ไม่ได้ใช้"}
                  </InfoChip>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </Disclosure>
    </>
  );
}

/* ───────────────────────── ข้อมูลประกอบ — อยู่บนหน้าเสมอ ไม่พับ (A/B/C) ───────────────────────── */

function RailTitle({ icon: Icon, children, meta }: { icon: typeof History; children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-strong">
      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      {children}
      {meta ? <span className="ml-auto text-xs font-normal text-muted">{meta}</span> : null}
    </h3>
  );
}

/** บรรทัดประวัติต่อขั้น — ไม่เกิน 2 ข้อมูลต่อบรรทัด */
function historyLine(s: LeanStep): string {
  if (s.outsource) {
    if (s.state === "done") return `ส่งไป ${s.outsource.sentOn} · กลับ ${s.completedAt ?? "—"}`;
    return `ส่งไป ${s.outsource.sentOn} · นัดรับ ${s.outsource.backLabel}`;
  }
  if (s.state === "done") return `เริ่ม ${s.startedAt ?? "—"} · เสร็จ ${s.completedAt ?? "—"}`;
  if (s.startedAt) return `เริ่ม ${s.startedAt} · ทำแล้ว ${s.qtyDone}/${s.qtyTotal}`;
  return `ยังไม่เริ่ม · ควรเสร็จ ${s.planEnd}`;
}

/**
 * คอลัมน์ข้อมูลประกอบ — สิ่งที่เคยอยู่ในกล่องพับ 3 กล่อง (ลาย/ม็อกอัพ · ข้อมูลใบ · ประวัติ) วางบนหน้าเสมอ
 * บนคอมเป็นคอลัมน์ขวา (21rem) · จอแคบต่อท้ายคอลัมน์งาน · ไม่ซ้ำกับหัวใบ (กำหนดส่ง/ความสำคัญ/ลูกค้า อยู่หัวใบแล้ว ไม่ใส่ซ้ำ)
 */
export function ReferenceRail({ order, bare = false, className }: { order: LeanOrder; bare?: boolean; className?: string }) {
  const first = order.items[0];
  const outsourced = order.steps.filter((s) => s.outsource).length;
  return (
    <aside className={cn(!bare && "card-surface rounded-2xl", "divide-y divide-divider", className)} aria-label="ข้อมูลประกอบใบผลิต">
      <section className="p-4 @md:p-5">
        <RailTitle icon={Shirt} meta={`${order.qty.toLocaleString("th-TH")} ตัว`}>
          เสื้อและลาย
        </RailTitle>
        <div className="mt-3 flex gap-4">
          <BigMockup src={first?.mockup ?? null} alt={`ม็อกอัพ ${order.orderNumber}`} className="h-24 w-24 shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            {order.items.map((item) => (
              <div key={item.product}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium text-strong">{item.product}</p>
                  {order.items.length > 1 ? <span className="text-xs tabular-nums text-secondary">{item.qty} ตัว</span> : null}
                </div>
                <InfoChipRow className="mt-1">
                  {item.sizes.map((v) => (
                    <InfoChip key={v.size} size="sm">
                      {v.size} <span className="font-semibold">{v.qty}</span>
                    </InfoChip>
                  ))}
                </InfoChipRow>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {first?.prints.map((p) => (
            <Fact key={p.position} size="sm" label={`${p.position} · ${p.technique}`} value={p.size} />
          ))}
        </div>
        <InfoChipRow className="mt-3">
          {order.mockups.map((m) =>
            m.approved ? (
              <InfoChip key={m.version} size="sm" tone="success" strong icon={CheckCircle2}>
                ม็อกอัพ v{m.version} อนุมัติ {m.on}
              </InfoChip>
            ) : (
              <InfoChip key={m.version} size="sm">
                v{m.version}
              </InfoChip>
            ),
          )}
        </InfoChipRow>
        <p className="mt-2 text-sm text-secondary">{order.garment}</p>
      </section>

      <section className="p-4 @md:p-5">
        <RailTitle icon={FileText} meta={`เปิดใบ ${order.openedOn}`}>
          ข้อมูลใบ
        </RailTitle>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact size="sm" label="สถานะออเดอร์" value={order.status} />
          <Fact size="sm" label="ขั้นทั้งหมด" value={`${order.steps.length} ขั้น`} sub={outsourced > 0 ? `ร้านนอก ${outsourced} ขั้น` : "ทำเองทั้งใบ"} />
          <div className="col-span-2">
            <Fact size="sm" label="สูตรขั้นงาน" value={order.routing} />
          </div>
        </div>
        {order.note ? (
          <Alert variant="warning" className="mt-3" title="หมายเหตุใบผลิต">
            {order.note}
          </Alert>
        ) : null}
      </section>

      <section className="p-4 @md:p-5">
        <RailTitle icon={History}>ประวัติ — เวลาจริงต่อขั้น</RailTitle>
        <ol className="mt-3 space-y-3">
          {order.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <span className="mt-0.5">
                <NodeMark view={viewFor(s, true)} order={s.order} outsource={s.kind === "outsource"} size="sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-strong">{s.short}</span>
                  {s.owner ? <span className="text-xs text-muted">{s.owner}</span> : null}
                </span>
                <span className="block text-xs text-secondary">{historyLine(s)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
