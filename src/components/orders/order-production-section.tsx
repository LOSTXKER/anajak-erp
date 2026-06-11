"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { STEP_STATUS_LABELS, STEP_STATUS_VARIANTS } from "@/lib/status-config";
import {
  STEP_TYPE_LABELS,
  STEP_TYPE_OPTIONS,
  suggestStepsFromPrintTypes,
} from "@/lib/production-steps";
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
  Truck,
} from "lucide-react";
import type { ProductionStepType, StepStatus } from "@prisma/client";
import type { RouterOutput } from "@/lib/trpc";

type Production = RouterOutput["production"]["getByOrderId"][number];
type ProductionStep = Production["steps"][number];

interface OrderProductionSectionProps {
  orderId: string;
  internalStatus: string;
  // วิธีพิมพ์จริงในออเดอร์ (OrderItemPrint.printType) — ใช้แนะนำขั้นตอนผลิตให้ตรงงาน
  printTypes: string[];
}

const OUTSOURCE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  SENT: "ส่งร้านแล้ว",
  IN_PROGRESS: "ร้านกำลังทำ",
  COMPLETED: "ร้านทำเสร็จ",
  RECEIVED_BACK: "รับกลับแล้ว รอ QC",
  QC_PASSED: "QC ผ่าน",
  QC_FAILED: "QC ไม่ผ่าน",
};

// งานที่ยังค้างอยู่กับร้าน/รอตัดสิน — ห้ามเปิดรอบใหม่ซ้อน
const OUTSOURCE_ACTIVE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS", "COMPLETED", "RECEIVED_BACK"];

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
  printTypes,
}: OrderProductionSectionProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepFormItem[]>(() =>
    suggestStepsFromPrintTypes(printTypes).map((stepType, i) => ({
      stepType,
      sortOrder: i + 1,
      estimatedCost: "",
      notes: "",
    }))
  );

  // Step update form
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateCost, setUpdateCost] = useState("");
  const [originalCost, setOriginalCost] = useState("");
  const [updateQcPassed, setUpdateQcPassed] = useState<string>("");
  const [updateQcNotes, setUpdateQcNotes] = useState("");

  // Outsource form (ส่งขั้นตอนให้ร้านนอก เช่น silkscreen)
  const [outsourceStepId, setOutsourceStepId] = useState<string | null>(null);
  const [osVendorId, setOsVendorId] = useState("");
  const [osDescription, setOsDescription] = useState("");
  const [osQuantity, setOsQuantity] = useState("");
  const [osUnitCost, setOsUnitCost] = useState("");
  const [osExpectedBack, setOsExpectedBack] = useState("");
  const [osNotes, setOsNotes] = useState("");

  const utils = trpc.useUtils();
  const productions = trpc.production.getByOrderId.useQuery({ orderId });
  const { data: me } = trpc.user.me.useQuery();
  // ฝ่ายผลิตห้ามแตะต้นทุนจริง (server บังคับ) — ซ่อน field ฝั่ง UI ให้สอดคล้อง
  const isProductionStaff = me?.role === "PRODUCTION_STAFF";
  // ส่งงานร้านนอก = ผูกต้นทุน — ผู้จัดการขึ้นไป (ตรง managerUp ฝั่ง server)
  const canOutsource = !!me && ["OWNER", "MANAGER"].includes(me.role);

  const vendors = trpc.outsource.listVendors.useQuery(
    {},
    { enabled: outsourceStepId !== null }
  );

  const createProduction = useMutationWithInvalidation(trpc.production.create, {
    invalidate: [utils.production.getByOrderId, utils.order.getById],
    onSuccess: () => setShowCreateDialog(false),
  });

  const updateStep = useMutationWithInvalidation(trpc.production.updateStep, {
    invalidate: [utils.production.getByOrderId, utils.order.getById],
    onSuccess: () => setShowUpdateDialog(null),
  });

  const createOutsource = useMutationWithInvalidation(trpc.outsource.createOrder, {
    invalidate: [utils.production.getByOrderId, utils.outsource.listOrders],
    onSuccess: () => {
      setOutsourceStepId(null);
      toast.success("สร้างงาน outsource แล้ว — ติดตามสถานะได้ที่หน้า Outsource");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "สร้างงาน outsource ไม่สำเร็จ");
    },
  });

  // คำนวณชุดแนะนำใหม่ทุกครั้งที่เปิด dialog — กันค้างชุดเก่าเมื่อมีคนแก้ลายพิมพ์หลัง mount
  function openCreateDialog() {
    setSteps(
      suggestStepsFromPrintTypes(printTypes).map((stepType, i) => ({
        stepType,
        sortOrder: i + 1,
        estimatedCost: "",
        notes: "",
      }))
    );
    setShowCreateDialog(true);
  }

  function openOutsourceDialog(step: ProductionStep) {
    setOsVendorId("");
    setOsDescription(
      step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType
    );
    setOsQuantity("");
    setOsUnitCost("");
    setOsExpectedBack("");
    setOsNotes("");
    setOutsourceStepId(step.id);
  }

  // เปิดใบผลิต = อำนาจหัวหน้า (server บังคับ managerUp) — ซ่อนปุ่มให้ตรง server
  // role อื่นเคยเห็นปุ่ม กรอก dialog ครบแล้วโดน FORBIDDEN (audit ข้อ 28)
  const canCreate =
    !!me &&
    ["OWNER", "MANAGER"].includes(me.role) &&
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
        stepType: s.stepType as ProductionStepType,
        customStepName: s.customStepName,
        sortOrder: s.sortOrder,
        estimatedCost: s.estimatedCost ? parseFloat(s.estimatedCost) : undefined,
        notes: s.notes || undefined,
      })),
    });
  }

  function openUpdateDialog(step: ProductionStep) {
    setShowUpdateDialog(step.id);
    setUpdateStatus(step.status);
    setUpdateNotes(step.notes || "");
    setUpdateCost(step.actualCost?.toString() || "");
    setOriginalCost(step.actualCost?.toString() || "");
    setUpdateQcPassed(step.qcPassed === null ? "" : step.qcPassed ? "true" : "false");
    setUpdateQcNotes(step.qcNotes || "");
  }

  function handleUpdate() {
    if (!showUpdateDialog) return;
    // ส่ง actualCost เฉพาะเมื่อค่าเปลี่ยนจริง — ค่า pre-fill เดิมที่ติดไปกับ
    // request จะทำให้ฝ่ายผลิตโดน FORBIDDEN ทั้งที่แค่จะอัปเดตสถานะ
    const costChanged = updateCost !== originalCost;
    updateStep.mutate({
      stepId: showUpdateDialog,
      status: (updateStatus as StepStatus) || undefined,
      actualCost:
        costChanged && updateCost ? parseFloat(updateCost) : undefined,
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
                onClick={openCreateDialog}
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
            productions.data!.map((prod) => {
              const completedSteps = prod.steps.filter(
                (s) => s.status === "COMPLETED"
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
                    {prod.steps.map((step) => (
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
                            {step.outsourceOrders.length > 0 && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                <Truck className="h-3 w-3" />
                                {step.outsourceOrders[0].vendor.name} ·{" "}
                                {OUTSOURCE_STATUS_LABELS[step.outsourceOrders[0].status] ??
                                  step.outsourceOrders[0].status}
                                {step.outsourceOrders[0].expectedBackAt &&
                                  !["QC_PASSED", "QC_FAILED"].includes(
                                    step.outsourceOrders[0].status
                                  ) &&
                                  ` · กำหนดรับ ${formatDate(step.outsourceOrders[0].expectedBackAt)}`}
                                {step.outsourceOrders.length > 1 &&
                                  ` (รอบที่ ${step.outsourceOrders.length})`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canOutsource &&
                            step.status !== "COMPLETED" &&
                            !step.outsourceOrders.some((os) =>
                              OUTSOURCE_ACTIVE_STATUSES.includes(os.status)
                            ) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openOutsourceDialog(step);
                                }}
                              >
                                <Truck className="h-3 w-3" />
                                {step.outsourceOrders.length > 0 ? "ส่งแก้รอบใหม่" : "ส่งร้านนอก"}
                              </Button>
                            )}
                          <Badge
                            variant={
                              STEP_STATUS_VARIANTS[step.status as keyof typeof STEP_STATUS_VARIANTS] || "default"
                            }
                          >
                            {STEP_STATUS_LABELS[step.status as keyof typeof STEP_STATUS_LABELS] || step.status}
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

                  {/* ต้นทุนจริงไหลเข้า "ต้นทุน & กำไร" ของออเดอร์อัตโนมัติแล้ว
                      (CostEntry ผ่าน sourceRef) — กล่องสรุปต่อใบผลิตเดิมเป็น field ตาย ถอดทิ้ง */}
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
                      updated[index] = {
                        ...updated[index],
                        customStepName: e.target.value,
                      };
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
                      updated[index] = {
                        ...updated[index],
                        estimatedCost: e.target.value,
                      };
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
                      updated[index] = {
                        ...updated[index],
                        notes: e.target.value,
                      };
                      setSteps(updated);
                    }}
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
          {createProduction.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {createProduction.error.message}
            </p>
          )}
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
            {!isProductionStaff && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ต้นทุนจริง (บาท)
                </label>
                <Input
                  type="number"
                  value={updateCost}
                  onChange={(e) => setUpdateCost(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
              </div>
            )}
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
                <Textarea
                  value={updateQcNotes}
                  onChange={(e) => setUpdateQcNotes(e.target.value)}
                  rows={2}
                  placeholder="ระบุปัญหาที่พบ..."
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                หมายเหตุ
              </label>
              <Textarea
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                rows={2}
                placeholder="หมายเหตุ..."
              />
            </div>
            {updateStep.error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {updateStep.error.message}
              </p>
            )}
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

      {/* Outsource Dialog — ส่งขั้นตอนนี้ให้ร้านนอก */}
      <Dialog
        open={outsourceStepId !== null}
        onOpenChange={(open) => !open && setOutsourceStepId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ส่งงานร้านนอก</DialogTitle>
            <DialogDescription>
              สร้างใบงาน outsource ผูกกับขั้นตอนนี้ — ติดตาม/รับกลับ/QC ที่หน้า Outsource
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ร้าน (Vendor)
              </label>
              <Select value={osVendorId} onValueChange={setOsVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกร้าน..." />
                </SelectTrigger>
                <SelectContent>
                  {vendors.data?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vendors.data?.length === 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ยังไม่มีร้านในระบบ — เพิ่มได้ที่หน้า Outsource
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                รายละเอียดงาน
              </label>
              <Input
                value={osDescription}
                onChange={(e) => setOsDescription(e.target.value)}
                placeholder="เช่น สกรีนหน้าอก 2 สี"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  จำนวน (ชิ้น)
                </label>
                <Input
                  type="number"
                  value={osQuantity}
                  onChange={(e) => setOsQuantity(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ค่าจ้าง/ชิ้น (บาท)
                </label>
                <Input
                  type="number"
                  value={osUnitCost}
                  onChange={(e) => setOsUnitCost(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  กำหนดรับกลับ
                </label>
                <Input
                  type="date"
                  value={osExpectedBack}
                  onChange={(e) => setOsExpectedBack(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  หมายเหตุ
                </label>
                <Input
                  value={osNotes}
                  onChange={(e) => setOsNotes(e.target.value)}
                  placeholder="เช่น ส่งพร้อมบล็อกเดิม"
                />
              </div>
            </div>
            {(parseFloat(osQuantity) || 0) > 0 && (parseFloat(osUnitCost) || 0) > 0 && (
              <p className="rounded-lg bg-slate-50 p-2.5 text-right text-sm dark:bg-slate-800/50">
                ค่าจ้างรวม:{" "}
                <span className="font-semibold">
                  {formatCurrency((parseFloat(osQuantity) || 0) * (parseFloat(osUnitCost) || 0))}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutsourceStepId(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() =>
                outsourceStepId &&
                createOutsource.mutate({
                  productionStepId: outsourceStepId,
                  vendorId: osVendorId,
                  description: osDescription,
                  quantity: parseInt(osQuantity, 10) || 0,
                  unitCost: parseFloat(osUnitCost) || 0,
                  expectedBackAt: osExpectedBack || undefined,
                  notes: osNotes || undefined,
                })
              }
              disabled={
                !osVendorId ||
                !osDescription ||
                !(parseInt(osQuantity, 10) > 0) ||
                createOutsource.isPending
              }
              className="gap-1.5"
            >
              {createOutsource.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              ส่งร้านนอก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
