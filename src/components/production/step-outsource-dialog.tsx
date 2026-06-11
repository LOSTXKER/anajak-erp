"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { Loader2, Truck } from "lucide-react";
import type { ProductionStep } from "./types";

// ป้าย/สถานะงานร้านนอกย้ายไป lib กลาง (src/lib/production-steps.ts) — ใช้ที่เดียวทั้งระบบ

interface StepOutsourceDialogProps {
  step: ProductionStep;
  onClose: () => void;
}

// dialog ส่งขั้นตอนให้ร้านนอก — mount ใหม่ทุกครั้งที่เปิด (state seed จาก props ตรงๆ ไม่ใช้ effect-reset)
// ไม่มีช่องค่าจ้าง (เบสเคาะ 2026-06-12: ไม่คิดต้นทุนต่องานในระบบนี้ — บัญชีคิดรายเดือน)
export function StepOutsourceDialog({ step, onClose }: StepOutsourceDialogProps) {
  const [vendorId, setVendorId] = useState("");
  const [description, setDescription] = useState(
    () => step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType
  );
  const [quantity, setQuantity] = useState("");
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
      utils.outsource.listOrders,
      utils.order.getById,
    ],
    onSuccess: () => {
      toast.success("สร้างงาน outsource แล้ว — ติดตามสถานะได้ที่หน้า Outsource");
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "สร้างงาน outsource ไม่สำเร็จ");
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
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
            <Select value={vendorId} onValueChange={setVendorId}>
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                กำหนดรับกลับ
              </label>
              <Input
                type="date"
                value={expectedBack}
                onChange={(e) => setExpectedBack(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              หมายเหตุ
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น ส่งพร้อมบล็อกเดิม"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={() =>
              createOutsource.mutate({
                productionStepId: step.id,
                vendorId,
                description,
                quantity: parseInt(quantity, 10) || 0,
                expectedBackAt: expectedBack || undefined,
                notes: notes || undefined,
              })
            }
            disabled={
              !vendorId ||
              !description ||
              !(parseInt(quantity, 10) > 0) ||
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
  );
}
