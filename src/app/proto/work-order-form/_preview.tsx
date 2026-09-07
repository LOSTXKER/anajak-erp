"use client";

/**
 * ตัววาดของหน้าลอง "ใบผลิตแบบฟอร์ม" — โครงเดียวกับหน้าออเดอร์จริง (`orders/detail/order-detail-page.tsx`):
 *   หัวใบ (PageHeader ตัวจริง) → แถบสถานะ (OrderStatusBar ตัวจริง — ราง 1 2 3 ที่เบสเคาะ 08-11/08-30)
 *   → ซ้าย: แท็บ ลายและเสื้อ / ข้อมูลใบ / ประวัติ (Tabs ตัวจริง) · ขวา: เช็คลิสต์ของขั้นที่ยืนอยู่
 *
 * รอบ 2 (เบสสั่ง 09-08 หลังเคาะ A): "ลายและเสื้อมาแท็บแรก · ขั้นงานอยู่หน้าเดียวกันฝั่งขวาเป็นเช็คลิสต์
 * · ต้องติ๊กให้ครบถึงจะไปขั้นถัดไปได้ โดยกด CTA ข้างบนเป็นหลัก" — แท็บขั้นงานและตารางทุกขั้นถอดออก
 *
 * กดปุ่มขั้นต่อไปแล้วขั้นเดินจริงในหน้า (state ในหน้า ไม่ยิงฐาน) · ย้อนกลับได้จากเมนู ⋯ — ให้เบสลอง "รู้สึก" ก่อนเคาะ
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, ExternalLink, Factory, Flag, ListChecks, Pause, RotateCcw, Store, UserRound } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import type { RouterOutput } from "@/lib/trpc";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { Section } from "@/components/ui/section";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import { CASE_4, CASE_7, PROTO_TODAY, STATE_LABEL, recordModeOf, type WorkOrder, type WorkStep } from "./_data";
import { applyStep, closeAll, currentStageIndex, headCta, lastClosed, reopen, stageDone, stagesFor, stepBlockedNote, stepCta, type HeadCta, type Stage, type Variant } from "./_engine";

export const REAL_PAGE = "/production/demo-production-outsource-overdue";

type OrderItem = RouterOutput["order"]["getById"]["items"][number];

/* ───────────────────────── ปัจจุบัน = หน้าจริงจากฐานทดลอง ───────────────────────── */

function NowFrame() {
  return (
    <Section title="ปัจจุบัน = หน้าจริงจากฐานทดลอง (แบบ E ที่เคาะ 6 ก.ย.)" tone="production">
      <p className="text-sm text-secondary">
        เว็บตั้งค่าห้ามฝังหน้าซ้อนในหน้าอื่น (กันคนเอาเว็บเราไปแปะ) จึงเปิดหน้าจริงในแท็บใหม่แทน — ปุ่มสลับใบ 4/7 ขั้นและหัวหน้า/ช่างไม่มีผลกับหน้าจริง
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild>
          <a href={REAL_PAGE} target="_blank" rel="noreferrer">
            เปิดใบ ORD-2609-0009 หน้าจริง <ExternalLink />
          </a>
        </Button>
        <Button variant="outline" onClick={() => window.open(REAL_PAGE, "proto-mobile", "width=390,height=820,noopener")}>
          เปิดหน้าจริงขนาดมือถือ (390)
        </Button>
      </div>
    </Section>
  );
}

/* ───────────────────────── ตัววาดหลัก ───────────────────────── */

export function Preview({ variant, case7, boss, pair = true }: { variant: Variant; case7: boolean; boss: boolean; pair?: boolean }) {
  if (variant === "now") return <NowFrame />;
  return <FormWorkOrder key={`${variant}-${case7 ? 7 : 4}`} variant={variant} order={case7 ? CASE_7 : CASE_4} boss={boss} pair={pair} />;
}

/** ข้อที่ยังไม่ติ๊กของขั้นที่ปุ่มบนจะ "ปิด" — ต้องเป็น 0 ก่อนกดได้ (เบสสั่ง 09-08 "ต้องกดให้ครบถึงจะไปขั้นถัดไป") */
function checklistRemaining(cta: HeadCta): number {
  if (cta.kind === "step") return cta.cta.to === "done" ? cta.step.checklist.filter((c) => !c.done).length : 0;
  if (cta.kind === "close-stage") return cta.steps.reduce((n, s) => n + (s.state === "done" ? 0 : s.checklist.filter((c) => !c.done).length), 0);
  return 0;
}

function FormWorkOrder({ variant, order, boss, pair }: { variant: Variant; order: WorkOrder; boss: boolean; pair: boolean }) {
  const [steps, setSteps] = useState(order.steps);
  const [tab, setTab] = useState("items");
  // ขั้นที่กางเช็คลิสต์อยู่ใน sidebar (null = ขั้นที่ยืนอยู่)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stages = stagesFor(variant, steps, pair);
  const currentIndex = currentStageIndex(stages);
  const stage = stages[currentIndex]!;
  const next = stages[currentIndex + 1] ?? null;
  const cta = headCta(stage, next, boss);
  const allDone = stages.every(stageDone);
  const undoTarget = lastClosed(stages);
  const remaining = checklistRemaining(cta);

  // ป้ายบนรางต้องไม่ซ้ำ (OrderStatusBar ใช้ป้ายเป็น key) — ซ้ำเมื่อไหร่ต่อเลขช่องให้
  const railLabels = stages.map((st, i) => (stages.some((o, j) => j !== i && o.label === st.label) ? `${st.label} ${i + 1}` : st.label));

  const problems = steps.filter((s) => s.state === "blocked");

  function fire() {
    if (remaining > 0) {
      // จอทัชไม่มี hover: ปุ่มหลักที่ยังกดปิดไม่ได้ต้อง "พาไปที่ต้องติ๊ก" ไม่ใช่ตายเงียบ (critique 09-08 ข้อ 1)
      setSelectedId(null);
      requestAnimationFrame(() => document.getElementById("proto-current-step")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    if (cta.kind === "step") setSteps(applyStep(steps, cta.step.id, cta.cta.to));
    else if (cta.kind === "close-stage") setSteps(closeAll(steps, cta.steps.map((s) => s.id)));
  }
  function tick(stepId: string, index: number) {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, checklist: s.checklist.map((c, j) => (j === index ? { ...c, done: !c.done } : c)) } : s)));
  }

  const menu: MoreMenuItem[] = [
    {
      key: "undo",
      label: undoTarget ? `ย้อนกลับ — เปิด “${undoTarget.label}” ใหม่` : "ย้อนกลับขั้นก่อน",
      icon: RotateCcw,
      hint: !boss ? "หัวหน้าเท่านั้น — ช่างแจ้งหัวหน้าให้ย้อน" : undoTarget ? "ขั้นที่ปิดไปจะกลับมาเปิด ยอดและติ๊กคงไว้ ระบบจดว่าใครย้อน" : "ยังไม่มีขั้นที่ปิดไป",
      disabled: !boss || !undoTarget,
      onSelect: () => undoTarget && setSteps(reopen(steps, undoTarget)),
    },
    { key: "problem", label: "แจ้งปัญหาขั้นนี้", icon: Flag, hint: "เลือกเหตุ → หัวหน้าเห็นทันที", onSelect: () => stage.steps[0] && setSteps(applyStep(steps, stage.steps[0].id, "blocked")) },
    { key: "assign", label: "มอบหมาย / แก้ให้", icon: UserRound, hint: boss ? "เปลี่ยนคนทำ แก้ยอด หรือจดแทนช่าง" : "หัวหน้าเท่านั้น", disabled: !boss, onSelect: () => {} },
    { key: "hold", label: "พักงานใบนี้", icon: Pause, hint: boss ? "ออกจากคิวจนกว่าจะปลด" : "หัวหน้าเท่านั้น", disabled: !boss, danger: true, onSelect: () => {} },
  ];

  const ctaLabel = cta.kind === "step" ? cta.cta.label : cta.kind === "close-stage" ? cta.label : null;

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <PageHeader
          icon={Factory}
          tone="production"
          breadcrumb={[{ label: "การผลิต", href: "#" }, { label: order.orderNumber }]}
          title={order.orderNumber}
          description={order.company ? `${order.customer} · ${order.company}` : order.customer}
          titleBadge={
            allDone || order.urgent ? (
              <span className="flex flex-wrap items-center gap-1.5">
                {allDone ? <Badge variant="success" size="sm">ส่งเข้า QC แล้ว</Badge> : null}
                {order.urgent ? <Badge variant="destructive" size="sm">เร่งด่วน</Badge> : null}
              </span>
            ) : null
          }
          action={
            <>
              <Button variant="outline" size="sm" aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)">
                <ClipboardList />
                <span className="hidden sm:inline">ใบสั่งงาน</span>
              </Button>
              {ctaLabel ? (
                // ปุ่มหลักโชว์ตลอดแต่กดได้เมื่อติ๊กครบ (เบสสั่ง 09-08) — ต่างจากกติกา DESIGN "ห้ามวางปุ่มที่กดไม่ได้" ของหน้าออเดอร์ · ลงจริงต้องเคาะอีกที
                <Button
                  onClick={fire}
                  aria-disabled={remaining > 0}
                  variant={cta.kind === "step" && cta.cta.danger ? "destructive" : "default"}
                  className={cn("shrink-0", remaining > 0 && "opacity-60")}
                  title={remaining > 0 ? `ติ๊กข้อกำหนดให้ครบก่อน — เหลือ ${remaining} ข้อ (กดเพื่อไปติ๊ก)` : cta.kind === "step" ? `ขั้น ${currentIndex + 1} · ${cta.step.label}` : stage.title}
                >
                  {ctaLabel}
                  <ChevronRight />
                </Button>
              ) : null}
              <MoreMenu items={menu} size="sm" />
            </>
          }
        />

        {/* ราง 1 2 3 ตัวจริงของหน้าออเดอร์ — อ่านอย่างเดียว การเดินอยู่ที่ปุ่มบนหัวใบที่เดียว */}
        <OrderStatusBar
          flowSteps={railLabels}
          currentStepIndex={allDone ? stages.length - 1 : currentIndex}
          internalStatus={railLabels[allDone ? stages.length - 1 : currentIndex]!}
          customerStatus="PRODUCING"
          revisions={[]}
          cancelledAt={null}
          cancelledReason={null}
          blockers={cta.kind === "none" && !allDone ? [cta.note] : []}
        />
      </div>

      {/* ชั้น 1 ของทั้งใบ (กฎ 3 ชั้น DESIGN §ลำดับความสำคัญทางสายตา): ตัวเลขที่ต้องเห็นก่อน — Metric ตัวจริง ไม่ใช่บรรทัดเทา */}
      <div className={cn(SUNK_PANEL, RADIUS.surface, "flex flex-wrap items-start gap-x-8 gap-y-4 p-4")}>
        <Metric label="จำนวนที่ต้องผลิต" value={order.qty.toLocaleString("th-TH")} unit="ตัว" size="md" />
        <div>
          <p className="text-xs font-medium text-muted">กำหนดส่ง</p>
          <DueTag dueInDays={order.dueInDays} dateLabel={order.dueLabel} size="lg" className="mt-1" />
        </div>
        {problems.length > 0 ? <Metric label="ติดปัญหา" value={problems.length} unit="ขั้น" size="md" tone="danger" icon={AlertTriangle} /> : null}
      </div>

      {/* นอกแท็บ (เหมือนหมายเหตุใบนี้ของหน้าออเดอร์): ปัญหาที่ค้างต้องเห็นไม่ว่าอยู่แท็บไหน */}
      {problems.map((s) => (
        <Alert key={s.id} variant="error" icon={AlertTriangle} title={`${s.label} — ${s.problem?.title ?? "ติดปัญหา"}`}>
          {s.problem?.detail ?? "รอหัวหน้าจัดการ"}
          {s.problem?.since ? <span className="text-muted"> · แจ้งเมื่อ {s.problem.since}</span> : null}
        </Alert>
      ))}
      {/* รอบ 8 (เบส 09-08 ดึก): 3 คอลัมน์ — ซ้าย = ขั้นตอนแบบ sidebar กดแล้วกางเช็คลิสต์ · กลาง = ลายและเสื้อ / ประวัติ · ขวา = ข้อมูลใบ (ไม่มีร้านนอกในใบนี้แล้ว)
          จอแคบเรียงบนลงล่าง: ขั้นตอน → เนื้อหา → ข้อมูลใบ */}
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)_280px] lg:items-start">
        <StepSidebar
          variant={variant}
          stages={stages}
          currentIndex={currentIndex}
          selectedId={selectedId}
          onSelect={setSelectedId}
          boss={boss}
          allDone={allDone}
          ctaLabel={ctaLabel}
          remaining={remaining}
          onStep={(id, to) => setSteps(applyStep(steps, id, to))}
          onTick={tick}
        />

        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsBar>
              <TabsList aria-label="ส่วนของใบผลิต">
                <TabsTrigger value="items">ลายและเสื้อ</TabsTrigger>
                <TabsTrigger value="history">ประวัติ</TabsTrigger>
              </TabsList>
            </TabsBar>
            <div className="mt-6">
              <TabsContent value="items">
                {/* ตัวจริงของแท็บรายการหน้าออเดอร์ (เบสสั่ง 09-08 "ใช้แบบหน้านี้เลย จะได้ไม่งง") — ไม่มีปุ่มแก้ไข · ไม่โชว์เงิน */}
                <OrderItemsDisplay orderId={order.orderNumber} items={order.orderItems as OrderItem[]} fees={[]} showMoney={false} canEditReceiveTracking={false} />
              </TabsContent>
              <TabsContent value="history">
                <Section title="ประวัติใบนี้" meta={`วันนี้ ${PROTO_TODAY}`}>
                  <ol className="divide-y divide-divider">
                    {order.events.map((e, i) => (
                      <li key={i} className="flex items-start gap-3 py-2 text-sm">
                        <span aria-hidden="true" className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", e.tone === "danger" ? "bg-red-500" : e.tone === "success" ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600")} />
                        <span className="w-24 shrink-0 tabular-nums text-secondary">{e.at}</span>
                        <span className="min-w-0">
                          <span className="font-medium text-strong">{e.who}</span> <span className="text-secondary">{e.what}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <Section title="ข้อมูลใบ" className="lg:sticky lg:top-4">
          <FactList columns={1}>
            <Fact label="ลูกค้า" value={order.customer} sub={order.company ?? undefined} />
            <Fact label="ช่องทาง" value={order.channel} />
            <Fact label="กำหนดส่ง" value={<DueTag dueInDays={order.dueInDays} dateLabel={order.dueLabel} size="sm" />} />
            <Fact label="จำนวน" value={`${order.qty.toLocaleString("th-TH")} ตัว`} />
            <Fact label="สูตรขั้นงาน" value={order.routingName} />
            <Fact label="ม็อกอัพอนุมัติ" value={order.mockupVersion} />
            {order.note ? <Fact label="หมายเหตุใบนี้" value={<span className="[overflow-wrap:anywhere]">{order.note}</span>} /> : null}
          </FactList>
        </Section>
      </div>

      <p className="text-xs text-muted">ตัวเลขทั้งหมดเป็นของปลอม — จำลองในหน้า ไม่บันทึกจริง</p>
    </div>
  );
}

/* ───────────────────────── ซ้าย: ขั้นตอนแบบ sidebar — กดแล้วกางเช็คลิสต์ ───────────────────────── */

function StepSidebar({
  variant,
  stages,
  currentIndex,
  selectedId,
  onSelect,
  boss,
  allDone,
  ctaLabel,
  remaining,
  onStep,
  onTick,
}: {
  variant: Variant;
  stages: Stage[];
  currentIndex: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  boss: boolean;
  allDone: boolean;
  ctaLabel: string | null;
  remaining: number;
  onStep: (id: string, to: WorkStep["state"]) => void;
  onTick: (id: string, index: number) => void;
}) {
  const current = stages[currentIndex]!;
  // ขั้นที่กางอยู่: ที่กดเลือก หรือ (ถ้าไม่ได้เลือก) ทุกขั้นในช่องที่ยืนอยู่
  const openIds = new Set(selectedId ? [selectedId] : current.steps.map((s) => s.id));
  const next = stages[currentIndex + 1] ?? null;

  return (
    <Section
      title="ขั้นตอน"
      meta={allDone ? "เสร็จทุกขั้น" : next ? `ถัดไป ${next.label}` : "ขั้นสุดท้าย"}
      flush
      className="lg:sticky lg:top-4"
    >
      <ol>
        {stages.flatMap((stage, stageIndex) =>
          stage.steps.map((step, j) => {
            const isCurrent = stageIndex === currentIndex && !allDone;
            const open = openIds.has(step.id);
            const locked = !isCurrent || step.state === "done" || (step.state === "blocked" && !boss) || (stage.kind === "paper" && step.state !== "blocked" && !boss);
            const small = isCurrent && stage.steps.length > 1 && step.state !== "done" ? stepCta(step, boss) : null;
            const smallRemaining = small?.to === "done" ? step.checklist.filter((c) => !c.done).length : 0;
            const note = isCurrent ? stepBlockedNote(step, boss) : null;
            const left = step.checklist.filter((c) => !c.done).length;
            const done = step.state === "done";
            return (
              <li key={step.id} id={isCurrent && j === 0 ? "proto-current-step" : undefined} className={cn("border-b border-divider last:border-b-0", isCurrent && "border-l-2 border-l-blue-600 bg-blue-50/50 dark:bg-blue-950/20")}>
                {/* หัวแถว = ปุ่มกดกาง/หุบ (เป้ากด 44px) */}
                <button
                  type="button"
                  onClick={() => onSelect(open && selectedId === step.id ? null : step.id)}
                  aria-expanded={open}
                  className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums",
                      done ? "bg-blue-600 text-white" : isCurrent ? "bg-blue-600 text-white ring-[3px] ring-blue-100 dark:bg-blue-500 dark:ring-blue-500/25" : "border-2 border-border text-muted",
                    )}
                  >
                    {j === 0 ? stageIndex + 1 : "+"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", isCurrent ? "font-semibold text-strong" : done ? "text-secondary" : "text-muted")}>{step.label}</span>
                    {!open ? <span className="block text-xs text-muted">{step.owner ?? "ยังไม่มีคนรับ"}</span> : null}
                  </span>
                  <StateBadge step={step} />
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
                </button>

                {open ? (
                  <div className="space-y-4 px-3 pb-4 pl-12">
                    <FactList columns={2}>
                      <Fact size="sm" label="ผู้ทำ" value={step.owner ?? "ยังไม่มีคนรับ"} tone={step.owner ? "default" : "muted"} />
                      <Fact size="sm" label="ทำแล้ว" value={<span className="tabular-nums">{step.qtyDone.toLocaleString("th-TH")} / {step.qtyTotal.toLocaleString("th-TH")}</span>} />
                      <Fact size="sm" label="ควรเสร็จ" value={done ? step.planEnd : <DueTag dueInDays={step.planEndInDays} dateLabel={step.planEnd} size="sm" />} />
                      {step.outsource ? (
                        <Fact size="sm" icon={Store} label="ร้านนอก" value={step.outsource.vendor} sub={done ? "รับกลับแล้ว" : <DueTag dueInDays={step.outsource.backInDays} dateLabel={`นัดรับ ${step.outsource.backLabel}`} size="sm" />} />
                      ) : null}
                    </FactList>
                    {stage.kind === "pair" ? <InfoChip size="sm" tone="info">ทำพร้อมกับขั้นก่อน</InfoChip> : null}
                    <RecordChip step={step} variant={variant} />
                    {isCurrent && step.note && !note ? <p className="text-sm text-secondary">{step.note}</p> : null}
                    {note ? (
                      <p className="flex items-start gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {note}
                      </p>
                    ) : null}

                    <div>
                      <p className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
                        <span>ข้อกำหนดก่อนปิดขั้น</span>
                        {isCurrent && !locked ? (
                          left > 0 ? (
                            <InfoChip size="sm" strong tone="warning" icon={ListChecks}>ติ๊กอีก {left} ข้อ</InfoChip>
                          ) : (
                            <InfoChip size="sm" strong tone="success" icon={CheckCircle2}>ครบแล้ว</InfoChip>
                          )
                        ) : null}
                      </p>
                      <ul className="mt-1">
                        {step.checklist.map((c, i) => (
                          <li key={i}>
                            <label className={cn("flex min-h-11 items-center gap-3 text-sm", locked ? "cursor-default" : "cursor-pointer")}>
                              <Checkbox className="h-5 w-5" checked={c.done} disabled={locked} onChange={() => onTick(step.id, i)} />
                              <span className={cn(c.done ? "text-secondary line-through decoration-border" : locked ? "text-muted" : "font-medium text-strong")}>{c.label}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {small ? (
                      <Button variant={small.danger ? "destructive" : "outline"} disabled={smallRemaining > 0} onClick={() => onStep(step.id, small.to)} className="w-full">
                        {small.label}
                      </Button>
                    ) : null}
                    {isCurrent && !small && remaining === 0 && ctaLabel ? (
                      <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> กด “{ctaLabel}” บนหัวใบ
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          }),
        )}
      </ol>
    </Section>
  );
}

/* ───────────────────────── ป้ายเล็ก ───────────────────────── */

function StateBadge({ step }: { step: WorkStep }) {
  const v = step.state === "done" ? "success" : step.state === "blocked" ? "destructive" : step.state === "waiting" ? "warning" : step.state === "active" ? "accent" : "default";
  return <Badge variant={v} size="sm">{STATE_LABEL[step.state]}</Badge>;
}

/** โหมดจด (กติกา A5) — โผล่เฉพาะทาง C ที่รางแยกตามโหมดจด · ทาง A/B ไม่โชว์ศัพท์นี้ (ทีมทักว่า "อะไรไม่รู้") */
function RecordChip({ step, variant }: { step: WorkStep; variant: Variant }) {
  if (variant !== "record") return null;
  const mode = recordModeOf(step);
  return <InfoChip size="sm" tone={mode === "screen" ? "info" : "neutral"}>{mode === "screen" ? "จดในระบบ" : mode === "auto" ? "ผ่านเองจากรอบพิมพ์" : "จดบนกระดาษ"}</InfoChip>;
}
