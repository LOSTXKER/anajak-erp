"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Boxes,
  ChevronRight,
  Factory,
  RefreshCw,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { trpc } from "@/lib/trpc";
import { useListPageState } from "@/hooks/use-list-page-state";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPopover, FilterPopoverField } from "@/components/ui/filter-popover";
import { QueryError } from "@/components/ui/query-error";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { StatusLabel } from "@/components/ui/status-label";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import {
  capacityUnitLabel,
  dispositionLabel,
  dueRiskMeta,
  exceptionSeverityMeta,
  exceptionStatusMeta,
  operationStatusMeta,
  progressPercent,
  workOrderStatusMeta,
} from "./manufacturing-presenter";
import { CreateWorkOrderDialog } from "./create-work-order-dialog";
import { LegacyOutsourcePage } from "@/components/outsource/legacy-outsource-page";
import { ProductionFreshness } from "@/components/production/production-freshness";

type ControlItem = RouterOutput["manufacturing"]["controlList"]["items"][number];
type WorkCenterLoad = RouterOutput["manufacturing"]["workCenterLoad"][number];
type ExceptionItem = RouterOutput["manufacturing"]["exceptionList"]["items"][number];
type WorkspaceView = "all" | "work-centers" | "exceptions" | "outsource";

const VIEWS: Array<{ value: WorkspaceView; label: string }> = [
  { value: "all", label: "ทุกงาน" },
  { value: "work-centers", label: "ศูนย์งาน" },
  { value: "exceptions", label: "ปัญหา" },
  { value: "outsource", label: "งานร้านนอก" },
];

const WORK_ORDER_STATES = [
  "DRAFT",
  "RELEASED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const EXCEPTION_STATES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"] as const;
const EXCEPTION_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;

function workspaceView(value: string | null): WorkspaceView {
  return VIEWS.some((item) => item.value === value) ? (value as WorkspaceView) : "all";
}

function oneOf<T extends readonly string[]>(value: string | null, options: T) {
  return options.includes(value as T[number]) ? (value as T[number]) : undefined;
}

function Progress({ done, total }: { done: number; total: number }) {
  const percent = progressPercent(done, total);
  return (
    <div className="min-w-32 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-strong">
          {done.toLocaleString("th-TH")}/{total.toLocaleString("th-TH")} ขั้น
        </span>
        <span className="tabular-nums text-muted">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="ความคืบหน้าของขั้นงาน"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CurrentOperations({ item }: { item: ControlItem }) {
  if (item.currentOperations.length === 0) {
    return <span className="text-xs text-muted">ยังไม่มีขั้นที่พร้อมทำ</span>;
  }

  return (
    <div className="space-y-2.5">
      {item.currentOperations.slice(0, 2).map((operation) => {
        const meta = operationStatusMeta(operation.state);
        const centerName = operation.workCenter?.name ?? "ยังไม่ระบุจุดทำงาน";
        return (
          <div key={operation.id} className="min-w-0">
            <p className="truncate text-sm font-medium text-strong">{operation.name}</p>
            <StatusLabel
              label={
                <>
                  {meta.label}
                  <span className="font-normal text-muted">· {centerName}</span>
                </>
              }
              tone={meta.tone}
            />
          </div>
        );
      })}
      {item.currentOperations.length > 2 ? (
        <p className="text-xs text-muted">และอีก {item.currentOperations.length - 2} ขั้น</p>
      ) : null}
    </div>
  );
}

function DueAndException({ item }: { item: ControlItem }) {
  const risk = dueRiskMeta(item.dueRisk);
  return (
    <div className="space-y-1.5">
      <StatusLabel
        label={risk.label}
        tone={risk.tone}
        emphasize={item.dueRisk === "OVERDUE"}
        sub={item.order.deadline ? formatDate(item.order.deadline) : "ยังไม่ระบุวันส่ง"}
      />
      {item.openExceptionCount > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
          {item.openExceptionCount.toLocaleString("th-TH")} ปัญหาที่ยังไม่จบ
        </span>
      ) : null}
    </div>
  );
}

function WorkOrderDesktopRows({ items }: { items: readonly ControlItem[] }) {
  return (
    <DataTable.Root>
      <DataTable.Head>
        <tr>
          <DataTable.Th>งานผลิต</DataTable.Th>
          <DataTable.Th>ขั้นตอนปัจจุบัน</DataTable.Th>
          <DataTable.Th>ความคืบหน้า</DataTable.Th>
          <DataTable.Th>กำหนดส่งและปัญหา</DataTable.Th>
          <DataTable.Th align="right">
            <span className="sr-only">เปิดงาน</span>
          </DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body className="divide-y divide-divider">
        {items.map((item) => {
          const status = workOrderStatusMeta(item.state);
          return (
            <DataTable.Row key={item.id} href={`/production/${item.id}`} className="align-top">
              <DataTable.Td className="w-[34%] max-w-sm py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/production/${item.id}`} className="font-semibold text-strong hover:underline">
                    {item.order.orderNumber}
                  </Link>
                  <StatusLabel label={status.label} tone={status.tone} />
                </div>
                <p className="mt-0.5 truncate text-sm text-secondary">{item.order.customerName}</p>
                <p className="truncate text-xs text-muted">
                  {item.workOrderNumber ?? "ยังไม่มีเลขใบผลิต"}
                </p>
              </DataTable.Td>
              <DataTable.Td className="w-[25%] max-w-xs py-4">
                <CurrentOperations item={item} />
              </DataTable.Td>
              <DataTable.Td className="w-[18%] py-4">
                <Progress
                  done={item.progress.operationsCompleted}
                  total={item.progress.operationsTotal}
                />
              </DataTable.Td>
              <DataTable.Td className="w-[23%] py-4">
                <DueAndException item={item} />
              </DataTable.Td>
              <DataTable.Td align="right" className="py-4">
                <ChevronRight className="ml-auto h-4 w-4 text-muted" aria-hidden />
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function WorkOrderMobileCards({ items }: { items: readonly ControlItem[] }) {
  return (
    <ul aria-label="รายการงานผลิต" className="space-y-3">
      {items.map((item) => {
        const status = workOrderStatusMeta(item.state);
        return (
          <li key={item.id}>
            <Link
              href={`/production/${item.id}`}
              className={cn("card-surface card-surface-hover block rounded-2xl p-4 sm:p-5", FOCUS_BUTTON)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-strong">{item.order.orderNumber}</p>
                  <p className="mt-0.5 truncate text-sm text-secondary">{item.order.customerName}</p>
                </div>
                <StatusLabel label={status.label} tone={status.tone} />
              </div>
              <div className="mt-4 border-t border-divider pt-4">
                <p className="mb-2 text-xs font-medium text-muted">ขั้นตอนปัจจุบัน</p>
                <CurrentOperations item={item} />
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(7.5rem,0.75fr)] gap-4 border-t border-divider pt-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">ความคืบหน้า</p>
                  <Progress
                    done={item.progress.operationsCompleted}
                    total={item.progress.operationsTotal}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">กำหนดส่ง</p>
                  <DueAndException item={item} />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  count,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  count: number;
  onLoadMore: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-xs text-muted">แสดงแล้ว {count.toLocaleString("th-TH")} รายการ</p>
      {hasNextPage ? (
        <Button variant="outline" onClick={onLoadMore} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "กำลังโหลด…" : "ดูงานถัดไป"}
        </Button>
      ) : (
        <p className="text-xs text-muted">ครบทุกงานที่ตรงกับตัวกรองแล้ว</p>
      )}
    </div>
  );
}

function WorkOrderList() {
  const {
    search,
    searchParams,
    replaceListState,
    onSearchChange,
    searchInputRef,
  } = useListPageState();
  const state = oneOf(searchParams.get("state"), WORK_ORDER_STATES);
  const sort = oneOf(searchParams.get("sort"), ["priority", "dueDate", "updatedAt"] as const) ?? "dueDate";
  const centerCode = searchParams.get("center") ?? "";
  const exceptionState = oneOf(searchParams.get("exception"), EXCEPTION_STATES);
  const centersQuery = trpc.manufacturing.workCenterLoad.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const center = centersQuery.data?.find((item) => item.workCenter.code === centerCode);
  const waitingForCenter = Boolean(centerCode) && centersQuery.isLoading;
  const missingCenter = Boolean(centerCode) && !centersQuery.isLoading && !center;
  const query = trpc.manufacturing.controlList.useInfiniteQuery(
    {
      query: search.trim() || undefined,
      state,
      workCenterId: center?.workCenter.id,
      exceptionState,
      sort,
      limit: 30,
    },
    {
      enabled: !waitingForCenter && !missingCenter,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items), [query.data]);
  const stale = query.isError && Boolean(items?.length);
  const hasFilters = Boolean(search || state || centerCode || exceptionState);
  const activeFilterCount = [state, centerCode, exceptionState].filter(Boolean).length;

  if (centerCode && centersQuery.isError && !centersQuery.data) {
    return (
      <QueryError
        message="โหลดศูนย์งานสำหรับตัวกรองไม่สำเร็จ"
        onRetry={() => centersQuery.refetch()}
      />
    );
  }

  if (missingCenter) {
    return (
      <EmptyState
        icon={Factory}
        title="ไม่พบศูนย์งานนี้"
        description="หัวหน้าสามารถตั้งศูนย์งานได้ก่อนปล่อยใบสั่งผลิต"
        action={
          <Button variant="outline" onClick={() => replaceListState({ center: null })}>
            ดูทุกศูนย์งาน
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end px-1">
        <ProductionFreshness
          updatedAt={query.dataUpdatedAt}
          isFetching={query.isFetching && !query.isLoading && !query.isFetchingNextPage}
          stale={stale}
        />
      </div>

      <Toolbar>
        <SearchInput
          surface="raised"
          ref={searchInputRef}
          defaultValue={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="ค้นหาเลขออเดอร์ ใบผลิต หรือลูกค้า"
          containerClassName="@2xl:min-w-80 @2xl:flex-1"
        />
        <ToolbarGroup align="end" className="w-full min-w-0 @2xl:w-auto">
          <Select
            surface="raised"
            aria-label="เรียงรายการ"
            value={sort}
            onChange={(event) => replaceListState({ sort: event.target.value === "dueDate" ? null : event.target.value })}
            className="min-w-0 flex-1 @2xl:w-44 @2xl:flex-none"
          >
            <option value="dueDate">กำหนดส่งใกล้สุด</option>
            <option value="priority">ความสำคัญสูงสุด</option>
            <option value="updatedAt">อัปเดตล่าสุด</option>
          </Select>
          <FilterPopover
            activeCount={activeFilterCount}
            onClear={() => replaceListState({ state: null, center: null, exception: null })}
            resultLabel="ดูรายการ"
            align="end"
            triggerClassName="flex-1 @2xl:flex-none"
          >
            <FilterPopoverField label="สถานะงาน" htmlFor="production-state-filter">
              <Select
                id="production-state-filter"
                aria-label="กรองสถานะใบสั่งผลิต"
                value={state ?? ""}
                onChange={(event) => replaceListState({ state: event.target.value || null })}
              >
                <option value="">ทุกสถานะ</option>
                {WORK_ORDER_STATES.map((value) => (
                  <option key={value} value={value}>{workOrderStatusMeta(value).label}</option>
                ))}
              </Select>
            </FilterPopoverField>
            <FilterPopoverField label="ศูนย์งาน" htmlFor="production-center-filter">
              <Select
                id="production-center-filter"
                aria-label="กรองศูนย์งาน"
                value={centerCode}
                onChange={(event) => replaceListState({ center: event.target.value || null })}
                disabled={centersQuery.isLoading || centersQuery.isError}
              >
                <option value="">ทุกศูนย์งาน</option>
                {(centersQuery.data ?? []).map((item) => (
                  <option key={item.workCenter.id} value={item.workCenter.code}>{item.workCenter.name}</option>
                ))}
              </Select>
            </FilterPopoverField>
            <FilterPopoverField label="สถานะปัญหา" htmlFor="production-exception-filter">
              <Select
                id="production-exception-filter"
                aria-label="กรองปัญหา"
                value={exceptionState ?? ""}
                onChange={(event) => replaceListState({ exception: event.target.value || null })}
              >
                <option value="">ทุกสถานะปัญหา</option>
                {EXCEPTION_STATES.map((value) => (
                  <option key={value} value={value}>{exceptionStatusMeta(value).label}</option>
                ))}
              </Select>
            </FilterPopoverField>
          </FilterPopover>
        </ToolbarGroup>
      </Toolbar>

      {centersQuery.isError ? (
        <Alert variant="warning" title="โหลดรายชื่อศูนย์งานไม่สำเร็จ">
          ตัวกรองศูนย์งานถูกปิดชั่วคราว รายการทุกงานยังใช้งานได้
        </Alert>
      ) : null}

      {stale ? (
        <Alert variant="warning" title="ข้อมูลล่าสุดอาจยังไม่ครบ">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>กำลังแสดงข้อมูลที่โหลดไว้ คุณยังเปิดดูงานได้ตามปกติ</span>
            <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
              <RefreshCw /> ลองใหม่
            </Button>
          </span>
        </Alert>
      ) : null}

      <ResponsiveList
        items={items}
        isLoading={query.isLoading || waitingForCenter}
        isError={query.isError}
        errorMessage="โหลดรายการผลิตไม่สำเร็จ"
        onRetry={() => query.refetch()}
        emptyState={
          <EmptyState
            icon={hasFilters ? SearchX : Boxes}
            title={
              hasFilters
                ? "ไม่พบงานที่ตรงกับตัวกรอง"
                : "ยังไม่มีใบสั่งผลิต"
            }
            description={
              hasFilters
                ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง"
                : "งานจะปรากฏที่นี่เมื่อสร้างใบสั่งผลิตแล้ว"
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => replaceListState({ q: null, state: null, center: null, exception: null, sort: null })}
                >
                  ล้างตัวกรอง
                </Button>
              ) : undefined
            }
          />
        }
        renderDesktop={(rows) => <WorkOrderDesktopRows items={rows} />}
        renderMobile={(rows) => <WorkOrderMobileCards items={rows} />}
        pagination={
          items?.length ? (
            <LoadMore
              hasNextPage={Boolean(query.hasNextPage)}
              isFetchingNextPage={query.isFetchingNextPage}
              count={items.length}
              onLoadMore={() => void query.fetchNextPage()}
            />
          ) : null
        }
      />
    </div>
  );
}

function CenterCard({
  center,
  selected,
}: {
  center: WorkCenterLoad;
  selected: boolean;
}) {
  const hasAttention =
    center.blocked > 0 || center.overdue > 0 || center.openExceptions > 0;
  return (
    <article
      className={`card-surface rounded-2xl p-5 ${selected ? "ring-2 ring-blue-500" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-strong">{center.workCenter.name}</h2>
        </div>
        <StatusLabel
          label={hasAttention ? "ต้องดูแล" : center.running > 0 ? "กำลังทำงาน" : "ปกติ"}
          tone={hasAttention ? "danger" : center.running > 0 ? "warning" : "success"}
        />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">กำลังทำ</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-strong">
            {center.running.toLocaleString("th-TH")} งาน
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">พร้อมทำ</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-strong">
            {center.ready.toLocaleString("th-TH")} งาน
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">ปริมาณค้าง</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-strong">
            {center.loadQty.toLocaleString("th-TH")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">กำลังผลิตต่อวัน</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-strong">
            {center.capacity
              ? `${center.capacity.value.toLocaleString("th-TH")} ${capacityUnitLabel(center.capacity.unit)}`
              : "ยังไม่ประเมิน"}
          </dd>
        </div>
      </dl>
      {hasAttention ? (
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-red-700 dark:text-red-300">
          {center.blocked > 0 ? <span>ติดปัญหา {center.blocked}</span> : null}
          {center.overdue > 0 ? <span>เลยกำหนด {center.overdue}</span> : null}
          {center.openExceptions > 0 ? <span>ปัญหาเปิด {center.openExceptions}</span> : null}
        </div>
      ) : null}
      <Button asChild variant="ghost" size="sm" className="mt-4 w-full justify-between">
        <Link href={`/production?center=${encodeURIComponent(center.workCenter.code)}`}>
          ดูคิวของศูนย์งาน <ChevronRight />
        </Link>
      </Button>
    </article>
  );
}

function WorkCentersView({ selectedCode }: { selectedCode: string }) {
  const query = trpc.manufacturing.workCenterLoad.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  if (query.isError && !query.data) {
    return (
      <QueryError
        message="โหลดศูนย์งานไม่สำเร็จ"
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isLoading && !query.data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-lg" />
        ))}
      </div>
    );
  }
  if (!query.data?.length) {
    return (
      <EmptyState
        icon={Factory}
        title="ยังไม่มีศูนย์งาน"
        description="เพิ่มศูนย์งานก่อนปล่อยใบสั่งผลิต"
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end px-1">
        <ProductionFreshness
          updatedAt={query.dataUpdatedAt}
          isFetching={query.isFetching && !query.isLoading}
          stale={query.isError && Boolean(query.data)}
        />
      </div>
      {query.isError ? (
        <Alert variant="warning">ข้อมูลศูนย์งานล่าสุดอาจยังไม่ครบ</Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {query.data.map((center) => (
          <CenterCard
            key={center.workCenter.id}
            center={center}
            selected={center.workCenter.code === selectedCode}
          />
        ))}
      </div>
    </div>
  );
}

function ExceptionDesktopRows({ items }: { items: readonly ExceptionItem[] }) {
  return (
    <DataTable.Root>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ปัญหา</DataTable.Th>
          <DataTable.Th>งานผลิต</DataTable.Th>
          <DataTable.Th>ศูนย์งาน</DataTable.Th>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.Th>แจ้งเมื่อ</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {items.map((item) => {
          const severity = exceptionSeverityMeta(item.severity);
          const state = exceptionStatusMeta(item.state);
          const disposition = dispositionLabel(item.disposition);
          return (
            <DataTable.Row key={item.id} href={`/production/${item.production.id}`}>
              <DataTable.Td className="max-w-sm">
                <StatusLabel label={severity.label} tone={severity.tone} />
                <p className="mt-1 font-medium text-strong">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {item.description}
                  </p>
                ) : null}
                {disposition ? (
                  <p className="mt-1 text-xs text-secondary">แนวทาง: {disposition}</p>
                ) : null}
              </DataTable.Td>
              <DataTable.Td>
                <Link
                  href={`/production/${item.production.id}`}
                  className="font-medium text-strong hover:underline"
                >
                  {item.production.order.orderNumber}
                </Link>
                <p className="text-xs text-muted">
                  {item.production.workOrderNumber ?? "ยังไม่มีเลขใบผลิต"}
                </p>
              </DataTable.Td>
              <DataTable.Td>{item.workCenter?.name ?? "ยังไม่ระบุ"}</DataTable.Td>
              <DataTable.Td>
                <StatusLabel label={state.label} tone={state.tone} />
              </DataTable.Td>
              <DataTable.Td className="whitespace-nowrap text-xs text-muted">
                {formatDateTime(item.createdAt)}
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function ExceptionMobileCards({ items }: { items: readonly ExceptionItem[] }) {
  return (
    <ul aria-label="รายการปัญหาการผลิต" className="space-y-3">
      {items.map((item) => {
        const severity = exceptionSeverityMeta(item.severity);
        const state = exceptionStatusMeta(item.state);
        return (
          <li key={item.id}>
            <Link
              href={`/production/${item.production.id}`}
              className={cn("card-surface card-surface-hover block rounded-2xl p-5", FOCUS_BUTTON)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusLabel label={severity.label} tone={severity.tone} />
                <StatusLabel label={state.label} tone={state.tone} />
              </div>
              <p className="mt-3 font-semibold text-strong">{item.title}</p>
              <p className="mt-1 text-sm text-secondary">
                {item.production.order.orderNumber} ·{" "}
                {item.workCenter?.name ?? "ยังไม่ระบุศูนย์งาน"}
              </p>
              <p className="mt-2 text-xs text-muted">
                แจ้งเมื่อ {formatDateTime(item.createdAt)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ExceptionsView() {
  const list = useListPageState();
  const state = oneOf(list.searchParams.get("exception"), EXCEPTION_STATES);
  const severity = oneOf(list.searchParams.get("severity"), EXCEPTION_SEVERITIES);
  const centerCode = list.searchParams.get("center") ?? "";
  const centersQuery = trpc.manufacturing.workCenterLoad.useQuery();
  const center = centersQuery.data?.find(
    (item) => item.workCenter.code === centerCode,
  );
  const waiting = Boolean(centerCode) && centersQuery.isLoading;
  const missing = Boolean(centerCode) && !centersQuery.isLoading && !center;
  const query = trpc.manufacturing.exceptionList.useInfiniteQuery(
    { state, severity, workCenterId: center?.workCenter.id, limit: 30 },
    {
      enabled: !waiting && !missing,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  );
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items),
    [query.data],
  );
  const hasFilters = Boolean(state || severity || centerCode);
  if (centerCode && centersQuery.isError && !centersQuery.data) {
    return (
      <QueryError
        message="โหลดศูนย์งานสำหรับตัวกรองไม่สำเร็จ"
        onRetry={() => centersQuery.refetch()}
      />
    );
  }
  if (missing) {
    return (
      <EmptyState
        icon={Factory}
        title="ไม่พบศูนย์งานนี้"
        action={
          <Button
            variant="outline"
            onClick={() => list.replaceListState({ center: null })}
          >
            ดูทุกศูนย์งาน
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end px-1">
        <ProductionFreshness
          updatedAt={query.dataUpdatedAt}
          isFetching={query.isFetching && !query.isLoading && !query.isFetchingNextPage}
          stale={query.isError && Boolean(items?.length)}
        />
      </div>
      <Toolbar>
        <ToolbarGroup className="flex-wrap">
          <Select
            surface="raised"
            aria-label="กรองสถานะปัญหา"
            value={state ?? ""}
            onChange={(event) =>
              list.replaceListState({ exception: event.target.value || null })
            }
            className="min-w-40"
          >
            <option value="">ทุกสถานะ</option>
            {EXCEPTION_STATES.map((value) => (
              <option key={value} value={value}>
                {exceptionStatusMeta(value).label}
              </option>
            ))}
          </Select>
          <Select
            surface="raised"
            aria-label="กรองความรุนแรง"
            value={severity ?? ""}
            onChange={(event) =>
              list.replaceListState({ severity: event.target.value || null })
            }
            className="min-w-36"
          >
            <option value="">ทุกระดับ</option>
            {EXCEPTION_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {exceptionSeverityMeta(value).label}
              </option>
            ))}
          </Select>
          <Select
            surface="raised"
            aria-label="กรองศูนย์งาน"
            value={centerCode}
            onChange={(event) =>
              list.replaceListState({ center: event.target.value || null })
            }
            className="min-w-40"
            disabled={centersQuery.isLoading || centersQuery.isError}
          >
            <option value="">ทุกศูนย์งาน</option>
            {(centersQuery.data ?? []).map((item) => (
              <option key={item.workCenter.id} value={item.workCenter.code}>
                {item.workCenter.name}
              </option>
            ))}
          </Select>
        </ToolbarGroup>
      </Toolbar>
      {query.isError && items?.length ? (
        <Alert variant="warning">
          กำลังแสดงข้อมูลปัญหาที่โหลดไว้ ข้อมูลล่าสุดอาจยังไม่ครบ
        </Alert>
      ) : null}
      <ResponsiveList
        items={items}
        isLoading={query.isLoading || waiting}
        isError={query.isError}
        errorMessage="โหลดรายการปัญหาไม่สำเร็จ"
        onRetry={() => query.refetch()}
        emptyState={
          <EmptyState
            icon={hasFilters ? SearchX : AlertCircle}
            title={
              hasFilters ? "ไม่พบปัญหาที่ตรงกับตัวกรอง" : "ไม่มีปัญหาในงานผลิต"
            }
            description={
              hasFilters
                ? "ลองเปลี่ยนตัวกรอง"
                : "เมื่อมีการแจ้งปัญหา รายการจะปรากฏที่นี่"
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    list.replaceListState({
                      exception: null,
                      severity: null,
                      center: null,
                    })
                  }
                >
                  ล้างตัวกรอง
                </Button>
              ) : undefined
            }
          />
        }
        renderDesktop={(rows) => <ExceptionDesktopRows items={rows} />}
        renderMobile={(rows) => <ExceptionMobileCards items={rows} />}
        pagination={
          items?.length ? (
            <LoadMore
              hasNextPage={Boolean(query.hasNextPage)}
              isFetchingNextPage={query.isFetchingNextPage}
              count={items.length}
              onLoadMore={() => void query.fetchNextPage()}
            />
          ) : null
        }
      />
    </div>
  );
}

function ProductionV2WorkspaceContent() {
  const list = useListPageState();
  const router = useRouter();
  const view = workspaceView(list.searchParams.get("view"));
  const selectedCenter = list.searchParams.get("center") ?? "";
  const createOrderId = list.searchParams.get("create");
  const title =
    view === "outsource"
      ? "งานร้านนอก"
      : view === "exceptions"
        ? "ปัญหาในการผลิต"
        : view === "work-centers"
          ? "ศูนย์งาน"
          : "การผลิต";
  const description =
    view === "outsource"
      ? "ติดตามงานที่ส่งผลิตภายนอกในคิวเดียวกับงานโรงงาน"
      : view === "exceptions"
        ? "เห็นปัญหา ผู้รับผิดชอบ และสถานะการแก้ไขจากที่เดียว"
        : view === "work-centers"
          ? "ดูงานค้าง กำลังผลิต และภาระของแต่ละจุดทำงาน"
          : "ค้นหาและควบคุมใบสั่งผลิตทุกงานจากรายการเดียว";

  return (
    <>
      <PageShell
      title={title}
      description={description}
      headerChildren={
        <div className="no-scrollbar overflow-x-auto">
          <SegmentedControl
            semantics="tabs"
            idPrefix="production-view"
            value={view}
            onChange={(next) =>
              list.replaceListState({
                view: next === "all" ? null : next,
                q: null,
                state: null,
                exception: null,
                severity: null,
                center: next === "work-centers" ? selectedCenter || null : null,
                sort: null,
              })
            }
            options={VIEWS}
            aria-label="มุมมองการผลิต"
          />
        </div>
      }
    >
      <div id={`production-view-${view}-panel`} role="tabpanel" aria-labelledby={`production-view-${view}-tab`}>
        {view === "all" ? <WorkOrderList /> : null}
        {view === "work-centers" ? <WorkCentersView selectedCode={selectedCenter} /> : null}
        {view === "exceptions" ? <ExceptionsView /> : null}
        {view === "outsource" ? <LegacyOutsourcePage embedded v2Only /> : null}
      </div>
      </PageShell>
      {createOrderId ? (
        <CreateWorkOrderDialog
          orderId={createOrderId}
          onClose={() => list.replaceListState({ create: null })}
          onCreated={(workOrder) => router.push(`/production/${workOrder.id}`)}
        />
      ) : null}
    </>
  );
}

export function ProductionV2Workspace() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ProductionV2WorkspaceContent />
    </Suspense>
  );
}
