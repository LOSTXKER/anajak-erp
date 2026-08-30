"use client";

/**
 * "ของจริงตอนนี้" — ของจริงทั้งดุ้น ไม่ได้วาดใหม่
 * `PageHeader` + `OrderOverviewTab` เป็น component ตัวเดียวกับที่หน้า /orders/[id] ใช้
 * ต่างกันแค่ข้อมูลที่ป้อนเข้าไปเป็นของปลอม — จึงเป็นตัวเทียบที่เชื่อได้ 100%
 *
 * ⚠️ ตั้งแต่ 2026-08-30 (เบสเคาะแบบ B แล้วลงของจริง) ปุ่มนี้จึงแสดง "แบบ B ที่ลงจริงแล้ว"
 * ไม่ใช่หน้าตาเดิมก่อนรื้ออีกต่อไป · หน้าตาเดิมดูย้อนหลังได้จากประวัติ Git
 * โครงหัวใบข้างล่างถูกคัดลอกให้ตรงกับ order-detail-page.tsx (ห่อ PageHeader + แถบสถานะ
 * ไว้ในแผ่นเดียว) — แก้ของจริงเมื่อไหร่ต้องแก้ตรงนี้ตามด้วย ไม่งั้นหน้าลองโกหก
 */

import { ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { OrderOverviewTab } from "@/components/orders/detail/order-overview-tab";
import {
  CHANNEL_COLORS,
  CUSTOMER_STATUS_LABELS,
  PRIORITY_LABELS,
  isMarketplaceChannel,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { demoOrder, demoStatus, demoTotals } from "../_data";
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
  const status = demoStatus(thin);
  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-secondary",
  };

  const isUrgent = order.priority === "URGENT";
  const isHighPriority = order.priority === "HIGH";

  return (
    <div className="space-y-6">
      <section className="card-surface relative overflow-hidden rounded-2xl">
        {(isUrgent || isHighPriority) && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 left-0 w-1",
              isUrgent ? "bg-red-500" : "bg-amber-500",
            )}
          />
        )}
        <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
          <PageHeader
            icon={ShoppingCart}
            breadcrumb={[
              { label: "ออเดอร์", href: "/orders" },
              { label: order.orderNumber },
            ]}
            title={order.orderNumber}
            description={order.title || null}
            titleBadge={
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge variant="accent" size="sm">
                  {CUSTOMER_STATUS_LABELS[status.customerStatus]}
                </Badge>
                {(isUrgent || isHighPriority) && (
                  <Badge variant={isUrgent ? "destructive" : "warning"} size="sm">
                    {PRIORITY_LABELS[order.priority]}
                  </Badge>
                )}
              </span>
            }
            action={
              <>
                <ProtoNextStepButton thin={thin} showMoney={showMoney} />
                <ProtoMoreButton />
              </>
            }
          />
          <ProtoStatusRail thin={thin} />
        </div>
      </section>

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
