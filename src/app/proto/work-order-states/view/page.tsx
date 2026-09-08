"use client";

/** หน้าเต็มสำหรับหน้าต่างมือถือ 390 — อ่านสถานะ/บทบาทจาก URL เหมือนหน้าหลัก */
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { WorkOrderView } from "@/components/production/work-order-page";
import type { RouterOutput } from "@/lib/trpc";

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { useProtoController } from "../_controller";
import { DEFAULT_STATE, ORDER_ITEMS, STATE_KEYS, stateOf } from "../_fixtures";

export default function WorkOrderStateView() {
  const [key] = useProtoVariant("s", STATE_KEYS, DEFAULT_STATE);
  const [boss] = useProtoFlag("boss", true);
  const fx = stateOf(key);
  const c = useProtoController(fx, boss ? "boss" : "staff");
  return (
    <WorkOrderView
      key={`${key}:${boss ? "boss" : "staff"}`}
      c={c}
      scannedMockup={fx.flags?.scannedMockup ?? Number.NaN}
      itemsTab={
        <>
          <OrderItemsDisplay orderId={fx.order.orderNumber} items={ORDER_ITEMS as RouterOutput["order"]["getById"]["items"]} fees={[]} showMoney={false} canEditReceiveTracking={false} />
          <ProductionDesignCard order={fx.order} />
        </>
      }
    />
  );
}
