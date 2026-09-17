"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Receipt } from "lucide-react";
import { HelpTip } from "@/components/ui/help-tip";
import { c, CardHead } from "@/components/kit/kit";
import { formatBaht } from "@/lib/utils";
import { calculateFormItemSubtotal, getFormItemTotalQty } from "@/lib/pricing";
import { getPaymentTerms, requiredUpfrontAmount } from "@/lib/payment-terms";
import { itemHasContent, type OrderItemForm } from "@/types/order-form";
import type { MarginEstimate } from "@/server/services/margin-estimate";

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
  /** กำไรขั้นต้นโดยประมาณ (ก้อน 2 ชิ้น 5b) — null/ไม่ส่ง = ไม่โชว์บล็อก (role นอกการเงิน) */
  marginEstimate?: MarginEstimate | null;
  /** จำนวนตัวทั้งใบ — บอกใต้ยอดรวมให้รู้ว่ายอดนี้มาจากกี่ตัว */
  totalQuantity?: number;
  /** ชุดงานในฟอร์ม — แยกยอดทีละชุด · ไม่ส่ง = บรรทัด "รวมสินค้า" บรรทัดเดียว */
  items?: OrderItemForm[];
  /** เงื่อนไขชำระ — คิดแถบยอดที่ต้องเก็บก่อนเริ่มงานท้ายการ์ด */
  paymentTerms?: string;
}

// ============ กำไรขั้นต้นโดยประมาณ (FLOW-REDESIGN ก้อน 2 ชิ้น 5b) ============
// "เข็มทิศตอนตั้งราคา" — ไม่ใช่ตัวเลขบัญชี ไม่บันทึกลงออเดอร์
// ใช้ใน form runtime กลางทั้งหน้าเปิดงานและหน้าแก้ออเดอร์

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

/** ก้อนกำไรขั้นต้นในการ์ดสรุปยอด — caller เช็ค null เองก่อน render (null = ไม่โชว์เลย) */
function MarginEstimateBlock({ estimate }: { estimate: MarginEstimate }) {
  if (!estimate.configured) {
    return (
      <div className={c("mgn")}>
        <p className={c("mh")}>
          <span>
            <Link href="/settings/cost-rates" className="underline underline-offset-2">
              ตั้งเรตต้นทุนกลาง
            </Link>
            ก่อน จึงเห็นกำไรขั้นต้นโดยประมาณ
          </span>
        </p>
      </div>
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
    <div className={c("mgn")}>
      <p className={c("mh")}>
        กำไรขั้นต้นโดยประมาณ
        <HelpTip label="กำไรขั้นต้นโดยประมาณ">
          ประเมินจากเรตต้นทุนกลางเพื่อใช้ตั้งราคา ไม่ใช่ตัวเลขบัญชี (ทุนเสื้อจากแอป Stock ฟิล์มกับหมึกคิดจากขนาดลาย ค่าแรงตามเรต)
        </HelpTip>
      </p>
      <p className={c("mv")}>
        <b className={c("mono", negative && "neg")}>{formatBaht(estimate.marginAmount)}</b>
        {estimate.marginPct !== null && (
          <span className={c("chip", negative ? "bad" : "good")}>
            {estimate.marginPct.toFixed(1)}%
          </span>
        )}
      </p>
      <div className={c("lines quiet")}>
        <div className={c("srow")}>
          <span>ทุนเสื้อ</span>
          <b>{formatBaht(estimate.garmentCost)}</b>
        </div>
        <div className={c("srow")}>
          <span>ฟิล์ม + หมึก</span>
          <b>{formatBaht(estimate.filmCost)}</b>
        </div>
        <div className={c("srow")}>
          <span>ค่าแรง + โสหุ้ย</span>
          <b>{formatBaht(estimate.laborOverheadCost)}</b>
        </div>
      </div>
      {/* ตัวเลขขาดอะไรต้องบอกตรงๆ — ไม่โชว์เลขทุนที่ไม่ครบแบบเงียบ */}
      {warnings.length > 0 && (
        <div className="mt-2.5 space-y-0.5">
          {warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700 dark:text-amber-400">
              {w}
            </p>
          ))}
        </div>
      )}
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
  marginEstimate,
  totalQuantity,
  items,
  paymentTerms,
}: OrderPriceSummaryProps) {
  /* 3 ก้อนคนละเรื่องกัน (ต้นแบบ tabPricing): ยอดที่ลูกค้าจ่าย · กำไรขั้นต้น (เห็นเฉพาะ role การเงิน) · ยอดที่ต้องเก็บก่อน
     เบสทัก 2026-09-18 "ดูยาก" เพราะเดิมเป็นรายการน้ำหนักเท่ากันหมด
     และบรรทัด "ยอดรวมทั้งหมด" ซ้ำกับเลขใหญ่ที่อยู่ห่างกันไม่กี่บรรทัด */

  // ยอดรายชุดงานใช้สูตรตัวเดียวกับ pricingSummary — ฟอร์มยังไม่มีเนื้อรายการ ยอดรวมเป็น 0 ทั้งก้อน
  // บรรทัดรายชุดจึงเป็น 0 ด้วย ผลรวมบรรทัดต้องเท่ายอดใหญ่เสมอ
  const counted = items?.some(itemHasContent) ?? false;
  const upfront = requiredUpfrontAmount(paymentTerms, pricingSummary.grandTotal);
  const upfrontLabel =
    getPaymentTerms(paymentTerms)?.kind === "deposit" ? "มัดจำที่ต้องเก็บ" : "ต้องชำระก่อนเริ่มงาน";

  return (
    <section className={c("card price sticky")}>
      <CardHead
        icon={Receipt}
        tone="good"
        title="สรุปยอด"
        right={taxRate > 0 ? <span className={c("chip gray")}>รวม VAT {taxRate}%</span> : undefined}
      />
      <div className={c("cb sumbody")}>
        <div className={c("tot")}>
          <b className={c("mono")}>{formatBaht(pricingSummary.grandTotal)}</b>
          <span>
            ยอดรวมทั้งหมด
            {totalQuantity !== undefined && ` · ${totalQuantity.toLocaleString("th-TH")} ตัว`}
          </span>
        </div>

        <div className={c("lines")}>
          {items ? (
            items.map((item, idx) => (
              <div key={idx} className={c("srow")}>
                <span>
                  {idx + 1}. {item.description.trim() || `รายการที่ ${idx + 1}`}{" "}
                  <em>{(counted ? getFormItemTotalQty(item) : 0).toLocaleString("th-TH")} ตัว</em>
                </span>
                <b>{formatBaht(counted ? calculateFormItemSubtotal(item) : 0)}</b>
              </div>
            ))
          ) : (
            <div className={c("srow")}>
              <span>รวมสินค้า</span>
              <b>{formatBaht(pricingSummary.subtotalItems)}</b>
            </div>
          )}
          {showFeeSections && (
            <div className={c("srow")}>
              <span>ค่าใช้จ่ายเพิ่มเติม</span>
              <b>{formatBaht(pricingSummary.subtotalFees)}</b>
            </div>
          )}
          {isMarketplace && (
            <div className={c("srow")}>
              <span>ค่าธรรมเนียม {channelLabel}</span>
              <b>{formatBaht(platformFee)}</b>
            </div>
          )}
          {discount > 0 && (
            <div className={c("srow")}>
              <span>ส่วนลดท้ายบิล</span>
              <b>-{formatBaht(discount)}</b>
            </div>
          )}
          {taxRate > 0 && (
            <div className={c("srow")}>
              <span>VAT {taxRate}%</span>
              <b>{formatBaht(pricingSummary.taxAmount)}</b>
            </div>
          )}
        </div>

        {/* กำไรขั้นต้นโดยประมาณ — โชว์เฉพาะ role การเงิน (caller ส่ง null = ไม่ render เลย) */}
        {marginEstimate && <MarginEstimateBlock estimate={marginEstimate} />}
      </div>

      {/* ยอดที่ต้องเก็บก่อนเริ่มงานตามเงื่อนไขชำระ (สูตรกลาง payment-terms) · เครดิต/COD/ไม่ระบุ = ไม่มีแถบ */}
      {upfront > 0 && (
        <div className={c("tfoot")}>
          {upfrontLabel} <b className={c("mono")}>{formatBaht(upfront)}</b>
        </div>
      )}
    </section>
  );
}
