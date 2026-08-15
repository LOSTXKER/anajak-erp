"use client";

import { useMemo, Suspense } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useListPageState } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/page-shell";
import { ProductionBoardView } from "@/components/production/production-board-view";
import {
  STATION_ALL,
  buildProductionBoard,
  filterBoardJobs,
  sortBoardJobs,
} from "@/lib/production-board";
import { MonitorUp, Printer } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

// หน้าการผลิต — บอร์ดโรงงาน (ใบงาน PC1.2 · เบสเคาะ 2026-08-15 "เอาแบบ A บอร์ดโรงงาน")
// คอลัมน์ = สถานีจริงเรียงตามทางเดินงาน · การ์ดเป็นลิงก์ทั้งใบไปยังที่ที่ลงมือได้จริง
// ไม่มีปุ่มสั่งงานบนบอร์ด (เบสสั่ง "ไม่ต้องมี CTA เพราะเราจะกดเข้าไปดูเป็นหลัก")
// จึงไม่มี mutation บนหน้านี้ — สถานะทุกอย่างยังเปลี่ยนที่หน้าใบผลิต/ออเดอร์ตามกติกาเดิม
//
// ความจริงโรงงาน: ทำเอง = DTF เท่านั้น · DTG/สกรีน/ปัก/Sublimation/ตัดเย็บ/ป้ายคอ = ร้านนอก

type KanbanOrder = RouterOutput["production"]["kanban"][number];
type KanbanStep = KanbanOrder["productions"][number]["steps"][number];

function ProductionWorkspace() {
  const list = useListPageState();

  const station = list.searchParams.get("lane") ?? STATION_ALL;
  const sort = list.searchParams.get("sort") ?? "due";

  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const {
    data: orders,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
  } = trpc.production.kanban.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const role = me?.role;
  const canSupervise = permAllows(me?.permissions, "supervise_operations");
  // ช่างเห็นเฉพาะงานที่ลงมือได้จริง · หัวหน้า/ขาย/การเงินเห็นกองติดด่านเพื่อตามแก้ต้นเหตุ
  const showBlocked = !!me && (role !== "PRODUCTION_STAFF" || canSupervise);

  // now อ้างจากเวลาที่ข้อมูลอัปเดตล่าสุด ไม่ใช่ new Date() สด — กัน render ไม่ตรงกัน
  // ระหว่าง server/client และกัน react-compiler ตี Date.now() ว่า impure
  const board = useMemo(
    () =>
      buildProductionBoard<KanbanStep, KanbanOrder>(orders ?? [], {
        now: dataUpdatedAt > 0 ? new Date(dataUpdatedAt) : new Date(0),
        viewerId: me?.id,
        showBlocked,
      }),
    [orders, dataUpdatedAt, me?.id, showBlocked],
  );

  const visibleJobs = useMemo(
    () =>
      sortBoardJobs(
        filterBoardJobs(board.jobs, board.stations, station, list.search),
        sort,
      ),
    [board.jobs, board.stations, station, list.search, sort],
  );

  return (
    <PageShell
      title={orders ? "บอร์ดผลิต" : "การผลิต"}
      description={
        orders
          ? `${board.totalJobs.toLocaleString("th-TH")} ออเดอร์ในโรงงาน`
          : "สายการผลิตทั้งโรงงาน"
      }
      action={
        <>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/production/print-runs">
              <Printer />
              รอบพิมพ์ฟิล์ม
            </Link>
          </Button>
          <Button size="sm" asChild className="gap-1.5">
            <Link href="/factory/station">
              <MonitorUp />
              เปิดจอประจำสถานี
            </Link>
          </Button>
        </>
      }
      loading={isLoading || meQuery.isLoading}
      skeleton={
        <>
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </>
      }
      // บอร์ดโหลดไม่สำเร็จต้องบอกตรงๆ — ไม่งั้น orders ?? [] โชว์บอร์ดว่างเหมือน "ไม่มีงาน"
      // && !orders: พังเฉพาะโหลดแรก — refetch เบื้องหลังล้มทั้งที่มี cache ห้ามถอนบอร์ด
      error={
        meQuery.isError && !me
          ? {
              message: "โหลดสิทธิ์การผลิตไม่สำเร็จ",
              onRetry: () => meQuery.refetch(),
            }
          : isError && !orders
            ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetch() }
            : null
      }
    >
      <ProductionBoardView
        board={board}
        jobs={visibleJobs}
        station={station}
        searchDefault={list.search}
        searchInputRef={list.searchInputRef}
        onSelectStation={(key) => list.replaceListState({ lane: key || null, page: null })}
        onSearchChange={list.onSearchChange}
        sort={sort}
        onSelectSort={(value) => list.replaceListState({ sort: value === "due" ? null : value })}
      />
    </PageShell>
  );
}

export default function ProductionPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense (ข้อบังคับ Next.js ตอน prerender)
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ProductionWorkspace />
    </Suspense>
  );
}
