"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Save } from "lucide-react";
import {
  PRIORITY_LABELS,
  PAYMENT_TERMS_LABELS,
} from "@/lib/order-status";

interface OrderInfoEditOrder {
  id: string;
  title: string;
  description: string | null;
  deadline: string | Date | null;
  priority: string;
  notes: string | null;
  taxRate: number;
  discount: number;
  platformFee: number | null;
  paymentTerms: string | null;
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
}

interface OrderInfoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderInfoEditOrder;
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

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    updateMutation.mutate({
      id: order.id,
      title: form.title || undefined,
      description: form.description || undefined,
      deadline: form.deadline || undefined,
      priority: form.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      notes: form.notes || undefined,
      taxRate: form.taxRate,
      discount: form.discount,
      platformFee: form.platformFee || undefined,
      paymentTerms: form.paymentTerms || undefined,
      poNumber: form.poNumber || undefined,
      shippingRecipientName: form.shippingRecipientName || undefined,
      shippingPhone: form.shippingPhone || undefined,
      shippingAddress: form.shippingAddress || undefined,
      shippingSubDistrict: form.shippingSubDistrict || undefined,
      shippingDistrict: form.shippingDistrict || undefined,
      shippingProvince: form.shippingProvince || undefined,
      shippingPostalCode: form.shippingPostalCode || undefined,
      externalOrderId: form.externalOrderId || undefined,
    });
  }

  const sectionClass =
    "space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700";
  const sectionTitleClass =
    "mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500";
  const labelClass = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลออเดอร์</DialogTitle>
          <DialogDescription>
            แก้ไขข้อมูลทั่วไป การเงิน และที่อยู่จัดส่ง
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {/* ---- Basic Info ---- */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>ข้อมูลทั่วไป</p>
            <div>
              <label className={labelClass}>ชื่อออเดอร์ *</label>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="ชื่อออเดอร์"
                className="h-9"
              />
            </div>
            <div>
              <label className={labelClass}>รายละเอียด</label>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="รายละเอียดออเดอร์"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>กำหนดส่ง</label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => update("deadline", e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className={labelClass}>ความเร่งด่วน</label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => update("priority", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className={labelClass}>หมายเหตุ</label>
              <Textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          {/* ---- Financial ---- */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>การเงิน</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>ภาษี (%)</label>
                <Input
                  type="number"
                  value={form.taxRate || ""}
                  onChange={(e) =>
                    update("taxRate", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  className="h-9"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className={labelClass}>ส่วนลด (บาท)</label>
                <Input
                  type="number"
                  value={form.discount || ""}
                  onChange={(e) =>
                    update("discount", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  className="h-9"
                  min="0"
                />
              </div>
              <div>
                <label className={labelClass}>ค่าแพลตฟอร์ม</label>
                <Input
                  type="number"
                  value={form.platformFee || ""}
                  onChange={(e) =>
                    update("platformFee", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  className="h-9"
                  min="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>เงื่อนไขชำระเงิน</label>
                <Select
                  value={form.paymentTerms || "_none"}
                  onValueChange={(v) =>
                    update("paymentTerms", v === "_none" ? "" : v)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="เลือก..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-- ไม่ระบุ --</SelectItem>
                    {Object.entries(PAYMENT_TERMS_LABELS).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelClass}>เลขที่ PO</label>
                <Input
                  value={form.poNumber}
                  onChange={(e) => update("poNumber", e.target.value)}
                  placeholder="เลขที่ PO"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* ---- Shipping ---- */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>ที่อยู่จัดส่ง</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>ชื่อผู้รับ</label>
                <Input
                  value={form.shippingRecipientName}
                  onChange={(e) =>
                    update("shippingRecipientName", e.target.value)
                  }
                  placeholder="ชื่อผู้รับ"
                  className="h-9"
                />
              </div>
              <div>
                <label className={labelClass}>เบอร์โทร</label>
                <Input
                  value={form.shippingPhone}
                  onChange={(e) => update("shippingPhone", e.target.value)}
                  placeholder="เบอร์โทร"
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>ที่อยู่</label>
              <Input
                value={form.shippingAddress}
                onChange={(e) => update("shippingAddress", e.target.value)}
                placeholder="ที่อยู่"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>ตำบล/แขวง</label>
                <Input
                  value={form.shippingSubDistrict}
                  onChange={(e) =>
                    update("shippingSubDistrict", e.target.value)
                  }
                  placeholder="ตำบล/แขวง"
                  className="h-9"
                />
              </div>
              <div>
                <label className={labelClass}>อำเภอ/เขต</label>
                <Input
                  value={form.shippingDistrict}
                  onChange={(e) => update("shippingDistrict", e.target.value)}
                  placeholder="อำเภอ/เขต"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>จังหวัด</label>
                <Input
                  value={form.shippingProvince}
                  onChange={(e) => update("shippingProvince", e.target.value)}
                  placeholder="จังหวัด"
                  className="h-9"
                />
              </div>
              <div>
                <label className={labelClass}>รหัสไปรษณีย์</label>
                <Input
                  value={form.shippingPostalCode}
                  onChange={(e) =>
                    update("shippingPostalCode", e.target.value)
                  }
                  placeholder="รหัสไปรษณีย์"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* ---- Marketplace ---- */}
          {isMarketplace && (
            <div className={sectionClass}>
              <p className={sectionTitleClass}>Marketplace</p>
              <div>
                <label className={labelClass}>หมายเลขออเดอร์ภายนอก</label>
                <Input
                  value={form.externalOrderId}
                  onChange={(e) => update("externalOrderId", e.target.value)}
                  placeholder="หมายเลขจาก Shopee / Lazada / TikTok"
                  className="h-9"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={!form.title || updateMutation.isPending}
            className="gap-1.5"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
