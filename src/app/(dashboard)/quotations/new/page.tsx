"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { ArrowLeft, Plus, Trash2, FileText, User } from "lucide-react";

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

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const sectionLabelClass =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";

// ============================================================
// COMPONENT
// ============================================================

export default function NewQuotationPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense (ข้อบังคับ Next.js ตอน prerender)
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
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

  const { data: linkedOrder } = trpc.order.getById.useQuery(
    { id: fromOrderId! },
    { enabled: !!fromOrderId }
  );
  const { data: editing } = trpc.quotation.getById.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  // -- Form state --
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState(""); // โหมดผูกออเดอร์/แก้ไข — ลูกค้าล็อก
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");

  // -- Line items --
  const [items, setItems] = useState<LineItem[]>([{ ...emptyItem }]);

  // -- Pricing --
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  // prefill ครั้งเดียวเมื่อข้อมูลมาถึง — ไม่ทับของที่ผู้ใช้แก้ต่อ
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    if (fromOrderId && linkedOrder) {
      prefilled.current = true;
      setCustomerId(linkedOrder.customerId);
      setCustomerLabel(linkedOrder.customer?.name ?? "");
      setTitle(linkedOrder.title ?? "");
      const orderItems = (linkedOrder.items ?? []) as Array<{
        description: string | null;
        totalQuantity: number;
        subtotal: number;
        products: Array<{ description: string }>;
      }>;
      if (orderItems.length > 0) {
        setItems(
          orderItems.map((it) => ({
            name: it.description || it.products[0]?.description || "รายการ",
            description: it.products.map((p) => p.description).join(", "),
            quantity: it.totalQuantity || 1,
            unit: "ชิ้น",
            unitPrice:
              it.totalQuantity > 0
                ? Math.round((it.subtotal / it.totalQuantity) * 100) / 100
                : 0,
          }))
        );
      }
    } else if (editId && editing) {
      prefilled.current = true;
      setCustomerId(editing.customerId);
      setCustomerLabel(editing.customer?.name ?? "");
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setValidUntil(new Date(editing.validUntil).toISOString().slice(0, 10));
      setTerms(editing.terms ?? "");
      setNotes(editing.notes ?? "");
      setDiscount(editing.discount);
      setTax(editing.tax);
      setItems(
        editing.items.map((it) => ({
          name: it.name,
          description: it.description ?? "",
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
        }))
      );
    }
  }, [fromOrderId, linkedOrder, editId, editing]);

  // ค่าเริ่มอายุใบเสนอ +7 วัน — กรอกเร็วจากแชทไม่ต้องคิดวัน
  useEffect(() => {
    if (!validUntil && !editId) {
      const d = new Date(Date.now() + 7 * 86400_000);
      setValidUntil(d.toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createQuotation = trpc.quotation.create.useMutation({
    onSuccess: (data) => {
      utils.quotation.list.invalidate();
      router.push(`/quotations/${data.id}`);
    },
  });
  const updateQuotation = trpc.quotation.update.useMutation();
  const updateQuotationItems = trpc.quotation.updateItems.useMutation();
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
    const mappedItems = items.map((item) => ({
      name: item.name,
      description: item.description || undefined,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    }));

    if (editId) {
      // โหมดแก้ไขฉบับร่าง — หัวใบ + รายการ (สองก้อน เพราะ totals คิดใหม่ฝั่ง server)
      setEditError(null);
      setEditSaving(true);
      try {
        await updateQuotation.mutateAsync({
          id: editId,
          title,
          description: description || undefined,
          validUntil,
          terms: terms || undefined,
          notes: notes || undefined,
          discount,
          tax,
        });
        await updateQuotationItems.mutateAsync({ id: editId, items: mappedItems });
        utils.quotation.list.invalidate();
        utils.quotation.getById.invalidate({ id: editId });
        router.push(`/quotations/${editId}`);
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
      title,
      description: description || undefined,
      validUntil,
      terms: terms || undefined,
      notes: notes || undefined,
      discount,
      tax,
      items: mappedItems,
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/quotations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            {editId ? "แก้ไขใบเสนอราคา (ฉบับร่าง)" : "สร้างใบเสนอราคาใหม่"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {fromOrderId
              ? `ผูกกับออเดอร์ ${linkedOrder?.orderNumber ?? "..."} — ลูกค้าตกลงแล้วระบบจะยืนยันออเดอร์ใบเดิม ไม่สร้างซ้ำ`
              : editId
                ? editing?.quotationNumber ?? ""
                : "กรอกรายละเอียดใบเสนอราคา"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ============================================================ */}
        {/* BASIC INFO                                                   */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลทั่วไป</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={sectionLabelClass}>ลูกค้า *</label>
                {fromOrderId || editId ? (
                  // ลูกค้าล็อกตามออเดอร์/ใบเดิม — เปลี่ยนลูกค้า = เปิดใบใหม่
                  <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                    <User className="h-4 w-4 text-slate-400" />
                    {customerLabel || "..."}
                  </div>
                ) : (
                  <CustomerPicker
                    value={customerId}
                    onChange={(id) => setCustomerId(id)}
                    required
                  />
                )}
              </div>
              <div>
                <label className={sectionLabelClass}>ใช้ได้ถึงวันที่ *</label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={sectionLabelClass}>ชื่อใบเสนอราคา *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น ใบเสนอราคาเสื้อทีม ABC, ถุงผ้ารณรงค์..."
                required
              />
            </div>
            <div>
              <label className={sectionLabelClass}>รายละเอียด</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={3}
              />
            </div>
            <div>
              <label className={sectionLabelClass}>เงื่อนไข</label>
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="เงื่อนไขการชำระเงิน, การจัดส่ง..."
                rows={3}
              />
            </div>
            <div>
              <label className={sectionLabelClass}>หมายเหตุ</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุภายใน..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* LINE ITEMS                                                   */}
        {/* ============================================================ */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              รายการสินค้า
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" />
              เพิ่มรายการ
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, idx) => {
              const rowTotal = item.quantity * item.unitPrice;

              return (
                <div
                  key={idx}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30"
                >
                  {/* Item header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      รายการ #{idx + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(rowTotal)}
                      </span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Name + Description */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>ชื่อรายการ *</label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        placeholder="เช่น เสื้อยืด Cotton 100%"
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>คำอธิบาย</label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                        placeholder="รายละเอียดเพิ่มเติม..."
                      />
                    </div>
                  </div>

                  {/* Quantity, Unit, Unit Price */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>จำนวน *</label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            "quantity",
                            parseInt(e.target.value) || 1,
                          )
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>หน่วย</label>
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                        placeholder="ชิ้น"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>ราคาต่อหน่วย *</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice || ""}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            "unitPrice",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* PRICE SUMMARY                                                */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">สรุปราคา</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              {/* Subtotal */}
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>ยอดรวมสินค้า</span>
                <span className="tabular-nums">
                  {formatCurrency(pricingSummary.subtotal)}
                </span>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between">
                <label className="text-slate-600 dark:text-slate-400">
                  ส่วนลด
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={discount || ""}
                  onChange={(e) =>
                    setDiscount(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="w-32 text-right"
                />
              </div>

              {/* Tax — จำนวนเงินบาท (ต่างจากฟอร์มออเดอร์ที่เป็น %) · ปุ่มลัดคิด 7%
                  จากฐานหลังหักส่วนลด — บริษัทจด VAT ใบเสนอควรมีภาษีเสมอ (Gate B2) */}
              <div className="flex items-center justify-between">
                <label className="text-slate-600 dark:text-slate-400">
                  ภาษี (บาท)
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    title="คำนวณ VAT 7% จากยอดหลังหักส่วนลด"
                    onClick={() => {
                      const base = Math.max(0, pricingSummary.subtotal - discount);
                      setTax(Math.round(base * 7) / 100);
                    }}
                  >
                    VAT 7%
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={tax || ""}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-32 text-right"
                  />
                </div>
              </div>
            </div>

            {/* Summary breakdown */}
            <div className="space-y-1.5 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
              <div className="flex justify-between text-slate-500">
                <span>ยอดรวมสินค้า</span>
                <span className="tabular-nums">
                  {formatCurrency(pricingSummary.subtotal)}
                </span>
              </div>
              {pricingSummary.discount > 0 && (
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>- ส่วนลด</span>
                  <span className="tabular-nums">
                    -{formatCurrency(pricingSummary.discount)}
                  </span>
                </div>
              )}
              {pricingSummary.tax > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>+ ภาษี</span>
                  <span className="tabular-nums">
                    +{formatCurrency(pricingSummary.tax)}
                  </span>
                </div>
              )}
            </div>

            {/* Grand total */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                ยอดรวมทั้งหมด
              </span>
              <span className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {formatCurrency(pricingSummary.total)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* Actions                                                      */}
        {/* ============================================================ */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/quotations">
            <Button type="button" variant="outline">
              ยกเลิก
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={createQuotation.isPending || editSaving}
          >
            {createQuotation.isPending || editSaving
              ? "กำลังบันทึก..."
              : editId
                ? "บันทึกการแก้ไข"
                : "สร้างใบเสนอราคา"}
          </Button>
        </div>

        {/* Error display */}
        {(createQuotation.isError || editError) && (
          <Alert variant="error">
            {editError ?? createQuotation.error?.message}
          </Alert>
        )}
      </form>
    </div>
  );
}
