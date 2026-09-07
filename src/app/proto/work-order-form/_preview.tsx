"use client";

/**
 * ตัววาดของหน้าลอง "ใบผลิตแบบฟอร์ม" — โครงเดียวกับหน้าออเดอร์จริง (`orders/detail/order-detail-page.tsx`):
 *   หัวใบ (PageHeader ตัวจริง) → ราง 1 2 3 (OrderStatusBar ตัวจริง) → 2 แท็บ
 *
 * รอบ 11 (เบส 09-08 ดึก "ฉันรู้ละ"): 2 แท็บ
 *   · ขั้นตอน — ซ้าย = ตารางเช็ครายตัว (แถวละไซซ์) ของขั้นที่ยืนอยู่ กรอกจำนวนได้ · ขวา = เช็คลิสต์ + ข้อมูลออเดอร์
 *   · สินค้า — OrderItemsDisplay ตัวจริงของหน้าออเดอร์ (ไม่โชว์เงิน)
 *   ช่องกรอกของแต่ละขั้นต่างกัน (คิดต่อตามที่เบสสั่ง): เบิก/รับเสื้อ = ได้จริง · พิมพ์ฟิล์ม = พิมพ์แล้ว · รีดร้อน = ทำแล้ว+เสีย
 *   · ร้านนอก = ส่งไป+รับกลับ · QC = ผ่าน+เสีย · แพ็ก = แพ็กแล้ว · แถวครบเอง ✓ · ปุ่ม "ครบทุกแถว" กดทีเดียวบนจอทัช
 *
 * กดปุ่มขั้นต่อไปแล้วขั้นเดินจริงในหน้า (state ในหน้า ไม่ยิงฐาน) · ย้อนกลับได้จากเมนู ⋯
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, ClipboardList, ExternalLink, Factory, Flag, History, ImageOff, ListChecks, Pause, RotateCcw, Store, UserRound } from "lucide-react";

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
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { NumberInput } from "@/components/ui/number-input";
import { Section } from "@/components/ui/section";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RADIUS, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

import { CASE_4, CASE_7, STATE_LABEL, recordModeOf, type WorkItem, type WorkOrder, type WorkStep } from "./_data";
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

/* ───────────────────────── แถวรายตัว (item × ไซซ์) + ยอดต่อขั้น ───────────────────────── */

type PieceRow = { key: string; item: WorkItem; size: string; qty: number };
type RowQty = { done: number; sent: number; waste: number };
type RowState = Record<string, Record<string, RowQty>>;

function pieceRows(order: WorkOrder): PieceRow[] {
  return order.items.flatMap((item, i) => item.sizes.map((sz) => ({ key: `${i}-${sz.size}`, item, size: sz.size, qty: sz.qty })));
}

/** ช่องกรอกของขั้น — ต่างกันตามชนิดงาน (ของจริง: มาจากสูตรขั้นงาน) */
function inputsFor(step: WorkStep): { key: keyof RowQty; label: string }[] {
  switch (step.kind) {
    case "pick":
      return [{ key: "done", label: "เบิกแล้ว" }];
    case "receive":
      return [{ key: "done", label: "รับแล้ว" }];
    case "dtf":
      return [{ key: "done", label: "พิมพ์แล้ว" }];
    case "outsource":
      return [
        { key: "sent", label: "ส่งไป" },
        { key: "done", label: "รับกลับ" },
      ];
    case "qc":
      return [
        { key: "done", label: "ผ่าน" },
        { key: "waste", label: "เสีย" },
      ];
    case "pack":
      return [{ key: "done", label: "แพ็กแล้ว" }];
    default:
      return [
        { key: "done", label: "ทำแล้ว" },
        { key: "waste", label: "เสีย" },
      ];
  }
}

function rowComplete(step: WorkStep, q: RowQty, qty: number): boolean {
  const hasWaste = inputsFor(step).some((c) => c.key === "waste");
  return (hasWaste ? q.done + q.waste : q.done) >= qty;
}

/** ค่าเริ่มต้น: กระจาย qtyDone ของขั้นลงแถวตามลำดับ (ปลอมให้เหมือนที่จดมาแล้ว) */
function initialRowState(steps: WorkStep[], rows: PieceRow[]): RowState {
  const state: RowState = {};
  for (const step of steps) {
    let left = step.state === "done" ? Number.MAX_SAFE_INTEGER : step.qtyDone;
    const sentAll = step.kind === "outsource" && step.state !== "todo";
    state[step.id] = Object.fromEntries(
      rows.map((r) => {
        const done = Math.min(r.qty, Math.max(0, left));
        left -= done;
        return [r.key, { done, sent: sentAll ? r.qty : 0, waste: 0 }];
      }),
    );
  }
  return state;
}

function fillRows(step: WorkStep, rows: PieceRow[]): Record<string, RowQty> {
  return Object.fromEntries(rows.map((r) => [r.key, { done: r.qty, sent: step.kind === "outsource" ? r.qty : 0, waste: 0 }]));
}

/* ───────────────────────── ตัววาดหลัก ───────────────────────── */

export function Preview({ variant, case7, boss, pair = true }: { variant: Variant; case7: boolean; boss: boolean; pair?: boolean }) {
  if (variant === "now") return <NowFrame />;
  return <FormWorkOrder key={`${variant}-${case7 ? 7 : 4}`} variant={variant} order={case7 ? CASE_7 : CASE_4} boss={boss} pair={pair} />;
}

/** ข้อที่ยังไม่ติ๊กของขั้นที่ปุ่มบนจะ "ปิด" — ต้องเป็น 0 ก่อนกดได้ (เบสสั่ง 09-08) */
function checklistRemaining(cta: HeadCta): number {
  if (cta.kind === "step") return cta.cta.to === "done" ? cta.step.checklist.filter((c) => !c.done).length : 0;
  if (cta.kind === "close-stage") return cta.steps.reduce((n, s) => n + (s.state === "done" ? 0 : s.checklist.filter((c) => !c.done).length), 0);
  return 0;
}

function FormWorkOrder({ variant, order, boss, pair }: { variant: Variant; order: WorkOrder; boss: boolean; pair: boolean }) {
  const rows = pieceRows(order);
  const [steps, setSteps] = useState(order.steps);
  const [rowState, setRowState] = useState<RowState>(() => initialRowState(order.steps, rows));
  const [tab, setTab] = useState("steps");

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

  function sumDone(stepId: string) {
    return rows.reduce((n, r) => n + (rowState[stepId]?.[r.key]?.done ?? 0), 0);
  }
  function closeSteps(ids: string[]) {
    setSteps(closeAll(steps, ids));
    setRowState((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, fillRows(steps.find((s) => s.id === id)!, rows)])) }));
  }
  function fire() {
    if (remaining > 0) {
      setTab("steps");
      requestAnimationFrame(() => document.getElementById("proto-checklist")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    if (cta.kind === "step") {
      if (cta.cta.to === "done") closeSteps([cta.step.id]);
      else setSteps(applyStep(steps, cta.step.id, cta.cta.to));
    } else if (cta.kind === "close-stage") closeSteps(cta.steps.map((s) => s.id));
  }
  function tick(stepId: string, index: number) {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, checklist: s.checklist.map((c, j) => (j === index ? { ...c, done: !c.done } : c)) } : s)));
  }
  function setRow(stepId: string, rowKey: string, key: keyof RowQty, value: number) {
    const nextRows = { ...(rowState[stepId] ?? {}), [rowKey]: { ...(rowState[stepId]?.[rowKey] ?? { done: 0, sent: 0, waste: 0 }), [key]: Math.max(0, value) } };
    const done = rows.reduce((n, r) => n + (nextRows[r.key]?.done ?? 0), 0);
    setRowState({ ...rowState, [stepId]: nextRows });
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, qtyDone: done } : s)));
  }
  function fillAll(step: WorkStep) {
    setRowState({ ...rowState, [step.id]: fillRows(step, rows) });
    setSteps(steps.map((s) => (s.id === step.id ? { ...s, qtyDone: s.qtyTotal } : s)));
  }
  function stepAction(id: string, to: WorkStep["state"]) {
    if (to === "done") closeSteps([id]);
    else setSteps(applyStep(steps, id, to));
  }

  const menu: MoreMenuItem[] = [
    {
      key: "undo",
      label: undoTarget ? `ย้อนกลับ — เปิด “${undoTarget.label}” ใหม่` : "ย้อนกลับขั้นก่อน",
      icon: RotateCcw,
      hint: !boss ? "หัวหน้าเท่านั้น" : undoTarget ? undefined : "ยังไม่มีขั้นที่ปิดไป",
      disabled: !boss || !undoTarget,
      onSelect: () => undoTarget && setSteps(reopen(steps, undoTarget)),
    },
    { key: "problem", label: "แจ้งปัญหาขั้นนี้", icon: Flag, onSelect: () => stage.steps[0] && setSteps(applyStep(steps, stage.steps[0].id, "blocked")) },
    { key: "assign", label: "มอบหมาย / แก้ให้", icon: UserRound, hint: boss ? undefined : "หัวหน้าเท่านั้น", disabled: !boss, onSelect: () => {} },
    { key: "history", label: "ประวัติใบนี้", icon: History, onSelect: () => {} },
    { key: "hold", label: "พักงานใบนี้", icon: Pause, hint: boss ? undefined : "หัวหน้าเท่านั้น", disabled: !boss, danger: true, onSelect: () => {} },
  ];

  const ctaLabel = cta.kind === "step" ? cta.cta.label : cta.kind === "close-stage" ? cta.label : null;
  const shortage = stage.steps.filter((s) => s.state !== "done").reduce((n, s) => n + Math.max(0, s.qtyTotal - sumDone(s.id)), 0);

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
                <Button onClick={fire} aria-disabled={remaining > 0} variant={cta.kind === "step" && cta.cta.danger ? "destructive" : "default"} className={cn("shrink-0", remaining > 0 && "opacity-60")}>
                  {ctaLabel}
                  <ChevronRight />
                </Button>
              ) : null}
              <MoreMenu items={menu} size="sm" />
            </>
          }
        />
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

      {problems.map((s) => (
        <Alert key={s.id} variant="error" icon={AlertTriangle} title={`${s.label} — ${s.problem?.title ?? "ติดปัญหา"}`}>
          {s.problem?.detail ?? "รอหัวหน้าจัดการ"}
          {s.problem?.since ? <span className="text-muted"> · แจ้งเมื่อ {s.problem.since}</span> : null}
        </Alert>
      ))}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsBar>
          <TabsList aria-label="ส่วนของใบผลิต">
            <TabsTrigger value="steps" hasPending={remaining > 0 || problems.length > 0}>ขั้นตอน</TabsTrigger>
            <TabsTrigger value="items">สินค้า</TabsTrigger>
          </TabsList>
        </TabsBar>
        <div className="mt-6">
          <TabsContent value="steps" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="min-w-0 space-y-6">
              {allDone ? (
                <Section title="ใบนี้เสร็จแล้ว" icon={CheckCircle2} tone="production">
                  <p className="text-sm text-secondary">งานอยู่ที่ QC</p>
                </Section>
              ) : (
                stage.steps.map((step) => (
                  <StepWorkTable
                    key={step.id}
                    step={step}
                    rows={rows}
                    values={rowState[step.id] ?? {}}
                    locked={step.state === "done" || (step.state === "blocked" && !boss)}
                    onChange={(rowKey, key, value) => setRow(step.id, rowKey, key, value)}
                    onFillAll={() => fillAll(step)}
                  />
                ))
              )}
            </div>
            <aside className="space-y-6 lg:sticky lg:top-4">
              <ChecklistCard variant={variant} stage={stage} boss={boss} allDone={allDone} remaining={remaining} shortage={shortage} onStep={stepAction} onTick={tick} />
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
          </TabsContent>

          <TabsContent value="items">
            {/* ตัวจริงของแท็บรายการหน้าออเดอร์ — ไม่มีปุ่มแก้ไข · ไม่โชว์เงิน */}
            <OrderItemsDisplay orderId={order.orderNumber} items={order.orderItems as OrderItem[]} fees={[]} showMoney={false} canEditReceiveTracking={false} />
          </TabsContent>
        </div>
      </Tabs>

      <p className="text-xs text-muted">ตัวเลขทั้งหมดเป็นของปลอม — จำลองในหน้า ไม่บันทึกจริง</p>
    </div>
  );
}

/* ───────────────────────── ซ้าย: ตารางเช็ครายตัวของขั้น ───────────────────────── */

const TH = "px-2 py-2.5 text-xs font-medium";
const TD = "px-2 py-2 align-middle text-sm";

function StepWorkTable({
  step,
  rows,
  values,
  locked,
  onChange,
  onFillAll,
}: {
  step: WorkStep;
  rows: PieceRow[];
  values: Record<string, RowQty>;
  locked: boolean;
  onChange: (rowKey: string, key: keyof RowQty, value: number) => void;
  onFillAll: () => void;
}) {
  const inputs = inputsFor(step);
  const total = rows.reduce((n, r) => n + r.qty, 0);
  const sum = (key: keyof RowQty) => rows.reduce((n, r) => n + (values[r.key]?.[key] ?? 0), 0);
  const completeRows = rows.filter((r) => rowComplete(step, values[r.key] ?? { done: 0, sent: 0, waste: 0 }, r.qty)).length;
  const allComplete = completeRows === rows.length;

  return (
    <Section
      title={step.label}
      meta={<span className="tabular-nums">{sum("done").toLocaleString("th-TH")} / {total.toLocaleString("th-TH")} ตัว</span>}
      action={
        <span className="flex items-center gap-2">
          <StateBadge step={step} />
          {!locked && !allComplete ? (
            <Button size="sm" variant="outline" onClick={onFillAll}>
              ครบทุกแถว
            </Button>
          ) : null}
        </span>
      }
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <colgroup>
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 80 }} />
            {inputs.map((c) => (
              <col key={c.key} style={{ width: 112 }} />
            ))}
            <col style={{ width: 56 }} />
          </colgroup>
          <thead className={TABLE_HEAD_SURFACE}>
            <tr>
              <th className={cn(TH, "text-center")}>#</th>
              <th className={cn(TH, "text-left")}>สินค้า</th>
              <th className={cn(TH, "text-right")}>ทั้งหมด</th>
              {inputs.map((c) => (
                <th key={c.key} className={cn(TH, "text-right")}>{c.label}</th>
              ))}
              <th className={cn(TH, "text-center")}>ครบ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {rows.map((r, i) => {
              const q = values[r.key] ?? { done: 0, sent: 0, waste: 0 };
              const complete = rowComplete(step, q, r.qty);
              return (
                <tr key={r.key} className={cn(complete && !locked && "bg-green-50/40 dark:bg-green-950/15")}>
                  <td className={cn(TD, "text-center tabular-nums text-muted")}>{i + 1}</td>
                  <td className={TD}>
                    <div className="flex items-center gap-2">
                      {r.item.mockup ? (
                        // eslint-disable-next-line @next/next/no-img-element -- หน้าลองใช้ไฟล์ตัวอย่างใน /public ตรง ๆ
                        <img src={r.item.mockup} alt="" className={cn("h-10 w-10 shrink-0 border border-border bg-surface-muted object-cover", RADIUS.inner)} />
                      ) : (
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface-muted", RADIUS.inner)}>
                          <ImageOff className="h-4 w-4 text-muted" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">
                          {r.item.product} <span className="ml-1.5 font-semibold">{r.item.color} {r.size}</span>
                        </p>
                        <p className="flex flex-wrap gap-1 text-xs text-secondary">
                          {r.item.prints.map((p, j) => (
                            <span key={j}>
                              {p.position} {p.technique}
                              {j < r.item.prints.length - 1 ? " ·" : ""}
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={cn(TD, "text-right text-base font-semibold tabular-nums text-strong")}>{r.qty}</td>
                  {inputs.map((c) => (
                    <td key={c.key} className={cn(TD, "text-right")}>
                      <NumberInput
                        integer
                        min={0}
                        value={q[c.key]}
                        onValueChange={(v) => onChange(r.key, c.key, v)}
                        disabled={locked}
                        aria-label={`${c.label} ${r.item.color} ${r.size}`}
                        className="h-10 w-24 text-right"
                      />
                    </td>
                  ))}
                  <td className={cn(TD, "text-center")}>
                    {complete ? <CheckCircle2 className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" aria-label="ครบ" /> : <Circle className="mx-auto h-5 w-5 text-muted" aria-label="ยังไม่ครบ" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-divider">
              <td colSpan={2} className={cn(TD, "text-xs text-muted")}>รวม</td>
              <td className={cn(TD, "text-right text-base font-semibold tabular-nums text-strong")}>{total}</td>
              {inputs.map((c) => (
                <td key={c.key} className={cn(TD, "text-right text-base font-semibold tabular-nums", sum(c.key) >= total && c.key === "done" ? "text-green-700 dark:text-green-300" : "text-strong")}>
                  {sum(c.key)}
                </td>
              ))}
              <td className={cn(TD, "text-center text-xs tabular-nums text-muted")}>{completeRows}/{rows.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Section>
  );
}

/* ───────────────────────── ขวา: เช็คลิสต์ก่อนปิดขั้น ───────────────────────── */

function ChecklistCard({
  variant,
  stage,
  boss,
  allDone,
  remaining,
  shortage,
  onStep,
  onTick,
}: {
  variant: Variant;
  stage: Stage;
  boss: boolean;
  allDone: boolean;
  remaining: number;
  shortage: number;
  onStep: (id: string, to: WorkStep["state"]) => void;
  onTick: (id: string, index: number) => void;
}) {
  if (allDone) return null;
  const paper = stage.kind === "paper";
  return (
    <Section
      title={stage.kind === "pair" ? "ทำพร้อมกัน 2 งาน" : stage.steps[0]!.label}
      action={
        <span className="flex flex-wrap items-center gap-1.5">
          {shortage > 0 ? <InfoChip size="sm" tone="warning">ขาด {shortage.toLocaleString("th-TH")} ตัว</InfoChip> : null}
          {remaining > 0 ? <InfoChip size="sm" strong tone="warning" icon={ListChecks}>ติ๊กอีก {remaining} ข้อ</InfoChip> : <InfoChip size="sm" strong tone="success" icon={CheckCircle2}>ครบแล้ว</InfoChip>}
        </span>
      }
      id="proto-checklist"
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
              <RecordChip step={step} variant={variant} />
              <FactList columns={step.outsource ? 2 : 1} className="mb-3">
                <Fact size="sm" icon={UserRound} label="ผู้ทำ" value={step.owner ?? "ยังไม่มีคนรับ"} tone={step.owner ? "default" : "muted"} />
                {step.outsource ? (
                  <Fact size="sm" icon={Store} label="ร้านนอก" value={step.outsource.vendor} sub={<DueTag dueInDays={step.outsource.backInDays} dateLabel={`นัดรับ ${step.outsource.backLabel}`} size="sm" />} />
                ) : null}
              </FactList>
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
    </Section>
  );
}

/* ───────────────────────── ป้ายเล็ก ───────────────────────── */

function StateBadge({ step }: { step: WorkStep }) {
  const v = step.state === "done" ? "success" : step.state === "blocked" ? "destructive" : step.state === "waiting" ? "warning" : step.state === "active" ? "accent" : "default";
  return <Badge variant={v} size="sm">{STATE_LABEL[step.state]}</Badge>;
}

/** โหมดจด (กติกา A5) — โผล่เฉพาะทาง C ที่รางแยกตามโหมดจด */
function RecordChip({ step, variant }: { step: WorkStep; variant: Variant }) {
  if (variant !== "record") return null;
  const mode = recordModeOf(step);
  return <InfoChip size="sm" tone={mode === "screen" ? "info" : "neutral"}>{mode === "screen" ? "จดในระบบ" : mode === "auto" ? "ผ่านเองจากรอบพิมพ์" : "จดบนกระดาษ"}</InfoChip>;
}
