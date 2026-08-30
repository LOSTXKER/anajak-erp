"use client";

/**
 * ปัจจุบัน — ของจริงทั้งดุ้น ไม่ได้วาดใหม่
 * `PageHeader` + `OrderOverviewTab` เป็น component ตัวเดียวกับที่หน้า /orders/[id] ใช้
 * ต่างกันแค่ข้อมูลที่ป้อนเข้าไปเป็นของปลอม — จึงเป็นตัวเทียบที่เชื่อได้ 100%
 */

import { ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { OrderOverviewTab } from "@/components/orders/detail/order-overview-tab";
import { CHANNEL_COLORS, isMarketplaceChannel } from "@/lib/order-status";
import { demoOrder, demoTotals } from "../_data";
import {
  ProtoMoreButton,
  ProtoNextStepButton,
  ProtoNotices,
  ProtoStatusRail,
  ProtoTabBar,
} from "../_chrome";

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
    <div className="space-y-6">
      <PageHeader
        icon={ShoppingCart}
        breadcrumb={[{ label: "ออเดอร์", href: "/orders" }, { label: order.orderNumber }]}
        title={order.orderNumber}
        meta={order.title || undefined}
        action={
          <>
            <ProtoNextStepButton thin={thin} showMoney={showMoney} />
            <ProtoMoreButton />
          </>
        }
      />

      <ProtoStatusRail thin={thin} />
      <ProtoNotices order={order} />
      <ProtoTabBar showMoney={showMoney} pendingTab="production" />

      <div className="mt-6">
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
      </div>
    </div>
  );
}
