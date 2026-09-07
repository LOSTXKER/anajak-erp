"use client";

/**
 * ตัววาดของหน้าลอง "ใบผลิตแบบฟอร์ม" — โครงเดียวกับหน้าออเดอร์จริง (`orders/detail/order-detail-page.tsx`):
 *   หัวใบ (PageHeader ตัวจริง) → แถบสถานะ (OrderStatusBar ตัวจริง — ราง 1 2 3 ที่เบสเคาะ 08-11/08-30) → แท็บ (Tabs ตัวจริง)
 * สิ่งที่เขียนเองเฉพาะ "ฟอร์มของช่องที่ยืนอยู่" เพราะเป็นชิ้นที่ต่างกันในแต่ละทาง
 *
 * กดปุ่มขั้นต่อไปแล้วขั้นเดินจริงในหน้า (state ในหน้า ไม่ยิงฐาน) · ย้อนกลับได้จากเมนู ⋯ — ให้เบสลอง "รู้สึก" ก่อนเคาะ
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  ExternalLink,
  Factory,
  Flag,
  ImageOff,
  Pause,
  RotateCcw,
  Store,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { OrderStatusBar } from "@/components/orders/detail/order-status-bar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { Section } from "@/components/ui/section";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RADIUS, SUNK_PANEL, TABLE_HEAD_SURFACE, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import { CASE_4, CASE_7, PROTO_TODAY, STATE_LABEL, recordModeOf, type WorkOrder, type WorkStep } from "./_data";
import { applyStep, closeAll, currentStageIndex, headCta, lastClosed, reopen, stageDone, stagesFor, stepBlockedNote, stepCta, type Stage, type Variant } from "./_engine";

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

function FormWorkOrder({ variant, order, boss, pair }: { variant: Variant; order: WorkOrder; boss: boolean; pair: boolean }) {
  const [steps, setSteps] = useState(order.steps);
  const [tab, setTab] = useState("steps");

  const stages = stagesFor(variant, steps, pair);
  const currentIndex = currentStageIndex(stages);
  const stage = stages[currentIndex]!;
  const next = stages[currentIndex + 1] ?? null;
  const cta = headCta(stage, next, boss);
  const allDone = stages.every(stageDone);
  const undoTarget = lastClosed(stages);

  // ป้ายบนรางต้องไม่ซ้ำ (OrderStatusBar ใช้ป้ายเป็น key) — ซ้ำเมื่อไหร่ต่อเลขช่องให้
  const railLabels = stages.map((st, i) => (stages.some((o, j) => j !== i && o.label === st.label) ? `${st.label} ${i + 1}` : st.label));

  const problems = steps.filter((s) => s.state === "blocked");
  const doneCount = steps.filter((s) => s.state === "done").length;

  function fire() {
    if (cta.kind === "step") setSteps(applyStep(steps, cta.step.id, cta.cta.to));
    else if (cta.kind === "close-stage") setSteps(closeAll(steps, cta.steps.map((s) => s.id)));
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
              {cta.kind !== "none" ? (
                <Button
                  onClick={fire}
                  variant={cta.kind === "step" && cta.cta.danger ? "destructive" : "default"}
                  className="shrink-0"
                  title={cta.kind === "step" ? `ขั้น ${currentIndex + 1} · ${cta.step.label}` : stage.title}
                >
                  {cta.kind === "step" ? cta.cta.label : cta.label}
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsBar>
          <TabsList aria-label="ส่วนของใบผลิต">
            <TabsTrigger value="steps" hasPending={problems.length > 0}>ขั้นงาน</TabsTrigger>
            <TabsTrigger value="items">ลายและเสื้อ</TabsTrigger>
            <TabsTrigger value="info">ข้อมูลใบ</TabsTrigger>
            <TabsTrigger value="history">ประวัติ</TabsTrigger>
          </TabsList>
        </TabsBar>

        <div className="mt-6">
          <TabsContent value="steps" className="space-y-6">
            <StageForm variant={variant} stage={stage} index={currentIndex} boss={boss} allDone={allDone} onStep={(id, to) => setSteps(applyStep(steps, id, to))} />
            <AllStepsTable variant={variant} stages={stages} steps={steps} currentIndex={currentIndex} />
          </TabsContent>

          <TabsContent value="items" className="grid gap-6 md:grid-cols-2">
            {order.items.map((item, i) => (
              <Section key={i} title={`${item.product} — ${item.color}`} meta={`${item.sizes.reduce((n, s) => n + s.qty, 0).toLocaleString("th-TH")} ตัว`}>
                <div className="flex gap-4">
                  {item.mockup ? (
                    // eslint-disable-next-line @next/next/no-img-element -- หน้าลองใช้ไฟล์ตัวอย่างใน /public ตรง ๆ
                    <img src={item.mockup} alt="" className={cn("h-28 w-28 shrink-0 border border-border bg-surface-muted object-cover", RADIUS.inner)} />
                  ) : (
                    <div className={cn("flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-border text-2xs text-muted", RADIUS.inner)}>
                      <ImageOff className="h-4 w-4" aria-hidden="true" /> ยังไม่มีม็อกอัพ
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {item.sizes.map((s) => (
                        <InfoChip key={s.size} size="sm">
                          {s.size} <span className="tabular-nums text-strong">{s.qty}</span>
                        </InfoChip>
                      ))}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {item.prints.map((p, j) => (
                        <li key={j} className="flex flex-wrap gap-x-2">
                          <span className="font-medium text-strong">{p.position}</span>
                          <span className="text-secondary">{p.technique} · {p.size}</span>
                          {p.note ? <span className="text-muted">— {p.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>
            ))}
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

      <p className="text-xs text-muted">
        ตัวเลขทั้งหมดเป็นของปลอม — จำลองในหน้า ไม่บันทึกจริง (ผ่านแล้ว {doneCount}/{steps.length} ขั้น จากราง {stages.length} ช่อง)
      </p>
    </div>
  );
}

/* ───────────────────────── ฟอร์มของช่องที่ยืนอยู่ ───────────────────────── */

function StageForm({
  variant,
  stage,
  index,
  boss,
  allDone,
  onStep,
}: {
  variant: Variant;
  stage: Stage;
  index: number;
  boss: boolean;
  allDone: boolean;
  onStep: (id: string, to: WorkStep["state"]) => void;
}) {
  if (allDone) {
    return (
      <Section title="ใบนี้เสร็จแล้ว" icon={CheckCircle2} tone="production">
        <p className="text-sm text-secondary">ทุกขั้นปิดแล้ว งานอยู่ที่ QC — ย้อนกลับได้จากเมนู ⋯ ถ้าปิดผิด</p>
      </Section>
    );
  }

  if (stage.kind === "single") {
    const step = stage.steps[0]!;
    return (
      <Section title={`ขั้น ${index + 1} · ${step.label}`} meta={<StateBadge step={step} />} action={<RecordChip step={step} variant={variant} />}>
        <StepBody step={step} boss={boss} />
      </Section>
    );
  }

  const paper = stage.kind === "paper";
  const pairStage = stage.kind === "pair";
  return (
    <Section
      title={`ช่อง ${index + 1} · ${stage.title}`}
      meta={`${stage.steps.filter((s) => s.state === "done").length}/${stage.steps.length} เสร็จ`}
      help={
        paper
          ? "ขั้นพวกนี้จดบนใบสั่งงาน — ระบบถือว่าผ่านตอนกดส่งเข้า QC"
          : pairStage
            ? "สูตรตั้งไว้ว่าสองขั้นนี้เดินคู่กันได้ — ปุ่มบนหัวใบคือขั้นที่กดได้ก่อน อีกขั้นกดตรงนี้ · ครบทั้งคู่แล้วรางเลื่อนเอง"
            : "งานที่เดินพร้อมกัน แต่ละงานมีปุ่มของตัวเอง — ปิดด่านได้เมื่อครบทุกงาน"
      }
    >
      <ul className="divide-y divide-divider">
        {stage.steps.map((step) => {
          const cta = paper && step.state !== "blocked" ? null : stepCta(step, boss);
          const note = stepBlockedNote(step, boss);
          return (
            <li key={step.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-strong">
                    {step.label}
                    <StateBadge step={step} />
                    {paper ? <RecordChip step={step} variant={variant} /> : null}
                  </p>
                  <InfoChipRow className="mt-1.5">
                    <InfoChip size="sm" icon={UserRound}>{step.owner ?? "ยังไม่มีคนรับ"}</InfoChip>
                    <InfoChip size="sm">
                      <span className="tabular-nums">{step.qtyDone.toLocaleString("th-TH")}/{step.qtyTotal.toLocaleString("th-TH")}</span>&nbsp;ตัว
                    </InfoChip>
                    <InfoChip size="sm">ควรเสร็จ {step.planEnd}</InfoChip>
                    {step.outsource && step.state !== "done" ? (
                      <InfoChip size="sm" icon={Store} tone={step.outsource.backInDays < 0 ? "error" : "neutral"}>
                        {step.outsource.vendor} — {step.outsource.status}
                      </InfoChip>
                    ) : null}
                  </InfoChipRow>
                  {note ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{note}</p> : null}
                  {paper && step.state !== "blocked" && step.state !== "done" ? <p className="mt-1 text-xs text-muted">ทำตามใบสั่งงาน — ติ๊กและเขียนยอดบนกระดาษ ในระบบไม่ต้องกด</p> : null}
                </div>
                {cta ? (
                  <Button size="sm" variant={cta.danger ? "destructive" : "outline"} onClick={() => onStep(step.id, cta.to)}>
                    {cta.label}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function StepBody({ step, boss }: { step: WorkStep; boss: boolean }) {
  const note = stepBlockedNote(step, boss);
  return (
    <div className="space-y-4">
      <FactList columns={4}>
        <Fact label="ผู้ทำ" value={step.owner ?? "ยังไม่มีคนรับ"} tone={step.owner ? "default" : "muted"} />
        <Fact label="ทำแล้ว" value={<span className="tabular-nums">{step.qtyDone.toLocaleString("th-TH")} / {step.qtyTotal.toLocaleString("th-TH")}</span>} sub="ตัว" />
        <Fact label="เริ่ม" value={step.startedAt ?? "—"} tone={step.startedAt ? "default" : "muted"} />
        <Fact label="ควรเสร็จ" value={step.planEnd} />
      </FactList>

      {step.outsource ? (
        <div className={cn(SUNK_PANEL, RADIUS.inner, "p-3")}>
          <FactList columns={3}>
            <Fact icon={Store} label="ร้าน" value={step.outsource.vendor} sub={step.outsource.work} />
            <Fact label="ส่งไปเมื่อ" value={step.outsource.sentOn} />
            <Fact label="นัดรับ" value={<DueTag dueInDays={step.state === "done" ? null : step.outsource.backInDays} dateLabel={step.state === "done" ? "รับกลับแล้ว" : step.outsource.backLabel} size="sm" />} sub={step.state === "done" ? undefined : step.outsource.status} />
          </FactList>
        </div>
      ) : null}

      {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
      {note ? (
        <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {note}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-medium text-muted">ข้อกำหนดมาตรฐานของขั้นนี้</p>
        <ul className="mt-1.5 space-y-1.5">
          {step.checklist.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {c.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
              <span className={cn(c.done ? "text-secondary" : "text-strong")}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────── ตารางทุกขั้น (อ่านอย่างเดียว) ───────────────────────── */

function AllStepsTable({ variant, stages, steps, currentIndex }: { variant: Variant; stages: Stage[]; steps: WorkStep[]; currentIndex: number }) {
  const stageOf = (s: WorkStep) => stages.findIndex((st) => st.steps.some((x) => x.id === s.id));
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const parallelLive = variant === "seq" ? sorted.filter((s, i) => i > 0 && (s.state === "active" || s.state === "waiting") && sorted.slice(0, i).some((p) => p.state !== "done")) : [];
  return (
    <Section title="ขั้นทั้งหมดของใบนี้" meta={`${sorted.length} ขั้น`} flush>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={TABLE_HEAD_SURFACE}>
            <tr className="text-left text-xs">
              <th className="px-4 py-2 font-medium">ช่อง</th>
              <th className="px-2 py-2 font-medium">ขั้น</th>
              <th className="px-2 py-2 font-medium">สถานะ</th>
              <th className="px-2 py-2 font-medium">ผู้ทำ</th>
              <th className="px-2 py-2 text-right font-medium">ทำแล้ว</th>
              <th className="px-4 py-2 font-medium">ควรเสร็จ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {sorted.map((s) => {
              const st = stageOf(s);
              const isCurrent = st === currentIndex;
              return (
                <tr key={s.id} className={cn(isCurrent && "bg-blue-50/60 dark:bg-blue-950/20")}>
                  <td className="px-4 py-2 tabular-nums text-muted">{st + 1}</td>
                  <td className={cn("px-2 py-2", isCurrent ? "font-semibold text-strong" : "text-secondary")}>
                    {s.label}
                    {stages[st]?.kind === "pair" ? <InfoChip size="sm" tone="info" className="ml-2">ช่องคู่</InfoChip> : null}
                    {parallelLive.includes(s) && stages[st]?.kind !== "pair" && !isCurrent ? <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">กำลังทำจริงอยู่ — แต่รางบอกว่ายังไม่ถึง</span> : null}
                  </td>
                  <td className="px-2 py-2"><StateBadge step={s} /></td>
                  <td className="px-2 py-2 text-secondary">{s.owner ?? "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-secondary">{s.qtyDone.toLocaleString("th-TH")}/{s.qtyTotal.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-2 text-secondary">{s.planEnd}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

