"use client";

/**
 * ชิ้นส่วนที่ทุกทางของหน้าลอง "จอสถานี" ใช้ร่วมกัน — โครงจอ · ป้ายสถานี · การ์ดคิว · หน้าลงมือ · แจ้งปัญหา · หัวหน้าแก้ให้
 * ของที่ไม่ได้เทียบ (ปุ่ม ชิป ตัวเลข ป้ายกำหนดส่ง โซนลงมือ dialog) = component ตัวจริงทั้งหมด
 * กฎ 3 ชั้น docs/DESIGN.md §ลำดับความสำคัญทางสายตา · เป้ากดจอทัช ≥ 56px · หนึ่งจอ = ปุ่มหลักปุ่มเดียว
 */

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  Flame,
  Package,
  PackageCheck,
  Printer,
  ShieldCheck,
  Shirt,
  Truck,
  Undo2,
  UserRound,
  Wrench,
} from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Textarea } from "@/components/ui/textarea";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { BigMockup } from "../_kit/pieces";
import {
  FIX_ACTIONS,
  PROBLEM_REASONS,
  PROTO_CLOCK,
  PROTO_TODAY,
  STATE_META,
  type Queue,
  type Station,
  type StationJob,
  type StationKey,
  type Worker,
  stationOf,
} from "./_data";

/* ───────────────────────── สถานะการเดินในหน้าลอง (URL พกได้) ───────────────────────── */

export type Role = "worker" | "boss";
export type Screen = "pick" | "queue" | "job";
export type ProtoNav = {
  station: StationKey;
  setStation: (key: StationKey) => void;
  screen: Screen;
  setScreen: (screen: Screen) => void;
  jobId: string;
  setJobId: (id: string) => void;
};

/* ───────────────────────── ไอคอนสถานี (ของจริง: เลือกได้ในหน้าตั้งค่า) ───────────────────────── */

export const STATION_ICON: Record<StationKey, LucideIcon> = {
  prep: Shirt,
  dtf: Printer,
  press: Flame,
  "return-qc": PackageCheck,
  qc: ClipboardCheck,
  pack: Package,
  outsource: Truck,
};

/* ───────────────────────── โครงจอสถานี — เต็มจอ ไม่มีเมนูข้าง ───────────────────────── */

export function StationShell({
  title,
  eyebrow,
  who,
  boss = false,
  onBack,
  backLabel = "กลับ",
  right,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  who: Worker;
  boss?: boolean;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[640px] flex-col">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        {onBack ? (
          <Button variant="outline" size="lg" className="h-12 shrink-0 px-4" onClick={onBack}>
            <ArrowLeft /> {backLabel}
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-xs font-medium text-muted">{eyebrow}</p> : null}
          <h1 className="truncate text-xl font-semibold text-strong sm:text-2xl">{title}</h1>
        </div>
        {right}
        <div className="hidden items-center gap-1.5 text-sm text-secondary sm:flex">
          <Clock className="h-4 w-4 text-muted" aria-hidden="true" />
          <span className="tabular-nums">{PROTO_TODAY}</span>
          <span className="tabular-nums font-medium text-strong">{PROTO_CLOCK}</span>
        </div>
        <WhoChip who={who} boss={boss} />
      </header>
      <div className="flex-1 pt-5">{children}</div>
    </div>
  );
}

/** ใครอยู่ที่จอนี้ — จอใช้ร่วมกัน เปลี่ยนคน = ออกจากระบบแล้วเข้าใหม่ (ของจริงตอนนี้) */
export function WhoChip({ who, boss = false }: { who: Worker; boss?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-full py-1 pl-1 pr-3", SUNK_PANEL)}>
      <Avatar worker={who} />
      <span className="text-sm font-medium text-strong">{who.name}</span>
      {boss ? (
        <Badge variant="accent" size="sm">
          หัวหน้า
        </Badge>
      ) : (
        <button type="button" className="text-xs text-secondary underline-offset-2 hover:underline">
          เปลี่ยนคน
        </button>
      )}
    </div>
  );
}

export function Avatar({ worker, size = "md" }: { worker: Worker; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white dark:bg-blue-500",
        size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm",
      )}
    >
      {worker.initials}
    </span>
  );
}

export function WorkerChips({ workers, size = "md" }: { workers: Worker[]; size?: "sm" | "md" }) {
  if (workers.length === 0) return <span className="text-xs text-muted">ยังไม่มีคนประจำ</span>;
  return (
    <InfoChipRow>
      {workers.map((w) => (
        <InfoChip key={w.id} size={size === "sm" ? "sm" : "md"}>
          <Avatar worker={w} size="sm" /> {w.name}
        </InfoChip>
      ))}
    </InfoChipRow>
  );
}

/* ───────────────────────── ป้ายสถานี (หน้าเลือกสถานี / แผงหัวหน้า) ───────────────────────── */

export function StationTile({
  station,
  counts,
  workers,
  onPick,
  boss = false,
}: {
  station: Station;
  counts: { doing: number; ready: number; blocked: number };
  workers: Worker[];
  onPick: () => void;
  boss?: boolean;
}) {
  const Icon = STATION_ICON[station.key];
  const total = counts.doing + counts.ready + counts.blocked;
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "card-surface flex min-h-[9.5rem] flex-col gap-3 p-4 text-left transition-colors hover:bg-interactive-hover",
        RADIUS.surface,
        counts.blocked > 0 && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center", SUNK_PANEL, RADIUS.inner)}>
          <Icon className="h-6 w-6 text-strong" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-strong">{station.label}</p>
          <p className="text-sm text-secondary">{station.hint}</p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      </div>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <Metric value={counts.doing} label="กำลังทำ" size="md" tone={counts.doing > 0 ? "default" : "muted"} />
          <Metric value={counts.ready} label="พร้อมทำ" size="md" tone={counts.ready > 0 ? "default" : "muted"} />
          <Metric value={counts.blocked} label="ติด / รอ" size="md" tone={counts.blocked > 0 ? "danger" : "muted"} />
        </div>
        {boss ? <WorkerChips workers={workers} size="sm" /> : total === 0 ? <span className="text-sm text-muted">ว่าง</span> : null}
      </div>
      {station.addedNote ? (
        <p className="flex items-center gap-1.5 text-xs text-secondary">
          <ShieldCheck className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          {station.addedNote}
        </p>
      ) : null}
    </button>
  );
}

/* ───────────────────────── ชิ้นส่วนของใบงาน ───────────────────────── */

export function StateChip({ job, size = "md" }: { job: StationJob; size?: "sm" | "md" | "lg" }) {
  const meta = STATE_META[job.state];
  return (
    <InfoChip size={size} tone={meta.tone} strong={meta.strong} icon={job.station === "outsource" ? Truck : Wrench}>
      {meta.label}
    </InfoChip>
  );
}

export function OwnerChip({ job, size = "md" }: { job: StationJob; size?: "sm" | "md" }) {
  return job.owner ? (
    <InfoChip size={size} icon={UserRound}>
      {job.owner}
    </InfoChip>
  ) : (
    <InfoChip size={size} tone="neutral" icon={UserRound} className="opacity-70">
      ยังไม่มีคนรับ
    </InfoChip>
  );
}

export function JobQty({ job, size = "md" }: { job: StationJob; size?: "sm" | "md" | "lg" }) {
  if (job.qtyTotal === null) return <Metric value="—" label="ไม่นับตัว" size={size} tone="muted" />;
  return (
    <Metric
      value={`${job.qtyDone.toLocaleString("th-TH")}/${job.qtyTotal.toLocaleString("th-TH")}`}
      unit="ตัว"
      label="ทำแล้ว"
      size={size}
      tone={job.qtyDone >= job.qtyTotal ? "success" : "default"}
    />
  );
}

function backChip(job: StationJob, size: "sm" | "md" | "lg" = "md") {
  const o = job.outsource;
  if (!o) return null;
  const text = o.backInDays < 0 ? `เลยนัดรับ ${Math.abs(o.backInDays)} วัน` : o.backInDays === 0 ? "นัดรับวันนี้" : `กลับ ${o.backLabel}`;
  return (
    <InfoChip size={size} tone={o.backInDays < 0 ? "error" : o.backInDays === 0 ? "warning" : "info"} strong={o.backInDays <= 0} icon={Truck}>
      {text}
    </InfoChip>
  );
}

/**
 * การ์ดในคิว — ทั้งใบกดได้ (ช่างไม่ต้องเล็งปุ่มเล็ก) · ของหัวหน้ามีปุ่ม "แก้ให้" ซ้อนขวา
 * รูปย่อจริง · เลขใบหนัก · จำนวนเป็นตัวเลขใหญ่ · กำหนดส่งเป็นป้าย · สถานะเป็นชิป
 */
export function QueueCard({
  job,
  onOpen,
  showOwner = false,
  extra,
}: {
  job: StationJob;
  onOpen: () => void;
  showOwner?: boolean;
  extra?: ReactNode;
}) {
  return (
    <li className={cn("card-surface relative", RADIUS.surface, job.problem && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40")}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`เปิดงาน ${job.orderNumber}`}
        className={cn("absolute inset-0 z-0 transition-colors hover:bg-interactive-hover", RADIUS.surface)}
      />
      <div className="pointer-events-none relative z-10 flex gap-4 p-4">
        <BigMockup src={job.mockup} alt={`ม็อกอัพ ${job.orderNumber}`} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold tabular-nums text-strong">{job.orderNumber}</span>
              {job.urgent ? <Badge variant="destructive">ด่วน</Badge> : null}
            </p>
            <p className="truncate text-sm text-secondary">{job.company}</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <Metric value={job.qty.toLocaleString("th-TH")} unit="ตัว" size="md" />
            <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="md" />
          </div>
          <InfoChipRow>
            <StateChip job={job} />
            {backChip(job)}
            {showOwner ? <OwnerChip job={job} size="sm" /> : null}
            {job.problem ? (
              <InfoChip tone="error" strong icon={AlertTriangle} title={job.problem.detail}>
                {job.problem.title}
              </InfoChip>
            ) : null}
          </InfoChipRow>
          {job.note ? (
            <p className={cn("flex items-start gap-1.5 border px-2.5 py-1.5 text-sm", TINT.warning, RADIUS.inner)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{job.note}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <ChevronRight className="h-6 w-6 text-muted" aria-hidden="true" />
          {extra ? <div className="pointer-events-auto">{extra}</div> : null}
        </div>
      </div>
    </li>
  );
}

/** สามกลุ่มของคิว — กำลังทำ (ของฉัน) → พร้อมทำ → ติดปัญหา/รอ · กลุ่มว่างบอกว่าว่างเพราะอะไร */
export function QueueGroups({
  queue,
  station,
  onOpen,
  showOwner = false,
  extra,
}: {
  queue: Queue;
  station: Station;
  onOpen: (job: StationJob) => void;
  showOwner?: boolean;
  extra?: (job: StationJob) => ReactNode;
}) {
  const empty = queue.doing.length + queue.ready.length + queue.blocked.length === 0;
  if (empty) {
    return (
      <EmptyState
        icon={STATION_ICON[station.key]}
        title={`ยังไม่มีงานที่${station.label}`}
        description="งานจะโผล่ที่นี่เองเมื่อขั้นก่อนหน้าปิด — ถ้าคิดว่าควรมีงาน บอกหัวหน้า"
        action={<Button variant="outline" size="lg">ถามหัวหน้า</Button>}
      />
    );
  }
  const group = (title: string, jobs: StationJob[], tone: "default" | "danger" = "default") =>
    jobs.length === 0 ? null : (
      <section key={title} aria-label={title} className="space-y-3">
        <p className="flex items-baseline gap-2">
          <span className={cn("text-base font-semibold", tone === "danger" ? "text-red-700 dark:text-red-300" : "text-strong")}>{title}</span>
          <span className="text-sm tabular-nums text-muted">{jobs.length}</span>
        </p>
        <ul className="grid gap-3 lg:grid-cols-2">
          {jobs.map((job) => (
            <QueueCard key={job.id} job={job} onOpen={() => onOpen(job)} showOwner={showOwner} extra={extra?.(job)} />
          ))}
        </ul>
      </section>
    );
  return (
    <div className="space-y-7">
      {group("กำลังทำ", queue.doing)}
      {group("พร้อมทำ — เรียงตามกำหนดส่ง", queue.ready)}
      {group("ติดปัญหา / รอของ", queue.blocked, "danger")}
    </div>
  );
}

/* ───────────────────────── หน้าลงมือ — หนึ่งใบ หนึ่งขั้น หนึ่งปุ่ม ───────────────────────── */

type Phase = "idle" | "qty" | "done" | "problem-sent";

export function JobScreen({
  job,
  boss = false,
  onFix,
}: {
  job: StationJob;
  boss?: boolean;
  onFix?: () => void;
}) {
  const station = stationOf(job.station);
  const [ticks, setTicks] = useState<boolean[]>(() => job.checklist.map((_, i) => job.state === "doing" && i < job.checklist.length - 1));
  const [phase, setPhase] = useState<Phase>("idle");
  const [qty, setQty] = useState<number>(job.qtyDone);
  const [problemOpen, setProblemOpen] = useState(false);
  const allTicked = ticks.every(Boolean);
  const locked = job.state === "blocked" || job.state === "waiting";
  const counting = job.qtyTotal !== null;

  const noteText = locked
    ? job.state === "waiting"
      ? `รอของกลับจากร้าน ${job.outsource?.backLabel ?? ""} — ทำต่อได้เมื่อของมาถึง`
      : "ติดปัญหาอยู่ — รอหัวหน้าแก้ก่อน จึงทำต่อได้"
    : phase === "done"
      ? undefined
      : !allTicked
        ? "ติ๊กข้อกำหนดให้ครบก่อน ปุ่มหลักถึงจะกดได้"
        : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* ซ้าย: ทำอะไร — รูป ไซซ์ ลาย */}
      <div className="space-y-4">
        <div className={cn("card-surface p-4", RADIUS.surface)}>
          <BigMockup src={job.mockup} alt={`ม็อกอัพ ${job.orderNumber}`} className="aspect-[4/3] w-full" />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-strong">{job.orderNumber}</p>
              <p className="text-sm text-secondary">{job.company}</p>
              <p className="mt-1 font-medium text-strong">
                {job.title} <span className="font-normal text-secondary">· {job.color}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Metric value={job.qty.toLocaleString("th-TH")} unit="ตัว" label="ทั้งใบ" size="lg" />
              <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="lg" />
            </div>
          </div>
          <InfoChipRow className="mt-3">
            {job.sizes.map((s) => (
              <InfoChip key={s.size} size="lg">
                {s.size} <span className="font-semibold tabular-nums">{s.qty}</span>
              </InfoChip>
            ))}
          </InfoChipRow>
          <FactList columns={2} className="mt-4">
            {job.prints.map((p) => (
              <Fact key={p.position} label={`${p.position} · ${p.technique}`} value={p.size} sub={p.note} size="md" />
            ))}
          </FactList>
          {job.outsource ? (
            <FactList columns={2} className="mt-4 border-t border-border pt-4">
              <Fact icon={Truck} label="ร้านนอก" value={job.outsource.vendor} sub={job.outsource.work} size="md" />
              <div>
                <p className="text-xs font-medium text-muted">นัดรับกลับ</p>
                <div className="mt-1">{backChip(job, "lg")}</div>
              </div>
            </FactList>
          ) : null}
        </div>
        {job.note ? (
          <Alert variant="warning" title="ระวัง">
            {job.note}
          </Alert>
        ) : null}
      </div>

      {/* ขวา: ขั้นนี้ — ตัวเลข · ปัญหา · ข้อกำหนด · ปุ่มเดียว */}
      <div className="space-y-4">
        <div className={cn("card-surface p-5", RADIUS.surface)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted">
                ขั้นที่ {job.stepIndex} จาก {job.stepTotal}
              </p>
              <h2 className="text-2xl font-semibold text-strong">{job.stepLabel}</h2>
              <InfoChipRow className="mt-2">
                <StateChip job={job} size="lg" />
                <OwnerChip job={job} />
              </InfoChipRow>
            </div>
            {counting ? <JobQty job={{ ...job, qtyDone: phase === "done" ? qty : job.qtyDone }} size="lg" /> : null}
          </div>

          {job.problem ? (
            <Alert variant="error" title={job.problem.title} className="mt-4">
              <p>{job.problem.detail}</p>
              <p className="mt-1 text-xs opacity-80">
                แจ้งเมื่อ {job.problem.since} โดย {job.problem.by}
              </p>
            </Alert>
          ) : null}

          <div className="mt-5">
            <p className="flex items-center justify-between text-sm font-medium text-strong">
              <span>ข้อกำหนดของขั้นนี้</span>
              <span className="tabular-nums text-muted">
                {ticks.filter(Boolean).length}/{ticks.length}
              </span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {job.checklist.map((label, i) => {
                const on = ticks[i] ?? false;
                return (
                  <li key={label}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={locked || phase === "done"}
                      onClick={() => setTicks((t) => t.map((v, k) => (k === i ? !v : v)))}
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 px-3 text-left text-base transition-colors",
                        RADIUS.inner,
                        SUNK_PANEL,
                        !locked && "hover:bg-interactive-hover",
                        on ? "text-secondary" : "font-medium text-strong",
                      )}
                    >
                      {on ? (
                        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                      ) : (
                        <Circle className="h-6 w-6 shrink-0 text-muted" aria-hidden="true" />
                      )}
                      <span className={on ? "line-through decoration-muted" : undefined}>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {phase === "done" ? (
          <Alert variant="success" icon={CheckCircle2} title={counting ? `บันทึกแล้ว — ${station.label} ${qty.toLocaleString("th-TH")}/${job.qtyTotal?.toLocaleString("th-TH")} ตัว` : `บันทึกแล้ว — ${job.stepLabel}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>กดผิด? ย้อนกลับได้เองภายใน 5 นาที (ถึง 14:25) หลังจากนั้นให้หัวหน้าแก้</span>
              <Button variant="outline" size="lg" onClick={() => setPhase("idle")}>
                <Undo2 /> ย้อนกลับ
              </Button>
            </div>
          </Alert>
        ) : null}

        {phase === "problem-sent" ? (
          <Alert variant="warning" icon={AlertTriangle} title="แจ้งหัวหน้าแล้ว — งานนี้หยุดไว้จนกว่าหัวหน้าจะแก้">
            เลือกงานอื่นในคิวไปทำก่อนได้เลย
          </Alert>
        ) : null}

        {phase === "qty" ? (
          <QtyPad job={job} value={qty} onChange={setQty} onConfirm={() => setPhase("done")} onCancel={() => setPhase("idle")} />
        ) : (
          <ActionZone touch note={noteText}>
            {locked || phase === "problem-sent" ? (
              boss ? (
                <Button variant="destructive" className="h-16 text-lg" onClick={onFix}>
                  <Wrench /> แก้ให้ / ปลดปัญหา
                </Button>
              ) : (
                <Button variant="outline" className="h-16 text-lg" disabled>
                  {station.action}
                </Button>
              )
            ) : phase === "done" ? (
              <Button variant="outline" className="h-16 text-lg" disabled>
                <CheckCircle2 /> เสร็จขั้นนี้แล้ว
              </Button>
            ) : (
              <Button className="h-16 text-lg" disabled={!allTicked} onClick={() => setPhase(counting ? "qty" : "done")}>
                {job.state === "ready" && job.qtyDone === 0 ? `เริ่ม — ${station.action}` : station.action}
              </Button>
            )}
            {!locked && phase !== "done" && phase !== "problem-sent" ? (
              <Button variant="outline" className="h-16 text-lg" onClick={() => setProblemOpen(true)}>
                <AlertTriangle /> แจ้งปัญหา
              </Button>
            ) : null}
            {boss && !locked ? (
              <Button variant="outline" className="h-16 text-lg" onClick={onFix}>
                <Wrench /> แก้ให้
              </Button>
            ) : null}
          </ActionZone>
        )}

        {job.lastAction ? (
          <p className="text-xs text-muted">
            ล่าสุด: {job.lastAction.what} — {job.lastAction.who} {job.lastAction.at}
          </p>
        ) : null}
      </div>

      <ProblemDialog
        job={job}
        open={problemOpen}
        onClose={() => setProblemOpen(false)}
        onSent={() => {
          setProblemOpen(false);
          setPhase("problem-sent");
        }}
      />
    </div>
  );
}

/** แป้นยอด — ตัวเลขใหญ่ ปุ่มบวกทีละกอง ไม่ต้องพิมพ์ (กันกดเลขผิด) */
function QtyPad({
  job,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  job: StationJob;
  value: number;
  onChange: (v: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const total = job.qtyTotal ?? 0;
  const clamp = (v: number) => Math.max(0, Math.min(total, v));
  return (
    <div className={cn("space-y-4 p-4", SUNK_PANEL, RADIUS.surface)}>
      <p className="text-sm font-medium text-strong">ทำแล้วกี่ตัว (รวมของเดิม {job.qtyDone.toLocaleString("th-TH")})</p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" className="h-16 w-20 text-xl" onClick={() => onChange(clamp(value - 10))} aria-label="ลด 10">
          −10
        </Button>
        <p className="w-40 text-center">
          <span className="text-5xl font-semibold tabular-nums text-strong">{value.toLocaleString("th-TH")}</span>
          <span className="block text-sm text-secondary">จาก {total.toLocaleString("th-TH")} ตัว</span>
        </p>
        <Button variant="outline" className="h-16 w-20 text-xl" onClick={() => onChange(clamp(value + 10))} aria-label="เพิ่ม 10">
          +10
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-14 text-base" onClick={() => onChange(clamp(value + 50))}>
          +50
        </Button>
        <Button variant="outline" className="h-14 text-base" onClick={() => onChange(clamp(value + 100))}>
          +100
        </Button>
        <Button variant="outline" className="h-14 text-base" onClick={() => onChange(total)}>
          ครบทั้งหมด
        </Button>
      </div>
      <ActionZone touch note={value >= total ? "ครบแล้ว — กดยืนยันจะปิดขั้นนี้และส่งต่อสถานีถัดไป" : "ยังไม่ครบ — บันทึกไว้ก่อน แล้วมาทำต่อได้"}>
        <Button className="h-16 text-lg" onClick={onConfirm}>
          {value >= total ? "ยืนยัน ครบแล้ว ปิดขั้น" : "บันทึกยอดไว้ก่อน"}
        </Button>
        <Button variant="outline" className="h-16 text-lg" onClick={onCancel}>
          ยกเลิก
        </Button>
      </ActionZone>
    </div>
  );
}

/** แจ้งปัญหาแบบกดเลือก — ช่างไม่ต้องพิมพ์ ยกเว้น "อื่น ๆ" */
export function ProblemDialog({ job, open, onClose, onSent }: { job: StationJob; open: boolean; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>แจ้งปัญหา — {job.orderNumber}</DialogTitle>
          <DialogDescription>เลือกเรื่องที่เจอ งานนี้จะหยุดไว้และเด้งไปหาหัวหน้าทันที</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROBLEM_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={reason === r.key}
              onClick={() => setReason(r.key)}
              className={cn(
                "min-h-14 px-4 text-left text-base font-medium transition-colors",
                RADIUS.inner,
                reason === r.key ? "bg-interactive-selected text-strong ring-2 ring-inset ring-blue-600 dark:ring-blue-400" : cn(SUNK_PANEL, "text-strong hover:bg-interactive-hover"),
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {reason === "other" ? <Textarea placeholder="พิมพ์สั้น ๆ ว่าเจออะไร" rows={2} /> : null}
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button variant="destructive" size="lg" disabled={!reason} onClick={onSent}>
            แจ้งหัวหน้า
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── หัวหน้าแก้ให้ — รายการเดียวกันทุกทาง ───────────────────────── */

export function FixDialog({ job, open, onClose }: { job: StationJob | null; open: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  if (!job) return null;
  const action = FIX_ACTIONS.find((a) => a.key === picked) ?? null;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            แก้ให้ — {job.orderNumber} · {job.stepLabel}
          </DialogTitle>
          <DialogDescription>
            {job.lastAction ? `ล่าสุด ${job.lastAction.who} ${job.lastAction.what} เมื่อ ${job.lastAction.at}` : "ยังไม่มีใครกดอะไรกับขั้นนี้"}
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-divider">
          {FIX_ACTIONS.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                aria-pressed={picked === a.key}
                disabled={!a.exists}
                onClick={() => setPicked(a.key)}
                className={cn(
                  "flex w-full items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-interactive-hover disabled:opacity-60 disabled:hover:bg-transparent",
                  picked === a.key && "bg-interactive-selected",
                )}
              >
                <Wrench className={cn("mt-0.5 h-5 w-5 shrink-0", a.danger ? "text-red-600 dark:text-red-400" : "text-muted")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-base font-medium", a.danger ? "text-red-700 dark:text-red-300" : "text-strong")}>{a.label}</span>
                  <span className="block text-sm text-secondary">{a.desc}</span>
                </span>
                <InfoChip size="sm" tone={a.exists ? "neutral" : "warning"} className="shrink-0">
                  {a.exists ? "มีอยู่แล้ว" : "ต้องทำเพิ่ม"}
                </InfoChip>
              </button>
            </li>
          ))}
        </ul>
        <div className={cn("flex items-start gap-2 p-3 text-sm", TINT.info, RADIUS.inner)}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>ทุกอย่างที่หัวหน้าแก้ ระบบจดชื่อหัวหน้า เวลา และเหตุผล — ช่างเห็นในใบว่า “หัวหน้าแก้ให้” ไม่ใช่หายไปเฉย ๆ</span>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={onClose}>
            ปิด
          </Button>
          <Button size="lg" disabled={!action} onClick={onClose}>
            {action ? `ยืนยัน: ${action.label}` : "เลือกสิ่งที่จะแก้"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ปุ่ม "แก้ให้" ที่ซ้อนบนการ์ดคิวของหัวหน้า */
export function FixButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="lg" className="h-12" onClick={onClick}>
      <Wrench /> แก้ให้
    </Button>
  );
}
