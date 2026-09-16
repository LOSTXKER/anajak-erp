"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { Field } from "@/components/ui/field";
import { FIELD_LABEL } from "@/components/ui/tokens";
import { Input } from "@/components/ui/input";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneMark } from "@/components/ui/section";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { c } from "@/components/kit/kit";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { permAllows } from "@/lib/permissions";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Plus, Trash2, ClipboardList, User, PenLine } from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type LineItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type QuotationFormValues = {
  customerId: string;
  description: string;
  validUntil: string;
  terms: string;
  notes: string;
  items: LineItem[];
  discount: number;
  tax: number;
};

// ============================================================
// DEFAULTS
// ============================================================

const emptyItem: LineItem = {
  name: "",
  description: "",
  quantity: 1,
  unit: "ชิ้น",
  unitPrice: 0,
};

// ============================================================
// STYLES
// ============================================================

const labelClass = FIELD_LABEL;

const sectionLabelClass =
  "mb-1.5 block text-sm font-medium text-secondary";

/* ตารางรายการในฟอร์ม (ต้นแบบ 2026-09-16): หัวคอลัมน์ครั้งเดียวด้านบน แล้วแต่ละแถว
   เป็น รายการ | จำนวน + หน่วย | ราคา/หน่วย | รวม | ปุ่มลบ
   วัดจาก "ความกว้างการ์ด" (@container) ไม่ใช่ความกว้างหน้าต่าง เพราะการ์ดนี้ยืนใน
   คอลัมน์ 7 ส่วนของ 12 — จอกว้าง 1,440 แต่ที่ว่างจริงในการ์ดเหลือราว 590px
   แคบกว่านั้นช่องกรอกเรียงลงมาพร้อมป้ายกำกับของตัวเอง (หัวคอลัมน์ซ่อน) */
const ITEM_GRID = "@2xl:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_5.5rem_2rem]";

// ============================================================
// COMPONENT
// ============================================================

export default function NewQuotationPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense (ข้อบังคับ Next.js ตอน prerender)
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <QuotationFormPage />
    </Suspense>
  );
}

function QuotationFormPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  // สะพานใบเสนอ (audit ข้อ 8): ?orderId= ออกใบเสนอผูกออเดอร์ (ตกลงแล้วยืนยันใบเดิม)
  // · ?edit= แก้ใบเสนอฉบับร่าง (audit ข้อ 11) — ฟอร์มเดียวใช้ทั้งสามโหมด
  const fromOrderId = searchParams.get("orderId") ?? undefined;
  const editId = searchParams.get("edit") ?? undefined;
  const redirectToCanonicalIntake = !fromOrderId && !editId;

  // ใบเสนอใหม่ต้องเริ่มจาก “เปิดงาน” ทางเดียว เพื่อไม่ให้เกิดออเดอร์ลอยซ้ำกัน
  // route เดิมยังคงใช้แก้ใบเสนอ (?edit=) และออกใบจากออเดอร์เดิม (?orderId=) ได้
  useEffect(() => {
    if (redirectToCanonicalIntake) router.replace("/orders/new?next=quote");
  }, [redirectToCanonicalIntake, router]);

  // PERM5: ใบเสนอ = เอกสารราคาล้วน — ต้องเห็นเงินฝั่งขายถึงจะสร้าง/แก้ได้ (ตรง quotation.getById/list)
  // กันเคส override (create_sales_docs=true แต่ see_order_money=false): เดิมสร้างได้แล้วเปิดดูไม่ได้
  // → ใบถูกสร้างเงียบๆ เจอ error เสี่ยงกดซ้ำ · ยังไม่โหลด me = ให้ผ่านไว้ก่อน (กัน flash)
  const { data: me } = trpc.user.me.useQuery();
  const canAuthor = !me || permAllows(me.permissions, "see_order_money");

  const {
    data: linkedOrder,
    isLoading: linkedOrderLoading,
    isError: linkedOrderIsError,
    refetch: refetchLinkedOrder,
  } = trpc.order.getById.useQuery(
    { id: fromOrderId! },
    { enabled: !!fromOrderId }
  );
  const {
    data: editing,
    isLoading: editingLoading,
    isError: editingIsError,
    refetch: refetchEditing,
  } = trpc.quotation.getById.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  // -- Form state --
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState(""); // โหมดผูกออเดอร์/แก้ไข — ลูกค้าล็อก
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");

  // -- Line items --
  const [items, setItems] = useState<LineItem[]>([{ ...emptyItem }]);

  // -- Pricing --
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [initialValues, setInitialValues] = useState<QuotationFormValues | null>(null);
  const formValues: QuotationFormValues = { customerId, description, validUntil, terms, notes, items, discount, tax };
  const isDirty = initialValues !== null && JSON.stringify(formValues) !== JSON.stringify(initialValues);
  const { navigateAfterSave } = useUnsavedChanges(isDirty);

  // prefill ครั้งเดียวเมื่อข้อมูลมาถึง — ไม่ทับของที่ผู้ใช้แก้ต่อ
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    let values: QuotationFormValues;
    if (fromOrderId && linkedOrder) {
      setCustomerLabel(linkedOrder.customer?.name ?? "");
      const orderItems = (linkedOrder.items ?? []) as Array<{
        description: string | null;
        totalQuantity: number;
        subtotal: number;
        products: Array<{ description: string }>;
      }>;
      values = {
        customerId: linkedOrder.customerId,
        description: "",
        validUntil: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
        terms: "",
        notes: "",
        items: orderItems.length > 0
          ? orderItems.map((it) => ({
            name: it.description || it.products[0]?.description || "รายการ",
            description: it.products.map((p) => p.description).join(", "),
            quantity: it.totalQuantity || 1,
            unit: "ชิ้น",
            unitPrice:
              it.totalQuantity > 0
                ? Math.round((it.subtotal / it.totalQuantity) * 100) / 100
                : 0,
          }))
          : [{ ...emptyItem }],
        discount: 0,
        tax: 0,
      };
    } else if (editId && editing) {
      setCustomerLabel(editing.customer?.name ?? "");
      values = {
        customerId: editing.customerId,
        description: editing.description ?? "",
        validUntil: new Date(editing.validUntil).toISOString().slice(0, 10),
        terms: editing.terms ?? "",
        notes: editing.notes ?? "",
        items: editing.items.map((it) => ({
          name: it.name,
          description: it.description ?? "",
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
        })),
        discount: editing.discount,
        tax: editing.tax,
      };
    } else return;
    prefilled.current = true;
    setInitialValues(values);
    setCustomerId(values.customerId);
    setDescription(values.description);
    setValidUntil(values.validUntil);
    setTerms(values.terms);
    setNotes(values.notes);
    setItems(values.items);
    setDiscount(values.discount);
    setTax(values.tax);
  }, [fromOrderId, linkedOrder, editId, editing]);

  const createQuotation = trpc.quotation.create.useMutation({
    onSuccess: (data) => {
      utils.quotation.list.invalidate();
      navigateAfterSave(`/quotations/${data.id}`);
    },
  });
  const updateDraft = trpc.quotation.updateDraft.useMutation();
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ---- pricing calculations ----
  const pricingSummary = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  }, [items, discount, tax]);

  // ---- item helpers ----
  const addItem = () => setItems([...items, { ...emptyItem }]);

  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));

  const updateItem = <K extends keyof LineItem>(
    idx: number,
    field: K,
    value: LineItem[K],
  ) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  };

  // ---- submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ต้องตรวจเอง — ช่องเลือกลูกค้าเป็นเมนูของเราแล้ว prop required บอกได้แค่โปรแกรม
    // อ่านหน้าจอ ไม่บล็อกการกดส่งเหมือน <select required> เดิม (ดู ui/select.tsx)
    // ถ้าปล่อยผ่าน server จะโยน FK error ดิบๆ ขึ้นหน้าจอแทนข้อความที่คนอ่านรู้เรื่อง
    if (!customerId) {
      setEditError("กรุณาเลือกลูกค้าก่อนสร้างใบเสนอราคา");
      document.getElementById("quotation-customer")?.focus();
      return;
    }

    const mappedItems = items.map((item) => ({
      name: item.name,
      description: item.description || undefined,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    }));

    if (editId) {
      // โหมดแก้ไขฉบับร่าง — หัวใบ + รายการบันทึกก้อนเดียวที่ server
      // ถ้าส่วนใดพัง transaction จะ rollback ทั้งใบ จึงไม่มี partial save
      setEditError(null);
      setEditSaving(true);
      try {
        await updateDraft.mutateAsync({
          id: editId,
          description: description || undefined,
          validUntil,
          terms: terms || undefined,
          notes: notes || undefined,
          discount,
          tax,
          items: mappedItems,
        });
        utils.quotation.list.invalidate();
        utils.quotation.getById.invalidate({ id: editId });
        navigateAfterSave(`/quotations/${editId}`);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      } finally {
        setEditSaving(false);
      }
      return;
    }

    createQuotation.mutate({
      customerId,
      orderId: fromOrderId,
      description: description || undefined,
      validUntil,
      terms: terms || undefined,
      notes: notes || undefined,
      discount,
      tax,
      items: mappedItems,
    });
  };

  const saving = createQuotation.isPending || editSaving;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <PageShell
      back={{ href: "/quotations", label: "ใบเสนอราคาทั้งหมด" }}
      title={editId ? "แก้ไขใบเสนอราคา (ฉบับร่าง)" : "สร้างใบเสนอราคา"}
      meta={
        fromOrderId
          ? `ผูกกับออเดอร์ ${linkedOrder?.orderNumber ?? "..."} — ลูกค้าตกลงแล้วระบบจะยืนยันออเดอร์ใบเดิม ไม่สร้างซ้ำ`
          : editId
            ? editing?.quotationNumber ?? ""
            : "บันทึกแล้วได้ใบฉบับร่าง จากนั้นกดส่งลิงก์ให้ลูกค้ากดรับได้เลย ไม่ต้องล็อกอิน"
      }
      /* ปุ่มสั่งงานอยู่มุมขวาบนตามต้นแบบ — action ถูก render นอก <form> จึงผูกกลับ
         ด้วย form="quotation-form" (ไม่เรียก handleSubmit ตรงๆ เพราะจะข้าม required
         ของเบราว์เซอร์ที่ช่องชื่อรายการ/จำนวน/ราคาใช้อยู่) */
      action={
        <>
          <Button type="button" variant="outline" asChild>
            <Link href="/quotations">ยกเลิก</Link>
          </Button>
          <Button type="submit" form="quotation-form" disabled={saving}>
            {saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "สร้างใบเสนอราคา"}
          </Button>
        </>
      }
      error={
        // โหลด prefill ไม่สำเร็จ (โหมดผูกออเดอร์/แก้ไข) → กันฟอร์มเปล่าไปเซฟทับใบเดิม
        // && !data: กันเฉพาะโหลดแรกพัง — refetch เบื้องหลังล้มระหว่างกรอกฟอร์มอยู่ ห้ามถอนฟอร์มทิ้ง
        fromOrderId && linkedOrderIsError && !linkedOrder
          ? {
              message: "เกิดข้อผิดพลาดในการโหลดข้อมูล",
              onRetry: () => void refetchLinkedOrder(),
            }
          : editId && editingIsError && !editing
            ? {
                message: "เกิดข้อผิดพลาดในการโหลดข้อมูล",
                onRetry: () => void refetchEditing(),
              }
            : null
      }
      loading={redirectToCanonicalIntake || (!!fromOrderId && linkedOrderLoading && !linkedOrder) || (!!editId && editingLoading && !editing)}
      skeleton={<ListPageSkeleton />}
      denied={
        !!me &&
        !canAuthor && {
          description:
            'ใบเสนอราคาเป็นเอกสารราคา — ต้องมีสิทธิ์ "เห็นเงินฝั่งขาย" จึงจะสร้างได้ (เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้)',
        }
      }
    >
      <form id="quotation-form" onSubmit={handleSubmit} className={c("two")}>
        <div className={c("stack")}>
          {/* ============================================================ */}
          {/* รายการที่เสนอ + สรุปยอด (ต้นแบบรวมไว้การ์ดเดียว)              */}
          {/* ============================================================ */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ToneMark icon={ClipboardList} tone="product" />
                รายการที่เสนอ
              </CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus />
                เพิ่มรายการ
              </Button>
            </CardHeader>
            <CardContent className="@container">
              {/* หัวคอลัมน์ครั้งเดียว — การ์ดแคบกว่านี้ช่องกรอกมีป้ายของตัวเองแทน */}
              <div
                className={cn(
                  "hidden gap-2.5 border-b border-divider pb-2 text-xs text-muted @2xl:grid",
                  ITEM_GRID,
                )}
              >
                <span>รายการ</span>
                <span>จำนวน</span>
                <span className="text-right">ราคา/หน่วย</span>
                <span className="text-right">รวม</span>
                <span className="sr-only">ลบรายการ</span>
              </div>

              {items.map((item, idx) => {
                const rowTotal = item.quantity * item.unitPrice;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "grid gap-2.5 border-b border-divider py-3 last:border-b-0 last:pb-0 @2xl:items-start",
                      ITEM_GRID,
                    )}
                  >
                    {/* ชื่อรายการ + คำอธิบายเป็นบรรทัดที่สองใต้ชื่อ */}
                    <div className="space-y-1.5">
                      <label htmlFor={`quotation-item-${idx}-name`} className={cn(labelClass, "@2xl:sr-only")}>
                        ชื่อรายการ *
                      </label>
                      <Input
                        id={`quotation-item-${idx}-name`}
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        placeholder="เช่น เสื้อยืด Cotton 100%"
                        required
                      />
                      <label htmlFor={`quotation-item-${idx}-description`} className={cn(labelClass, "@2xl:sr-only")}>
                        คำอธิบาย
                      </label>
                      <Input
                        id={`quotation-item-${idx}-description`}
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        placeholder="รายละเอียดเพิ่มเติม..."
                      />
                    </div>

                    {/* จำนวน + หน่วย อยู่คอลัมน์เดียวกันตามต้นแบบ ("250 ชิ้น") */}
                    <div className="space-y-1.5">
                      <label htmlFor={`quotation-item-${idx}-quantity`} className={cn(labelClass, "@2xl:sr-only")}>
                        จำนวน *
                      </label>
                      <div className="flex gap-1.5">
                        <NumberInput
                          id={`quotation-item-${idx}-quantity`}
                          integer
                          min={1}
                          fallback={1}
                          value={item.quantity}
                          onValueChange={(value) => updateItem(idx, "quantity", value || 1)}
                          className="min-w-0 flex-1"
                          required
                        />
                        <Input
                          id={`quotation-item-${idx}-unit`}
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          placeholder="ชิ้น"
                          aria-label={`หน่วยของรายการที่ ${idx + 1}`}
                          className="w-14 min-w-0 px-2"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={`quotation-item-${idx}-price`} className={cn(labelClass, "@2xl:sr-only")}>
                        ราคาต่อหน่วย *
                      </label>
                      <MoneyInput
                        id={`quotation-item-${idx}-price`}
                        value={item.unitPrice}
                        onValueChange={(value) => updateItem(idx, "unitPrice", value)}
                        placeholder="0.00"
                        className="text-right"
                        required
                      />
                    </div>

                    <div className="flex items-baseline justify-between gap-2 @2xl:block @2xl:pt-2 @2xl:text-right">
                      <span className={cn(labelClass, "mb-0 @2xl:sr-only")}>รวม</span>
                      <span className="text-sm font-medium tabular-nums text-strong">
                        {formatCurrency(rowTotal)}
                      </span>
                    </div>

                    <div className="@2xl:pt-1">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(idx)}
                          className="text-red-500 dark:text-red-400"
                          aria-label={`ลบรายการ ${idx + 1}`}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ---- ส่วนลด/ภาษี แล้วต่อด้วยกล่องสรุปยอด (ต้นแบบ .sumbox) ---- */}
              <div className="mt-4 space-y-3 border-t border-divider pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="quotation-discount" className="text-sm text-secondary">
                    ส่วนลด (บาท)
                  </label>
                  <MoneyInput
                    id="quotation-discount"
                    value={discount}
                    onValueChange={setDiscount}
                    placeholder="0.00"
                    className="w-32 text-right"
                  />
                </div>

                {/* ภาษี — จำนวนเงินบาท (ต่างจากฟอร์มออเดอร์ที่เป็น %) · ปุ่มลัดคิด 7%
                    จากฐานหลังหักส่วนลด — บริษัทจด VAT ใบเสนอควรมีภาษีเสมอ (Gate B2) */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="quotation-tax" className="text-sm text-secondary">
                    ภาษีมูลค่าเพิ่ม (บาท)
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="คำนวณ VAT 7% จากยอดหลังหักส่วนลด"
                      onClick={() => {
                        const base = Math.max(0, pricingSummary.subtotal - discount);
                        setTax(Math.round(base * 7) / 100);
                      }}
                    >
                      VAT 7%
                    </Button>
                    <MoneyInput
                      id="quotation-tax"
                      value={tax}
                      onValueChange={setTax}
                      placeholder="0.00"
                      className="w-32 text-right"
                    />
                  </div>
                </div>

                <div className="border-t border-divider pt-2">
                  <div className={c("srow")}>
                    <span>ยอดก่อนภาษี</span>
                    <b>{formatCurrency(pricingSummary.subtotal)}</b>
                  </div>
                  <div className={c("srow")}>
                    <span>ส่วนลด</span>
                    <b className={pricingSummary.discount > 0 ? c("neg") : undefined}>
                      {pricingSummary.discount > 0
                        ? `-${formatCurrency(pricingSummary.discount)}`
                        : formatCurrency(0)}
                    </b>
                  </div>
                  <div className={c("srow")}>
                    <span>ภาษีมูลค่าเพิ่ม</span>
                    <b>{formatCurrency(pricingSummary.tax)}</b>
                  </div>
                  <div className={c("srow total")}>
                    <span>ยอดสุทธิ</span>
                    <b>{formatCurrency(pricingSummary.total)}</b>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error display — อยู่ใต้การ์ดหลัก ไม่ให้ข้อความพลาดหลุดออกนอกสายตา */}
          {(createQuotation.isError || editError) && (
            <Alert variant="error">
              {editError ?? createQuotation.error?.message}
            </Alert>
          )}
        </div>

        <div className={c("stack")}>
          {/* ============================================================ */}
          {/* ลูกค้าและเงื่อนไข                                            */}
          {/* ============================================================ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ToneMark icon={User} tone="brand" />
                ลูกค้าและเงื่อนไข
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset>
                <legend className={sectionLabelClass}>ลูกค้า *</legend>
                {fromOrderId || editId ? (
                  // ลูกค้าล็อกตามออเดอร์/ใบเดิม — เปลี่ยนลูกค้า = เปิดใบใหม่
                  <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 text-sm text-secondary dark:bg-slate-800/50">
                    <User className="h-4 w-4 text-muted" />
                    {customerLabel || "..."}
                  </div>
                ) : (
                  <CustomerPicker
                    id="quotation-customer"
                    value={customerId}
                    onChange={(id) => setCustomerId(id)}
                    required
                  />
                )}
              </fieldset>
              <Field label="ชื่องาน" id="quotation-description">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น เสื้อโปโลพนักงาน 250 ตัว"
                />
              </Field>
              <Field label="เงื่อนไขชำระ" id="quotation-terms">
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="เช่น มัดจำ 50% ก่อนผลิต ที่เหลือชำระก่อนส่งของ"
                  rows={2}
                />
              </Field>
              <Field label="ยืนราคาถึงวันที่" required id="quotation-valid-until">
                <DatePicker
                  value={validUntil}
                  onChange={(v) => setValidUntil(v)}
                  required
                />
              </Field>
            </CardContent>
          </Card>

          {/* ============================================================ */}
          {/* ข้อความในเอกสาร                                              */}
          {/* ============================================================ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ToneMark icon={PenLine} tone="system" />
                ข้อความในเอกสาร
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* ฐานข้อมูลมี notes ช่องเดียว และค่านี้ถูกพิมพ์ลงใบเสนอราคาที่ลูกค้าได้รับ
                  (print/quotation) — ห้ามเขียนว่าเป็น "หมายเหตุภายใน" เหมือนต้นแบบ */}
              <Field
                label="หมายเหตุถึงลูกค้า"
                id="quotation-notes"
                description="ข้อความนี้จะถูกพิมพ์ลงใบเสนอราคาที่ลูกค้าได้รับ"
              >
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เช่น ราคานี้ยังไม่รวมค่าจัดส่ง"
                  rows={3}
                />
              </Field>
            </CardContent>
          </Card>
        </div>
      </form>
    </PageShell>
  );
}
