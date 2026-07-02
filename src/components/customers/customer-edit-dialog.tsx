"use client";

import { useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PAYMENT_TERMS, type PaymentTermsValue } from "@/lib/payment-terms";
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
  const [form, setForm] = useState({
    customerType: customer.customerType as "INDIVIDUAL" | "CORPORATE",
    name: customer.name,
    company: customer.company ?? "",
    phone: customer.phone ?? "",
    lineId: customer.lineId ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
    segment: customer.segment,
    taxId: customer.taxId ?? "",
    branchNumber: customer.branchNumber ?? "",
    creditLimit: customer.creditLimit != null ? String(customer.creditLimit) : "",
    defaultPaymentTerms: customer.defaultPaymentTerms ?? "",
    billingAddress: customer.billingAddress ?? "",
    billingSubDistrict: customer.billingSubDistrict ?? "",
    billingDistrict: customer.billingDistrict ?? "",
    billingProvince: customer.billingProvince ?? "",
    billingPostalCode: customer.billingPostalCode ?? "",
  });

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
  const hasCorporateLeftover =
    !isCorporate &&
    Boolean(
      form.taxId.trim() ||
        form.branchNumber.trim() ||
        form.creditLimit ||
        form.defaultPaymentTerms ||
        form.billingAddress.trim() ||
        form.billingSubDistrict.trim() ||
        form.billingDistrict.trim() ||
        form.billingProvince.trim() ||
        form.billingPostalCode.trim()
    );
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      id: customer.id,
      customerType: form.customerType,
      name: form.name.trim(),
      // string ว่าง = ตั้งใจล้างค่า (optional string เก็บ "" — UI เช็ค falsy อยู่แล้ว)
      company: form.company.trim(),
      phone: form.phone.trim(),
      lineId: form.lineId.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      segment: form.segment as never,
      taxId: form.taxId.trim(),
      // ฟิลด์ nullable — ล้างด้วย null ให้ตรง schema
      branchNumber: form.branchNumber.trim() || null,
      defaultPaymentTerms: (form.defaultPaymentTerms || null) as PaymentTermsValue | null,
      billingAddress: form.billingAddress.trim() || null,
      billingSubDistrict: form.billingSubDistrict.trim() || null,
      billingDistrict: form.billingDistrict.trim() || null,
      billingProvince: form.billingProvince.trim() || null,
      billingPostalCode: form.billingPostalCode.trim() || null,
      // SALES ไม่ส่ง creditLimit เลย (undefined = ไม่แตะ) — ส่งไปโดน FORBIDDEN
      ...(canEditCredit
        ? { creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null }
        : {}),
    });
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
            <div>
              <label className="mb-1.5 block text-sm font-medium">ประเภทลูกค้า</label>
              <SegmentedControl
                value={form.customerType}
                onChange={(v) => set({ customerType: v })}
                options={[
                  { value: "INDIVIDUAL", label: "บุคคลธรรมดา", icon: User },
                  { value: "CORPORATE", label: "นิติบุคคล", icon: Building2 },
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">กลุ่มลูกค้า</label>
              <Select value={form.segment} onValueChange={(v) => set({ segment: v as never })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                ชื่อ{isCorporate ? "ผู้ติดต่อ" : "ลูกค้า"} <span className="text-red-500">*</span>
              </label>
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                บริษัท {isCorporate && <span className="text-red-500">*</span>}
              </label>
              <Input
                value={form.company}
                onChange={(e) => set({ company: e.target.value })}
                required={isCorporate}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">โทรศัพท์</label>
              <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">LINE ID</label>
              <Input value={form.lineId} onChange={(e) => set({ lineId: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">อีเมล</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">ที่อยู่ (จัดส่ง)</label>
              <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </div>
          </div>

          {(isCorporate || hasCorporateLeftover) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                ข้อมูลนิติบุคคล
              </h4>
              {hasCorporateLeftover && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  ลูกค้าเป็นบุคคลธรรมดาแต่ยังมีข้อมูลภาษี/วงเงินค้างอยู่ — ค่าพวกนี้ยังถูกใช้ออกใบกำกับ/กันวงเงินจริง
                  ถ้าไม่ใช้แล้วให้ลบออกให้ว่างแล้วบันทึก
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    เลขผู้เสียภาษี {isCorporate && <span className="text-red-500">*</span>}
                  </label>
                  {/* required ตรงฟอร์มสร้าง — นิติบุคคลไม่มีเลขภาษี = ใบกำกับผิดองค์ ม.86/4 */}
                  <Input
                    value={form.taxId}
                    onChange={(e) => set({ taxId: e.target.value })}
                    placeholder="เลข 13 หลัก"
                    required={isCorporate}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">สาขา</label>
                  <Input
                    value={form.branchNumber}
                    onChange={(e) => set({ branchNumber: e.target.value })}
                    placeholder="00000 = สำนักงานใหญ่"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">วงเงินเครดิต (บาท)</label>
                  <Input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) => set({ creditLimit: e.target.value })}
                    disabled={!canEditCredit}
                    title={canEditCredit ? undefined : "ฝ่ายขายแก้วงเงินไม่ได้ — ผู้จัดการ/บัญชีกำหนด"}
                  />
                  {!canEditCredit && (
                    <p className="mt-1 text-xs text-slate-400">ผู้จัดการ/บัญชีเป็นคนกำหนด</p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium">
                  เงื่อนไขการชำระเงิน (ค่าเริ่มต้น)
                </label>
                <Select
                  value={form.defaultPaymentTerms || NONE}
                  onValueChange={(v) => set({ defaultPaymentTerms: v === NONE ? "" : v })}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="ไม่กำหนด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>ไม่กำหนด</SelectItem>
                    {PAYMENT_TERMS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    ที่อยู่ออกใบกำกับภาษี
                  </label>
                  <Input
                    value={form.billingAddress}
                    onChange={(e) => set({ billingAddress: e.target.value })}
                    placeholder="เลขที่ ถนน"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">แขวง/ตำบล</label>
                  <Input
                    value={form.billingSubDistrict}
                    onChange={(e) => set({ billingSubDistrict: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">เขต/อำเภอ</label>
                  <Input
                    value={form.billingDistrict}
                    onChange={(e) => set({ billingDistrict: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">จังหวัด</label>
                  <Input
                    value={form.billingProvince}
                    onChange={(e) => set({ billingProvince: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">รหัสไปรษณีย์</label>
                  <Input
                    value={form.billingPostalCode}
                    onChange={(e) => set({ billingPostalCode: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">หมายเหตุ</label>
            <Textarea
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={update.isPending || !form.name.trim()} className="gap-1.5">
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
