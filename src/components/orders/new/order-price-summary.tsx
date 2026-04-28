"use client";

import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
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

function Row({
  label,
  value,
  muted = true,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span
        className={
          muted
            ? "text-slate-500 dark:text-slate-400"
            : "text-slate-700 dark:text-slate-200"
        }
      >
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
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
    <Section title="สรุปราคา" compact>
      <div className="space-y-2">
        <Row
          label="รวมสินค้า"
          value={formatCurrency(pricingSummary.subtotalItems)}
        />

        {showFeeSections && (
          <Row
            label="รวมค่าใช้จ่ายเพิ่มเติม"
            value={formatCurrency(pricingSummary.subtotalFees)}
          />
        )}

        {isMarketplace && (
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm text-slate-500 dark:text-slate-400">
              ค่าธรรมเนียม {channelLabel}
            </label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={platformFee || ""}
              onChange={(e) =>
                onPlatformFeeChange(parseFloat(e.target.value) || 0)
              }
              placeholder="0.00"
              className="h-8 w-28 text-right"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <label className="text-sm text-slate-500 dark:text-slate-400">
            ส่วนลด
          </label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={discount || ""}
            onChange={(e) =>
              onDiscountChange(parseFloat(e.target.value) || 0)
            }
            placeholder="0.00"
            className="h-8 w-28 text-right"
          />
        </div>

        {taxRate > 0 && (
          <Row
            label={`VAT (${taxRate}%)`}
            value={formatCurrency(pricingSummary.taxAmount)}
          />
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          ยอดรวมทั้งหมด
          {taxRate > 0 && (
            <span className="ml-1 text-xs font-normal text-slate-400">
              (รวม VAT)
            </span>
          )}
        </span>
        <span className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatCurrency(pricingSummary.grandTotal)}
        </span>
      </div>
    </Section>
  );
}
