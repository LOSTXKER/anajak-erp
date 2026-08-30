"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  ClipboardCheck,
  PackageCheck,
  Play,
  QrCode,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import {
  oldestSuccessfulUpdate,
  ProductionFreshness,
} from "@/components/production/production-freshness";
import {
  nextSameOrderJob,
  primaryStationCommand,
  workCenterCodeFromStationParam,
} from "@/lib/manufacturing-station";
import { cn, formatDateShort } from "@/lib/utils";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusLabel } from "@/components/ui/status-label";
import { Textarea } from "@/components/ui/textarea";
import {
  FOCUS_BUTTON,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
} from "@/components/ui/tokens";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { QcCountDialog } from "@/components/qc/order-qc-section";
import { DtfBatchDialog } from "@/components/factory/dtf-batch-dialog";

type StationDispatch = NonNullable<RouterOutput["manufacturing"]["stationDispatch"]>;
type StationJob = StationDispatch["queue"][number];
type WorkCenterLoad = RouterOutput["manufacturing"]["workCenterLoad"][number];
type ReportLineDelta = {
  quantityLineId: string;
  expectedRevision: number;
  qtyGood: number;
  qtyScrap: number;
  qtyRework: number;
};
type ReportOutputValues = {
  qtyGood: number;
  qtyScrap: number;
  qtyRework: number;
  note?: string;
  quantityLines?: ReportLineDelta[];
};

const STATE_META: Record<string, { label: string; tone: "neutral" | "accent" | "warning" | "danger" | "success" }> = {
  PLANNED: { label: "ยังไม่พร้อม", tone: "neutral" },
  READY: { label: "พร้อมทำ", tone: "accent" },
  RUNNING: { label: "กำลังทำ", tone: "success" },
  BLOCKED: { label: "ติดปัญหา", tone: "danger" },
  COMPLETED: { label: "เสร็จแล้ว", tone: "success" },
  CANCELLED: { label: "ยกเลิก", tone: "neutral" },
};

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cmd-${Date.now()}-${Math.random()}`;
}

function snapshotText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["text", "instruction", "instructions", "note"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function snapshotRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function snapshotString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Station ต้องอ่านภาพจาก snapshot ตอนปล่อยงานเท่านั้น ห้ามตามแบบอนุมัติสดของออเดอร์. */
export function releasedMockupImages(snapshot: unknown) {
  const approved = snapshotRecord(snapshot);
  if (!approved) return [];

  const files = Array.isArray(approved.files)
    ? approved.files.flatMap((value) => {
        const file = snapshotRecord(value);
        if (!file) return [];
        const fileUrl = snapshotString(file.fileUrl);
        const thumbnailUrl = snapshotString(file.thumbnailUrl);
        const url = thumbnailUrl ?? fileUrl;
        if (!url) return [];
        return [{
          url,
          position:
            snapshotString(file.position) ??
            snapshotString(file.caption) ??
            "ม็อกอัพ",
        }];
      })
    : [];
  if (files.length > 0) return files;

  const cover =
    snapshotString(approved.thumbnailUrl) ??
    snapshotString(approved.fileUrl);
  return cover ? [{ url: cover, position: "ม็อกอัพ" }] : [];
}

function mockupImages(job: StationJob) {
  return releasedMockupImages(job.approvedMockupSnapshot);
}

function jobId(job: StationJob) {
  return job.operation.id;
}

function stationJobFromDispatch(
  dispatch: StationDispatch | null | undefined,
  selectedId: string | null,
): StationJob | null {
  if (!dispatch) return null;
  if (selectedId) {
    if (dispatch.currentJob?.operation.id === selectedId) return dispatch.currentJob;
    return dispatch.queue.find((job) => job.operation.id === selectedId) ?? null;
  }
  return dispatch.currentJob;
}

export function ManufacturingStationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const legacyStation = searchParams.get("station");
  const selectedFromUrl = workCenterCodeFromStationParam(legacyStation);
  const selectedOperationId = searchParams.get("jobId") ?? searchParams.get("focusStepId");
  const selectedOrderId = searchParams.get("orderId");
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string | null>(selectedFromUrl);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<StationJob | null>(null);
  const [pauseTarget, setPauseTarget] = useState<StationJob | null>(null);
  const [exceptionTarget, setExceptionTarget] = useState<StationJob | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<StationJob | null>(null);
  const [returnReceiptTarget, setReturnReceiptTarget] =
    useState<StationJob | null>(null);
  const [qualityTarget, setQualityTarget] = useState<StationJob | null>(null);
  const [reinspectionTarget, setReinspectionTarget] =
    useState<StationJob | null>(null);
  const [lastCompleted, setLastCompleted] = useState<{
    operationId: string;
    orderId: string;
    workOrderId: string;
    orderNumber: string;
  } | null>(null);

  const workCenters = trpc.manufacturing.workCenterLoad.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const stationWorkCenters = (workCenters.data ?? []).filter(
    (center) => center.availableForStation,
  );
  const selectedAvailableCenter = stationWorkCenters.find(
    (center) => center.workCenter.code === selectedWorkCenter,
  );
  const effectiveWorkCenter =
    selectedAvailableCenter?.workCenter.code ??
    stationWorkCenters[0]?.workCenter.code ??
    null;

  const dispatch = trpc.manufacturing.stationDispatch.useQuery(
    { workCenterCode: effectiveWorkCenter ?? "", limit: 50 },
    {
      enabled: Boolean(effectiveWorkCenter),
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  );
  const selectedInDispatch = stationJobFromDispatch(dispatch.data, selectedOperationId);
  const deepJob = trpc.manufacturing.stationJob.useQuery(
    { operationJobId: selectedOperationId ?? "" },
    { enabled: Boolean(selectedOperationId && !selectedInDispatch) },
  );
  const orderContext = trpc.manufacturing.stationOrderContext.useQuery(
    { orderId: selectedOrderId ?? "" },
    { enabled: Boolean(selectedOrderId && !selectedOperationId) },
  );
  const currentJob =
    selectedOrderId && !selectedOperationId
      ? null
      : selectedInDispatch ?? deepJob.data ?? null;
  const prepContext = trpc.goodsReceipt.context.useQuery(
    {
      orderId: currentJob?.order.id ?? "",
      receiptType: "CUSTOMER_GARMENT",
    },
    {
      enabled: currentJob?.operation.code === "PREP",
      gcTime: 0,
      staleTime: 0,
    },
  );
  const prepCustomerRemaining = (prepContext.data?.lines ?? []).reduce(
    (sum, line) =>
      sum + Math.max(0, line.qtyExpected - line.qtyReceivedNet),
    0,
  );
  const prepHasCustomerProducts = (prepContext.data?.lines.length ?? 0) > 0;
  const prepCustomerReturnable = (prepContext.data?.lines ?? []).reduce(
    (sum, line) => sum + line.qtyReturnable,
    0,
  );
  const prepHasStockProducts = Boolean(
    currentJob?.workGroups.some((group) =>
      group.products.some((product) => product.itemSource !== "CUSTOMER_PROVIDED"),
    ),
  );
  const prepNeedsReceipt =
    prepHasCustomerProducts &&
    (prepCustomerRemaining > 0 ||
      (currentJob?.operation.quantities.good ?? 0) === 0);

  const handoffJobs = trpc.manufacturing.stationHandoff.useQuery(
    {
      workOrderId: lastCompleted?.workOrderId ?? "",
      completedOperationId: lastCompleted?.operationId ?? "",
    },
    {
      enabled: Boolean(lastCompleted),
      refetchOnWindowFocus: true,
    },
  );

  const sameOrderHandoff = useMemo(() => {
    if (!lastCompleted || !handoffJobs.data) return null;
    const candidates = handoffJobs.data.map((job) => ({
      id: job.operation.id,
      state: job.operation.state,
      order: { id: lastCompleted.orderId },
      quantities: job.operation.quantities,
      availableCommands: job.operation.availableCommands,
      operation: job.operation,
    }));
    return nextSameOrderJob(
      candidates,
      lastCompleted.orderId,
      lastCompleted.operationId,
    )?.operation ?? null;
  }, [handoffJobs.data, lastCompleted]);

  async function refreshManufacturing(operationJobId?: string) {
    await Promise.all([
      utils.manufacturing.stationDispatch.invalidate(),
      operationJobId
        ? utils.manufacturing.stationJob.invalidate({ operationJobId })
        : Promise.resolve(),
      utils.manufacturing.workCenterLoad.invalidate(),
      utils.manufacturing.controlList.invalidate(),
    ]);
  }

  const startOperation = trpc.manufacturing.startOperation.useMutation({
    onSuccess: async (_, input) => {
      toast.success("เริ่มงานแล้ว");
      await refreshManufacturing(input.operationJobId);
    },
    onError: (error) => toast.error(error.message),
  });
  const pauseOperation = trpc.manufacturing.pauseOperation.useMutation({
    onSuccess: async (_, input) => {
      setPauseTarget(null);
      toast.success("พักงานแล้ว");
      await refreshManufacturing(input.operationJobId);
    },
    onError: (error) => toast.error(error.message),
  });
  const reportOutput = trpc.manufacturing.reportOutput.useMutation({
    onSuccess: async (_, input) => {
      setReportTarget(null);
      toast.success("บันทึกผลงานแล้ว");
      await refreshManufacturing(input.operationJobId);
    },
    onError: (error) => toast.error(error.message),
  });
  const reinspectQuality = trpc.manufacturing.reportOutput.useMutation({
    onSuccess: async (_, input) => {
      setReinspectionTarget(null);
      toast.success("บันทึกผลตรวจซ้ำแล้ว");
      await refreshManufacturing(input.operationJobId);
    },
    onError: (error) => toast.error(error.message),
  });
  const completeOperation = trpc.manufacturing.completeOperation.useMutation({
    onSuccess: async (_, input) => {
      if (currentJob) {
        setLastCompleted({
          operationId: currentJob.operation.id,
          orderId: currentJob.order.id,
          workOrderId: currentJob.workOrder.id,
          orderNumber: currentJob.order.orderNumber,
        });
      }
      selectJob(null);
      toast.success("ปิดงานแล้ว");
      await refreshManufacturing(input.operationJobId);
    },
    onError: (error) => toast.error(error.message),
  });
  const raiseException = trpc.manufacturing.raiseException.useMutation({
    onSuccess: async (_, input) => {
      setExceptionTarget(null);
      toast.success("ส่งปัญหาให้หัวหน้าแล้ว");
      await refreshManufacturing(input.operationJobId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  function replaceParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`/factory/station?${next.toString()}`);
  }

  function chooseWorkCenter(code: string) {
    setSelectedWorkCenter(code);
    setLastCompleted(null);
    replaceParams({ station: code, jobId: null, focusStepId: null, productionId: null, orderId: null, dtfBatch: null });
  }

  function selectJob(id: string | null) {
    replaceParams({ jobId: id, focusStepId: null, productionId: null, orderId: null, dtfBatch: null });
  }

  function openOrderContextJob(job: StationJob) {
    const workCenterCode = job.operation.workCenter?.code;
    if (!workCenterCode) return;
    setSelectedWorkCenter(workCenterCode);
    setLastCompleted(null);
    replaceParams({
      station: workCenterCode,
      jobId: job.operation.id,
      focusStepId: null,
      productionId: null,
      orderId: null,
      dtfBatch: null,
    });
  }

  function openHandoff(operation: NonNullable<typeof sameOrderHandoff>) {
    if (!operation.workCenter) return;
    setSelectedWorkCenter(operation.workCenter.code);
    setLastCompleted(null);
    replaceParams({
      station: operation.workCenter.code,
      jobId: operation.id,
      focusStepId: null,
      productionId: null,
      orderId: null,
    });
  }

  function handleScan() {
    const raw = scanValue.trim();
    if (!raw) return;
    let candidate = raw;
    try {
      const url = new URL(raw, window.location.origin);
      const scannedOrderId = url.searchParams.get("orderId");
      if (scannedOrderId) {
        setScanError(null);
        setScanValue("");
        setLastCompleted(null);
        replaceParams({
          orderId: scannedOrderId,
          jobId: null,
          focusStepId: null,
          productionId: null,
          dtfBatch: null,
        });
        return;
      }
      candidate = url.searchParams.get("jobId") ?? url.searchParams.get("focusStepId") ?? raw;
    } catch {
      // เครื่องสแกนอาจส่งเพียงเลขงาน/operation id ซึ่งค้นในคิวได้ตรง ๆ
    }
    if (!dispatch.data) {
      setScanError("คิวของสถานีนี้ยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง");
      return;
    }
    const jobs = [
      ...(dispatch.data.currentJob ? [dispatch.data.currentJob] : []),
      ...dispatch.data.queue,
    ];
    const match = jobs.find(
      (job) =>
        job.operation.id === candidate ||
        job.order.orderNumber.toLocaleLowerCase() === candidate.toLocaleLowerCase() ||
        job.workOrder.workOrderNumber?.toLocaleLowerCase() === candidate.toLocaleLowerCase(),
    );
    if (!match) {
      setScanError("ไม่พบงานนี้ในคิวของสถานีที่เลือก");
      return;
    }
    setScanError(null);
    setScanValue("");
    selectJob(match.operation.id);
  }

  const loading = workCenters.isLoading || (Boolean(effectiveWorkCenter) && dispatch.isLoading);
  const initialError =
    (workCenters.isError && !workCenters.data) || (dispatch.isError && !dispatch.data);
  const stale =
    (workCenters.isError && Boolean(workCenters.data)) ||
    (dispatch.isError && Boolean(dispatch.data));

  return (
    <main className="min-h-dvh bg-bg pb-8 text-strong">
      <header className="border-b border-divider bg-chrome px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted">
                Station
              </p>
              <h1 className="text-2xl font-semibold">โหมดสถานี</h1>
              <p className="mt-1 text-sm text-secondary">เลือกจุดทำงาน แล้วทำงานปัจจุบันให้จบทีละงาน</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <ProductionFreshness
                updatedAt={oldestSuccessfulUpdate(
                  workCenters.dataUpdatedAt,
                  dispatch.dataUpdatedAt,
                )}
                isFetching={
                  (workCenters.isFetching && !workCenters.isLoading) ||
                  (dispatch.isFetching && !dispatch.isLoading)
                }
                stale={stale}
                liveSurface
              />
              <Button
                variant="outline"
                onClick={() => {
                  void workCenters.refetch();
                  void dispatch.refetch();
                }}
              >
                <RefreshCw />
                โหลดใหม่
              </Button>
            </div>
          </div>

          <nav aria-label="เลือกจุดทำงาน" className="flex gap-2 overflow-x-auto pb-1">
            {stationWorkCenters.map((center) => (
              <WorkCenterButton
                key={center.workCenter.id}
                center={center}
                selected={effectiveWorkCenter === center.workCenter.code}
                onSelect={() => chooseWorkCenter(center.workCenter.code)}
              />
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 sm:px-6">
        {stale ? (
          <Alert variant="warning">
            กำลังแสดงข้อมูลล่าสุดที่มีอยู่ ปุ่มบันทึกถูกปิดจนกว่าจะเชื่อมต่อใหม่สำเร็จ
          </Alert>
        ) : null}

        {initialError ? (
          <QueryError
            message="โหลดคิวสถานีไม่สำเร็จ"
            onRetry={() => {
              void workCenters.refetch();
              void dispatch.refetch();
            }}
          />
        ) : loading ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="card-surface rounded-2xl p-4"><ListSkeleton rows={5} /></div>
            <div className="card-surface rounded-2xl p-4"><ListSkeleton rows={4} /></div>
          </div>
        ) : !effectiveWorkCenter ? (
          <div className="card-surface rounded-2xl">
            <EmptyState
              icon={ScanLine}
              title="ยังไม่มีจุดทำงาน"
              description="ให้หัวหน้าตั้ง Work Center ก่อนเปิดโหมดสถานี"
            />
          </div>
        ) : !dispatch.data ? (
          <div className="card-surface rounded-2xl">
            <EmptyState
              icon={AlertTriangle}
              title="ไม่พบจุดทำงานนี้"
              description="เลือก Work Center จากรายการด้านบนอีกครั้ง"
            />
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-label="งานปัจจุบัน" className="min-w-0">
              {lastCompleted ? (
                <HandoffCard
                  orderNumber={lastCompleted.orderNumber}
                  nextJob={sameOrderHandoff}
                  loading={handoffJobs.isLoading}
                  error={handoffJobs.isError}
                  onRetry={() => void handoffJobs.refetch()}
                  onOpen={openHandoff}
                />
              ) : null}

              {selectedOrderId && !selectedOperationId ? (
                <StationOrderContext
                  jobs={orderContext.data ?? []}
                  loading={orderContext.isLoading}
                  error={orderContext.isError}
                  onRetry={() => void orderContext.refetch()}
                  onSelect={openOrderContextJob}
                />
              ) : currentJob ? (
                <StationJobPanel
                  job={currentJob}
                  writeBlocked={stale || deepJob.isError}
                  pending={
                    startOperation.isPending ||
                    completeOperation.isPending ||
                    pauseOperation.isPending ||
                    reportOutput.isPending ||
                    reinspectQuality.isPending ||
                    raiseException.isPending
                  }
                  onStart={() =>
                    startOperation.mutate({
                      operationJobId: currentJob.operation.id,
                      commandId: commandId(),
                      expectedRevision: currentJob.operation.revision,
                    })
                  }
                  onComplete={() =>
                    completeOperation.mutate({
                      operationJobId: currentJob.operation.id,
                      commandId: commandId(),
                      expectedRevision: currentJob.operation.revision,
                    })
                  }
                  onReport={() => setReportTarget(currentJob)}
                  onPause={() => setPauseTarget(currentJob)}
                  onRaiseException={() => setExceptionTarget(currentJob)}
                  prepNeedsReceipt={prepNeedsReceipt}
                  prepHasStockProducts={prepHasStockProducts}
                  prepCustomerReturnable={prepCustomerReturnable}
                  onRecordPrep={() =>
                    prepCustomerReturnable > 0
                      ? setReturnReceiptTarget(currentJob)
                      : setReceiptTarget(currentJob)
                  }
                  onRecordQuality={() => setQualityTarget(currentJob)}
                  onReinspectQuality={() => setReinspectionTarget(currentJob)}
                  onManageDtf={() => {
                    replaceParams({ dtfBatch: "open" });
                  }}
                  onManageOutsource={() => router.push("/production?view=outsource")}
                />
              ) : deepJob.isError ? (
                <QueryError
                  message="เปิดงานนี้ไม่ได้ อาจถูกย้ายหรือปิดไปแล้ว"
                  onRetry={() => void deepJob.refetch()}
                />
              ) : (
                <div className="card-surface rounded-2xl">
                  <EmptyState
                    icon={ClipboardCheck}
                    title="เลือกงานจากคิว"
                    description="การเปิดงานเป็นเพียงการดูบริบท ระบบจะไม่เริ่มงานให้เอง"
                  />
                </div>
              )}
            </section>

            <aside className="space-y-4 lg:sticky lg:top-4" aria-label="คิวและสแกนงาน">
              <StationQueue
                dispatch={dispatch.data}
                selectedOperationId={currentJob?.operation.id ?? null}
                onSelect={(job) => selectJob(job.operation.id)}
              />
              <section className="card-surface rounded-2xl p-4" aria-labelledby="station-scan-title">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-muted" aria-hidden="true" />
                  <h2 id="station-scan-title" className="font-semibold">สแกนหรือพิมพ์เลขงาน</h2>
                </div>
                <p className="mt-1 text-xs text-muted">เปิดบริบทเท่านั้น ไม่เริ่มงานอัตโนมัติ</p>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleScan();
                  }}
                >
                  <Input
                    value={scanValue}
                    onChange={(event) => {
                      setScanValue(event.target.value);
                      setScanError(null);
                    }}
                    placeholder="เลขออเดอร์ / QR"
                    aria-invalid={Boolean(scanError)}
                  />
                  {scanError ? <p className="text-sm text-red-300">{scanError}</p> : null}
                  <Button type="submit" variant="outline" className="w-full" disabled={!scanValue.trim()}>
                    <ScanLine />
                    เปิดงาน
                  </Button>
                </form>
              </section>
            </aside>
          </div>
        )}
      </div>

      {reportTarget ? (
        <ReportOutputDialog
          job={reportTarget}
          pending={reportOutput.isPending}
          onClose={() => setReportTarget(null)}
          onSubmit={(values) =>
            reportOutput.mutate({
              operationJobId: reportTarget.operation.id,
              commandId: commandId(),
              expectedRevision: reportTarget.operation.revision,
              ...values,
            })
          }
        />
      ) : null}
      {pauseTarget ? (
        <PauseDialog
          job={pauseTarget}
          pending={pauseOperation.isPending}
          onClose={() => setPauseTarget(null)}
          onSubmit={(reason) =>
            pauseOperation.mutate({
              operationJobId: pauseTarget.operation.id,
              commandId: commandId(),
              expectedRevision: pauseTarget.operation.revision,
              reason: reason || undefined,
            })
          }
        />
      ) : null}
      {exceptionTarget ? (
        <RaiseExceptionDialog
          job={exceptionTarget}
          pending={raiseException.isPending}
          onClose={() => setExceptionTarget(null)}
          onSubmit={(values) =>
            raiseException.mutate({
              workOrderId: exceptionTarget.workOrder.id,
              operationJobId: exceptionTarget.operation.id,
              commandId: commandId(),
              expectedRevision: exceptionTarget.operation.revision,
              ...values,
            })
          }
        />
      ) : null}
      {receiptTarget ? (
        <GoodsReceiptDialog
          orderId={receiptTarget.order.id}
          receiptType="CUSTOMER_GARMENT"
          operationJobId={receiptTarget.operation.id}
          expectedRevision={receiptTarget.operation.revision}
          onClose={() => setReceiptTarget(null)}
          onCreated={() => void refreshManufacturing(receiptTarget.operation.id)}
        />
      ) : null}
      {returnReceiptTarget ? (
        <GoodsReceiptDialog
          orderId={returnReceiptTarget.order.id}
          receiptType="CUSTOMER_RETURN"
          operationJobId={returnReceiptTarget.operation.id}
          expectedRevision={returnReceiptTarget.operation.revision}
          onClose={() => setReturnReceiptTarget(null)}
          onCreated={() =>
            void refreshManufacturing(returnReceiptTarget.operation.id)
          }
        />
      ) : null}
      {qualityTarget ? (
        <QcCountDialog
          orderId={qualityTarget.order.id}
          operationJobId={qualityTarget.operation.id}
          expectedRevision={qualityTarget.operation.revision}
          operationRemaining={qualityTarget.operation.quantities.remaining}
          quantityLines={qualityTarget.quantityLines}
          onClose={() => setQualityTarget(null)}
          onCreated={() => void refreshManufacturing(qualityTarget.operation.id)}
        />
      ) : null}
      {reinspectionTarget && reinspectionTarget.sourceReworkCases[0] ? (
        <ReinspectionDialog
          job={reinspectionTarget}
          rework={reinspectionTarget.sourceReworkCases[0]}
          pending={reinspectQuality.isPending}
          onClose={() => setReinspectionTarget(null)}
          onSubmit={({ quantityLines, ...values }) =>
            reinspectQuality.mutate({
              operationJobId: reinspectionTarget.operation.id,
              commandId: commandId(),
              expectedRevision: reinspectionTarget.operation.revision,
              qtyGood: 0,
              qtyScrap: 0,
              qtyRework: 0,
              quantityLines,
              reworkResolution: {
                reworkCaseId: reinspectionTarget.sourceReworkCases[0]!.id,
                expectedRevision:
                  reinspectionTarget.sourceReworkCases[0]!.revision,
                ...values,
              },
            })
          }
        />
      ) : null}
      {searchParams.get("dtfBatch") === "open" &&
      currentJob?.operation.code === "DTF_PRINT" ? (
        <DtfBatchDialog
          currentOperationId={currentJob.operation.id}
          onClose={() => replaceParams({ dtfBatch: null })}
        />
      ) : null}
    </main>
  );
}

function WorkCenterButton({
  center,
  selected,
  onSelect,
}: {
  center: WorkCenterLoad;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={selected
        ? "min-h-12 shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-left text-white"
        : "min-h-12 shrink-0 rounded-lg bg-surface px-4 py-2 text-left text-secondary transition-colors hover:bg-interactive-hover active:bg-interactive-pressed"}
    >
      <span className="block text-sm font-semibold">{center.workCenter.name}</span>
      <span className="block text-xs opacity-80">
        ทำ {center.running} · รอ {center.ready} · ติด {center.blocked}
      </span>
    </button>
  );
}

function StationQueue({
  dispatch,
  selectedOperationId,
  onSelect,
}: {
  dispatch: StationDispatch;
  selectedOperationId: string | null;
  onSelect: (job: StationJob) => void;
}) {
  const jobs = [
    ...(dispatch.currentJob ? [dispatch.currentJob] : []),
    ...dispatch.queue,
  ];
  return (
    <section className="card-surface overflow-hidden rounded-2xl" aria-labelledby="station-queue-title">
      <div className="border-b border-divider px-4 py-3">
        <h2 id="station-queue-title" className="font-semibold">คิว {dispatch.workCenter.name}</h2>
        <p className="text-xs text-muted">{jobs.length.toLocaleString("th-TH")} งานที่เห็นตามสิทธิ์</p>
      </div>
      {jobs.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="คิวว่าง" description="ยังไม่มีงานพร้อมสำหรับจุดนี้" />
      ) : (
        <ul className="divide-y divide-divider">
          {jobs.map((job) => {
            const meta = STATE_META[job.operation.state] ?? STATE_META.PLANNED;
            return (
              <li key={jobId(job)}>
                <button
                  type="button"
                  onClick={() => onSelect(job)}
                  aria-current={selectedOperationId === job.operation.id ? "true" : undefined}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-interactive-hover active:bg-interactive-pressed aria-[current=true]:bg-interactive-selected"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{job.order.orderNumber}</span>
                      <StatusLabel label={meta.label} tone={meta.tone} />
                    </div>
                    <p className="truncate text-sm text-secondary">{job.operation.name}</p>
                    <p className="text-xs text-muted">
                      เหลือ {job.operation.quantities.remaining.toLocaleString("th-TH")} ชิ้น
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HandoffCard({
  orderNumber,
  nextJob,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  orderNumber: string;
  nextJob: StationJob["operation"] | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (job: StationJob["operation"]) => void;
}) {
  const canOpen = Boolean(nextJob?.workCenter);
  return (
    <Alert variant={error ? "error" : "success"} className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">ปิดงาน {orderNumber} แล้ว</p>
          <p className="text-sm">
            {error
              ? "ค้นหาจุดส่งต่องานไม่สำเร็จ งานเดิมปิดแล้วแต่ยังไม่ควรเดาว่าไม่มีงานถัดไป"
              : loading
              ? "กำลังหาจุดส่งต่องานของออเดอร์เดิม..."
              : nextJob
                ? `ส่งต่อ ${nextJob.name} · ${nextJob.workCenter?.name ?? "ยังไม่ระบุจุดทำงาน"}`
                : "ออเดอร์เดิมไม่มีงานถัดไปรออยู่"}
          </p>
        </div>
        {error ? (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw /> ลองใหม่
          </Button>
        ) : nextJob && canOpen ? (
          <Button variant="outline" onClick={() => onOpen(nextJob)} disabled={loading}>
            ไปจุดงานถัดไป
            <ChevronRight />
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

function StationOrderContext({
  jobs,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  jobs: StationJob[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onSelect: (job: StationJob) => void;
}) {
  if (loading) {
    return <Skeleton className="h-48 rounded-lg" />;
  }
  if (error) {
    return (
      <QueryError
        message="เปิดบริบทจาก QR ไม่สำเร็จ"
        onRetry={onRetry}
      />
    );
  }
  if (jobs.length === 0) {
    return (
      <div className="card-surface rounded-2xl">
        <EmptyState
          icon={QrCode}
          title="ยังไม่มีงานที่ทำได้จาก QR ใบนี้"
          description="งานอาจยังไม่ Release ถูกปิดแล้ว หรือไม่ได้อยู่ใน Work Center ที่บัญชีนี้เข้าถึง"
        />
      </div>
    );
  }
  return (
    <section className="card-surface rounded-2xl p-4" aria-labelledby="station-order-context-title">
      <h2 id="station-order-context-title" className="font-semibold">
        เลือกงานของออเดอร์นี้
      </h2>
      <p className="mt-1 text-sm text-secondary">
        การสแกนเปิดเฉพาะบริบท ระบบจะไม่เริ่มงานให้เอง
      </p>
      <ul className="mt-4 space-y-2">
        {jobs.map((job) => (
          <li key={job.operation.id}>
            <button
              type="button"
              className={cn(
                FOCUS_BUTTON,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-divider px-4 py-3 text-left transition-colors",
              )}
              onClick={() => onSelect(job)}
            >
              <span className="min-w-0">
                <span className="block font-medium text-strong">
                  {job.operation.name}
                </span>
                <span className="block text-sm text-secondary">
                  {job.operation.workCenter?.name ?? "ยังไม่ระบุจุดทำงาน"} · {job.operation.state === "RUNNING" ? "กำลังทำ" : job.operation.state === "BLOCKED" ? "ติดปัญหา" : "พร้อมทำ"}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StationJobPanel({
  job,
  writeBlocked,
  pending,
  onStart,
  onReport,
  onComplete,
  onPause,
  onRaiseException,
  prepNeedsReceipt,
  prepHasStockProducts,
  prepCustomerReturnable,
  onRecordPrep,
  onRecordQuality,
  onReinspectQuality,
  onManageDtf,
  onManageOutsource,
}: {
  job: StationJob;
  writeBlocked: boolean;
  pending: boolean;
  onStart: () => void;
  onReport: () => void;
  onComplete: () => void;
  onPause: () => void;
  onRaiseException: () => void;
  prepNeedsReceipt: boolean;
  prepHasStockProducts: boolean;
  prepCustomerReturnable: number;
  onRecordPrep: () => void;
  onRecordQuality: () => void;
  onReinspectQuality: () => void;
  onManageDtf: () => void;
  onManageOutsource: () => void;
}) {
  const operation = job.operation;
  const meta = STATE_META[operation.state] ?? STATE_META.PLANNED;
  const commands = operation.availableCommands;
  const primary = primaryStationCommand({
    state: operation.state,
    remaining: operation.quantities.remaining,
    availableCommands: commands,
  });
  const images = mockupImages(job);
  const instruction = snapshotText(operation.instructionSnapshot);
  const canPause = commands.includes("pauseOperation");
  const canRaise = commands.includes("raiseException");
  const specializedPrimary =
    primary === "recordPrep"
      ? prepCustomerReturnable > 0
        ? "recordPrep"
        : prepNeedsReceipt
        ? "recordPrep"
        : prepHasStockProducts
          ? null
          : "recordPrep"
      : primary;

  const primaryLabel =
    specializedPrimary === "startOperation"
      ? `เริ่ม ${operation.name}`
      : specializedPrimary === "reportOutput"
        ? "บันทึกจำนวนที่ทำได้"
        : specializedPrimary === "completeOperation"
          ? "ยืนยันงานเสร็จ"
          : specializedPrimary === "recordPrep"
            ? prepCustomerReturnable > 0
              ? `คืนเสื้อลูกค้า ${prepCustomerReturnable} ตัว`
              : prepCustomerActionLabel(prepNeedsReceipt)
            : specializedPrimary === "manageDtfBatch"
              ? "จัดการรอบพิมพ์ DTF"
              : specializedPrimary === "recordQuality"
                ? "ตรวจนับ QC"
                : specializedPrimary === "reinspectQuality"
                  ? "ตรวจงานแก้ซ้ำ"
                : specializedPrimary === "manageOutsource"
                  ? "เปิดงานประสานร้านนอก"
          : null;
  const primaryIcon =
    specializedPrimary === "startOperation"
      ? <Play />
      : specializedPrimary === "completeOperation"
        ? <PackageCheck />
        : <ClipboardCheck />;

  return (
    <article className="card-surface overflow-hidden rounded-2xl">
      <div className="border-b border-divider p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-strong">{job.order.orderNumber}</span>
              <StatusLabel label={meta.label} tone={meta.tone} emphasize={operation.state === "BLOCKED"} />
            </div>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{operation.name}</h2>
            <p className="mt-1 text-secondary">{job.order.customerName}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted">กำหนดส่ง</p>
            <p className="font-semibold">{job.order.deadline ? formatDateShort(job.order.deadline) : "ยังไม่ระบุ"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 pb-32 sm:p-6 sm:pb-28">
        {operation.blockers.length > 0 ? (
          <Alert variant="error" title="งานนี้ติดปัญหา">
            {operation.blockers.map((blocker) => blocker.title).join(" · ")}
          </Alert>
        ) : null}

        <section aria-labelledby="station-qty-title">
          <h3 id="station-qty-title" className="text-sm font-semibold text-secondary">จำนวนงาน</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuantityStat label="ต้องได้" value={operation.quantities.planned} />
            <QuantityStat label="ของดี" value={operation.quantities.good} tone="success" />
            <QuantityStat label="ของเสีย" value={operation.quantities.scrap} tone="danger" />
            <QuantityStat label="ยังขาด" value={operation.quantities.remaining} tone="warning" />
          </div>
        </section>

        {images.length > 0 ? (
          <section aria-labelledby="station-mockup-title">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 id="station-mockup-title" className="font-semibold">ภาพที่ลูกค้าอนุมัติ</h3>
                <p className="text-xs text-muted">ตำแหน่งและขนาดให้ยึดตัวเลขในใบงาน</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {images.map((image, index) => (
                <div key={`${image.url}-${index}`} className="space-y-1 text-center">
                  <MockupThumbnail cover={image.url} alt={image.position} size="lg" className="h-28 w-28" />
                  <p className="max-w-28 truncate text-xs text-muted">{image.position}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {instruction ? (
          <section className="rounded-lg bg-surface-muted p-4" aria-labelledby="station-instruction-title">
            <h3 id="station-instruction-title" className="font-semibold">วิธีทำงานนี้</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{instruction}</p>
          </section>
        ) : null}

        {job.quantityLines.length > 0 ? (
          <section aria-labelledby="station-lines-title">
            <h3 id="station-lines-title" className="font-semibold">แยกตามสินค้า / สี / ไซซ์ / จุดพิมพ์</h3>
            <div className="mt-3 overflow-hidden rounded-lg bg-surface-muted">
              <ul className="divide-y divide-divider">
                {job.quantityLines.map((line) => (
                  <li key={line.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="font-medium">{line.description}</p>
                      <p className="text-xs text-muted">
                        {[line.color, line.size, line.printPosition].filter(Boolean).join(" · ") || "รวมทั้งรายการ"}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-secondary">
                      ดี {line.qtyGood}/{line.qtyPlanned} · เสีย {line.qtyScrap} · แก้ {line.qtyRework}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {operation.code === "PREP" && prepHasStockProducts ? (
          <section aria-labelledby="station-prep-stock-title">
            <h3 id="station-prep-stock-title" className="sr-only">
              เบิกและคืนเสื้อจากสต๊อค
            </h3>
            <GarmentPickCard
              productionId={job.workOrder.id}
              operationJobId={operation.id}
              expectedRevision={operation.revision}
              canIssueGarments={commands.includes("recordPrep")}
              canReturnGarments={commands.includes("recordPrep")}
              embedded
              primaryTask={
                !prepNeedsReceipt && operation.quantities.remaining > 0
              }
              stationMode={
                !prepNeedsReceipt && operation.quantities.remaining > 0
              }
            />
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-divider bg-surface/95 p-4 backdrop-blur sm:p-5">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {canRaise ? (
              <Button variant="destructive" onClick={onRaiseException} disabled={pending || writeBlocked}>
                <AlertTriangle />
                แจ้งปัญหา
              </Button>
            ) : null}
            {canPause ? (
              <Button variant="outline" onClick={onPause} disabled={pending || writeBlocked}>
                <CirclePause />
                พักงาน
              </Button>
            ) : null}
          </div>
          {specializedPrimary && primaryLabel ? (
            <Button
              size="lg"
              className="min-h-14 w-full text-base sm:w-auto sm:min-w-64"
              disabled={pending || writeBlocked}
              aria-busy={pending || undefined}
              onClick={
                specializedPrimary === "startOperation"
                  ? onStart
                  : specializedPrimary === "reportOutput"
                    ? onReport
                    : specializedPrimary === "completeOperation"
                      ? onComplete
                      : specializedPrimary === "recordPrep"
                        ? onRecordPrep
                        : specializedPrimary === "recordQuality"
                          ? onRecordQuality
                          : specializedPrimary === "reinspectQuality"
                            ? onReinspectQuality
                          : specializedPrimary === "manageDtfBatch"
                            ? onManageDtf
                            : onManageOutsource
              }
            >
              {primaryIcon}
              {pending ? "กำลังบันทึก..." : primaryLabel}
            </Button>
          ) : operation.code === "PREP" && prepHasStockProducts ? null : (
            <p className="text-sm text-muted">ไม่มี action ที่ทำได้ในสถานะนี้</p>
          )}
        </div>
      </div>
    </article>
  );
}

function prepCustomerActionLabel(needsReceipt: boolean) {
  return needsReceipt ? "รับและตรวจเสื้อลูกค้า" : "บันทึกงานเตรียม";
}

function QuantityStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-green-300"
      : tone === "danger"
        ? "text-red-300"
        : tone === "warning"
          ? "text-amber-300"
          : "text-strong";
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value.toLocaleString("th-TH")}</p>
    </div>
  );
}

function ReportOutputDialog({
  job,
  pending,
  onClose,
  onSubmit,
}: {
  job: StationJob;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: ReportOutputValues) => void;
}) {
  const [qtyGood, setQtyGood] = useState(0);
  const [goodByLine, setGoodByLine] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        job.quantityLines.map((line) => [line.id, 0]),
      ),
  );
  const [note, setNote] = useState("");
  const hasQuantityLines = job.quantityLines.length > 0;
  const lineReports = job.quantityLines
    .map((line) => ({
      quantityLineId: line.id,
      expectedRevision: line.revision,
      qtyGood: goodByLine[line.id] ?? 0,
      qtyScrap: 0,
      qtyRework: 0,
    }))
    .filter((line) => line.qtyGood > 0);
  const reportedGood = hasQuantityLines
    ? lineReports.reduce((sum, line) => sum + line.qtyGood, 0)
    : qtyGood;
  const lineGoodOverPlan = job.quantityLines.some((line) => {
    const delta = goodByLine[line.id] ?? 0;
    return line.qtyGood + delta > line.qtyPlanned;
  });
  const isFinalPack = job.operation.code === "FINAL_PACK";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isFinalPack ? "บันทึกจำนวนที่แพ็กแล้ว" : "บันทึกจำนวนที่ทำได้"}</DialogTitle>
          <DialogDescription>
            {job.order.orderNumber} · บันทึกเฉพาะงานดีตามรายการ หากพบปัญหาให้ใช้ “แจ้งปัญหา”
          </DialogDescription>
        </DialogHeader>
        {hasQuantityLines ? (
          <div className="max-h-[52dvh] space-y-3 overflow-y-auto pr-1">
            {job.quantityLines.map((line) => {
              const good = goodByLine[line.id] ?? 0;
              const remaining = Math.max(0, line.qtyPlanned - line.qtyGood);
              return (
                <div
                  key={line.id}
                  className="grid gap-3 rounded-lg border border-divider p-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-end"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-strong">
                      {line.description || line.sku || "รายการผลิต"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {[line.color, line.size, line.printPosition].filter(Boolean).join(" · ") || "รวมทั้งรายการ"}
                      {` · เหลือ ${remaining.toLocaleString("th-TH")}`}
                    </p>
                  </div>
                  <Field label={isFinalPack ? "แพ็กแล้ว" : "ของดี"}>
                    <NumberInput
                      min={0}
                      max={remaining}
                      integer
                      value={good}
                      onValueChange={(value) =>
                        setGoodByLine((current) => ({ ...current, [line.id]: value }))
                      }
                    />
                  </Field>
                </div>
              );
            })}
          </div>
        ) : (
          <Field label={isFinalPack ? "แพ็กแล้ว" : "ของดี"}>
            <NumberInput min={0} integer value={qtyGood} onValueChange={setQtyGood} />
          </Field>
        )}
        {hasQuantityLines ? (
          <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-secondary">
            รวมรอบนี้ {reportedGood.toLocaleString("th-TH")} ตัว
          </p>
        ) : null}
        <Field label="หมายเหตุ (ถ้ามี)">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <DialogSubmitFooter
          pending={pending}
          disabled={
            reportedGood <= 0 ||
            reportedGood > job.operation.quantities.remaining ||
            lineGoodOverPlan
          }
          submitLabel="บันทึกผลงาน"
          pendingLabel="กำลังบันทึก..."
          onCancel={onClose}
          onSubmit={() =>
            onSubmit({
              qtyGood: reportedGood,
              qtyScrap: 0,
              qtyRework: 0,
              note: note.trim() || undefined,
              ...(hasQuantityLines ? { quantityLines: lineReports } : {}),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

function ReinspectionDialog({
  job,
  rework,
  pending,
  onClose,
  onSubmit,
}: {
  job: StationJob;
  rework: StationJob["sourceReworkCases"][number];
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    qty: number;
    disposition: "GOOD" | "SCRAP";
    quantityLines: ReportLineDelta[];
  }) => void;
}) {
  const sourceQuantityLineId = rework.sourceQcDefect?.quantityLineId ?? null;
  const relevantLines = sourceQuantityLineId
    ? job.quantityLines.filter(
        (line) => line.id === sourceQuantityLineId && line.qtyRework > 0,
      )
    : [];
  const [lineQty, setLineQty] = useState<Record<string, number>>(() => {
    let unallocated = rework.qty;
    return Object.fromEntries(
      relevantLines.map((line) => {
        const qty = Math.min(line.qtyRework, unallocated);
        unallocated -= qty;
        return [line.id, qty];
      }),
    );
  });
  const [disposition, setDisposition] = useState<"GOOD" | "SCRAP">("GOOD");
  const qty = Object.values(lineQty).reduce((sum, value) => sum + value, 0);
  const lineInvalid = relevantLines.some(
    (line) => (lineQty[line.id] ?? 0) < 0 || (lineQty[line.id] ?? 0) > line.qtyRework,
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ตรวจงานแก้ซ้ำ</DialogTitle>
          <DialogDescription>
            {job.order.orderNumber} · กลับมาจาก {rework.targetWorkCenter.name} ·
            ต้องตรวจ {rework.qty.toLocaleString("th-TH")} ตัว
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert variant="info">
            {rework.reason} — ผลผ่านจะกลับเข้าเฉพาะยอดของดี ผลไม่ผ่านจะตัดเป็นของเสีย
          </Alert>
          {relevantLines.length === 0 ? (
            <Alert variant="error">
              ไม่พบยอดส่งแก้ตามสินค้า สี ไซซ์ และจุดพิมพ์ กรุณาให้หัวหน้าตรวจรายการงานแก้
            </Alert>
          ) : (
            <div className="space-y-2">
              {relevantLines.map((line) => (
                <div
                  key={line.id}
                  className="grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-strong">
                      {[line.description, line.color, line.size, line.printPosition]
                        .filter(Boolean)
                        .join(" · ") || "รายการงานแก้"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      รอตรวจซ้ำ {line.qtyRework.toLocaleString("th-TH")} ตัว
                    </p>
                  </div>
                  <Field label="จำนวนที่ตรวจ">
                    <NumberInput
                      min={0}
                      max={line.qtyRework}
                      integer
                      value={lineQty[line.id] ?? 0}
                      onValueChange={(value) =>
                        setLineQty((current) => ({ ...current, [line.id]: value }))
                      }
                    />
                  </Field>
                </div>
              ))}
              <p className="text-right text-sm font-semibold text-strong">
                รวมตรวจซ้ำ {qty.toLocaleString("th-TH")} / {rework.qty.toLocaleString("th-TH")} ตัว
              </p>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">ผลตรวจซ้ำ</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={disposition === "GOOD" ? "default" : "outline"}
                onClick={() => setDisposition("GOOD")}
              >
                <CheckCircle2 />
                ผ่าน
              </Button>
              <Button
                type="button"
                variant={disposition === "SCRAP" ? "destructive" : "outline"}
                onClick={() => setDisposition("SCRAP")}
              >
                <AlertTriangle />
                คัดทิ้ง
              </Button>
            </div>
          </fieldset>
        </div>
        <DialogSubmitFooter
          pending={pending}
          disabled={
            relevantLines.length === 0 ||
            lineInvalid ||
            qty < 1 ||
            qty > rework.qty
          }
          submitLabel={disposition === "GOOD" ? "ยืนยันว่าผ่าน" : "ยืนยันคัดทิ้ง"}
          pendingLabel="กำลังบันทึก..."
          destructive={disposition === "SCRAP"}
          onCancel={onClose}
          onSubmit={() =>
            onSubmit({
              qty,
              disposition,
              quantityLines: relevantLines
                .map((line) => {
                  const lineResolved = lineQty[line.id] ?? 0;
                  return {
                    quantityLineId: line.id,
                    expectedRevision: line.revision,
                    qtyGood: disposition === "GOOD" ? lineResolved : 0,
                    qtyScrap: disposition === "SCRAP" ? lineResolved : 0,
                    qtyRework: lineResolved,
                  };
                })
                .filter((line) => line.qtyRework > 0),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

function PauseDialog({
  job,
  pending,
  onClose,
  onSubmit,
}: {
  job: StationJob;
  pending: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>พัก {job.operation.name}</DialogTitle>
          <DialogDescription>บอกสั้น ๆ ว่าพักเพราะอะไร เพื่อให้คนถัดไปรับช่วงได้</DialogDescription>
        </DialogHeader>
        <Field label="เหตุผลที่พักงาน">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <DialogSubmitFooter
          pending={pending}
          disabled={reason.trim().length < 3}
          submitLabel="พักงาน"
          pendingLabel="กำลังพักงาน..."
          onCancel={onClose}
          onSubmit={() => onSubmit(reason.trim())}
        />
      </DialogContent>
    </Dialog>
  );
}

function RaiseExceptionDialog({
  job,
  pending,
  onClose,
  onSubmit,
}: {
  job: StationJob;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    category: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    blocksJob: boolean;
    note: string;
  }) => void;
}) {
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<"INFO" | "WARNING" | "CRITICAL">("WARNING");
  const [blocksJob, setBlocksJob] = useState(true);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แจ้งปัญหา {job.order.orderNumber}</DialogTitle>
          <DialogDescription>งานที่บล็อกจะหยุดอยู่ที่สถานีนี้จนหัวหน้าแก้ปัญหา</DialogDescription>
        </DialogHeader>
        <Field label="เกิดอะไรขึ้น">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">ระดับความเร่งด่วน</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["INFO", "WARNING", "CRITICAL"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={severity === value ? "default" : "outline"}
                onClick={() => setSeverity(value)}
              >
                {value === "INFO" ? "แจ้งไว้" : value === "WARNING" ? "ต้องดู" : "ด่วนมาก"}
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="flex min-h-12 items-center gap-3 rounded-lg bg-surface-muted px-4 py-3 text-sm">
          <Checkbox
            id="blocks-job"
            checked={blocksJob}
            onChange={(event) => setBlocksJob(event.target.checked)}
            className="h-5 w-5"
          />
          <label htmlFor="blocks-job">หยุดงานนี้ไว้ก่อน</label>
        </div>
        <DialogSubmitFooter
          pending={pending}
          disabled={note.trim().length < 3}
          submitLabel="ส่งให้หัวหน้า"
          pendingLabel="กำลังส่ง..."
          destructive={blocksJob}
          onCancel={onClose}
          onSubmit={() =>
            onSubmit({
              title: note.trim().split(/\r?\n/, 1)[0].slice(0, 120),
              category: "OPERATION",
              severity,
              blocksJob,
              note: note.trim(),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
