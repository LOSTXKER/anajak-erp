import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Factory, ReceiptText, ShoppingCart, Users } from "lucide-react";
import { cn, formatBaht } from "@/lib/utils";
import { HomeChip, HomeIconTile, type HomeTone } from "./home-card";
import styles from "./home.module.css";

interface MetricTileProps {
  label: string;
  icon: LucideIcon;
  tone?: HomeTone;
  value: string;
  unit?: string;
  chip?: string;
  money?: boolean;
}

function MetricTile({ label, icon, tone = "neutral", value, unit, chip, money }: MetricTileProps) {
  return (
    <div className={styles.metric}>
      <p className={styles.metricLabel}>
        <HomeIconTile icon={icon} tone={tone} />
        <span className="truncate">{label}</span>
      </p>
      <p className={styles.metricValue}>
        <strong className={cn(money && styles.metricMoney)}>{value}</strong>
        {unit ? <small>{unit}</small> : null}
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
    <div className={styles.metrics} aria-label="ภาพรวม">
      <MetricTile label="ออเดอร์กำลังเดิน" icon={ShoppingCart} tone="brand" value={count(data.activeOrders)} unit="ออเดอร์" />
      <MetricTile label="ปิดงานเดือนนี้" icon={CheckCircle2} tone="success" value={count(data.completedThisMonth)} unit="ออเดอร์" />
      <MetricTile
        label="ลูกค้าทั้งหมด"
        icon={Users}
        value={count(data.totalCustomers)}
        chip={data.newCustomersThisMonth > 0 ? `+${count(data.newCustomersThisMonth)} เดือนนี้` : undefined}
      />
      {data.revenueThisMonth !== null ? (
        <MetricTile label="มูลค่าออเดอร์ที่เปิดเดือนนี้" icon={ReceiptText} tone="finance" value={formatBaht(data.revenueThisMonth)} money />
      ) : (
        <MetricTile label="ขั้นผลิตค้างทั้งหมด" icon={Factory} tone="brand" value={count(data.openSteps)} unit="ขั้น" />
      )}
    </div>
  );
}
