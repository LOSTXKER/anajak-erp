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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  STEP_TYPE_LABELS,
  STEP_TYPE_OPTIONS,
  suggestStepsFromPrintTypes,
} from "@/lib/production-steps";
import { Factory, Plus, Loader2, Trash2 } from "lucide-react";
import type { ProductionStepType } from "@prisma/client";

type StepFormItem = {
  stepType: string;
  customStepName?: string;
  sortOrder: number;
  estimatedCost?: string;
  notes?: string;
};

interface CreateProductionDialogProps {
  orderId: string;
  orderLabel?: string; // เลขออเดอร์/ชื่องาน — โชว์ใน dialog ให้รู้ว่ากำลังเปิดใบของงานไหน
  // วิธีพิมพ์จริงในออเดอร์ (OrderItemPrint.printType) — ใช้แนะนำขั้นตอนผลิตให้ตรงงาน
  printTypes: string[];
  onClose: () => void;
  onCreated?: (production: { id: string }) => void;
}

// dialog สร้างใบผลิต (step builder) — mount ใหม่ทุกครั้งที่เปิด
// ชุดขั้นตอนแนะนำ seed จาก printTypes ตอน mount (ผู้เรียกส่งของสดมาเอง)
export function CreateProductionDialog({
  orderId,
  orderLabel,
  printTypes,
  onClose,
  onCreated,
}: CreateProductionDialogProps) {
  const [steps, setSteps] = useState<StepFormItem[]>(() =>
    suggestStepsFromPrintTypes(printTypes).map((stepType, i) => ({
      stepType,
      sortOrder: i + 1,
      estimatedCost: "",
      notes: "",
    }))
  );

  const utils = trpc.useUtils();
  const createProduction = useMutationWithInvalidation(trpc.production.create, {
    invalidate: [
      utils.production.queue,
      utils.production.board,
      utils.production.getByOrderId,
      utils.order.getById,
      utils.task.myToday,
    ],
    onSuccess: (production: { id: string }) => {
      onClose();
      onCreated?.(production);
    },
  });

  function addStep() {
    setSteps([
      ...steps,
      { stepType: "CUSTOM", sortOrder: steps.length + 1, estimatedCost: "", notes: "" },
    ]);
  }

  function removeStep(index: number) {
    setSteps(
      steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i + 1 }))
    );
  }

  function handleCreate() {
    createProduction.mutate({
      orderId,
      steps: steps.map((s) => ({
        stepType: s.stepType as ProductionStepType,
        customStepName: s.customStepName,
        sortOrder: s.sortOrder,
        estimatedCost: s.estimatedCost ? parseFloat(s.estimatedCost) : undefined,
        notes: s.notes || undefined,
      })),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>สร้างใบผลิต</DialogTitle>
          <DialogDescription>
            {orderLabel
              ? `กำหนดขั้นตอนการผลิตสำหรับ ${orderLabel}`
              : "กำหนดขั้นตอนการผลิตสำหรับออเดอร์นี้"}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {step.sortOrder}
                  </span>
                  <Select
                    value={step.stepType}
                    onValueChange={(v) => {
                      const updated = [...steps];
                      updated[index] = { ...updated[index], stepType: v };
                      setSteps(updated);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {STEP_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {step.stepType === "CUSTOM" && (
                <Input
                  type="text"
                  placeholder="ชื่อขั้นตอน..."
                  value={step.customStepName || ""}
                  onChange={(e) => {
                    const updated = [...steps];
                    updated[index] = { ...updated[index], customStepName: e.target.value };
                    setSteps(updated);
                  }}
                  className="mt-2"
                />
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="ต้นทุนประมาณ (บาท)"
                  value={step.estimatedCost || ""}
                  onChange={(e) => {
                    const updated = [...steps];
                    updated[index] = { ...updated[index], estimatedCost: e.target.value };
                    setSteps(updated);
                  }}
                  min="0"
                />
                <Input
                  type="text"
                  placeholder="หมายเหตุ"
                  value={step.notes || ""}
                  onChange={(e) => {
                    const updated = [...steps];
                    updated[index] = { ...updated[index], notes: e.target.value };
                    setSteps(updated);
                  }}
                />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addStep} className="w-full gap-1">
            <Plus className="h-3.5 w-3.5" />
            เพิ่มขั้นตอน
          </Button>
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
            disabled={steps.length === 0 || createProduction.isPending}
            className="gap-1.5"
          >
            {createProduction.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Factory className="h-4 w-4" />
            )}
            สร้างใบผลิต
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
