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
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, ExternalLink, Factory, Flag, History, ImageOff, ListChecks, Pause, RotateCcw, Store, UserRound } from "lucide-react";

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
import { RADIUS, SUNK_PANEL, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import { CASE_4, CASE_7, STATE_LABEL, recordModeOf, type WorkItem, type WorkOrder, type WorkStep } from "./_data";
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
    { key: "history", label: "ประวัติใบนี้", icon: History, hint: `เหตุการณ์ ${order.events.length} รายการ · เปิดดูในหน้าประวัติ`, onSelect: () => {} },
    { key: "hold", label: "พักงานใบนี้", icon: Pause, hint: boss ? "ออกจากคิวจนกว่าจะปลด" : "หัวหน้าเท่านั้น", disabled: !boss, danger: true, onSelect: () => {} },
  ];

  const ctaLabel = cta.kind === "step" ? cta.cta.label : cta.kind === "close-stage" ? cta.label : null;

  // ขั้นที่โฟกัส = ทุกขั้นในช่องที่ยืนอยู่ (ช่องคู่ = 2 ขั้น)
  const focusSteps = stage.steps;

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
                // ปุ่มหลักโชว์ตลอด กดได้เมื่อติ๊กครบ — ยังไม่ครบกดแล้วเลื่อนไปเช็คลิสต์ (จอทัชไม่มี hover)
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

      {/* ปัญหาที่ค้างต้องเห็นเสมอ */}
      {problems.map((s) => (
        <Alert key={s.id} variant="error" icon={AlertTriangle} title={`${s.label} — ${s.problem?.title ?? "ติดปัญหา"}`}>
          {s.problem?.detail ?? "รอหัวหน้าจัดการ"}
          {s.problem?.since ? <span className="text-muted"> · แจ้งเมื่อ {s.problem.since}</span> : null}
        </Alert>
      ))}

      {/* รอบ 9 (เบส 09-08 ดึก): "แสดงข้อมูลเฉพาะขั้นตอนนั้น ๆ · ไม่ต้องมีแถบแยก · ลายเสื้อเด่นสุด ให้ฝ่ายผลิตรู้ว่าต้องทำเสื้ออะไร · เช็คลิสต์ขวา · ข้อมูลออเดอร์ขวา"
          ซ้าย (กว้าง) = ขั้นที่ยืนอยู่ + ลาย/เสื้อที่ต้องทำในขั้นนี้ (ม็อกอัพใหญ่, ลายที่เกี่ยวกับขั้นนี้เด่น, ไซซ์เป็นตาราง)
          ขวา = เช็คลิสต์ก่อนปิดขั้น → ข้อมูลออเดอร์ / ไม่มีแท็บ ไม่มีรายการทุกขั้น (รางบอกแล้ว) / ประวัติย้ายไปเมนู ⋯ */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <StepHeading stage={stage} index={currentIndex} total={stages.length} next={next} allDone={allDone} variant={variant} />
          {order.items.map((item, i) => (
            <ItemFocus key={i} item={item} focusSteps={focusSteps} />
          ))}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4">
          <ChecklistCard stage={stage} boss={boss} allDone={allDone} ctaLabel={ctaLabel} remaining={remaining} onStep={(id, to) => setSteps(applyStep(steps, id, to))} onTick={tick} />
          <Section title="ข้อมูลออเดอร์">
            <FactList columns={1}>
              <Fact label="ลูกค้า" value={order.customer} sub={order.company ?? undefined} />
              <Fact label="ช่องทาง" value={order.channel} />
              <Fact label="กำหนดส่ง" value={<DueTag dueInDays={order.dueInDays} dateLabel={order.dueLabel} size="sm" />} />
              <Fact label="จำนวนทั้งใบ" value={`${order.qty.toLocaleString("th-TH")} ตัว`} />
              <Fact label="สูตรขั้นงาน" value={order.routingName} />
              <Fact label="ม็อกอัพอนุมัติ" value={order.mockupVersion} />
              {order.note ? <Fact label="หมายเหตุใบนี้" value={<span className="[overflow-wrap:anywhere]">{order.note}</span>} /> : null}
            </FactList>
          </Section>
        </aside>
      </div>

      <p className="text-xs text-muted">ตัวเลขทั้งหมดเป็นของปลอม — จำลองในหน้า ไม่บันทึกจริง</p>
    </div>
  );
}

/* ───────────────────────── ซ้าย: ขั้นที่ยืนอยู่ + งานเสื้อของขั้นนี้ ───────────────────────── */

function StepHeading({ stage, index, total, next, allDone, variant }: { stage: Stage; index: number; total: number; next: Stage | null; allDone: boolean; variant: Variant }) {
  if (allDone) {
    return (
      <Section title="ใบนี้เสร็จแล้ว" icon={CheckCircle2} tone="production">
        <p className="text-sm text-secondary">ทุกขั้นปิดแล้ว งานอยู่ที่ QC — ย้อนกลับได้จากเมนู ⋯ ถ้าปิดผิด</p>
      </Section>
    );
  }
  return (
    <div className={cn(SUNK_PANEL, RADIUS.surface, "space-y-4 p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted">ขั้นที่ {index + 1} จาก {total}</p>
          <h2 className="mt-1 text-xl font-semibold text-strong">{stage.kind === "pair" ? stage.steps.map((s) => s.label).join(" + ") : stage.steps[0]!.label}</h2>
          {next ? <p className="mt-1 text-sm text-secondary">ถัดไป {next.label}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {stage.kind === "pair" ? <InfoChip size="sm" tone="info">2 งาน ทำพร้อมกันได้</InfoChip> : null}
          {stage.steps.map((s) => (
            <RecordChip key={s.id} step={s} variant={variant} />
          ))}
        </div>
      </div>
      <div className={cn("grid gap-4", stage.steps.length > 1 ? "md:grid-cols-2" : "")}>
        {stage.steps.map((step) => (
          <div key={step.id} className="space-y-3">
            {stage.steps.length > 1 ? (
              <p className="flex items-center gap-2 text-sm font-medium text-strong">
                {step.label} <StateBadge step={step} />
              </p>
            ) : null}
            <FactList columns={stage.steps.length > 1 ? 2 : 4}>
              <Fact size="sm" label="สถานะ" value={<StateBadge step={step} />} />
              <Fact size="sm" label="ผู้ทำ" value={step.owner ?? "ยังไม่มีคนรับ"} tone={step.owner ? "default" : "muted"} />
              <Fact size="sm" label="ทำแล้ว" value={<span className="tabular-nums">{step.qtyDone.toLocaleString("th-TH")} / {step.qtyTotal.toLocaleString("th-TH")} ตัว</span>} />
              <Fact size="sm" label="ควรเสร็จ" value={<DueTag dueInDays={step.planEndInDays} dateLabel={step.planEnd} size="sm" />} />
              {step.outsource ? (
                <Fact size="sm" icon={Store} label="ร้านนอก" value={step.outsource.vendor} sub={<DueTag dueInDays={step.outsource.backInDays} dateLabel={`นัดรับ ${step.outsource.backLabel}`} size="sm" />} />
              ) : null}
            </FactList>
            {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** ลายไหน "เป็นงานของขั้นนี้" — พิมพ์ฟิล์ม/รีดร้อน = DTF · ขั้นปัก = ปัก · ขั้นอื่น (รับเสื้อ · QC · แพ็ก) = ทุกลาย */
function printIsForStep(step: WorkStep, technique: string): boolean {
  if (step.kind === "dtf" || step.label.includes("รีด")) return technique === "DTF";
  if (step.label.includes("ปัก")) return technique === "ปัก";
  if (step.label.includes("ป้ายคอ")) return false;
  return true;
}

function ItemFocus({ item, focusSteps }: { item: WorkItem; focusSteps: WorkStep[] }) {
  const total = item.sizes.reduce((n, s) => n + s.qty, 0);
  const forStep = (technique: string) => focusSteps.some((st) => printIsForStep(st, technique));
  const hasFocus = item.prints.some((p) => forStep(p.technique));
  return (
    <Section title={`${item.product} — ${item.color}`} meta={`${total.toLocaleString("th-TH")} ตัว`} flush>
      <div className="grid gap-0 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* ม็อกอัพใหญ่ = สิ่งที่ตาเห็นก่อน (ชั้น 1) */}
        <div className="border-b border-divider p-4 md:border-b-0 md:border-r">
          {item.mockup ? (
            // eslint-disable-next-line @next/next/no-img-element -- หน้าลองใช้ไฟล์ตัวอย่างใน /public ตรง ๆ
            <img src={item.mockup} alt={`ม็อกอัพ ${item.product} ${item.color}`} className={cn("aspect-square w-full border border-border bg-surface-muted object-contain", RADIUS.inner)} />
          ) : (
            <div className={cn("flex aspect-square w-full flex-col items-center justify-center gap-2 border border-dashed border-border text-sm text-muted", RADIUS.inner)}>
              <ImageOff className="h-6 w-6" aria-hidden="true" /> ยังไม่มีม็อกอัพ
            </div>
          )}
        </div>
        <div className="space-y-5 p-4">
          <div>
            <p className="text-xs font-medium text-muted">{hasFocus ? "ลายที่ต้องทำในขั้นนี้" : "ลายทั้งหมดของเสื้อตัวนี้"}</p>
            <ul className="mt-2 space-y-2">
              {item.prints.map((p, j) => {
                const mine = forStep(p.technique);
                return (
                  <li key={j} className={cn("flex flex-wrap items-center gap-2", hasFocus && !mine && "opacity-50")}>
                    <span className={cn("text-base font-semibold", mine ? "text-strong" : "text-secondary")}>{p.position}</span>
                    <InfoChip size="sm" strong={mine} tone={mine ? "info" : "neutral"}>{p.technique}</InfoChip>
                    <span className="text-sm text-secondary">{p.size}</span>
                    {p.note ? <span className="text-sm text-secondary">— {p.note}</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">จำนวนต่อไซซ์</p>
            <table className="mt-2 w-full max-w-md text-sm">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium">ไซซ์</th>
                  <th className="px-2 py-2 text-left text-xs font-medium">สี</th>
                  <th className="px-2 py-2 text-right text-xs font-medium">จำนวน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {item.sizes.map((sz) => (
                  <tr key={sz.size}>
                    <td className="px-2 py-2 font-semibold text-strong">{sz.size}</td>
                    <td className="px-2 py-2 text-secondary">{item.color}</td>
                    <td className="px-2 py-2 text-right text-base font-semibold tabular-nums text-strong">{sz.qty}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-divider">
                  <td colSpan={2} className="px-2 py-2 text-xs text-muted">รวม</td>
                  <td className="px-2 py-2 text-right text-base font-semibold tabular-nums text-strong">{total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────── ขวา: เช็คลิสต์ก่อนปิดขั้น ───────────────────────── */

function ChecklistCard({
  stage,
  boss,
  allDone,
  ctaLabel,
  remaining,
  onStep,
  onTick,
}: {
  stage: Stage;
  boss: boolean;
  allDone: boolean;
  ctaLabel: string | null;
  remaining: number;
  onStep: (id: string, to: WorkStep["state"]) => void;
  onTick: (id: string, index: number) => void;
}) {
  if (allDone) return null;
  const paper = stage.kind === "paper";
  return (
    <Section
      title="ข้อกำหนดก่อนปิดขั้น"
      action={remaining > 0 ? <InfoChip size="sm" strong tone="warning" icon={ListChecks}>ติ๊กอีก {remaining} ข้อ</InfoChip> : <InfoChip size="sm" strong tone="success" icon={CheckCircle2}>ครบแล้ว</InfoChip>}
      help={paper ? "ขั้นพวกนี้จดบนใบสั่งงาน — ระบบถือว่าผ่านตอนกดส่งเข้า QC" : undefined}
      id="proto-current-step"
    >
      <div className={cn(stage.steps.length > 1 && "divide-y divide-divider")}>
        {stage.steps.map((step) => {
          const locked = step.state === "done" || (step.state === "blocked" && !boss) || (paper && step.state !== "blocked" && !boss);
          const small = stage.steps.length > 1 && step.state !== "done" ? stepCta(step, boss) : null;
          const smallRemaining = small?.to === "done" ? step.checklist.filter((c) => !c.done).length : 0;
          const note = stepBlockedNote(step, boss);
          return (
            <div key={step.id} className={cn(stage.steps.length > 1 && "py-3 first:pt-0 last:pb-0")}>
              {stage.steps.length > 1 ? (
                <p className="mb-1 flex items-center gap-2 text-sm font-medium text-strong">
                  {step.label} <StateBadge step={step} />
                </p>
              ) : null}
              {note ? (
                <p className="mb-2 flex items-start gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {note}
                </p>
              ) : null}
              <ul>
                {step.checklist.map((c, i) => (
                  <li key={i}>
                    <label className={cn("flex min-h-11 items-center gap-3 text-sm", locked ? "cursor-default" : "cursor-pointer")}>
                      <Checkbox className="h-5 w-5" checked={c.done} disabled={locked} onChange={() => onTick(step.id, i)} />
                      <span className={cn(c.done ? "text-secondary line-through decoration-border" : locked ? "text-muted" : "font-medium text-strong")}>{c.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {small ? (
                <Button variant={small.danger ? "destructive" : "outline"} disabled={smallRemaining > 0} onClick={() => onStep(step.id, small.to)} className="mt-3 w-full">
                  {small.label}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {remaining === 0 && ctaLabel ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> กด “{ctaLabel}” บนหัวใบ
        </p>
      ) : null}
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
