"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleGauge,
  Factory,
} from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { formatTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusLabel } from "@/components/ui/status-label";
import { ProductionFreshness } from "@/components/production/production-freshness";
import {
  FACTORY_CENTER_PAGE_INTERVAL_MS,
  factoryCenterPage,
} from "./manufacturing-factory-paging";

type WorkCenterLoad = RouterOutput["manufacturing"]["workCenterLoad"][number];

const CAPACITY_UNIT_LABEL: Record<string, string> = {
  PIECE: "ชิ้น/วัน",
  MINUTE: "นาที/วัน",
  BATCH: "รอบ/วัน",
};

export function ManufacturingFactoryBoard() {
  const loads = trpc.manufacturing.workCenterLoad.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const exceptions = trpc.manufacturing.exceptionList.useQuery(
    { state: "OPEN", limit: 12 },
    {
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  );
  const [now, setNow] = useState<number | null>(null);
  const [centerPage, setCenterPage] = useState(0);

  const centers = loads.data ?? [];
  const pagedCenters = factoryCenterPage(centers, centerPage);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = window.requestAnimationFrame(tick);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.cancelAnimationFrame(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (pagedCenters.pageCount <= 1) return;
    const timer = window.setInterval(() => {
      setCenterPage((current) => (current + 1) % pagedCenters.pageCount);
    }, FACTORY_CENTER_PAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pagedCenters.pageCount]);

  const hasData = Boolean(loads.data);
  const stale =
    (loads.isError && hasData) ||
    (exceptions.isError && Boolean(exceptions.data)) ||
    (now !== null && loads.dataUpdatedAt > 0 && now - loads.dataUpdatedAt > 120_000);

  if (loads.isLoading && !loads.data) {
    return (
      <main className="factory-board flex h-dvh min-h-[720px] flex-col gap-4 overflow-hidden p-5">
        <Skeleton className="h-16 rounded-lg" />
        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-full rounded-lg" />
          ))}
        </div>
      </main>
    );
  }

  if (loads.isError && !loads.data) {
    return (
      <main className="flex h-dvh items-center justify-center overflow-hidden p-6">
        <div className="max-w-xl rounded-lg bg-red-500/10 px-10 py-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-300" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-semibold">โหลดสถานะโรงงานไม่ได้</h1>
          <p className="mt-2 text-lg text-secondary">ระบบจะลองเชื่อมต่อใหม่ทุก 30 วินาที</p>
        </div>
      </main>
    );
  }

  const totals = centers.reduce(
    (sum, center) => ({
      running: sum.running + center.running,
      ready: sum.ready + center.ready,
      blocked: sum.blocked + center.blocked,
      overdue: sum.overdue + center.overdue,
    }),
    { running: 0, ready: 0, blocked: 0, overdue: 0 },
  );

  return (
    <main className="factory-board flex h-dvh min-h-[720px] flex-col gap-4 overflow-hidden p-5">
      <header className="flex min-h-16 items-center justify-between gap-5 border-b border-divider pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
            <Factory className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">สถานะโรงงาน</h1>
            <p className="text-base text-secondary">ภาพรวมอ่านอย่างเดียว · ข้อมูลเดียวกับ ERP และ Station</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <ProductionFreshness
            updatedAt={loads.dataUpdatedAt}
            isFetching={loads.isFetching && !loads.isLoading}
            stale={stale}
            liveSurface
          />
          <div>
            <p className="text-2xl font-semibold tabular-nums">{now ? formatTime(new Date(now)) : "--:--"}</p>
            {pagedCenters.pageCount > 1 ? (
              <p className="text-xs text-muted" aria-live="polite">
                ศูนย์งานหน้า {pagedCenters.page + 1}/{pagedCenters.pageCount} · เปลี่ยนอัตโนมัติ
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {stale ? (
        <Alert variant="warning">กำลังแสดง snapshot ล่าสุด ระบบจะลองเชื่อมต่อใหม่เอง</Alert>
      ) : null}

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" aria-label="ภาระงานโรงงาน">
        <div className="grid min-h-0 grid-cols-2 grid-rows-3 gap-4 lg:grid-cols-3 lg:grid-rows-2">
          {pagedCenters.items.map((center) => (
            <WorkCenterPanel key={center.workCenter.id} center={center} />
          ))}
          {centers.length === 0 ? (
            <div className="col-span-full row-span-full card-surface rounded-lg">
              <EmptyState icon={Boxes} title="ยังไม่มี Work Center" description="ตั้งจุดทำงานก่อนเปิดจอโรงงาน" />
            </div>
          ) : null}
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface" aria-labelledby="factory-attention-title">
          <div className="border-b border-divider p-4">
            <h2 id="factory-attention-title" className="text-xl font-semibold">ต้องดูตอนนี้</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Pulse label="กำลังทำ" value={totals.running} />
              <Pulse label="รอทำ" value={totals.ready} />
              <Pulse label="ติดปัญหา" value={totals.blocked} danger={totals.blocked > 0} />
              <Pulse label="เลยกำหนด" value={totals.overdue} danger={totals.overdue > 0} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden="true" />
              ปัญหาเปิดอยู่
            </h3>
            {exceptions.isLoading && !exceptions.data ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            ) : exceptions.data?.items.length ? (
              <ul className="mt-3 space-y-2 overflow-hidden">
                {exceptions.data.items.slice(0, 8).map((exception) => (
                  <li key={exception.id} className="rounded-lg bg-surface-muted px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">{exception.title}</p>
                      <StatusLabel
                        label={exception.severity === "CRITICAL" ? "ด่วนมาก" : exception.severity === "WARNING" ? "ต้องดู" : "แจ้งไว้"}
                        tone={exception.severity === "CRITICAL" ? "danger" : "warning"}
                      />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {exception.production.order.orderNumber} · {exception.workCenter?.name ?? "ยังไม่ระบุจุด"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-lg bg-green-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-green-300" aria-hidden="true" />
                <p className="mt-2 font-medium">ไม่มีปัญหาเปิดอยู่</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function WorkCenterPanel({ center }: { center: WorkCenterLoad }) {
  const hasAttention = center.blocked > 0 || center.overdue > 0 || center.openExceptions > 0;
  return (
    <article className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-300">{center.workCenter.code}</p>
          <h2 className="truncate text-xl font-semibold">{center.workCenter.name}</h2>
        </div>
        <StatusLabel label={hasAttention ? "ต้องดู" : "ปกติ"} tone={hasAttention ? "warning" : "success"} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="กำลังทำ" value={center.running} />
        <Metric label="พร้อมทำ" value={center.ready} />
        <Metric label="ติดปัญหา" value={center.blocked} danger={center.blocked > 0} />
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-divider pt-3 text-sm">
        <div className="flex items-start gap-2">
          <CircleGauge className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted">ภาระคงเหลือ</p>
            <p className="font-semibold tabular-nums">{center.loadQty.toLocaleString("th-TH")} ชิ้น</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted">กำลังผลิตต่อวัน</p>
            <p className="font-semibold tabular-nums">
              {center.capacity
                ? `${center.capacity.value.toLocaleString("th-TH")} ${CAPACITY_UNIT_LABEL[center.capacity.unit] ?? center.capacity.unit}`
                : "ยังไม่ประเมิน"}
            </p>
          </div>
        </div>
      </div>
      {(center.overdue > 0 || center.openExceptions > 0) ? (
        <p className="mt-3 text-xs font-medium text-amber-300">
          เลยกำหนด {center.overdue} · ปัญหาเปิด {center.openExceptions}
        </p>
      ) : null}
    </article>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={danger ? "mt-1 text-2xl font-semibold tabular-nums text-red-300" : "mt-1 text-2xl font-semibold tabular-nums"}>
        {value.toLocaleString("th-TH")}
      </p>
    </div>
  );
}

function Pulse({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-muted px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={danger ? "text-xl font-semibold tabular-nums text-red-300" : "text-xl font-semibold tabular-nums"}>
        {value.toLocaleString("th-TH")}
      </p>
    </div>
  );
}
