"use client";

/**
 * /production/metrics — หน้า "ตัวชี้วัด" (ต้นแบบ mockup-production-calm-2026-09-15 · เบสสั่งลงจริง 2026-09-16)
 * ตัวเลข 4 ช่อง (สูตรอยู่ในไอคอน ⓘ) · ส่งตรงเวลา 6 เดือนเทียบเป้า 90% · ของเสียตามสาเหตุ/ไซซ์ · เวลาเฉลี่ยต่อขั้น · ส่งช้าในเดือน
 * ข้อมูลจาก analytics.productionMetrics (อ่านอย่างเดียว ไม่มีเงิน) — ช่องที่ยังไม่มีข้อมูลขึ้น "—" ไม่เดาตัวเลข
 */

import { Suspense, useState, type ReactNode } from "react";
import { CalendarCheck, CircleX, ClockAlert, Info, Timer } from "lucide-react";

import { trpc, type RouterOutput } from "@/lib/trpc";
import { PageShell } from "@/components/page-shell";
import { c, CardHead } from "@/components/kit/kit";
import { Seg } from "@/components/kit/seg";
import { ProductionModuleHead } from "@/components/production/production-module-head";

type Metrics = RouterOutput["analytics"]["productionMetrics"];
const TARGET = 90;

function Delta({ now, prev, unit, lowerIsBetter = false, prevLabel }: { now: number | null; prev: number | null; unit: string; lowerIsBetter?: boolean; prevLabel: string | null }) {
  if (now === null || prev === null || !prevLabel) return <span className={c("f")}>&nbsp;</span>;
  const diff = Math.round((now - prev) * 10) / 10;
  if (diff === 0) return <span className={c("f")}>เท่ากับ {prevLabel}</span>;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <span className={c("f")}>
      <span className={c(good ? "up" : "down")}>
        {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString("th-TH")}
        {unit}
      </span>{" "}
      จาก {prevLabel}
    </span>
  );
}

function Kpi({ label, formula, value, unit, delta }: { label: string; formula: string; value: string; unit?: string; delta: ReactNode }) {
  return (
    <div className={c("kpi")}>
      <span className={c("k")} title={formula}>
        {label}
        <span className={c("qi")} aria-label={formula} role="img">
          <Info aria-hidden="true" />
        </span>
      </span>
      <span className={c("v")}>
        <b>{value}</b>
        {unit ? <small>{unit}</small> : null}
      </span>
      {delta}
    </div>
  );
}

function TrendChart({ data, active }: { data: Metrics["trend"]; active: number }) {
  const W = 520;
  const H = 210;
  const x0 = 36;
  const x1 = 510;
  const y0 = 20;
  const y1 = 172;
  const y = (v: number) => y1 - (v / 100) * (y1 - y0);
  const step = (x1 - x0) / data.length;
  const bw = 40;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`ส่งตรงเวลา 6 เดือน ${data.map((m) => `${m.label} ${m.percent ?? "ไม่มีข้อมูล"}${m.percent === null ? "" : "%"}`).join(", ")}`}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line className={c("gl")} x1={x0} x2={x1} y1={y(v)} y2={y(v)} />
          <text className={c("ax")} x={x0 - 8} y={y(v) + 4} textAnchor="end">
            {v}%
          </text>
        </g>
      ))}
      {data.map((m, index) => {
        const cx = x0 + step * index + step / 2;
        return (
          <g key={m.key}>
            {m.percent !== null ? (
              <>
                <rect className={c("bar", index === active && "now")} x={cx - bw / 2} y={y(m.percent)} width={bw} height={Math.max(0, y1 - y(m.percent))} rx={6} />
                <text className={c("val")} x={cx} y={y(m.percent) - 6}>
                  {m.percent}%
                </text>
              </>
            ) : (
              <text className={c("ax")} x={cx} y={y1 - 6} textAnchor="middle">
                —
              </text>
            )}
            <text className={c("ax")} x={cx} y={H - 14} textAnchor="middle">
              {m.label}
            </text>
          </g>
        );
      })}
      <line className={c("tgt")} x1={x0} x2={x1} y1={y(TARGET)} y2={y(TARGET)} />
      <text className={c("tgtl")} x={x0 + 4} y={y(TARGET) - 6} textAnchor="start">
        เป้า {TARGET}%
      </text>
    </svg>
  );
}

function MetricsView({ data, monthIndex, onMonth }: { data: Metrics; monthIndex: number; onMonth: (index: number) => void }) {
  const prevLabel = monthIndex > 0 ? (data.months[monthIndex - 1]?.label ?? null) : null;
  const maxDefect = Math.max(1, ...data.defects.byReason.map((r) => r.qty));
  const pct = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("th-TH")}%`);
  return (
    <div className={c("tokens page mfg")}>
      <ProductionModuleHead
        active="metrics"
        title="ตัวชี้วัดการผลิต"
        actions={
          <Seg
            label="เลือกเดือน"
            options={data.months.map((m) => ({ key: String(m.index), label: m.label }))}
            value={String(monthIndex)}
            onChange={(key) => onMonth(Number(key))}
          />
        }
      />

      <section className={c("kpis")} aria-label={`ตัวเลขหลักเดือน ${data.month.label}`}>
        <Kpi
          label="ส่งตรงเวลา"
          formula={`วันส่งจริงเทียบกำหนดส่ง · ${data.onTime.onTime} จาก ${data.onTime.counted} ออเดอร์ (ไม่นับที่ไม่มีกำหนดส่ง)`}
          value={pct(data.onTime.percent)}
          delta={<Delta now={data.onTime.percent} prev={data.onTime.previousPercent} unit="" prevLabel={prevLabel} />}
        />
        <Kpi
          label="ทำถูกตั้งแต่ครั้งแรก"
          formula={`ตัวดี ÷ (ตัวดี + ตัวเสีย) จากผลตรวจ QC · ${data.firstPass.good.toLocaleString("th-TH")} จาก ${data.firstPass.total.toLocaleString("th-TH")} ตัว`}
          value={pct(data.firstPass.percent)}
          delta={<Delta now={data.firstPass.percent} prev={data.firstPass.previousPercent} unit="" prevLabel={prevLabel} />}
        />
        <Kpi
          label="ของเสีย"
          formula="รวมตัวเสียจากผลตรวจ QC ในเดือน"
          value={data.defects.total.toLocaleString("th-TH")}
          unit="ตัว"
          delta={<Delta now={data.defects.total} prev={data.defects.previousTotal} unit="" lowerIsBetter prevLabel={prevLabel} />}
        />
        <Kpi
          label="เปิดใบผลิต → ครบทุกขั้น"
          formula={`เฉลี่ยจากใบผลิตที่ปิดขั้นสุดท้ายในเดือน · ${data.cycleDays.count} ใบ`}
          value={data.cycleDays.average === null ? "—" : data.cycleDays.average.toLocaleString("th-TH")}
          unit={data.cycleDays.average === null ? undefined : "วันเฉลี่ย"}
          delta={<span className={c("f")}>&nbsp;</span>}
        />
      </section>

      <div className={c("two eq")}>
        <section className={c("card")} aria-labelledby="mt-trend-h">
          <CardHead icon={CalendarCheck} tone="good" id="mt-trend-h" title="ส่งตรงเวลา 6 เดือน" />
          <div className={c("chart")}>
            <TrendChart data={data.trend} active={monthIndex} />
          </div>
        </section>
        <section className={c("card")} aria-labelledby="mt-defect-h">
          <CardHead
            icon={CircleX}
            tone="bad"
            id="mt-defect-h"
            title="ของเสียแยกตามสาเหตุ"
            right={<span className={c("chip gray")}>{data.defects.total.toLocaleString("th-TH")} ตัว</span>}
          />
          <div className={c("cb")}>
            {data.defects.byReason.length > 0 ? (
              <>
                <ul className={c("hbars")}>
                  {data.defects.byReason.map((reason) => (
                    <li key={reason.reason}>
                      <span className={c("lb")} title={reason.label}>
                        {reason.label}
                      </span>
                      <span className={c("tr")} aria-hidden="true">
                        <i style={{ width: `${(reason.qty / maxDefect) * 100}%` }} />
                      </span>
                      <span className={c("n")}>{reason.qty.toLocaleString("th-TH")}</span>
                    </li>
                  ))}
                </ul>
                <div className={c("hr")} />
                <div className={c("sub-h")}>
                  <h3>แยกตามไซซ์</h3>
                </div>
                <div className={c("sizes")}>
                  {data.defects.bySize.map((size) => (
                    <span key={size.size}>
                      {size.size}
                      <b>{size.qty.toLocaleString("th-TH")}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className={c("mempty")}>ไม่มีของเสียในเดือนนี้</p>
            )}
          </div>
        </section>
      </div>

      <div className={c("two")}>
        <section className={c("card")} aria-labelledby="mt-step-h">
          <CardHead icon={Timer} tone="blue" id="mt-step-h" title="เวลาเฉลี่ยต่อขั้น" />
          {data.stepTimes.length > 0 ? (
            <div className={c("tblw")}>
              <table className={c("orders simple")}>
                <caption className={c("sr")}>เวลาเฉลี่ยต่อขั้นในเดือน {data.month.label}</caption>
                <thead>
                  <tr>
                    <th scope="col">ขั้น</th>
                    <th scope="col" className={c("r")}>เวลาเฉลี่ย</th>
                    <th scope="col" className={c("r")}>นับจาก</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stepTimes.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className={c("qty r")}>
                        <b>{row.value.toLocaleString("th-TH")}</b>
                        <small>{row.unit}</small>
                      </td>
                      <td className={c("qty r")}>
                        {row.count.toLocaleString("th-TH")}
                        <small>ครั้ง</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={c("cb")}>
              <p className={c("mempty")}>ยังไม่มีขั้นที่กดเริ่มและปิดในเดือนนี้</p>
            </div>
          )}
        </section>
        <section className={c("card")} aria-labelledby="mt-late-h">
          <CardHead
            icon={ClockAlert}
            tone="warn"
            id="mt-late-h"
            title="ส่งช้าเดือนนี้"
            right={<span className={c("chip warn")}>{data.late.length.toLocaleString("th-TH")}</span>}
          />
          <div className={c("cb")}>
            {data.late.length > 0 ? (
              <ol className={c("hist")}>
                {data.late.map((order) => (
                  <li key={order.orderNumber}>
                    <span className={c("d bad")} aria-hidden="true" />
                    <span className={c("tx")}>
                      <span className={c("mono")}>{order.orderNumber}</span>
                      <small>{order.customerName}</small>
                    </span>
                    <span className={c("m")}>
                      <b>ช้า {order.daysLate} วัน</b>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={c("mempty")}>ไม่มีออเดอร์ส่งช้า</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProductionMetrics() {
  const [monthIndex, setMonthIndex] = useState(5);
  const query = trpc.analytics.productionMetrics.useQuery({ monthIndex }, { placeholderData: (previous) => previous });
  return (
    <PageShell
      title="ตัวชี้วัดการผลิต"
      header={<div className="sr-only">ตัวชี้วัดการผลิต</div>}
      loading={query.isLoading}
      skeleton={
        <div className={c("tokens page mfg")} role="status" aria-label="กำลังโหลดตัวชี้วัด">
          <span className={c("sk")} style={{ height: 112 }} />
          <div className={c("kpis")}>
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className={c("sk")} style={{ height: 120 }} />
            ))}
          </div>
          <span className={c("sk")} style={{ height: 300 }} />
        </div>
      }
      error={query.isError && !query.data ? { message: "โหลดตัวชี้วัดไม่สำเร็จ", onRetry: () => void query.refetch() } : null}
    >
      {query.data ? <MetricsView data={query.data} monthIndex={monthIndex} onMonth={setMonthIndex} /> : null}
    </PageShell>
  );
}

export { MetricsView as ProductionMetricsView };

export function ProductionMetricsPage() {
  return (
    <Suspense fallback={null}>
      <ProductionMetrics />
    </Suspense>
  );
}
