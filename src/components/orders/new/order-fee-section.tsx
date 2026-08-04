"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Section } from "@/components/ui/section";
import { Plus, Trash2, Receipt } from "lucide-react";
import { resolveFeeCatalogSelection } from "@/lib/order-item-composer";
import type { OrderFeeForm } from "@/types/order-form";
import { DASHED, FOCUS_BUTTON, TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

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

  const handleCatalogSelect = (fIdx: number, catalogId: string) => {
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
      action={embedded || fees.length > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={onAddFee}>
          <Plus />
          {embedded ? "เพิ่มค่าใช้จ่าย" : "เพิ่ม"}
        </Button>
      ) : undefined}
    >
      {fees.length === 0 ? (
        embedded ? null : (
          <button
            type="button"
            onClick={onAddFee}
            className={cn(DASHED, "flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40", FOCUS_BUTTON, "dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20")}
          >
            <Receipt className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">เพิ่มค่าใช้จ่ายระดับออเดอร์</span>
          </button>
        )
      ) : (
        <>
          {/* ตาราง 1 ค่าใช้จ่าย = 1 แถว (เบสสั่ง 2026-08-04) — หน้าตาชุดเดียวกับ
              ตารางลาย/สินค้า/ส่วนเสริมในชุดงาน: หัวคอลัมน์ครั้งเดียว ไม่ซ้ำทุกแถว
              · เกณฑ์ใช้ sm: (ขนาดจอ) เท่านั้น — container query ไม่ทำงานบนหน้านี้ */}
          <div className="hidden sm:block">
            <table className="w-full table-fixed">
              <colgroup>
                {hasCatalog && <col style={{ width: 168 }} />}
                <col style={{ width: 140 }} />
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 44 }} />
              </colgroup>
              <thead className={TABLE_HEAD_SURFACE}>
                <tr className="text-xs font-medium">
                  {hasCatalog && <th className="px-2 py-2.5 text-left">แค็ตตาล็อก</th>}
                  <th className="px-2 py-2.5 text-left">ประเภท</th>
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
                    {hasCatalog && (
                      <td className="px-2 py-2 align-middle">
                        <Select
                          size="sm"
                          aria-label={`เลือกค่าใช้จ่ายแถว ${fIdx + 1} จากแค็ตตาล็อก`}
                          value=""
                          onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                        >
                          <option value="">เลือก...</option>
                          {feeCatalog!.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — ฿{c.defaultPrice.toLocaleString()}
                            </option>
                          ))}
                        </Select>
                      </td>
                    )}
                    <td className="px-2 py-2 align-middle">
                      <Input
                        size="sm"
                        aria-label={`ประเภทค่าใช้จ่าย ${fIdx + 1}`}
                        value={f.feeType}
                        onChange={(e) => onUpdateFee(fIdx, "feeType", e.target.value)}
                        placeholder="SHIPPING..."
                      />
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
                {hasCatalog && (
                  <Field label={`เลือกค่าใช้จ่ายแถว ${fIdx + 1} จากแค็ตตาล็อก`} visuallyHiddenLabel>
                    <Select
                      value=""
                      onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                    >
                      <option value="">เลือกจากแค็ตตาล็อก</option>
                      {feeCatalog!.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — ฿{c.defaultPrice.toLocaleString()}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="ประเภท" className="space-y-1">
                  <Input
                    value={f.feeType}
                    onChange={(e) => onUpdateFee(fIdx, "feeType", e.target.value)}
                    placeholder="SHIPPING, SETUP..."
                  />
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
