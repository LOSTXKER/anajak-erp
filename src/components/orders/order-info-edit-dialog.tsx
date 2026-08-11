"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Select } from "@/components/ui/select";
import { Save } from "lucide-react";
import { PRIORITY_LABELS, isOrderLocked, orderEditLockedReason } from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { PAYMENT_TERMS_LABELS, type PaymentTermsValue } from "@/lib/payment-terms";
import { calculateOrderSummary } from "@/lib/pricing";
import { fillFromCustomer, hasAddressContent } from "@/lib/address-fill";
import { UseAddressButton } from "@/components/orders/use-address-button";
import { formatCurrency } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

interface OrderInfoEditOrder {
  id: string;
  title: string;
  description: string | null;
  deadline: string | Date | null;
  priority: string;
  notes: string | null;
  internalStatus: string;
  taxRate: number;
  // ฟิลด์เงินเป็น number | null ตาม order.getById (นโยบาย ⑦) — dialog เปิดได้เฉพาะ
  // เมนูฝั่งขาย (role เห็นเงิน) ค่าจริงเลยเป็นตัวเลขเสมอ · ?? 0 แค่ให้ TS ผ่าน
  discount: number | null;
  platformFee: number | null;
  paymentTerms: string | null;
  // ฐานคิดยอด + เพดานขาที่สอง (B9) จาก order.getById — เตือนก่อนบันทึกเมื่อ
  // ส่วนลด/ภาษีใหม่ทำยอดรวมต่ำกว่าบิลที่ออกแล้ว (server ปฏิเสธอยู่แล้ว)
  subtotalItems: number | null;
  subtotalFees: number | null;
  totalAmount: number | null;
  billedFloor?: number | null;
  poNumber: string | null;
  channel: string;
  shippingRecipientName: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingSubDistrict: string | null;
  shippingDistrict: string | null;
  shippingProvince: string | null;
  shippingPostalCode: string | null;
  externalOrderId: string | null;
  /** ที่อยู่ผู้ติดต่อของลูกค้า — ต้นทางของปุ่ม "ใช้ที่อยู่ลูกค้า" (อ่านอย่างเดียว ไม่แก้ที่นี่) */
  customer?: {
    name: string;
    company: string | null;
    phone: string | null;
    address: string | null;
  } | null;
}

interface OrderInfoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderInfoEditOrder;
  /** เปิดมาแล้วเลื่อนไปหัวข้อไหน — แต่ละการ์ดบนแท็บภาพรวมมีปุ่มแก้ไขของตัวเอง
   *  (เบสสั่ง 2026-08-11) แต่ฟอร์มยังเป็นใบเดียว: กดจากการ์ด "ที่อยู่" แล้วต้องไม่
   *  ต้องเลื่อนหาเอง · ไม่แยกเป็นหลาย dialog เพราะยอด/ภาษี/ส่วนลด ผูกกันข้ามหัวข้อ
   *  (แก้ที่อยู่แล้วเซฟทั้งใบด้วย mutation ตัวเดียวตามเดิม) */
  focusSection?: "info" | "shipping";
}

interface FormData {
  title: string;
  description: string;
  deadline: string;
  priority: string;
  notes: string;
  taxRate: number;
  discount: number;
  platformFee: number;
  paymentTerms: string;
  poNumber: string;
  shippingRecipientName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingSubDistrict: string;
  shippingDistrict: string;
  shippingProvince: string;
  shippingPostalCode: string;
  externalOrderId: string;
}

function toDateInputValue(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function OrderInfoEditDialog({
  open,
  onOpenChange,
  order,
  focusSection,
}: OrderInfoEditDialogProps) {
  const [form, setForm] = useState<FormData>({
    title: "",
    description: "",
    deadline: "",
    priority: "NORMAL",
    notes: "",
    taxRate: 0,
    discount: 0,
    platformFee: 0,
    paymentTerms: "",
    poNumber: "",
    shippingRecipientName: "",
    shippingPhone: "",
    shippingAddress: "",
    shippingSubDistrict: "",
    shippingDistrict: "",
    shippingProvince: "",
    shippingPostalCode: "",
    externalOrderId: "",
  });

  const utils = trpc.useUtils();

  const updateMutation = useMutationWithInvalidation(trpc.order.update, {
    invalidate: [utils.order.getById],
    onSuccess: () => onOpenChange(false),
  });

  /* กดปุ่มแก้ไขจากการ์ดไหน ก็เลื่อนไปหัวข้อนั้นให้เลย — ไม่งั้นคนกดจากการ์ด "ที่อยู่"
     จะเจอช่องชื่อออเดอร์เป็นอย่างแรกแล้วนึกว่ากดผิดปุ่ม · รอ 1 เฟรมให้ dialog วาดเสร็จก่อน */
  useEffect(() => {
    if (!open || !focusSection) return;
    const id = focusSection === "shipping" ? "order-edit-shipping" : "order-edit-info";
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, focusSection]);

  useEffect(() => {
    if (open && order) {
      setForm({
        title: order.title ?? "",
        description: order.description ?? "",
        deadline: toDateInputValue(order.deadline),
        priority: order.priority ?? "NORMAL",
        notes: order.notes ?? "",
        taxRate: order.taxRate ?? 0,
        discount: order.discount ?? 0,
        platformFee: order.platformFee ?? 0,
        paymentTerms: order.paymentTerms ?? "",
        poNumber: order.poNumber ?? "",
        shippingRecipientName: order.shippingRecipientName ?? "",
        shippingPhone: order.shippingPhone ?? "",
        shippingAddress: order.shippingAddress ?? "",
        shippingSubDistrict: order.shippingSubDistrict ?? "",
        shippingDistrict: order.shippingDistrict ?? "",
        shippingProvince: order.shippingProvince ?? "",
        shippingPostalCode: order.shippingPostalCode ?? "",
        externalOrderId: order.externalOrderId ?? "",
      });
    }
  }, [open, order]);

  const isMarketplace = ["SHOPEE", "LAZADA", "TIKTOK"].includes(order?.channel);

  // ปุ่ม "ใช้ที่อยู่ลูกค้า" โผล่เมื่อโปรไฟล์ลูกค้ามีที่อยู่ให้ก๊อปจริง
  const canUseCustomerAddress = hasAddressContent(fillFromCustomer(order?.customer));

  // ยอด/ส่วนลด/ภาษี/เทอม แก้ตรงไม่ได้เมื่อออเดอร์ล็อก (อนุมัติ→ใบแก้ไข · พักงาน→ปลดพัก)
  // — server order.update block เฉพาะ field เงิน (touchesMoney) แต่ dialog เดิมแนบ
  // discount+taxRate เสมอ → กด Save แก้ที่อยู่ก็โดนเด้งทั้งใบ · ปิดช่องเงิน + ไม่แนบตอนล็อก
  // ให้ field ที่ไม่ใช่เงิน (ที่อยู่/หมายเหตุ/กำหนดส่ง) ยังบันทึกได้ (B10 + บั๊กเดิมสถานะล็อกอื่น)
  const moneyLocked = order ? isOrderLocked(order.internalStatus as InternalStatus) : false;
  const moneyLockHint = order
    ? orderEditLockedReason(order.internalStatus as InternalStatus, "ข้อมูลการเงิน")
    : "";

  // เพดานขาที่สอง (B9): preview ยอดรวมด้วยสูตรเดียวกับ server (order.update recalc
  // จาก subtotal เดิม + ส่วนลด/ภาษีใหม่) — ต่ำกว่าบิลที่ออกแล้ว server จะปฏิเสธ
  const previewTotal = calculateOrderSummary({
    itemSubtotals: [order?.subtotalItems ?? 0],
    feeAmounts: [order?.subtotalFees ?? 0],
    discount: form.discount,
    taxRate: form.taxRate,
  }).grandTotal;
  // เงื่อนไข mirror server ทั้งสองขา: ต่ำกว่า floor "และ" ลดจากยอดเดิม — ออเดอร์เก่า
  // ที่บิลเกินยอดอยู่แล้ว ขยับเข้าหา floor ได้ (ห้ามเตือน "บันทึกไม่ผ่าน" สวนผลจริง)
  const orderBilledFloor = order?.billedFloor ?? 0;
  const belowBilledFloor =
    orderBilledFloor > 0 &&
    previewTotal < orderBilledFloor - 0.005 &&
    previewTotal < (order?.totalAmount ?? 0) - 0.005;

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** ช่องว่าง → null (ลบค่าเดิมจริง) · Prisma อ่าน undefined ว่า "ไม่แตะ field นี้" */
  const emptyToNull = (v: string) => (v.trim() ? v.trim() : null);

  function handleSave() {
    updateMutation.mutate({
      id: order.id,
      title: form.title || undefined,
      description: form.description || undefined,
      deadline: form.deadline || undefined,
      priority: form.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      notes: form.notes || undefined,
      // field เงิน: แนบเฉพาะตอนแก้ได้ — ล็อกอยู่ = ไม่ส่ง (undefined) ให้ touchesMoney
      // เป็น false ที่ server → บันทึก field ที่ไม่ใช่เงินผ่าน ไม่โดน lock guard เด้งทั้งใบ
      ...(moneyLocked
        ? {}
        : {
            taxRate: form.taxRate,
            discount: form.discount,
            platformFee: form.platformFee || undefined,
            // null = ล้างกลับเป็น "ไม่ระบุ" จริง (undefined = Prisma ข้าม field ล้างไม่ได้)
            paymentTerms: (form.paymentTerms || null) as PaymentTermsValue | null,
          }),
      poNumber: form.poNumber || undefined,
      // ที่อยู่จัดส่ง: ช่องว่าง = null (ลบทิ้งจริง) ไม่ใช่ undefined ที่ Prisma อ่านว่า "ไม่แตะ"
      // — เดิมลบข้อความในช่องแล้วกดบันทึก ค่าเก่ายังอยู่เงียบๆ (เบสสั่งแก้ 2026-08-12)
      // ที่อยู่ผิดบนใบส่งของ = ของไปผิดบ้าน จึงต้องลบให้ว่างได้จริง
      shippingRecipientName: emptyToNull(form.shippingRecipientName),
      shippingPhone: emptyToNull(form.shippingPhone),
      shippingAddress: emptyToNull(form.shippingAddress),
      shippingSubDistrict: emptyToNull(form.shippingSubDistrict),
      shippingDistrict: emptyToNull(form.shippingDistrict),
      shippingProvince: emptyToNull(form.shippingProvince),
      shippingPostalCode: emptyToNull(form.shippingPostalCode),
      externalOrderId: form.externalOrderId || undefined,
    });
  }

  const sectionClass =
    "space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700";
  const sectionTitleClass =
    "mb-3 text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลออเดอร์</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {/* --Basic Info-- */}
          <div id="order-edit-info" className={sectionClass}>
            <p className={sectionTitleClass}>ข้อมูลทั่วไป</p>
            <Field label="ชื่อออเดอร์" required>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="ชื่อออเดอร์"
              />
            </Field>
            <Field label="รายละเอียด">
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="รายละเอียดออเดอร์"
                rows={2}
                className="resize-none"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="กำหนดส่ง">
                <DatePicker
                  value={form.deadline}
                  onChange={(v) => update("deadline", v)}
                  className="h-9"
                />
              </Field>
              <Field label="ความเร่งด่วน">
                <Select value={form.priority}
                  onChange={(e) => update("priority", e.target.value)}>
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
              </Field>
            </div>
            <Field label="หมายเหตุ">
              <Textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม"
                rows={2}
                className="resize-none"
              />
            </Field>
          </div>

          {/* --Financial-- */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>การเงิน</p>
            {/* ล็อกอยู่ → ปิดช่องเงิน + บอกเหตุ (ที่อยู่/หมายเหตุ/PO ยังแก้ได้) */}
            {moneyLocked && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                {moneyLockHint}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="ภาษี (%)">
                <Input
                  type="number"
                  value={form.taxRate || ""}
                  onChange={(e) =>
                    update("taxRate", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  min="0"
                  max="100"
                  disabled={moneyLocked}
                />
              </Field>
              <Field label="ส่วนลด (บาท)">
                <Input
                  type="number"
                  value={form.discount || ""}
                  onChange={(e) =>
                    update("discount", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  min="0"
                  disabled={moneyLocked}
                />
              </Field>
              <Field label="ค่าแพลตฟอร์ม">
                <Input
                  type="number"
                  value={form.platformFee || ""}
                  onChange={(e) =>
                    update("platformFee", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  min="0"
                  disabled={moneyLocked}
                />
              </Field>
            </div>
            {/* เพดานขาที่สอง (B9) — ส่วนลด/ภาษีใหม่ทำยอดรวมต่ำกว่าบิลที่ออกแล้ว */}
            {belowBilledFloor && (
              <Alert variant="warning" className="text-xs font-medium">
                ยอดรวมใหม่ {formatCurrency(previewTotal)} ต่ำกว่ายอดบิลที่ออกแล้ว{" "}
                {formatCurrency(orderBilledFloor)} — บันทึกไม่ผ่าน
                ต้องยกเลิกบิลเดิม (แล้วออกใหม่ตามยอดที่ถูก) ก่อนลดยอด
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="เงื่อนไขชำระเงิน">
                <Select value={form.paymentTerms || "_none"}
                  onChange={(e) => update("paymentTerms", e.target.value === "_none" ? "" : e.target.value)}
                  disabled={moneyLocked} placeholder="เลือก...">
                    <option value="_none">ไม่ระบุ</option>
                    {Object.entries(PAYMENT_TERMS_LABELS).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </Select>
              </Field>
              <Field label="เลขที่ PO">
                <Input
                  value={form.poNumber}
                  onChange={(e) => update("poNumber", e.target.value)}
                  placeholder="เลขที่ PO"
                />
              </Field>
            </div>
          </div>

          {/* --Shipping-- */}
          <div id="order-edit-shipping" className={sectionClass}>
            <p className={sectionTitleClass}>ที่อยู่จัดส่ง</p>
            {/* ก๊อปที่อยู่ผู้ติดต่อลงช่องจัดส่ง (เบสสั่ง 2026-08-12) — เดิมแท็บภาพรวมโชว์
                ที่อยู่ลูกค้าเป็นข้อความ "ก๊อปมาใช้ได้" แต่ไม่มีปุ่ม ต้องลากเมาส์ก๊อปเองแล้วมาวาง
                โปรไฟล์เก็บที่อยู่เป็นก้อนเดียว จึงเติมได้แค่ช่อง "ที่อยู่" — 4 ช่องล่างคนเติมเอง */}
            {canUseCustomerAddress && (
              <UseAddressButton
                onClick={() => {
                  const fill = fillFromCustomer(order.customer);
                  setForm((f) => ({
                    ...f,
                    shippingRecipientName: fill.recipientName,
                    shippingPhone: fill.phone,
                    shippingAddress: fill.address,
                  }));
                }}
                className="mb-3"
              >
                ใช้ที่อยู่ลูกค้า
              </UseAddressButton>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="ชื่อผู้รับ">
                <Input
                  value={form.shippingRecipientName}
                  onChange={(e) =>
                    update("shippingRecipientName", e.target.value)
                  }
                  placeholder="ชื่อผู้รับ"
                />
              </Field>
              <Field label="เบอร์โทร">
                <Input
                  value={form.shippingPhone}
                  onChange={(e) => update("shippingPhone", e.target.value)}
                  placeholder="เบอร์โทร"
                />
              </Field>
            </div>
            <Field label="ที่อยู่">
              <Input
                value={form.shippingAddress}
                onChange={(e) => update("shippingAddress", e.target.value)}
                placeholder="ที่อยู่"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ตำบล/แขวง">
                <Input
                  value={form.shippingSubDistrict}
                  onChange={(e) =>
                    update("shippingSubDistrict", e.target.value)
                  }
                  placeholder="ตำบล/แขวง"
                />
              </Field>
              <Field label="อำเภอ/เขต">
                <Input
                  value={form.shippingDistrict}
                  onChange={(e) => update("shippingDistrict", e.target.value)}
                  placeholder="อำเภอ/เขต"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="จังหวัด">
                <Input
                  value={form.shippingProvince}
                  onChange={(e) => update("shippingProvince", e.target.value)}
                  placeholder="จังหวัด"
                />
              </Field>
              <Field label="รหัสไปรษณีย์">
                <Input
                  value={form.shippingPostalCode}
                  onChange={(e) =>
                    update("shippingPostalCode", e.target.value)
                  }
                  placeholder="รหัสไปรษณีย์"
                />
              </Field>
            </div>
          </div>

          {/* --Marketplace-- */}
          {isMarketplace && (
            <div className={sectionClass}>
              <p className={sectionTitleClass}>Marketplace</p>
              <Field label="หมายเลขออเดอร์ภายนอก">
                <Input
                  value={form.externalOrderId}
                  onChange={(e) => update("externalOrderId", e.target.value)}
                  placeholder="หมายเลขจาก Shopee / Lazada / TikTok"
                />
              </Field>
            </div>
          )}
        </div>

        <DialogSubmitFooter
          pending={updateMutation.isPending}
          disabled={!form.title}
          submitLabel="บันทึก"
          submitIcon={<Save />}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}
