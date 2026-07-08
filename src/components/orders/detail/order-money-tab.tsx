import { Calculator } from "lucide-react";
import { Section } from "@/components/ui/section";
import { formatCurrency } from "@/lib/utils";
import { OrderBillingSection } from "@/components/orders/order-billing-section";

// UX6: แท็บ "เงิน/บิล" — ยกการ์ดสรุปราคา+กำไร (เดิมอยู่ sidebar) มาไว้หัวแท็บ + การ์ดบิลเต็มคอลัมน์
// เดิมการ์ดบิล 1,336 บรรทัดถูกยัดใน sidebar 1/3 → บนมือถือตกไปท้ายสุด · ย้าย layout ล้วน ไม่แตะ logic บิล
// หน้านี้ render เฉพาะ role ที่เห็นเงิน (gate canSeeMoney ที่หน้า) — ไม่มี ฿ หลุดถึง role อื่น

interface OrderMoneyTabProps {
  order: {
    id: string;
    customerId: string;
    internalStatus: string;
    taxRate: number;
    taxAmount: number | null;
  };
  subtotalItems: number;
  subtotalFees: number;
  discount: number;
  totalAmount: number;
  totalCost: number;
  hasCostEntries: boolean;
  profitMargin: number | null;
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="text-right text-sm font-medium text-slate-900 dark:text-white">{children}</div>
    </div>
  );
}

export function OrderMoneyTab({
  order,
  subtotalItems,
  subtotalFees,
  discount,
  totalAmount,
  totalCost,
  hasCostEntries,
  profitMargin,
}: OrderMoneyTabProps) {
  const showSummary =
    totalAmount > 0 || subtotalItems > 0 || subtotalFees > 0 || hasCostEntries;

  return (
    <div className="space-y-5">
      {/* สรุปราคา + กำไร — ยอดเดียวจุดเดียว (เดิมซ้ำ sidebar↔หัวการ์ดบิล) */}
      {showSummary && (
        <Section
          title={
            <span className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              สรุปราคา
            </span>
          }
        >
          <div className="space-y-2.5">
            <Row label="ยอดรวมสินค้า">
              <span className="tabular-nums">{formatCurrency(subtotalItems)}</span>
            </Row>
            {subtotalFees > 0 && (
              <Row label="ค่าธรรมเนียม">
                <span className="tabular-nums">{formatCurrency(subtotalFees)}</span>
              </Row>
            )}
            {discount > 0 && (
              <Row label="ส่วนลด">
                <span className="tabular-nums text-red-600 dark:text-red-400">
                  -{formatCurrency(discount)}
                </span>
              </Row>
            )}
            {order.taxRate > 0 && (
              <Row label={`VAT (${order.taxRate}%)`}>
                <span className="tabular-nums">{formatCurrency(order.taxAmount ?? 0)}</span>
              </Row>
            )}
            <div className="flex items-baseline justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className="text-sm font-medium text-slate-900 dark:text-white">ยอดรวมทั้งหมด</span>
              <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {hasCostEntries && (
              <div className="space-y-2.5 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  ต้นทุน
                </p>
                <Row label="ต้นทุนรวม">
                  <span className="tabular-nums">{formatCurrency(totalCost)}</span>
                </Row>
                <Row label="กำไร">
                  <span className="tabular-nums">{formatCurrency(totalAmount - totalCost)}</span>
                </Row>
                {profitMargin != null && (
                  <Row label="อัตรากำไร">
                    <span
                      className={`tabular-nums font-semibold ${
                        profitMargin >= 30
                          ? "text-green-600 dark:text-green-400"
                          : profitMargin >= 15
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {profitMargin.toFixed(1)}%
                    </span>
                  </Row>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* การ์ดบิล — เต็มคอลัมน์ (เดิมยัดใน sidebar 1/3) · logic ภายในไม่แตะ */}
      <OrderBillingSection
        orderId={order.id}
        customerId={order.customerId}
        totalAmount={totalAmount}
        internalStatus={order.internalStatus}
      />
    </div>
  );
}
