import { ChartColumn, Receipt } from "lucide-react";
import { Section } from "@/components/ui/section";
import { HomeChip, HomeIconTile } from "@/components/dashboard/home/home-card";
import { cn, formatBaht } from "@/lib/utils";
import { OrderBillingSection } from "@/components/orders/order-billing-section";

// UX6: แท็บ "เงิน/บิล" — บิล/รับเงินซ้าย · สรุปราคาปักหมุดขวา
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

function Row({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm text-secondary", className)}>
      <span>{label}</span>
      <span className="font-mono font-medium tabular-nums text-strong">{children}</span>
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
    /* หน้าเงิน & บิล (ต้นแบบหน้าออเดอร์รอบ 2 · ไล่ตรงต้นแบบ 2026-09-15): บิล/รับเงินซ้าย · สรุปราคาปักหมุดขวา
       ลำดับ DOM = บิลก่อน (มือถือเห็นงานที่ต้องทำก่อน) · logic บิลอยู่ใน OrderBillingSection ไม่แตะ */
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <OrderBillingSection
          orderId={order.id}
          customerId={order.customerId}
          totalAmount={totalAmount}
          internalStatus={order.internalStatus}
        />
      </div>

      {/* สรุปราคา + กำไร — ยอดรวมตัวใหญ่ตัวเดียว แล้วแตกเป็นแถว (ต้นแบบ .price) */}
      {showSummary && (
        <div className="min-w-0 xl:sticky xl:top-16">
          <Section
            title={
              <span className="flex items-center gap-2.5">
                <HomeIconTile icon={Receipt} tone="success" />
                สรุปราคา
              </span>
            }
            action={<HomeChip>{order.taxRate > 0 ? `รวม VAT ${order.taxRate}%` : "ไม่มี VAT"}</HomeChip>}
          >
            <p className="font-mono text-3xl font-semibold tabular-nums text-strong">{formatBaht(totalAmount)}</p>
            <div className="mt-3">
              <Row label="ยอดรวมสินค้า">{formatBaht(subtotalItems)}</Row>
              {subtotalFees > 0 && <Row label="ค่าธรรมเนียม">{formatBaht(subtotalFees)}</Row>}
              {discount > 0 && (
                <Row label="ส่วนลด">
                  <span className="text-red-600 dark:text-red-400">-{formatBaht(discount)}</span>
                </Row>
              )}
              {order.taxRate > 0 && <Row label={`VAT (${order.taxRate}%)`}>{formatBaht(order.taxAmount ?? 0)}</Row>}
              <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-border pt-2.5 text-sm font-medium text-strong">
                <span>ยอดรวมทั้งหมด</span>
                <span className="font-mono text-base font-semibold tabular-nums">{formatBaht(totalAmount)}</span>
              </div>
            </div>

            <div className="mt-4 border-t border-divider pt-3.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
                <HomeIconTile icon={ChartColumn} size="sm" />
                ต้นทุนและกำไร
              </h3>
              {hasCostEntries ? (
                <div className="mt-1.5">
                  <Row label="ต้นทุนรวม">{formatBaht(totalCost)}</Row>
                  <Row label="กำไร">{formatBaht(totalAmount - totalCost)}</Row>
                  {profitMargin != null && (
                    <Row label="อัตรากำไร">
                      <span
                        className={cn(
                          "font-semibold",
                          profitMargin >= 30
                            ? "text-green-600 dark:text-green-400"
                            : profitMargin >= 15
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {profitMargin.toFixed(1)}%
                      </span>
                    </Row>
                  )}
                </div>
              ) : (
                <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-secondary">ยังไม่บันทึกต้นทุน</p>
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
