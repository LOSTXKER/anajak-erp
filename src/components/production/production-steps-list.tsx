"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STEP_STATUS_LABELS, STEP_STATUS_VARIANTS } from "@/lib/status-config";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { Check, Play, AlertTriangle, Truck } from "lucide-react";
import {
  OUTSOURCE_STATUS_LABELS,
  OUTSOURCE_ACTIVE_STATUSES,
} from "./step-outsource-dialog";
import type { ProductionStep } from "./types";

interface ProductionStepsListProps {
  steps: ProductionStep[];
  // เงิน (actualCost) ห้ามถึงตาช่าง — server ปิดขาเขียนแล้ว ฝั่งโชว์ต้อง gate ด้วย
  isProductionStaff: boolean;
  canOutsource: boolean;
  onSelectStep: (step: ProductionStep) => void;
  onOutsourceStep: (step: ProductionStep) => void;
}

// แถวขั้นตอนผลิต — หน้า ops ช่างใช้บนมือถือหน้างาน: แถวกดได้ทั้งแถว สูง ≥56px ปุ่ม ≥44px
export function ProductionStepsList({
  steps,
  isProductionStaff,
  canOutsource,
  onSelectStep,
  onOutsourceStep,
}: ProductionStepsListProps) {
  return (
    <div className="space-y-2">
      {steps.map((step) => {
        const latestOutsource = step.outsourceOrders[0];
        const canSendOutsource =
          canOutsource &&
          step.status !== "COMPLETED" &&
          !step.outsourceOrders.some((os) =>
            OUTSOURCE_ACTIVE_STATUSES.includes(os.status)
          );

        return (
          <div
            key={step.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectStep(step)}
            onKeyDown={(e) => {
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
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {step.assignedTo && (
                  <span className="text-xs text-slate-500">{step.assignedTo.name}</span>
                )}
                {/* ต้นทุนจริง = เงิน — โชว์เฉพาะหัวหน้าขึ้นไป (อุดรั่วเดิมที่ช่างเห็น) */}
                {!isProductionStaff && step.actualCost != null && step.actualCost > 0 && (
                  <span className="text-xs text-slate-400">
                    {formatCurrency(step.actualCost)}
                  </span>
                )}
              </div>
              {latestOutsource && (
                <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  <Truck className="h-3 w-3 shrink-0" />
                  {latestOutsource.vendor.name} ·{" "}
                  {OUTSOURCE_STATUS_LABELS[latestOutsource.status] ?? latestOutsource.status}
                  {latestOutsource.expectedBackAt &&
                    !["QC_PASSED", "QC_FAILED"].includes(latestOutsource.status) &&
                    ` · กำหนดรับ ${formatDate(latestOutsource.expectedBackAt)}`}
                  {step.outsourceOrders.length > 1 &&
                    ` (รอบที่ ${step.outsourceOrders.length})`}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
