"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Factory,
  Plus,
  Loader2,
  Check,
  X,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface OrderProductionSectionProps {
  orderId: string;
  internalStatus: string;
}

const STEP_TYPE_LABELS: Record<string, string> = {
  PATTERN_MAKING: "ตัดแพทเทิร์น",
  SCREEN_PRINTING: "สกรีน",
  TAGGING: "เย็บป้าย",
  PACKAGING: "แพ็ค",
  EMBROIDERY: "ปักลาย",
  SPECIAL_PRINT: "พิมพ์พิเศษ",
  SEWING: "เย็บ",
  CUSTOM: "อื่นๆ",
};

const STEP_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอดำเนินการ",
  IN_PROGRESS: "กำลังทำ",
  COMPLETED: "เสร็จแล้ว",
  ON_HOLD: "พักไว้",
  FAILED: "มีปัญหา",
};

const STEP_STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "purple"> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  ON_HOLD: "warning",
  FAILED: "destructive",
};

const DEFAULT_STEPS = [
  { stepType: "PATTERN_MAKING" as const, sortOrder: 1 },
  { stepType: "SCREEN_PRINTING" as const, sortOrder: 2 },
  { stepType: "TAGGING" as const, sortOrder: 3 },
  { stepType: "PACKAGING" as const, sortOrder: 4 },
];

type StepFormItem = {
  stepType: string;
  customStepName?: string;
  sortOrder: number;
  estimatedCost?: string;
  notes?: string;
};

export function OrderProductionSection({
  orderId,
  internalStatus,
}: OrderProductionSectionProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepFormItem[]>(
    DEFAULT_STEPS.map((s) => ({ ...s, estimatedCost: "", notes: "" }))
  );

  // Step update form
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateCost, setUpdateCost] = useState("");
  const [updateQcPassed, setUpdateQcPassed] = useState<string>("");
  const [updateQcNotes, setUpdateQcNotes] = useState("");

  const utils = trpc.useUtils();
  const productions = trpc.production.getByOrderId.useQuery({ orderId });

  const createProduction = trpc.production.create.useMutation({
    onSuccess: () => {
      utils.production.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowCreateDialog(false);
    },
  });

  const updateStep = trpc.production.updateStep.useMutation({
    onSuccess: () => {
      utils.production.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowUpdateDialog(null);
    },
  });

  const canCreate =
    ["PRODUCTION_QUEUE", "DESIGN_APPROVED", "CONFIRMED"].includes(internalStatus) &&
    (!productions.data || productions.data.length === 0);

  const hasProduction = productions.data && productions.data.length > 0;

  // Show section if there is a production or status suggests production phase
  if (
    !hasProduction &&
    ![
      "PRODUCTION_QUEUE",
      "DESIGN_APPROVED",
      "CONFIRMED",
      "PRODUCING",
      "QUALITY_CHECK",
      "PACKING",
    ].includes(internalStatus)
  ) {
    return null;
  }

  function addStep() {
    setSteps([
      ...steps,
      {
        stepType: "CUSTOM",
        sortOrder: steps.length + 1,
        estimatedCost: "",
        notes: "",
      },
    ]);
  }

  function removeStep(index: number) {
    setSteps(
      steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, sortOrder: i + 1 }))
    );
  }

  function handleCreate() {
    createProduction.mutate({
      orderId,
      steps: steps.map((s) => ({
        stepType: s.stepType as any,
        customStepName: s.customStepName,
        sortOrder: s.sortOrder,
        estimatedCost: s.estimatedCost ? parseFloat(s.estimatedCost) : undefined,
        notes: s.notes || undefined,
      })),
    });
  }

  function openUpdateDialog(step: any) {
    setShowUpdateDialog(step.id);
    setUpdateStatus(step.status);
    setUpdateNotes(step.notes || "");
    setUpdateCost(step.actualCost?.toString() || "");
    setUpdateQcPassed(step.qcPassed === null ? "" : step.qcPassed ? "true" : "false");
    setUpdateQcNotes(step.qcNotes || "");
  }

  function handleUpdate() {
    if (!showUpdateDialog) return;
    updateStep.mutate({
      stepId: showUpdateDialog,
      status: updateStatus as any || undefined,
      actualCost: updateCost ? parseFloat(updateCost) : undefined,
      notes: updateNotes || undefined,
      qcPassed: updateQcPassed === "" ? undefined : updateQcPassed === "true",
      qcNotes: updateQcNotes || undefined,
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Factory className="h-4 w-4" />
              การผลิต
            </CardTitle>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                สร้างใบผลิต
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasProduction ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีใบผลิต
            </p>
          ) : (
            productions.data!.map((prod: any) => {
              const completedSteps = prod.steps.filter(
                (s: any) => s.status === "COMPLETED"
              ).length;
              const totalSteps = prod.steps.length;
              const progressPct =
                totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

              return (
                <div key={prod.id} className="space-y-3">
                  {/* Progress summary */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        ความคืบหน้า
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {completedSteps}/{totalSteps} ขั้นตอน ({progressPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="space-y-2">
                    {prod.steps.map((step: any) => (
                      <div
                        key={step.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                        onClick={() => openUpdateDialog(step)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
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
                              <Check className="h-3.5 w-3.5" />
                            ) : step.status === "IN_PROGRESS" ? (
                              <Play className="h-3 w-3" />
                            ) : step.status === "FAILED" ? (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            ) : (
                              step.sortOrder
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {step.customStepName ||
                                STEP_TYPE_LABELS[step.stepType] ||
                                step.stepType}
                            </p>
                            <div className="flex items-center gap-2">
                              {step.assignedTo && (
                                <span className="text-xs text-slate-500">
                                  {step.assignedTo.name}
                                </span>
                              )}
                              {step.actualCost != null && step.actualCost > 0 && (
                                <span className="text-xs text-slate-400">
                                  {formatCurrency(step.actualCost)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              STEP_STATUS_VARIANTS[step.status] || "default"
                            }
                          >
                            {STEP_STATUS_LABELS[step.status] || step.status}
                          </Badge>
                          {step.qcPassed !== null && (
                            <Badge
                              variant={step.qcPassed ? "success" : "destructive"}
                            >
                              {step.qcPassed ? "QC ผ่าน" : "QC ไม่ผ่าน"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cost summary */}
                  {prod.totalCost > 0 && (
                    <div className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                      <span className="text-slate-500">ต้นทุนรวม</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {formatCurrency(prod.totalCost)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create Production Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>สร้างใบผลิต</DialogTitle>
            <DialogDescription>
              กำหนดขั้นตอนการผลิตสำหรับออเดอร์นี้
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
                        <SelectItem value="PATTERN_MAKING">ตัดแพทเทิร์น</SelectItem>
                        <SelectItem value="SCREEN_PRINTING">สกรีน</SelectItem>
                        <SelectItem value="TAGGING">เย็บป้าย</SelectItem>
                        <SelectItem value="PACKAGING">แพ็ค</SelectItem>
                        <SelectItem value="EMBROIDERY">ปักลาย</SelectItem>
                        <SelectItem value="SPECIAL_PRINT">พิมพ์พิเศษ</SelectItem>
                        <SelectItem value="SEWING">เย็บ</SelectItem>
                        <SelectItem value="CUSTOM">อื่นๆ</SelectItem>
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
                  <input
                    type="text"
                    placeholder="ชื่อขั้นตอน..."
                    value={step.customStepName || ""}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[index] = {
                        ...updated[index],
                        customStepName: e.target.value,
                      };
                      setSteps(updated);
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="ต้นทุนประมาณ (บาท)"
                    value={step.estimatedCost || ""}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[index] = {
                        ...updated[index],
                        estimatedCost: e.target.value,
                      };
                      setSteps(updated);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    min="0"
                  />
                  <input
                    type="text"
                    placeholder="หมายเหตุ"
                    value={step.notes || ""}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[index] = {
                        ...updated[index],
                        notes: e.target.value,
                      };
                      setSteps(updated);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addStep}
              className="w-full gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่มขั้นตอน
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
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

      {/* Update Step Dialog */}
      <Dialog
        open={showUpdateDialog !== null}
        onOpenChange={(open) => !open && setShowUpdateDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>อัปเดตขั้นตอน</DialogTitle>
            <DialogDescription>เปลี่ยนสถานะหรือบันทึกข้อมูลเพิ่มเติม</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                สถานะ
              </label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
                  <SelectItem value="IN_PROGRESS">กำลังทำ</SelectItem>
                  <SelectItem value="COMPLETED">เสร็จแล้ว</SelectItem>
                  <SelectItem value="ON_HOLD">พักไว้</SelectItem>
                  <SelectItem value="FAILED">มีปัญหา</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ต้นทุนจริง (บาท)
              </label>
              <input
                type="number"
                value={updateCost}
                onChange={(e) => setUpdateCost(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                QC
              </label>
              <Select value={updateQcPassed} onValueChange={setUpdateQcPassed}>
                <SelectTrigger>
                  <SelectValue placeholder="ยังไม่ได้ตรวจ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">ผ่าน</SelectItem>
                  <SelectItem value="false">ไม่ผ่าน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {updateQcPassed === "false" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  หมายเหตุ QC
                </label>
                <textarea
                  value={updateQcNotes}
                  onChange={(e) => setUpdateQcNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="ระบุปัญหาที่พบ..."
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                หมายเหตุ
              </label>
              <textarea
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="หมายเหตุ..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpdateDialog(null)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateStep.isPending}
              className="gap-1.5"
            >
              {updateStep.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
