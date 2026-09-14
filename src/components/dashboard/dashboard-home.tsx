"use client";

import { trpc } from "@/lib/trpc";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { permAllows } from "@/lib/permissions";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeView } from "@/components/dashboard/home/home-view";

/* ============================================================
   หน้าแรก (รื้อ 2026-09-14 ตามต้นแบบที่เบสเคาะ · records/projects/anajak-erp/mockup-home-minimal-2026-09-14.html)

   ตัวเลขทั้งหมดมาจาก analytics.dashboard (ของเดิม) + analytics.homeOverview (ใหม่)
   เงินเห็นเฉพาะ see_finance เหมือน dashboard เดิม · ตัววาด (HomeView) รับ props ล้วน
   จึงลองดูด้วยข้อมูลจำลองได้โดยไม่ต้องล็อกอิน
   ============================================================ */

function HomeSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]">
        <Skeleton className="h-96 rounded-2xl" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function DashboardHome() {
  const dashboardQuery = trpc.analytics.dashboard.useQuery();
  const overviewQuery = trpc.analytics.homeOverview.useQuery(undefined, { refetchInterval: 60_000 });
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const dashboard = dashboardQuery.data;
  const overview = overviewQuery.data;

  const canSeeMoney = permAllows(me?.permissions, "see_finance");
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);

  const loading = dashboardQuery.isLoading || overviewQuery.isLoading || meQuery.isLoading;
  const error =
    dashboardQuery.isError || overviewQuery.isError || meQuery.isError || (!loading && (!dashboard || !overview || !me));

  const retry = () => {
    void dashboardQuery.refetch();
    void overviewQuery.refetch();
    void meQuery.refetch();
  };

  return (
    <PageShell
      className="mx-auto max-w-7xl"
      title="ภาพรวมวันนี้"
      header={<div className="sr-only">ภาพรวมวันนี้</div>}
      loading={loading}
      skeleton={<HomeSkeleton />}
      error={error ? { message: "โหลดหน้าแรกไม่สำเร็จ", onRetry: retry } : null}
    >
      {dashboard && overview ? (
        <HomeView
          metrics={{
            activeOrders: dashboard.activeOrders,
            completedThisMonth: dashboard.completedThisMonth,
            totalCustomers: dashboard.totalCustomers,
            newCustomersThisMonth: dashboard.newCustomersThisMonth,
            revenueThisMonth: canSeeMoney ? dashboard.revenueThisMonth : null,
            openSteps: overview.facts.todayQueue.open,
          }}
          overview={overview}
          canSeeMoney={canSeeMoney}
          canCreateOrder={canCreateOrder}
        />
      ) : null}
    </PageShell>
  );
}
