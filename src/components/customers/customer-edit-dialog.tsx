"use client";

import { useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { CustomerFormFields } from "@/components/customers/customer-form-fields";
import {
  buildCustomerUpdatePayload,
  customerEditFormFromRecord,
  validateCustomerEditForm,
  type CustomerEditForm,
} from "@/lib/customer-form";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";

// ฟอร์มแก้ข้อมูลลูกค้า (Gate B7) — ต่อท่อ customer.update ที่มีอยู่แล้ว (เดิม dead mutation:
// audit 2026-07-02 จับ "แก้ข้อมูลลูกค้าจาก UI ไม่ได้") · field ชุดเดียวกับฟอร์มเพิ่มลูกค้า
// ผ่าน CustomerFormFields · SALES แก้วงเงินเครดิตไม่ได้ (ตรง server guard)

type Customer = RouterOutput["customer"]["getById"];

export function CustomerEditDialog({
  customer,
  canEditCredit,
  onClose,
}: {
  customer: Customer;
  // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES เห็นช่องแต่แก้ไม่ได้ (ตรง server)
  canEditCredit: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => customerEditFormFromRecord(customer));
  // โชว์ error หลังกดบันทึกครั้งแรก — จังหวะเดียวกับฟอร์มเพิ่มลูกค้า (เบสสั่งให้เหมือนกัน 2026-09-18)
  // เดิมที่นี่โชว์สด: ลบชื่อเพื่อพิมพ์ใหม่แล้วขึ้นแดงทันทีทั้งที่ยังพิมพ์ไม่จบ
  const [showErrors, setShowErrors] = useState(false);

  const utils = trpc.useUtils();
  const update = useMutationWithInvalidation(trpc.customer.update, {
    // creditStatus ด้วย — วงเงินเป็น input ตรงของ query นั้น (review B7 จับ: แก้วงเงินแล้ว
    // บรรทัด "ใช้ได้อีก" ค้างฐานเก่า ขัดกับหัวการ์ดบนจอเดียวกัน)
    invalidate: [
      utils.customer.getById,
      utils.customer.list,
      utils.customer.stats,
      utils.customer.creditStatus,
    ],
    onSuccess: () => {
      toast.success("บันทึกข้อมูลลูกค้าแล้ว");
      onClose();
    },
    // server error แสดงใน Alert ในฟอร์มที่เดียว — noop กัน hook ยิง toast ซ้ำเป็นสองทาง
    onError: () => {},
  });

  const validationErrors = validateCustomerEditForm(form);
  const set = (patch: Partial<CustomerEditForm>) => setForm((f) => ({ ...f, ...patch }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // กล่องนี้เปิดจากหน้าลูกค้า แต่กันไว้เหมือนฟอร์มเพิ่ม: React ส่ง submit ข้าม portal ขึ้นฟอร์มแม่ได้
    e.stopPropagation();
    if (Object.keys(validationErrors).length > 0) {
      setShowErrors(true);
      return;
    }
    update.mutate(buildCustomerUpdatePayload(customer.id, form, canEditCredit));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-clip p-0 pr-0 sm:max-w-2xl sm:p-0 sm:pr-0">
        {/* ปุ่ม X กินพื้นที่เฉพาะหัว — body/footer จึงกลับมามีขอบซ้ายขวาเท่ากัน */}
        <DialogHeader className="px-5 pb-4 pr-14 pt-5 sm:px-6 sm:pr-12 sm:pt-6">
          <DialogTitle>แก้ไขข้อมูลลูกค้า</DialogTitle>
          <DialogDescription>{customer.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-clip">
          {/* scroller เต็มความกว้างกรอบ แล้วให้เนื้อในถือ padding สมมาตร
              — scrollbar จึงไม่บีบ field ไปทางซ้ายและจอ 320px ไม่ล้นแนวนอน */}
          <div
            data-dialog-body=""
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div data-dialog-fields="" className="space-y-4 px-5 sm:px-6">
              <CustomerFormFields
                form={form}
                set={set}
                errors={showErrors ? validationErrors : {}}
                canEditCredit={canEditCredit}
                mode="edit"
              />

              {update.error && (
                <Alert variant="error">
                  บันทึกไม่สำเร็จ: {update.error.message}
                </Alert>
              )}
            </div>
          </div>

          <DialogSubmitFooter
            className="static z-auto px-5 sm:px-6"
            pending={update.isPending}
            submitLabel="บันทึก"
            submitIcon={<Save />}
            onCancel={onClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
