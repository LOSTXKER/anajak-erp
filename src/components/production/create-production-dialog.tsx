"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  STEP_TYPE_LABELS,
  STEP_TYPE_OPTIONS,
  suggestProductionPlan,
  laneOf,
  isOutsourceStep,
  LANE_LABELS,
} from "@/lib/production-steps";
import { AlertTriangle, Factory, Loader2, X } from "lucide-react";
import type { ProductionStepType } from "@prisma/client";

// ใบผลิต = แค่ยืนยันสายงาน ไม่ใช่ฟอร์มกรอก (เบสชี้ 2026-06-12: "ต้องกรอกแบบนี้หรอ"):
// ระบบเดาสายงานจากเนื้อออเดอร์ครบ 3 อย่าง (วิธีพิมพ์ + แหล่งเสื้อ + ป้ายคอ) —
// โชว์เป็นรายการกลุ่มตามเลน ลบ/เพิ่มได้ แล้วกดสร้าง จบ
// ขั้นร้านนอกติดป้าย "ร้านนอก" — เปิดแล้วกด "ผ่านรวด" ได้ที่หน้าใบผลิต/กระดาน

type StepFormItem = {
  stepType: string;
  customStepName?: string;
};

interface CreateProductionDialogProps {
  orderId: string;
  onClose: () => void;
  onCreated?: (production: { id: string }) => void;
}

export function CreateProductionDialog({
  orderId,
  onClose,
  onCreated,
}: CreateProductionDialogProps) {
  // gcTime 0 = ไม่ใช้ cache ข้ามการเปิด dialog — แก้ออเดอร์แล้วเปิด dialog ซ้ำต้องได้
  // สายงานจากข้อมูลสดเสมอ (StepBuilder seed ครั้งเดียวตอน mount ถ้าได้ cache เก่า =
  // แผนผลิตขาดสายที่เพิ่งเพิ่ม โดยไม่มีอะไรฟ้อง)
  const { data: context, isLoading } = trpc.production.orderContext.useQuery(
    { orderId },
    { gcTime: 0, staleTime: 0 }
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เปิดใบผลิต</DialogTitle>
          <DialogDescription>
            {context ? `${context.orderNumber} · ${context.title} — ` : ""}
            สายงานตั้งให้ตามเนื้องานแล้ว (เสื้อ/เทคนิค/ป้าย) ลบ/เพิ่มได้ถ้าไม่ตรง
          </DialogDescription>
        </DialogHeader>

        {/* ด่านพร้อมผลิตยังไม่ผ่าน — soft-gate: เปิดได้ (งานด่วน/เคสยกเว้น) แต่ต้องเห็นว่าติดอะไร */}
        {context?.readiness && !context.readiness.ready && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/40">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              งานนี้ยังติดด่านพร้อมผลิต
            </p>
            <ul className="space-y-0.5 pl-5 text-amber-700 dark:text-amber-300/90">
              {context.readiness.checks
                .filter((c) => !c.ok)
                .map((c) => (
                  <li key={c.key} className="list-disc">
                    {c.label}: {c.detail}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* รอ context ก่อน seed ขั้นตอน — StepBuilder mount หลังได้ค่า จึง seed ตอน mount
            (ไม่ใช้ effect-setState — react-compiler clean) */}
        {isLoading || !context ? (
          <div className="space-y-1.5 py-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        ) : (
          <StepBuilder
            orderId={orderId}
            printTypes={context.printTypes}
            itemSources={context.itemSources}
            addonTypes={context.addonTypes}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepBuilder({
  orderId,
  printTypes,
  itemSources,
  addonTypes,
  onClose,
  onCreated,
}: {
  orderId: string;
  printTypes: string[];
  itemSources: string[];
  addonTypes: string[];
  onClose: () => void;
  onCreated?: (production: { id: string }) => void;
}) {
  // seed ครั้งเดียวตอน mount — mount หลัง context พร้อมแล้ว
  const [steps, setSteps] = useState<StepFormItem[]>(() =>
    suggestProductionPlan({ printTypes, itemSources, addonTypes }).map((stepType) => ({
      stepType,
    }))
  );

  const utils = trpc.useUtils();
  const createProduction = useMutationWithInvalidation(trpc.production.create, {
    invalidate: [
      utils.production.kanban,
      utils.production.getByOrderId,
      utils.order.getById,
      utils.task.myToday,
    ],
    onSuccess: (production: { id: string }) => {
      onClose();
      onCreated?.(production);
    },
  });

  function addStep(stepType: string) {
    setSteps((prev) => [...prev, { stepType }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCreate() {
    createProduction.mutate({
      orderId,
      steps: steps.map((s, i) => ({
        stepType: s.stepType as ProductionStepType,
        customStepName: s.customStepName || undefined,
        sortOrder: i + 1,
      })),
    });
  }

  const hasUnnamedCustom = steps.some(
    (s) => s.stepType === "CUSTOM" && !s.customStepName?.trim()
  );

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          {steps.map((step, index) => {
            // หัวเลนเมื่อสายงานเปลี่ยน — อ่านปุ๊บรู้เลยว่ากลุ่มไหนคือเตรียมเสื้อ/เทคนิค/ปิดงาน
            const lane = laneOf(step.stepType);
            const prevLane = index > 0 ? laneOf(steps[index - 1].stepType) : null;
            const showLaneHeader = lane !== prevLane;
            return (
              <div key={index}>
                {showLaneHeader && (
                  <p className="mb-1 mt-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 first:mt-0">
                    {LANE_LABELS[lane]}
                  </p>
                )}
                <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {index + 1}
                  </span>
                  {step.stepType === "CUSTOM" ? (
                    <Input
                      type="text"
                      placeholder="ชื่อขั้นตอน..."
                      value={step.customStepName || ""}
                      autoFocus
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[index] = { ...updated[index], customStepName: e.target.value };
                        setSteps(updated);
                      }}
                      className="h-8 flex-1"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {STEP_TYPE_LABELS[step.stepType] ?? step.stepType}
                    </span>
                  )}
                  {isOutsourceStep(step.stepType) && (
                    <Badge variant="warning" size="sm">
                      ร้านนอก
                    </Badge>
                  )}
                  {steps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="ลบขั้นตอน"
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                      onClick={() => removeStep(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* เพิ่มขั้นตอน — เลือกแล้วต่อท้ายทันที (ค่า reset กลับ) */}
        <NativeSelect
          value=""
          onChange={(e) => {
            if (e.target.value) addStep(e.target.value);
            e.target.value = "";
          }}
          className="w-full text-slate-500"
        >
          <option value="">+ เพิ่มขั้นตอน...</option>
          {STEP_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {STEP_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {createProduction.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {createProduction.error.message}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          onClick={handleCreate}
          disabled={steps.length === 0 || hasUnnamedCustom || createProduction.isPending}
          className="gap-1.5"
        >
          {createProduction.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Factory className="h-4 w-4" />
          )}
          สร้างใบผลิต ({steps.length} ขั้นตอน)
        </Button>
      </DialogFooter>
    </>
  );
}
