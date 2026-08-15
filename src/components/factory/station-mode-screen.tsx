"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import {
  buildProductionBoard,
} from "@/lib/production-board";
import {
  FACTORY_STATIONS,
  buildFactoryStationQueue,
  factoryStationKeyForOrderStatus,
  factoryStationKeyForStep,
  isFactoryStationKey,
  type FactoryStationKey,
  type FactoryStationQueueEntry,
} from "@/lib/factory-station";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import { StationModeShell, type StationNavItem } from "@/components/factory/station-mode-shell";
import {
  StationQueueView,
  type StationQueueItem,
} from "@/components/factory/station-queue-view";
import { StationOrderWorkspace } from "@/components/factory/station-order-workspace";
import { ProductionDetailScreen } from "@/components/production/production-detail-screen";
import { PrintRunsScreen } from "@/components/production/print-runs-screen";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON, TINT } from "@/components/ui/tokens";
import { cn, formatDate } from "@/lib/utils";
import {
  Flame,
  PackageCheck,
  Printer,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Shirt,
} from "lucide-react";

type KanbanOrder = RouterOutput["factory"]["stationQueue"][number];
type KanbanStep = KanbanOrder["productions"][number]["steps"][number];
type ScanResolution = RouterOutput["factory"]["resolveStationScan"];
type MultipleResolution = Extract<ScanResolution, { kind: "multiple" }>;

function productionChoiceSummary(
  production: MultipleResolution["productions"][number],
  index: number,
) {
  const current = production.steps.find(
    (step) => step.stepType !== "PACKAGING" && step.status !== "COMPLETED",
  );
  const fallback = [...production.steps]
    .reverse()
    .find((step) => step.stepType !== "PACKAGING");
  const step = current ?? fallback;
  const stepName = step
    ? step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType
    : "ไม่มีขั้นผลิต";
  const status = step
    ? (STEP_STATUS_LABELS[step.status as keyof typeof STEP_STATUS_LABELS] ?? step.status)
    : production.status;
  return {
    title: `ใบผลิต ${index + 1} · ${stepName}`,
    detail: `${status} · เปิด ${formatDate(production.createdAt)}`,
  };
}

type StationEntry = FactoryStationQueueEntry & {
  customerName: string | null;
  stepLabel: string;
  overdue: boolean;
  assignedToId: string | null;
};

const STATION_VISUALS: Record<
  FactoryStationKey,
  {
    shortLabel: string;
    description: string;
    icon: typeof Shirt;
  }
> = {
  prep: {
    shortLabel: "เตรียมเสื้อ",
    description: "เบิกเสื้อจากสต๊อคหรือตรวจรับเสื้อลูกค้า",
    icon: Shirt,
  },
  "dtf-print": {
    shortLabel: "พิมพ์ DTF",
    description: "รวมคิวเข้ารอบ พิมพ์ ตัดแยก และติดป้าย",
    icon: Printer,
  },
  "heat-press": {
    shortLabel: "รีดร้อน",
    description: "เห็นเฉพาะงานที่ฟิล์มและเสื้อพร้อมแล้ว",
    icon: Flame,
  },
  qc: {
    shortLabel: "QC",
    description: "นับของดีและของเสียก่อนเข้าคิวแพ็ก",
    icon: ShieldCheck,
  },
  "final-pack": {
    shortLabel: "แพ็ก",
    description: "นับใส่ใบส่งให้ครบ แล้วส่งต่อเป็นพร้อมส่ง",
    icon: PackageCheck,
  },
};

const STATION_NAV: readonly StationNavItem<FactoryStationKey>[] = FACTORY_STATIONS.map(
  (station) => ({
    ...station,
    ...STATION_VISUALS[station.key],
  }),
);

function routeFor({
  station,
  productionId,
  orderId,
}: {
  station?: FactoryStationKey | null;
  productionId?: string | null;
  orderId?: string | null;
}) {
  const params = new URLSearchParams();
  if (station) params.set("station", station);
  if (productionId) params.set("productionId", productionId);
  if (orderId) params.set("orderId", orderId);
  const query = params.toString();
  return query ? `/factory/station?${query}` : "/factory/station";
}

function makeStationEntries(
  board: ReturnType<
    typeof buildProductionBoard<KanbanStep, KanbanOrder>
  >,
): StationEntry[] {
  const entries: StationEntry[] = [];
  for (const job of board.jobs) {
    for (const spot of job.spots) {
      const station = spot.step
        ? factoryStationKeyForStep(spot.step.stepType)
        : factoryStationKeyForOrderStatus(job.order.internalStatus);
      if (!station) continue;
      entries.push({
        key: spot.key,
        station,
        orderId: job.order.id,
        productionId: spot.productionId,
        stepId: spot.step?.id ?? null,
        orderNumber: job.order.orderNumber,
        title: job.order.title,
        customerName: job.order.customerName ?? null,
        deadline: job.order.deadline,
        priority: job.order.priority,
        status: !spot.ready ? "ON_HOLD" : (spot.step?.status ?? "PENDING"),
        qtyDone: spot.step?.qtyDone ?? null,
        qtyTotal: spot.step?.qtyTotal ?? null,
        stepLabel:
          spot.step?.customStepName ||
          (spot.step ? STEP_TYPE_LABELS[spot.step.stepType] : null) ||
          spot.stationLabel,
        overdue: job.overdue,
        assignedToId: spot.step?.assignedTo?.id ?? null,
      });
    }
  }
  return entries;
}

export function StationModeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStation = searchParams.get("station");
  const station = rawStation && isFactoryStationKey(rawStation) ? rawStation : null;
  const productionId = searchParams.get("productionId");
  const orderId = searchParams.get("orderId");

  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const stationQueueQuery = trpc.factory.stationQueue.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const utils = trpc.useUtils();
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPending, setScanPending] = useState(false);
  const [multiple, setMultiple] = useState<MultipleResolution | null>(null);

  const canManageProduction = permAllows(me?.permissions, "manage_production");
  const canSupervise = permAllows(me?.permissions, "supervise_operations");
  // จอปฏิบัติงานเป็นของทีมผลิตจริงเท่านั้น: SALES อาจมีสิทธิ์ใบส่ง/เดินสถานะ
  // แต่ไม่มี manage_production จึงต้องเห็นแบบ read-only ไม่ใช่ได้ปุ่มแพ็กจาก OR gate
  const canCreateDelivery =
    canManageProduction && permAllows(me?.permissions, "manage_delivery");
  const canAdvancePacking =
    canManageProduction &&
    permAllows(me?.permissions, "update_order_status_production");
  const readOnly = !!me && !canManageProduction;

  const board = useMemo(
    () =>
      buildProductionBoard<KanbanStep, KanbanOrder>(stationQueueQuery.data ?? [], {
        now:
          stationQueueQuery.dataUpdatedAt > 0
            ? new Date(stationQueueQuery.dataUpdatedAt)
            : new Date(0),
        viewerId: me?.id,
        showBlocked: canSupervise,
      }),
    [stationQueueQuery.data, stationQueueQuery.dataUpdatedAt, me?.id, canSupervise],
  );

  const queueItems = useMemo(() => {
    if (!station || station === "dtf-print") return [];
    const candidates = makeStationEntries(board).filter(
      (entry) =>
        canSupervise ||
        !entry.assignedToId ||
        entry.assignedToId === me?.id,
    );
    const queue = buildFactoryStationQueue(station, candidates);
    return [...queue.active, ...queue.ready].map<StationQueueItem>((entry) => ({
      key: entry.key,
      orderId: entry.orderId,
      productionId: entry.productionId,
      orderNumber: entry.orderNumber,
      title: entry.title,
      customerName: entry.customerName,
      deadline: entry.deadline,
      priority: entry.priority ?? null,
      stepLabel: entry.stepLabel,
      status: entry.status === "IN_PROGRESS" ? "active" : "ready",
      qtyDone: entry.qtyDone ?? null,
      qtyTotal: entry.qtyTotal ?? null,
      overdue: entry.overdue,
    }));
  }, [board, canSupervise, me?.id, station]);

  useEffect(() => {
    if (!productionId && !orderId) scanRef.current?.focus();
  }, [productionId, orderId, station]);

  function navigateToContext(result: Exclude<ScanResolution, { kind: "multiple" }>) {
    const nextStation = result.station ?? station;
    setMultiple(null);
    if (result.kind === "production") {
      router.push(routeFor({ station: nextStation, productionId: result.productionId }));
    } else {
      router.push(routeFor({ station: nextStation, orderId: result.orderId }));
    }
    setScanValue("");
    setScanError(null);
  }

  async function handleScan(event: React.FormEvent) {
    event.preventDefault();
    const value = scanValue.trim();
    if (!value) {
      setScanError("พิมพ์หรือสแกนเลขออเดอร์ก่อน");
      scanRef.current?.focus();
      return;
    }
    setScanPending(true);
    setScanError(null);
    setMultiple(null);
    try {
      const result = await utils.factory.resolveStationScan.fetch({ value });
      if (result.kind === "multiple") {
        setMultiple(result);
      } else {
        navigateToContext(result);
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "ไม่พบงานจากข้อมูลที่สแกน");
      scanRef.current?.focus();
    } finally {
      setScanPending(false);
    }
  }

  function selectStation(next: FactoryStationKey) {
    setMultiple(null);
    setScanError(null);
    router.push(routeFor({ station: next }));
  }

  function openQueueItem(item: StationQueueItem) {
    router.push(
      routeFor({
        station,
        productionId: item.productionId,
        orderId: item.productionId ? null : item.orderId,
      }),
    );
  }

  const visual = station ? STATION_VISUALS[station] : null;
  const loadingInitial =
    (meQuery.isLoading && !me) ||
    (stationQueueQuery.isLoading && !stationQueueQuery.data);
  const initialError =
    (meQuery.isError && !me) ||
    (stationQueueQuery.isError && !stationQueueQuery.data);

  return (
    <StationModeShell
      stations={STATION_NAV}
      station={station}
      userName={me?.name}
      readOnly={readOnly}
      onSelectStation={selectStation}
    >
      <div className="space-y-6">
        <section className="card-surface rounded-2xl p-4 sm:p-5" aria-labelledby="station-scan-title">
          <div className="grid gap-4 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(24rem,1.3fr)] lg:items-end">
            <div>
              <div className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-blue-400" aria-hidden="true" />
                <h1 id="station-scan-title" className="text-lg font-semibold text-strong">
                  เปิดงานด้วยเลขออเดอร์หรือ QR
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted">
                สแกนมีหน้าที่เปิดใบงานเท่านั้น ระบบจะยังไม่เริ่มหรือปิดงานเอง
              </p>
            </div>
            <form onSubmit={handleScan} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="factory-station-scan" className="sr-only">
                เลขออเดอร์หรือข้อมูลจาก QR
              </label>
              <div className="relative min-w-0 flex-1">
                <QrCode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <Input
                  ref={scanRef}
                  id="factory-station-scan"
                  value={scanValue}
                  onChange={(event) => {
                    setScanValue(event.target.value);
                    if (scanError) setScanError(null);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="เช่น ORD-2608-0041"
                  aria-invalid={!!scanError || undefined}
                  aria-describedby={scanError ? "factory-station-scan-error" : undefined}
                  className="pl-10 text-base sm:text-base"
                />
              </div>
              <Button type="submit" disabled={scanPending} aria-busy={scanPending || undefined}>
                <Search />
                {scanPending ? "กำลังค้นหา..." : "เปิดงาน"}
              </Button>
            </form>
          </div>
          {scanError && (
            <p id="factory-station-scan-error" role="alert" className="mt-3 text-sm text-red-300">
              {scanError}
            </p>
          )}
          {multiple && (
            <div
              aria-live="polite"
              className={cn(TINT.warning, "mt-4 rounded-xl border p-4")}
            >
              <p className="font-medium text-amber-100">
                {multiple.orderNumber} มีหลายใบผลิต — เลือกใบที่อยู่ตรงหน้า
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {multiple.productions.map((production, index) => {
                  const summary = productionChoiceSummary(production, index);
                  return (
                    <Button
                      key={production.id}
                      variant="outline"
                      onClick={() =>
                        navigateToContext({
                          kind: "production",
                          productionId: production.id,
                          productionStatus: production.status,
                          orderId: multiple.orderId,
                          orderNumber: multiple.orderNumber,
                          internalStatus: multiple.internalStatus,
                          station: multiple.station,
                        })
                      }
                      className="h-auto min-h-14 justify-start gap-3 py-2 text-left"
                    >
                      <Printer className="shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{summary.title}</span>
                        <span className="block truncate text-xs font-normal text-muted">
                          {summary.detail}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {loadingInitial ? (
          <div className="space-y-4">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : initialError ? (
          <div className="card-surface rounded-2xl">
            <QueryError
              message={meQuery.isError ? "โหลดสิทธิ์จอประจำสถานีไม่สำเร็จ" : "โหลดคิวสถานีไม่สำเร็จ"}
              onRetry={() => {
                void meQuery.refetch();
                void stationQueueQuery.refetch();
              }}
            />
          </div>
        ) : productionId ? (
          <ProductionDetailScreen
            id={productionId}
            surface="station"
            station={station}
          />
        ) : orderId ? (
          <StationOrderWorkspace
            orderId={orderId}
            station={station}
            canCountQc={canManageProduction}
            canCreateDelivery={canCreateDelivery}
            canAdvancePacking={canAdvancePacking}
            onBack={() => router.push(routeFor({ station }))}
            onOpenProduction={(id) =>
              router.push(routeFor({ station, productionId: id }))
            }
          />
        ) : station === "dtf-print" ? (
          <PrintRunsScreen surface="station" />
        ) : station && visual ? (
          <StationQueueView
            stationLabel={FACTORY_STATIONS.find((item) => item.key === station)?.label ?? visual.shortLabel}
            stationDescription={visual.description}
            icon={visual.icon}
            items={queueItems}
            onOpen={openQueueItem}
          />
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold text-strong">เลือกสถานีที่กำลังทำงาน</h2>
              <p className="mt-1 text-sm text-muted">
                คิวจะแสดงเฉพาะงานที่ลงมือได้จริง ส่วนงานติดด่านยังอยู่ที่บอร์ดหัวหน้า
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {STATION_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectStation(item.key)}
                    className={cn(
                      FOCUS_BUTTON,
                      "card-surface card-surface-hover min-h-40 touch-manipulation rounded-2xl p-5 text-left",
                    )}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="mt-4 block font-semibold text-strong">{item.label}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{item.description}</span>
                  </button>
                );
              })}
            </div>
            {readOnly && (
              <div className="card-surface rounded-2xl">
                <EmptyState
                  icon={ShieldCheck}
                  title="บัญชีนี้ดูคิวได้อย่างเดียว"
                  description="เข้าสู่ระบบด้วยบัญชีพนักงานผลิตเพื่อเริ่ม นับ QC หรือแพ็กงาน"
                />
              </div>
            )}
          </div>
        )}

        {stationQueueQuery.isError && stationQueueQuery.data && (
          <p role="status" className="text-sm text-amber-300">
            คิวล่าสุดอาจยังไม่สด — ระบบกำลังลองเชื่อมต่อใหม่
          </p>
        )}
      </div>
    </StationModeShell>
  );
}
