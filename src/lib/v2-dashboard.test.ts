import { describe, expect, it } from "vitest";
import {
  buildDashboardAttentionItems,
  type DashboardPulseData,
} from "./v2-dashboard";

const CLEAR_PULSE: DashboardPulseData = {
  atRiskOrders: { overdue: 0, dueSoon: 0 },
  outsource: { pending: 0, overduePickup: 0 },
  todayQueue: { done: 0, open: 0 },
  money: { overdueInvoices: 0, quotationsAwaiting: 0 },
  stuckOrders: 0,
};

describe("buildDashboardAttentionItems", () => {
  it("ไม่สร้างรายการเลขศูนย์", () => {
    expect(
      buildDashboardAttentionItems(CLEAR_PULSE, {
        canViewBilling: true,
        canViewQuotations: true,
      }),
    ).toEqual([]);
  });

  it("เรียงงานเลยกำหนดก่อนเรื่องเตือน", () => {
    const items = buildDashboardAttentionItems(
      {
        ...CLEAR_PULSE,
        atRiskOrders: { overdue: 2, dueSoon: 4 },
        stuckOrders: 7,
      },
      { canViewBilling: true, canViewQuotations: true },
    );

    expect(items.map((item) => item.kind)).toEqual([
      "overdue-order",
      "due-soon",
      "stuck",
    ]);
  });

  it("ไม่ส่งเรื่องเงินเข้า UI เมื่อไม่มีสิทธิ์ไปปลายทาง", () => {
    const items = buildDashboardAttentionItems(
      {
        ...CLEAR_PULSE,
        money: { overdueInvoices: 3, quotationsAwaiting: 5 },
      },
      { canViewBilling: false, canViewQuotations: false },
    );

    expect(items).toEqual([]);
  });

  it("งานร้านนอกหนึ่งแถวบอกจำนวนเลยกำหนดโดยไม่บวกซ้ำ", () => {
    const [item] = buildDashboardAttentionItems(
      {
        ...CLEAR_PULSE,
        outsource: { pending: 6, overduePickup: 2 },
      },
      { canViewBilling: false, canViewQuotations: false },
    );

    expect(item).toMatchObject({
      kind: "outsource",
      count: 6,
      detail: "เลยกำหนดรับ 2 งาน",
      tone: "danger",
    });
  });
});
