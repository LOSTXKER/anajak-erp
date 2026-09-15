"use client";

/**
 * `/production` — ตารางผลิตต่อเนื่อง (A10 · เบสสั่ง 2026-09-09) ฝั่งข้อมูล
 * อ่าน `production.kanban` + `user.me` ชุดเดิม → `buildProductionBoard` (สูตรเดิม) → `production-desk`
 * ตัววาดอยู่ production-desk-kit.tsx บนชุดหน้าตากลาง (ต้นแบบ mockup-production-calm-2026-09-15 · ลงจริง 2026-09-16)
 * ตัวกรองเก็บใน URL: `?view=late|blocked|outsource|ready` · `?station=` · `?q=` · `?create=<orderId>`
 */

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, Plus, RefreshCw, TriangleAlert } from "lucide-react";

import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { FLOOR_HREF } from "@/lib/production-surface";
import { formatTime } from "@/lib/utils";
import { useListPageState } from "@/hooks/use-list-page-state";
import { c, Callout } from "@/components/kit/kit";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { PageShell } from "@/components/page-shell";
import { CreateProductionDialog } from "@/components/production/create-production-dialog";
import { ProductionModuleHead } from "@/components/production/production-module-head";
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
import { STATION_OUTSOURCE_ALL } from "./production-desk-view";
import { DeskLensBoxes, DeskWorkCard, type DeskStationOption } from "./production-desk-kit";

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

  const stationOptions: DeskStationOption[] = [
    { key: "", label: "ทุกขั้น", count: lensRows.length },
    ...stationChips.filter((chip) => !chip.isOutsource).map((chip) => ({ key: chip.key, label: chip.label, count: chip.count })),
    ...(stationChips.some((chip) => chip.isOutsource)
      ? [{ key: STATION_OUTSOURCE_ALL, label: "ร้านนอก", count: outsourceRows.length }]
      : []),
  ];
  const stationValue = station === STATION_OUTSOURCE_ALL || stationOptions.some((option) => option.key === station)
    ? station
    : STATION_OUTSOURCE_ALL;
  const refreshAll = () => {
    void refetch();
    void meQuery.refetch();
  };

  return (
    <>
      <PageShell
        title="การผลิต"
        header={<div className="sr-only">การผลิต</div>}
        loading={isLoading || meQuery.isLoading}
        skeleton={
          <div className={c("tokens page mfg")} role="status" aria-label="กำลังโหลดงานในโรงงาน">
            <span className={c("sk")} style={{ height: 112 }} />
            <div className={c("lenses")}>
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className={c("sk")} style={{ height: 104 }} />
              ))}
            </div>
            <span className={c("sk")} style={{ height: 420 }} />
          </div>
        }
        error={
          meQuery.isError && !me
            ? { message: "โหลดสิทธิ์การผลิตไม่สำเร็จ", onRetry: () => meQuery.refetch() }
            : isError && !orders
              ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetch() }
              : null
        }
      >
        <div className={c("tokens page mfg")}>
          {hasStaleData ? (
            <div className={c("alerts")}>
              <Callout
                icon={TriangleAlert}
                role="alert"
                action={
                  <button type="button" className={c("btn sm")} onClick={refreshAll}>
                    <RefreshCw aria-hidden="true" />
                    ลองใหม่
                  </button>
                }
              >
                <b>ข้อมูลล่าสุดอาจยังไม่ครบ</b> กำลังแสดงข้อมูลเดิมที่โหลดไว้
              </Callout>
            </div>
          ) : null}

          <ProductionModuleHead
            active="desk"
            title="การผลิต"
            badges={{ desk: summary.late + summary.blocked }}
            actions={
              <>
                <Link href={FLOOR_HREF} className={c("btn")}>
                  <MonitorSmartphone aria-hidden="true" />
                  <span className={c("lbl")}>โหมดหน้างาน</span>
                </Link>
                {canCreateProduction ? (
                  <button
                    type="button"
                    className={c("btn primary")}
                    onClick={() => list.replaceListState({ view: null, station: STATION_QUEUE, page: null })}
                  >
                    <Plus aria-hidden="true" />
                    เปิดใบผลิต{awaiting > 0 ? ` (${awaiting.toLocaleString("th-TH")})` : ""}
                  </button>
                ) : null}
              </>
            }
          />

          <DeskLensBoxes
            summary={summary}
            lens={lens}
            onSelect={(value) => list.replaceListState({ view: value === "all" ? null : value, page: null })}
          />

          <DeskWorkCard
            rows={sortedRows}
            station={stationValue}
            stations={stationOptions}
            onSelectStation={(value) => list.replaceListState({ station: value || null, page: null })}
            searchDefault={list.search}
            searchInputRef={list.searchInputRef}
            onSearchChange={list.onSearchChange}
            sort={sort}
            onSort={(key, direction) =>
              list.replaceListState({ sort: key === "deadline" ? null : key, dir: direction === "asc" ? null : direction, page: null })
            }
            hrefFor={(row) => productionWorklistHref(row.job, canCreateProduction)}
            filtered={filtered}
            onClear={() => list.clearSearch({ view: null, station: null })}
          />
          {dataUpdatedAt > 0 ? <span className="sr-only" aria-live="polite">อัปเดต {formatTime(dataUpdatedAt)}</span> : null}
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
