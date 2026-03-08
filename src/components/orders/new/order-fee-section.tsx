"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import type { OrderFeeForm } from "@/types/order-form";

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

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
    if (!catalogId || !feeCatalog) return;
    const item = feeCatalog.find((c) => c.id === catalogId);
    if (!item) return;
    onUpdateFee(fIdx, "feeType", item.type);
    onUpdateFee(fIdx, "name", item.name);
    onUpdateFee(fIdx, "amount", item.defaultPrice);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">ค่าใช้จ่ายเพิ่มเติม</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onAddFee}>
          <Plus className="mr-1 h-4 w-4" />
          เพิ่มค่าใช้จ่าย
        </Button>
      </CardHeader>
      <CardContent>
        {fees.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            ไม่มีค่าใช้จ่ายเพิ่มเติม
          </p>
        )}
        <div className="space-y-2">
          {fees.map((f, fIdx) => (
            <div key={fIdx} className="space-y-1.5">
              {feeCatalog && feeCatalog.length > 0 && (
                <div>
                  {fIdx === 0 && <label className={labelClass}>เลือกจากแค็ตตาล็อก</label>}
                  <select
                    className={selectClass}
                    value=""
                    onChange={(e) => handleCatalogSelect(fIdx, e.target.value)}
                  >
                    <option value="">-- เลือกจากแค็ตตาล็อก --</option>
                    {feeCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — ฿{c.defaultPrice.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-[1fr_1fr_120px_32px] items-end gap-2">
                <div>
                  {fIdx === 0 && <label className={labelClass}>ประเภท</label>}
                  <Input
                    value={f.feeType}
                    onChange={(e) => onUpdateFee(fIdx, "feeType", e.target.value)}
                    placeholder="SHIPPING, SETUP..."
                  />
                </div>
                <div>
                  {fIdx === 0 && <label className={labelClass}>ชื่อ</label>}
                  <Input
                    value={f.name}
                    onChange={(e) => onUpdateFee(fIdx, "name", e.target.value)}
                    placeholder="ค่าจัดส่ง, ค่าเซ็ตอัพ..."
                  />
                </div>
                <div>
                  {fIdx === 0 && <label className={labelClass}>จำนวนเงิน *</label>}
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={f.amount || ""}
                    onChange={(e) => onUpdateFee(fIdx, "amount", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  {fIdx === 0 && <span className="mb-1 block text-xs">&nbsp;</span>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-red-400 hover:text-red-600"
                    onClick={() => onRemoveFee(fIdx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
