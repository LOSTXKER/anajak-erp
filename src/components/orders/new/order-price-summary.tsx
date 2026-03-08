"use client";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface PricingSummary {
  subtotalItems: number;
  subtotalFees: number;
  platformFee: number;
  discount: number;
  taxAmount: number;
  grandTotal: number;
}

interface OrderPriceSummaryProps {
  pricingSummary: PricingSummary;
  showFeeSections: boolean;
  isMarketplace: boolean;
  channelLabel: string;
  taxRate: number;
  platformFee: number;
  discount: number;
  onPlatformFeeChange: (value: number) => void;
  onDiscountChange: (value: number) => void;
}

export function OrderPriceSummary({
  pricingSummary,
  showFeeSections,
  isMarketplace,
  channelLabel,
  taxRate,
  platformFee,
  discount,
  onPlatformFeeChange,
  onDiscountChange,
}: OrderPriceSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">สรุปราคา</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>รวมสินค้า</span>
            <span className="tabular-nums">
              {formatCurrency(pricingSummary.subtotalItems)}
            </span>
          </div>

          {showFeeSections && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>รวมค่าใช้จ่ายเพิ่มเติม</span>
              <span className="tabular-nums">
                {formatCurrency(pricingSummary.subtotalFees)}
              </span>
            </div>
          )}

          {isMarketplace && (
            <div className="flex items-center justify-between">
              <label className="text-slate-600 dark:text-slate-400">
                ค่าธรรมเนียม {channelLabel}
              </label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={platformFee || ""}
                onChange={(e) => onPlatformFeeChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-32 text-right"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-slate-600 dark:text-slate-400">
              ส่วนลด
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={discount || ""}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-32 text-right"
            />
          </div>

          {taxRate > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>VAT ({taxRate}%)</span>
              <span className="tabular-nums">
                {formatCurrency(pricingSummary.taxAmount)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            ยอดรวมทั้งหมด {taxRate > 0 ? "(รวม VAT)" : ""}
          </span>
          <span className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(pricingSummary.grandTotal)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
