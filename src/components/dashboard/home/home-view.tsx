"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { c } from "@/components/kit/kit";
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

/* ============================================================
   หน้าแรก — ต้นแบบ newViewHTML() ของ mockup-home-minimal-2026-09-14.html รอบ 4 บนชุดหน้าตากลาง (components/kit)
   หัวไม่มีกรอบ → ตัวเลข 4 ช่อง → ผังโรงงาน+สุขภาพ → ออเดอร์ที่กำลังเดิน | กำหนดส่ง 7 วัน + เงินที่ต้องตาม
   ตัวเลขทั้งหมดมาจาก analytics.dashboard + analytics.homeOverview · ตัววาดรับ props ล้วน
   ============================================================ */
export function HomeView({ metrics, overview, canSeeMoney, canCreateOrder }: HomeViewProps) {
  const [day, setDay] = useState<number | null>(null);
  const now = new Date(overview.generatedAt);
  const dayLabel = day === null ? null : day === 0 ? "วันนี้" : shortDate.format(new Date(now.getTime() + day * DAY_MS));

  return (
    <div className={c("tokens page home")}>
      <div className={c("head")}>
        <div>
          <h1>ภาพรวมวันนี้</h1>
          <p className={c("date")}>{longDate.format(now)}</p>
        </div>
        {canCreateOrder ? (
          <Link href="/orders/new" className={c("btn primary")}>
            <Plus aria-hidden="true" />
            เปิดงานใหม่
          </Link>
        ) : null}
      </div>

      <HomeMetrics data={metrics} />

      <FactoryFlowCard counts={overview.nodes} facts={overview.facts} />

      <div className={c("split")}>
        <ActiveOrdersCard
          orders={overview.orders}
          canSeeMoney={canSeeMoney}
          canCreateOrder={canCreateOrder}
          dayFilter={day}
          dayLabel={dayLabel}
          onClearDay={() => setDay(null)}
        />
        <div className={c("col")}>
          <WeekCard week={overview.week} now={now} selected={day} onSelect={setDay} />
          {canSeeMoney && overview.money ? <MoneyCard money={overview.money} /> : null}
        </div>
      </div>
    </div>
  );
}
