import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import QuoteConfirmPage from "./page";

const state = vi.hoisted(() => ({ terms: "NET_30" }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    quotationConfirm: {
      getQuote: { useQuery: () => ({
        data: { quotationNumber: "QT-TEST-1", customerName: "ลูกค้าทดลอง", validUntil: "2027-01-01", status: "ACCEPTED", isExpired: false,
          items: [{ name: "เสื้อ", quantity: 1, unit: "ตัว", unitPrice: 100, totalPrice: 100 }], subtotal: 100, discount: 0, tax: 7, totalAmount: 107, terms: state.terms },
        isLoading: false, error: null, refetch: vi.fn(),
      }) },
      accept: { useMutation: () => ({ isPending: false }) },
      reject: { useMutation: () => ({ isPending: false }) },
    },
  },
}));

describe("เงื่อนไขที่ลูกค้าอ่านในใบเสนอ", () => {
  it.each([
    ["NET_30", "เครดิต 30 วัน"],
    ["DEPOSIT_50", "มัดจำ 50%"],
    ["จ่ายก่อนส่ง 2,000 บาท\nส่วนที่เหลือวันรับของ", "จ่ายก่อนส่ง 2,000 บาท\nส่วนที่เหลือวันรับของ"],
    ["LEGACY_CUSTOM_TERMS", "LEGACY_CUSTOM_TERMS"],
    ["__proto__", "__proto__"],
  ])("แปลเฉพาะรหัสที่รู้จักและคงข้อความเดิม: %s", async (terms, expected) => {
    state.terms = terms;
    const stream = await renderToReadableStream(createElement(QuoteConfirmPage, { params: Promise.resolve({ token: "public-quote-test" }) }));
    const html = await new Response(stream).text();
    expect(html).toContain(expected);
    if (terms !== expected) expect(html).not.toContain(terms);
    expect(html).toContain("107");
    expect(html).toContain("QT-TEST-1");
  });
});
