import { BarChart3, Receipt, User, Wallet } from "lucide-react";
import { c, CardHead, Prop, StateBox, SubHead } from "@/components/kit/kit";
import { OrderBillingSection } from "@/components/orders/order-billing-section";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { formatBaht } from "@/lib/utils";
import { customerDisplayNameOrDash } from "@/lib/customer-name";

/* ============================================================
   แท็บ "เงิน & บิล" — ต้นแบบ tabMoney() ทีละชิ้น (รื้อ 2026-09-15)

   บิล/การชำระเงินซ้าย (logic ทั้งหมดใน OrderBillingSection) · สรุปราคาปักหมุดขวา
   ลำดับ DOM = บิลก่อน (จอแคบเห็นงานที่ต้องทำก่อน)
   หน้านี้ render เฉพาะ role ที่เห็นเงิน (gate canSeeMoney ที่หน้า) — ไม่มี ฿ หลุดถึง role อื่น
   ============================================================ */

interface OrderMoneyTabProps {
  order: {
    id: string;
    customerId: string;
    internalStatus: string;
    taxRate: number;
    taxAmount: number | null;
    paymentTerms?: string | null;
    customer?: {
      // นิติบุคคลไม่ต้องกรอกชื่อผู้ติดต่อ (เบสสั่ง 2026-09-18) — ชื่อที่แสดงถอยไปใช้ชื่อบริษัท
      name: string | null;
      company: string | null;
      // null เมื่อ viewer ไม่เห็นเงินฝั่งขาย (server ปิดมาให้แล้ว)
      creditLimit: number | null;
      totalSpent: number | null;
    } | null;
  };
  subtotalItems: number;
  subtotalFees: number;
  discount: number;
  totalAmount: number;
  totalCost: number;
  hasCostEntries: boolean;
  profitMargin: number | null;
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
  const termsLabel = order.paymentTerms ? (PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms) : null;
  const customer = order.customer ?? null;
  const creditText =
    customer?.creditLimit == null
      ? null
      : customer.creditLimit > 0
        ? `วงเงินเครดิต ${formatBaht(customer.creditLimit)}`
        : "ไม่มีวงเงินเครดิต";
  const spentText = customer?.totalSpent != null ? `ซื้อสะสม ${formatBaht(customer.totalSpent)}` : null;
  const customerSmall = [creditText, spentText].filter(Boolean).join(" · ");
  // อัตรากำไร: ≥30% เขียว · 15–30% ส้ม · ต่ำกว่านั้นแดง (เกณฑ์เดิม)
  const marginTone = profitMargin == null ? null : profitMargin >= 30 ? "good" : profitMargin >= 15 ? "warn" : "bad";

  return (
    <div className={c("two wide")}>
      <OrderBillingSection
        orderId={order.id}
        customerId={order.customerId}
        totalAmount={totalAmount}
        internalStatus={order.internalStatus}
      />

      <section className={c("card price sticky")} aria-labelledby="ms-h">
        <CardHead
          icon={Receipt}
          tone="good"
          id="ms-h"
          title="สรุปราคา"
          right={order.taxRate > 0 ? undefined : <span className={c("chip gray")}>ไม่มี VAT</span>}
        />
        <div className={c("cb")}>
          <div className={c("big")}>{formatBaht(totalAmount)}</div>
          <div style={{ marginTop: 12 }}>
            <div className={c("srow")}>
              <span>ยอดรวมสินค้า</span>
              <b>{formatBaht(subtotalItems)}</b>
            </div>
            {subtotalFees > 0 ? (
              <div className={c("srow")}>
                <span>ค่าธรรมเนียม</span>
                <b>{formatBaht(subtotalFees)}</b>
              </div>
            ) : null}
            {discount > 0 ? (
              <div className={c("srow")}>
                <span>ส่วนลด</span>
                <b className={c("neg")}>-{formatBaht(discount)}</b>
              </div>
            ) : null}
            {order.taxRate > 0 ? (
              <div className={c("srow")}>
                <span>VAT {order.taxRate}%</span>
                <b>{formatBaht(order.taxAmount ?? 0)}</b>
              </div>
            ) : null}
            <div className={c("srow total")}>
              <span>ยอดรวมทั้งหมด</span>
              <b>{formatBaht(totalAmount)}</b>
            </div>
          </div>

          <div className={c("hr")} />
          {hasCostEntries ? (
            <>
              <SubHead icon={BarChart3} title="ต้นทุนและกำไร" />
              <div className={c("srow")}>
                <span>ต้นทุนรวม</span>
                <b>{formatBaht(totalCost)}</b>
              </div>
              <div className={c("srow")}>
                <span>กำไร</span>
                <b>{formatBaht(totalAmount - totalCost)}</b>
              </div>
              {profitMargin != null ? (
                <div className={c("srow")}>
                  <span>อัตรากำไร</span>
                  <b
                    className={c(marginTone === "warn" ? null : marginTone)}
                    style={marginTone === "warn" ? { color: "var(--warn)" } : undefined}
                  >
                    {profitMargin.toFixed(1)}%
                  </b>
                </div>
              ) : null}
            </>
          ) : (
            <StateBox icon={BarChart3}>ยังไม่บันทึกต้นทุน</StateBox>
          )}

          <div className={c("hr")} />
          <dl className={c("props one")}>
            <Prop icon={Wallet} label="เงื่อนไขชำระ" none={!termsLabel}>
              {termsLabel ?? "ยังไม่ระบุ"}
            </Prop>
            {customer ? (
              <Prop icon={User} label="ลูกค้า">
                {customerDisplayNameOrDash(customer)}
                {customerSmall ? <small>{customerSmall}</small> : null}
              </Prop>
            ) : null}
          </dl>
        </div>
      </section>
    </div>
  );
}
