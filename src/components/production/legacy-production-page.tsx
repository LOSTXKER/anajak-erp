"use client";

import { useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useListPageState } from "@/hooks/use-list-page-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { PageShell } from "@/components/page-shell";
import { CreateProductionDialog } from "@/components/production/create-production-dialog";
import { ProductionControlWorklist } from "@/components/production/production-control-worklist";
import { ProductionFreshness } from "@/components/production/production-freshness";
import { ProductionModuleNav } from "@/components/production/production-module-nav";
import {
  buildProductionBoard,
  filterBoardJobs,
} from "@/lib/production-board";
import {
  DEFAULT_PRODUCTION_WORKLIST_SORT,
  filterProductionWorklist,
  isProductionWorklistLens,
  resolveProductionWorklistSort,
  resolveWorklistStation,
  sortProductionWorklist,
  worklistStationChips,
} from "@/lib/production-worklist";
import { RefreshCw } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

// ศูนย์ควบคุมการผลิตของหัวหน้า — หนึ่งออเดอร์ต่อหนึ่งแถวและเรียงข้อยกเว้นก่อน
// หน้านี้เป็น read/triage layer เท่านั้น: การเปลี่ยนสถานะยังทำในใบผลิต/ออเดอร์
// ผ่าน mutation และ permission เดิมทั้งหมด

type KanbanOrder = RouterOutput["production"]["kanban"][number];
type KanbanStep = KanbanOrder["productions"][number]["steps"][number];

function ProductionWorkspace() {
  const list = useListPageState();
  const router = useRouter();

  const sort = resolveProductionWorklistSort(list.searchParams.get("sort"));
  const rawLens = list.searchParams.get("view") ?? "all";
  const lens = isProductionWorklistLens(rawLens) ? rawLens : "all";
  const createOrderId = list.searchParams.get("create");

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

  // ขั้นงานที่กรองอยู่ — สายที่ไม่มีอยู่จริง (ลิงก์เก่า/มือแก้ URL) ตกกลับเป็น "ทุกขั้น"
  const station = resolveWorklistStation(
    list.searchParams.get("station"),
    board.stations,
  );

  const searchedJobs = useMemo(
    () => filterBoardJobs(board.jobs, board.stations, "", list.search),
    [board.jobs, board.stations, list.search],
  );
  const lensJobs = useMemo(
    () => filterProductionWorklist(board, searchedJobs, lens),
    [board, searchedJobs, lens],
  );
  // ตัวเลขในชิปขั้นงานนับก่อนกรองขั้น — ไม่งั้นพอกดสายหนึ่ง สายอื่นจะกลายเป็น 0 ทั้งแถบ
  const stationChips = useMemo(
    () => worklistStationChips(board.stations, lensJobs),
    [board.stations, lensJobs],
  );
  const stationJobs = useMemo(
    () => filterBoardJobs(lensJobs, board.stations, station, ""),
    [lensJobs, board.stations, station],
  );
  const visibleJobs = useMemo(
    () => sortProductionWorklist(board, stationJobs, sort),
    [board, stationJobs, sort],
  );
  const hasStaleData =
    (isError && Boolean(orders)) || (meQuery.isError && Boolean(me));
  const canCreateProduction =
    canSupervise && orders !== undefined && !isError && !meQuery.isError;

  return (
    <>
      <PageShell
        title="ควบคุมการผลิต"
        action={<ProductionModuleNav />}
        loading={isLoading || meQuery.isLoading}
        skeleton={
          <>
            <Skeleton className="h-11 rounded-full" />
            <Skeleton className="h-11 rounded-full" />
            <ListPageSkeleton />
          </>
        }
        // โหลดแรกพังต้องบอกตรง ๆ · background refetch พังให้คงข้อมูลเดิมแล้วเตือนในหน้า
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
        {hasStaleData ? (
          <Alert variant="warning" title="ข้อมูลล่าสุดอาจยังไม่ครบ">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>กำลังแสดงข้อมูลเดิมที่โหลดไว้ คุณยังเปิดดูงานได้ตามปกติ</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void refetch();
                  void meQuery.refetch();
                }}
              >
                <RefreshCw />
                ลองใหม่
              </Button>
            </span>
          </Alert>
        ) : null}

        <ProductionControlWorklist
          board={board}
          jobs={visibleJobs}
          lens={lens}
          station={station}
          stations={stationChips}
          sort={sort}
          searchDefault={list.search}
          searchInputRef={list.searchInputRef}
          onSelectLens={(value) =>
            list.replaceListState({
              view: value === "all" ? null : value,
              page: null,
            })
          }
          onSelectStation={(value) =>
            list.replaceListState({ station: value || null, page: null })
          }
          onSearchChange={list.onSearchChange}
          onSelectSort={(value) =>
            list.replaceListState({
              sort: value === DEFAULT_PRODUCTION_WORKLIST_SORT ? null : value,
            })
          }
          canCreateProduction={canCreateProduction}
          freshness={
            <ProductionFreshness
              updatedAt={dataUpdatedAt}
              isFetching={isFetching && !isLoading}
              stale={hasStaleData}
            />
          }
        />
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

export function LegacyProductionPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense (ข้อบังคับ Next.js ตอน prerender)
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ProductionWorkspace />
    </Suspense>
  );
}
