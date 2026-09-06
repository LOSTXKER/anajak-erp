"use client";

/**
 * 4 ทางที่กำลังเทียบ — ต่างกันที่ "อะไรนำสายตาใน 2 วินาทีแรก"
 *   ปัจจุบัน  = แบบ E ที่ลงของจริงเมื่อวาน (ตัวเลข 4 ช่อง → การ์ดแผนที่ → แถบเสื้อ → หัวข้อ + การ์ดขั้น → ถัดไป → พับ 3)
 *   A ตัดของซ้ำ = โครง E เดิม แต่ทุกอย่างที่โชว์ซ้ำเกิน 1 ที่ถูกตัด (ตัวเลข 4 ช่อง · ชิป 3 · ช่องว่างเปล่า · ถัดไป)
 *   B ใบเดียว   = ทั้งหน้าเป็นการ์ดเดียว แผนที่ทำหน้าที่แท็บ เนื้อของขั้นที่กดต่อลงมาข้างล่าง — เห็นทีละขั้น
 *   C พาดหัวก่อน = ประโยคเดียวบอกว่างานอยู่ไหน + ปุ่มเดียว · แผนที่ย่อเป็นแถบ · งานที่ทำได้เป็นรายการแถวละบรรทัด
 */

import { useState } from "react";
import { AlertTriangle, Printer, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoChip } from "@/components/ui/info-chip";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { byId, defaultFocus, doableSteps, headlineOf, isDone, nowSteps, problemSteps, type LeanOrder } from "./_data";
import { NodeMark, RouteMap, viewFor } from "./_map";
import { BackToNow, Folded, HeadCurrent, HeadLean, MapCardCurrent, NextPanel, ProblemCardCurrent, ShirtLine, ShirtStrip, StatCards, StepCardCurrent, StepLean } from "./_pieces";

type Props = { order: LeanOrder; boss: boolean; idPrefix: string };

/* ───────────────────────── ปัจจุบัน · E ───────────────────────── */

export function CurrentE({ order, boss, idPrefix }: Props) {
  const { steps } = order;
  const [focusId, setFocusId] = useState<string | null>(null);
  const focused = focusId ? byId(focusId, steps) ?? null : null;
  const problems = problemSteps(steps);
  const doable = doableSteps(steps);
  const problemIds = new Set(problems.map((s) => s.id));
  const allDone = steps.every(isDone);

  return (
    <div className="space-y-6">
      <HeadCurrent
        order={order}
        action={
          focused && boss && focused.state !== "done" ? (
            <Button variant="outline">
              <UserRound /> มอบหมาย / จัดการขั้นนี้
            </Button>
          ) : undefined
        }
      />
      <StatCards order={order} />
      <MapCardCurrent order={order} focusId={focusId} onFocus={setFocusId} />
      <ShirtStrip order={order} />

      {focused ? (
        <section className="space-y-3" aria-label="ขั้นที่เลือก">
          <BackToNow onClick={() => setFocusId(null)} />
          {problemIds.has(focused.id) ? <ProblemCardCurrent step={focused} /> : null}
          <StepCardCurrent step={focused} boss={boss} />
        </section>
      ) : (
        <section className="space-y-6" aria-label="ตอนนี้ทำอะไร">
          {problems.length > 0 ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-strong">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" /> ติดปัญหา {problems.length} ขั้น
              </h2>
              <div className={cn("grid gap-4", problems.length > 1 && "@3xl:grid-cols-2")}>
                {problems.map((step) => (
                  <div key={step.id} className="space-y-3">
                    <ProblemCardCurrent step={step} />
                    <StepCardCurrent step={step} boss={boss} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-strong">
              ตอนนี้ทำได้ {doable.length} อย่าง
              {doable.length > 1 ? <span className="ml-2 text-sm font-normal text-secondary">คนละสาย ทำพร้อมกันได้</span> : null}
            </h2>
            {doable.length === 0 ? (
              <Alert variant="info" title={allDone ? "ทุกขั้นผ่านแล้ว" : "ยังไม่มีอะไรให้ทำตอนนี้"}>
                {allDone ? "ใบผลิตนี้ครบทุกขั้น" : problems.length > 0 ? "ทุกสายกำลังรอกัน — ดูที่ติดปัญหาข้างบน" : "ทุกสายกำลังรอกัน — ดูว่าขั้นถัดไปรออะไรข้างล่าง"}
              </Alert>
            ) : (
              <div className={cn("grid gap-4", doable.length > 1 && "@3xl:grid-cols-2")}>
                {doable.map((step) => (
                  <StepCardCurrent key={step.id} step={step} boss={boss} />
                ))}
              </div>
            )}
          </div>

          <NextPanel steps={steps} onFocus={setFocusId} />
        </section>
      )}

      <Folded order={order} idPrefix={idPrefix} />
    </div>
  );
}

/* ───────────────────────── A · ตัดของซ้ำ ───────────────────────── */

export function CutA({ order, boss, idPrefix }: Props) {
  const { steps } = order;
  const [focusId, setFocusId] = useState<string | null>(null);
  const focused = focusId ? byId(focusId, steps) ?? null : null;
  const problems = problemSteps(steps);
  const doable = doableSteps(steps);
  const allDone = steps.every(isDone);

  return (
    <div className="space-y-5">
      <HeadLean order={order} />
      <div className="card-surface rounded-2xl p-4">
        <RouteMap steps={steps} focusId={focusId} onFocus={setFocusId} honest />
      </div>
      <ShirtLine order={order} className="px-1" />

      {focused ? (
        <section className="space-y-3" aria-label="ขั้นที่เลือก">
          <BackToNow onClick={() => setFocusId(null)} />
          <StepLean step={focused} boss={boss} big />
        </section>
      ) : (
        <section className="space-y-5" aria-label="ตอนนี้ทำอะไร">
          {problems.length > 0 ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-strong">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" /> ติดปัญหา {problems.length} ขั้น
              </h2>
              <div className={cn("grid gap-4", problems.length > 1 && "@3xl:grid-cols-2")}>
                {problems.map((step) => (
                  <StepLean key={step.id} step={step} boss={boss} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-strong">
              ตอนนี้ทำได้ {doable.length} อย่าง
              {doable.length > 1 ? <span className="ml-2 text-sm font-normal text-secondary">คนละสาย ทำพร้อมกันได้</span> : null}
            </h2>
            {doable.length === 0 ? (
              <Alert variant="info" title={allDone ? "ทุกขั้นผ่านแล้ว" : "ยังไม่มีอะไรให้ทำตอนนี้"}>
                {allDone ? "ใบผลิตนี้ครบทุกขั้น" : "ทุกสายกำลังรอกัน — ดูในแผนที่ว่าขั้นถัดไปรออะไร"}
              </Alert>
            ) : (
              <div className={cn("grid gap-4", doable.length > 1 && "@3xl:grid-cols-2")}>
                {doable.map((step) => (
                  <StepLean key={step.id} step={step} boss={boss} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <Folded order={order} idPrefix={idPrefix} lean />
    </div>
  );
}

/* ───────────────────────── B · ใบเดียว แผนที่เป็นแท็บ ───────────────────────── */

export function OneB({ order, boss, idPrefix }: Props) {
  const { steps } = order;
  const [selectedId, setSelectedId] = useState<string>(() => defaultFocus(steps).id);
  const selected = byId(selectedId, steps) ?? defaultFocus(steps);
  const now = nowSteps(steps);

  return (
    <div className="space-y-5">
      <article className="card-surface rounded-2xl">
        <HeadLean order={order} className="px-5 pt-5" />
        <div className="px-5 pt-4">
          <RouteMap steps={steps} focusId={selectedId} onFocus={(id) => setSelectedId(id ?? selectedId)} honest ariaLabel="เส้นทางงาน — กดขั้นไหนเพื่อเปิดขั้นนั้นด้านล่าง" />
        </div>
        {now.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
            <span className="text-xs font-medium text-muted">ตอนนี้ {now.length} สาย</span>
            {now.map((s) => {
              const on = s.id === selectedId;
              const view = viewFor(s, true);
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => setSelectedId(s.id)} className={cn(RADIUS.item, FOCUS_BUTTON, "rounded-full")}>
                  <InfoChip tone={view === "blocked" ? "error" : view === "waiting" ? "warning" : "info"} strong={on} icon={undefined}>
                    {view === "blocked" ? `ติด: ${s.short}` : view === "waiting" ? `${s.short} อยู่ที่ร้าน` : s.short}
                  </InfoChip>
                </button>
              );
            })}
          </div>
        ) : null}
        <ShirtLine order={order} className="mx-5 my-4 border-y border-divider py-3" />
        <div className="px-5 pb-5">
          <StepLean step={selected} boss={boss} big bare />
        </div>
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-divider px-5 py-3 text-sm">
          <span className="text-xs font-medium text-muted">ดูเพิ่ม</span>
          <a href={`#${idPrefix}-design`} className={cn(FOCUS_BUTTON, "rounded text-blue-600 hover:underline dark:text-blue-400")}>
            ลายและม็อกอัพ{order.mockupVersion !== null ? ` v${order.mockupVersion}` : ""}
          </a>
          <a href={`#${idPrefix}-info`} className={cn(FOCUS_BUTTON, "rounded text-blue-600 hover:underline dark:text-blue-400")}>
            ข้อมูลใบ
          </a>
          <a href={`#${idPrefix}-history`} className={cn(FOCUS_BUTTON, "rounded text-blue-600 hover:underline dark:text-blue-400")}>
            ประวัติ
          </a>
        </footer>
      </article>
      <Folded order={order} idPrefix={idPrefix} lean />
    </div>
  );
}

/* ───────────────────────── C · พาดหัวก่อน ───────────────────────── */

export function HeadC({ order, boss, idPrefix }: Props) {
  const { steps } = order;
  const [focusId, setFocusId] = useState<string | null>(null);
  const focused = focusId ? byId(focusId, steps) ?? null : null;
  const head = headlineOf(order);
  const now = nowSteps(steps);
  const lead = head.step;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
          <span className="font-medium tabular-nums text-strong">{order.orderNumber}</span>
          <span>{order.customer}</span>
          {order.priority ? (
            <InfoChip size="sm" tone={order.priority === "URGENT" ? "error" : "warning"}>
              {order.priority === "URGENT" ? "เร่งด่วน" : "สำคัญ"}
            </InfoChip>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-strong @2xl:text-3xl">{head.title}</h1>
        <p className="mt-1.5 text-base text-secondary">{head.sub}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {lead ? (
            lead.state === "blocked" ? (
              boss ? (
                <Button size="lg" variant="destructive">
                  ปลดปัญหา / เปลี่ยนคน
                </Button>
              ) : null
            ) : lead.mode === "paper" ? null : (
              <Button size="lg">{lead.action}</Button>
            )
          ) : null}
          {lead && lead.state !== "blocked" ? (
            <Button variant="ghost" size="lg">
              <AlertTriangle /> แจ้งปัญหา
            </Button>
          ) : null}
          <Button variant="outline" size="lg">
            <Printer /> พิมพ์ใบสั่งงาน
          </Button>
        </div>
      </div>

      <RouteMap steps={steps} focusId={focusId} onFocus={setFocusId} honest dense />

      {focused ? (
        <section className="space-y-3" aria-label="ขั้นที่เลือก">
          <BackToNow onClick={() => setFocusId(null)} />
          <StepLean step={focused} boss={boss} />
        </section>
      ) : now.length > 0 ? (
        <section className="card-surface rounded-2xl" aria-label="ตอนนี้ทำอะไร">
          <p className="flex items-center gap-2 border-b border-divider px-5 py-3 text-xs font-medium text-muted">
            ตอนนี้ {now.length} สาย
            {now.length > 1 ? <span>· ทำพร้อมกันได้</span> : null}
          </p>
          <ul className="divide-y divide-divider">
            {now.map((s) => (
              <NowRowC key={s.id} order={order} stepId={s.id} boss={boss} lead={s.id === lead?.id} onOpen={() => setFocusId(s.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      <ShirtLine order={order} className="px-1" />
      <Folded order={order} idPrefix={idPrefix} lean />
    </div>
  );
}

function NowRowC({ order, stepId, boss, lead, onOpen }: { order: LeanOrder; stepId: string; boss: boolean; lead: boolean; onOpen: () => void }) {
  const step = byId(stepId, order.steps);
  if (!step) return null;
  const view = viewFor(step, true);
  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", lead && "bg-interactive-selected/40")}>
      <NodeMark view={view} order={step.order} outsource={step.kind === "outsource"} />
      <button type="button" onClick={onOpen} className={cn(FOCUS_BUTTON, "min-w-[12rem] flex-1 basis-56 rounded text-left")}>
        <span className="block font-medium text-strong hover:underline">
          {step.label}
          {step.owner ? <span className="font-normal text-secondary"> · {step.owner}</span> : null}
        </span>
        <span className="mt-0.5 block text-sm text-secondary">{rowFact(step)}</span>
      </button>
      <RowTail step={step} boss={boss} lead={lead} />
    </li>
  );
}

function rowFact(step: LeanOrder["steps"][number]) {
  if (step.problem) return step.problem.detail;
  if (step.outsource) return `${step.outsource.work} · ส่งไป ${step.outsource.sentOn}`;
  if (step.mode === "paper") return "ยอดและเวลาอยู่บนใบสั่งงาน";
  return `ควรเสร็จ ${step.planEnd}`;
}

function RowTail({ step, boss, lead }: { step: LeanOrder["steps"][number]; boss: boolean; lead: boolean }) {
  const o = step.outsource;
  return (
    <>
      {o ? (
        <InfoChip tone={o.backInDays < 0 ? "error" : "info"} strong={o.backInDays < 0}>
          {o.backInDays < 0 ? `เลยนัด ${-o.backInDays} วัน` : `นัดรับ ${o.backLabel}`}
        </InfoChip>
      ) : step.mode === "paper" ? null : (
        <span className="text-sm tabular-nums text-secondary">
          {step.qtyDone}/{step.qtyTotal}
        </span>
      )}
      {step.state === "blocked" ? (
        boss ? (
          <Button size="sm" variant={lead ? "destructive" : "outline"}>
            ปลดปัญหา
          </Button>
        ) : (
          <span className="text-xs text-secondary">รอหัวหน้า</span>
        )
      ) : step.mode === "paper" ? (
        <span className="text-xs text-muted">เขียนบนใบ</span>
      ) : step.mode === "auto" ? (
        <span className="text-xs text-secondary">ผ่านเอง</span>
      ) : (
        <Button size="sm" variant={lead ? "default" : "outline"}>
          {step.action}
        </Button>
      )}
    </>
  );
}
