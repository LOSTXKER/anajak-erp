"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { FOCUS_FIELD_INVALID } from "@/components/ui/tokens";
import { SHIPPING_METHODS } from "@/lib/shipping-methods";
import {
  fillFromCustomer,
  fillFromOrderShipping,
  hasAddressContent,
  type OrderShippingSource,
} from "@/lib/address-fill";
import { UseAddressButton } from "@/components/orders/use-address-button";
import { Truck } from "lucide-react";

type PackContextData = RouterOutput["delivery"]["packContext"];

// คีย์แถวนับต่อไซส์+สี — ต้อง normalize เหมือนฝั่ง server (delivery.ts packKey) ให้ map ตรงกัน
const lineKey = (size?: string | null, color?: string | null) =>
  `${(size ?? "").trim().toLowerCase()}|${(color ?? "").trim().toLowerCase()}`;

// ป้ายไซส์/สีสั้นๆ ไว้โชว์ในสรุปต่อกล่อง เช่น "M ดำ" — ไม่มีทั้งคู่ค่อยถอยไปใช้ description
// (export ให้ไฟล์แม่ใช้ในการ์ดใบส่งด้วย — ทิศทาง import แม่→dialog ทางเดียว ไม่วนกลับ)
export const sizeColorLabel = (l: {
  size?: string | null;
  color?: string | null;
  description: string;
}) => [l.size, l.color].filter(Boolean).join(" ") || l.description;

// dialog สร้างใบส่งของ — แตกจาก order-delivery-section (เดิมถือ form state ~13 ตัว + resetCreateForm มือ)
// conditional mount ตามกติกาใน ui/dialog.tsx: mount ใหม่ทุกครั้งที่เปิด seed จาก props ใน useState
// initializer ได้ค่าสดเสมอ · packContext query อยู่ที่ parent (ใช้ทั้งแถบหัว section) — รับ data เป็น prop
export function CreateDeliveryDialog({
  orderId,
  customerName,
  customerPhone,
  customerHasAddress,
  customerAddress,
  orderShipping,
  packData,
  onClose,
}: {
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  // ลูกค้ามีที่อยู่ในโปรไฟล์แล้วหรือยัง — มีแล้วห้ามทับ (ปิดช่องบันทึกกลับ)
  customerHasAddress?: boolean;
  /** ที่อยู่ผู้ติดต่อของลูกค้า — ทางเลือกที่สองของปุ่มก๊อป (ใช้เมื่อใบงานไม่ได้ระบุที่อยู่ส่ง) */
  customerAddress?: string | null;
  /** ที่อยู่จัดส่งที่กรอกไว้ตอนเปิดงาน — ต้นทางหลักของใบส่ง (เบสสั่ง 2026-08-12)
   *  เดิม dialog นี้เริ่มจากช่องว่างเปล่า คนแพ็คต้องพิมพ์ที่อยู่ใหม่ทุกใบ แล้วได้ที่อยู่
   *  2 ชุดที่ไม่ตรงกันบนออเดอร์ใบเดียว (ใบแนบกล่องพิมพ์จากใบส่ง ไม่ใช่จากออเดอร์) */
  orderShipping?: OrderShippingSource | null;
  /** บริบทแพ็ค: เหลือเท่าไหร่ต่อไซส์ — parent เปิด dialog ได้ต่อเมื่อ data พร้อมแล้วเท่านั้น */
  packData: PackContextData;
  onClose: () => void;
}) {
  // seed จากที่อยู่จัดส่งของใบงานก่อน — ไม่มีค่อยถอยไปใช้ชื่อ/เบอร์ลูกค้าแบบเดิม
  const orderFill = fillFromOrderShipping(orderShipping);
  const hasOrderShipping = hasAddressContent(orderFill);

  const [recipientName, setRecipientName] = useState(
    orderFill.recipientName || customerName || "",
  );
  const [phone, setPhone] = useState(orderFill.phone || customerPhone || "");
  const [address, setAddress] = useState(orderFill.address);
  const [subDistrict, setSubDistrict] = useState(orderFill.subDistrict);
  const [district, setDistrict] = useState(orderFill.district);
  const [province, setProvince] = useState(orderFill.province);
  const [postalCode, setPostalCode] = useState(orderFill.postalCode);
  const [shippingMethod, setShippingMethod] = useState("KERRY");
  const [shippingCost, setShippingCost] = useState("0");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  // ลูกค้ายังไม่มีที่อยู่ในโปรไฟล์ → default เติมกลับให้เลย · มีแล้ว = ปิดตาย ห้ามทับ
  // (เบสสั่ง 2026-08-12) เดิมติ๊กทับได้เสมอ ทุก role ที่แพ็คของทำได้ แล้ว customer.address
  // คือที่อยู่สำรองบนใบกำกับภาษี → ที่อยู่ปลายทางรอบนั้นไหลไปโผล่บนเอกสารภาษีใบต่อไป
  // (เคสจริง: ส่งของให้ลูกค้าของลูกค้า / ส่งไปไซต์งานชั่วคราว) · server กันอีกชั้น
  const [saveAsCustomerAddress, setSaveAsCustomerAddress] = useState(!customerHasAddress);
  const canSaveAsCustomerAddress = !customerHasAddress;

  // แพ็คนับยืนยันต่อไซส์ (ก้อน 3) — จำนวนรอบนี้ต่อแถว key = ไซส์|สี (เก็บ string ให้พิมพ์แก้ได้)
  // นับยืนยันรอบนี้ default = ที่เหลือทั้งหมดต่อแถว (เคสปกติ: ส่งครบในรอบเดียว แก้ลงได้)
  const [packQty, setPackQty] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of packData.lines) {
      init[lineKey(l.size, l.color)] = String(l.remaining);
    }
    return init;
  });

  const utils = trpc.useUtils();
  const createDelivery = trpc.delivery.create.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.delivery.packContext.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      onClose();
    },
  });

  // แถวนับยืนยัน — ผูกค่าที่กรอกเข้ากับแถวจาก packContext
  const packLines = packData.lines;
  const totalRemaining = packData.totalRemaining;
  const packRows = packLines.map((l) => {
    const key = lineKey(l.size, l.color);
    const raw = packQty[key] ?? "";
    const qty = raw.trim() === "" ? 0 : Number(raw);
    // ห้ามเกิน remaining / ติดลบ / ไม่ใช่จำนวนเต็ม — ขอบแดง + กันกดสร้าง (server กันอีกชั้น)
    const invalid = !Number.isInteger(qty) || qty < 0 || qty > l.remaining;
    return { ...l, key, raw, qty, invalid };
  });
  const packInvalid = packRows.some((r) => r.invalid);
  const packTotal = packRows.reduce((s, r) => s + (r.invalid ? 0 : r.qty), 0);

  // ที่อยู่ที่ก๊อปมาใช้ได้ — ที่อยู่ของใบงานมาก่อนเสมอ (ตรงกับที่ฝ่ายขายรับปากลูกค้าไว้)
  const customerFill = fillFromCustomer({
    name: customerName,
    phone: customerPhone,
    address: customerAddress,
  });
  const copySource = hasOrderShipping
    ? { fill: orderFill, label: "ใช้ที่อยู่จัดส่งของงานนี้" }
    : hasAddressContent(customerFill)
      ? { fill: customerFill, label: "ใช้ที่อยู่ผู้ติดต่อ" }
      : null;

  function handleCreate() {
    createDelivery.mutate({
      orderId,
      recipientName,
      phone,
      address,
      subDistrict: subDistrict || undefined,
      district: district || undefined,
      province: province || undefined,
      postalCode: postalCode || undefined,
      shippingMethod,
      shippingCost: parseFloat(shippingCost) || 0,
      notes: deliveryNotes || undefined,
      saveAsCustomerAddress,
      // ส่งเฉพาะแถวที่นับจริง (qty > 0) — ออเดอร์ไม่มีรายการไซส์ = [] ทำงานแบบเดิม
      lines: packRows
        .filter((r) => !r.invalid && r.qty > 0)
        .map((r) => ({
          description: r.description,
          size: r.size ?? undefined,
          color: r.color ?? undefined,
          qty: r.qty,
        })),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>สร้างรายการจัดส่ง</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {/* ปุ่มก๊อป — ใบงานมีที่อยู่จัดส่งก็ดึงชุดนั้น (ครบ 7 ช่อง) ไม่มีค่อยถอยไปที่อยู่ผู้ติดต่อ
              (โปรไฟล์เก็บที่อยู่ก้อนเดียว เติมได้แค่ช่อง "ที่อยู่") */}
          {copySource && (
            <UseAddressButton
              onClick={() => {
                const fill = copySource.fill;
                setRecipientName(fill.recipientName || recipientName);
                setPhone(fill.phone || phone);
                setAddress(fill.address);
                setSubDistrict(fill.subDistrict);
                setDistrict(fill.district);
                setProvince(fill.province);
                setPostalCode(fill.postalCode);
              }}
            >
              {copySource.label}
            </UseAddressButton>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ชื่อผู้รับ" required>
              <Input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </Field>
            <Field label="เบอร์โทร" required>
              <Input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>
          <Field label="ที่อยู่" required>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ตำบล/แขวง">
              <Input
                type="text"
                value={subDistrict}
                onChange={(e) => setSubDistrict(e.target.value)}
              />
            </Field>
            <Field label="อำเภอ/เขต">
              <Input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="จังหวัด">
              <Input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </Field>
            <Field label="รหัสไปรษณีย์">
              <Input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="delivery-shipping-method">วิธีจัดส่ง</Label>
              <Select value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)} id="delivery-shipping-method">
                  {SHIPPING_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Select>
            </div>
            <Field label="ค่าจัดส่ง (บาท)">
              <Input
                type="number"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                min="0"
              />
            </Field>
          </div>
          {/* รายการรอบนี้ (นับยืนยัน) — ออเดอร์ไม่มีรายการไซส์ → ซ่อน ทำงานแบบเดิม */}
          {packRows.length > 0 && (
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                รายการรอบนี้ (นับยืนยัน)
              </legend>
              {totalRemaining === 0 ? (
                <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
                  ของครบทุกใบส่งแล้ว
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  {packRows.map((r) => (
                    <div
                      key={r.key}
                      className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-900 dark:text-white">
                          {r.description}
                          {(r.size || r.color) && (
                            <span className="text-slate-500 dark:text-slate-400">
                              {" — "}
                              {[r.size, r.color].filter(Boolean).join(" / ")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          สั่ง {r.ordered} · ส่งแล้ว {r.packed}
                        </p>
                      </div>
                      <Input size="sm"
                        type="number"
                        aria-label={`จำนวน ${sizeColorLabel(r)} ในรอบนี้`}
                        aria-invalid={r.invalid || undefined}
                        aria-describedby={packInvalid ? "delivery-pack-error" : undefined}
                        inputMode="numeric"
                        min={0}
                        max={r.remaining}
                        value={r.raw}
                        disabled={r.remaining === 0}
                        onChange={(e) =>
                          setPackQty((prev) => ({ ...prev, [r.key]: e.target.value }))
                        }
                        className={cn(
                          "w-16 shrink-0 text-right",
                          r.invalid &&
                            cn("border-red-500 dark:border-red-600", FOCUS_FIELD_INVALID)
                        )}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      รวมรอบนี้ {packTotal} ตัว
                    </span>
                    <span className="text-xs text-slate-400">
                      เหลือทั้งหมด {totalRemaining} ตัว
                    </span>
                  </div>
                </div>
              )}
              {packInvalid && (
                <p id="delivery-pack-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  จำนวนเกินที่เหลือ — แก้ช่องขอบแดงก่อนสร้างใบส่ง
                </p>
              )}
            </fieldset>
          )}
          <Field label="หมายเหตุ">
            <Textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              rows={2}
              placeholder="หมายเหตุ..."
            />
          </Field>
          {/* เติมที่อยู่กลับโปรไฟล์ได้เฉพาะตอนโปรไฟล์ยังว่าง — กติกาเดียวกับเบอร์โทรที่ทำถูกอยู่แล้ว
              ที่อยู่ผู้ติดต่อ = ที่อยู่สำรองบนใบกำกับภาษี ห้ามให้ที่อยู่ปลายทางรอบเดียวมาทับ */}
          <label
            className={cn(
              "flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300",
              canSaveAsCustomerAddress ? "cursor-pointer" : "cursor-not-allowed opacity-60",
            )}
          >
            <Checkbox
              checked={canSaveAsCustomerAddress && saveAsCustomerAddress}
              disabled={!canSaveAsCustomerAddress}
              onChange={(e) => setSaveAsCustomerAddress(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              เติมเป็นที่อยู่ผู้ติดต่อของลูกค้า (เติมเบอร์นี้ให้โปรไฟล์ด้วยถ้ายังว่าง)
              {canSaveAsCustomerAddress ? (
                <span className="block text-xs text-amber-600 dark:text-amber-400">
                  ลูกค้ารายนี้ยังไม่มีที่อยู่ในระบบ — เติมไว้แล้วใช้บนเอกสารได้เลย
                </span>
              ) : (
                <span className="block text-xs text-slate-400">
                  ลูกค้ามีที่อยู่ผู้ติดต่ออยู่แล้ว — ที่อยู่นี้เป็นของใบส่งรอบนี้เท่านั้น
                  ถ้าต้องการเปลี่ยนที่อยู่ประจำ ให้แก้ที่หน้าลูกค้า
                </span>
              )}
            </span>
          </label>
        </div>
        <DialogSubmitFooter
          pending={createDelivery.isPending}
          disabled={!recipientName || !phone || !address || packInvalid}
          submitLabel="สร้างรายการจัดส่ง"
          submitIcon={<Truck />}
          onCancel={onClose}
          onSubmit={handleCreate}
        />
      </DialogContent>
    </Dialog>
  );
}
