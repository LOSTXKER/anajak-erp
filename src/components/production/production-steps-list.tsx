"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { STEP_STATUS_LABELS, STEP_STATUS_VARIANTS } from "@/lib/status-config";
import {
  STEP_TYPE_LABELS,
  laneOf,
  isOutsourceStep,
  evaluateHeatPressGate,
  type HeatPressGate,
  LANE_LABELS,
  LANE_ORDER,
  OUTSOURCE_LANES,
  OUTSOURCE_STATUS_LABELS,
  OUTSOURCE_ACTIVE_STATUSES,
  type ProductionLane,
} from "@/lib/production-steps";
import {
  Check,
  Play,
  AlertTriangle,
  Truck,
  FastForward,
  CheckCircle2,
  Printer,
  MoreHorizontal,
  Clock,
} from "lucide-react";
import type { ProductionStep } from "./types";

interface ProductionStepsListProps {
  steps: ProductionStep[];
  canOutsource: boolean;
  // ผ่านรวดยิง production.updateStep — โชว์เฉพาะ role ที่ server รับ (กันปุ่มกดแล้ว FORBIDDEN)
  canUpdateStep: boolean;
  // กติกา own-work ตรง server: ไม่ใช่หัวหน้า = แตะได้เฉพาะงานตัวเอง/งานยังไม่มีเจ้าของ
  canSupervise: boolean;
  meId: string | null;
  // กันกดเบิ้ลระหว่าง mutation เดิน (ปุ่มเร็วทุกตัวใช้ mutation ก้อนเดียวกันบนหน้า)
  busy: boolean;
  onSelectStep: (step: ProductionStep) => void;
  onOutsourceStep: (step: ProductionStep) => void;
  // ผ่านรวด = ปิดขั้นร้านนอกคลิกเดียว ไม่ต้องเปิดใบส่งร้าน (เบสเคาะ 2026-06-12)
  onQuickPass: (step: ProductionStep) => void;
  // ปุ่มเร็ว UX1 — ยิง updateStep เดิมเท่านั้น (เริ่ม/เสร็จ · server auto-claim ให้ช่างเอง)
  onStartStep: (step: ProductionStep) => void;
  onCompleteStep: (step: ProductionStep) => void;
}

// แถวขั้นตอนผลิต จัดกลุ่มตามเลนเทคนิค (เตรียมเสื้อ/DTF/DTG/สกรีน/ปัก/ป้ายคอ/แพ็ค)
// หน้า ops ช่างใช้บนมือถือหน้างาน: แถวกดได้ทั้งแถว สูง ≥56px ปุ่ม ≥44px
// ไม่มีตัวเลขเงินบน component นี้ (เบสเคาะ: ไม่คิดต้นทุนต่องานในระบบนี้)
export function ProductionStepsList({
  steps,
  canOutsource,
  canUpdateStep,
  canSupervise,
  meId,
  busy,
  onSelectStep,
  onOutsourceStep,
  onQuickPass,
  onStartStep,
  onCompleteStep,
}: ProductionStepsListProps) {
  // จัดกลุ่มตามเลน — เลนเรียงตามสายงานจริง ขั้นในเลนเรียงตาม sortOrder เดิม
  const byLane = new Map<ProductionLane, ProductionStep[]>();
  for (const step of steps) {
    const lane = laneOf(step.stepType);
    const list = byLane.get(lane) ?? [];
    list.push(step);
    byLane.set(lane, list);
  }

  // gate ฟิล์ม∧เสื้อของขั้นรีด — mirror บอร์ดเลน: ยังไม่บรรจบ = ไม่โชว์ปุ่มเริ่ม
  // บอกตรงๆ ว่ารออะไรแทน (server ไม่มีด่านนี้ — จอเป็นด่านเดียว ห้ามชวนช่างเริ่มงานผี)
  const pressGate = evaluateHeatPressGate(steps);

  return (
    <div className="space-y-4">
      {LANE_ORDER.filter((lane) => byLane.has(lane)).map((lane) => {
        const laneSteps = byLane.get(lane)!;
        const done = laneSteps.filter((s) => s.status === "COMPLETED").length;
        return (
          <div key={lane} className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {LANE_LABELS[lane]}
              </span>
              {OUTSOURCE_LANES.has(lane) && (
                <Badge variant="warning" size="sm">
                  ร้านนอก
                </Badge>
              )}
              <span className="ml-auto text-[11px] tabular-nums text-slate-400">
                {done}/{laneSteps.length}
              </span>
            </div>
            {laneSteps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                pressGate={pressGate}
                canOutsource={canOutsource}
                canUpdateStep={canUpdateStep}
                canSupervise={canSupervise}
                meId={meId}
                busy={busy}
                onSelectStep={onSelectStep}
                onOutsourceStep={onOutsourceStep}
                onQuickPass={onQuickPass}
                onStartStep={onStartStep}
                onCompleteStep={onCompleteStep}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StepRow({
  step,
  pressGate,
  canOutsource,
  canUpdateStep,
  canSupervise,
  meId,
  busy,
  onSelectStep,
  onOutsourceStep,
  onQuickPass,
  onStartStep,
  onCompleteStep,
}: {
  step: ProductionStep;
  pressGate: HeatPressGate;
  canOutsource: boolean;
  canUpdateStep: boolean;
  canSupervise: boolean;
  meId: string | null;
  busy: boolean;
  onSelectStep: (step: ProductionStep) => void;
  onOutsourceStep: (step: ProductionStep) => void;
  onQuickPass: (step: ProductionStep) => void;
  onStartStep: (step: ProductionStep) => void;
  onCompleteStep: (step: ProductionStep) => void;
}) {
  const latestOutsource = step.outsourceOrders[0];
  const hasActiveOutsource = step.outsourceOrders.some((os) =>
    OUTSOURCE_ACTIVE_STATUSES.includes(os.status)
  );
  // ช่างแตะได้เฉพาะงานตัวเอง/งานยังไม่มีเจ้าของ (ตรง planAutoClaim ฝั่ง server)
  const ownedByOther =
    !canSupervise && !!step.assignedTo && step.assignedTo.id !== meId;
  // QC ร้านไม่ผ่านใบล่าสุด → ช่างห้ามปิดขั้นทับ (ตรง assertStepClosable ฝั่ง server)
  const qcFailedBlocked =
    latestOutsource?.status === "QC_FAILED" && !canSupervise;
  const canSendOutsource =
    canOutsource && step.status !== "COMPLETED" && !hasActiveOutsource;
  // ผ่านรวด: ขั้นร้านนอกที่ยังไม่เสร็จ + ไม่ใช่งานคนอื่น + ไม่มีงานค้างที่ร้าน
  // (ค้างอยู่ต้องจบทางใบ outsource) — เดิมปุ่มโชว์บนงานคนอื่น/QC_FAILED แล้วกดได้ FORBIDDEN ขัด B8
  const canQuickPass =
    canUpdateStep &&
    !ownedByOther &&
    isOutsourceStep(step.stepType) &&
    step.status !== "COMPLETED" &&
    !hasActiveOutsource &&
    !qcFailedBlocked;

  // ปุ่มเร็ว UX1 (ทำเอง ไม่ใช่ร้านนอก) — ต้นไม้เงื่อนไขเดียวกับการ์ดบอร์ดเลนเป๊ะ:
  // งานคนอื่น (ช่าง) = ไม่โชว์ · อยู่ในรอบพิมพ์ = ลิงก์ไปหน้ารอบ · FAILED = เข้า dialog ·
  // มีใบ outsource ค้าง/QC ร้านไม่ผ่าน = server ปฏิเสธแน่ ห้ามโชว์ (B8) ·
  // GARMENT_PICK = ปิดผ่านการ์ดเบิกเสื้อเท่านั้น (ปิดมือ 1 แตะ = ข้ามการตัดยอดจอง Stock)
  const activePrintRun = step.printRunItems[0]?.printRun ?? null;
  const showQuickAction =
    canUpdateStep &&
    !ownedByOther &&
    !isOutsourceStep(step.stepType) &&
    step.stepType !== "GARMENT_PICK" &&
    !hasActiveOutsource &&
    !qcFailedBlocked &&
    step.status !== "COMPLETED" &&
    step.status !== "FAILED";
  // ขั้นรีดที่ฟิล์ม/เสื้อยังไม่บรรจบ — แทนปุ่มเริ่มด้วยแถบ "รออะไร" (mirror บอร์ดเลน)
  const heatPressWaiting =
    step.stepType === "HEAT_PRESS" && !pressGate.ready && step.status !== "FAILED";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectStep(step)}
      onKeyDown={(e) => {
        // Enter/Space บนปุ่มลูกต้องทำงานตามปุ่มนั้น ไม่ใช่เปิด dialog ของแถว
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectStep(step);
        }
      }}
      className="flex min-h-[56px] cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
          step.status === "COMPLETED"
            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
            : step.status === "IN_PROGRESS"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : step.status === "FAILED"
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {step.status === "COMPLETED" ? (
          <Check className="h-4 w-4" />
        ) : step.status === "IN_PROGRESS" ? (
          <Play className="h-3.5 w-3.5" />
        ) : step.status === "FAILED" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          step.sortOrder
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType}
          {/* บอก "บางส่วน" ได้ — ทำแล้ว/ทั้งหมด (โชว์เมื่อขั้นนับจำนวน) */}
          {step.qtyTotal !== null && step.qtyTotal > 0 && (
            <span
              className={`ml-2 text-xs font-normal tabular-nums ${
                step.qtyDone >= step.qtyTotal
                  ? "text-green-600 dark:text-green-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {step.qtyDone}/{step.qtyTotal}
            </span>
          )}
        </p>
        {step.assignedTo && (
          <span className="text-xs text-slate-500">{step.assignedTo.name}</span>
        )}
        {latestOutsource && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <Truck className="h-3 w-3 shrink-0" />
            {latestOutsource.vendor.name} ·{" "}
            {OUTSOURCE_STATUS_LABELS[latestOutsource.status] ?? latestOutsource.status}
            {latestOutsource.expectedBackAt &&
              !["QC_PASSED", "QC_FAILED"].includes(latestOutsource.status) &&
              ` · กำหนดรับ ${formatDate(latestOutsource.expectedBackAt)}`}
            {step.outsourceOrders.length > 1 && ` (รอบที่ ${step.outsourceOrders.length})`}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {canQuickPass && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onQuickPass(step);
            }}
          >
            <FastForward className="h-3 w-3" />
            ผ่านรวด
          </Button>
        )}
        {canSendOutsource && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onOutsourceStep(step);
            }}
          >
            <Truck className="h-3 w-3" />
            {step.outsourceOrders.length > 0 ? "ส่งแก้รอบใหม่" : "ส่งร้านนอก"}
          </Button>
        )}
        <Badge
          variant={
            STEP_STATUS_VARIANTS[step.status as keyof typeof STEP_STATUS_VARIANTS] ||
            "default"
          }
        >
          {STEP_STATUS_LABELS[step.status as keyof typeof STEP_STATUS_LABELS] ||
            step.status}
        </Badge>
        {step.qcPassed !== null && (
          <Badge variant={step.qcPassed ? "success" : "destructive"}>
            {step.qcPassed ? "QC ผ่าน" : "QC ไม่ผ่าน"}
          </Badge>
        )}
        {/* ทางเข้า dialog เต็ม (มอบงาน/QC/หมายเหตุ) — งานละเอียดย้ายมาหลังปุ่มนี้
            แถวทั้งแถวยังกดเปิด dialog ได้เหมือนเดิม (คง muscle memory) ·
            งานคนอื่น (ช่าง) ไม่โชว์ — บันทึกใน dialog จะโดน FORBIDDEN ทุกช่อง (B8) */}
        {canUpdateStep && !ownedByOther && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1 text-xs text-slate-500"
            onClick={(e) => {
              e.stopPropagation();
              onSelectStep(step);
            }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            เพิ่มเติม
          </Button>
        )}
      </div>

      {/* ปุ่มเร็ว UX1 — มือถือเต็มแถวสูง 44px (เป้านิ้ว DESIGN.md) · จอใหญ่ปุ่มปกติ
          stopPropagation ที่กล่อง — กดปุ่มต้องไม่เผลอเปิด dialog เต็ม */}
      {showQuickAction && (
        <div className="w-full sm:ml-auto sm:w-auto" onClick={(e) => e.stopPropagation()}>
          {heatPressWaiting ? (
            // รีดยังเริ่มไม่ได้จริง (ฟิล์ม/เสื้อยังไม่บรรจบ) — บอกว่ารออะไรแทนปุ่ม
            // server ไม่มีด่านนี้ ปุ่ม 1 แตะจะพางานเข้า IN_PROGRESS ผี (mirror บอร์ดเลน)
            <div className="space-y-1.5">
              {pressGate.waitingOn.map((w) => (
                <p
                  key={w}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          ) : activePrintRun ? (
            // ขั้นอยู่ในรอบพิมพ์ค้าง — updateStep ถูก server บล็อก จึงเป็นลิงก์ไปหน้ารอบแทน
            // (pattern เดียวกับการ์ดบอร์ดเลน — เดิมหน้านี้เงียบ ช่างเข้า dialog แล้วเจอ error)
            <Button variant="outline" size="sm" asChild className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto">
              <Link href="/production/print-runs">
                <Printer className="h-3.5 w-3.5" />
                รอบพิมพ์ {activePrintRun.runNumber}
              </Link>
            </Button>
          ) : step.status === "IN_PROGRESS" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onCompleteStep(step)}
              className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              เสร็จขั้นนี้
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onStartStep(step)}
              className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
            >
              <Play className="h-3.5 w-3.5" />
              {/* ช่างกดบนขั้นว่าง = server claim ให้เป็นชื่อตัวเองจริง จึงใช้คำว่า "รับงาน"
                  ได้ไม่โกหก · หัวหน้า claim อัตโนมัติไม่เกิด (มอบงานผ่าน "เพิ่มเติม") = "เริ่มทำ" */}
              {!step.assignedTo && !canSupervise ? "รับงานนี้" : "เริ่มทำ"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
