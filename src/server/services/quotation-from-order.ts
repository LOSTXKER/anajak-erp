import { moneyInput, round2 } from "./money";
import { computeQuotationTotals } from "./pricing";
import { getPaymentTerms } from "@/lib/payment-terms";

type QuotationOrderSource = {
  items: readonly { description: string | null; totalQuantity: number; subtotal: number; products: readonly { description: string }[] }[];
  fees: readonly { name: string; amount: number }[];
  discount: number;
  taxAmount: number;
  paymentTerms: string | null;
};

/** ใบเสนอใช้ยอดงานและค่าบริการเดียวกับออเดอร์ โดยไม่ดึงค่าธรรมเนียม marketplace เข้าฐานขาย */
export function quotationFromOrder(order: QuotationOrderSource) {
  const items = order.items.map((item) => {
    const name = item.description || item.products[0]?.description || "รายการงาน";
    const descriptions = item.products.map((product) => product.description).filter(Boolean);
    const amount = moneyInput(item.subtotal);
    const quantity = item.totalQuantity || 1;
    const unitPrice = round2(amount.div(quantity));
    // ราคาเหมาที่หารต่อชิ้นไม่ลงสตางค์ต้องคงยอดทั้งงาน ไม่ปัดจนยอดใบเสนอเปลี่ยน
    const exactUnitPrice = unitPrice.mul(quantity).eq(amount);
    return {
      name,
      description: [...descriptions, ...(!exactUnitPrice ? [`รวม ${item.totalQuantity} ชิ้น คิดราคาเหมาทั้งงาน`] : [])].join(", "),
      quantity: exactUnitPrice ? quantity : 1,
      unit: exactUnitPrice ? "ชิ้น" : "งาน",
      unitPrice: (exactUnitPrice ? unitPrice : amount).toNumber(),
    };
  });
  items.push(...order.fees.map((fee) => ({
    name: fee.name,
    description: "",
    quantity: 1,
    unit: "รายการ",
    unitPrice: moneyInput(fee.amount).toNumber(),
  })));
  const discount = moneyInput(order.discount).toNumber();
  const tax = moneyInput(order.taxAmount).toNumber();
  const totals = computeQuotationTotals({ items, discount, tax });
  const terms = getPaymentTerms(order.paymentTerms)?.label ?? order.paymentTerms ?? "";
  return { items, discount, tax, terms, ...totals };
}
