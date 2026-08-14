import type { OrderFormTabKey } from "@/lib/order-form-tabs";
import type { TabKey } from "@/lib/order-tabs";

export type OrderEditFocus = "info" | "shipping";

interface OrderEditNavigationOptions {
  tab: OrderFormTabKey;
  focus?: OrderEditFocus;
  returnTab?: TabKey;
}

/**
 * Canonical URL ของฟอร์มแก้ออเดอร์ — รวม query ไว้จุดเดียวเพื่อให้ปุ่มแก้ทุกจุด
 * เปิดแท็บเดียวกันและย้อนกลับส่วนเดิมได้ โดย encode id ก่อนวางใน path เสมอ
 */
export function buildOrderEditHref(
  orderId: string,
  options: OrderEditNavigationOptions,
): string {
  if (!orderId.trim()) throw new Error("orderId is required");

  const query = new URLSearchParams({ tab: options.tab });
  if (options.focus) query.set("focus", options.focus);
  if (options.returnTab) query.set("returnTab", options.returnTab);

  return `/orders/${encodeURIComponent(orderId)}/edit?${query.toString()}`;
}
