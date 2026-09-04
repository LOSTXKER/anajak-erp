"use client";

/**
 * ชิ้นส่วนที่กำลังเทียบ: (1) ใบผลิตแท็บขั้นงาน — ขั้นไหนต้องกดจอ ขั้นไหนเดินตามกระดาษ
 *                        (2) ใบสั่งงานกระดาษ — ช่องอะไรอยู่บนกระดาษ
 * กรอบการ์ด/ชิป/ตัวเลข/โซนลงมือ/เมนู/ช่องกรอก = component ตัวจริงทั้งหมด
 * ใบกระดาษวาดเองเพราะของจริง (/print/job-ticket) เป็น server component ที่อ่าน DB — ใช้คลาส `print-page` ชุดเดียวกัน
 */

import { AlertTriangle, CheckCircle2, ClipboardList, Clock, FileText, MonitorSmartphone, Pencil, Printer, Square, UserRound, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Button } from "@/components/ui/button";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Input } from "@/components/ui/input";
import { Metric } from "@/components/ui/metric";
import { MoreMenu, type MoreMenuItem } from "@/components/ui/more-menu";
import { Section } from "@/components/ui/section";
import { DocumentStamp } from "@/components/print/print-document";
import { DASHED, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { OutsourceFacts, OwnerText, ProblemCard, StepQty, StepStateChip } from "../work-order/_pieces";
import { AUTO_NOTE, BATCH_NOTE, ITEMS, MODE_LABEL, PAPER_NOTE, PRINT_RUN, QR_SVG, SCREEN_ACTION, WHY_SCREEN, WORK_ORDER, modeOf, requiredTaps, totalTaps, type RecordMode, type Variant, type WorkStep } from "./_data";

const noop = () => {};

/* ───────────────────────── ตัวเลขที่ต้องเห็นก่อนตัดสิน (ชั้น 1) ───────────────────────── */

export function TapSummary({ variant, steps }: { variant: Variant; steps: WorkStep[] }) {
  const taps = totalTaps(variant, steps);
  const knows: string[] =
    variant === "now"
      ? ["ทุกขั้นเริ่ม/จบ", "ถ้าช่างกดจริง"]
      : variant === "three"
        ? ["DTF เสร็จ", "ผล QC", "แพ็กเสร็จ", "ของไป/กลับร้านนอก"]
        : ["ตอนหัวหน้ากรอกปิดวัน", "ช้าครึ่งวัน"];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="card-surface rounded-2xl p-4">
        <Metric label="ช่างแตะจอต่อใบ" value={taps} unit="ครั้ง" size="lg" icon={MonitorSmartphone} tone={taps === 0 ? "muted" : "default"} />
      </div>
      <div className="card-surface rounded-2xl p-4">
        {variant === "batch" ? (
          <Metric label="หัวหน้ากรอกทีหลัง" value={1} unit={`ฟอร์ม/ใบ · ${steps.length} แถว`} size="lg" icon={ClipboardList} tone="warning" />
        ) : (
          <Metric label="หัวหน้ากรอกทีหลัง" value="ไม่มี" size="lg" icon={ClipboardList} tone="muted" />
        )}
      </div>
      <div className="card-surface rounded-2xl p-4 lg:col-span-2">
        {/* Fact วางค่าใน <p> — แถวชิปเป็น div จึงวางเองแบบช่อง "กำหนดส่ง" ในใบผลิตจริง */}
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Clock className="h-4 w-4" aria-hidden="true" /> ระบบรู้ทันทีเมื่อ
        </p>
        <InfoChipRow className="mt-2">
          {knows.map((k) => (
            <InfoChip key={k} size="md" tone={variant === "batch" ? "warning" : "info"} strong={variant !== "now"}>
              {k}
            </InfoChip>
          ))}
        </InfoChipRow>
      </div>
    </div>
  );
}

/* ───────────────────────── ชิปบอกว่าขั้นนี้บันทึกที่ไหน (ทาง A) ───────────────────────── */

const MODE_ICON = { screen: MonitorSmartphone, paper: FileText, auto: Printer } as const;
const MODE_TONE = { screen: "info", paper: "neutral", auto: "success" } as const;

export function ModeChip({ mode, size = "sm" }: { mode: RecordMode; size?: "sm" | "md" }) {
  return (
    <InfoChip size={size} tone={MODE_TONE[mode]} strong={mode === "screen"} icon={MODE_ICON[mode]}>
      {MODE_LABEL[mode]}
    </InfoChip>
  );
}

/* ───────────────────────── รายการขั้น (ซ้าย) ───────────────────────── */

export function StepList({ variant, steps, selected, onSelect }: { variant: Variant; steps: WorkStep[]; selected: string; onSelect: (id: string) => void }) {
  const done = steps.filter((s) => s.state === "done").length;
  const screenCount = steps.filter((s) => modeOf(variant, s) === "screen").length;
  return (
    <Section
      title="ขั้นงานทั้งหมด"
      meta={variant === "three" ? `จดในระบบ ${screenCount} จุด · ${steps.length} ขั้น` : `${done}/${steps.length} ผ่านแล้ว`}
      icon={Wrench}
      tone="production"
      flush
    >
      <ol className="divide-y divide-divider">
        {steps.map((step) => {
          const on = step.id === selected;
          const mode = modeOf(variant, step);
          const quiet = variant === "three" && mode === "paper";
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(step.id)}
                className={cn(
                  "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-interactive-hover",
                  on && "bg-interactive-selected",
                )}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums", quiet ? "bg-transparent text-muted ring-1 ring-inset ring-border" : "bg-surface-muted text-muted")}>
                  {step.order}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm", on ? "font-semibold" : "font-medium", quiet ? "text-secondary" : "text-strong")}>{step.label}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {variant === "three" ? <ModeChip mode={mode} /> : <StepStateChip step={step} />}
                    {variant === "three" && mode === "screen" ? <StepStateChip step={step} /> : null}
                    {variant === "batch" && step.state !== "done" ? (
                      <InfoChip size="sm" icon={ClipboardList}>
                        กรอกจากกระดาษ
                      </InfoChip>
                    ) : null}
                    {step.owner && !quiet ? <InfoChip size="sm">{step.owner}</InfoChip> : null}
                    {step.problem && !quiet ? (
                      <InfoChip size="sm" tone="error" strong>
                        มีปัญหา
                      </InfoChip>
                    ) : null}
                  </span>
                </span>
                {quiet ? <span className="text-xs text-muted">บนกระดาษ</span> : <StepQty step={step} />}
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ───────────────────────── ขั้นที่เลือก + โซนลงมือ (ขวา) ───────────────────────── */

const FIX_ITEMS: Omit<MoreMenuItem, "onSelect">[] = [
  { key: "edit", label: "บันทึกรายละเอียด", hint: "แก้ยอด หมายเหตุ และเวลาของขั้นนี้", icon: Pencil },
  { key: "qty", label: "แก้ยอดที่บันทึก", icon: Wrench },
  { key: "owner", label: "เปลี่ยนคนทำ", icon: UserRound },
  { key: "hold", label: "พักงานนี้ไว้ก่อน", icon: Clock },
  { key: "pass", label: "ผ่านขั้นนี้แทนช่าง", icon: CheckCircle2, danger: true },
];

function Standards({ step, onPaper }: { step: WorkStep; onPaper: boolean }) {
  return (
    <div>
      <p className="flex items-center justify-between text-xs font-medium text-muted">
        <span>ข้อกำหนดมาตรฐานของขั้นนี้</span>
        {onPaper ? <span>พิมพ์เป็นช่องติ๊กบนกระดาษ</span> : null}
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

function TapHint({ variant, step }: { variant: Variant; step: WorkStep }) {
  const taps = requiredTaps(variant, step);
  if (taps.length === 0) return <p className="text-xs text-muted">ช่างไม่ต้องแตะจอในขั้นนี้</p>;
  return (
    <p className="text-xs text-muted">
      ช่างแตะจอในขั้นนี้ {taps.length} ครั้ง: {taps.join(" → ")}
    </p>
  );
}

export function StepDetail({ variant, step, boss, onOpenForm }: { variant: Variant; step: WorkStep; boss: boolean; onOpenForm: () => void }) {
  const mode = modeOf(variant, step);
  const done = step.state === "done";
  const stuck = step.state === "blocked";
  const menu = boss && !done ? <MoreMenu items={FIX_ITEMS.map((item) => ({ ...item, onSelect: noop }))} /> : null;
  const report = !done && !stuck ? (
    <Button variant="ghost">
      <AlertTriangle /> แจ้งปัญหา
    </Button>
  ) : null;

  let zone: React.ReactNode;
  if (variant === "three" && mode === "paper") {
    zone = (
      <ActionZone note={PAPER_NOTE} icon={FileText} tone="neutral" menu={menu}>
        <Button variant="outline">จดเวลาเสร็จ (ไม่บังคับ)</Button>
        {report}
      </ActionZone>
    );
  } else if (variant === "three" && mode === "auto") {
    zone = <ActionZone note={AUTO_NOTE} icon={Printer} tone="success" />;
  } else if (variant === "three") {
    const primary = SCREEN_ACTION[step.id] ?? step.action;
    zone = (
      <ActionZone note={WHY_SCREEN[step.id] ?? "จุดที่ระบบต้องรู้"} icon={MonitorSmartphone} tone={stuck ? "error" : "info"} menu={menu}>
        <Button variant={stuck ? "destructive" : "default"}>{primary}</Button>
        {report}
      </ActionZone>
    );
  } else if (variant === "batch") {
    zone = (
      <ActionZone note={BATCH_NOTE} icon={ClipboardList} tone="neutral" menu={menu}>
        {boss && !done ? (
          <Button onClick={onOpenForm}>
            <ClipboardList /> กรอกจากกระดาษ
          </Button>
        ) : null}
      </ActionZone>
    );
  } else {
    // ปัจจุบัน — โซนลงมือแบบ A ที่เบสเคาะ 09-03: ประโยคสถานะบน แล้วปุ่มหลัก 1 กับแจ้งปัญหาและเมนูเพิ่มเติม
    const note = done
      ? `ปิดขั้นแล้ว ${step.completedAt} · โดย ${step.owner}`
      : stuck
        ? "แก้ปัญหาก่อน จึงลงมือขั้นนี้ต่อได้"
        : step.state === "todo"
          ? "ยังไม่ถึงคิวขั้นนี้ — ทำขั้นก่อนหน้าให้จบก่อน"
          : step.state === "waiting"
            ? `รอของกลับจาก ${step.outsource?.vendor ?? "ร้านนอก"}`
            : "พร้อมลงมือ — ทำครบข้อกำหนดแล้วค่อยกดปุ่ม";
    const primary = done || step.state === "todo" ? null : stuck ? (boss ? "ปลดปัญหา / เปลี่ยนคน" : null) : step.action;
    zone = (
      <ActionZone note={note} icon={done ? CheckCircle2 : stuck ? AlertTriangle : primary ? Wrench : Clock} tone={done ? "success" : stuck ? "error" : primary ? "info" : "neutral"} menu={menu}>
        {primary ? <Button variant={stuck ? "destructive" : "default"}>{primary}</Button> : null}
        {report}
      </ActionZone>
    );
  }

  const quietFacts = variant === "three" && mode === "paper";
  return (
    <Section
      title={`ขั้น ${step.order} · ${step.label}`}
      meta={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {variant === "three" ? <ModeChip mode={mode} size="md" /> : null}
          {!quietFacts ? <StepStateChip step={step} size="md" /> : null}
        </span>
      }
      action={quietFacts ? <span className="text-muted">คนทำอยู่บนกระดาษ</span> : <OwnerText step={step} />}
      tone="production"
    >
      <div className="space-y-5">
        {step.problem && !quietFacts ? <ProblemCard step={step} /> : null}
        {quietFacts ? (
          <FactList columns={2}>
            <Fact icon={FileText} label="บันทึกที่" value="กระดาษใบงาน" sub="ยอดดี/เสีย เวลา และลงชื่อ" />
            <Fact label="ควรเสร็จ" value={step.planEnd} />
          </FactList>
        ) : (
          <FactList columns={3}>
            <div>
              <Metric label="ทำแล้ว" value={step.qtyDone.toLocaleString("th-TH")} unit={`/ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qtyDone >= step.qtyTotal ? "success" : "default"} />
            </div>
            <Fact label="ควรเสร็จ" value={step.planEnd} />
            <Fact label={step.completedAt ? "เสร็จจริง" : "เริ่มเมื่อ"} value={step.completedAt ?? step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
          </FactList>
        )}
        {step.outsource && !quietFacts ? <OutsourceFacts step={step} /> : null}
        {variant === "three" && mode === "auto" ? (
          <InfoChip tone="info" strong icon={Printer}>
            อยู่ในรอบพิมพ์ {PRINT_RUN}
          </InfoChip>
        ) : null}
        {step.note && !quietFacts ? <p className="text-sm text-secondary">{step.note}</p> : null}
        <Standards step={step} onPaper={variant !== "now"} />
        {zone}
        <TapHint variant={variant} step={step} />
      </div>
    </Section>
  );
}

/* ───────────────────────── B · ฟอร์มกรอกจากกระดาษ (หัวหน้า) ───────────────────────── */

export function BatchForm({ steps, onClose }: { steps: WorkStep[]; onClose: () => void }) {
  return (
    <Section title={`กรอกจากกระดาษ — ${WORK_ORDER.orderNumber}`} meta={`${steps.length} ขั้น · ช่องว่าง = ยังไม่ถึง`} icon={ClipboardList} tone="production" action={<Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className={TABLE_HEAD_SURFACE}>
            <tr className="text-left text-xs font-medium">
              <th className="pb-2 pr-3 font-medium">ขั้น</th>
              <th className="w-40 pb-2 pr-3 font-medium">เสร็จวันที่</th>
              <th className="w-24 pb-2 pr-3 font-medium">ยอดดี</th>
              <th className="w-24 pb-2 pr-3 font-medium">ยอดเสีย</th>
              <th className="w-32 pb-2 font-medium">คนทำ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {steps.map((step) => {
              const filled = step.state === "done";
              return (
                <tr key={step.id}>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-strong">{step.order}. {step.label}</span>
                    {filled ? <span className="ml-2 text-xs text-muted">กรอกแล้ว</span> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <Input type="date" defaultValue={filled ? "2026-08-28" : ""} aria-label={`เสร็จวันที่ ${step.label}`} />
                  </td>
                  <td className="py-2 pr-3">
                    <Input type="number" inputMode="numeric" defaultValue={filled ? step.qtyTotal : step.qtyDone || ""} aria-label={`ยอดดี ${step.label}`} />
                  </td>
                  <td className="py-2 pr-3">
                    <Input type="number" inputMode="numeric" defaultValue={filled ? 0 : ""} aria-label={`ยอดเสีย ${step.label}`} />
                  </td>
                  <td className="py-2">
                    <Input defaultValue={step.owner ?? ""} aria-label={`คนทำ ${step.label}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ActionZone className="mt-4" note="กรอกจากกระดาษที่ช่างเซ็นแล้ว — ระบบจะบันทึกทุกขั้นเป็นเวลาที่กรอก ไม่ใช่เวลาที่ทำจริง" icon={ClipboardList} tone="neutral">
        <Button>บันทึกทั้งใบ</Button>
      </ActionZone>
    </Section>
  );
}

/* ───────────────────────── ใบสั่งงานกระดาษ ───────────────────────── */

function Blank({ w = "w-16" }: { w?: string }) {
  return <span className={cn("inline-block border-b border-slate-400 align-baseline", w)}>&nbsp;</span>;
}

function TickBoxes({ step }: { step: WorkStep }) {
  return (
    <ul className="space-y-0.5">
      {step.checklist.map((c) => (
        <li key={c.label} className="flex items-start gap-1 text-2xs leading-tight">
          <Square className="mt-px h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
          <span>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function PaperTicket({ variant, steps }: { variant: Variant; steps: WorkStep[] }) {
  const prints = ITEMS[0]!.prints;
  return (
    <div className="overflow-x-auto rounded-2xl bg-[#e9e9ec] p-3 sm:p-6">
      {/* กระดาษเป็นกระดาษทุกธีม — ล็อก token ข้อความรอง/เส้นคั่นให้เป็นเทาเอกสาร (print-page ของจริงล็อกเฉพาะ slate) */}
      <div className="print-page" style={{ width: "100%", maxWidth: "210mm", minHeight: 0, padding: "18px 20px 16px", "--color-secondary": "#3f3f44", "--color-divider": "#cbcbd0", "--color-muted": "#6e6e73" } as React.CSSProperties}>
        {/* หัวใบ — เหมือนของจริง */}
        <div className="flex items-start justify-between gap-4 border-b-4 border-slate-900 pb-3">
          <div>
            <div className="mb-2">
              <DocumentStamp title="ใบสั่งงาน" label="Production document" code="JT" />
            </div>
            <p className="text-xs font-semibold tracking-wide text-slate-500">ใบสั่งงาน / JOB TICKET</p>
            <p className="text-2xl font-bold leading-tight tabular-nums">{WORK_ORDER.orderNumber}</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 rounded border-2 border-red-600 px-2.5 py-1 text-sm font-bold text-red-600">สำคัญ</span>
            <div className="text-center">
              <div className="h-[92px] w-[92px]" dangerouslySetInnerHTML={{ __html: QR_SVG }} />
              <p className="mt-0.5 text-2xs text-slate-500">{variant === "now" ? "สแกนเปิดออเดอร์" : "สแกนเปิดใบผลิต"}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded border border-slate-300 px-4 py-2.5 sm:grid-cols-4">
          <MetaCell label="ลูกค้า" value={WORK_ORDER.company} />
          <MetaCell label="ช่องทาง" value={WORK_ORDER.channel} />
          <MetaCell label="วันเปิดงาน" value="26 สิงหาคม 2569" />
          <MetaCell label="กำหนดส่ง" value="3 กันยายน 2569" strong />
          <MetaCell label="ผู้เปิดงาน" value="เบส" />
          <MetaCell label="ความเร่งด่วน" value="สำคัญ" />
          <MetaCell label="จำนวนรวม" value={`${WORK_ORDER.qty} ตัว`} strong />
          <MetaCell label="สูตรขั้นงาน" value={WORK_ORDER.routingName} />
        </div>

        <div className="mt-3 rounded border border-slate-300 px-4 py-2.5">
          <p className="text-2xs text-slate-500">
            ม็อกอัพอนุมัติล่าสุด — เวอร์ชัน {WORK_ORDER.approvedMockup.version} (อนุมัติ {WORK_ORDER.approvedMockup.approvedOn} โดย {WORK_ORDER.approvedMockup.by})
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ITEMS.map((item) => (
              <figure key={item.id} className="max-w-[32%]">
                {/* eslint-disable-next-line @next/next/no-img-element -- หน้าลองใช้ไฟล์ตัวอย่างใน /public ตรง ๆ */}
                <img src={item.mockup} alt={`ม็อกอัพ ${item.color}`} className="max-h-28 rounded border border-slate-200 bg-white object-contain" />
                <figcaption className="mt-0.5 text-center text-2xs font-semibold text-slate-600">{item.color}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        {ITEMS.map((item, idx) => (
          <div key={item.id} className="mt-3 rounded border border-slate-400">
            <div className="border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-bold">
              รายการ {idx + 1} — {item.product} {item.color}
              <span className="float-right font-semibold">{item.sizes.reduce((s, v) => s + v.qty, 0)} ตัว</span>
            </div>
            <div className="px-3 py-2">
              <table className="w-auto border-collapse text-xs tabular-nums">
                <tbody>
                  <tr>
                    {item.sizes.map((v) => (
                      <td key={v.size} className="border border-slate-300 px-2.5 py-0.5 text-center">
                        <span className="font-semibold">{v.size}</span>
                        <span className="ml-1.5 font-bold">× {v.qty}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <table className="mt-3 w-full border-collapse text-xs">
          <thead className={TABLE_HEAD_SURFACE}>
            <tr className="border-y border-slate-400 text-left">
              <th className="py-1 pr-2 font-semibold">ตำแหน่ง</th>
              <th className="py-1 pr-2 font-semibold">วิธีพิมพ์</th>
              <th className="py-1 pr-2 font-semibold">ขนาด</th>
              <th className="py-1 font-semibold">หมายเหตุแบบ</th>
            </tr>
          </thead>
          <tbody>
            {prints.map((pr) => (
              <tr key={pr.position} className="border-b border-slate-200 align-top">
                <td className="py-1 pr-2 font-semibold">{pr.position}</td>
                <td className="py-1 pr-2">{pr.technique}</td>
                <td className="py-1 pr-2">{pr.size}</td>
                <td className="py-1">{pr.note ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ตารางขั้นตอน — ส่วนที่ต่างกันในแต่ละทาง */}
        <div className="mt-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold">ขั้นตอนผลิต</p>
            {variant === "three" ? (
              <p className="flex items-center gap-1 text-2xs text-slate-600">
                <MonitorSmartphone className="h-3 w-3" aria-hidden="true" /> แถวที่มีเครื่องหมายนี้ ต้องบันทึกในระบบด้วย · ที่เหลือจดบนใบนี้พอ
              </p>
            ) : null}
          </div>
          {variant === "now" ? (
            <table className="w-full border-collapse text-xs">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="border-y border-slate-400 text-left">
                  <th className="w-8 py-1 pr-2 text-center font-semibold">#</th>
                  <th className="py-1 pr-2 font-semibold">ขั้นตอน</th>
                  <th className="w-28 py-1 pr-2 font-semibold">ผู้รับผิดชอบ</th>
                  <th className="w-28 py-1 pr-2 font-semibold">เสร็จวันที่</th>
                  <th className="w-24 py-1 font-semibold">ลงชื่อ</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step) => (
                  <tr key={step.id} className="border-b border-slate-200">
                    <td className="py-2 pr-2 text-center text-slate-500">{step.order}</td>
                    <td className="py-2 pr-2">
                      {step.label}
                      {step.outsource ? ` (outsource: ${step.outsource.vendor})` : ""}
                    </td>
                    <td className="py-2 pr-2">{step.owner ?? ""}</td>
                    <td className="py-2 pr-2 text-slate-300">____ / ____ / ____</td>
                    <td className="py-2 text-slate-300">______________</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="border-y border-slate-400 text-left">
                  <th className="w-8 py-1 pr-2 text-center font-semibold">#</th>
                  <th className="py-1 pr-2 font-semibold">ขั้นตอน</th>
                  <th className="py-1 pr-2 font-semibold">ข้อกำหนด (ติ๊กเมื่อทำแล้ว)</th>
                  <th className="w-24 py-1 pr-2 font-semibold">ยอดดี / เสีย</th>
                  <th className="w-24 py-1 pr-2 font-semibold">เสร็จ</th>
                  <th className="w-20 py-1 font-semibold">ลงชื่อ</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step) => {
                  const mode = modeOf(variant, step);
                  const screen = variant === "three" && mode === "screen";
                  const auto = variant === "three" && mode === "auto";
                  return (
                    <tr key={step.id} className={cn("border-b border-slate-200 align-top", screen && "bg-slate-100")}>
                      <td className="py-2 pr-2 text-center text-slate-500">{step.order}</td>
                      <td className="py-2 pr-2">
                        <p className="font-semibold leading-tight">{step.label}</p>
                        {step.outsource ? <p className="text-2xs text-slate-600">{step.outsource.vendor}</p> : null}
                        {screen ? (
                          <p className="mt-1 inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-2xs font-bold">
                            <MonitorSmartphone className="h-3 w-3" aria-hidden="true" /> จดในระบบ
                          </p>
                        ) : null}
                        {auto ? <p className="mt-1 text-2xs text-slate-500">ผ่านเองเมื่อปิดรอบพิมพ์ — ไม่ต้องเซ็น</p> : null}
                      </td>
                      <td className="py-2 pr-2">{auto ? <span className="text-slate-400">—</span> : <TickBoxes step={step} />}</td>
                      <td className="py-2 pr-2 text-slate-500">
                        {auto ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <>
                            <Blank w="w-8" /> / <Blank w="w-8" />
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-slate-300">{auto ? "" : "___ / ___"}</td>
                      <td className="py-2 text-slate-300">{auto ? "" : "________"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {variant === "batch" ? (
                <tfoot>
                  <tr className="border-t-2 border-slate-400">
                    <td colSpan={6} className="py-2 text-xs">
                      <span className="font-semibold">หัวหน้ากรอกเข้าระบบแล้ว</span> วันที่ <Blank w="w-20" /> ลงชื่อ <Blank w="w-24" />
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          )}
        </div>

        <div className="mt-3 rounded border border-slate-300 px-3 py-2 text-xs">
          <p className="mb-0.5 text-2xs text-slate-500">หมายเหตุออเดอร์</p>
          <p className="whitespace-pre-line">{WORK_ORDER.note}</p>
        </div>

        <div className={cn("mt-3 rounded px-3 py-2 text-xs text-slate-400", DASHED)}>
          บันทึกหน้างาน
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs text-slate-500">{label}</p>
      <p className={cn("break-words", strong ? "text-sm font-bold" : "text-xs font-medium")}>{value}</p>
    </div>
  );
}

/** สิ่งที่ต่างจากใบสั่งงานที่พิมพ์ได้ตอนนี้ — เขียนบอกข้างกระดาษ ไม่ปนในกระดาษ */
export const PAPER_DIFF: Record<Variant, readonly string[]> = {
  now: ["ใบนี้คือใบที่พิมพ์ได้ตอนนี้ (/print/job-ticket) — QR เปิดหน้าออเดอร์", "ตาราง “ขั้นตอนผลิต” มีช่องเสร็จวันที่/ลงชื่อทุกขั้น ทั้งที่ช่างต้องกดจอทุกขั้นอยู่แล้ว = จด 2 ที่", "ข้อกำหนดมาตรฐานไม่อยู่บนกระดาษ (อยู่ในจอเท่านั้น)"],
  three: ["QR เปิดใบผลิต ไม่ใช่หน้าออเดอร์ — สแกนแล้วเห็นขั้นและปุ่มของใบนี้เลย", "ข้อกำหนดมาตรฐานพิมพ์เป็นช่องติ๊กต่อขั้น พร้อมช่องยอดดี/เสียและลงชื่อ — กระดาษคือบันทึกของขั้นที่ไม่จดในระบบ", "แถวที่ต้องจดในระบบมีเครื่องหมายจอ (QC, แพ็ก, ร้านนอก) — ช่างรู้จากกระดาษว่าจุดไหนต้องไปแตะจอ", "ขั้นพิมพ์ DTF ไม่มีช่องเซ็น — ระบบรู้จากรอบพิมพ์อยู่แล้ว", "เพิ่มช่อง “สูตรขั้นงาน” แทน “จำนวนรายการ”"],
  batch: ["เหมือนทาง A แต่ทุกแถวเซ็นบนกระดาษเท่ากัน ไม่มีเครื่องหมายจอ", "แถวท้ายให้หัวหน้าเซ็นว่า “กรอกเข้าระบบแล้ว” กันกรอกซ้ำ/ตกหล่น", "QR เปิดใบผลิตเหมือน A"],
};
