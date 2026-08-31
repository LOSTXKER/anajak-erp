"use client";

/**
 * "ของจริงตอนนี้" — `OrderOverviewTab` + `OrderArtworkCardView` **ตัวจริง** ของหน้า
 * /orders/[id] ต่างแค่ข้อมูลที่ป้อนเข้าไปเป็นของปลอม แก้ของจริงเมื่อไหร่หน้านี้เปลี่ยนตามเอง
 *
 * ⚠️ ตั้งแต่ 2026-08-31 (เบสเคาะแบบ B แล้วลงของจริง) ปุ่มนี้จึงแสดง "แบบ B ที่ลงจริงแล้ว"
 * ไม่ใช่หน้าตาก่อนมีลายอีกต่อไป — หน้าตาเดิมดูย้อนหลังได้จากประวัติ Git
 *
 * การ์ดลายในของจริงยิง query เอง (design.listByOrder + attachment.listByEntity) หน้าลอง
 * จึงเรียก `OrderArtworkCardView` ซึ่งเป็นตัววาดตัวเดียวกันแต่รับข้อมูลเป็น props
 */

import { OrderOverviewTab } from "@/components/orders/detail/order-overview-tab";
import { OrderArtworkCardView } from "@/components/orders/detail/order-artwork-card";
import { CHANNEL_COLORS, isMarketplaceChannel } from "@/lib/order-status";

import { demoOrder, demoTotals } from "../../order-detail/_data";
import { demoMockups, demoPrintFiles, demoRawFiles } from "../_artwork";

export function CurrentVariant({
  thin,
  showMoney,
}: {
  thin: boolean;
  showMoney: boolean;
}) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const mockups = demoMockups(thin);
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
      artwork={
        <OrderArtworkCardView
          latest={mockups[0] ?? null}
          versionCount={mockups.length}
          rawCount={demoRawFiles(thin).length}
          printCount={demoPrintFiles(thin).length}
          description={order.description}
          onOpenFiles={() => {}}
        />
      }
      channelColor={channelColor}
      isMarketplace={isMarketplaceChannel(order.channel)}
    />
  );
}
