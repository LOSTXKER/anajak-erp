"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { MoneyInput } from "@/components/ui/number-input";
import { Section } from "@/components/ui/section";
import { formatCurrency } from "@/lib/utils";
import { itemHasContent, type OrderItemForm } from "@/types/order-form";
import type { MarginEstimate } from "@/server/services/margin-estimate";
import { DISPLAY_AMOUNT } from "@/components/ui/tokens";

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
  /** ไม่ส่ง = โหมดอ่านอย่างเดียว (ช่องกรอกอยู่ที่อื่นแล้ว) */
  onPlatformFeeChange?: (value: number) => void;
  onDiscountChange?: (value: number) => void;
  /** กำไรขั้นต้นโดยประมาณ (ก้อน 2 ชิ้น 5b) — null/ไม่ส่ง = ไม่โชว์บล็อก (role นอกการเงิน) */
  marginEstimate?: MarginEstimate | null;
  /** วางใน Section หลักของหน้าโดยไม่สร้าง card-surface ซ้อนอีกชั้น */
  embedded?: boolean;
}

// ============ กำไรขั้นต้นโดยประมาณ (FLOW-REDESIGN ก้อน 2 ชิ้น 5b) ============
// "เข็มทิศตอนตั้งราคา" — ไม่ใช่ตัวเลขบัญชี ไม่บันทึกลงออเดอร์
// ใช้ร่วม 2 ที่: หน้าเปิดงาน (ผ่าน prop marginEstimate) + ฟอร์มแก้รายการ (order-items-editor)

/**
 * แปลงฟอร์มรายการ → input ของ settings.estimateMargin + debounce 500ms + query
 * คืน null เมื่อ: ฟอร์มยังไม่มีเนื้อ/ยอดเป็น 0 · role นอกการเงินโดน FORBIDDEN (ตัวเลขทุน
 * ห้ามรั่วถึงขาย/ช่าง) — ผู้เรียกเช็ค null แล้วไม่ render บล็อก ห้ามมี error UI
 */
export function useMarginEstimate(
  items: OrderItemForm[],
  revenue: number
): MarginEstimate | null {
  const input = useMemo(
    () => ({
      revenue,
      items: items.filter(itemHasContent).map((item) => ({
        products: item.products.map((p) => ({
          productId: p.productId || null,
          itemSource: p.itemSource || null,
          variants: p.variants.map((v) => ({
            size: v.size,
            color: v.color,
            quantity: v.quantity,
          })),
        })),
        // เฉพาะแถวลายที่มีเนื้อ — แถวเปล่าไม่ส่งไปนับเป็น "ลายไม่ระบุขนาด"
        prints: item.prints
          .filter((pr) => pr.printType || pr.width > 0 || pr.height > 0)
          .map((pr) => ({ widthCm: pr.width || null, heightCm: pr.height || null })),
      })),
    }),
    [items, revenue]
  );

  // debounce 500ms — pattern เดียวกับช่องค้นหาหน้าคลังฟิล์ม (ไม่ยิง server ทุก keystroke)
  const [debouncedInput, setDebouncedInput] = useState(input);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(input), 500);
    return () => clearTimeout(timer);
  }, [input]);

  const { data } = trpc.settings.estimateMargin.useQuery(debouncedInput, {
    enabled:
      !!debouncedInput && debouncedInput.revenue > 0 && debouncedInput.items.length > 0,
    retry: false, // FORBIDDEN (role นอกการเงิน) → เงียบ ไม่ retry
    placeholderData: (prev) => prev, // คงเลขเดิมระหว่างพิมพ์ ไม่กะพริบ
  });

  // gate ด้วย input สด (ไม่ใช่ debounced) — ล้างฟอร์มแล้วเลขต้องหายทันที ไม่โชว์ค่าค้าง
  if (!(input.revenue > 0 && input.items.length > 0)) return null;
  return data ?? null;
}

/** บล็อกแสดงกำไรขั้นต้นโดยประมาณ — caller เช็ค null เองก่อน render (null = ไม่โชว์เลย) */
export function MarginEstimateBlock({ estimate }: { estimate: MarginEstimate }) {
  if (!estimate.configured) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        <Link
          href="/settings/cost-rates"
          className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
        >
          ตั้งเรตต้นทุนกลาง
        </Link>
        ก่อน จึงเห็นกำไรขั้นต้นโดยประมาณ
      </p>
    );
  }

  const warnings: string[] = [];
  if (estimate.unknownCostPieces > 0)
    warnings.push(`เสื้อไม่รู้ทุน ${estimate.unknownCostPieces} ตัว`);
  if (estimate.customMadePieces > 0)
    warnings.push(
      `เสื้อโรงเย็บ ${estimate.customMadePieces} ตัว — ทุนตามบิลร้าน ไม่รวมในนี้`
    );
  if (estimate.printsWithoutSize > 0)
    warnings.push(
      `ลายไม่ได้ระบุขนาด ${estimate.printsWithoutSize} จุด — ค่าฟิล์มส่วนนี้ไม่รวม`
    );

  const negative = estimate.marginAmount < 0;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        กำไรขั้นต้นโดยประมาณ
      </p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          negative
            ? "text-red-600 dark:text-red-400"
            : "text-green-600 dark:text-green-400"
        }`}
      >
        ~{formatCurrency(estimate.marginAmount)}
        {estimate.marginPct !== null && (
          <span className="ml-1 text-sm font-medium">
            ({estimate.marginPct.toFixed(1)}%)
          </span>
        )}
      </p>
      <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center justify-between">
          <span>เสื้อ</span>
          <span className="tabular-nums">{formatCurrency(estimate.garmentCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>ฟิล์ม+หมึก</span>
          <span className="tabular-nums">{formatCurrency(estimate.filmCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>ค่าแรง+โสหุ้ย</span>
          <span className="tabular-nums">
            {formatCurrency(estimate.laborOverheadCost)}
          </span>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="space-y-0.5">
          {warnings.map((w) => (
            <p key={w} className="text-xs text-amber-600 dark:text-amber-400">
              {w}
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        เข็มทิศตอนตั้งราคา — ไม่ใช่ตัวเลขบัญชี
      </p>
    </div>
  );
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
  marginEstimate,
  embedded = false,
}: OrderPriceSummaryProps) {
  return (
    <Section title="สรุปยอด" compact={!embedded} bordered={!embedded} headingLevel={embedded ? 3 : 2}>
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

        {isMarketplace &&
          (onPlatformFeeChange ? (
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="order-platform-fee" className="text-sm text-slate-500 dark:text-slate-400">
                ค่าธรรมเนียม {channelLabel}
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  หักจากยอดโอนเข้าร้าน — ไม่รวมในยอดบิล
                </span>
              </label>
              <MoneyInput size="sm"
                id="order-platform-fee"
                value={platformFee}
                onValueChange={onPlatformFeeChange}
                className="w-28"
              />
            </div>
          ) : (
            <Row label={`ค่าธรรมเนียม ${channelLabel}`} value={formatCurrency(platformFee)} />
          ))}

        {onDiscountChange ? (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="order-discount" className="text-sm text-slate-500 dark:text-slate-400">
              ส่วนลดท้ายบิล
            </label>
            <MoneyInput size="sm"
              id="order-discount"
              value={discount}
              onValueChange={onDiscountChange}
              className="w-28"
            />
          </div>
        ) : (
          discount > 0 && <Row label="ส่วนลดท้ายบิล" value={`-${formatCurrency(discount)}`} />
        )}

        {taxRate > 0 && (
          <Row
            label={`VAT (${taxRate}%)`}
            value={formatCurrency(pricingSummary.taxAmount)}
          />
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3 dark:border-white/10">
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          ยอดรวมทั้งหมด
          {taxRate > 0 && (
            <span className="ml-1 text-xs font-normal text-muted">
              (รวม VAT)
            </span>
          )}
        </span>
        <span className={DISPLAY_AMOUNT}>
          {formatCurrency(pricingSummary.grandTotal)}
        </span>
      </div>

      {/* กำไรขั้นต้นโดยประมาณ — โชว์เฉพาะ role การเงิน (caller ส่ง null = ไม่ render เลย) */}
      {marginEstimate && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/10">
          <MarginEstimateBlock estimate={marginEstimate} />
        </div>
      )}
    </Section>
  );
}
