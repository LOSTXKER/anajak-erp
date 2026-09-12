import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuotationAmountSummary } from "./quotation-amount-summary";
import { formatCurrency } from "@/lib/utils";

type Quotation = ComponentProps<typeof QuotationAmountSummary>["quotation"];

const render = (quotation: Quotation) => {
  const html = renderToStaticMarkup(createElement(QuotationAmountSummary, { quotation }));
  return { html, text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") };
};

describe("quotation amount summary", () => {
  it("ใช้ยอดที่บันทึกเหมือนเอกสารพิมพ์ และบอกเมื่อรายการรวมไม่ตรงโดยไม่เดาสาเหตุ", () => {
    const { html, text } = render({
      items: [{ totalPrice: 10200 }],
      subtotal: 10700,
      discount: 0,
      tax: 749,
      totalAmount: 11449,
    });
    expect(html).toContain('role="alert"');
    expect(text).toContain(`รายการรวม ${formatCurrency(10200)}`);
    expect(text).toContain(`ยอดก่อนส่วนลดและภาษี ${formatCurrency(10700)}`);
    expect(text).toContain(`ยอดรวมทั้งหมด ${formatCurrency(11449)}`);
    expect(text).toContain("กรุณาตรวจสอบรายการก่อนปรับราคา");
    expect(text).not.toContain("ค่าบริการ");
    expect(text).not.toContain("ค่าขนส่ง");
  });

  it("แสดงส่วนลดและภาษีด้วยเครื่องหมายที่อธิบายยอดรวม", () => {
    const { html, text } = render({
      items: [{ totalPrice: 600 }, { totalPrice: 400 }],
      subtotal: 1000,
      discount: 100,
      tax: 63,
      totalAmount: 963,
    });
    expect(text).toContain(`ส่วนลด -${formatCurrency(100)}`);
    expect(text).toContain(`ภาษี +${formatCurrency(63)}`);
    expect(text).toContain(`ยอดรวมทั้งหมด ${formatCurrency(963)}`);
    expect(html).not.toContain('role="alert"');
  });

  it("ศูนย์ยังเป็นยอดจริง และผลรวมทศนิยมปกติไม่สร้างคำเตือนผิด", () => {
    const zero = render({ items: [], subtotal: 0, discount: 0, tax: 0, totalAmount: 0 });
    expect(zero.text).toContain(`ยอดรวมทั้งหมด ${formatCurrency(0)}`);
    expect(zero.html).not.toContain('role="alert"');
    const fractional = render({ items: [{ totalPrice: 0.1 }, { totalPrice: 0.2 }], subtotal: 0.3, discount: 0, tax: 0, totalAmount: 0.3 });
    expect(fractional.html).not.toContain('role="alert"');
  });

  it("detail และ print ใช้ยอดใบเดียวกัน พร้อมคงสิทธิ์และข้อความเงื่อนไขที่ไม่รู้จัก", () => {
    const detail = readFileSync(new URL("../../app/(dashboard)/quotations/[id]/page.tsx", import.meta.url), "utf8");
    const print = readFileSync(new URL("../../app/(print)/print/quotation/[id]/page.tsx", import.meta.url), "utf8");
    expect(detail).toContain("<QuotationAmountSummary quotation={quotation} />");
    expect(print).toContain('requirePrintPermission("see_order_money")');
    expect(print).toContain('amount: quotation.subtotal');
    expect(print).toContain('grandAmount={quotation.totalAmount}');
    expect(print).toContain("PAYMENT_TERMS_LABELS[quotation.terms] ?? quotation.terms");
  });
});
