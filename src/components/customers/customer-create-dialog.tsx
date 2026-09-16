"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
  buildCustomerCreatePayload,
  emptyCustomerForm,
  validateCustomerEditForm,
  type CustomerEditForm,
} from "@/lib/customer-form";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";

/* เพิ่มลูกค้า = กล่องเด้ง (ต้นแบบที่เบสเคาะ 2026-09-16 · data-act="xdlg" d="customer")
   เดิมฟอร์มแทรกกลางหน้าแล้วดันตารางลงทั้งจอ — คนกดปุ่มเพิ่มแล้วรายการที่กำลังดูหายไป

   ช่องกรอกยกฟอร์มชุดเดิมมาทั้งก้อน (CustomerFormFields + validateCustomerEditForm +
   Alert ของ server + กัน SALES ตั้งวงเงิน) ต้นแบบมี 6 ช่องสมมติ — ห้ามลดช่องตามต้นแบบ
   โครงกล่อง/ระยะ/ฟุตเตอร์ใช้ชุดเดียวกับกล่องแก้ข้อมูลลูกค้า */
export function CustomerCreateDialog({
  canEditCredit,
  onClose,
}: {
  // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES เห็นช่องแต่แก้ไม่ได้ (ตรง server guard)
  canEditCredit: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState(emptyCustomerForm);
  // ฟอร์มใหม่เริ่มจากว่างทุกช่อง — โชว์ error หลังกดบันทึกครั้งแรกเท่านั้น
  // (ต่างจากฟอร์มแก้ไขที่ข้อมูลตั้งต้นถูกอยู่แล้ว โชว์สดได้)
  const [showErrors, setShowErrors] = useState(false);

  const utils = trpc.useUtils();
  // เดิม fail เงียบ — SALES กรอกวงเงินโดน FORBIDDEN แล้วฟอร์มค้างเฉยๆ ไม่มีอะไรบอก
  // server error แสดงใน Alert ในฟอร์มที่เดียว — onError noop กัน hook ยิง toast ซ้ำสองทาง
  const createCustomer = useMutationWithInvalidation(trpc.customer.create, {
    invalidate: [utils.customer.list, utils.customer.stats],
    onSuccess: () => {
      toast.success("เพิ่มลูกค้าแล้ว");
      onClose();
    },
    onError: () => {},
  });

  const validationErrors = validateCustomerEditForm(form);
  const set = (patch: Partial<CustomerEditForm>) => setForm((f) => ({ ...f, ...patch }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Object.keys(validationErrors).length > 0) {
      setShowErrors(true);
      return;
    }
    // SALES ไม่ส่ง creditLimit เลย — ส่งไปโดน FORBIDDEN (ช่องก็ disabled แล้ว)
    createCustomer.mutate(buildCustomerCreatePayload(form, canEditCredit));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-clip p-0 pr-0 sm:max-w-2xl sm:p-0 sm:pr-0">
        {/* ปุ่ม X กินพื้นที่เฉพาะหัว — body/footer จึงกลับมามีขอบซ้ายขวาเท่ากัน */}
        <DialogHeader className="px-5 pb-4 pr-14 pt-5 sm:px-6 sm:pr-12 sm:pt-6">
          <DialogTitle>เพิ่มลูกค้า</DialogTitle>
          <DialogDescription>ที่อยู่ออกบิลและเลขผู้เสียภาษีเพิ่มทีหลังได้</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-clip">
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
                mode="create"
              />

              {createCustomer.error && (
                <Alert variant="error">
                  บันทึกไม่สำเร็จ: {createCustomer.error.message}
                </Alert>
              )}
            </div>
          </div>

          <DialogSubmitFooter
            className="static z-auto px-5 sm:px-6"
            pending={createCustomer.isPending}
            submitLabel="บันทึก"
            submitIcon={<Save />}
            onCancel={onClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
