"use client";

/**
 * `/production` — ตารางผลิตต่อเนื่อง (A10 · เบสสั่ง 2026-09-09) ฝั่งข้อมูล
 * อ่าน `production.kanban` + `user.me` ชุดเดิม → `buildProductionBoard` (สูตรเดิม) → `production-desk`
 * ตัววาดอยู่ production-desk-view.tsx (รับ props ล้วน เพื่อ probe/ทดสอบได้โดยไม่ต้องล็อกอิน)
 * ตัวกรองเก็บใน URL: `?view=late|blocked|outsource|ready` · `?station=` · `?q=` · `?create=<orderId>`
 */

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Factory, MonitorSmartphone, Plus, RefreshCw } from "lucide-react";

import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { FLOOR_HREF } from "@/lib/production-surface";
import { formatTime } from "@/lib/utils";
import { useListPageState } from "@/hooks/use-list-page-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { PageShell } from "@/components/page-shell";
import { CreateProductionDialog } from "@/components/production/create-production-dialog";
import { ProductionFreshness } from "@/components/production/production-freshness";
import { STATION_QUEUE, buildProductionBoard, filterBoardJobs } from "@/lib/production-board";
import {
  buildDeskRows,
  deskSummary,
  filterDeskRows,
  isDeskLens,
  type DeskLens,
} from "@/lib/production-desk";
import { resolveDeskSort, sortDeskRows } from "@/lib/production-desk-sort";
import {
  filterWorklistByStation,
  productionWorklistHref,
  resolveWorklistStation,
  worklistStationChips,
} from "@/lib/production-worklist";
import { DeskTable, DeskTiles, DeskToolbar, STATION_OUTSOURCE_ALL } from "./production-desk-view";

type KanbanOrder = RouterOutput["production"]["kanban"][number];
type KanbanStep = KanbanOrder["productions"][number]["steps"][number];

function ProductionDesk() {
  const list = useListPageState();
  const router = useRouter();
  const rawLens = list.searchParams.get("view");
  const lens: DeskLens = isDeskLens(rawLens) ? rawLens : "all";
  const createOrderId = list.searchParams.get("create");
  const sort = resolveDeskSort(list.searchParams.get("sort"), list.searchParams.get("dir"));

  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const {
    data: orders,
    isLoading,
    isError,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = trpc.production.kanban.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const canSupervise = permAllows(me?.permissions, "supervise_operations");
  // ช่างเห็นเฉพาะงานที่ลงมือได้จริง · หัวหน้า/ขาย/การเงินเห็นกองติดด่านเพื่อตามแก้ต้นเหตุ
  const showBlocked = !!me && (me.role !== "PRODUCTION_STAFF" || canSupervise);

  // now อ้างจากเวลาที่ข้อมูลอัปเดตล่าสุด ไม่ใช่ new Date() สด — กัน render ไม่ตรงกัน
  // ระหว่าง server/client และกัน react-compiler ตี Date.now() ว่า impure
  const now = useMemo(() => (dataUpdatedAt > 0 ? new Date(dataUpdatedAt) : new Date(0)), [dataUpdatedAt]);
  const board = useMemo(
    () => buildProductionBoard<KanbanStep, KanbanOrder>(orders ?? [], { now, viewerId: me?.id, showBlocked }),
    [orders, now, me?.id, showBlocked],
  );
  const rows = useMemo(() => buildDeskRows(board, now), [board, now]);
  const summary = useMemo(() => deskSummary(rows), [rows]);

  const searchedJobs = useMemo(
    () => new Set(filterBoardJobs(board.jobs, board.stations, "", list.search).map((job) => job.key)),
    [board.jobs, board.stations, list.search],
  );
  const lensRows = useMemo(
    () => filterDeskRows(rows, lens).filter((row) => searchedJobs.has(row.job.key)),
    [rows, lens, searchedJobs],
  );
  // ตัวเลขในชิปขั้นงานนับก่อนกรองขั้น — ไม่งั้นพอกดสายหนึ่ง สายอื่นจะกลายเป็น 0 ทั้งแถบ
  const stationChips = useMemo(
    () => worklistStationChips(board.stations, lensRows.map((row) => row.job)),
    [board.stations, lensRows],
  );
  const outsourceKeys = new Set(stationChips.filter((chip) => chip.isOutsource).map((chip) => chip.key));
  const outsourceRows = lensRows.filter((row) => row.job.stationKeys.some((key) => outsourceKeys.has(key)));
  // "ร้านนอก" ชิปเดียว = ทุกประเภทร้าน (ค่า virtual ไม่มีใน board.stations) · ประเภทเฉพาะยังเป็น lane:<LANE> เดิม
  const rawStation = list.searchParams.get("station");
  const station =
    rawStation === STATION_OUTSOURCE_ALL ? STATION_OUTSOURCE_ALL : resolveWorklistStation(rawStation, stationChips);
  const visibleRows = useMemo(() => {
    if (station === STATION_OUTSOURCE_ALL) {
      const outsourceKeys = new Set(stationChips.filter((chip) => chip.isOutsource).map((chip) => chip.key));
      return lensRows.filter((row) => row.job.stationKeys.some((key) => outsourceKeys.has(key)));
    }
    const keys = new Set(filterWorklistByStation(lensRows.map((row) => row.job), station).map((job) => job.key));
    return lensRows.filter((row) => keys.has(row.job.key));
  }, [lensRows, station, stationChips]);
  const sortedRows = sortDeskRows(visibleRows, sort);
  const filtered = lens !== "all" || Boolean(station) || Boolean(list.search);

  const hasStaleData = (isError && Boolean(orders)) || (meQuery.isError && Boolean(me));
  const canCreateProduction = canSupervise && orders !== undefined && !isError && !meQuery.isError;
  const awaiting = rows.filter((row) => row.pile === "queue").length;

  return (
    <>
      <PageShell
        title="การผลิต"
        icon={Factory}
        tone="production"
        description={
          orders
            ? `งานในโรงงาน ${board.totalJobs.toLocaleString("th-TH")} ใบ · รอเปิดใบผลิต ${awaiting.toLocaleString("th-TH")} ใบ`
            : "ดูว่างานไหนต้องจัดการก่อน อยู่ขั้นไหน และของร้านนอกกลับเมื่อไร"
        }
        action={
          <>
            {/* โหมดหน้างาน (หนึ่งโมดูล สองสายตา · 2026-09-03) — จอทัชหน้าเครื่อง: ช่างเห็นคิวของตน · หัวหน้าเห็นแผงสถานี */}
            <Button variant="outline" asChild>
              <Link href={FLOOR_HREF}>
                <MonitorSmartphone /> โหมดหน้างาน
              </Link>
            </Button>
            {canCreateProduction ? (
              // กรองไปกอง "รอเปิดใบผลิต" — แถวในกองนั้นกดแล้วเปิด dialog สร้างใบ (ทางเดิม ?create=)
              <Button onClick={() => list.replaceListState({ view: null, station: STATION_QUEUE, page: null })}>
                <Plus /> เปิดใบผลิต{awaiting > 0 ? ` (${awaiting.toLocaleString("th-TH")})` : ""}
              </Button>
            ) : null}
          </>
        }
        loading={isLoading || meQuery.isLoading}
        skeleton={
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-16 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-11 rounded-lg" />
            <ListPageSkeleton />
          </>
        }
        error={
          meQuery.isError && !me
            ? { message: "โหลดสิทธิ์การผลิตไม่สำเร็จ", onRetry: () => meQuery.refetch() }
            : isError && !orders
              ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetch() }
              : null
        }
      >
        {hasStaleData ? (
          <Alert
            variant="warning"
            title="ข้อมูลล่าสุดอาจยังไม่ครบ"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void refetch();
                  void meQuery.refetch();
                }}
              >
                <RefreshCw />
                ลองใหม่
              </Button>
            }
          >
            <span>กำลังแสดงข้อมูลเดิมที่โหลดไว้ คุณยังเปิดดูงานได้ตามปกติ</span>
          </Alert>
        ) : null}

        <div className="space-y-5">
          <DeskTiles
            summary={summary}
            lens={lens}
            onSelectLens={(value) => list.replaceListState({ view: value === "all" ? null : value, page: null })}
          />
          <DeskToolbar
            searchDefault={list.search}
            searchInputRef={list.searchInputRef}
            onSearchChange={list.onSearchChange}
            station={station}
            stations={stationChips}
            outsourceTotal={outsourceRows.length}
            outsourceOverdue={outsourceRows.filter((row) => row.job.overdue).length}
            onSelectStation={(value) => list.replaceListState({ station: value || null, page: null })}
            total={lensRows.length}
            freshness={
              <ProductionFreshness
                updatedAt={dataUpdatedAt}
                isFetching={isFetching && !isLoading}
                stale={hasStaleData}
                className="hidden text-xs sm:inline-grid"
              />
            }
          />
          <div className="flex min-h-9 items-center justify-between gap-3">
            <p className="text-sm text-secondary" aria-live="polite" aria-atomic="true">
              <span className="font-semibold tabular-nums text-strong">{visibleRows.length.toLocaleString("th-TH")}</span>
              {filtered ? ` จาก ${rows.length.toLocaleString("th-TH")}` : ""} ใบงาน
            </p>
            {filtered ? (
              <Button size="sm" variant="ghost" onClick={() => list.clearSearch({ view: null, station: null })}>
                ล้างตัวกรอง
              </Button>
            ) : dataUpdatedAt > 0 ? <span className="text-xs text-muted sm:hidden">อัปเดต {formatTime(dataUpdatedAt)}</span> : null}
          </div>
          <DeskTable
            rows={sortedRows}
            sort={sort}
            onSort={(key, direction) => list.replaceListState({ sort: key === "deadline" ? null : key, dir: direction === "asc" ? null : direction, page: null })}
            hrefFor={(row) => productionWorklistHref(row.job, canCreateProduction)}
            emptyLabel={
              lens === "all" && !station && !list.search
                ? "ยังไม่มีงานในโรงงาน — เปิดใบผลิตจากหน้าออเดอร์ที่พร้อมผลิต"
                : "ไม่พบงานที่ตรงกับตัวกรอง ลองค้นหาใหม่หรือล้างตัวกรอง"
            }
          />
        </div>
      </PageShell>

      {createOrderId && canCreateProduction ? (
        <CreateProductionDialog
          orderId={createOrderId}
          onClose={() => list.replaceListState({ create: null })}
          onCreated={(production) => router.push(`/production/${production.id}`)}
        />
      ) : null}
    </>
  );
}

export function ProductionDeskPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ProductionDesk />
    </Suspense>
  );
}
