"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Select } from "@/components/ui/select";
import { Save } from "lucide-react";
import {
  isMarketplaceChannel,
  isOrderLocked,
  orderEditLockedReason,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { PAYMENT_TERMS_LABELS, type PaymentTermsValue } from "@/lib/payment-terms";
import { calculateOrderSummary } from "@/lib/pricing";
import { fillFromCustomer, hasAddressContent } from "@/lib/address-fill";
// ฟอร์มชุดเดียวกับหน้าเปิดงาน — เบสสั่ง "ใช้ฟอร์มเดียวกับสร้างออเดอร์ UI จะได้เหมือนกัน"
import { OrderDetailFields, OrderShippingSection } from "@/components/orders/new";
import { formatCurrency } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

interface OrderInfoEditOrder {
  id: string;
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

/** ชื่อช่องในฟอร์มที่อยู่กลาง → ชื่อช่องบนออเดอร์ (Order.shipping*)
 *  คนละชื่อกันตั้งแต่ schema — ตารางนี้คือที่เดียวที่แปลง ไม่ให้ไปเดาซ้ำหลายที่ */
const SHIPPING_FIELD_MAP = {
  recipientName: "shippingRecipientName",
  phone: "shippingPhone",
  address: "shippingAddress",
  subDistrict: "shippingSubDistrict",
  district: "shippingDistrict",
  province: "shippingProvince",
  postalCode: "shippingPostalCode",
} as const;

interface FormData {
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

  const isMarketplace = isMarketplaceChannel(order?.channel ?? "");

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
    "space-y-3 rounded-lg border border-border p-4";
  const sectionTitleClass =
    "mb-3 text-xs font-semibold text-muted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลออเดอร์</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
          {/* --Basic Info-- ใช้ช่องชุดเดียวกับหน้าเปิดงาน (ก้อน 3 · เบสสั่ง 2026-08-11
              "หน้ารายละเอียดกดแก้ไข ก็ใช้ฟอร์มเดียวกับสร้างออเดอร์เลย UI จะได้เหมือนกัน")
              — เดิมที่นี่เขียนช่องเอง จึงเรียงคนละลำดับ ป้ายคนละคำ และตกช่องที่หน้าเปิดงานมี */}
          <div id="order-edit-info" className={sectionClass}>
            <p className={sectionTitleClass}>ข้อมูลทั่วไป</p>
            <OrderDetailFields
              deadline={form.deadline}
              onDeadlineChange={(v) => update("deadline", v)}
              priority={form.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT"}
              onPriorityChange={(v) => update("priority", v)}
              channel={order?.channel ?? "LINE"}
              onChannelChange={() => {}}
              channelLockedReason="ช่องทางเปลี่ยนไม่ได้หลังเปิดงาน — ผูกกับเลขออเดอร์ฝั่งแพลตฟอร์มและสูตรภาษีที่คิดไปแล้ว"
              isMarketplace={isMarketplace}
              externalOrderId={form.externalOrderId}
              onExternalOrderIdChange={(v) => update("externalOrderId", v)}
              description={form.description}
              onDescriptionChange={(v) => update("description", v)}
              notes={form.notes}
              onNotesChange={(v) => update("notes", v)}
            />
          </div>

          {/* --Financial-- */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>การเงิน</p>
            {/* ล็อกอยู่ → ปิดช่องเงิน + บอกเหตุ (ที่อยู่/หมายเหตุ/PO ยังแก้ได้) */}
            {moneyLocked && (
              <p className="rounded-lg border border-border bg-surface-muted px-2.5 py-2 text-xs text-muted">
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

          {/* --Shipping-- ใช้ฟอร์มที่อยู่ตัวเดียวกับหน้าเปิดงาน (ก้อน 3)
              alwaysOn = ไม่มีสวิตช์ "จัดส่งตามที่อยู่" — ออเดอร์ที่เปิดแล้วลบที่อยู่ทิ้ง
              ด้วยการล้างช่องได้ตรงๆ (input เป็น nullable ตั้งแต่ 2026-08-12) */}
          <div id="order-edit-shipping">
            <OrderShippingSection
              embedded
              alwaysOn
              title="ที่อยู่จัดส่ง"
              includeShipping
              onIncludeShippingChange={() => {}}
              shipping={{
                recipientName: form.shippingRecipientName,
                phone: form.shippingPhone,
                address: form.shippingAddress,
                subDistrict: form.shippingSubDistrict,
                district: form.shippingDistrict,
                province: form.shippingProvince,
                postalCode: form.shippingPostalCode,
              }}
              onUpdate={(field, value) => update(SHIPPING_FIELD_MAP[field], value)}
              onUseCustomerAddress={
                canUseCustomerAddress
                  ? () => {
                      const fill = fillFromCustomer(order.customer);
                      setForm((f) => ({
                        ...f,
                        shippingRecipientName: fill.recipientName,
                        shippingPhone: fill.phone,
                        shippingAddress: fill.address,
                      }));
                    }
                  : undefined
              }
            />
          </div>

          {/* บล็อก Marketplace เดิมถูกยุบ — เลขออเดอร์ฝั่งแพลตฟอร์มอยู่ในช่องข้อมูลงาน
              ชุดเดียวกับหน้าเปิดงานแล้ว (โผล่เองเมื่อช่องทางเป็นมาร์เก็ตเพลส) */}
        </div>

        <DialogSubmitFooter
          pending={updateMutation.isPending}
          submitLabel="บันทึก"
          submitIcon={<Save />}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}
