"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/field";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { cn } from "@/lib/utils";
import { TINT } from "@/components/ui/tokens";
import { Truck } from "lucide-react";
import type { ProductionStep } from "./types";

// ป้าย/สถานะงานร้านนอกย้ายไป lib กลาง (src/lib/production-steps.ts) — ใช้ที่เดียวทั้งระบบ

interface StepOutsourceDialogProps {
  step: ProductionStep;
  onClose: () => void;
}

// dialog ส่งขั้นตอนให้ร้านนอก — mount ใหม่ทุกครั้งที่เปิด (state seed จาก props ตรงๆ ไม่ใช้ effect-reset)
// ไม่มีช่องค่าจ้าง (เบสเคาะ 2026-06-12: ไม่คิดต้นทุนต่องานในระบบนี้ — บัญชีคิดรายเดือน)
export function StepOutsourceDialog({ step, onClose }: StepOutsourceDialogProps) {
  const formId = useId();
  const [vendorId, setVendorId] = useState("");
  const [description, setDescription] = useState(
    () => step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType
  );
  // default = ส่วนที่ยังไม่ผ่าน (แบ่งส่งหลายรอบได้ — ส่งบางส่วนแก้เลขเอา)
  const [quantity, setQuantity] = useState(() =>
    step.qtyTotal !== null && step.qtyTotal > 0
      ? String(Math.max(0, step.qtyTotal - step.qtyDone) || step.qtyTotal)
      : ""
  );
  const [expectedBack, setExpectedBack] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const vendors = trpc.outsource.listVendors.useQuery({});

  const createOutsource = useMutationWithInvalidation(trpc.outsource.createOrder, {
    // order.getById ด้วย — การ์ดสรุปผลิต/ต้นทุนบนหน้าออเดอร์ต้องไม่ stale
    invalidate: [
      utils.production.getById,
      utils.production.getByOrderId,
      utils.production.kanban,
      utils.factory.stationQueue,
      utils.outsource.listOrders,
      utils.order.getById,
    ],
    onSuccess: () => {
      toast.success("สร้างใบร้านนอกแล้ว — ดูร้านและกำหนดรับกลับได้ในขั้นนี้ของใบผลิต");
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "สร้างใบร้านนอกไม่สำเร็จ");
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างใบร้านนอก</DialogTitle>
          <DialogDescription>
            บันทึกร้าน จำนวน และนัดรับกลับ ใบที่สร้างยังเป็นร่างและยังไม่ยืนยันว่าของออกจากโรงงาน
          </DialogDescription>
        </DialogHeader>
        {/* label เขียนเองถูกยุบเข้า Field กลาง (UX4) — id/aria เดินสายอัตโนมัติ
            ยกเว้น vendor: id ต้องลงที่ SelectTrigger (Radix Root ไม่มี DOM node)
            จึงส่ง id เดียวกันให้ Field เพื่อให้ label htmlFor ชี้ตรง trigger */}
        <div className="space-y-4">
          <div>
            <Field label="ร้าน" id={`${formId}-vendor`}>
              <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)} id={`${formId}-vendor`} disabled={vendors.isLoading || vendors.isError} placeholder={vendors.isLoading ? "กำลังโหลดรายชื่อร้าน…" : "เลือกร้าน..."}>
                  {vendors.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
            </Field>
            {vendors.isError ? (
              <Alert variant="error" title="โหลดรายชื่อร้านไม่สำเร็จ" className="mt-2" action={<Button variant="outline" size="sm" onClick={() => void vendors.refetch()}>ลองใหม่</Button>}>
                โหลดรายชื่อร้านให้สำเร็จก่อนสร้างใบ ข้อมูลที่กรอกไว้ยังอยู่
              </Alert>
            ) : vendors.data?.length === 0 && (
              <div className={cn(TINT.warning, "mt-2 rounded-lg border p-3")}>
                <p className="text-xs text-current">
                  ยังไม่มีร้านในระบบ
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/settings/vendors">ไปเพิ่มร้าน</Link>
                </Button>
              </div>
            )}
          </div>
          <Field label="รายละเอียดงาน">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="เช่น สกรีนหน้าอก 2 สี"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="จำนวน (ชิ้น)"
              description={
                step.qtyTotal !== null && step.qtyTotal > 0
                  ? `ทั้งขั้น ${step.qtyTotal} · ผ่านแล้ว ${step.qtyDone} — แบ่งส่งหลายรอบได้`
                  : undefined
              }
            >
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </Field>
            <Field label="กำหนดรับกลับ">
              <DatePicker
                value={expectedBack}
                onChange={(v) => setExpectedBack(v)}
              />
            </Field>
          </div>
          <Field label="หมายเหตุ">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น ส่งพร้อมบล็อกเดิม"
            />
          </Field>
        </div>
        <DialogSubmitFooter
          pending={createOutsource.isPending}
          pendingLabel="กำลังสร้างใบ..."
          disabled={vendors.isLoading || vendors.isError || !vendorId || !description || !(parseInt(quantity, 10) > 0)}
          submitLabel="สร้างใบร้านนอก"
          submitIcon={<Truck />}
          onCancel={onClose}
          onSubmit={() =>
            createOutsource.mutate({
              productionStepId: step.id,
              vendorId,
              description,
              quantity: parseInt(quantity, 10) || 0,
              expectedBackAt: expectedBack || undefined,
              notes: notes || undefined,
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
