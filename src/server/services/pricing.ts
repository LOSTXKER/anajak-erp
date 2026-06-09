import { Prisma } from "@prisma/client";
import { badRequest } from "@/server/errors";
import { D, round2, sumMoney } from "./money";

// สูตรราคาออเดอร์ "ตัวจริง" ของระบบ — ทุก mutation ที่แตะยอดเงินออเดอร์/ใบเสนอราคาต้องผ่านที่นี่
// UI มีสูตร preview ฝั่ง client ใน src/lib/pricing.ts (calculateOrderSummary) ที่ต้อง mirror สูตรนี้เสมอ
//
// สูตร A (เคาะ 2026-06-10 — สูตรเดียวทุกที่):
//   subtotalBeforeTax = subtotalItems + subtotalFees - discount
//   taxAmount         = subtotalBeforeTax × taxRate/100
//   totalAmount       = max(0, subtotalBeforeTax + taxAmount)
// platformFee "ห้าม" เข้า totalAmount และฐาน VAT — มันคือเงินที่ marketplace หักจากยอดโอน
// (ฝั่งต้นทุน/กำไร — รอผูกเข้า job costing ตอน P2) เก็บไว้บน Order เป็นข้อมูลอ้างอิงเท่านั้น

interface PricedProductInput {
  baseUnitPrice: number;
  discount?: number;
  variants: { quantity: number }[];
}

interface PricedItemInput {
  products: PricedProductInput[];
  prints: { unitPrice: number }[];
  addons: { pricingType: string; unitPrice: number; quantity?: number | null }[];
}

export type PricedProduct<P> = P & {
  totalQuantity: number;
  subtotal: number;
  sortOrder: number;
};

export type PricedItem<I extends PricedItemInput> = Omit<I, "products"> & {
  products: PricedProduct<I["products"][number]>[];
  totalQuantity: number;
  subtotal: number;
  sortOrder: number;
};

// คำนวณยอดต่อ item/product แบบ Decimal แล้วคืนค่าเดิม + totalQuantity/subtotal/sortOrder (ปัด 2 ตำแหน่งแล้ว)
export function priceOrderItems<I extends PricedItemInput>(items: I[]): PricedItem<I>[] {
  return items.map((item, index) => {
    const productsCalc = item.products.map((p, pIdx) => {
      const totalQuantity = p.variants.reduce((s, v) => s + v.quantity, 0);
      const netPrice = Prisma.Decimal.max(0, D(p.baseUnitPrice).minus(p.discount || 0));
      const subtotal = round2(netPrice.times(totalQuantity));
      return { ...p, totalQuantity, subtotal: subtotal.toNumber(), sortOrder: pIdx };
    });

    const itemTotalQty = productsCalc.reduce((s, p) => s + p.totalQuantity, 0);
    const productsCost = productsCalc.reduce((s, p) => s.plus(p.subtotal), D(0));
    const printPerPiece = item.prints.reduce((s, pr) => s.plus(pr.unitPrice), D(0));
    const printsCost = round2(printPerPiece.times(itemTotalQty));
    const addonsCost = item.addons.reduce((s, a) => {
      if (a.pricingType === "PER_PIECE") {
        return s.plus(round2(D(a.unitPrice).times(a.quantity ?? itemTotalQty)));
      }
      return s.plus(round2(D(a.unitPrice)));
    }, D(0));

    const subtotal = round2(productsCost.plus(printsCost).plus(addonsCost));
    return {
      ...item,
      products: productsCalc,
      totalQuantity: itemTotalQty,
      subtotal: subtotal.toNumber(),
      sortOrder: index,
    } as PricedItem<I>;
  });
}

export interface OrderTotalsInput {
  itemSubtotals: number[];
  feeAmounts: number[];
  discount: number;
  taxRate: number; // เปอร์เซ็นต์ 0-100
}

export interface OrderTotals {
  subtotalItems: number;
  subtotalFees: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotalItems = sumMoney(input.itemSubtotals);
  const subtotalFees = sumMoney(input.feeAmounts);
  const discount = round2(D(input.discount || 0));

  // กันฐานภาษีติดลบ/ยอดเพี้ยนตั้งแต่ชั้น service — ทุก mutation เงินผ่านที่นี่หมด
  if (discount.lt(0)) {
    badRequest("ส่วนลดติดลบไม่ได้");
  }
  if (discount.gt(subtotalItems.plus(subtotalFees))) {
    badRequest("ส่วนลดเกินยอดรวมของออเดอร์");
  }

  const subtotalBeforeTax = subtotalItems.plus(subtotalFees).minus(discount);
  const taxAmount = round2(subtotalBeforeTax.times(input.taxRate || 0).div(100));
  const totalAmount = Prisma.Decimal.max(0, subtotalBeforeTax.plus(taxAmount));

  return {
    subtotalItems: subtotalItems.toNumber(),
    subtotalFees: subtotalFees.toNumber(),
    discount: discount.toNumber(),
    taxAmount: taxAmount.toNumber(),
    totalAmount: totalAmount.toNumber(),
  };
}

// ใบเสนอราคา: tax เป็น "จำนวนเงิน" (บาท) ไม่ใช่อัตรา — ตามหน้าตา form เดิม
export function computeQuotationTotals(input: {
  items: { quantity: number; unitPrice: number }[];
  discount: number;
  tax: number;
}) {
  const lineTotals = input.items.map((i) => round2(D(i.unitPrice).times(i.quantity)));
  const subtotal = round2(lineTotals.reduce((s, v) => s.plus(v), D(0)));
  const totalAmount = Prisma.Decimal.max(
    0,
    subtotal.minus(round2(D(input.discount || 0))).plus(round2(D(input.tax || 0)))
  );
  return {
    lineTotals: lineTotals.map((d) => d.toNumber()),
    subtotal: subtotal.toNumber(),
    totalAmount: totalAmount.toNumber(),
  };
}
