"use client";

/**
 * ชิ้นส่วนที่กำลังเทียบ: แท็บ "ขั้นงาน" ของใบผลิต — รายการขั้น (ซ้าย) · แถบใบสั่งงาน · ขั้นที่เลือก (ขวา)
 * โครง D (หัวใบ 4 ช่อง · แท็บ · 2 คอลัมน์) และแท็บอื่นอีก 3 แท็บ = ชิ้นส่วนเดิมจากหน้าลอง work-order ไม่แตะ
 * กรอบการ์ด/ชิป/ตัวเลข/โซนลงมือ/เมนู = component ตัวจริงทั้งหมด
 *
 *   ปัจจุบัน : เลียนของจริง 6 ก.ย. ทุกป้าย (ชิปโหมดจด · ชิปสถานี · "ตอนนี้: หลัง X → ก่อน Y" · ข้อกำหนดทุกขั้น · ปุ่ม "ผ่านแล้ว" กดไม่ได้)
 *   A ตัดออก : แถวละชิปเดียวเฉพาะขั้นที่มีอะไรเกิดขึ้น · ไม่มีชิปโหมด/สถานี · ขั้นที่ปิดแล้วเหลือบรรทัดเดียว
 *   B พับไว้  : รายการเหมือน A · ฝั่งขวาโซนลงมือขึ้นก่อน · ที่เหลือกดกาง "รายละเอียดของขั้นนี้"
 */

import { AlertTriangle, Check, CheckCircle2, ChevronRight, Clock, FileText, MonitorSmartphone, Package, Pencil, Printer, Shirt, Truck, UserRound, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Button } from "@/components/ui/button";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { Section } from "@/components/ui/section";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { ModeChip } from "../paper-first/_pieces";
import { OutsourceFacts, OwnerText, StepQty, StepStateChip } from "../work-order/_pieces";
import { AUTO_PLAIN, INFERRED, PAPER_PLAIN, PLAIN_ACTION, PLAIN_WHY, TICKET, modeOf, stationOf, type StationKey, type Variant, type WorkStep } from "./_data";

const noop = () => {};

const STATION_ICON: Record<StationKey, typeof Shirt> = { prep: Shirt, dtf: Printer, outsource: Truck, other: Wrench };

function isLive(step: WorkStep) {
  return step.state === "active" || step.state === "blocked" || step.state === "waiting";
}

/* ───────────────────────── กดกาง (B) ───────────────────────── */

function Disclosure({ summary, children, className }: { summary: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={cn("group", className)}>
      <summary className={cn(RADIUS.item, FOCUS_BUTTON, "flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-secondary transition-colors hover:text-strong [&::-webkit-details-marker]:hidden")}>
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        {summary}
      </summary>
      <div className="mt-3 space-y-4">{children}</div>
    </details>
  );
}

/* ───────────────────────── แถบใบสั่งงานเหนือรายการ ───────────────────────── */

function TicketStrip({ variant, boss, hasOutsource }: { variant: Variant; boss: boolean; hasOutsource: boolean }) {
  const print = boss ? (
    <Button variant="outline" size="sm" className="ml-auto">
      <Printer /> พิมพ์ใบสั่งงาน
    </Button>
  ) : null;

  if (variant === "now") {
    return (
      <div className="space-y-2 border-b border-divider px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-sm font-medium text-strong">ใบสั่งงานกระดาษ</span>
          <InfoChip size="sm" tone="success" icon={CheckCircle2}>
            ม็อกอัพอนุมัติ {TICKET.mockup}
          </InfoChip>
          {print}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InfoChip size="md" tone="info" strong icon={Clock}>
            ตอนนี้: {INFERRED.now}
          </InfoChip>
          <InfoChip size="md" icon={FileText}>
            {INFERRED.detail(hasOutsource)}
          </InfoChip>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-b border-divider px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="text-sm font-medium text-strong">ใบสั่งงาน</span>
        <span className="text-xs text-muted">
          พิมพ์ {TICKET.printedAt} · ม็อกอัพ {TICKET.mockup}
        </span>
        {print}
      </div>
      {variant === "fold" ? (
        <Disclosure summary="ระบบรู้ว่าอยู่ช่วงไหน">
          <InfoChipRow>
            <InfoChip size="md" tone="info" icon={Clock}>
              ตอนนี้: {INFERRED.now}
            </InfoChip>
            <InfoChip size="md" icon={FileText}>
              {INFERRED.detail(hasOutsource)}
            </InfoChip>
          </InfoChipRow>
        </Disclosure>
      ) : null}
    </div>
  );
}

/* ───────────────────────── รายการขั้น (ซ้าย) ───────────────────────── */

function NowRow({ step, on, onSelect }: { step: WorkStep; on: boolean; onSelect: () => void }) {
  const mode = modeOf(step);
  const st = stationOf(step);
  const Icon = STATION_ICON[st.key];
  const quiet = mode === "paper" && step.state !== "done" && step.state !== "blocked";
  return (
    <li>
      <button type="button" aria-pressed={on} onClick={onSelect} className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-interactive-hover", on && "bg-interactive-selected")}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium tabular-nums text-muted">{step.order}</span>
        <span className="min-w-0">
          <span className={cn("block truncate text-sm text-strong", on ? "font-semibold" : "font-medium")}>{step.label}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {quiet ? null : <StepStateChip step={step} />}
            <ModeChip mode={mode} />
            <InfoChip size="sm" icon={Icon}>
              {st.label}
            </InfoChip>
            {step.owner ? <InfoChip size="sm">{step.owner}</InfoChip> : null}
          </span>
        </span>
        {quiet ? <span className="text-xs text-secondary">ดูจากกระดาษ</span> : <StepQty step={step} />}
      </button>
    </li>
  );
}

/** A/B — แถวเงียบ: เลข (ผ่านแล้ว = ถูก) · ชื่อขั้น · ชิปสถานะเฉพาะขั้นที่มีอะไรเกิดขึ้น · ชื่อคนเป็นตัวหนังสือ */
function QuietRow({ step, on, onSelect }: { step: WorkStep; on: boolean; onSelect: () => void }) {
  const mode = modeOf(step);
  const done = step.state === "done";
  const paper = mode === "paper" && !done && step.state !== "blocked";
  const showChip = isLive(step) && !paper;
  return (
    <li>
      <button type="button" aria-pressed={on} onClick={onSelect} className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-interactive-hover", on && "bg-interactive-selected")}>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
            done ? "bg-green-600 text-white dark:bg-green-500" : isLive(step) ? "bg-surface-muted text-strong" : "text-muted ring-1 ring-inset ring-border",
          )}
          aria-label={done ? "ผ่านแล้ว" : undefined}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> : step.order}
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate text-sm", on ? "font-semibold" : "font-medium", step.state === "todo" ? "text-secondary" : "text-strong")}>{step.label}</span>
          {showChip || step.owner ? (
            <span className="mt-1 flex flex-wrap items-center gap-2">
              {showChip ? <StepStateChip step={step} /> : null}
              {step.owner ? (
                <span className="inline-flex items-center gap-1 text-xs text-secondary">
                  <UserRound className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  {step.owner}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        {paper ? <span className="text-xs text-muted">ดูจากกระดาษ</span> : <StepQty step={step} />}
      </button>
    </li>
  );
}

export function StepList({ variant, steps, selected, boss, onSelect }: { variant: Variant; steps: WorkStep[]; selected: string; boss: boolean; onSelect: (id: string) => void }) {
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <Section title="ขั้นงานทั้งหมด" meta={`${done}/${steps.length} ผ่านแล้ว`} icon={Wrench} tone="production" flush>
      <TicketStrip variant={variant} boss={boss} hasOutsource={steps.some((s) => s.kind === "outsource")} />
      <ol className="divide-y divide-divider">
        {steps.map((step) =>
          variant === "now" ? (
            <NowRow key={step.id} step={step} on={step.id === selected} onSelect={() => onSelect(step.id)} />
          ) : (
            <QuietRow key={step.id} step={step} on={step.id === selected} onSelect={() => onSelect(step.id)} />
          ),
        )}
      </ol>
    </Section>
  );
}

/* ───────────────────────── ขั้นที่เลือก (ขวา) ───────────────────────── */

const FIX_ITEMS: Omit<MoreMenuItem, "onSelect">[] = [
  { key: "edit", label: "บันทึกรายละเอียด", hint: "แก้ยอด หมายเหตุ และเวลาของขั้นนี้", icon: Pencil },
  { key: "qty", label: "แก้ยอดที่บันทึก", icon: Wrench },
  { key: "owner", label: "เปลี่ยนคนทำ", icon: UserRound },
  { key: "hold", label: "พักงานนี้ไว้ก่อน", icon: Clock },
  { key: "pass", label: "ผ่านขั้นนี้แทนช่าง", icon: CheckCircle2, danger: true },
];
const PAPER_DONE_ITEM: Omit<MoreMenuItem, "onSelect"> = { key: "paper-done", label: "จดว่าเสร็จแล้ว (จากกระดาษ)", hint: "ใส่ตามที่ช่างเขียนไว้ — ไม่บังคับ", icon: FileText };

function Standards({ step, onPaper, title = "ข้อกำหนดมาตรฐานของขั้นนี้" }: { step: WorkStep; onPaper: boolean; title?: string }) {
  return (
    <div>
      <p className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{title}</span>
        {onPaper ? <span>ช่องติ๊กอยู่บนใบสั่งงาน</span> : null}
      </p>
      <ul className="mt-1.5 space-y-1">
        {step.checklist.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-strong">{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function zoneOf(variant: Variant, step: WorkStep, boss: boolean) {
  const mode = modeOf(step);
  const done = step.state === "done";
  const stuck = step.state === "blocked";
  const paper = mode === "paper" && !done && !stuck;
  const menu = boss && !done ? <MoreMenu items={[...(paper ? [PAPER_DONE_ITEM] : []), ...FIX_ITEMS].map((item) => ({ ...item, onSelect: noop }))} /> : null;
  const report =
    !done && !stuck ? (
      <Button variant="ghost">
        <AlertTriangle /> แจ้งปัญหา
      </Button>
    ) : null;
  return { mode, done, stuck, paper, menu, report };
}

/** ปัจจุบัน — ก๊อปจากของจริง 6 ก.ย. (work-order-page.tsx StepDetail) */
function NowDetail({ step, boss }: { step: WorkStep; boss: boolean }) {
  const { mode, done, stuck, paper, menu, report } = zoneOf("now", step, boss);
  const st = stationOf(step);
  const Icon = STATION_ICON[st.key];
  const note = done
    ? `ปิดขั้นแล้ว ${step.completedAt} · โดย ${step.owner}`
    : stuck
      ? "แก้ปัญหาก่อน จึงลงมือขั้นนี้ต่อได้"
      : step.state === "waiting"
        ? `ร้านนอก: ${step.outsource?.vendor}`
        : paper
          ? "ขั้นนี้จดบนใบสั่งงาน — ช่างติ๊กข้อกำหนด เขียนยอด ลงชื่อบนกระดาษ · ระบบจะถือว่าผ่านตอนส่งเข้า QC"
          : mode === "auto"
            ? "ปิดรอบพิมพ์ PR-2608-014 แล้ว — ขั้นนี้ผ่านเองจากรอบพิมพ์"
            : step.state === "todo"
              ? "ยังไม่ถึงคิวขั้นนี้ — ทำขั้นก่อนหน้าให้จบก่อน"
              : (PLAIN_WHY[step.id] ?? "พร้อมลงมือ — ทำครบข้อกำหนดแล้วค่อยกดปุ่ม");
  const primary = done ? (
    <Button variant="outline" disabled>
      ผ่านแล้ว
    </Button>
  ) : stuck ? (
    boss ? (
      <Button variant="destructive">
        <Wrench /> ปลดปัญหา / เปลี่ยนคน
      </Button>
    ) : (
      <Button variant="outline" disabled>
        รอหัวหน้าจัดการ
      </Button>
    )
  ) : paper || mode === "auto" || step.state === "todo" ? null : (
    <Button>{PLAIN_ACTION[step.id] ?? step.action}</Button>
  );

  return (
    <Section
      title={step.label}
      meta={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {paper ? null : <StepStateChip step={step} size="md" />}
          <ModeChip mode={mode} size="md" />
          <InfoChip size="md" icon={Icon}>
            {st.label}
          </InfoChip>
        </span>
      }
      action={<OwnerText step={step} />}
      tone="production"
    >
      <div className="space-y-5">
        <FactList columns={3}>
          <div>
            <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
          </div>
          <Fact label="เริ่มเมื่อ" value={step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
          <Fact label="เสร็จเมื่อ" value={step.completedAt ?? "ยังไม่เสร็จ"} tone={step.completedAt ? "success" : "muted"} />
        </FactList>
        {step.outsource ? <OutsourceFacts step={step} /> : null}
        {mode === "auto" ? (
          <InfoChip tone="info" strong>
            อยู่ในรอบพิมพ์ PR-2608-014
          </InfoChip>
        ) : null}
        {step.note ? <p className="text-sm text-secondary">{step.note}</p> : null}
        <Standards step={step} onPaper={mode === "paper"} />
        <ActionZone note={note} icon={done ? CheckCircle2 : stuck ? AlertTriangle : paper ? FileText : primary ? MonitorSmartphone : Clock} tone={done ? "success" : stuck ? "error" : primary ? "info" : "neutral"} menu={menu}>
          {primary}
          {report}
        </ActionZone>
      </div>
    </Section>
  );
}

/** โซนลงมือของ A/B — ประโยคภาษาโรงงาน · ขั้นที่ปิดแล้วไม่มีโซน */
function QuietZone({ step, boss, zone }: { step: WorkStep; boss: boolean; zone: ReturnType<typeof zoneOf> }) {
  const { mode, done, stuck, paper, menu, report } = zone;
  if (done) return null;
  if (paper) {
    return (
      <ActionZone note={PAPER_PLAIN} icon={FileText} tone="neutral" menu={menu}>
        {report}
      </ActionZone>
    );
  }
  if (mode === "auto") return <ActionZone note={AUTO_PLAIN} icon={Printer} tone="success" />;
  if (stuck) {
    return (
      <ActionZone note="แก้ปัญหาก่อน จึงทำขั้นนี้ต่อได้" icon={AlertTriangle} tone="error" menu={menu}>
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
      <ActionZone note="ยังไม่ถึงคิว — ทำขั้นก่อนหน้าให้จบก่อน" icon={Clock} tone="neutral" menu={menu}>
        {report}
      </ActionZone>
    );
  }
  return (
    <ActionZone note={step.state === "waiting" ? `ของอยู่ที่ ${step.outsource?.vendor} — กดเมื่อของกลับมา` : PLAIN_WHY[step.id]} icon={step.state === "waiting" ? Truck : MonitorSmartphone} tone="info" menu={menu}>
      <Button>{PLAIN_ACTION[step.id] ?? step.action}</Button>
      {report}
    </ActionZone>
  );
}

/** A · ตัดออก */
function CutDetail({ step, boss }: { step: WorkStep; boss: boolean }) {
  const zone = zoneOf("cut", step, boss);
  const { mode, done, paper } = zone;
  return (
    <Section title={step.label} meta={isLive(step) && !paper ? <StepStateChip step={step} size="md" /> : undefined} action={<OwnerText step={step} />} tone="production">
      <div className="space-y-5">
        {done ? (
          <FactList columns={2}>
            <div>
              <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone="success" />
            </div>
            <Fact icon={CheckCircle2} label="ปิดขั้นเมื่อ" value={step.completedAt ?? "—"} sub={step.owner ? `โดย ${step.owner}` : undefined} tone="success" />
          </FactList>
        ) : paper ? (
          <FactList columns={2}>
            <Fact label="ควรเสร็จ" value={step.planEnd} />
            <Fact icon={FileText} label="ยอดและเวลา" value="บนใบสั่งงาน" sub="ช่างเขียนตอนทำ" />
          </FactList>
        ) : (
          <FactList columns={3}>
            <div>
              <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
            </div>
            <Fact label="ควรเสร็จ" value={step.planEnd} />
            <Fact label="เริ่มเมื่อ" value={step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
          </FactList>
        )}
        {step.outsource && !done ? <OutsourceFacts step={step} /> : null}
        {step.note && !paper ? <p className="text-sm text-secondary">{step.note}</p> : null}
        {!done && mode === "screen" && step.state !== "waiting" ? <Standards step={step} onPaper={false} title="ก่อนกดปุ่ม ทำให้ครบ" /> : null}
        <QuietZone step={step} boss={boss} zone={zone} />
      </div>
    </Section>
  );
}

/** B · พับไว้ — โซนลงมือขึ้นก่อน · ที่เหลือกดกาง */
function FoldDetail({ step, boss }: { step: WorkStep; boss: boolean }) {
  const zone = zoneOf("fold", step, boss);
  const { mode, done, paper } = zone;
  const st = stationOf(step);
  const Icon = STATION_ICON[st.key];
  return (
    <Section title={step.label} meta={isLive(step) && !paper ? <StepStateChip step={step} size="md" /> : undefined} action={<OwnerText step={step} />} tone="production">
      <div className="space-y-5">
        <QuietZone step={step} boss={boss} zone={zone} />
        {done ? (
          <FactList columns={2}>
            <div>
              <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone="success" />
            </div>
            <Fact icon={CheckCircle2} label="ปิดขั้นเมื่อ" value={step.completedAt ?? "—"} sub={step.owner ? `โดย ${step.owner}` : undefined} tone="success" />
          </FactList>
        ) : paper ? (
          <FactList columns={2}>
            <Fact label="ควรเสร็จ" value={step.planEnd} />
            <Fact icon={FileText} label="ยอดและเวลา" value="บนใบสั่งงาน" sub="ช่างเขียนตอนทำ" />
          </FactList>
        ) : (
          <FactList columns={3}>
            <div>
              <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
            </div>
            <Fact label="ควรเสร็จ" value={step.planEnd} />
            <Fact label="เริ่มเมื่อ" value={step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
          </FactList>
        )}
        {step.outsource && !done ? <OutsourceFacts step={step} /> : null}
        {step.note && !paper ? <p className="text-sm text-secondary">{step.note}</p> : null}
        <Disclosure summary="รายละเอียดของขั้นนี้">
          <InfoChipRow>
            <ModeChip mode={mode} size="md" />
            <InfoChip size="md" icon={Icon}>
              สถานี: {st.label}
            </InfoChip>
            {mode === "auto" ? (
              <InfoChip size="md" tone="info" icon={Package}>
                รอบพิมพ์ PR-2608-014
              </InfoChip>
            ) : null}
          </InfoChipRow>
          {mode === "screen" && PLAIN_WHY[step.id] ? <p className="text-sm text-secondary">ทำไมต้องจดในระบบ: {PLAIN_WHY[step.id]}</p> : null}
          <Standards step={step} onPaper={mode === "paper"} />
          <FactList columns={2}>
            <Fact label="เริ่มเมื่อ" value={step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
            <Fact label="เสร็จเมื่อ" value={step.completedAt ?? "ยังไม่เสร็จ"} tone={step.completedAt ? "success" : "muted"} />
          </FactList>
        </Disclosure>
      </div>
    </Section>
  );
}

export function StepDetail({ variant, step, boss }: { variant: Variant; step: WorkStep; boss: boolean }) {
  if (variant === "now") return <NowDetail key={step.id} step={step} boss={boss} />;
  if (variant === "cut") return <CutDetail key={step.id} step={step} boss={boss} />;
  return <FoldDetail key={step.id} step={step} boss={boss} />;
}

export const TAB_LABELS: Record<Variant, { make: string; info: string }> = {
  now: { make: "ทำอะไร", info: "ข้อมูลใบ" },
  cut: { make: "สินค้าและลาย", info: "รายละเอียดใบ" },
  fold: { make: "สินค้าและลาย", info: "รายละเอียดใบ" },
};
