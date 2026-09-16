import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Factory, ReceiptText, ShoppingCart, Users } from "lucide-react";
import { c, type Tone } from "@/components/kit/kit";

/** ช่องตัวเลข (.tile ของต้นแบบ metricsHTML) — chip ประกอบอยู่บรรทัดที่ 3 (.tfo) ใต้ตัวเลข ไม่แย่งที่กับตัวเลข */
function Tile({
  label,
  icon: Icon,
  tone = "",
  value,
  unit,
  chip,
  mono = false,
}: {
  label: string;
  icon: LucideIcon;
  tone?: Tone;
  value: string;
  unit?: string;
  chip?: string;
  mono?: boolean;
}) {
  return (
    <div className={c("tile")}>
      <div className={c("lab")}>
        <span className={c("ic", tone)} aria-hidden="true">
          <Icon />
        </span>
        {label}
      </div>
      <div className={c("val")}>
        <b className={c("num", mono && "mono")}>{value}</b>
        {unit ? <small>{unit}</small> : null}
      </div>
      {chip ? (
        <span className={c("tfo")}>
          <span className={c("chip good")}>{chip}</span>
        </span>
      ) : null}
    </div>
  );
}

/** เงินบนช่องตัวเลขใหญ่ — ตัดทศนิยมให้อ่านเร็ว (moneyT ของต้นแบบ) · เอกสาร/ตารางยังใช้ formatBaht เต็มทศนิยม */
const moneyTile = (amount: number) => `฿${amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

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
    <section className={c("metrics")} aria-label="ภาพรวม">
      <Tile label="ออเดอร์กำลังเดิน" icon={ShoppingCart} tone="blue" value={count(data.activeOrders)} unit="ออเดอร์" />
      <Tile label="ปิดงานเดือนนี้" icon={CheckCircle2} tone="good" value={count(data.completedThisMonth)} unit="ออเดอร์" />
      <Tile
        label="ลูกค้าทั้งหมด"
        icon={Users}
        value={count(data.totalCustomers)}
        chip={data.newCustomersThisMonth > 0 ? `+${count(data.newCustomersThisMonth)} เดือนนี้` : undefined}
      />
      {data.revenueThisMonth !== null ? (
        <Tile label="มูลค่าออเดอร์ที่เปิดเดือนนี้" icon={ReceiptText} tone="violet" value={moneyTile(data.revenueThisMonth)} mono />
      ) : (
        <Tile label="ขั้นผลิตค้างทั้งหมด" icon={Factory} tone="blue" value={count(data.openSteps)} unit="ขั้น" />
      )}
    </section>
  );
}
