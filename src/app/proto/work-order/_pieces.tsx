"use client";

/**
 * ชิ้นส่วนที่ทุกทางของหน้าลองใบผลิตใช้ร่วมกัน — หัวใบ · "ทำอะไร" · การ์ดปัญหา · แถวขั้น
 * ของที่ไม่ได้เทียบ (ปุ่ม ป้าย ชิป ตัวเลข โซนลงมือ หัวหน้า) = component ตัวจริงทั้งหมด
 * กฎ 3 ชั้น docs/DESIGN.md §ลำดับความสำคัญทางสายตา
 */

import { AlertTriangle, CalendarCheck, CheckCircle2, ClipboardCheck, Factory, Shirt, Truck, UserRound, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ActionZone } from "@/components/ui/action-zone";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import { BigMockup } from "../_kit/pieces";
import { ITEMS, STEP_TONE, WORK_ORDER, summarize, type WorkStep } from "./_data";

/* ───────────────────────── หัวใบ (เหมือนกันทุกทาง) ───────────────────────── */

export function WorkOrderHeader({ steps }: { steps: WorkStep[] }) {
  const sum = summarize(steps);
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Factory}
        tone="production"
        back={{ href: "/production", label: "กลับหน้าการผลิต" }}
        breadcrumb={[{ label: "การผลิต", href: "/production" }, { label: WORK_ORDER.orderNumber }]}
        title={WORK_ORDER.orderNumber}
        description={`${WORK_ORDER.company} · ${WORK_ORDER.contact}`}
        titleBadge={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="accent" size="sm">
              {WORK_ORDER.status}
            </Badge>
            {WORK_ORDER.priority === "HIGH" ? (
              <Badge variant="warning" size="sm">
                สำคัญ
              </Badge>
            ) : null}
          </span>
        }
        action={
          <>
            <Button variant="outline">มอบหมาย</Button>
            <Button variant="outline">แจ้งปัญหา</Button>
          </>
        }
      />
      {/* ตัวเลขที่ต้องเห็นใน 2 วินาที — ชั้น 1 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-surface rounded-2xl p-4">
          <Metric label="จำนวนที่ต้องผลิต" value={WORK_ORDER.qty.toLocaleString("th-TH")} unit="ตัว" size="lg" icon={Shirt} />
        </div>
        <div className="card-surface rounded-2xl p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" /> กำหนดส่ง
          </p>
          <div className="mt-2">
            <DueTag dueInDays={WORK_ORDER.dueInDays} dateLabel={WORK_ORDER.dueLabel} size="lg" />
          </div>
        </div>
        <div className="card-surface rounded-2xl p-4">
          <Metric label="ผ่านแล้ว" value={`${sum.done}/${sum.total}`} unit="ขั้น" size="lg" icon={CheckCircle2} tone={sum.done === sum.total ? "success" : "default"} />
        </div>
        <div className="card-surface rounded-2xl p-4">
          <Metric label="ติดปัญหา" value={sum.problems} unit="ขั้น" size="lg" icon={AlertTriangle} tone={sum.problems > 0 ? "danger" : "muted"} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── "ทำอะไร" — สินค้า ไซซ์ ลาย ───────────────────────── */

export function WhatToMake({ compact = false }: { compact?: boolean }) {
  return (
    <Section title="ทำอะไร" meta={`${ITEMS.length} รายการ · ม็อกอัพอนุมัติ ${WORK_ORDER.approvedMockup.version} (${WORK_ORDER.approvedMockup.approvedOn})`} icon={Shirt} tone="product">
      <ul className="divide-y divide-divider">
        {ITEMS.map((item) => {
          const qty = item.sizes.reduce((sum, s) => sum + s.qty, 0);
          return (
            <li key={item.id} className={cn("flex gap-4 py-3 first:pt-0 last:pb-0", compact ? "items-center" : "items-start")}>
              <BigMockup src={item.mockup} alt={`ม็อกอัพ ${item.color}`} className={compact ? "h-14 w-14 shrink-0" : "h-20 w-20 shrink-0"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-medium text-strong">
                    {item.product} <span className="text-secondary">· {item.color}</span>
                  </p>
                  <Metric value={qty} unit="ตัว" size="sm" />
                </div>
                <InfoChipRow className="mt-1.5">
                  {item.sizes.map((s) => (
                    <InfoChip key={s.size} size="sm">
                      {s.size} <span className="font-semibold">{s.qty}</span>
                    </InfoChip>
                  ))}
                </InfoChipRow>
                {!compact ? (
                  <FactList columns={2} className="mt-2">
                    {item.prints.map((print) => (
                      <Fact
                        key={print.position}
                        size="sm"
                        label={`${print.position} · ${print.technique}`}
                        value={print.size}
                        sub={print.note}
                      />
                    ))}
                  </FactList>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ───────────────────────── ข้อเท็จจริงของใบ (เสื้อ · สูตร · หมายเหตุ) ───────────────────────── */

export function WorkOrderFacts() {
  const g = WORK_ORDER.garment;
  return (
    <Section title="ข้อมูลใบผลิต" icon={ClipboardCheck} tone="production">
      <FactList columns={2}>
        <Fact label="สูตรขั้นงาน" value={WORK_ORDER.routingName} />
        <Fact label="เสื้อ" value={g.source} sub={`เบิกแล้ว ${g.issued}/${g.needed} ตัว`} tone={g.missing > 0 ? "warning" : "default"} icon={Shirt} />
        <Fact label="ช่องทางลูกค้า" value={WORK_ORDER.channel} />
        <Fact label="ม็อกอัพอนุมัติ" value={`${WORK_ORDER.approvedMockup.version} · ${WORK_ORDER.approvedMockup.approvedOn}`} sub={`โดย ${WORK_ORDER.approvedMockup.by}`} />
      </FactList>
      {WORK_ORDER.note ? (
        <Alert variant="warning" className="mt-4" title="หมายเหตุจากใบงาน">
          {WORK_ORDER.note}
        </Alert>
      ) : null}
    </Section>
  );
}

/* ───────────────────────── ชิ้นส่วนของขั้น ───────────────────────── */

export function StepStateChip({ step, size = "sm" }: { step: WorkStep; size?: "sm" | "md" | "lg" }) {
  const tone = STEP_TONE[step.state];
  return (
    <InfoChip size={size} tone={tone.chip} strong={step.state === "active" || step.state === "blocked"} icon={step.kind === "outsource" ? Truck : Wrench}>
      {tone.label}
    </InfoChip>
  );
}

export function StepQty({ step, size = "sm" }: { step: WorkStep; size?: "sm" | "md" | "lg" }) {
  if (step.kind === "outsource" && step.state !== "done") {
    return <span className="text-xs text-muted">รอครบ {step.qtyTotal}</span>;
  }
  return (
    <Metric
      value={`${step.qtyDone.toLocaleString("th-TH")}/${step.qtyTotal.toLocaleString("th-TH")}`}
      size={size}
      tone={step.qtyDone >= step.qtyTotal ? "success" : "default"}
    />
  );
}

/** ปัญหาของขั้น — การ์ดแดงชั้น 1 มีปุ่มแก้ในโซนของตัวเอง */
export function ProblemCard({ step }: { step: WorkStep }) {
  if (!step.problem) return null;
  return (
    <Alert variant="error" title={`${step.problem.title} — ${step.label}`}>
      <p>{step.problem.detail}</p>
      <p className="mt-1 text-xs opacity-80">แจ้งเมื่อ {step.problem.since} · โดย {step.owner}</p>
    </Alert>
  );
}

/** โซนลงมือของขั้น — มาตรฐานเดียวกันทุกขั้น: ข้อกำหนด (ติ๊กครบ) → ปุ่มหลักปุ่มเดียว */
export function StepWorkZone({ step, touch = false }: { step: WorkStep; touch?: boolean }) {
  const doneCount = step.checklist.filter((c) => c.done).length;
  const allDone = doneCount === step.checklist.length;
  const locked = step.state === "done";
  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center justify-between text-xs font-medium text-muted">
          <span>ข้อกำหนดมาตรฐานของขั้นนี้</span>
          <span className="tabular-nums">
            {doneCount}/{step.checklist.length}
          </span>
        </p>
        <ul className="mt-1.5 space-y-1">
          {step.checklist.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", c.done ? "text-green-600 dark:text-green-400" : "text-muted")} aria-hidden="true" />
              <span className={c.done ? "text-secondary" : "text-strong"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <ActionZone
        touch={touch}
        note={
          locked
            ? `ปิดขั้นแล้ว ${step.completedAt} · โดย ${step.owner}`
            : step.state === "waiting"
              ? `รอของกลับจากร้าน ${step.outsource?.backLabel} — ตรวจรับได้เมื่อของมาถึง`
              : step.state === "blocked"
                ? "แก้ปัญหาก่อน จึงลงมือขั้นนี้ต่อได้"
                : !allDone
                  ? "ติ๊กข้อกำหนดให้ครบก่อนปิดขั้น"
                  : undefined
        }
      >
        {locked ? (
          <Button variant="outline" disabled>
            ผ่านแล้ว
          </Button>
        ) : step.state === "blocked" ? (
          <Button variant="destructive">จัดการปัญหา</Button>
        ) : (
          <Button>{step.action}</Button>
        )}
        {!locked ? <Button variant="outline">แจ้งปัญหา</Button> : null}
      </ActionZone>
    </div>
  );
}

export function OutsourceFacts({ step }: { step: WorkStep }) {
  const o = step.outsource;
  if (!o) return null;
  const back =
    o.backInDays < 0
      ? { text: `เลยนัดรับ ${Math.abs(o.backInDays)} วัน (${o.backLabel})`, tone: "error" as const, strong: true }
      : o.backInDays === 0
        ? { text: "นัดรับวันนี้", tone: "warning" as const, strong: true }
        : { text: `กลับ ${o.backLabel}`, tone: "info" as const, strong: false };
  return (
    <FactList columns={3}>
      <Fact icon={Truck} label="ร้านนอก" value={o.vendor} sub={`ส่งไป ${o.sentOn}`} />
      <Fact label="งานที่ส่ง" value={o.work} />
      <div>
        <p className="text-xs font-medium text-muted">นัดรับกลับ</p>
        <InfoChip tone={back.tone} strong={back.strong} icon={CalendarCheck} className="mt-1">
          {back.text}
        </InfoChip>
      </div>
    </FactList>
  );
}

export function OwnerText({ step }: { step: WorkStep }) {
  return step.owner ? (
    <span className="inline-flex items-center gap-1.5 text-secondary">
      <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      {step.owner}
    </span>
  ) : (
    <span className="text-muted">ยังไม่มีคนรับ</span>
  );
}
