"use client";

/**
 * "ของจริงตอนนี้" — `OrderOverviewTab` ตัวจริงของหน้า /orders/[id] ต่างแค่ข้อมูลปลอม
 * แก้ของจริงเมื่อไหร่ ปุ่มนี้เปลี่ยนตามเอง จึงเป็นตัวเทียบที่เชื่อได้ 100%
 *
 * จุดที่กำลังเป็นปัญหา: ทั้งแท็บไม่มีที่ให้ "ลาย" เลย — ต้องกดไปแท็บ "ม็อกอัพ & ไฟล์"
 * ถึงจะรู้ว่าใบนี้พิมพ์อะไร
 */

import { OrderOverviewTab } from "@/components/orders/detail/order-overview-tab";
import { CHANNEL_COLORS, isMarketplaceChannel } from "@/lib/order-status";

import { demoOrder, demoTotals } from "../../order-detail/_data";

export function CurrentVariant({
  thin,
  showMoney,
}: {
  thin: boolean;
  showMoney: boolean;
}) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-secondary",
  };

  return (
    <OrderOverviewTab
      order={order}
      showMoney={showMoney}
      totalAmount={totals.totalAmount}
      totalQuantity={totals.totalQuantity}
      onOpenMoney={showMoney ? () => {} : undefined}
      onOpenDelivery={() => {}}
      onEditInfo={() => {}}
      channelColor={channelColor}
      isMarketplace={isMarketplaceChannel(order.channel)}
    />
  );
}
