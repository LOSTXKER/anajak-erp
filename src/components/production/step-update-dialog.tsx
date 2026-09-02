"use client";

import { useState, type RefObject } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { QueryError } from "@/components/ui/query-error";
import { Alert } from "@/components/ui/alert";
import { Check, RotateCcw } from "lucide-react";
import type { StepStatus } from "@prisma/client";
import type { ProductionStep } from "./types";
import { toast } from "sonner";
import { currentProductionProblemReason } from "@/lib/production-problem";

interface StepUpdateDialogProps {
  step: ProductionStep;
  mode?: "operation" | "manager";
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

type OperationalStepStatus = Exclude<StepStatus, "FAILED">;

// dialog อัปเดตขั้นตอนผลิต — mount ใหม่ทุกครั้งที่เปิด (state seed จาก props ตรงๆ)
// ช่อง "ต้นทุนจริง" ถอดออก (เบสเคาะ 2026-06-12: ไม่คิดต้นทุนต่องานในระบบนี้)
export function StepUpdateDialog({
  step,
  mode = "operation",
  returnFocusRef,
  onClose,
}: StepUpdateDialogProps) {
  const [status, setStatus] = useState<string>(step.status);
  // จำนวนทำแล้ว/ทั้งหมด — บอก "บางส่วน" ได้ (ว่าง = ขั้นแบบติ๊กเฉยๆ ไม่นับจำนวน)
  const [qtyDone, setQtyDone] = useState<string>(String(step.qtyDone ?? 0));
  const [qtyTotal, setQtyTotal] = useState<string>(
    step.qtyTotal === null ? "" : String(step.qtyTotal)
  );
  const [notes, setNotes] = useState(step.notes || "");
  const [qcPassed, setQcPassed] = useState<string>(
    step.qcPassed === null ? "" : step.qcPassed ? "true" : "false"
  );
  const [qcNotes, setQcNotes] = useState(step.qcNotes || "");
  // Manager command แยกจาก operation update ชัด: เปลี่ยนผู้รับผิดชอบไม่พ่วง status/qty/QC
  const [assignee, setAssignee] = useState(step.assignedTo?.id || "");
  const [savedAssignee, setSavedAssignee] = useState(step.assignedTo?.id || "");
  const [resolutionReason, setResolutionReason] = useState("");

  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const canAssign = !!me && permAllows(me.permissions, "supervise_operations");
  const managerOnly = mode === "manager";
  const failedProblem = managerOnly && step.status === "FAILED";
  const serviceManaged =
    managerOnly ||
    ["GARMENT_PICK", "GARMENT_RECEIVE", "DTF_PRINT"].includes(step.stepType);

  // รายชื่อมอบหมายงาน — โหลดเฉพาะหัวหน้า (endpoint เป็น managerUp)
  const assignables = trpc.user.assignables.useQuery(undefined, {
    enabled: managerOnly && canAssign,
  });

  const updateStep = useMutationWithInvalidation(trpc.production.updateStep, {
    // order.getById ด้วย — การ์ดสรุปผลิต + ต้นทุน&กำไร บนหน้าออเดอร์ต้องไม่ stale
    invalidate: [
      utils.production.getById,
      utils.production.getByOrderId,
      utils.production.kanban,
      utils.factory.stationQueue,
      utils.order.getById,
      utils.task.myToday,
    ],
    onSuccess: onClose,
  });

  const managerInvalidations = [
    utils.production.getById,
    utils.production.getByOrderId,
    utils.production.kanban,
    utils.factory.stationQueue,
    utils.factory.stationContext,
    utils.order.getById,
    utils.task.myToday,
  ];
  const assignStep = useMutationWithInvalidation(
    trpc.production.assignProductionStep,
    {
      invalidate: managerInvalidations,
      onSuccess: () => {
        setSavedAssignee(assignee);
        toast.success(assignee ? "บันทึกผู้รับผิดชอบแล้ว" : "ยกเลิกผู้รับผิดชอบแล้ว");
        if (!failedProblem) onClose();
      },
    },
  );
  const resolveProblem = useMutationWithInvalidation(
    trpc.production.resolveStationProblem,
    {
      invalidate: managerInvalidations,
      onSuccess: () => {
        toast.success("แก้ปัญหาแล้ว — ส่งงานกลับสถานีแล้ว");
        onClose();
      },
    },
  );

  const assigneeChanged = assignee !== savedAssignee;
  const resolutionReady = resolutionReason.trim().length >= 3;
  const managerPending = assignStep.isPending || resolveProblem.isPending;
  const currentProblemReason = currentProductionProblemReason(step);

  function handleSave() {
    if (managerOnly) {
      assignStep.mutate({
        stepId: step.id,
        assignedToId: assignee || null,
      });
      return;
    }

    // operation dialog คง command เดิม; assignment ของหัวหน้าไม่เดินเข้าทางนี้
    const parsedDone = Math.max(0, Math.floor(Number(qtyDone) || 0));
    const parsedTotal = qtyTotal === "" ? null : Math.max(0, Math.floor(Number(qtyTotal) || 0));
    updateStep.mutate({
      stepId: step.id,
      status: serviceManaged ? undefined : (status as OperationalStepStatus) || undefined,
      qtyDone:
        !serviceManaged && parsedDone !== (step.qtyDone ?? 0) ? parsedDone : undefined,
      qtyTotal:
        !serviceManaged && parsedTotal !== (step.qtyTotal ?? null) ? parsedTotal : undefined,
      notes: notes || undefined,
      qcPassed:
        managerOnly || qcPassed === "" ? undefined : qcPassed === "true",
      qcNotes: managerOnly ? undefined : qcNotes || undefined,
    });
  }

  function handleResolve() {
    const reason = resolutionReason.trim();
    if (reason.length < 3 || assigneeChanged) return;
    resolveProblem.mutate({ stepId: step.id, resolutionReason: reason });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-step-update-mode={mode}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current?.isConnected) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            {failedProblem
              ? "จัดการปัญหา"
              : managerOnly
                ? step.assignedTo
                  ? "เปลี่ยนผู้รับผิดชอบ"
                  : "มอบหมายงาน"
                : "อัปเดตขั้นตอน"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {managerOnly ? (
            failedProblem ? (
              <Alert variant="error" title="ปัญหาที่สถานีรายงาน">
                <p className="whitespace-pre-wrap">{currentProblemReason || "ไม่ได้ระบุรายละเอียดปัญหา"}</p>
              </Alert>
            ) : (
              <Alert variant="info">
                หน้า ERP ใช้สำหรับมอบหมายผู้รับผิดชอบ งานและผลจริงต้องบันทึกจากสถานี
              </Alert>
            )
          ) : serviceManaged ? (
            <Alert variant="info">
              {step.stepType === "DTF_PRINT"
                ? "สถานะและจำนวนเดินผ่านรอบพิมพ์ DTF เท่านั้น"
                : step.stepType === "GARMENT_RECEIVE"
                  ? "สถานะและจำนวนเดินผ่านใบตรวจรับเสื้อลูกค้าเท่านั้น"
                  : "สถานะและจำนวนเดินผ่านเมนูเบิก/คืนเสื้อเท่านั้น"}
            </Alert>
          ) : (
            <>
              <Field label="สถานะ">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PENDING">รอดำเนินการ</option>
                <option value="IN_PROGRESS">กำลังทำ</option>
                <option value="COMPLETED">เสร็จแล้ว</option>
                <option value="ON_HOLD">พักไว้</option>
                </Select>
              </Field>
              {/* บอกบางส่วนได้: พิมพ์ไปแล้ว 120 จาก 300 — ไม่บังคับกรอก */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="ทำแล้ว (ตัว)">
                  <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={qtyDone}
                onChange={(e) => setQtyDone(e.target.value)}
                className="h-10 tabular-nums"
                  />
                </Field>
                <Field label="ทั้งหมด (ตัว)">
                  <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={qtyTotal}
                onChange={(e) => setQtyTotal(e.target.value)}
                placeholder="ไม่นับจำนวน"
                className="h-10 tabular-nums"
                  />
                </Field>
              </div>
            </>
          )}
          {managerOnly && canAssign && (
            // มอบหมาย/ย้ายเจ้าของงาน — เดิม staff claim เองอย่างเดียวแล้วล็อกถาวร (audit ข้อ 18)
            assignables.isError ? (
              <QueryError
                message="โหลดรายชื่อผู้รับผิดชอบไม่สำเร็จ"
                onRetry={() => void assignables.refetch()}
              />
            ) : <Field label="ผู้รับผิดชอบ">
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="ยังไม่มอบหมาย">
                  {step.assignedTo && !(assignables.data ?? []).some((user) => user.id === step.assignedTo?.id) ? (
                    <option value={step.assignedTo.id}>{step.assignedTo.name} · ผู้รับผิดชอบปัจจุบัน</option>
                  ) : null}
                  {(assignables.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
            </Field>
          )}
          {!managerOnly ? (
            <>
              <Field label="QC">
                <Select value={qcPassed} onChange={(e) => setQcPassed(e.target.value)} placeholder="ยังไม่ได้ตรวจ">
                    <option value="true">ผ่าน</option>
                    <option value="false">ไม่ผ่าน</option>
                  </Select>
              </Field>
              {qcPassed === "false" && (
                <Field label="หมายเหตุ QC">
                  <Textarea
                    value={qcNotes}
                    onChange={(e) => setQcNotes(e.target.value)}
                    rows={2}
                    placeholder="ระบุปัญหาที่พบ..."
                  />
                </Field>
              )}
            </>
          ) : null}
          {!managerOnly ? (
            <Field label="หมายเหตุ">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="หมายเหตุ..."
              />
            </Field>
          ) : null}
          {failedProblem ? (
            <div className="space-y-2 border-t border-divider pt-4">
              <Field label="วิธีที่แก้แล้ว">
                <Textarea
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  rows={3}
                  placeholder="เช่น เติมเสื้อครบแล้ว และตรวจยอดกับใบเบิกแล้ว"
                  aria-describedby="station-resolution-help"
                />
              </Field>
              <p id="station-resolution-help" className="text-xs text-muted">
                ระบุอย่างน้อย 3 ตัวอักษร เพื่อเก็บเป็นหลักฐานก่อนส่งงานกลับสถานี
              </p>
              {assigneeChanged ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  บันทึกผู้รับผิดชอบก่อน แล้วจึงส่งงานกลับสถานี
                </p>
              ) : null}
            </div>
          ) : null}
          {updateStep.error || assignStep.error || resolveProblem.error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {(managerOnly
                ? assignStep.error?.message || resolveProblem.error?.message
                : updateStep.error?.message) ?? "บันทึกไม่สำเร็จ"}
            </p>
          ) : null}
        </div>
        {failedProblem ? (
          <DialogFooter className="sm:flex-wrap">
            <Button type="button" variant="ghost" onClick={onClose} disabled={managerPending}>
              ปิด
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!assigneeChanged || managerPending}
              aria-busy={assignStep.isPending || undefined}
              onClick={handleSave}
            >
              <Check />
              {assignStep.isPending ? "กำลังบันทึก..." : "บันทึกผู้รับผิดชอบ"}
            </Button>
            <Button
              type="button"
              disabled={!resolutionReady || assigneeChanged || managerPending}
              aria-busy={resolveProblem.isPending || undefined}
              onClick={handleResolve}
            >
              <RotateCcw />
              {resolveProblem.isPending ? "กำลังส่งกลับ..." : "แก้ปัญหาแล้ว ส่งกลับสถานี"}
            </Button>
          </DialogFooter>
        ) : (
          <DialogSubmitFooter
            pending={managerOnly ? assignStep.isPending : updateStep.isPending}
            disabled={managerOnly && !assigneeChanged}
            pendingLabel="กำลังบันทึก..."
            submitLabel={managerOnly ? "บันทึกการมอบหมาย" : "บันทึก"}
            submitIcon={<Check />}
            onCancel={onClose}
            onSubmit={handleSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
