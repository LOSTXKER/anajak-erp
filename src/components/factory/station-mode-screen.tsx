"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { buildProductionBoard } from "@/lib/production-board";
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
import { currentProductionProblemReason } from "@/lib/production-problem";
import {
  resolveStationContinuation,
  type StationContinuationResult,
} from "@/lib/station-continuation";
import {
  StationModeShell,
  type StationNavItem,
} from "@/components/factory/station-mode-shell";
import {
  StationQueueView,
  tagStationQueueBuckets,
  type StationQueueItem,
} from "@/components/factory/station-queue-view";
import { StationCurrentLayout } from "@/components/factory/station-current-layout";
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
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
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
    ? (STEP_STATUS_LABELS[step.status as keyof typeof STEP_STATUS_LABELS] ??
      step.status)
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
  waitingOn: readonly string[];
  note: string | null;
  sortOrder: number | null;
};

type RoutedStationQueueItem = StationQueueItem & {
  station: FactoryStationKey;
  sortOrder: number | null;
};

function stationLabelFor(key: FactoryStationKey): string {
  return FACTORY_STATIONS.find((station) => station.key === key)?.label ?? key;
}

function continuationActionLabel(item: RoutedStationQueueItem): string {
  const stationLabel = stationLabelFor(item.station);
  if (item.status === "blocked") return `เปิดดูที่สถานี ${stationLabel}`;
  if (item.station === "dtf-print") {
    return item.status === "ready" ? "เปิดรอบพิมพ์ DTF" : "เปิดงาน DTF นี้";
  }
  return `ไป ${stationLabel} ต่อ`;
}

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

const STATION_NAV: readonly StationNavItem<FactoryStationKey>[] =
  FACTORY_STATIONS.map((station) => ({
    ...station,
    ...STATION_VISUALS[station.key],
  }));

const STATION_QUEUE_ORDER_STATUSES = new Set([
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
]);

function routeFor({
  station,
  productionId,
  orderId,
  focusStepId,
}: {
  station?: FactoryStationKey | null;
  productionId?: string | null;
  orderId?: string | null;
  focusStepId?: string | null;
}) {
  const params = new URLSearchParams();
  if (station) params.set("station", station);
  if (productionId) params.set("productionId", productionId);
  if (orderId) params.set("orderId", orderId);
  if (focusStepId) params.set("focusStepId", focusStepId);
  const query = params.toString();
  return query ? `/factory/station?${query}` : "/factory/station";
}

function makeStationEntries(
  board: ReturnType<typeof buildProductionBoard<KanbanStep, KanbanOrder>>,
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
        waitingOn: spot.waitingOn,
        note: spot.step ? currentProductionProblemReason(spot.step) : null,
        sortOrder: spot.step?.sortOrder ?? null,
      });
    }
  }
  return entries;
}

function StationContinuationCard({
  continuation,
  onContinue,
}: {
  continuation: StationContinuationResult<RoutedStationQueueItem>;
  onContinue: (item: RoutedStationQueueItem) => void;
}) {
  const item = continuation.primary;
  const stationLabel = stationLabelFor(item.station);
  const blocked = item.status === "blocked";
  const details = [
    ...new Set(
      [...item.waitingOn, item.note]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const Icon = blocked ? AlertTriangle : CheckCircle2;

  return (
    <section
      className={cn(
        "rounded-3xl border p-5 shadow-sm sm:p-7",
        blocked
          ? "border-amber-800/70 bg-amber-950/25"
          : "border-blue-800/70 bg-blue-950/20",
      )}
      aria-labelledby="station-continuation-title"
      data-station-continuation
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            blocked
              ? "bg-amber-900/50 text-amber-200"
              : "bg-blue-900/50 text-blue-200",
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              blocked ? "text-amber-200" : "text-blue-200",
            )}
          >
            {blocked
              ? "งานต่อของออเดอร์นี้ยังติดเงื่อนไข"
              : "ออเดอร์เดิมมีงานต่อแล้ว"}
          </p>
          <h1
            id="station-continuation-title"
            data-station-current-job-heading
            tabIndex={-1}
            className="mt-1 text-2xl font-semibold text-strong outline-none sm:text-3xl"
          >
            {item.orderNumber} · {stationLabel}
          </h1>
          <p className="mt-2 text-base text-secondary">
            {item.stepLabel}
            {item.customerName ? ` · ${item.customerName}` : ""}
          </p>

          {blocked && details.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm text-amber-100">
              {details.slice(0, 3).map((detail) => (
                <li key={detail} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              ระบบคงออเดอร์เดิมไว้ให้ และจะเปลี่ยนเฉพาะจุดทำงานเมื่อคุณกดไปต่อ
              — ยังไม่เริ่มหรือปิดขั้นให้อัตโนมัติ
            </p>
          )}

          <Button
            type="button"
            onClick={() => onContinue(item)}
            className="mt-5 min-h-12 w-full touch-manipulation sm:w-auto sm:min-w-56"
          >
            {continuationActionLabel(item)}
            <ArrowRight aria-hidden="true" />
          </Button>

          {continuation.alternatives.length > 0 && (
            <div className="mt-5 border-t border-divider pt-4">
              <p className="text-xs font-medium text-muted">
                งานอื่นของออเดอร์นี้
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {continuation.alternatives.slice(0, 3).map((alternative) => (
                  <Button
                    key={[
                      alternative.station,
                      alternative.productionId,
                      alternative.stepId,
                    ].join("|")}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onContinue(alternative)}
                  >
                    {stationLabelFor(alternative.station)} · {alternative.stepLabel}
                  </Button>
                ))}
              </div>
              {continuation.alternativeCount > 3 && (
                <p className="mt-2 text-xs text-muted">
                  และอีก {(continuation.alternativeCount - 3).toLocaleString("th-TH")} จุด
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StationContinuationUnavailableCard({
  orderNumber,
  onBackToQueue,
  onOpenErp,
}: {
  orderNumber: string;
  onBackToQueue: () => void;
  onOpenErp: () => void;
}) {
  return (
    <section
      className="rounded-3xl border border-amber-800/70 bg-amber-950/25 p-5 shadow-sm sm:p-7"
      aria-labelledby="station-continuation-unavailable-title"
      data-station-continuation-unavailable
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-900/50 text-amber-200">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-200">
            ส่งต่ออัตโนมัติไม่ได้
          </p>
          <h1
            id="station-continuation-unavailable-title"
            data-station-current-job-heading
            tabIndex={-1}
            className="mt-1 text-2xl font-semibold text-strong outline-none sm:text-3xl"
          >
            {orderNumber} · ยังไม่พบสถานีถัดไป
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
            ออเดอร์ยังอยู่ในงานโรงงาน แต่จุดถัดไปอาจเป็นงานนอก งานแก้
            หรือถูกมอบหมายให้คนอื่น ระบบจึงไม่เลือกสถานีแทนโดยเดา
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={onBackToQueue} className="min-h-12">
              กลับคิวสถานี
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenErp}
              className="min-h-12"
            >
              เปิดตรวจใน ERP
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StationModeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStation = searchParams.get("station");
  const station =
    rawStation && isFactoryStationKey(rawStation) ? rawStation : null;
  const productionId = searchParams.get("productionId");
  const orderId = searchParams.get("orderId");
  const focusStepId = searchParams.get("focusStepId");

  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const stationQueueQuery = trpc.factory.stationQueue.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const selectedContextInput = productionId
    ? { productionId }
    : orderId
      ? { orderId }
      : null;
  const stationQueueContextQuery = trpc.factory.stationQueueContext.useQuery(
    selectedContextInput ?? {},
    {
      enabled: Boolean(selectedContextInput),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const utils = trpc.useUtils();
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPending, setScanPending] = useState(false);
  const [multiple, setMultiple] = useState<MultipleResolution | null>(null);
  const previousSelectionRef = useRef(
    `${productionId ?? ""}|${orderId ?? ""}|${focusStepId ?? ""}`,
  );
  const contextSyncRef = useRef({ selection: "", queueUpdatedAt: 0 });

  useEffect(() => {
    const selection = `${productionId ?? ""}|${orderId ?? ""}|${focusStepId ?? ""}`;
    const changed = previousSelectionRef.current !== selection;
    previousSelectionRef.current = selection;
    if (!changed || (!productionId && !orderId)) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("[data-station-current-job-heading]")
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [productionId, orderId, focusStepId]);

  useEffect(() => {
    const selection = productionId
      ? `production|${productionId}`
      : orderId
        ? `order|${orderId}`
        : "";
    const queueUpdatedAt = stationQueueQuery.dataUpdatedAt;
    if (!selection || queueUpdatedAt === 0) {
      contextSyncRef.current = { selection, queueUpdatedAt };
      return;
    }
    if (contextSyncRef.current.selection !== selection) {
      contextSyncRef.current = { selection, queueUpdatedAt };
      return;
    }
    if (contextSyncRef.current.queueUpdatedAt === queueUpdatedAt) return;
    contextSyncRef.current.queueUpdatedAt = queueUpdatedAt;
    void stationQueueContextQuery.refetch();
  }, [
    orderId,
    productionId,
    stationQueueContextQuery,
    stationQueueQuery.dataUpdatedAt,
  ]);

  const permissionStale = meQuery.isError && Boolean(me);
  const canManageProduction =
    !permissionStale && permAllows(me?.permissions, "manage_production");
  const canSupervise =
    !permissionStale && permAllows(me?.permissions, "supervise_operations");
  // จอปฏิบัติงานเป็นของทีมผลิตจริงเท่านั้น: SALES อาจมีสิทธิ์ใบส่ง/เดินสถานะ
  // แต่ไม่มี manage_production จึงต้องเห็นแบบ read-only ไม่ใช่ได้ปุ่มแพ็กจาก OR gate
  const canCreateDelivery =
    canManageProduction && permAllows(me?.permissions, "manage_delivery");
  const canAdvancePacking =
    canManageProduction &&
    permAllows(me?.permissions, "update_order_status_production");
  const readOnly = !!me && !canManageProduction;

  const stationOrders = useMemo(() => {
    const rows = stationQueueQuery.data ?? [];
    const exact = stationQueueContextQuery.data;
    if (!exact) return rows;
    const withoutExact = rows.filter((order) => order.id !== exact.id);
    return STATION_QUEUE_ORDER_STATUSES.has(exact.internalStatus)
      ? [exact, ...withoutExact]
      : withoutExact;
  }, [stationQueueContextQuery.data, stationQueueQuery.data]);

  const board = useMemo(
    () =>
      buildProductionBoard<KanbanStep, KanbanOrder>(
        stationOrders,
        {
          now:
            stationQueueQuery.dataUpdatedAt > 0
              ? new Date(stationQueueQuery.dataUpdatedAt)
              : new Date(0),
          viewerId: me?.id,
          // Station ต้องแยกคิวติดด่านให้เห็น ไม่ปล่อยให้งานหายไปจากหน้างาน.
          // own/unassigned filter ด้านล่างยังคงจำกัดช่าง ส่วนหัวหน้าเห็นทั้งหมด.
          showBlocked: true,
        },
      ),
    [stationOrders, stationQueueQuery.dataUpdatedAt, me?.id],
  );

  const allQueueItems = useMemo(() => {
    const candidates = makeStationEntries(board).filter(
      (entry) =>
        canSupervise || !entry.assignedToId || entry.assignedToId === me?.id,
    );
    const toItem = (
      entry: StationEntry,
      status: StationQueueItem["status"],
    ): RoutedStationQueueItem => ({
      key: entry.key,
      station: entry.station,
      orderId: entry.orderId,
      productionId: entry.productionId,
      stepId: entry.stepId,
      orderNumber: entry.orderNumber,
      title: entry.title,
      customerName: entry.customerName,
      deadline: entry.deadline,
      priority: entry.priority ?? null,
      stepLabel: entry.stepLabel,
      // UI status มาจาก bucket ที่ pure queue model ตัดสินแล้ว ไม่ infer ซ้ำจาก
      // step.status — งาน PENDING ที่ gate block จึงไม่หลุดเป็น "พร้อม".
      status,
      qtyDone: entry.qtyDone ?? null,
      qtyTotal: entry.qtyTotal ?? null,
      overdue: entry.overdue,
      waitingOn: entry.waitingOn,
      note: entry.note,
      sortOrder: entry.sortOrder,
    });
    return FACTORY_STATIONS.flatMap(({ key }) =>
      tagStationQueueBuckets(buildFactoryStationQueue(key, candidates)).map(
        ({ entry, status }) => toItem(entry, status),
      ),
    );
  }, [board, canSupervise, me?.id]);

  const queueItems = useMemo(() => {
    if (!station || station === "dtf-print") return [];
    return allQueueItems.filter((item) => item.station === station);
  }, [allQueueItems, station]);

  const selectedQueueItem = productionId
    ? (queueItems.find(
        (item) =>
          item.productionId === productionId &&
          (!focusStepId || item.stepId === focusStepId),
      ) ?? queueItems.find((item) => item.productionId === productionId))
    : queueItems.find((item) => Boolean(orderId && item.orderId === orderId));
  const selectedStepId = productionId
    ? (selectedQueueItem?.stepId ?? focusStepId)
    : null;

  const selectedOrderContext = useMemo(() => {
    if (stationQueueContextQuery.data) return stationQueueContextQuery.data;
    if (productionId) {
      return (
        stationQueueQuery.data?.find((order) =>
          order.productions.some((production) => production.id === productionId),
        ) ?? null
      );
    }
    if (orderId) {
      return (
        stationQueueQuery.data?.find((order) => order.id === orderId) ?? null
      );
    }
    return null;
  }, [
    orderId,
    productionId,
    stationQueueContextQuery.data,
    stationQueueQuery.data,
  ]);

  const selectedProductionOrderId = productionId
    ? (selectedOrderContext?.id ?? null)
    : null;

  const continuation = useMemo(() => {
    if (
      !station ||
      (!productionId && !orderId) ||
      stationQueueQuery.isError ||
      stationQueueQuery.isLoading ||
      stationQueueContextQuery.isError ||
      stationQueueContextQuery.isLoading
    ) {
      return null;
    }
    return resolveStationContinuation({
      currentStation: station,
      selection: { productionId, orderId },
      productionOrderId: selectedProductionOrderId,
      entries: allQueueItems,
    });
  }, [
    allQueueItems,
    orderId,
    productionId,
    selectedProductionOrderId,
    station,
    stationQueueQuery.isError,
    stationQueueQuery.isLoading,
    stationQueueContextQuery.isError,
    stationQueueContextQuery.isLoading,
  ]);

  const continuationKey = continuation
    ? [
        continuation.primary.station,
        continuation.primary.orderId,
        continuation.primary.productionId,
        continuation.primary.stepId,
      ].join("|")
    : null;

  const selectionStillAtCurrentStation = Boolean(
    station &&
      allQueueItems.some(
        (item) =>
          item.station === station &&
          (productionId
            ? item.productionId === productionId
            : Boolean(orderId && item.orderId === orderId)),
      ),
  );
  const continuationUnavailable = Boolean(
    station &&
      selectedOrderContext &&
      STATION_QUEUE_ORDER_STATUSES.has(selectedOrderContext.internalStatus) &&
      !selectionStillAtCurrentStation &&
      !continuation &&
      !stationQueueQuery.isLoading &&
      !stationQueueQuery.isError &&
      !stationQueueContextQuery.isLoading &&
      !stationQueueContextQuery.isError,
  );
  const continuationFocusKey =
    continuationKey ??
    (continuationUnavailable && selectedOrderContext
      ? `unavailable|${selectedOrderContext.id}`
      : null);

  useEffect(() => {
    if (!continuationFocusKey) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("[data-station-current-job-heading]")
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [continuationFocusKey]);

  const selectedQueueStatus = selectedQueueItem?.status ?? null;

  useEffect(() => {
    if (station && station !== "dtf-print" && !productionId && !orderId) {
      scanRef.current?.focus({ preventScroll: true });
    }
  }, [productionId, orderId, station]);

  function navigateToContext(
    result: Exclude<ScanResolution, { kind: "multiple" }>,
  ) {
    const nextStation = station ?? result.station;
    setMultiple(null);
    if (result.kind === "production") {
      router.push(
        routeFor({ station: nextStation, productionId: result.productionId }),
      );
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
      setScanError(
        error instanceof Error ? error.message : "ไม่พบงานจากข้อมูลที่สแกน",
      );
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

  function changeStation() {
    setMultiple(null);
    setScanError(null);
    setScanValue("");
    router.push(routeFor({}));
  }

  function openQueueItem(item: StationQueueItem) {
    router.push(
      routeFor({
        station,
        productionId: item.productionId,
        orderId: item.productionId ? null : item.orderId,
        focusStepId: item.stepId,
      }),
    );
  }

  function openContinuation(item: RoutedStationQueueItem) {
    const opensDtfBatch =
      item.station === "dtf-print" && item.status === "ready";
    router.replace(
      routeFor({
        station: item.station,
        productionId: opensDtfBatch ? null : item.productionId,
        orderId:
          opensDtfBatch || item.productionId ? null : item.orderId,
        focusStepId: item.stepId,
      }),
    );
  }

  function renderScanPanel(compact: boolean) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-divider bg-surface shadow-sm",
          compact ? "p-3" : "px-4 py-3 sm:px-5",
        )}
        aria-labelledby={
          compact ? "station-rail-scan-title" : "station-scan-title"
        }
        data-station-scan={compact ? "compact" : "full"}
      >
        <div
          className={cn(
            "gap-3",
            compact
              ? "grid"
              : "grid lg:grid-cols-[minmax(13rem,0.55fr)_minmax(24rem,1.45fr)] lg:items-center",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-secondary">
              <ScanLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id={compact ? "station-rail-scan-title" : "station-scan-title"}
                className="text-sm font-semibold text-strong"
              >
                {compact ? "สแกน / ค้นหาเลขงาน" : "เปิดใบงานอื่น"}
              </h2>
              <p className={cn("text-xs text-muted", !compact && "truncate")}>
                สแกนเพื่อเปิดบริบทเท่านั้น ไม่เริ่มหรือปิดงานอัตโนมัติ
              </p>
            </div>
          </div>
          <form
            onSubmit={handleScan}
            className={cn(
              "flex min-w-0 flex-col gap-2",
              !compact && "sm:flex-row",
            )}
          >
            <label htmlFor="factory-station-scan" className="sr-only">
              เลขออเดอร์หรือข้อมูลจาก QR
            </label>
            <div className="relative min-w-0 flex-1">
              <QrCode
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
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
                placeholder={
                  compact
                    ? "เลขออเดอร์หรือ QR"
                    : "เลขออเดอร์หรือ QR เช่น ORD-2608-0041"
                }
                aria-invalid={!!scanError || undefined}
                aria-describedby={
                  scanError ? "factory-station-scan-error" : undefined
                }
                className="pl-10 text-base sm:text-base"
              />
            </div>
            <Button
              type="submit"
              variant={compact ? "outline" : "default"}
              disabled={scanPending}
              aria-busy={scanPending || undefined}
              className={cn(compact && "w-full")}
            >
              <Search />
              {scanPending ? "กำลังค้นหา..." : "เปิดงาน"}
            </Button>
          </form>
        </div>
        {scanError && (
          <p
            id="factory-station-scan-error"
            role="alert"
            className="mt-3 text-sm text-red-300"
          >
            {scanError}
          </p>
        )}
        {multiple && (
          <div
            aria-live="polite"
            className={cn(TINT.warning, "mt-3 rounded-xl border p-3")}
          >
            <p className="text-sm font-medium">
              {multiple.orderNumber} มีหลายใบผลิต — เลือกใบที่อยู่ตรงหน้า
            </p>
            <div
              className={cn(
                "mt-3 grid gap-2",
                !compact && "sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
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
                      <span className="block truncate font-medium">
                        {summary.title}
                      </span>
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
      onChangeStation={changeStation}
    >
      {permissionStale && (
        <div
          role="alert"
          className={cn(
            TINT.warning,
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm",
          )}
        >
          <span>โหลดสิทธิ์ล่าสุดไม่สำเร็จ — ปิดปุ่มทำงานไว้จนกว่าจะตรวจสิทธิ์ได้</span>
          <Button variant="outline" size="sm" onClick={() => void meQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {!station ? (
        <section
          className="mx-auto max-w-6xl py-4 sm:py-8"
          aria-labelledby="station-picker-title"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-300">
              เริ่มงานที่จุดไหน
            </p>
            <h1
              id="station-picker-title"
              className="mt-2 text-2xl font-semibold text-strong sm:text-3xl"
            >
              เลือกสถานีที่กำลังทำงาน
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
              ระบบจะแสดงเฉพาะงานที่สถานีนี้ลงมือได้ พร้อมปุ่มทำงานตามลำดับจริง
            </p>
          </div>

          <ul className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {STATION_NAV.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => selectStation(item.key)}
                    className={cn(
                      FOCUS_BUTTON,
                      "group min-h-36 w-full touch-manipulation rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition-colors hover:border-border-strong hover:bg-interactive-hover xl:h-full",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-module-production-surface text-module-production-text">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-medium tabular-nums text-muted">
                        {index + 1}/{STATION_NAV.length}
                      </span>
                    </span>
                    <span className="mt-4 block font-semibold text-strong">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">
                      {item.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {readOnly && (
            <div className="mt-5 rounded-2xl border border-border bg-surface">
              <EmptyState
                density="compact"
                icon={ShieldCheck}
                title="บัญชีนี้ดูคิวได้อย่างเดียว"
                description="เข้าสู่ระบบด้วยบัญชีพนักงานผลิตเพื่อเริ่ม นับ QC หรือแพ็กงาน"
              />
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {loadingInitial ? (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          ) : initialError ? (
            <div className="card-surface rounded-lg">
              <QueryError
                message={
                  meQuery.isError
                    ? "โหลดสิทธิ์จอประจำสถานีไม่สำเร็จ"
                    : "โหลดคิวสถานีไม่สำเร็จ"
                }
                onRetry={() => {
                  void meQuery.refetch();
                  void stationQueueQuery.refetch();
                }}
              />
            </div>
          ) : productionId || orderId ? (
            <StationCurrentLayout
              items={queueItems}
              selection={{ productionId, orderId, stepId: selectedStepId }}
              scan={renderScanPanel(true)}
              onOpen={openQueueItem}
            >
              {continuation ? (
                <StationContinuationCard
                  continuation={continuation}
                  onContinue={openContinuation}
                />
              ) : continuationUnavailable && selectedOrderContext ? (
                <StationContinuationUnavailableCard
                  orderNumber={selectedOrderContext.orderNumber}
                  onBackToQueue={() => router.replace(routeFor({ station }))}
                  onOpenErp={() =>
                    router.push(
                      productionId
                        ? `/production/${productionId}`
                        : `/orders/${selectedOrderContext.id}?tab=production`,
                    )
                  }
                />
              ) : productionId ? (
                <ProductionDetailScreen
                  id={productionId}
                  surface="station"
                  station={station}
                  stationQueueStatus={selectedQueueStatus}
                  stationFocusStepId={selectedStepId}
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
              ) : null}
            </StationCurrentLayout>
          ) : station === "dtf-print" ? (
            <PrintRunsScreen surface="station" focusStepId={focusStepId} />
          ) : station && visual ? (
            <StationQueueView
              stationLabel={
                FACTORY_STATIONS.find((item) => item.key === station)?.label ??
                visual.shortLabel
              }
              stationDescription={visual.description}
              icon={visual.icon}
              items={queueItems}
              onOpen={openQueueItem}
            />
          ) : null}

          {!productionId && !orderId ? renderScanPanel(false) : null}

          {stationQueueQuery.isError && stationQueueQuery.data && (
            <p
              role="status"
              className="text-sm text-amber-700 dark:text-amber-300"
            >
              คิวล่าสุดอาจยังไม่สด — ระบบกำลังลองเชื่อมต่อใหม่
            </p>
          )}
        </div>
      )}
    </StationModeShell>
  );
}
