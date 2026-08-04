"use client";

import { AddCard } from "@/components/ui/add-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Section } from "@/components/ui/section";
import { Plus, Trash2, Receipt } from "lucide-react";
import { resolveFeeCatalogSelection } from "@/lib/order-item-composer";
import type { OrderFeeForm } from "@/types/order-form";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";

/** ค่าที่ตรงกับคอมเมนต์ใน schema (DESIGN_FEE, SCREEN_SETUP, ..., CUSTOM) */
const CUSTOM_FEE_TYPE = "CUSTOM";
/** ค่าใน <option> เท่านั้น ไม่ได้เก็บลงฐานข้อมูล */
const OTHER_FEE_OPTION = "__other";

interface FeeCatalogItem {
  id: string;
  name: string;
  type: string;
  defaultPrice: number;
  pricingType: string;
}

interface OrderFeeSectionProps {
  fees: OrderFeeForm[];
  onAddFee: () => void;
  onRemoveFee: (idx: number) => void;
  onUpdateFee: (idx: number, field: string, value: unknown) => void;
  feeCatalog?: FeeCatalogItem[];
  /** วางใน Section หลักของหน้าโดยไม่สร้าง card-surface ซ้อนอีกชั้น */
  embedded?: boolean;
}

export function OrderFeeSection({
  fees,
  onAddFee,
  onRemoveFee,
  onUpdateFee,
  feeCatalog,
  embedded = false,
}: OrderFeeSectionProps) {
  const hasCatalog = !!feeCatalog && feeCatalog.length > 0;

  /* ช่อง "ประเภท" ที่เคยให้พิมพ์เองถูกถอดออก (เบส 2026-08-04 "ประเภทจะมีไว้ทำไม") —
     มันคือรหัสภายในอย่าง SHIPPING/SETUP ที่คนขายไม่ควรต้องจำหรือพิมพ์
     ตอนนี้ระบบตั้งให้เองจากรายการที่เลือก · เลือก "อื่นๆ" = CUSTOM แล้วพิมพ์ชื่อเอง */
  const currentValue = (f: OrderFeeForm) => {
    const hit = feeCatalog?.find((c) => c.name === f.name && c.type === f.feeType);
    if (hit) return hit.id;
    return f.feeType ? OTHER_FEE_OPTION : "";
  };

  const handleCatalogSelect = (fIdx: number, catalogId: string) => {
    if (catalogId === OTHER_FEE_OPTION) {
      // เลือก "อื่นๆ" = ตั้งประเภทเป็น CUSTOM แล้วปล่อยให้พิมพ์ชื่อ/ยอดเอง
      onUpdateFee(fIdx, "feeType", CUSTOM_FEE_TYPE);
      return;
    }
    const selection = resolveFeeCatalogSelection(feeCatalog, catalogId);
    if (!selection) return;
    onUpdateFee(fIdx, "feeType", selection.feeType);
    onUpdateFee(fIdx, "name", selection.name);
    onUpdateFee(fIdx, "amount", selection.amount);
  };

  return (
    <Section
      title={embedded ? "ค่าใช้จ่ายเพิ่มเติม" : "ค่าใช้จ่ายระดับออเดอร์"}
      bordered={!embedded}
      headingLevel={embedded ? 3 : 2}
      action={fees.length > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={onAddFee}>
          <Plus />
          {embedded ? "เพิ่มค่าใช้จ่าย" : "เพิ่ม"}
        </Button>
      ) : undefined}
    >
      {fees.length === 0 ? (
        /* ว่าง = กล่อง CTA ขอบประเต็มแถว ชุดเดียวกับสินค้า/ลาย/ส่วนเสริมในชุดงาน
           (เบสสั่ง 2026-08-05) — เดิมโหมด embedded ไม่โชว์อะไรเลย เหลือแต่ปุ่มเล็กมุมขวา */
        <AddCard
          icon={Receipt}
          label="เพิ่มค่าใช้จ่าย"
          desc="ค่าส่ง · ค่าเซ็ตอัพ · ค่าเร่ง ที่คิดกับทั้งออเดอร์"
          onClick={onAddFee}
        />
      ) : (
        <>
          {/* ตาราง 1 ค่าใช้จ่าย = 1 แถว (เบสสั่ง 2026-08-04) — หน้าตาชุดเดียวกับ
              ตารางลาย/สินค้า/ส่วนเสริมในชุดงาน: หัวคอลัมน์ครั้งเดียว ไม่ซ้ำทุกแถว
              · เกณฑ์ใช้ sm: (ขนาดจอ) เท่านั้น — container query ไม่ทำงานบนหน้านี้ */}
          <div className="hidden sm:block">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: 200 }} />
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 44 }} />
              </colgroup>
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-xs font-medium">
                  <th className="px-2 py-2.5 text-left">รายการ</th>
                  <th className="px-2 py-2.5 text-left">ชื่อ</th>
                  <th className="px-2 py-2.5 text-center">จำนวนเงิน</th>
                  <th className="py-2.5">
                    <span className="sr-only">ลบค่าใช้จ่าย</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f, fIdx) => (
                  <tr key={fIdx}>
                    <td className="px-2 py-2 align-middle">
                      <Select
                        size="sm"
                        aria-label={`รายการค่าใช้จ่ายแถว ${fIdx + 1}`}
                        value={currentValue(f)}
                        onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                      >
                        <option value="">เลือก...</option>
                        {hasCatalog &&
                          feeCatalog!.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — ฿{c.defaultPrice.toLocaleString()}
                            </option>
                          ))}
                        <option value={OTHER_FEE_OPTION}>อื่นๆ (พิมพ์ชื่อเอง)</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        size="sm"
                        aria-label={`ชื่อค่าใช้จ่าย ${fIdx + 1}`}
                        value={f.name}
                        onChange={(e) => onUpdateFee(fIdx, "name", e.target.value)}
                        placeholder="ค่าจัดส่ง, ค่าเซ็ตอัพ..."
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <MoneyInput
                        size="sm"
                        required
                        aria-label={`จำนวนเงินค่าใช้จ่าย ${fIdx + 1}`}
                        value={f.amount}
                        onValueChange={(v) => onUpdateFee(fIdx, "amount", v)}
                      />
                    </td>
                    <td className="py-2 align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`ลบค่าใช้จ่าย ${fIdx + 1}`}
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => onRemoveFee(fIdx)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* จอแคบ: ตาราง 4-5 คอลัมน์ลงไม่ไหว — ใช้การ์ดต่อรายการเหมือนที่อื่นในหน้านี้ */}
          <div className="space-y-3 sm:hidden">
            {fees.map((f, fIdx) => (
              <div key={fIdx} className="space-y-2">
                <Field label="รายการ" className="space-y-1">
                  <Select
                    value={currentValue(f)}
                    onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                  >
                    <option value="">เลือก...</option>
                    {hasCatalog &&
                      feeCatalog!.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — ฿{c.defaultPrice.toLocaleString()}
                        </option>
                      ))}
                    <option value={OTHER_FEE_OPTION}>อื่นๆ (พิมพ์ชื่อเอง)</option>
                  </Select>
                </Field>
                <Field label="ชื่อ" className="space-y-1">
                  <Input
                    value={f.name}
                    onChange={(e) => onUpdateFee(fIdx, "name", e.target.value)}
                    placeholder="ค่าจัดส่ง, ค่าเซ็ตอัพ..."
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <Field label="จำนวนเงิน" required className="flex-1 space-y-1">
                    <MoneyInput
                      value={f.amount}
                      onValueChange={(v) => onUpdateFee(fIdx, "amount", v)}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`ลบค่าใช้จ่าย ${fIdx + 1}`}
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => onRemoveFee(fIdx)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
