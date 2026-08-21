"use client";

import { useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useListPageState } from "@/hooks/use-list-page-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/page-shell";
import { CreateProductionDialog } from "@/components/production/create-production-dialog";
import { ProductionControlWorklist, ProductionDaySummary } from "@/components/production/production-control-worklist";
import { ProductionBoardView } from "@/components/production/production-board-view";
import { ProductionModuleNav } from "@/components/production/production-module-nav";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON, INTERACTIVE_HOVER, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import {
  buildProductionBoard,
  filterBoardJobs,
  sortBoardJobs,
} from "@/lib/production-board";
import {
  DEFAULT_PRODUCTION_WORKLIST_SORT,
  filterProductionWorklist,
  isProductionWorklistLens,
  productionWorklistCounts,
  resolveProductionWorklistSort,
  sortProductionWorklist,
} from "@/lib/production-worklist";
import { LayoutGrid, List, RefreshCw } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

// ศูนย์ควบคุมการผลิตของหัวหน้า — mockup v2 (เบสอนุมัติ 2026-08-22):
// บอร์ดโรงงานเป็นมุมหลัก สลับเป็นรายการควบคุมได้ · หน้านี้เป็น read/triage
// layer เท่านั้น: การเปลี่ยนสถานะยังอยู่ในใบผลิต/ออเดอร์ผ่าน mutation เดิม
// · URL: ?layout=board|list (default board) · ?lane= โฟกัสสายบนบอร์ด

type KanbanOrder = RouterOutput["production"]["kanban"][number];
type KanbanStep = KanbanOrder["productions"][number]["steps"][number];

const LAYOUTS = [
  { key: "board", label: "บอร์ด", icon: LayoutGrid },
  { key: "list", label: "รายการ", icon: List },
] as const;

type ProductionLayout = (typeof LAYOUTS)[number]["key"];

function resolveLayout(value: string | null): ProductionLayout {
  return value === "list" ? "list" : "board";
}

function ProductionWorkspace() {
  const list = useListPageState();
  const router = useRouter();

  const layout = resolveLayout(list.searchParams.get("layout"));
  const sort = resolveProductionWorklistSort(list.searchParams.get("sort"));
  const rawLens = list.searchParams.get("view") ?? "all";
  const lens = isProductionWorklistLens(rawLens) ? rawLens : "all";
  const lane = list.searchParams.get("lane") ?? "";
  const createOrderId = list.searchParams.get("create");

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

  const searchedJobs = useMemo(
    () => filterBoardJobs(board.jobs, board.stations, "", list.search),
    [board.jobs, board.stations, list.search],
  );
  const lensJobs = useMemo(
    () => filterProductionWorklist(board, searchedJobs, lens),
    [board, searchedJobs, lens],
  );
  const visibleJobs = useMemo(
    () => sortProductionWorklist(board, lensJobs, sort),
    [board, lensJobs, sort],
  );
  // บอร์ดใช้ sort ของตัวเอง (due/urgent/newest) จาก param เดียวกัน — ค่าของ worklist
  // ที่ติดมาจะ fall back เป็น due ใน sortBoardJobs อยู่แล้ว
  const boardJobs = useMemo(
    () => sortBoardJobs(searchedJobs, list.searchParams.get("sort") ?? "due"),
    [searchedJobs, list.searchParams],
  );
  const worklistCounts = useMemo(() => productionWorklistCounts(board), [board]);
  const hasStaleData =
    (isError && Boolean(orders)) || (meQuery.isError && Boolean(me));
  const canCreateProduction =
    canSupervise && orders !== undefined && !isError && !meQuery.isError;

  return (
    <>
      <PageShell
        title="ควบคุมการผลิต"
        description={
          orders
            ? `${board.totalJobs.toLocaleString("th-TH")} ออเดอร์ · ${worklistCounts.attention.toLocaleString("th-TH")} รายการต้องจัดการ`
            : "ติดตามงานตั้งแต่เปิดใบผลิตจนพร้อมส่ง"
        }
        headerChildren={<ProductionModuleNav />}
        loading={isLoading || meQuery.isLoading}
        skeleton={
          <>
            <Skeleton className="h-11 rounded-full" />
            <Skeleton className="h-11 rounded-full" />
            <Skeleton className="h-96 rounded-2xl" />
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

        {/* สรุปวันนี้ + ตัวสลับมุม (mockup v2 §1) — เห็นก่อนเข้าเครื่องมือใด ๆ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ProductionDaySummary jobs={board.jobs} />
          <div
            role="group"
            aria-label="เลือกมุมมอง"
            className="flex overflow-hidden rounded-lg border border-border"
          >
            {LAYOUTS.map((item) => {
              const Icon = item.icon;
              const selected = layout === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    list.replaceListState({
                      layout: item.key === "board" ? null : item.key,
                      lane: null,
                    })
                  }
                  className={cn(
                    CONTROL_MIN_H,
                    FOCUS_BUTTON,
                    INTERACTIVE_HOVER,
                    INTERACTIVE_PRESSED,
                    "inline-flex items-center gap-1.5 px-3 text-sm font-medium",
                    selected
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : "bg-surface text-secondary",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {layout === "board" ? (
          <ProductionBoardView
            board={board}
            jobs={boardJobs}
            station={lane}
            searchDefault={list.search}
            searchInputRef={list.searchInputRef}
            onSelectStation={(key) =>
              list.replaceListState({ lane: key || null })
            }
            onSearchChange={list.onSearchChange}
            sort={list.searchParams.get("sort") ?? "due"}
            onSelectSort={(value) =>
              list.replaceListState({
                sort: value === "due" ? null : value,
              })
            }
          />
        ) : (
          <ProductionControlWorklist
            board={board}
            jobs={visibleJobs}
            lens={lens}
            sort={sort}
            searchDefault={list.search}
            searchInputRef={list.searchInputRef}
            onSelectLens={(value) =>
              list.replaceListState({
                view: value === "all" ? null : value,
                page: null,
              })
            }
            onSearchChange={list.onSearchChange}
            onSelectSort={(value) =>
              list.replaceListState({
                sort: value === DEFAULT_PRODUCTION_WORKLIST_SORT ? null : value,
              })
            }
            canCreateProduction={canCreateProduction}
          />
        )}
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

export default function ProductionPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense (ข้อบังคับ Next.js ตอน prerender)
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ProductionWorkspace />
    </Suspense>
  );
}
