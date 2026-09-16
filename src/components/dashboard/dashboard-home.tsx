"use client";

import { trpc } from "@/lib/trpc";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { permAllows } from "@/lib/permissions";
import { PageShell } from "@/components/page-shell";
import { c } from "@/components/kit/kit";
import { HomeView } from "@/components/dashboard/home/home-view";

/* ============================================================
   หน้าแรก (ต้นแบบที่เบสเคาะ · records/projects/anajak-erp/mockup-home-minimal-2026-09-14.html)
   หน้าตาอยู่ชุดกลาง components/kit เหมือนหน้าออเดอร์ (refactor 2026-09-15)

   ตัวเลขทั้งหมดมาจาก analytics.dashboard (ของเดิม) + analytics.homeOverview (ใหม่)
   เงินเห็นเฉพาะ see_finance เหมือน dashboard เดิม · ตัววาด (HomeView) รับ props ล้วน
   จึงลองดูด้วยข้อมูลจำลองได้โดยไม่ต้องล็อกอิน
   ============================================================ */

function HomeSkeleton() {
  return (
    <div className={c("tokens page home")} role="status" aria-label="กำลังโหลดหน้าแรก">
      <span className={c("sk")} style={{ height: 56, width: "40%" }} />
      <div className={c("metrics")}>
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={c("sk")} style={{ height: 112 }} />
        ))}
      </div>
      <span className={c("sk")} style={{ height: 360 }} />
      <div className={c("two")}>
        <span className={c("sk")} style={{ height: 380 }} />
        <div className={c("col")}>
          <span className={c("sk")} style={{ height: 180 }} />
          <span className={c("sk")} style={{ height: 150 }} />
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
