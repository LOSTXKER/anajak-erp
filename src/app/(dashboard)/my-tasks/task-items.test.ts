import { describe, expect, it } from "vitest";
import { buildTaskItems } from "./task-items";
import { groupTaskItems } from "@/lib/task-groups";

type TaskData = Parameters<typeof buildTaskItems>[0];

const emptyData = (): TaskData => ({
  viewerId: "viewer-1", canSupervise: true,
  production: [], printQueue: [], pressQueue: [], packQueue: [],
  awaitingProduction: [], design: [], followUp: [],
  adminToday: {
    outsourceDue: { count: 0, items: [] },
    awaitingInspection: { count: 0, items: [] },
    designsAwaiting: { count: 0, items: [] },
    dueSoon: { count: 0, items: [] },
  },
  billing: { overdueInvoices: [], shippedOrders: [] },
});
const order = {
  id: "same-order", orderNumber: "ORD-2609-0010", deadline: null,
  internalStatus: "DESIGNING" as const, customer: { name: "ลูกค้าทดสอบ" },
};
const adminOrder = { orderId: order.id, orderNumber: order.orderNumber, customerName: order.customer.name };
const visible = (data: TaskData) => groupTaskItems(buildTaskItems(data)).flatMap((group) => group.items);

describe("งานของฉันรักษางานแต่ละอย่างของออเดอร์เดียวกัน", () => {
  it("คงงานแบบ ตรวจรับเสื้อ และตามกำหนดส่ง โดยงานแบบจากสองแหล่งแสดงครั้งเดียว", () => {
    const data = emptyData();
    data.design = [{ order, latestVersion: 2, latestApproval: "PENDING" }];
    data.adminToday.designsAwaiting.items = [adminOrder];
    data.adminToday.awaitingInspection.items = [adminOrder];
    data.adminToday.dueSoon.items = [{ ...adminOrder, deadline: null }];

    const items = visible(data);
    expect(items).toHaveLength(3);
    expect(items.filter((item) => item.href === `/orders/${order.id}?tab=files`)).toHaveLength(1);
    expect(items.some((item) => item.badge === "รอตรวจรับเสื้อ")).toBe(true);
    expect(items.some((item) => item.badge === "ใกล้กำหนดส่ง")).toBe(true);
  });

  it("งานเปิดใบผลิตไม่กลบงานตรวจรับของออเดอร์เดียวกัน", () => {
    const data = emptyData();
    data.awaitingProduction = [{ ...order, internalStatus: "PRODUCTION_QUEUE" }];
    data.adminToday.awaitingInspection.items = [adminOrder];
    expect(visible(data).map((item) => item.badge)).toEqual(expect.arrayContaining(["รอเปิดใบผลิต", "รอตรวจรับเสื้อ"]));
    expect(visible(data)).toHaveLength(2);
  });

  it("งานติดตามลูกค้าไม่หายเมื่อออเดอร์เดียวกันใกล้กำหนดส่ง", () => {
    const data = emptyData();
    data.followUp = [{ order: { ...order, internalStatus: "INQUIRY" }, totalAmount: 100, itemCount: 1 }];
    data.adminToday.dueSoon.items = [{ ...adminOrder, deadline: null }];
    expect(visible(data).map((item) => item.badge)).toEqual(expect.arrayContaining(["ติดตามลูกค้า", "ใกล้กำหนดส่ง"]));
    expect(visible(data)).toHaveLength(2);
  });

  it("การวางบิลใช้ออเดอร์เดิมและแต่ละใบแจ้งหนี้ยังเป็นคนละงาน", () => {
    const data = emptyData();
    data.billing.shippedOrders = [{ ...order, internalStatus: "SHIPPED" }];
    data.billing.overdueInvoices = ["invoice-1", "invoice-2"].map((id) => ({
      id, invoiceNumber: id, totalAmount: 100, dueDate: null,
      orderId: order.id, orderNumber: order.orderNumber, customerName: order.customer.name,
    }));
    const items = visible(data);
    expect(items).toHaveLength(3);
    expect(new Set(items.map((item) => item.key)).size).toBe(3);
    expect(items.every((item) => item.href === `/orders/${order.id}?tab=money`)).toBe(true);
  });
});
