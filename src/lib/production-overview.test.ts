import { describe, expect, it } from "vitest";
import { summarizeActionableWork } from "./production-overview";

describe("summarizeActionableWork", () => {
  it("แยกจำนวนออเดอร์ไม่ซ้ำออกจากจำนวนการ์ดเลน", () => {
    expect(
      summarizeActionableWork([
        { orderId: "order-a" },
        { orderId: "order-a" },
        { orderId: "order-b" },
      ])
    ).toEqual({ orderCount: 2, laneCount: 3 });
  });

  it("สรุปจากชุดเต็มได้โดยไม่ตัดจำนวนตาม preview", () => {
    const cards = Array.from({ length: 8 }, (_, index) => ({
      orderId: `order-${index}`,
    }));

    expect(summarizeActionableWork(cards)).toEqual({ orderCount: 8, laneCount: 8 });
  });
});
