"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { cn, formatCurrency } from "@/lib/utils";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { BarChart3, Coins, Shirt, ShoppingCart, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable } from "@/components/ui/data-table";
import { c } from "@/components/kit/kit";



export default function AnalyticsPage() {
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  // ปิด query ที่ role ไม่มีสิทธิ์ — กันยิงไปโดน FORBIDDEN + retry ฟรี 3 รอบ
  const canViewRevenue = me ? permAllows(me.permissions, "see_finance") : false;

  const {
    data: dashboard,
    isLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = trpc.analytics.dashboard.useQuery();
  const { data: printMix, isLoading: printMixLoading } = trpc.analytics.printTypeMix.useQuery({ months: 6 });
  // ช่องตัวเลขช่องที่ 3 ของต้นแบบ = จำนวนตัวของเดือนนี้ · months: 1 = ตั้งแต่ต้นเดือน (input เดิมของ API)
  const { data: printMixThisMonth, isLoading: printMixThisMonthLoading } =
    trpc.analytics.printTypeMix.useQuery({ months: 1 });
  const {
    data: revenueData,
    isLoading: revenueLoading,
    isError: revenueError,
    refetch: refetchRevenue,
  } = trpc.analytics.revenueByMonth.useQuery(
    { months: 6 },
    { enabled: canViewRevenue }
  );

  const maxRevenue = Math.max(
    ...((revenueData ?? []).map((r) => r.revenue) ?? [1]),
    1
  );

  return (
    <PageShell
      title="รายงาน"
      meta="ภาพรวมยอดขายและลูกค้า 6 เดือนล่าสุด"
      loading={isLoading || meQuery.isLoading}
      skeleton={
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      }
      // เฉพาะ query แกนหน้าพัง → error ทั้งหน้า · กราฟรายได้พังแยกเป็นราย section
      // ด้านล่าง (เหมือน audit log) — ไม่ดับสถิติส่วนที่ยังโหลดได้ (review จับ)
      error={
        meQuery.isError && !me
          ? { message: "โหลดสิทธิ์รายงานไม่สำเร็จ", onRetry: () => meQuery.refetch() }
          : dashboardError
          ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetchDashboard() }
          : null
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          loading={isLoading}
          moduleTone="finance"
          title="ยอดขายเดือนนี้"
          value={canViewRevenue ? formatCurrency(dashboard?.revenueThisMonth ?? 0) : "—"}
          icon={Coins}
          // เทียบเดือนก่อนเป็นลูกศร+สี ทศนิยม 1 ตำแหน่ง (StatCard คุมให้) ไม่ใช่ข้อความจางทศนิยมยาว
          change={
            canViewRevenue && typeof dashboard?.revenueChange === "number"
              ? dashboard.revenueChange
              : undefined
          }
          changeSuffix="จากเดือนก่อน"
        />
        <StatCard
          loading={isLoading}
          moduleTone="brand"
          title="ออเดอร์ที่กำลังเดิน"
          value={dashboard?.activeOrders ?? 0}
          icon={ShoppingCart}
          caption="ออเดอร์"
        />
        {/* สองช่องท้ายไม่ใส่สีหมวด — ต้นแบบให้กล่องไอคอนเป็นเทา สีไปอยู่กับสองช่องแรกที่เป็นเงินกับงานเข้า */}
        <StatCard
          loading={printMixThisMonthLoading}
          title="ตัวที่สั่งผลิตเดือนนี้"
          value={(printMixThisMonth?.total ?? 0).toLocaleString("th-TH")}
          icon={Shirt}
          caption="ตัว"
        />
        <StatCard
          loading={isLoading}
          title="ลูกค้าทั้งหมด"
          value={dashboard?.totalCustomers ?? 0}
          icon={Users}
          caption={`ใหม่เดือนนี้ ${(dashboard?.newCustomersThisMonth ?? 0).toLocaleString("th-TH")}`}
        />
      </div>

      <Section
        title="ยอดขาย 6 เดือนย้อนหลัง"
        icon={BarChart3}
        tone="finance"
        bordered
        // ตัวเลขบนแท่งเป็นหลักพัน — หน่วยต้องอยู่บนจอ ไม่ใช่ให้เดาเอง
        action={canViewRevenue ? <span className={c("chip gray")}>พันบาท</span> : undefined}
      >
        {!canViewRevenue ? (
          <p className="text-sm text-muted">
            ต้องมีสิทธิ์ &quot;เห็นทุน/กำไร/รายงานการเงิน&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้
          </p>
        ) : revenueLoading ? (
          <div role="status" aria-label="กำลังโหลดรายได้รายเดือน" className="space-y-4">
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}
          </div>
        ) : revenueError ? (
          <QueryError
            message="โหลดข้อมูลรายได้ไม่สำเร็จ"
            onRetry={() => refetchRevenue()}
          />
        ) : !revenueData || revenueData.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีข้อมูล</p>
        ) : (
          <div
            className="flex min-h-40 items-end gap-2.5 pt-2"
            role="img"
            aria-label="ยอดขายรายเดือน 6 เดือนล่าสุด หน่วยพันบาท"
          >
            {revenueData.map((item, index) => {
              // ฐานแท่ง 20px แบบต้นแบบ — เดือนที่ยอดน้อยยังเห็นเป็นแท่ง ไม่ใช่ขีดบาง ๆ
              const height = maxRevenue > 0 ? 20 + (item.revenue / maxRevenue) * 130 : 20;
              const latest = index === revenueData.length - 1;
              return (
                <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs tabular-nums text-secondary">
                    {Math.round(item.revenue / 1000).toLocaleString("th-TH")}
                  </span>
                  {/* สีแท่ง = --accent ของชุดกลาง (สลับเฉดเองในโหมดมืด ต่างจาก bg-blue-500 ที่ค้างเฉดเดียว) · เดือนล่าสุดทึบกว่า */}
                  <span
                    className={cn(
                      "w-full max-w-[46px] rounded-t-[10px] rounded-b bg-[var(--accent)] transition-[height] duration-[var(--duration-base)] ease-out",
                      latest ? "opacity-100" : "opacity-90"
                    )}
                    style={{ height: `${height}px` }}
                  />
                  <span className="truncate text-xs text-muted">{item.month}</span>
                  <span className="text-xs tabular-nums text-muted">{item.orders} ใบ</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ต้นแบบวางสองการ์ดล่างสัดส่วน 7:5 ไม่ใช่ครึ่งต่อครึ่ง */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Section title="ลูกค้ายอดสูงสุด" icon={Users} tone="brand" bordered>
          {!dashboard?.topCustomers || dashboard.topCustomers.length === 0 ? (
            <p className="text-sm text-muted">
              {canViewRevenue
                ? "ยังไม่มีข้อมูล"
                : "ต้องมีสิทธิ์ 'เห็นทุน/กำไร/รายงานการเงิน'"}
            </p>
          ) : (
            <DataTable.Root bordered={false} cellPadding="compact">
              <DataTable.Head>
                <tr>
                  <DataTable.Th>ลูกค้า</DataTable.Th>
                  <DataTable.Th align="right">ออเดอร์</DataTable.Th>
                  <DataTable.Th align="right">ยอดสะสม</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {dashboard.topCustomers.map((customer) => (
                  <DataTable.Row key={customer.id} href={`/customers/${customer.id}`}>
                    <DataTable.Td>
                      {/* ลิงก์จริงในแถว = ทางของคีย์บอร์ดและการเปิดแท็บใหม่ (ทั้งแถวกดได้อยู่แล้ว) */}
                      <Link
                        href={`/customers/${customer.id}`}
                        className={cn("block min-w-0 rounded-lg", FOCUS_BUTTON)}
                      >
                        <span className="block truncate font-medium text-strong">{customer.name}</span>
                        {customer.company && (
                          <span className="block truncate text-xs text-muted">{customer.company}</span>
                        )}
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td align="right" className="tabular-nums">
                      {customer.totalOrders.toLocaleString("th-TH")}
                    </DataTable.Td>
                    <DataTable.Td align="right" className="font-medium tabular-nums text-strong">
                      {formatCurrency(customer.totalSpent)}
                    </DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable.Root>
          )}
        </Section>

        <Section title="งานที่ขายดี" icon={Shirt} bordered>
          {printMixLoading ? (
            <div role="status" aria-label="กำลังโหลดสัดส่วนงาน" className="space-y-3">
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-6 w-full" />)}
            </div>
          ) : !printMix || printMix.rows.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีงานในช่วง 6 เดือนล่าสุด</p>
          ) : (
            <DataTable.Root bordered={false} cellPadding="compact">
              <DataTable.Head>
                <tr>
                  <DataTable.Th>ประเภทงาน</DataTable.Th>
                  <DataTable.Th align="right">ตัว</DataTable.Th>
                  <DataTable.Th align="right">สัดส่วน</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {printMix.rows.map((row) => (
                  <DataTable.Row key={row.type}>
                    <DataTable.Td className="text-strong">{row.label}</DataTable.Td>
                    <DataTable.Td align="right" className="tabular-nums">
                      {row.quantity.toLocaleString("th-TH")}
                    </DataTable.Td>
                    <DataTable.Td align="right" className="whitespace-nowrap tabular-nums">
                      {/* แถบสั้นติดกับตัวเลข % ท้ายแถวตามต้นแบบ ไม่ใช่แถบยาวกินกลางแถว */}
                      <span className="mr-1.5 inline-block h-1.5 w-[70px] overflow-hidden rounded-full bg-[var(--line)] align-middle">
                        <span
                          className="block h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${row.share}%` }}
                        />
                      </span>
                      {row.share}%
                    </DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable.Root>
          )}
        </Section>
      </div>
    </PageShell>
  );
}
