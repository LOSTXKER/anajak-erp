import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Factory, ReceiptText, ShoppingCart, Users } from "lucide-react";
import { formatBaht } from "@/lib/utils";
import { HomeChip, HomeIconTile, type HomeTone } from "./home-card";

interface MetricTileProps {
  label: string;
  icon: LucideIcon;
  tone?: HomeTone;
  value: string;
  unit?: string;
  chip?: string;
}

function MetricTile({ label, icon, tone = "neutral", value, unit, chip }: MetricTileProps) {
  return (
    <div className="card-surface flex min-w-0 flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <p className="flex items-center gap-2.5 text-xs font-medium text-secondary">
        <HomeIconTile icon={icon} tone={tone} />
        <span className="truncate">{label}</span>
      </p>
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-strong">{value}</span>
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
        {chip ? <HomeChip tone="success">{chip}</HomeChip> : null}
      </p>
    </div>
  );
}

export interface HomeMetricsData {
  activeOrders: number;
  completedThisMonth: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  /** null = ไม่มีสิทธิ์เห็นเงิน → โชว์ขั้นผลิตค้างแทน */
  revenueThisMonth: number | null;
  openSteps: number;
}

export function HomeMetrics({ data }: { data: HomeMetricsData }) {
  const count = (value: number) => value.toLocaleString("th-TH");
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ภาพรวม">
      <MetricTile label="ออเดอร์กำลังเดิน" icon={ShoppingCart} tone="brand" value={count(data.activeOrders)} unit="ออเดอร์" />
      <MetricTile label="ปิดงานเดือนนี้" icon={CheckCircle2} tone="success" value={count(data.completedThisMonth)} unit="ออเดอร์" />
      <MetricTile
        label="ลูกค้าทั้งหมด"
        icon={Users}
        value={count(data.totalCustomers)}
        chip={data.newCustomersThisMonth > 0 ? `+${count(data.newCustomersThisMonth)} เดือนนี้` : undefined}
      />
      {data.revenueThisMonth !== null ? (
        <MetricTile label="มูลค่าออเดอร์ที่เปิดเดือนนี้" icon={ReceiptText} tone="finance" value={formatBaht(data.revenueThisMonth)} />
      ) : (
        <MetricTile label="ขั้นผลิตค้างทั้งหมด" icon={Factory} tone="brand" value={count(data.openSteps)} unit="ขั้น" />
      )}
    </div>
  );
}
