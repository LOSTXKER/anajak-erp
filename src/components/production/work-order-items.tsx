import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialUsage } from "@/components/material-usage";
import { ProductionDesignCard } from "./production-design-card";
import type { ProductionDetail, ProductionStep } from "./types";
import type { WorkOrderController } from "./work-order-controller";
import { trpc } from "@/lib/trpc";

export function WorkOrderItems({ production, order, current, c }: { production: ProductionDetail; order: ProductionDetail["order"]; current: ProductionStep | null; c: WorkOrderController }) {
  return (
    <>
      <ProductsTab orderId={order.id} />
      <ProductionDesignCard order={order} focusStepType={current?.stepType} />
      <MaterialUsage productionId={production.id} orderNumber={order.orderNumber} showCosts={c.canSeeCost} readOnly={!c.canUpdateStep} embedded />
    </>
  );
}

/* ───────────────────────── แท็บสินค้า — ตารางรายการตัวเดียวกับหน้าออเดอร์ ───────────────────────── */

function ProductsTab({ orderId }: { orderId: string }) {
  const q = trpc.order.getById.useQuery({ id: orderId });
  if (!q.data && (q.isLoading || q.isFetching)) return <Skeleton className="h-64 rounded-2xl" />;
  if (!q.data) return <QueryError message="โหลดรายการสินค้าไม่สำเร็จ" onRetry={() => void q.refetch()} />;
  return <OrderItemsDisplay orderId={orderId} items={q.data.items} fees={q.data.fees} showMoney={false} canEditReceiveTracking={false} />;
}
