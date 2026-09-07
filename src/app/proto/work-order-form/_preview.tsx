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
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, ExternalLink, Factory, Flag, ImageOff, Pause, RotateCcw, Store, UserRound } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { Section } from "@/components/ui/section";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RADIUS, TABLE_HEAD_SURFACE, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import { CASE_4, CASE_7, PROTO_TODAY, STATE_LABEL, recordModeOf, type WorkItem, type WorkOrder, type WorkStep } from "./_data";
import { applyStep, closeAll, currentStageIndex, headCta, lastClosed, reopen, stageDone, stagesFor, stepBlockedNote, stepCta, type HeadCta, type Stage, type Variant } from "./_engine";

export const REAL_PAGE = "/production/demo-production-outsource-overdue";

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
    if (remaining > 0) return;
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
          description={null}
          titleBadge={
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge variant="accent" size="sm">{allDone ? "ส่งเข้า QC แล้ว" : "กำลังผลิต"}</Badge>
              {order.urgent ? <Badge variant="destructive" size="sm">เร่งด่วน</Badge> : null}
            </span>
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
                  disabled={remaining > 0}
                  variant={cta.kind === "step" && cta.cta.danger ? "destructive" : "default"}
                  className="shrink-0"
                  title={remaining > 0 ? `ติ๊กข้อกำหนดให้ครบก่อน — เหลือ ${remaining} ข้อ` : cta.kind === "step" ? `ขั้น ${currentIndex + 1} · ${cta.step.label}` : stage.title}
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

      {/* นอกแท็บ (เหมือนหมายเหตุใบนี้ของหน้าออเดอร์): ปัญหาที่ค้างต้องเห็นไม่ว่าอยู่แท็บไหน */}
      {problems.map((s) => (
        <Alert key={s.id} variant="error" icon={AlertTriangle} title={`${s.label} — ${s.problem?.title ?? "ติดปัญหา"}`}>
          {s.problem?.detail ?? "รอหัวหน้าจัดการ"}
          {s.problem?.since ? <span className="text-muted"> · แจ้งเมื่อ {s.problem.since}</span> : null}
        </Alert>
      ))}
      {order.note ? (
        <div className={cn(TINT.warning, "flex flex-wrap gap-x-2 gap-y-1 rounded-lg border px-4 py-3 text-sm")}>
          <span className="font-medium">หมายเหตุใบนี้</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{order.note}</span>
        </div>
      ) : null}

      {/* ซ้าย = ของที่ต้องดูขณะทำ (ลาย/เสื้อ) · ขวา = เช็คลิสต์ของขั้นที่ยืนอยู่ · จอแคบเช็คลิสต์ขึ้นก่อน */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:order-2">
          <StepPanel variant={variant} stage={stage} index={currentIndex} total={stages.length} next={next} boss={boss} allDone={allDone} ctaLabel={ctaLabel} remaining={remaining} onStep={(id, to) => setSteps(applyStep(steps, id, to))} onTick={tick} />
          <StepList stages={stages} currentIndex={currentIndex} />
        </aside>

        <div className="min-w-0 lg:order-1">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsBar>
              <TabsList aria-label="ส่วนของใบผลิต">
                <TabsTrigger value="items">ลายและเสื้อ</TabsTrigger>
                <TabsTrigger value="info">ข้อมูลใบ</TabsTrigger>
                <TabsTrigger value="history">ประวัติ</TabsTrigger>
              </TabsList>
            </TabsBar>

            <div className="mt-6">
              <TabsContent value="items">
                <ItemsTable order={order} />
              </TabsContent>

              <TabsContent value="info" className="grid gap-6 md:grid-cols-2">
                <Section title="ออเดอร์">
                  <FactList columns={2}>
                    <Fact label="ลูกค้า" value={order.customer} sub={order.company ?? undefined} />
                    <Fact label="ช่องทาง" value={order.channel} />
                    <Fact label="กำหนดส่ง" value={<DueTag dueInDays={order.dueInDays} dateLabel={order.dueLabel} size="sm" />} />
                    <Fact label="จำนวน" value={`${order.qty.toLocaleString("th-TH")} ตัว`} />
                    <Fact label="สูตรขั้นงาน" value={order.routingName} />
                    <Fact label="ม็อกอัพอนุมัติ" value={order.mockupVersion} />
                  </FactList>
                </Section>
                <Section title="ร้านนอกในใบนี้" meta={`${steps.filter((s) => s.outsource).length} งาน`}>
                  {steps.filter((s) => s.outsource).length === 0 ? (
                    <p className="text-sm text-muted">ใบนี้ทำเองทั้งใบ</p>
                  ) : (
                    <ul className="divide-y divide-divider">
                      {steps
                        .filter((s) => s.outsource)
                        .map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium text-strong">{s.outsource!.vendor}</span>
                              <span className="block text-xs text-secondary">{s.outsource!.work} · ส่ง {s.outsource!.sentOn}</span>
                            </span>
                            <DueTag dueInDays={s.state === "done" ? null : s.outsource!.backInDays} dateLabel={s.state === "done" ? "รับกลับแล้ว" : `นัดรับ ${s.outsource!.backLabel}`} size="sm" />
                          </li>
                        ))}
                    </ul>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="history">
                <Section title="ประวัติใบนี้" meta={`วันนี้ ${PROTO_TODAY}`}>
                  <ol className="divide-y divide-divider">
                    {order.events.map((e, i) => (
                      <li key={i} className="flex gap-3 py-2 text-sm">
                        <span className="w-28 shrink-0 text-xs tabular-nums text-muted">{e.at}</span>
                        <span className="min-w-0">
                          <span className={cn("font-medium", e.tone === "danger" ? "text-red-700 dark:text-red-300" : e.tone === "success" ? "text-green-700 dark:text-green-300" : "text-strong")}>{e.who}</span>{" "}
                          <span className="text-secondary">{e.what}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      <p className="text-xs text-muted">ตัวเลขทั้งหมดเป็นของปลอม — จำลองในหน้า ไม่บันทึกจริง</p>
    </div>
  );
}

/* ───────────────────────── ฝั่งขวา: ขั้นที่ยืนอยู่ (การ์ดละขั้น) ───────────────────────── */

function StepPanel({
  variant,
  stage,
  index,
  total,
  next,
  boss,
  allDone,
  ctaLabel,
  remaining,
  onStep,
  onTick,
}: {
  variant: Variant;
  stage: Stage;
  index: number;
  total: number;
  next: Stage | null;
  boss: boolean;
  allDone: boolean;
  ctaLabel: string | null;
  remaining: number;
  onStep: (id: string, to: WorkStep["state"]) => void;
  onTick: (id: string, index: number) => void;
}) {
  if (allDone) {
    return (
      <Section title="ใบนี้เสร็จแล้ว" icon={CheckCircle2} tone="production">
        <p className="text-sm text-secondary">ทุกขั้นปิดแล้ว งานอยู่ที่ QC — ย้อนกลับได้จากเมนู ⋯ ถ้าปิดผิด</p>
      </Section>
    );
  }

  const multi = stage.steps.length > 1;
  const paper = stage.kind === "paper";
  const doneNote = remaining === 0 && ctaLabel ? `ครบแล้ว — กด “${ctaLabel}” ด้านบน` : remaining > 0 ? `ติ๊กอีก ${remaining} ข้อ แล้วกดปุ่มด้านบน` : null;

  return (
    <>
      {multi ? (
        <p className="flex flex-wrap items-center gap-2 px-1 text-sm text-secondary">
          <span className="font-medium text-strong">ช่อง {index + 1} จาก {total}</span>
          <InfoChip size="sm" tone="info">{stage.kind === "pair" ? "ช่องคู่ — ทำพร้อมกันได้" : paper ? "จดบนกระดาษ" : "ทำพร้อมกัน"}</InfoChip>
          {next ? <span className="text-muted">ถัดไป {next.label}</span> : null}
        </p>
      ) : null}

      {stage.steps.map((step) => {
        const small = multi && step.state !== "done" ? stepCta(step, boss) : null;
        const smallRemaining = small?.to === "done" ? step.checklist.filter((c) => !c.done).length : 0;
        const note = stepBlockedNote(step, boss);
        const locked = step.state === "done" || (step.state === "blocked" && !boss) || (paper && step.state !== "blocked" && !boss);
        const ticked = step.checklist.filter((c) => c.done).length;
        return (
          <Section
            key={step.id}
            title={step.label}
            meta={multi ? undefined : `ขั้น ${index + 1} จาก ${total}${next ? ` · ถัดไป ${next.label}` : ""}`}
            action={
              <span className="flex items-center gap-1.5">
                <RecordChip step={step} variant={variant} />
                <StateBadge step={step} />
              </span>
            }
          >
            <div className="space-y-5">
              <FactList columns={2}>
                <Fact size="sm" label="ผู้ทำ" value={step.owner ?? "ยังไม่มีคนรับ"} tone={step.owner ? "default" : "muted"} />
                <Fact size="sm" label="ทำแล้ว" value={<span className="tabular-nums">{step.qtyDone.toLocaleString("th-TH")} / {step.qtyTotal.toLocaleString("th-TH")} ตัว</span>} />
                <Fact size="sm" label="ควรเสร็จ" value={step.planEnd} />
                {step.outsource ? (
                  <Fact
                    size="sm"
                    icon={Store}
                    label="ร้านนอก"
                    value={step.outsource.vendor}
                    sub={step.state === "done" ? "รับกลับแล้ว" : <DueTag dueInDays={step.outsource.backInDays} dateLabel={`นัดรับ ${step.outsource.backLabel}`} size="sm" />}
                  />
                ) : null}
              </FactList>

              {step.note || note ? (
                <div className="space-y-2">
                  {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
                  {note ? (
                    <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {note}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <p className="flex items-center justify-between text-xs font-medium text-muted">
                  <span>ข้อกำหนดก่อนปิดขั้น</span>
                  <span className="tabular-nums">{ticked}/{step.checklist.length}</span>
                </p>
                <ul className="mt-2 divide-y divide-divider">
                  {step.checklist.map((c, i) => (
                    <li key={i}>
                      <label className={cn("flex min-h-11 items-center gap-3 py-2 text-sm", locked ? "cursor-default" : "cursor-pointer")}>
                        <Checkbox checked={c.done} disabled={locked} onChange={() => onTick(step.id, i)} />
                        <span className={cn(c.done ? "text-secondary line-through decoration-border" : "text-strong")}>{c.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {paper && step.state !== "blocked" && step.state !== "done" ? <p className="mt-2 text-xs text-muted">ทำตามใบสั่งงาน — ติ๊กและเขียนยอดบนกระดาษ ในระบบไม่ต้องกด</p> : null}
              </div>

              {multi && small ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant={small.danger ? "destructive" : "outline"} disabled={smallRemaining > 0} onClick={() => onStep(step.id, small.to)} title={smallRemaining > 0 ? `ติ๊กอีก ${smallRemaining} ข้อ` : undefined}>
                    {small.label}
                  </Button>
                  {smallRemaining > 0 ? <span className="text-xs text-muted">ติ๊กอีก {smallRemaining} ข้อ</span> : null}
                </div>
              ) : null}
            </div>
          </Section>
        );
      })}

      {doneNote ? (
        <p className={cn("flex items-start gap-2 px-1 text-sm font-medium", remaining === 0 ? "text-green-700 dark:text-green-300" : "text-strong")}>
          {remaining === 0 ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          {doneNote}
        </p>
      ) : null}
    </>
  );
}

/** รายการทุกขั้นแบบย่อ — แทนตารางเดิม (เบส 09-08 "UI ทำให้ดูง่ายกว่านี้ได้") */
function StepList({ stages, currentIndex }: { stages: Stage[]; currentIndex: number }) {
  return (
    <Section title="ทุกขั้นของใบนี้" meta={`${stages.length} ช่อง`} compact>
      <ol className="space-y-1">
        {stages.map((st, i) => {
          const isCurrent = i === currentIndex;
          const done = stageDone(st);
          return (
            <li key={st.key} className={cn("flex items-start gap-3 rounded-md px-2 py-2 text-sm", isCurrent && "bg-blue-50/70 dark:bg-blue-950/25")}>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums",
                  done ? "bg-blue-600 text-white" : isCurrent ? "bg-blue-600 text-white ring-[3px] ring-blue-100 dark:ring-blue-500/25" : "border-2 border-border text-muted",
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                {st.steps.map((s) => (
                  <span key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={cn(isCurrent ? "font-semibold text-strong" : done ? "text-secondary" : "text-muted")}>{s.label}</span>
                    {s.owner && !done ? <span className="text-xs text-muted">{s.owner}</span> : null}
                    {isCurrent || (s.state !== "todo" && s.state !== "done") ? <StateBadge step={s} /> : null}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ───────────────────────── ลายและเสื้อ — ตารางแถวละไซซ์ (โครงเดียวกับตารางรายการของหน้าออเดอร์) ───────────────────────── */

const TH = "px-2 py-2.5 text-xs font-medium";
const TD = "px-2 py-3 align-top";

function PrintCell({ prints, thumb }: { prints: WorkItem["prints"]; thumb: string | null }) {
  return (
    <div className="space-y-2">
      {prints.map((p, j) => (
        <div key={j} className="flex items-center gap-2">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- หน้าลองใช้ไฟล์ตัวอย่างใน /public ตรง ๆ
            <img src={thumb} alt={`ลาย ${p.position}`} className={cn("h-10 w-10 shrink-0 border border-border bg-surface-muted object-cover", RADIUS.inner)} />
          ) : (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center border border-dashed border-border", RADIUS.inner)}>
              <ImageOff className="h-4 w-4 text-muted" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 text-sm">
            <p className="font-medium text-strong">{p.position}</p>
            <p className="text-xs text-secondary">
              {p.technique} · {p.size}
              {p.note ? <span className="text-muted"> — {p.note}</span> : null}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemsTable({ order }: { order: WorkOrder }) {
  const rows = order.items.flatMap((item, i) => item.sizes.map((sz) => ({ key: `${i}-${sz.size}`, item, size: sz.size, qty: sz.qty })));
  const total = rows.reduce((n, r) => n + r.qty, 0);
  return (
    <Section title="เสื้อและลาย" meta={`${rows.length} รายการ · รวม ${total.toLocaleString("th-TH")} ตัว`} flush>
      {/* จอกว้าง: ตารางแถวละไซซ์ (คอลัมน์เดียวกับหน้าออเดอร์ ยกเว้นเงิน) */}
      <div className="hidden md:block">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 260 }} />
            <col style={{ width: 72 }} />
          </colgroup>
          <thead className={TABLE_HEAD_SURFACE}>
            <tr>
              <th className={cn(TH, "text-center")}>#</th>
              <th className={cn(TH, "text-left")}>สินค้า</th>
              <th className={cn(TH, "text-left")}>ลาย</th>
              <th className={cn(TH, "text-center")}>จำนวน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className={cn(TD, "text-center text-sm tabular-nums text-muted")}>{i + 1}</td>
                <td className={TD}>
                  <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">
                    {r.item.product} <span className="ml-1.5 font-semibold">{r.item.color} {r.size}</span>
                  </p>
                </td>
                <td className={TD}><PrintCell prints={r.item.prints} thumb={r.item.mockup} /></td>
                <td className={cn(TD, "text-center text-sm font-medium tabular-nums text-strong")}>{r.qty}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-divider">
              <td colSpan={3} className={cn(TD, "text-right text-xs text-muted")}>รวม</td>
              <td className={cn(TD, "text-center text-sm font-semibold tabular-nums text-strong")}>{total.toLocaleString("th-TH")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* จอแคบ: การ์ดต่อแถว ข้อมูลชุดเดียวกับตาราง */}
      <div className="space-y-3 p-4 md:hidden">
        {rows.map((r, i) => (
          <div key={r.key} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="flex min-w-0 items-start gap-2 text-sm">
                <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-muted">{i + 1}</span>
                <span className="font-medium text-strong [overflow-wrap:anywhere]">
                  {r.item.product} <span className="font-semibold">{r.item.color} {r.size}</span>
                </span>
              </p>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-strong">{r.qty} ตัว</span>
            </div>
            <PrintCell prints={r.item.prints} thumb={r.item.mockup} />
          </div>
        ))}
      </div>
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
