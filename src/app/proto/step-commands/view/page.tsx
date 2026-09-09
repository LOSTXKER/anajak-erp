"use client";

/** หน้าเต็มสำหรับหน้าต่างมือถือ 390 — อ่านทาง/สถานะ/บทบาทจาก URL เหมือนหน้าหลัก */
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { WorkOrderView, type StepCommandPlacement } from "@/components/production/work-order-page";
import type { RouterOutput } from "@/lib/trpc";

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { useProtoController } from "../../work-order-states/_controller";
import { ORDER_ITEMS, stateOf } from "../../work-order-states/_fixtures";

const WAY_KEYS = ["header", "step", "split"] as const;
const SHOWN = ["start", "doing", "hold", "problem", "reopen", "outsource-shop", "receive", "all-done"] as const;

export default function StepCommandsView() {
  const [way] = useProtoVariant("v", WAY_KEYS, "header");
  const [key] = useProtoVariant("s", SHOWN as unknown as readonly string[], "start");
  const [boss] = useProtoFlag("boss", true);
  const fx = stateOf(key);
  const c = useProtoController(fx, boss ? "boss" : "staff");
  return (
    <WorkOrderView
      key={`${way}:${key}:${boss ? "boss" : "staff"}`}
      c={c}
      commands={way as StepCommandPlacement}
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
