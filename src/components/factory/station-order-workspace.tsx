"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderQcSection } from "@/components/qc/order-qc-section";
import { CreateDeliveryDialog } from "@/components/orders/delivery/create-delivery-dialog";
import { formatDate } from "@/lib/utils";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import type { FactoryStationKey } from "@/lib/factory-station";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  Printer,
  ShieldCheck,
  Truck,
} from "lucide-react";

export function StationOrderWorkspace({
  orderId,
  canCountQc,
  canCreateDelivery,
  canAdvancePacking,
  station,
  onBack,
  onOpenProduction,
}: {
  orderId: string;
  canCountQc: boolean;
  canCreateDelivery: boolean;
  canAdvancePacking: boolean;
  station: FactoryStationKey | null;
  onBack: () => void;
  onOpenProduction: (productionId: string) => void;
}) {
  const query = trpc.factory.stationContext.useQuery(
    { orderId },
    {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const context = query.data;

  if (query.isLoading && !context) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }
  if (query.isError && !context) {
    return (
      <div className="card-surface rounded-2xl">
        <QueryError
          message="โหลดบริบทงานไม่สำเร็จ"
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (!context) {
    return (
      <div className="card-surface rounded-2xl">
        <EmptyState
          icon={ClipboardCheck}
          title="ไม่พบออเดอร์นี้"
          description="กลับไปสแกนเลขออเดอร์อีกครั้ง"
          action={<Button onClick={onBack}>กลับไปสแกน</Button>}
        />
      </div>
    );
  }

  const { order, customer, activeProductions } = context;
  const contextStale = query.isError && Boolean(context);
  const isQc = order.internalStatus === "QUALITY_CHECK";
  const isPacking = order.internalStatus === "PACKING";
  const isReady = ["READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(
    order.internalStatus,
  );
  const isStopped = ["ON_HOLD", "CANCELLED"].includes(order.internalStatus);
  const isProducing = order.internalStatus === "PRODUCING";
  const statusLabel =
    (INTERNAL_STATUS_LABELS as Record<string, string>)[order.internalStatus] ??
    order.internalStatus;
  const statusVariant = isStopped
    ? "destructive"
    : isQc
      ? "warning"
      : isPacking
        ? "accent"
        : isReady
          ? "success"
          : "outline";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="กลับคิวสถานี">
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tabular-nums text-strong">
                {order.orderNumber}
              </h1>
              {order.blindShip && (
                <Badge variant="destructive" size="sm">ห้ามใส่ชื่อ Anajak</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-secondary">
              {[customer.name, order.title].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {order.deadline ? `กำหนดส่ง ${formatDate(order.deadline)}` : "ไม่กำหนดส่ง"}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant}>
          {statusLabel}
        </Badge>
      </div>

      {contextStale && (
        <Alert variant="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>ข้อมูลล่าสุดอาจยังไม่สด — ปิดปุ่มบันทึกชั่วคราว</span>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              ลองใหม่
            </Button>
          </span>
        </Alert>
      )}

      {isQc && (
        <section className="space-y-3" aria-labelledby="station-qc-title">
          <div>
            <h2 id="station-qc-title" className="flex items-center gap-2 text-lg font-semibold text-strong">
              <ShieldCheck className="h-5 w-5 text-blue-400" aria-hidden="true" />
              ตรวจนับก่อนแพ็ก
            </h2>
            <p className="mt-1 text-sm text-muted">
              ของดีครบยอดจะเข้าคิวแพ็กทันที ของเสียจะเปิดงานแก้เฉพาะเมื่อของดียังไม่ครบ
            </p>
          </div>
          {station !== "qc" && (
            <Alert variant="warning">
              เปิดสถานี QC ก่อน จึงจะบันทึกผลตรวจของออเดอร์นี้ได้
            </Alert>
          )}
          <StationQcReference inspection={context.inspection} />
          <OrderQcSection
            orderId={order.id}
            internalStatus={order.internalStatus}
            canCount={canCountQc && station === "qc" && !contextStale}
          />
        </section>
      )}

      {isPacking && (
        <StationPackingCard
          orderId={order.id}
          order={order}
          customer={customer}
          blindShip={order.blindShip}
          blindShipSenderName={order.blindShipSenderName}
          nonReturnedDeliveryCount={context.nonReturnedDeliveryCount}
          canUseStation={station === "final-pack"}
          writeBlocked={contextStale}
          canCreateDelivery={canCreateDelivery}
          canAdvancePacking={canAdvancePacking}
          onChanged={() => void query.refetch()}
        />
      )}

      {isReady && (
        <div className="card-surface rounded-2xl">
          <EmptyState
            icon={CheckCircle2}
            title={order.internalStatus === "READY_TO_SHIP" ? "แพ็กครบและพร้อมส่งแล้ว" : "งานออกจากสถานีแพ็กแล้ว"}
            description="สแกนงานใบถัดไปได้เลย"
            action={<Button onClick={onBack}>สแกนงานถัดไป</Button>}
          />
        </div>
      )}

      {isStopped && (
        <Alert variant="error">
          <span className="font-semibold">
            {order.internalStatus === "CANCELLED" ? "ออเดอร์นี้ถูกยกเลิกแล้ว" : "ออเดอร์นี้ถูกพักงาน"}
          </span>
          <span className="mt-1 block text-sm">
            ห้ามเริ่ม เบิก ปิดขั้น หรือแพ็กต่อ จนกว่าหัวหน้าจะจัดการสถานะใน ERP
          </span>
        </Alert>
      )}

      {!isQc && !isPacking && !isReady && !isStopped && (
        <div className="card-surface rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Printer className="mt-0.5 h-5 w-5 text-blue-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-strong">
                {isProducing ? "งานยังอยู่ในช่วงผลิต" : "งานยังไม่พร้อมลงมือที่สถานี"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {isProducing
                  ? "เปิดใบผลิตที่ตรงกับสถานีนี้ ระบบจะไม่ให้แพ็กก่อนผ่าน QC"
                  : `สถานะปัจจุบัน: ${statusLabel} — รอหัวหน้าปล่อยงานเข้าผลิตก่อน`}
              </p>
              {isProducing && activeProductions.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {activeProductions.map((production, index) => {
                    const current = production.steps.find(
                      (step) => step.stepType !== "PACKAGING" && step.status !== "COMPLETED",
                    );
                    const stepName = current
                      ? current.customStepName || STEP_TYPE_LABELS[current.stepType] || current.stepType
                      : "ตรวจรายละเอียด";
                    const stepStatus = current
                      ? STEP_STATUS_LABELS[current.status as keyof typeof STEP_STATUS_LABELS] ?? current.status
                      : production.status;
                    return (
                      <Button
                        key={production.id}
                        variant="outline"
                        onClick={() => onOpenProduction(production.id)}
                        className="h-auto min-h-14 justify-start gap-3 py-2 text-left"
                      >
                        <Printer className="shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            ใบผลิต {index + 1} · {stepName}
                          </span>
                          <span className="block truncate text-xs font-normal text-muted">
                            {stepStatus}
                            {station ? ` · สถานี ${station}` : ""}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StationQcReference({
  inspection,
}: {
  inspection: {
    garmentLines: Array<{
      product: string;
      size: string | null;
      color: string | null;
      quantity: number;
    }>;
    printChecks: Array<{
      position: string;
      printType: string;
      printSize: string | null;
      note: string | null;
    }>;
  };
}) {
  return (
    <div className="card-surface grid gap-4 rounded-2xl p-4 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-strong">เสื้อ/ไซส์ที่ต้องตรวจ</h3>
        {inspection.garmentLines.length === 0 ? (
          <p className="mt-2 text-sm text-muted">ไม่มีรายการไซส์ในออเดอร์</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm text-secondary">
            {inspection.garmentLines.map((line, index) => (
              <li key={`${line.product}|${line.size ?? ""}|${line.color ?? ""}|${index}`} className="flex gap-3">
                <span className="min-w-0 flex-1 truncate">
                  {line.product}
                  {[line.size, line.color].filter(Boolean).length > 0
                    ? ` · ${[line.size, line.color].filter(Boolean).join("/")}`
                    : ""}
                </span>
                <span className="shrink-0 tabular-nums">{line.quantity} ตัว</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-strong">ลาย/ตำแหน่งที่ต้องตรวจ</h3>
        {inspection.printChecks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">ไม่มีรายการพิมพ์ในออเดอร์</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm text-secondary">
            {inspection.printChecks.map((print, index) => (
              <li key={`${print.position}|${print.printType}|${index}`}>
                {[print.position, print.printType, print.printSize, print.note]
                  .filter(Boolean)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StationPackingCard({
  orderId,
  order,
  customer,
  blindShip,
  blindShipSenderName,
  nonReturnedDeliveryCount,
  canUseStation,
  writeBlocked,
  canCreateDelivery,
  canAdvancePacking,
  onChanged,
}: {
  orderId: string;
  order: {
    shippingName: string | null;
    shippingPhone: string | null;
    shippingAddress: string | null;
    shippingSubDistrict: string | null;
    shippingDistrict: string | null;
    shippingProvince: string | null;
    shippingPostalCode: string | null;
  };
  customer: { name: string; phone: string | null; address: string | null; hasAddress: boolean };
  blindShip: boolean;
  blindShipSenderName: string | null;
  nonReturnedDeliveryCount: number;
  canUseStation: boolean;
  writeBlocked: boolean;
  canCreateDelivery: boolean;
  canAdvancePacking: boolean;
  onChanged: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const packQuery = trpc.delivery.packContext.useQuery(
    { orderId },
    {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const utils = trpc.useUtils();
  const ready = trpc.factory.markReadyToShip.useMutation({
    onSuccess: async () => {
      toast.success("แพ็กครบแล้ว — งานพร้อมส่ง");
      await Promise.all([
        utils.factory.stationContext.invalidate({ orderId }),
        utils.factory.stationQueue.invalidate(),
        utils.order.getById.invalidate({ id: orderId }),
      ]);
      onChanged();
    },
    onError: (error) => toast.error(error.message || "เปลี่ยนเป็นพร้อมส่งไม่สำเร็จ"),
  });

  if (packQuery.isLoading && !packQuery.data) {
    return <Skeleton className="h-72 rounded-2xl" />;
  }
  if (packQuery.isError && !packQuery.data) {
    return (
      <div className="card-surface rounded-2xl">
        <QueryError
          message="โหลดรายการแพ็กไม่สำเร็จ"
          onRetry={() => void packQuery.refetch()}
        />
      </div>
    );
  }
  const pack = packQuery.data;
  if (!pack) return null;

  const packStale = packQuery.isError && Boolean(packQuery.data);
  const canWritePack = canUseStation && !writeBlocked && !packStale;
  const hasEvidence = nonReturnedDeliveryCount > 0;
  const complete = hasEvidence && pack.totalRemaining === 0;

  return (
    <section aria-labelledby="station-pack-title" className="space-y-4">
      <div>
        <h2 id="station-pack-title" className="flex items-center gap-2 text-lg font-semibold text-strong">
          <PackageCheck className="h-5 w-5 text-blue-400" aria-hidden="true" />
          แพ็กสุดท้าย
        </h2>
        <p className="mt-1 text-sm text-muted">
          นับใส่ใบส่งตามไซส์ให้ครบ แล้วจึงยืนยันพร้อมส่ง
        </p>
      </div>

      {blindShip && (
        <Alert variant="error">
          <span className="font-semibold">BLIND SHIP — ห้ามใส่เอกสารหรือชื่อ Anajak ในกล่อง</span>
          <span className="mt-1 block text-sm">
            ชื่อผู้ส่งที่ต้องใช้: {blindShipSenderName || customer.name}
          </span>
        </Alert>
      )}

      {packStale && (
        <Alert variant="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>รายการแพ็กล่าสุดอาจยังไม่สด — ปิดปุ่มบันทึกชั่วคราว</span>
            <Button variant="outline" size="sm" onClick={() => void packQuery.refetch()}>
              ลองใหม่
            </Button>
          </span>
        </Alert>
      )}

      <div className="card-surface overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-divider px-4 py-3">
          <span className="text-sm font-semibold text-strong">รายการนับแพ็ก</span>
          <span className="ml-auto text-sm tabular-nums text-muted">
            เหลือ {pack.totalRemaining.toLocaleString("th-TH")} ตัว
          </span>
        </div>
        {pack.lines.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">
            งานนี้ไม่มีรายการไซส์ — สร้างใบส่งหนึ่งใบเป็นหลักฐานแพ็กก่อน
          </p>
        ) : (
          <div className="divide-y divide-divider">
            {pack.lines.map((line) => (
              <div
                key={`${line.description}|${line.size ?? ""}|${line.color ?? ""}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-strong">
                    {[line.size, line.color].filter(Boolean).join(" / ") || line.description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{line.description}</p>
                </div>
                <p className="text-right text-sm tabular-nums text-secondary">
                  {line.packed}/{line.ordered}
                  <span className="block text-xs text-muted">เหลือ {line.remaining}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {!canUseStation && (
        <Alert variant="warning">
          เปิดสถานีแพ็กสุดท้ายก่อน จึงจะบันทึกใบส่งหรือยืนยันพร้อมส่งได้
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          disabled={!canWritePack || !canCreateDelivery}
          onClick={() => setShowCreate(true)}
        >
          <Truck />
          {hasEvidence ? "เพิ่มกล่อง/ใบส่ง" : "บันทึกการแพ็ก"}
        </Button>
        <Button
          disabled={!canWritePack || !canAdvancePacking || !complete || ready.isPending}
          aria-busy={ready.isPending || undefined}
          onClick={() => ready.mutate({ orderId })}
        >
          <CheckCircle2 />
          {ready.isPending ? "กำลังบันทึก..." : "แพ็กครบแล้ว · พร้อมส่ง"}
        </Button>
      </div>

      {!complete && (
        <p role="status" className="text-right text-sm text-amber-300">
          {!hasEvidence
            ? "ต้องบันทึกการแพ็กอย่างน้อย 1 ใบก่อน"
            : `ยังเหลือแพ็ก ${pack.totalRemaining.toLocaleString("th-TH")} ตัว`}
        </p>
      )}

      {showCreate && canWritePack && (
        <CreateDeliveryDialog
          orderId={orderId}
          customerName={customer.name}
          customerPhone={customer.phone ?? undefined}
          customerHasAddress={customer.hasAddress}
          customerAddress={customer.address}
          orderShipping={{
            shippingRecipientName: order.shippingName,
            shippingPhone: order.shippingPhone,
            shippingAddress: order.shippingAddress,
            shippingSubDistrict: order.shippingSubDistrict,
            shippingDistrict: order.shippingDistrict,
            shippingProvince: order.shippingProvince,
            shippingPostalCode: order.shippingPostalCode,
          }}
          packData={pack}
          showShippingCost={false}
          onClose={() => {
            setShowCreate(false);
            void packQuery.refetch();
            onChanged();
          }}
        />
      )}
    </section>
  );
}
