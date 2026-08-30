"use client";

/**
 * กรอบหน้าใบงานที่ "ไม่ได้กำลังเทียบ" — หัวใบ · แถบสถานะ · แถบเตือน · แถบแท็บ
 * ทุกแบบได้ชุดเดียวกันเป๊ะ (ยืมของหน้าลองรอบก่อนมาใช้ ไม่ทำซ้ำ) เพื่อให้สิ่งที่เบสเทียบ
 * คือ "เนื้อหาในแท็บภาพรวม" อย่างเดียว ไม่ใช่ของอย่างอื่นที่เปลี่ยนไปพร้อมกัน
 */

import { ShoppingCart } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CUSTOMER_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/order-status";

import { demoOrder, demoStatus } from "../order-detail/_data";
import {
  ProtoMoreButton,
  ProtoNextStepButton,
  ProtoNotices,
  ProtoQuickActions,
  ProtoStatusRail,
  ProtoTabBar,
} from "../order-detail/_chrome";

export function OrderShell({
  thin,
  showMoney,
  children,
}: {
  thin: boolean;
  showMoney: boolean;
  children: React.ReactNode;
}) {
  const order = demoOrder(thin);
  const status = demoStatus(thin);
  const isUrgent = order.priority === "URGENT";
  const isHighPriority = order.priority === "HIGH";

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <PageHeader
          icon={ShoppingCart}
          breadcrumb={[
            { label: "ออเดอร์", href: "/orders" },
            { label: order.orderNumber },
          ]}
          title={order.orderNumber}
          description={null}
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
              <ProtoQuickActions isSalesUp={showMoney} />
              <ProtoNextStepButton thin={thin} showMoney={showMoney} />
              <ProtoMoreButton />
            </>
          }
        />
        <ProtoStatusRail thin={thin} />
      </div>

      <ProtoNotices order={order} />
      <ProtoTabBar showMoney={showMoney} pendingTab="production" />

      <div className="mt-6">{children}</div>
    </div>
  );
}
