"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Section } from "@/components/ui/section";
import { Plus, Trash2, Receipt } from "lucide-react";
import { resolveFeeCatalogSelection } from "@/lib/order-item-composer";
import type { OrderFeeForm } from "@/types/order-form";

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
}

export function OrderFeeSection({
  fees,
  onAddFee,
  onRemoveFee,
  onUpdateFee,
  feeCatalog,
}: OrderFeeSectionProps) {
  const handleCatalogSelect = (fIdx: number, catalogId: string) => {
    const selection = resolveFeeCatalogSelection(feeCatalog, catalogId);
    if (!selection) return;
    onUpdateFee(fIdx, "feeType", selection.feeType);
    onUpdateFee(fIdx, "name", selection.name);
    onUpdateFee(fIdx, "amount", selection.amount);
  };

  return (
    <Section
      title="ค่าใช้จ่ายเพิ่มเติม"
      action={
        <Button type="button" variant="outline" size="sm" onClick={onAddFee}>
          <Plus className="h-4 w-4" />
          เพิ่ม
        </Button>
      }
    >
      {fees.length === 0 ? (
        <button
          type="button"
          onClick={onAddFee}
          className="flex min-h-11 w-full touch-manipulation flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
        >
          <Receipt className="h-6 w-6 text-slate-300 dark:text-slate-600" />
          <span className="text-xs text-slate-500 dark:text-slate-400">ยังไม่มีค่าใช้จ่ายเพิ่มเติม — กดเพื่อเพิ่ม</span>
        </button>
      ) : (
        <div className="space-y-3">
          {fees.map((f, fIdx) => (
            <div key={fIdx} className="space-y-1.5">
              {feeCatalog && feeCatalog.length > 0 && (
                <Field label={`เลือกค่าใช้จ่ายแถว ${fIdx + 1} จากแค็ตตาล็อก`} visuallyHiddenLabel>
                  <NativeSelect
                    value=""
                    onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                  >
                    <option value="">-- เลือกจากแค็ตตาล็อก --</option>
                    {feeCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — ฿{c.defaultPrice.toLocaleString()}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_44px]">
                <Field label="ประเภท" visuallyHiddenLabel={fIdx > 0} className="space-y-1">
                  <Input
                    value={f.feeType}
                    onChange={(e) =>
                      onUpdateFee(fIdx, "feeType", e.target.value)
                    }
                    placeholder="SHIPPING, SETUP..."
                  />
                </Field>
                <Field label="ชื่อ" visuallyHiddenLabel={fIdx > 0} className="space-y-1">
                  <Input
                    value={f.name}
                    onChange={(e) => onUpdateFee(fIdx, "name", e.target.value)}
                    placeholder="ค่าจัดส่ง, ค่าเซ็ตอัพ..."
                  />
                </Field>
                <Field label="จำนวนเงิน" required visuallyHiddenLabel={fIdx > 0} className="space-y-1">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={f.amount || ""}
                    onChange={(e) =>
                      onUpdateFee(fIdx, "amount", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                  />
                </Field>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`ลบค่าใช้จ่าย ${fIdx + 1}`}
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => onRemoveFee(fIdx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
