"use client";

/**
 * ชิ้นส่วนอ่านอย่างเดียวของใบผลิต — ใช้ร่วมกันระหว่างใบผลิต `/production/[id]` (แบบ D) และจอสถานี `/station` (แบบ A)
 * ไม่มี query/mutation ในไฟล์นี้ — รับ step/order เป็น props ล้วน
 */

import { CalendarCheck, Shirt, Truck, UserRound, Wrench } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { currentProductionProblemReason } from "@/lib/production-problem";
import type { NowStep } from "@/lib/production-step-actions";
import { OUTSOURCE_STATUS_LABELS, STEP_TYPE_LABELS } from "@/lib/production-steps";
import { formatDate } from "@/lib/utils";

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysFromNow(value: Date | string | null | undefined, nowMs: number): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

export function stepLabel(step: Pick<ProductionStep, "customStepName" | "stepType">) {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

export type StepView = {
  state: "done" | "active" | "blocked" | "waiting" | "todo";
  label: string;
  chip: "neutral" | "info" | "warning" | "error" | "success";
};

const STEP_VIEW: Record<StepView["state"], Omit<StepView, "state">> = {
  done: { label: "ผ่านแล้ว", chip: "success" },
  active: { label: "กำลังทำ", chip: "info" },
  blocked: { label: "ติดปัญหา", chip: "error" },
  waiting: { label: "รอ", chip: "warning" },
  todo: { label: "ยังไม่ถึง", chip: "neutral" },
};

export function viewOf(step: ProductionStep, now: NowStep<ProductionStep> | undefined): StepView {
  const state: StepView["state"] =
    step.status === "COMPLETED"
      ? "done"
      : step.status === "FAILED" || step.status === "ON_HOLD"
        ? "blocked"
        : now && now.waitingOn.length > 0
          ? "waiting"
          : step.status === "IN_PROGRESS"
            ? "active"
            : now && now.group === "current"
              ? "active"
              : "todo";
  return { state, ...STEP_VIEW[state] };
}

export function activeOutsource(step: ProductionStep) {
  return step.outsourceOrders.find((o) => !["QC_PASSED", "QC_FAILED", "CANCELLED"].includes(o.status)) ?? null;
}

export function StateChip({ view, kind, size = "sm" }: { view: StepView; kind: "inhouse" | "outsource"; size?: "sm" | "md" | "lg" }) {
  return (
    <InfoChip size={size} tone={view.chip} strong={view.state === "active" || view.state === "blocked"} icon={kind === "outsource" ? Truck : Wrench}>
      {view.label}
    </InfoChip>
  );
}

export function Qty({ step, size = "sm" }: { step: ProductionStep; size?: "sm" | "md" | "lg" }) {
  if (step.qtyTotal === null || step.qtyTotal === 0) {
    return <span className="text-xs text-muted">{step.status === "COMPLETED" ? "ผ่านแล้ว" : "ไม่นับจำนวน"}</span>;
  }
  return (
    <Metric
      value={`${(step.qtyDone ?? 0).toLocaleString("th-TH")}/${step.qtyTotal.toLocaleString("th-TH")}`}
      size={size}
      tone={(step.qtyDone ?? 0) >= step.qtyTotal ? "success" : "default"}
    />
  );
}

export function Owner({ step }: { step: ProductionStep }) {
  return step.assignedTo ? (
    <span className="inline-flex items-center gap-1.5 text-secondary">
      <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      {step.assignedTo.name}
    </span>
  ) : (
    <span className="text-muted">ยังไม่มีคนรับ</span>
  );
}

export function ProblemCard({ step }: { step: ProductionStep }) {
  const reason = currentProductionProblemReason(step);
  const title = step.status === "FAILED" ? "งานติดปัญหา" : "งานถูกพักไว้";
  return (
    <Alert variant="error" title={`${title} — ${stepLabel(step)}`}>
      <p>{reason ?? step.notes ?? "ยังไม่ระบุเหตุ"}</p>
      {step.assignedTo ? <p className="mt-1 text-xs opacity-80">ผู้รับผิดชอบ {step.assignedTo.name}</p> : null}
    </Alert>
  );
}

// nowMs มาจากเวลาที่ query อัปเดต ไม่เรียก Date.now() ตอนเรนเดอร์ (react-compiler ตีว่าไม่บริสุทธิ์)
export function OutsourceFacts({ step, nowMs }: { step: ProductionStep; nowMs: number }) {
  const o = step.outsourceOrders[0];
  if (!o) return null;
  const awaiting = !["QC_PASSED", "QC_FAILED", "CANCELLED"].includes(o.status);
  const overdue = awaiting && !!o.expectedBackAt && new Date(o.expectedBackAt).getTime() < nowMs - DAY_MS;
  return (
    <FactList columns={3}>
      <Fact icon={Truck} label="ร้านนอก" value={o.vendor.name} sub={o.sentAt ? `ส่งไป ${formatDate(o.sentAt)}` : "ยังไม่บันทึกวันส่ง"} />
      <Fact label="งานที่ส่ง" value={o.description ?? stepLabel(step)} sub={o.quantity ? `${o.quantity.toLocaleString("th-TH")} ชิ้น` : undefined} />
      <div>
        <p className="text-xs font-medium text-muted">{awaiting ? "นัดรับกลับ" : "สถานะ"}</p>
        <InfoChip
          tone={!awaiting ? (o.status === "QC_PASSED" ? "success" : "error") : overdue ? "error" : "info"}
          strong={awaiting && !!o.expectedBackAt}
          icon={CalendarCheck}
          className="mt-1"
        >
          {awaiting ? (o.expectedBackAt ? formatDate(o.expectedBackAt) : "ยังไม่นัด") : (OUTSOURCE_STATUS_LABELS[o.status as keyof typeof OUTSOURCE_STATUS_LABELS] ?? o.status)}
        </InfoChip>
      </div>
    </FactList>
  );
}

/* ───────────────────────── ทำอะไร: สินค้า สี ไซซ์ ───────────────────────── */

export function ItemsList({ order, chipSize = "sm" }: { order: ProductionDetail["order"]; chipSize?: "sm" | "md" | "lg" }) {
  const products = order.items.flatMap((item) => item.products);
  if (products.length === 0) return <p className="text-sm text-muted">ออเดอร์นี้ยังไม่มีรายการสินค้า</p>;
  return (
    <ul className="divide-y divide-divider">
      {products.map((product) => (
        <li key={product.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-medium text-strong">
              {product.description || product.productType || "สินค้า"}
              {product.fabricColor ? <span className="text-secondary"> · {product.fabricColor}</span> : null}
            </p>
            <Metric value={product.totalQuantity.toLocaleString("th-TH")} unit="ตัว" size="sm" />
          </div>
          {product.variants.length > 0 ? (
            <InfoChipRow className="mt-1.5">
              {product.variants.map((v) => (
                <InfoChip key={v.id} size={chipSize}>
                  {v.size}
                  {v.color && v.color !== product.fabricColor ? ` ${v.color}` : ""} <span className="font-semibold">{v.quantity}</span>
                </InfoChip>
              ))}
            </InfoChipRow>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ItemsSection({ order }: { order: ProductionDetail["order"] }) {
  const products = order.items.flatMap((item) => item.products);
  const total = order.items.reduce((sum, item) => sum + item.totalQuantity, 0);
  return (
    <Section title="สินค้า สี ไซซ์" meta={`${products.length} รายการ · ${total.toLocaleString("th-TH")} ตัว`} icon={Shirt} tone="product">
      <ItemsList order={order} />
    </Section>
  );
}
