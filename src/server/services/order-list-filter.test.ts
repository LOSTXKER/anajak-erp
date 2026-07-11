import { describe, expect, it } from "vitest";
import { orderAttentionWhere } from "./order-list-filter";

const NOW = new Date("2026-07-11T05:00:00.000Z");

describe("orderAttentionWhere", () => {
  it("กรองงานเลยกำหนดด้วยนิยามเดียวกับ Owner Pulse", () => {
    expect(orderAttentionWhere("overdue", NOW)).toEqual({
      internalStatus: {
        notIn: ["COMPLETED", "CANCELLED", "SHIPPED", "DRAFT"],
      },
      deadline: { lt: NOW },
    });
  });

  it("กำหนด due-soon เป็นช่วง 48 ชั่วโมงถัดไป", () => {
    expect(orderAttentionWhere("due-soon", NOW)).toEqual({
      internalStatus: {
        notIn: ["COMPLETED", "CANCELLED", "SHIPPED", "DRAFT"],
      },
      deadline: {
        gte: NOW,
        lte: new Date("2026-07-13T05:00:00.000Z"),
      },
    });
  });

  it("งานติดหล่มต้องเงียบทั้งหัวงานและ revision เกิน 3 วัน", () => {
    expect(orderAttentionWhere("stuck", NOW)).toEqual({
      internalStatus: { notIn: ["COMPLETED", "CANCELLED", "DRAFT"] },
      updatedAt: { lt: new Date("2026-07-08T05:00:00.000Z") },
      revisions: {
        none: { createdAt: { gte: new Date("2026-07-08T05:00:00.000Z") } },
      },
    });
  });
});
