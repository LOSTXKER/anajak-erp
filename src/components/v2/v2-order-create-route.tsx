"use client";

import OrderCreatePage from "@/components/orders/new/order-create-page";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { canAccessV2OrderCreate } from "@/lib/v2-order-access";

export function V2OrderCreateRoute() {
  const meQuery = trpc.user.me.useQuery();
  const canCreateOrder = canAccessV2OrderCreate(meQuery.data?.permissions);

  if (canCreateOrder) {
    return (
      <OrderCreatePage
        ordersBasePath="/v2/orders"
        stickyActionsOffset="v2"
      />
    );
  }

  return (
    <PageShell
      width="wide"
      breadcrumb={[
        { label: "ออเดอร์", href: "/v2/orders" },
        { label: "เปิดงานใหม่" },
      ]}
      title="เปิดงานใหม่"
      loading={meQuery.isLoading}
      skeleton={
        <div role="status" aria-label="กำลังตรวจสอบสิทธิ์" className="space-y-4">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      }
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์เปิดออเดอร์ไม่ได้",
              onRetry: () => void meQuery.refetch(),
            }
          : null
      }
      denied={
        !meQuery.isLoading &&
        !meQuery.isError && {
          title: "ไม่มีสิทธิ์เปิดออเดอร์",
          description:
            "หน้านี้มีข้อมูลราคา จึงต้องมีทั้งสิทธิ์สร้างเอกสารขายและสิทธิ์เห็นเงิน",
        }
      }
    >
      <div />
    </PageShell>
  );
}
