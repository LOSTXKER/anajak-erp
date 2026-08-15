"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { QueryError } from "@/components/ui/query-error";
import { Check } from "lucide-react";
import type { StepStatus } from "@prisma/client";
import type { ProductionStep } from "./types";

interface StepUpdateDialogProps {
  step: ProductionStep;
  onClose: () => void;
}

// dialog อัปเดตขั้นตอนผลิต — mount ใหม่ทุกครั้งที่เปิด (state seed จาก props ตรงๆ)
// ช่อง "ต้นทุนจริง" ถอดออก (เบสเคาะ 2026-06-12: ไม่คิดต้นทุนต่องานในระบบนี้)
export function StepUpdateDialog({ step, onClose }: StepUpdateDialogProps) {
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
  // มอบหมายงาน (หัวหน้าเท่านั้น — server กัน assignedToId จาก staff อยู่แล้ว · audit ข้อ 18)
  const [assignee, setAssignee] = useState(step.assignedTo?.id || "");
  const [originalAssignee] = useState(step.assignedTo?.id || "");

  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const canAssign = !!me && permAllows(me.permissions, "supervise_operations");

  // รายชื่อมอบหมายงาน — โหลดเฉพาะหัวหน้า (endpoint เป็น managerUp)
  const assignables = trpc.user.assignables.useQuery(undefined, {
    enabled: canAssign,
  });

  const updateStep = useMutationWithInvalidation(trpc.production.updateStep, {
    // order.getById ด้วย — การ์ดสรุปผลิต + ต้นทุน&กำไร บนหน้าออเดอร์ต้องไม่ stale
    invalidate: [
      utils.production.getById,
      utils.production.getByOrderId,
      utils.production.kanban,
      utils.order.getById,
      utils.task.myToday,
    ],
    onSuccess: onClose,
  });

  function handleSave() {
    // assignedToId ส่งเฉพาะเมื่อเปลี่ยนจริง — staff ไม่เห็นช่องนี้และห้ามติดไปกับ request
    const assigneeChanged = assignee !== originalAssignee;
    const parsedDone = Math.max(0, Math.floor(Number(qtyDone) || 0));
    const parsedTotal = qtyTotal === "" ? null : Math.max(0, Math.floor(Number(qtyTotal) || 0));
    updateStep.mutate({
      stepId: step.id,
      status: (status as StepStatus) || undefined,
      assignedToId: assigneeChanged && assignee ? assignee : undefined,
      qtyDone: parsedDone !== (step.qtyDone ?? 0) ? parsedDone : undefined,
      qtyTotal: parsedTotal !== (step.qtyTotal ?? null) ? parsedTotal : undefined,
      notes: notes || undefined,
      qcPassed: qcPassed === "" ? undefined : qcPassed === "true",
      qcNotes: qcNotes || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>อัปเดตขั้นตอน</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="สถานะ">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PENDING">รอดำเนินการ</option>
                <option value="IN_PROGRESS">กำลังทำ</option>
                <option value="COMPLETED">เสร็จแล้ว</option>
                <option value="ON_HOLD">พักไว้</option>
                <option value="FAILED">มีปัญหา</option>
              </Select>
          </Field>
          {/* บอกบางส่วนได้: พิมพ์ไปแล้ว 120 จาก 300 — ไม่บังคับกรอก (ติ๊กเสร็จ = ครบเอง) */}
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
          {canAssign && (
            // มอบหมาย/ย้ายเจ้าของงาน — เดิม staff claim เองอย่างเดียวแล้วล็อกถาวร (audit ข้อ 18)
            assignables.isError ? (
              <QueryError
                message="โหลดรายชื่อผู้รับผิดชอบไม่สำเร็จ"
                onRetry={() => void assignables.refetch()}
              />
            ) : <Field label="ผู้รับผิดชอบ">
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="ยังไม่มอบหมาย">
                  {(assignables.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
            </Field>
          )}
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
          <Field label="หมายเหตุ">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="หมายเหตุ..."
            />
          </Field>
          {updateStep.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {updateStep.error.message}
            </p>
          )}
        </div>
        <DialogSubmitFooter
          pending={updateStep.isPending}
          pendingLabel="กำลังบันทึก..."
          submitLabel="บันทึก"
          submitIcon={<Check />}
          onCancel={onClose}
          onSubmit={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}
