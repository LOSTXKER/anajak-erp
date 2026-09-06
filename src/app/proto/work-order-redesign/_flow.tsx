"use client";

/**
 * E · ตอนนี้ทำอะไร (รู้ทางขนาน) — wizard ที่หน่วยไม่ใช่ "ขั้นที่ N จาก 7" แต่เป็น "สิ่งที่ทำได้ตอนนี้"
 *
 *   เบสถาม (6 ก.ย.) "ทำแบบ wizard ได้มั้ย แต่มันจะมีทางขนาน" — ใบผลิตมีงานเดิน 2–3 สายพร้อมกัน
 *   (เสื้อ · ฟิล์ม DTF · ร้านนอก) แล้วบรรจบที่รีดร้อน → QC → แพ็ก · แถบขั้น 1–7 ทางเดียว (D) จึงเรียงสิ่งที่
 *   จริง ๆ ทำพร้อมกันได้ · ของจริงคิด "ขั้นที่ทำได้ตอนนี้" จากขั้นแรกที่ยังไม่ปิดของแต่ละสายอยู่แล้ว
 *   (selectNowSteps) — ทาง E แค่เอาสิ่งนั้นขึ้นจอตรง ๆ
 *
 *   · แผนที่เส้นทางบนสุด: สายที่เดินขนานกันอยู่คนละแถว เส้นวิ่งมารวมที่ขั้นบรรจบ (เห็นได้ว่าอะไรรออะไร)
 *   · ผืนใหญ่ "ตอนนี้ทำได้": สายเดียว = การ์ด 1 ใบ · สายขนาน = การ์ดวางคู่ · ทุกใบมีปุ่มเดียว (ActionZone ตัวจริง)
 *   · ขั้นที่ยังไม่ถึงคิว = บรรทัดสั้น "รอ: X, Y" · กดขั้นใดในแผนที่ = เปิดการ์ดขั้นนั้นแทน (มีปุ่มกลับ)
 *   · เสื้อ/ลาย + ตารางทั้งใบ พับไว้ท้ายเหมือน D
 * ที่วาดเองคือ "แผนที่เส้นทาง" — ปุ่ม ชิป ตัวเลข การ์ดปัญหา โซนลงมือ = component ตัวจริง
 */

import { useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarCheck, Check, Clock, FileText, Printer, Truck, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { FOCUS_BUTTON, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { BigMockup } from "../_kit/pieces";
import { StepStateChip } from "../work-order/_pieces";
import { ITEMS, LANE_LABEL, SHORT_LABEL, WORK_ORDER, laneOf, modeOf, nowSteps, upcomingSteps, waitingOn, type WorkStep } from "./_data";
import { Disclosure, GarmentBlock, OneZone, PaperSteps, isLive } from "./_pieces";

/* ───────────────────────── แผนที่เส้นทาง (สิ่งที่กำลังเทียบ จึงวาดเอง) ─────────────────────────
 * คอลัมน์คี่ = ขั้น · คอลัมน์คู่ = เส้นเชื่อม · แถว = สายที่เดินขนานกัน
 * ขั้นบรรจบ (รีดร้อน · QC · แพ็ก) กินหลายแถว → เส้นจากหลายสายวิ่งเข้ากล่องเดียว = "รวมกันตรงนี้" */

type Cell = { step: WorkStep; col: number; rowStart: number; rowEnd: number };
type Link = { key: string; colStart: number; colEnd: number; rowStart: number; rowEnd: number };

function layout(steps: WorkStep[]): { cells: Cell[]; links: Link[]; rows: number } {
  const byId = (id: string) => steps.find((s) => s.id === id);
  const shirt = byId("s1");
  const film = byId("s2");
  const emb = byId("s3");
  const press = byId("s4");
  const label = byId("s5");
  const qc = byId("s6");
  const pack = byId("s7");
  const outs = [emb, label].filter((s): s is WorkStep => !!s);
  const rows = 2 + outs.length;
  const cells: Cell[] = [];
  const links: Link[] = [];
  if (shirt) cells.push({ step: shirt, col: 1, rowStart: 1, rowEnd: 2 });
  if (film) cells.push({ step: film, col: 1, rowStart: 2, rowEnd: 3 });
  links.push({ key: "l-shirt", colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 });
  links.push({ key: "l-film", colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 });
  if (press) cells.push({ step: press, col: 3, rowStart: 1, rowEnd: 3 });
  links.push({ key: "l-press", colStart: 4, colEnd: 5, rowStart: 1, rowEnd: 3 });
  outs.forEach((o, i) => {
    const r = 3 + i;
    cells.push({ step: o, col: 1, rowStart: r, rowEnd: r + 1 });
    links.push({ key: `l-${o.id}`, colStart: 2, colEnd: 5, rowStart: r, rowEnd: r + 1 });
  });
  if (qc) cells.push({ step: qc, col: 5, rowStart: 1, rowEnd: rows + 1 });
  links.push({ key: "l-qc", colStart: 6, colEnd: 7, rowStart: 1, rowEnd: rows + 1 });
  if (pack) cells.push({ step: pack, col: 7, rowStart: 1, rowEnd: rows + 1 });
  return { cells, links, rows };
}

function NodeMark({ step }: { step: WorkStep }) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums";
  if (step.state === "done") return <span className={cn(base, "bg-green-600 text-white dark:bg-green-500")}><Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /></span>;
  if (step.state === "blocked") return <span className={cn(base, "bg-red-600 text-white")}><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /></span>;
  if (step.state === "waiting") return <span className={cn(base, "bg-amber-500 text-white")}><Truck className="h-3.5 w-3.5" aria-hidden="true" /></span>;
  if (step.state === "active") return <span className={cn(base, "bg-blue-600 text-white")}>{step.order}</span>;
  return <span className={cn(base, "bg-surface-muted text-muted")}>{step.order}</span>;
}

function RouteMap({ steps, selected, onSelect }: { steps: WorkStep[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const { cells, links, rows } = layout(steps);
  const now = new Set(nowSteps(steps).map((s) => s.id));
  return (
    <div className="overflow-x-auto pb-1">
      <div
        role="list"
        aria-label="เส้นทางงาน — สายที่เดินขนานกันอยู่คนละแถว"
        className="grid min-w-[760px] items-stretch gap-y-2"
        style={{ gridTemplateColumns: "minmax(150px,auto) 32px minmax(150px,auto) 32px minmax(150px,auto) 32px minmax(150px,auto)", gridTemplateRows: `repeat(${rows}, minmax(56px, auto))` }}
      >
        {links.map((l) => (
          <div key={l.key} aria-hidden="true" className="flex items-center" style={{ gridColumn: `${l.colStart} / ${l.colEnd}`, gridRow: `${l.rowStart} / ${l.rowEnd}` }}>
            <span className="h-0.5 w-full bg-border" />
          </div>
        ))}
        {cells.map(({ step, col, rowStart, rowEnd }) => {
          const on = step.id === selected;
          const isNow = now.has(step.id);
          const merge = rowEnd - rowStart > 1;
          const lane = laneOf(step);
          const pending = merge ? waitingOn(step, steps) : [];
          return (
            <div key={step.id} role="listitem" className="flex items-center" style={{ gridColumn: col, gridRow: `${rowStart} / ${rowEnd}` }}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : step.id)}
                className={cn(
                  RADIUS.item,
                  FOCUS_BUTTON,
                  "flex w-full items-center gap-2 border px-3 py-2 text-left text-sm transition-colors",
                  on ? "border-blue-600 bg-interactive-selected dark:border-blue-400" : isNow ? "border-border bg-surface hover:bg-interactive-hover" : "border-border bg-surface-muted/60 text-secondary hover:bg-interactive-hover",
                )}
              >
                <NodeMark step={step} />
                <span className="min-w-0">
                  <span className={cn("block truncate", isNow || on ? "font-semibold text-strong" : "font-medium")}>{SHORT_LABEL[step.id] ?? step.label}</span>
                  <span className="block text-xs text-muted">
                    {step.state === "todo" && pending.length > 0 ? `รอ ${pending.map((p) => SHORT_LABEL[p.id] ?? p.label).join(" + ")}` : merge ? LANE_LABEL.main : LANE_LABEL[lane]}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── การ์ดของขั้นหนึ่ง (ตอนนี้ทำได้ / ขั้นที่กดเลือก) ───────────────────────── */

function StepCard({ step, steps, boss, big = false }: { step: WorkStep; steps: WorkStep[]; boss: boolean; big?: boolean }) {
  const mode = modeOf(step);
  const done = step.state === "done";
  const paper = mode === "paper" && !done && step.state !== "blocked";
  const pending = waitingOn(step, steps);

  return (
    <article className={cn("card-surface flex flex-col gap-4 rounded-2xl p-5", step.state === "blocked" && "ring-1 ring-inset ring-red-600/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{LANE_LABEL[laneOf(step)] === LANE_LABEL.main ? "ขั้นบรรจบ" : `สาย${LANE_LABEL[laneOf(step)]}`}</p>
          <h2 className={cn("mt-0.5 font-semibold text-strong", big ? "text-2xl" : "text-xl")}>{step.label}</h2>
        </div>
        <div className="flex items-center gap-2">
          {isLive(step) && !paper ? <StepStateChip step={step} size="md" /> : null}
          {step.owner ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
              <UserRound className="h-4 w-4 text-muted" aria-hidden="true" />
              {step.owner}
            </span>
          ) : null}
        </div>
      </div>

      {step.problem ? (
        <Alert variant="error" title={step.problem.title} meta={[{ label: "แจ้งเมื่อ", value: step.problem.since }]}>
          {step.problem.detail}
        </Alert>
      ) : null}

      {/* ขั้นบรรจบที่ยังรอสายอื่น — บอกตรง ๆ ว่ารออะไร (นี่คือคำตอบของ "ทางขนาน") */}
      {pending.length > 0 && step.state !== "done" ? (
        <Alert variant="info" title={`รอ ${pending.length} สายมาบรรจบ`} meta={pending.map((p) => ({ label: LANE_LABEL[laneOf(p)], value: p.state === "blocked" ? `${SHORT_LABEL[p.id]} ติดปัญหา` : p.state === "waiting" ? `${SHORT_LABEL[p.id]} อยู่ที่ร้าน` : SHORT_LABEL[p.id] ?? p.label }))}>
          {step.state === "active" ? `ทำได้เท่าที่มี — ส่วนที่ขาดจะตามมาเมื่อสายที่รอปิด` : `ถึงคิวเมื่อสายที่รอปิดครบ`}
        </Alert>
      ) : null}

      {paper ? (
        <FactList columns={2}>
          <Fact label="ควรเสร็จ" value={step.planEnd} />
          <Fact icon={FileText} label="ยอดและเวลา" value="บนใบสั่งงาน" sub="ช่างเขียนตอนทำ" />
        </FactList>
      ) : (
        <FactList columns={2}>
          <div>
            <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
          </div>
          <Fact label={step.completedAt ? "เสร็จเมื่อ" : "ควรเสร็จ"} value={step.completedAt ?? step.planEnd} tone={step.completedAt ? "success" : "default"} />
        </FactList>
      )}

      {step.outsource ? (
        <FactList columns={2}>
          <Fact icon={Truck} label="ร้าน" value={step.outsource.vendor} sub={`ส่งไป ${step.outsource.sentOn} · ${step.outsource.work}`} />
          <div>
            <p className="text-xs font-medium text-muted">นัดรับกลับ</p>
            <InfoChip tone={step.outsource.backInDays < 0 ? "error" : "info"} strong={step.outsource.backInDays < 0} icon={CalendarCheck} className="mt-1">
              {step.outsource.backInDays < 0 ? `เลยนัด ${Math.abs(step.outsource.backInDays)} วัน (${step.outsource.backLabel})` : `กลับ ${step.outsource.backLabel}`}
            </InfoChip>
          </div>
        </FactList>
      ) : null}

      {!done && !paper && mode === "screen" && step.state !== "todo" ? (
        <div>
          <p className="text-xs font-medium text-muted">ก่อนกดปุ่ม ทำให้ครบ</p>
          <ul className="mt-2 space-y-2">
            {step.checklist.map((c) => (
              <li key={c.label}>
                <label className={cn(RADIUS.item, "flex min-h-12 cursor-pointer items-center gap-3 border border-border px-3 text-base text-strong")}>
                  <Checkbox defaultChecked={c.done} aria-label={c.label} />
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto">
        <OneZone step={step} boss={boss} />
      </div>
    </article>
  );
}

/* ───────────────────────── ทั้งจอ ───────────────────────── */

function GarmentStrip() {
  return (
    <div className={cn(SUNK_PANEL, RADIUS.inner, "flex flex-wrap items-center gap-4 px-4 py-3")}>
      <div className="flex items-center gap-2">
        {ITEMS.map((item) => (
          <BigMockup key={item.id} src={item.mockup} alt={`ม็อกอัพ ${item.color}`} className="h-12 w-12 shrink-0" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-strong">
          {ITEMS[0]!.product} — {ITEMS.length} สี รวม {WORK_ORDER.qty} ตัว
        </p>
        <InfoChipRow className="mt-1">
          {ITEMS[0]!.sizes.map((s) => (
            <InfoChip key={s.size} size="sm">
              {s.size} <span className="font-semibold">{ITEMS.reduce((sum, it) => sum + (it.sizes.find((v) => v.size === s.size)?.qty ?? 0), 0)}</span>
            </InfoChip>
          ))}
        </InfoChipRow>
      </div>
      <FactList columns={2} className="min-w-[16rem]">
        {ITEMS[0]!.prints.map((p) => (
          <Fact key={p.position} size="sm" label={`${p.position} · ${p.technique}`} value={p.size} />
        ))}
      </FactList>
    </div>
  );
}

export function FlowWizard({ steps, boss }: { steps: WorkStep[]; boss: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? steps.find((s) => s.id === selectedId) ?? null : null;
  const now = nowSteps(steps);
  const problems = now.filter((s) => s.state === "blocked");
  const doable = now.filter((s) => s.state !== "blocked");
  const upcoming = upcomingSteps(steps);
  const doneCount = steps.filter((s) => s.state === "done").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">{WORK_ORDER.company}</p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tabular-nums text-strong">
            {WORK_ORDER.orderNumber}
            <Badge variant="warning" size="sm">
              สำคัญ
            </Badge>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DueTag dueInDays={WORK_ORDER.dueInDays} dateLabel={WORK_ORDER.dueLabel} size="md" />
          <Metric value={`${doneCount}/${steps.length}`} unit="ขั้น" size="sm" />
          {boss ? (
            <Button variant="outline" size="sm">
              <Printer /> พิมพ์ใบสั่งงาน
            </Button>
          ) : null}
        </div>
      </div>

      <div className="card-surface rounded-2xl p-4">
        <p className="mb-3 text-xs font-medium text-muted">เส้นทางงาน — สายที่เดินพร้อมกันอยู่คนละแถว เส้นวิ่งมารวมที่ขั้นที่ต้องรอกัน · กดขั้นไหนเพื่อดูขั้นนั้น</p>
        <RouteMap steps={steps} selected={selectedId} onSelect={setSelectedId} />
      </div>

      <GarmentStrip />

      {selected ? (
        <section className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ArrowLeft /> กลับไปดู “ตอนนี้ทำอะไร”
          </Button>
          <StepCard step={selected} steps={steps} boss={boss} big />
        </section>
      ) : (
        <section className="space-y-4">
          {problems.length > 0 ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-strong">
                <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" /> ติดปัญหา {problems.length} สาย
              </h2>
              <div className={cn("grid gap-4", problems.length > 1 && "lg:grid-cols-2")}>
                {problems.map((s) => (
                  <StepCard key={s.id} step={s} steps={steps} boss={boss} />
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
              <Alert variant="info" title="ยังไม่มีอะไรให้ทำตอนนี้">
                ทุกสายกำลังรอกัน — ดูที่การ์ดติดปัญหาข้างบน
              </Alert>
            ) : (
              <div className={cn("grid gap-4", doable.length > 1 && "lg:grid-cols-2")}>
                {doable.map((s) => (
                  <StepCard key={s.id} step={s} steps={steps} boss={boss} />
                ))}
              </div>
            )}
          </div>

          {upcoming.length > 0 ? (
            <div className={cn(SUNK_PANEL, RADIUS.inner, "p-4")}>
              <p className="text-xs font-medium text-muted">ถัดไป — ยังไม่ถึงคิว</p>
              <ul className="mt-2 space-y-1.5">
                {upcoming.map((s) => {
                  const pending = waitingOn(s, steps);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted" aria-hidden="true" />
                      <span className="font-medium text-strong">{s.label}</span>
                      <span className="text-secondary">
                        {pending.length > 0 ? `รอ ${pending.map((p) => SHORT_LABEL[p.id] ?? p.label).join(" + ")}` : `ควร ${s.planEnd}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      <Disclosure summary="เสื้อและลาย (เต็ม)">
        <GarmentBlock />
      </Disclosure>
      <Disclosure summary="ดูทั้งใบ (ตารางแบบกระดาษ)">
        <PaperSteps steps={steps} boss={boss} title="ขั้นตอนทั้งหมด" />
      </Disclosure>
    </div>
  );
}
