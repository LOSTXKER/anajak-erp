"use client";

/**
 * ชิ้นส่วนที่กำลังเทียบ: โครงทั้งใบของใบผลิต (ไม่ใช่แค่แท็บขั้นงาน)
 *   C · จอเหมือนกระดาษ — หน้าเดียวเลื่อนลงอ่านจบ วางเหมือนใบสั่งงานที่ทีมถือ: หัวใบ → เสื้อ/ลาย → ตารางขั้นตอน (คอลัมน์เดียวกับกระดาษ) → ตารางร้านนอก
 *   D · ทีละขั้น — แถบขั้น 1..n เป็นทางเลือกเดียว · ผืนใหญ่ = เสื้อ/ลาย ซ้าย · ขั้นที่เปิด ขวา (ปุ่มเดียวเต็มแถว) · ทั้งใบพับไว้ท้ายหน้า
 * ปุ่ม ชิป ตัวเลข ตาราง ช่องติ๊ก โซนลงมือ = component ตัวจริง · ที่วาดเองคือ "แถบขั้น" (D) กับ "หัวใบแบบกระดาษ" (C) เพราะเป็นสิ่งที่เทียบ
 */

import { AlertTriangle, CalendarCheck, Check, CheckCircle2, ChevronRight, Clock, FileText, MonitorSmartphone, Pencil, Printer, Shirt, Truck, UserRound, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { Section } from "@/components/ui/section";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { BigMockup } from "../_kit/pieces";
import { StepStateChip } from "../work-order/_pieces";
import { AUTO_PLAIN, ITEMS, PAPER_PLAIN, PLAIN_ACTION, PLAIN_WHY, SHORT_LABEL, TICKET, WORK_ORDER, modeOf, type WorkStep } from "./_data";

const noop = () => {};

const FIX_ITEMS: Omit<MoreMenuItem, "onSelect">[] = [
  { key: "edit", label: "บันทึกรายละเอียด", hint: "แก้ยอด หมายเหตุ และเวลาของขั้นนี้", icon: Pencil },
  { key: "qty", label: "แก้ยอดที่บันทึก", icon: Wrench },
  { key: "owner", label: "เปลี่ยนคนทำ", icon: UserRound },
  { key: "hold", label: "พักงานนี้ไว้ก่อน", icon: Clock },
  { key: "pass", label: "ผ่านขั้นนี้แทนช่าง", icon: CheckCircle2, danger: true },
];
const PAPER_DONE_ITEM: Omit<MoreMenuItem, "onSelect"> = { key: "paper-done", label: "จดว่าเสร็จแล้ว (จากกระดาษ)", hint: "ใส่ตามที่ช่างเขียนไว้ — ไม่บังคับ", icon: FileText };

export function isLive(step: WorkStep) {
  return step.state === "active" || step.state === "blocked" || step.state === "waiting";
}

export function Disclosure({ summary, children, defaultOpen = false }: { summary: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className={cn(RADIUS.item, FOCUS_BUTTON, "flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-secondary transition-colors hover:text-strong [&::-webkit-details-marker]:hidden")}>
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/* ───────────────────────── ของร่วม: หัวใบแบบกระดาษ · เสื้อและลาย ───────────────────────── */

/** หัวใบวางเหมือนหัวกระดาษ — เลขงานใหญ่ · กำหนดส่ง · จำนวน · ลูกค้า · ม็อกอัพ (ไม่มีตัวเลข 4 ช่องแยกการ์ด) */
function PaperHead({ steps, boss }: { steps: WorkStep[]; boss: boolean }) {
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <div className="card-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">ใบสั่งงาน · พิมพ์ {TICKET.printedAt}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-bold tabular-nums text-strong">
            {WORK_ORDER.orderNumber}
            <Badge variant="warning" size="sm">
              สำคัญ
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {WORK_ORDER.company} · {WORK_ORDER.contact}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {boss ? (
            <Button variant="outline" size="sm">
              <Printer /> พิมพ์ใบสั่งงาน
            </Button>
          ) : null}
          <Button variant="outline" size="sm">
            <AlertTriangle /> แจ้งปัญหา
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" /> กำหนดส่ง
          </p>
          <div className="mt-1.5">
            <DueTag dueInDays={WORK_ORDER.dueInDays} dateLabel={WORK_ORDER.dueLabel} size="lg" />
          </div>
        </div>
        <Metric label="จำนวนรวม" value={WORK_ORDER.qty.toLocaleString("th-TH")} unit="ตัว" size="lg" icon={Shirt} />
        <Metric label="ผ่านแล้ว" value={`${done}/${steps.length}`} unit="ขั้น" size="lg" icon={CheckCircle2} tone={done === steps.length ? "success" : "default"} />
        <Fact label="ม็อกอัพอนุมัติ" value={`${WORK_ORDER.approvedMockup.version} · ${WORK_ORDER.approvedMockup.approvedOn}`} sub={`โดย ${WORK_ORDER.approvedMockup.by}`} />
      </div>
    </div>
  );
}

/** เสื้อและลาย — บล็อกเดียวกับที่อยู่บนกระดาษ (รูป + ไซซ์ต่อสี + ตำแหน่งพิมพ์) */
export function GarmentBlock({ compact = false }: { compact?: boolean }) {
  return (
    <Section title="เสื้อและลาย" meta={`${ITEMS.length} สี · ${WORK_ORDER.qty} ตัว`} icon={Shirt} tone="product">
      {/* รูปเท่าบนกระดาษ (ไม่ใช่ผืนใหญ่) — คนดูจอนี้เพื่อนับไซซ์ ไม่ใช่ดูลาย */}
      <ul className={cn("grid gap-4", compact ? "grid-cols-1" : "sm:grid-cols-3")}>
        {ITEMS.map((item) => {
          const qty = item.sizes.reduce((s, v) => s + v.qty, 0);
          return (
            <li key={item.id} className="flex items-start gap-3">
              <BigMockup src={item.mockup} alt={`ม็อกอัพ ${item.color}`} className={compact ? "h-16 w-16 shrink-0" : "h-24 w-24 shrink-0"} />
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-strong">{item.color}</p>
                  <Metric value={qty} unit="ตัว" size="sm" />
                </div>
                <InfoChipRow className="mt-1">
                  {item.sizes.map((s) => (
                    <InfoChip key={s.size} size="sm">
                      {s.size} <span className="font-semibold">{s.qty}</span>
                    </InfoChip>
                  ))}
                </InfoChipRow>
              </div>
            </li>
          );
        })}
      </ul>
      <FactList columns={2} className="mt-4">
        {ITEMS[0]!.prints.map((p) => (
          <Fact key={p.position} size="sm" label={`${p.position} · ${p.technique}`} value={p.size} sub={p.note} />
        ))}
      </FactList>
      {WORK_ORDER.note ? (
        <Alert variant="warning" className="mt-4" title="หมายเหตุจากใบงาน">
          {WORK_ORDER.note}
        </Alert>
      ) : null}
    </Section>
  );
}

/* ───────────────────────── C · ตารางขั้นตอนแบบกระดาษ ───────────────────────── */

function RowAction({ step, boss }: { step: WorkStep; boss: boolean }) {
  const mode = modeOf(step);
  if (step.state === "done") return <span className="text-xs text-secondary">ผ่านแล้ว</span>;
  if (step.state === "blocked") {
    return boss ? (
      <Button size="sm" variant="destructive">
        ปลดปัญหา
      </Button>
    ) : (
      <span className="text-xs text-secondary">รอหัวหน้า</span>
    );
  }
  if (mode === "paper") return <span className="text-xs text-muted">เซ็นบนใบ</span>;
  if (mode === "auto") return <span className="text-xs text-secondary">ผ่านเอง</span>;
  if (step.state === "waiting") return <Button size="sm">รับของกลับ</Button>;
  if (step.state === "todo") return <span className="text-xs text-muted">ยังไม่ถึง</span>;
  return <Button size="sm">{PLAIN_ACTION[step.id] ?? step.action}</Button>;
}

/** ตารางขั้นตอน — คอลัมน์เดียวกับกระดาษ: # · ขั้นตอน (+คนทำ) · ทำอะไรก่อนปิด · ยอด · เสร็จ · ลงชื่อ/ลงมือ */
export function PaperSteps({ steps, boss, title = "ขั้นตอนผลิต — ทำในโรงงาน" }: { steps: WorkStep[]; boss: boolean; title?: string }) {
  return (
    <DataTable.Root>
      <DataTable.Head>
        <tr>
          <DataTable.Th className="w-10">#</DataTable.Th>
          <DataTable.Th>{title}</DataTable.Th>
          <DataTable.Th className="hidden lg:table-cell">ทำอะไรก่อนปิด</DataTable.Th>
          <DataTable.Th className="w-28 text-right">ยอด</DataTable.Th>
          <DataTable.Th className="w-32">เสร็จ</DataTable.Th>
          <DataTable.Th className="w-36">ลงชื่อ / ลงมือ</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {steps.map((step) => {
          const mode = modeOf(step);
          const done = step.state === "done";
          const paper = mode === "paper" && !done && step.state !== "blocked";
          return (
            <DataTable.Row key={step.id} className={cn(isLive(step) && !paper && "bg-interactive-selected/40")}>
              <DataTable.Td>
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium tabular-nums", done ? "bg-green-600 text-white dark:bg-green-500" : isLive(step) ? "bg-surface-muted text-strong" : "text-muted ring-1 ring-inset ring-border")}>
                  {done ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> : step.order}
                </span>
              </DataTable.Td>
              <DataTable.Td>
                <p className={cn("font-medium", step.state === "todo" ? "text-secondary" : "text-strong")}>{step.label}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-secondary">
                  {isLive(step) && !paper ? <StepStateChip step={step} /> : null}
                  {step.owner ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      {step.owner}
                    </span>
                  ) : null}
                </p>
              </DataTable.Td>
              <DataTable.Td className="hidden lg:table-cell">
                <ul className="space-y-0.5 text-xs text-secondary">
                  {step.checklist.map((c) => (
                    <li key={c.label} className="flex items-start gap-1.5">
                      <Checkbox defaultChecked={c.done} disabled={done || paper} aria-label={c.label} className="mt-0.5" />
                      <span>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </DataTable.Td>
              <DataTable.Td className="text-right">
                {paper ? <span className="text-xs text-muted">เขียนบนใบ</span> : step.kind === "outsource" && !done ? <span className="text-xs text-muted">รอครบ {step.qtyTotal}</span> : <Metric value={`${step.qtyDone}/${step.qtyTotal}`} size="sm" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />}
              </DataTable.Td>
              <DataTable.Td>{paper ? <span className="text-xs text-muted">เขียนบนใบ</span> : <span className={cn("text-sm", step.completedAt ? "text-strong" : "text-muted")}>{step.completedAt ?? `ควร ${step.planEnd}`}</span>}</DataTable.Td>
              <DataTable.Td>
                <RowAction step={step} boss={boss} />
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

/** ตารางร้านนอก — แยกเหมือนกระดาษ (ของเดินคู่ขนานกับงานในโรงงาน) */
function OutsourceTable({ steps, boss }: { steps: WorkStep[]; boss: boolean }) {
  if (steps.length === 0) return null;
  return (
    <DataTable.Root>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ของจากร้านนอก — เดินคู่ขนาน</DataTable.Th>
          <DataTable.Th>ร้าน</DataTable.Th>
          <DataTable.Th className="w-28">ส่งไป</DataTable.Th>
          <DataTable.Th className="w-40">นัดรับกลับ</DataTable.Th>
          <DataTable.Th className="w-36">ลงมือ</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {steps.map((step) => {
          const o = step.outsource!;
          const overdue = o.backInDays < 0;
          return (
            <DataTable.Row key={step.id}>
              <DataTable.Td>
                <p className="font-medium text-strong">{step.label.replace(" — ร้านนอก", "")}</p>
                <p className="mt-0.5 text-xs text-secondary">{o.work}</p>
              </DataTable.Td>
              <DataTable.Td>
                <span className="inline-flex items-center gap-1.5 text-sm text-strong">
                  <Truck className="h-4 w-4 text-muted" aria-hidden="true" />
                  {o.vendor}
                </span>
              </DataTable.Td>
              <DataTable.Td className="text-sm">{o.sentOn}</DataTable.Td>
              <DataTable.Td>
                <InfoChip tone={overdue ? "error" : "info"} strong={overdue} icon={CalendarCheck}>
                  {overdue ? `เลยนัด ${Math.abs(o.backInDays)} วัน (${o.backLabel})` : `กลับ ${o.backLabel}`}
                </InfoChip>
              </DataTable.Td>
              <DataTable.Td>
                <RowAction step={step} boss={boss} />
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

export function PaperTwin({ steps, boss }: { steps: WorkStep[]; boss: boolean }) {
  const problems = steps.filter((s) => s.problem);
  const inhouse = steps.filter((s) => s.kind !== "outsource");
  const outsource = steps.filter((s) => s.kind === "outsource");
  return (
    <div className="space-y-5">
      <PaperHead steps={steps} boss={boss} />
      {problems.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {problems.map((s) => (
            <Alert key={s.id} variant="error" title={`${s.problem!.title} — ${s.label}`} meta={[{ label: "แจ้งเมื่อ", value: s.problem!.since }, { label: "โดย", value: s.owner ?? "—" }]}>
              {s.problem!.detail}
            </Alert>
          ))}
        </div>
      ) : null}
      <GarmentBlock />
      <PaperSteps steps={inhouse} boss={boss} />
      <OutsourceTable steps={outsource} boss={boss} />
      <p className="text-xs text-muted">ประวัติละเอียด (ใครกดอะไรเมื่อไร) ดูได้ที่ตั้งค่า → ประวัติการใช้งาน · วัตถุดิบดูที่หน้าออเดอร์</p>
    </div>
  );
}

/* ───────────────────────── D · ทีละขั้น ───────────────────────── */

/** แถบขั้น 1..n — ทางเดียวที่ใช้เลือกขั้น (สิ่งที่กำลังเทียบ จึงวาดเอง) */
function StepRail({ steps, selected, onSelect }: { steps: WorkStep[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="ขั้นงานทั้งหมด">
      {steps.map((step) => {
        const on = step.id === selected;
        const done = step.state === "done";
        const blocked = step.state === "blocked";
        return (
          <li key={step.id} className="shrink-0">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(step.id)}
              className={cn(
                RADIUS.item,
                FOCUS_BUTTON,
                "flex min-h-11 items-center gap-2 border px-3 text-sm transition-colors",
                on ? "border-blue-600 bg-interactive-selected font-semibold text-strong dark:border-blue-400" : "border-border bg-surface text-secondary hover:bg-interactive-hover",
              )}
            >
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums", done ? "bg-green-600 text-white dark:bg-green-500" : blocked ? "bg-red-600 text-white" : on ? "bg-blue-600 text-white" : "bg-surface-muted text-muted")}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> : blocked ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : step.order}
              </span>
              {SHORT_LABEL[step.id] ?? step.label}
              {step.kind === "outsource" ? <Truck className="h-4 w-4 text-muted" aria-hidden="true" /> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function OneZone({ step, boss }: { step: WorkStep; boss: boolean }) {
  const mode = modeOf(step);
  const done = step.state === "done";
  const stuck = step.state === "blocked";
  const paper = mode === "paper" && !done && !stuck;
  const menu = boss && !done ? <MoreMenu items={[...(paper ? [PAPER_DONE_ITEM] : []), ...FIX_ITEMS].map((item) => ({ ...item, onSelect: noop }))} /> : null;
  const report =
    !done && !stuck ? (
      <Button variant="ghost" className="h-14 text-base">
        <AlertTriangle /> แจ้งปัญหา
      </Button>
    ) : null;
  if (done) return <ActionZone touch note={`ปิดขั้นแล้ว ${step.completedAt} · โดย ${step.owner}`} icon={CheckCircle2} tone="success" />;
  if (paper) {
    return (
      <ActionZone touch note={PAPER_PLAIN} icon={FileText} tone="neutral" menu={menu}>
        {report}
      </ActionZone>
    );
  }
  if (mode === "auto") return <ActionZone touch note={AUTO_PLAIN} icon={Printer} tone="success" />;
  if (stuck) {
    return (
      <ActionZone touch note="แก้ปัญหาก่อน จึงทำขั้นนี้ต่อได้" icon={AlertTriangle} tone="error" menu={menu}>
        {boss ? (
          <Button variant="destructive" className="h-14 text-base">
            <Wrench /> ปลดปัญหา
          </Button>
        ) : null}
      </ActionZone>
    );
  }
  if (step.state === "todo") return <ActionZone touch note="ยังไม่ถึงคิว — ทำขั้นก่อนหน้าให้จบก่อน" icon={Clock} tone="neutral" menu={menu} />;
  return (
    <ActionZone touch note={step.state === "waiting" ? `ของอยู่ที่ ${step.outsource?.vendor} — กดเมื่อของกลับมา` : PLAIN_WHY[step.id]} icon={step.state === "waiting" ? Truck : MonitorSmartphone} tone="info" menu={menu}>
      <Button className="h-14 text-base">{PLAIN_ACTION[step.id] ?? step.action}</Button>
      {report}
    </ActionZone>
  );
}

export function OneAtATime({ steps, selected, boss, onSelect }: { steps: WorkStep[]; selected: WorkStep; boss: boolean; onSelect: (id: string) => void }) {
  const step = selected;
  const mode = modeOf(step);
  const done = step.state === "done";
  const paper = mode === "paper" && !done && step.state !== "blocked";
  const next = steps.find((s) => s.order > step.order && s.state !== "done");
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

      <StepRail steps={steps} selected={step.id} onSelect={onSelect} />

      <div className="card-surface grid gap-6 rounded-2xl p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* ซ้าย — เสื้อที่กำลังทำ */}
        <div>
          <p className="text-xs font-medium text-muted">ทำกับเสื้อ</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ITEMS.map((item) => (
              <figure key={item.id}>
                <BigMockup src={item.mockup} alt={`ม็อกอัพ ${item.color}`} className="aspect-square w-full" />
                <figcaption className="mt-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-strong">{item.color}</span>
                  <span className="tabular-nums text-secondary">{item.sizes.reduce((s, v) => s + v.qty, 0)} ตัว</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <InfoChipRow className="mt-3">
            {ITEMS[0]!.sizes.map((s) => (
              <InfoChip key={s.size} size="md">
                {s.size} <span className="font-semibold">{ITEMS.reduce((sum, it) => sum + (it.sizes.find((v) => v.size === s.size)?.qty ?? 0), 0)}</span>
              </InfoChip>
            ))}
          </InfoChipRow>
          <FactList columns={2} className="mt-4">
            {ITEMS[0]!.prints.map((p) => (
              <Fact key={p.position} size="sm" label={`${p.position} · ${p.technique}`} value={p.size} sub={p.note} />
            ))}
          </FactList>
        </div>

        {/* ขวา — ขั้นที่เปิด */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted">ขั้น {step.order} จาก {steps.length}</p>
              <h2 className="mt-0.5 text-2xl font-semibold text-strong">{step.label}</h2>
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
              <Fact icon={Truck} label="ร้าน" value={step.outsource.vendor} sub={`ส่งไป ${step.outsource.sentOn}`} />
              <div>
                <p className="text-xs font-medium text-muted">นัดรับกลับ</p>
                <InfoChip tone={step.outsource.backInDays < 0 ? "error" : "info"} strong={step.outsource.backInDays < 0} icon={CalendarCheck} className="mt-1">
                  {step.outsource.backInDays < 0 ? `เลยนัด ${Math.abs(step.outsource.backInDays)} วัน (${step.outsource.backLabel})` : `กลับ ${step.outsource.backLabel}`}
                </InfoChip>
              </div>
            </FactList>
          ) : null}

          {!done && !paper && mode === "screen" ? (
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

          <OneZone step={step} boss={boss} />

          {next ? (
            <p className="text-sm text-secondary">
              ถัดไป: <span className="font-medium text-strong">{next.label}</span>
              {next.owner ? ` · ${next.owner}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <Disclosure summary="ดูทั้งใบ (ตารางแบบกระดาษ)">
        <PaperSteps steps={steps} boss={boss} title="ขั้นตอนทั้งหมด" />
      </Disclosure>
    </div>
  );
}
