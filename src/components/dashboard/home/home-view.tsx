"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BANGKOK_TZ } from "@/lib/utils";
import type { HomeOverview } from "@/server/services/home-overview";
import { ActiveOrdersCard } from "./active-orders-card";
import { FactoryFlowCard } from "./factory-flow-card";
import { HomeMetrics, type HomeMetricsData } from "./home-metrics";
import { MoneyCard } from "./money-card";
import { WeekCard } from "./week-card";

const DAY_MS = 24 * 60 * 60 * 1000;
const longDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BANGKOK_TZ,
});
const shortDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: BANGKOK_TZ });

export interface HomeViewProps {
  metrics: HomeMetricsData;
  overview: HomeOverview;
  canSeeMoney: boolean;
  canCreateOrder: boolean;
}

/** หน้าแรกตามต้นแบบ 2026-09-14: หัวไม่มีกรอบ → ตัวเลข 4 ช่อง → ผังโรงงาน+สุขภาพ → ออเดอร์ | กำหนดส่ง/เงิน */
export function HomeView({ metrics, overview, canSeeMoney, canCreateOrder }: HomeViewProps) {
  const [day, setDay] = useState<number | null>(null);
  const now = new Date(overview.generatedAt);
  const dayLabel = day === null ? null : day === 0 ? "วันนี้" : shortDate.format(new Date(now.getTime() + day * DAY_MS));

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-strong">ภาพรวมวันนี้</h1>
          <p className="mt-1 text-sm text-muted">{longDate.format(now)}</p>
        </div>
        {canCreateOrder ? (
          <Button asChild>
            <Link href="/orders/new">
              <Plus />
              เปิดงานใหม่
            </Link>
          </Button>
        ) : null}
      </div>

      <HomeMetrics data={metrics} />

      <FactoryFlowCard counts={overview.nodes} facts={overview.facts} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]">
        <ActiveOrdersCard
          orders={overview.orders}
          canSeeMoney={canSeeMoney}
          canCreateOrder={canCreateOrder}
          dayFilter={day}
          dayLabel={dayLabel}
          onClearDay={() => setDay(null)}
        />
        <div className="grid content-start gap-4">
          <WeekCard week={overview.week} now={now} selected={day} onSelect={setDay} />
          {overview.money ? <MoneyCard money={overview.money} /> : null}
        </div>
      </div>
    </div>
  );
}
