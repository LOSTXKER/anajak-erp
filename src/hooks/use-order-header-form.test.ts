import { describe, expect, it } from "vitest";
import { EMPTY_ORDER_HEADER } from "./use-order-header-form";
// ตัวตัดสินช่องทางมาร์เก็ตเพลสมีอยู่แล้วใน lib/order-status — หัวฟอร์มใช้ตัวนั้น ไม่เขียนซ้ำ
import { isMarketplaceChannel } from "@/lib/order-status";

describe("ค่าเริ่มต้นหัวฟอร์ม", () => {
  it("ภาษีเริ่มที่ 7% — บริษัทจด VAT ทุกการขายต้องมีภาษีขาย (Gate B2)", () => {
    expect(EMPTY_ORDER_HEADER.taxRate).toBe(7);
  });

  it("ช่องทางเริ่มที่ LINE · ความเร่งด่วนปกติ · เงินอื่นเริ่มที่ 0", () => {
    expect(EMPTY_ORDER_HEADER.channel).toBe("LINE");
    expect(EMPTY_ORDER_HEADER.priority).toBe("NORMAL");
    expect(EMPTY_ORDER_HEADER.discount).toBe(0);
    expect(EMPTY_ORDER_HEADER.platformFee).toBe(0);
  });
});

describe("isMarketplaceChannel", () => {
  it("ช่องทางมาร์เก็ตเพลสราคารวม VAT มาแล้ว — บวก 7% ทับคือเก็บภาษีซ้ำ", () => {
    expect(isMarketplaceChannel("SHOPEE")).toBe(true);
    expect(isMarketplaceChannel("LAZADA")).toBe(true);
    expect(isMarketplaceChannel("TIKTOK")).toBe(true);
  });

  it("ช่องทางคุยตรงไม่ใช่มาร์เก็ตเพลส", () => {
    expect(isMarketplaceChannel("LINE")).toBe(false);
    expect(isMarketplaceChannel("FACEBOOK")).toBe(false);
    expect(isMarketplaceChannel("")).toBe(false);
  });
});
