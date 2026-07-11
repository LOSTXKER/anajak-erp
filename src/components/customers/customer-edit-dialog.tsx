"use client";

import { useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented";
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
import { PAYMENT_TERMS } from "@/lib/payment-terms";
import {
  buildCustomerUpdatePayload,
  customerEditFormFromRecord,
  hasCorporateDetails,
  validateCustomerEditForm,
  type CustomerEditForm,
} from "@/lib/customer-form";
import { Building2, User, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

// ฟอร์มแก้ข้อมูลลูกค้า (Gate B7) — ต่อท่อ customer.update ที่มีอยู่แล้ว (เดิม dead mutation:
// audit 2026-07-02 จับ "แก้ข้อมูลลูกค้าจาก UI ไม่ได้") · field ชุดเดียวกับฟอร์มเพิ่มลูกค้า
// + กลุ่มลูกค้า (segment — งาน CRM จริง) · SALES แก้วงเงินเครดิตไม่ได้ (ตรง server guard)

type Customer = RouterOutput["customer"]["getById"];

const SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "NEW", label: "ใหม่" },
  { value: "REGULAR", label: "ขาประจำ" },
  { value: "VIP", label: "VIP" },
  { value: "WHOLESALE", label: "ค้าส่ง" },
  { value: "RETAIL", label: "ค้าปลีก" },
  { value: "INACTIVE", label: "ไม่เคลื่อนไหว" },
];

const NONE = "__NONE__";

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
    onError: (err: { message?: string }) => {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    },
  });

  const isCorporate = form.customerType === "CORPORATE";
  // สลับเป็นบุคคลธรรมดาแล้วยังมีข้อมูลภาษี/บิล/วงเงินค้าง — ต้องเห็น section นี้ต่อ
  // (review B7 จับ MAJOR: เดิมซ่อนแต่ submit ส่งค่าเดิมกลับ → เลขภาษีบริษัทเก่าไหลเข้า
  // ใบกำกับของลูกค้าบุคคลแบบมองไม่เห็นและล้างไม่ได้) — โชว์พร้อมคำเตือนให้คนตัดสินใจล้างเอง
  const hasCorporateLeftover = !isCorporate && hasCorporateDetails(form);
  const validationErrors = validateCustomerEditForm(form);
  const isFormValid = Object.keys(validationErrors).length === 0;
  const set = (patch: Partial<CustomerEditForm>) => setForm((f) => ({ ...f, ...patch }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;
    update.mutate(buildCustomerUpdatePayload(customer.id, form, canEditCredit));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลลูกค้า</DialogTitle>
          <DialogDescription>{customer.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">ประเภทลูกค้า</legend>
              <SegmentedControl
                value={form.customerType}
                onChange={(v) => set({ customerType: v })}
                aria-label="ประเภทลูกค้า"
                className="w-full"
                options={[
                  { value: "INDIVIDUAL", label: "บุคคลธรรมดา", icon: User },
                  { value: "CORPORATE", label: "นิติบุคคล", icon: Building2 },
                ]}
              />
            </fieldset>
            <Select
              value={form.segment}
              onValueChange={(value) => set({ segment: value as CustomerEditForm["segment"] })}
            >
              <Field label="กลุ่มลูกค้า" id="customer-segment">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </Field>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
            <Field
              label={`ชื่อ${isCorporate ? "ผู้ติดต่อ" : "ลูกค้า"}`}
              required
              error={validationErrors.name}
            >
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
            </Field>
            <Field
              label="บริษัท"
              required={isCorporate}
              error={validationErrors.company}
            >
              <Input
                value={form.company}
                onChange={(e) => set({ company: e.target.value })}
                required={isCorporate}
              />
            </Field>
            <Field label="โทรศัพท์">
              <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="LINE ID">
              <Input value={form.lineId} onChange={(e) => set({ lineId: e.target.value })} />
            </Field>
            <Field label="อีเมล">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>
            <Field label="ที่อยู่ (จัดส่ง)">
              <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
          </div>

          {(isCorporate || hasCorporateLeftover) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                ข้อมูลนิติบุคคล
              </h4>
              {hasCorporateLeftover && (
                <p
                  role="status"
                  className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  ลูกค้าเป็นบุคคลธรรมดาแต่ยังมีข้อมูลภาษี/วงเงินค้างอยู่ — ค่าพวกนี้ยังถูกใช้ออกใบกำกับ/กันวงเงินจริง
                  ถ้าไม่ใช้แล้วให้ลบออกให้ว่างแล้วบันทึก
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  label="เลขผู้เสียภาษี"
                  required={isCorporate}
                  error={validationErrors.taxId}
                >
                  {/* required ตรงฟอร์มสร้าง — นิติบุคคลไม่มีเลขภาษี = ใบกำกับผิดองค์ ม.86/4 */}
                  <Input
                    value={form.taxId}
                    onChange={(e) => set({ taxId: e.target.value })}
                    placeholder="เลข 13 หลัก"
                    required={isCorporate}
                  />
                </Field>
                <Field label="สาขา">
                  <Input
                    value={form.branchNumber}
                    onChange={(e) => set({ branchNumber: e.target.value })}
                    placeholder="00000 = สำนักงานใหญ่"
                  />
                </Field>
                <Field
                  label="วงเงินเครดิต (บาท)"
                  description={!canEditCredit ? "ผู้จัดการ/บัญชีเป็นคนกำหนด" : undefined}
                  error={validationErrors.creditLimit}
                >
                  <Input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) => set({ creditLimit: e.target.value })}
                    disabled={!canEditCredit}
                    title={canEditCredit ? undefined : "ฝ่ายขายแก้วงเงินไม่ได้ — ผู้จัดการ/บัญชีกำหนด"}
                  />
                </Field>
              </div>
              <Select
                value={form.defaultPaymentTerms || NONE}
                onValueChange={(v) => set({ defaultPaymentTerms: v === NONE ? "" : v })}
              >
                <Field
                  label="เงื่อนไขการชำระเงิน (ค่าเริ่มต้น)"
                  id="customer-payment-terms"
                  className="mt-4"
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="ไม่กำหนด" />
                  </SelectTrigger>
                </Field>
                  <SelectContent>
                    <SelectItem value={NONE}>ไม่กำหนด</SelectItem>
                    {PAYMENT_TERMS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="ที่อยู่ออกใบกำกับภาษี" className="sm:col-span-2">
                  <Input
                    value={form.billingAddress}
                    onChange={(e) => set({ billingAddress: e.target.value })}
                    placeholder="เลขที่ ถนน"
                  />
                </Field>
                <Field label="แขวง/ตำบล">
                  <Input
                    value={form.billingSubDistrict}
                    onChange={(e) => set({ billingSubDistrict: e.target.value })}
                  />
                </Field>
                <Field label="เขต/อำเภอ">
                  <Input
                    value={form.billingDistrict}
                    onChange={(e) => set({ billingDistrict: e.target.value })}
                  />
                </Field>
                <Field label="จังหวัด">
                  <Input
                    value={form.billingProvince}
                    onChange={(e) => set({ billingProvince: e.target.value })}
                  />
                </Field>
                <Field label="รหัสไปรษณีย์">
                  <Input
                    value={form.billingPostalCode}
                    onChange={(e) => set({ billingPostalCode: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}

          <Field label="หมายเหตุ">
            <Textarea
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
            />
          </Field>

          {update.error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              บันทึกไม่สำเร็จ: {update.error.message}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={update.isPending || !isFormValid} className="gap-1.5">
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
