"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import { PageShell } from "@/components/page-shell";
import { MaterialUsage } from "@/components/material-usage";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProductionStepsList } from "@/components/production/production-steps-list";
import { ProductionNowCard } from "@/components/production/production-now-card";
import {
  ProductionStepNavigator,
  defaultProductionStepId,
} from "@/components/production/production-step-navigator";
import { StepUpdateDialog } from "@/components/production/step-update-dialog";
import { StepOutsourceDialog } from "@/components/production/step-outsource-dialog";
import { StepQtySheet } from "@/components/production/step-qty-sheet";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  ExternalLink,
  CalendarClock,
  Flag,
  AlertTriangle,
  Shirt,
  ListChecks,
  PackageOpen,
  PanelRightOpen,
  Route,
  type LucideIcon,
} from "lucide-react";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  STEP_TYPE_LABELS,
  evaluateHeatPressGate,
  productionWorkflowSteps,
} from "@/lib/production-steps";
import { selectNowSteps } from "@/lib/production-step-actions";
import { STEP_STATUS_LABELS, STEP_STATUS_VARIANTS } from "@/lib/status-config";
import { toast } from "sonner";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { FOCUS_INSET, TINT } from "@/components/ui/tokens";
import { Alert } from "@/components/ui/alert";
import {
  FACTORY_STATIONS,
  factoryStationKeyForStep,
  type FactoryStationKey,
} from "@/lib/factory-station";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  PRODUCTION_DETAIL_DEFAULT_TAB,
  type ProductionDetailTab,
} from "@/lib/production-detail-tabs";

const PRINT_STEP_TYPES: ReadonlySet<string> = new Set([
  "DTF_PRINT",
  "DTG_PRINT",
  "SCREEN_PRINTING",
  "EMBROIDERY",
  "SUBLIMATION",
  "SPECIAL_PRINT",
]);

function ProductionDetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-5">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function ProductionJobFact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 min-w-0 text-sm font-medium text-strong">{children}</dd>
      </div>
    </div>
  );
}

function ProductionJacketSkeleton() {
  return (
    <div className="min-h-[34rem] bg-bg">
      <div className="border-b border-divider bg-surface px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-7 w-56 max-w-full rounded-md" />
            <Skeleton className="h-4 w-80 max-w-full rounded-md" />
          </div>
        </div>
      </div>
      <div className="border-b border-divider bg-surface px-4 py-5 sm:px-6 lg:px-8">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <div className="grid min-h-[26rem] bg-surface xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5 px-5 py-7 sm:px-7 lg:px-9">
          <Skeleton className="h-8 w-64 max-w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-11 w-60 max-w-full rounded-lg" />
        </div>
        <div className="hidden border-l border-divider bg-surface-muted p-7 xl:block">
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ProductionWorkbenchHeader({
  order,
  loading,
  totalQty,
  completedSteps,
  totalSteps,
  isOverdue,
  readOnly,
  onOpenInspector,
}: {
  order?: ProductionDetail["order"];
  loading: boolean;
  totalQty: number;
  completedSteps: number;
  totalSteps: number;
  isOverdue: boolean;
  readOnly: boolean;
  onOpenInspector: () => void;
}) {
  return (
    <header
      data-production-workbench-header=""
      className="border-b border-slate-800 bg-slate-950 text-white"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:px-8 lg:py-5">
        <div className="flex min-w-0 items-start gap-3 lg:flex-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-300 hover:bg-white/10 hover:text-white active:bg-white/15"
          >
            <Link href="/production" aria-label="กลับคิวผลิต">
              <ArrowLeft />
            </Link>
          </Button>
          {order ? (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {order.orderNumber}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
                  {INTERNAL_STATUS_LABELS[order.internalStatus] ?? order.internalStatus}
                </span>
                {readOnly ? (
                  <span className="text-xs font-medium text-slate-400">ดูอย่างเดียว</span>
                ) : null}
              </div>
              <p className="mt-1 break-words text-sm text-slate-300">
                {[order.title, order.customer?.name].filter(Boolean).join(" · ") ||
                  "ใบเดินงานฝ่ายผลิต"}
              </p>
            </div>
          ) : loading ? (
            <div className="min-w-0 flex-1 space-y-2 py-1">
              <Skeleton className="h-7 w-56 max-w-full rounded-md" />
              <Skeleton className="h-4 w-80 max-w-full rounded-md" />
            </div>
          ) : (
            <div className="py-1">
              <h1 className="text-2xl font-semibold text-white">งานผลิต</h1>
              <p className="mt-1 text-sm text-slate-300">เปิดใบเดินงานไม่สำเร็จ</p>
            </div>
          )}
        </div>

        {order ? (
          <div className="flex max-w-full flex-wrap items-center gap-2 lg:justify-end">
            <Button size="sm" onClick={onOpenInspector}>
              <PanelRightOpen />
              ข้อมูลใบงาน
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border border-slate-700 text-slate-200 shadow-none hover:bg-slate-800 hover:text-white active:bg-slate-700"
              asChild
            >
              <a href={`/print/job-ticket/${order.id}`} target="_blank" rel="noreferrer">
                <ClipboardList />
                ใบสั่งงาน
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border border-slate-700 text-slate-200 shadow-none hover:bg-slate-800 hover:text-white active:bg-slate-700"
              asChild
            >
              <Link href={`/orders/${order.id}`}>
                <ExternalLink />
                ดูออเดอร์
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {order ? (
        <dl className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-800 bg-slate-900 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
          {order.deadline ? (
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <dt className="sr-only">กำหนดส่ง</dt>
              <dd className={cn("font-medium", isOverdue ? "text-red-300" : "text-slate-200")}>
                ส่ง {formatDate(order.deadline)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Shirt className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <dt className="sr-only">จำนวน</dt>
            <dd className="font-medium tabular-nums text-slate-200">
              {totalQty.toLocaleString("th-TH")} ตัว
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <dt className="sr-only">ขั้นตอน</dt>
            <dd className="font-medium tabular-nums text-slate-200">
              {completedSteps}/{totalSteps} ขั้น
            </dd>
          </div>
          {order.priority === "HIGH" || order.priority === "URGENT" ? (
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <dt className="sr-only">ความสำคัญ</dt>
              <dd>
                <Badge
                  variant={order.priority === "URGENT" ? "destructive" : "warning"}
                  size="sm"
                >
                  {PRIORITY_LABELS[order.priority] ?? order.priority}
                </Badge>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </header>
  );
}

type ProductionInspectorSection = Exclude<ProductionDetailTab, "work">;

function ProductionJobInspector({
  section,
  onSectionChange,
  onClose,
  inventory,
  history,
}: {
  section: ProductionInspectorSection;
  onSectionChange: (section: ProductionInspectorSection) => void;
  onClose: () => void;
  inventory: ReactNode;
  history: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-production-job-inspector=""
        className="!bottom-0 !left-0 !right-0 !top-auto !flex !max-h-[88dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl p-0 pr-0 sm:!bottom-auto sm:!left-auto sm:!right-0 sm:!top-0 sm:!h-dvh sm:!max-h-dvh sm:!w-[min(42rem,calc(100vw-2rem))] sm:rounded-none"
      >
        <DialogHeader className="border-b border-divider px-5 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-14">
          <DialogTitle>ข้อมูลใบงาน</DialogTitle>
          <DialogDescription>
            เสื้อ วัตถุดิบ และเส้นทางทั้งหมดที่ไม่ใช่งานของขั้นปัจจุบัน
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={section}
          onValueChange={(value) => onSectionChange(value as ProductionInspectorSection)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList
            aria-label="เลือกข้อมูลใบงาน"
            className="shrink-0 gap-5 border-b border-divider px-5 sm:px-6"
          >
            <TabsTrigger value="inventory">
              <PackageOpen />
              เสื้อและวัตถุดิบ
            </TabsTrigger>
            <TabsTrigger value="history">
              <Route />
              เส้นทางทั้งหมด
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inventory" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {inventory}
          </TabsContent>
          <TabsContent value="history" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {history}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function productionCompletionMessage(status?: string) {
  switch (status) {
    case "QUALITY_CHECK":
      return "ผลิตครบแล้ว — รอ QC ก่อนแพ็กสินค้า";
    case "PACKING":
      return "QC ผ่านแล้ว — อยู่ขั้นแพ็กสินค้า";
    case "READY_TO_SHIP":
      return "แพ็กแล้ว — พร้อมจัดส่ง";
    case "SHIPPED":
    case "COMPLETED":
      return "งานผลิตและการจัดส่งเสร็จแล้ว";
    case "CANCELLED":
      return "ออเดอร์นี้ถูกยกเลิกแล้ว";
    default:
      return "ครบทุกขั้นการผลิตแล้ว";
  }
}

// หน้าใบผลิต — บ้านของฝั่งโรงงาน (แยกจากหน้าออเดอร์ 2026-06-12 เบสเคาะ)
// ช่างใช้หน้านี้บนมือถือหน้างาน: อัปเดตขั้นตอน/QC/เบิกวัตถุดิบ — ไม่มีเงินของออเดอร์บนหน้านี้
export function ProductionDetailScreen({
  id,
  surface = "erp",
  station = null,
  initialTab = PRODUCTION_DETAIL_DEFAULT_TAB,
}: {
  id: string;
  surface?: "erp" | "station";
  station?: FactoryStationKey | null;
  initialTab?: ProductionDetailTab;
}) {
  const [selectedStep, setSelectedStep] = useState<ProductionStep | null>(null);
  const [outsourceStep, setOutsourceStep] = useState<ProductionStep | null>(null);
  // การเลือกขั้นใน navigator เป็น view state เท่านั้น — ห้ามใช้เป็น workflow status/action
  const [viewedStepId, setViewedStepId] = useState<string | null>(null);
  const [inspectorSection, setInspectorSection] = useState<ProductionInspectorSection | null>(
    initialTab === "inventory" || initialTab === "history" ? initialTab : null,
  );
  // ขั้นนับจำนวนที่กด "เสร็จขั้นนี้" — เปิด sheet ถามจำนวน (UX1: 2 แตะ)
  // เก็บแค่ id แล้ว derive ตัว step สดจาก query ทุก render — snapshot เก่าทำยอดถอยหลังได้
  // (sheet ส่ง qtyDone แบบ absolute ถ้าฐานเก่าจะทับของจริง)
  const [qtyStepId, setQtyStepId] = useState<string | null>(null);

  const productionQuery = trpc.production.getById.useQuery(
    { id },
    {
      retry: (failureCount, error) =>
        error.data?.code !== "NOT_FOUND" && failureCount < 3,
      refetchInterval: surface === "station" ? 30_000 : false,
      refetchOnWindowFocus: surface === "station",
      refetchOnReconnect: surface === "station",
    },
  );
  const production = productionQuery.data;
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // PERM: ต้นทุน/หน่วยเห็นเฉพาะสายการเงิน (server listMaterials คืน cost ให้ทุก role ที่ผ่าน
  // gate ผลิต — ชั้นนี้เป็น cosmetic กันช่างเห็นตัวเลขต้นทุนบนจอ)
  const canSeeCost =
    !meQuery.isError && permAllows(me?.permissions, "see_finance");
  // หัวหน้าดู/แก้รายละเอียดขั้นของทีมได้ ส่วนการสร้างใบส่งร้านใช้สิทธิ์ข้อมูลหลัก
  // ตาม router เดิม — แยกสองสิทธิ์เพื่อไม่วาดปุ่มที่ server จะปฏิเสธ
  const canSuperviseOperations =
    !!me && permAllows(me.permissions, "supervise_operations");
  const canCreateOutsource =
    !!me && permAllows(me.permissions, "manage_settings");
  // อัปเดต/ผ่านรวดขั้นตอน = ทีมผลิตขึ้นไป (ตรง productionTeam ฝั่ง server — กันปุ่มที่กดแล้ว FORBIDDEN)
  const hasProductionPermission =
    !!me && permAllows(me.permissions, "manage_production");

  // mutation ก้อนเดียวใช้ทุกปุ่มเร็ว (ผ่านรวด/รับงาน/เริ่ม/เสร็จ/sheet จำนวน) —
  // ยิง updateStep เดิมเสมอ ไม่มีทางลัดสถานะใหม่ (การ์ดกัน regress ใบงาน UX)
  const quickPass = useMutationWithInvalidation(trpc.production.updateStep, {
    invalidate: [
      utils.production.getById,
      utils.production.getByOrderId,
      utils.production.kanban,
      utils.factory.stationQueue,
      utils.order.getById,
      utils.task.myToday,
    ],
    onSuccess: () => setQtyStepId(null),
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "อัปเดตขั้นตอนไม่สำเร็จ");
    },
  });
  const legacyFinalize = useMutationWithInvalidation(
    trpc.production.finalizeLegacyPackaging,
    {
      invalidate: [
        utils.production.getById,
        utils.production.getByOrderId,
        utils.production.kanban,
        utils.factory.stationQueue,
        utils.order.getById,
        utils.factory.stationContext,
        utils.task.myToday,
      ],
      onSuccess: (data: { orderStatus: string; alreadyFinalized: boolean }) => {
        if (data.orderStatus === "QUALITY_CHECK") {
          toast.success(data.alreadyFinalized ? "งานอยู่ใน QC แล้ว" : "ส่งงานเข้า QC แล้ว");
        } else if (data.orderStatus === "PRODUCING") {
          toast.success("ปิดใบผลิตนี้แล้ว — ยังมีใบผลิตอื่นค้างอยู่");
        } else {
          toast.success("ใบผลิตนี้ถูกปิดไว้แล้ว");
        }
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message ?? "ส่งงานเข้า QC ไม่สำเร็จ");
      },
    },
  );

  async function handleQuickPass(step: ProductionStep) {
    const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
    const ok = await confirm({
      title: "ผ่านรวดขั้นตอนนี้?",
      description: `"${stepName}" จะถูกปิดเป็นเสร็จ — ใช้เมื่อร้านนอกทำเสร็จแล้วแต่ไม่ได้เปิดใบส่งร้าน`,
      confirmText: "ผ่านรวด",
    });
    if (!ok) return;
    quickPass.mutate({ stepId: step.id, status: "COMPLETED" });
  }

  // รับงาน/เริ่มทำ 1 แตะ — ช่างกดบนขั้นว่าง server auto-claim เป็นชื่อตัวเองเอง
  async function handleStartStep(step: ProductionStep) {
    if (step.stepType === "HEAT_PRESS" && legacyGarmentCheckRequired) {
      const ok = await confirm({
        title: "ตรวจยอดเสื้อแล้วใช่ไหม?",
        description:
          "ใบเก่านี้ไม่มีขั้นเบิกเสื้อ ระบบจึงยืนยันยอดแทนไม่ได้ เริ่มรีดเมื่อเสื้อจริงครบตามรายการแล้วเท่านั้น",
        confirmText: "ตรวจแล้ว เริ่มรีด",
      });
      if (!ok) return;
    }
    quickPass.mutate({ stepId: step.id, status: "IN_PROGRESS" });
  }

  // เสร็จขั้นนี้ — ขั้นนับจำนวนที่ยังไม่ครบ เปิด sheet ถามจำนวน (2 แตะ) ·
  // ขั้นติ๊กเฉยๆ/นับครบแล้ว ปิดเลย 1 แตะ (server snap จำนวน + ตั้ง completedAt เอง)
  function handleCompleteStep(step: ProductionStep) {
    const counting = step.qtyTotal !== null && step.qtyTotal > 0;
    if (counting && (step.qtyDone ?? 0) < (step.qtyTotal ?? 0)) {
      setQtyStepId(step.id);
      return;
    }
    quickPass.mutate({ stepId: step.id, status: "COMPLETED" });
  }

  const order = production?.order;
  // PACKAGING ในใบเก่าเป็น compatibility row เท่านั้น — flow จริงแพ็กหลัง QC ผ่านสถานะออเดอร์
  const workflowSteps = productionWorkflowSteps(production?.steps ?? []);
  const selectedStepLive = selectedStep
    ? (workflowSteps.find((step) => step.id === selectedStep.id) ?? null)
    : null;
  const hasPendingLegacyPackaging =
    production?.steps.some(
      (step) => step.stepType === "PACKAGING" && step.status !== "COMPLETED",
    ) ?? false;
  const legacyPackagingReadyForQc =
    order?.internalStatus === "PRODUCING" &&
    hasPendingLegacyPackaging &&
    workflowSteps.every((step) => step.status === "COMPLETED");
  // step ของ sheet จำนวน — อ่านสดจาก query เสมอ (ดูคอมเมนต์ที่ qtyStepId)
  const qtySheetStep = production && qtyStepId
    ? (workflowSteps.find((s) => s.id === qtyStepId) ?? null)
    : null;
  const totalQty = order?.items.reduce((s, it) => s + it.totalQuantity, 0) ?? 0;
  const completedSteps = workflowSteps.filter((s) => s.status === "COMPLETED").length;
  const totalSteps = workflowSteps.length;
  const completedPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const allStepsDone = totalSteps > 0 && completedSteps === totalSteps;
  const orderCanProduce = order?.internalStatus === "PRODUCING";
  const productionStale = productionQuery.isError && Boolean(production);
  const permissionStale = meQuery.isError && Boolean(me);
  const writeDataStale = productionStale || permissionStale;
  const stationOrderCanProduce = surface === "station" && orderCanProduce;
  const stationCanOperate =
    surface === "station" && !!station && stationOrderCanProduce;
  const canUpdateStep =
    hasProductionPermission &&
    orderCanProduce &&
    !writeDataStale &&
    (surface === "erp" || stationCanOperate);
  // งานร้านนอกไม่มีสถานีใน Station Mode และ endpoint เดิมมีข้อมูลต้นทุนสำหรับหัวหน้า
  // จึงทำได้เฉพาะใน ERP canonical เท่านั้น ไม่ mount dialog/ยิง query จากจอสถานี
  const canOutsource =
    surface === "erp" && orderCanProduce && canCreateOutsource && !writeDataStale;
  const canSuperviseStep = canSuperviseOperations && !writeDataStale;
  const canActOnStep = (step: ProductionStep) =>
    surface === "erp" ||
    (stationCanOperate && factoryStationKeyForStep(step.stepType) === station);
  const canOwnOrSuperviseStep = (step: ProductionStep) =>
    canSuperviseStep || !step.assignedTo || step.assignedTo.id === me?.id;
  const canOpenStepDetails = (step: ProductionStep) =>
    canUpdateStep &&
    canActOnStep(step) &&
    canOwnOrSuperviseStep(step) &&
    (surface === "erp" || !["GARMENT_PICK", "DTF_PRINT"].includes(step.stepType));
  const stationHref = station
    ? `/factory/station?station=${encodeURIComponent(station)}`
    : "/factory/station";
  const stationLabel = station
    ? FACTORY_STATIONS.find((item) => item.key === station)?.label
    : null;
  const stationBlockMessage =
    surface !== "station"
      ? null
      : !station
        ? "เลือกสถานีก่อน จึงจะเริ่มหรือปิดขั้นผลิตได้"
        : !stationOrderCanProduce
          ? `ออเดอร์นี้อยู่สถานะ ${(INTERNAL_STATUS_LABELS as Record<string, string>)[order?.internalStatus ?? ""] ?? order?.internalStatus ?? "ไม่ทราบสถานะ"} — จอประจำสถานีจึงเปิดให้อ่านอย่างเดียว`
          : null;
  // ขั้นที่ลงมือได้ตอนนี้ (เลนละไม่เกินหนึ่ง) — ใช้กติกาปุ่มชุดเดียวกับรายการขั้นตอนด้านล่าง
  const nowSteps = production
    ? selectNowSteps(workflowSteps, {
        canOutsource,
        canUpdateStep,
        canSupervise: canSuperviseStep,
        meId: me?.id ?? null,
        pressGate: evaluateHeatPressGate(workflowSteps),
      }).filter(({ step }) => canActOnStep(step))
    : [];
  const activeViewedStepId = surface === "erp"
    ? defaultProductionStepId(workflowSteps, nowSteps, viewedStepId)
    : null;
  const viewedStep = activeViewedStepId
    ? (workflowSteps.find((step) => step.id === activeViewedStepId) ?? null)
    : null;
  const garmentPickNowStep = nowSteps.find(
    ({ step }) => step.stepType === "GARMENT_PICK",
  );
  const garmentPickIsCurrent = !!garmentPickNowStep &&
    garmentPickNowStep.group === "current" &&
    garmentPickNowStep.waitingOn.length === 0 &&
    garmentPickNowStep.note === null;
  const legacyGarmentReadinessUnknown = !!order &&
    order.items.some((item) =>
      item.products.some((product) => product.itemSource === "FROM_STOCK"),
    ) &&
    !workflowSteps.some((step) => step.stepType === "GARMENT_PICK");
  const legacyGarmentShownWithCurrentWork =
    legacyGarmentReadinessUnknown &&
    nowSteps.some(
      ({ step, group }) => step.stepType === "HEAT_PRESS" && group === "current",
    );
  const legacyGarmentCheckNowStep = legacyGarmentReadinessUnknown
    ? nowSteps.find(
        ({ step, group, action }) =>
          step.stepType === "HEAT_PRESS" && group === "current" && action === "start",
      )
    : undefined;
  const legacyGarmentCheckRequired = !!legacyGarmentCheckNowStep;
  const printSteps = workflowSteps.filter((step) => PRINT_STEP_TYPES.has(step.stepType));
  const allPrintStepsCompleted =
    printSteps.length > 0 && printSteps.every((step) => step.status === "COMPLETED");
  const isOverdue = !!(
    order?.deadline &&
    new Date(order.deadline) < new Date(productionQuery.dataUpdatedAt || 0) &&
    !["SHIPPED", "COMPLETED", "CANCELLED"].includes(order.internalStatus)
  );
  const allDoneMessage = productionCompletionMessage(order?.internalStatus);
  const productionNotFound =
    !production && productionQuery.error?.data?.code === "NOT_FOUND";

  function focusGarmentPick() {
    const target = document.getElementById("production-garments");
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  const hasProductionSpec = !!order && (
    order.designs.length > 0 ||
    order.items.some(
      (item) =>
        item.prints.length > 0 ||
        item.products.some((product) => product.variants.length > 0),
    )
  );

  const renderProductionNow = (
    steps: typeof nowSteps,
    showCompletionState = true,
    waitingHeading = "งานที่กำลังรอ",
    focused = false,
  ) => (
    <ProductionNowCard
      nowSteps={steps}
      allDone={showCompletionState && allStepsDone}
      allDoneMessage={allDoneMessage}
      busy={quickPass.isPending}
      onStart={handleStartStep}
      onComplete={handleCompleteStep}
      onSendOutsource={setOutsourceStep}
      onQuickPass={handleQuickPass}
      onOpenStep={setSelectedStep}
      canOpenStep={canOpenStepDetails}
      printRunsHref={
        surface === "station"
          ? "/factory/station?station=dtf-print"
          : "/production/print-runs"
      }
      embedded={surface === "erp"}
      focused={focused}
      emptyMessage={
        surface === "station"
          ? `ไม่มีงานที่ลงมือได้สำหรับ${stationLabel ? `สถานี${stationLabel}` : "สถานีนี้"}`
          : "ยังไม่มีขั้นตอนที่ลงมือได้ในใบนี้"
      }
      waitingHeading={waitingHeading}
      getStartLabel={(step) =>
        step.stepType === "HEAT_PRESS" && legacyGarmentCheckRequired
          ? "ตรวจแล้ว เริ่มรีดร้อน"
          : null
      }
      getCompletionHint={(step) =>
        workflowSteps.every(
          (candidate) => candidate.id === step.id || candidate.status === "COMPLETED",
        )
          ? "เมื่อเสร็จขั้นนี้ → ระบบส่งต่อ QC เมื่อทุกใบผลิตของออเดอร์ครบ"
          : null
      }
    />
  );

  const currentActionRegion = production && order ? (
    <div className="min-w-0 space-y-3">
      {legacyGarmentCheckRequired ? (
        <Alert variant="warning" icon={AlertTriangle}>
          <span className="font-semibold">ต้องตรวจยอดเสื้อก่อนเริ่มรีดร้อน</span>
          <span className="mt-0.5 block text-sm">
            ใบนี้ใช้เสื้อจากสต๊อคแต่ไม่มีขั้นเบิกเสื้อใน workflow เดิม
            ระบบจึงยังยืนยันความพร้อมของเสื้อไม่ได้
          </span>
          {surface === "station" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={focusGarmentPick}
            >
              ตรวจยอดเสื้อด้านล่าง
              <ArrowRight />
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {stationBlockMessage ? (
        <Alert variant="warning" icon={AlertTriangle}>
          <span className="font-semibold">อ่านใบงานได้ แต่ยังลงมือไม่ได้</span>
          <span className="mt-0.5 block text-sm">
            {stationBlockMessage}
            {stationLabel ? ` · สถานีปัจจุบัน: ${stationLabel}` : ""}
          </span>
        </Alert>
      ) : legacyPackagingReadyForQc ? (
        <section
          aria-labelledby="legacy-production-ready"
          className={cn(
            TINT.warning,
            "flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div className="flex min-w-0 gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="legacy-production-ready" className="font-semibold">
                ใบเก่านี้พร้อมส่งเข้า QC
              </h2>
              <p className="mt-0.5 text-sm">
                ระบบจะปิดขั้นแพ็กแบบเดิมและส่งเข้า QC โดยยังไม่ถือว่าแพ็กสินค้าแล้ว
              </p>
            </div>
          </div>
          {surface === "erp" && canUpdateStep ? (
            <Button
              className="shrink-0"
              disabled={legacyFinalize.isPending}
              aria-busy={legacyFinalize.isPending || undefined}
              onClick={() => legacyFinalize.mutate({ productionId: production.id })}
            >
              {legacyFinalize.isPending ? "กำลังส่ง..." : "ส่งเข้า QC"}
              <ArrowRight />
            </Button>
          ) : (
            <p className="shrink-0 text-sm font-medium">รอหัวหน้าหรือทีมผลิตส่งเข้า QC</p>
          )}
        </section>
      ) : renderProductionNow(nowSteps)}
    </div>
  ) : null;

  const garmentPickPanel = production ? (
    <div
      id="production-garments"
      tabIndex={-1}
      className={cn("scroll-mt-24 rounded-2xl", FOCUS_INSET)}
    >
      <GarmentPickCard
        productionId={production.id}
        steps={workflowSteps}
        stepId={
          surface === "erp" && viewedStep?.stepType === "GARMENT_PICK"
            ? viewedStep.id
            : undefined
        }
        canIssueGarments={
          canUpdateStep &&
          (surface === "erp"
            ? garmentPickIsCurrent && viewedStep?.id === garmentPickNowStep?.step.id
            : station === "prep")
        }
        canReturnGarments={
          hasProductionPermission &&
          !writeDataStale &&
          (surface === "erp" || (stationCanOperate && station === "prep"))
        }
        legacyReadinessUnknown={legacyGarmentReadinessUnknown}
        embedded={surface === "erp"}
        primaryTask={
          surface === "erp"
            ? garmentPickIsCurrent && viewedStep?.id === garmentPickNowStep?.step.id
            : garmentPickIsCurrent
        }
      />
    </div>
  ) : null;

  const renderFocusedStep = (step: ProductionStep) => {
    const focusedNowStep = nowSteps.find(({ step: candidate }) => candidate.id === step.id);
    const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
    const counting = step.qtyTotal !== null && step.qtyTotal > 0;
    const donePct = counting
      ? Math.min(100, Math.round(((step.qtyDone ?? 0) / (step.qtyTotal ?? 1)) * 100))
      : 0;
    const showLegacyGarment = legacyGarmentCheckNowStep?.step.id === step.id;
    const showSpec = hasProductionSpec && step.stepType !== "GARMENT_PICK";
    const garmentWaitingMessage = focusedNowStep
      ? focusedNowStep.waitingOn.join(" · ") ||
        focusedNowStep.note ||
        (focusedNowStep.group === "waiting"
          ? "สิทธิ์นี้ดูขั้นตอนนี้ได้อย่างเดียว"
          : null)
      : step.status === "COMPLETED"
        ? null
        : "ขั้นนี้ยังไม่ถึงคิวในสายงานเดียวกัน";

    return (
      <article
        data-production-active-step=""
        className={cn(
          "grid min-h-[28rem] bg-surface",
          showSpec && "xl:grid-cols-[minmax(0,1fr)_24rem]",
        )}
      >
        <section className="min-w-0 px-5 py-7 sm:px-7 sm:py-8 lg:px-9 lg:py-9">
          {legacyPackagingReadyForQc ? <div className="mb-6">{currentActionRegion}</div> : null}
          {allStepsDone && !legacyPackagingReadyForQc ? (
            <section
              className={cn(TINT.success, "mb-6 flex items-start gap-3 rounded-xl border px-4 py-3")}
              aria-label="สถานะใบผลิต"
            >
              <ListChecks className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">ใบผลิตนี้ครบทุกขั้นแล้ว</p>
                <p className="mt-0.5 text-sm">{allDoneMessage}</p>
              </div>
            </section>
          ) : null}

          <div className="min-w-0 space-y-5">
            <div className="flex justify-end">
              <StatusLabel
                label={STEP_STATUS_LABELS[step.status]}
                tone={toneFromBadgeVariant(STEP_STATUS_VARIANTS[step.status])}
                emphasize={step.status === "COMPLETED" || step.status === "FAILED"}
              />
            </div>

            {showLegacyGarment ? (
              <Alert variant="warning" icon={AlertTriangle}>
                <span className="font-semibold">ระบบยังยืนยันยอดเสื้อไม่ได้</span>
                <span className="mt-0.5 block text-sm">
                  ใบเก่านี้ไม่มีขั้นเบิกเสื้อ ตรวจเสื้อจริงตามรายการก่อนเริ่มรีดร้อน
                </span>
              </Alert>
            ) : null}

            {step.stepType === "GARMENT_PICK" ? (
              <>
                {garmentWaitingMessage ? (
                  <div className={cn(TINT.warning, "rounded-xl border px-3 py-2 text-sm")}>
                    {garmentWaitingMessage}
                  </div>
                ) : null}
                {garmentPickPanel}
              </>
            ) : focusedNowStep ? (
              renderProductionNow([focusedNowStep], false, "งานที่กำลังรอ", true)
            ) : (
              <section aria-labelledby={`production-viewed-step-${step.id}`} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2
                      id={`production-viewed-step-${step.id}`}
                      className="text-2xl font-semibold tracking-tight text-strong"
                    >
                      {stepName}
                    </h2>
                    {step.assignedTo ? (
                      <p className="mt-1 text-sm text-muted">
                        ผู้รับผิดชอบ {step.assignedTo.name}
                      </p>
                    ) : null}
                  </div>
                </div>

                {counting ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted">จำนวนที่บันทึกแล้ว</span>
                      <span className="font-medium tabular-nums text-strong">
                        {step.qtyDone ?? 0}/{step.qtyTotal} ตัว
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`ความคืบหน้า ${stepName}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={donePct}
                      className="h-2 overflow-hidden rounded-full bg-surface-muted"
                    >
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${donePct}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className={cn(TINT.neutral, "rounded-xl border px-3 py-2 text-sm")}>
                  {step.status === "COMPLETED"
                    ? "ขั้นนี้เสร็จแล้ว เปิดไว้สำหรับตรวจสอบข้อมูลย้อนหลัง"
                    : "ขั้นนี้ยังไม่ถึงคิวในสายงานเดียวกัน ข้อมูลส่วนนี้จึงเปิดให้อ่านอย่างเดียว"}
                </div>
              </section>
            )}

            {showLegacyGarment ? garmentPickPanel : null}

            {step.notes || step.qcNotes ? (
              <div className="border-t border-divider pt-5 text-sm">
                <p className="font-medium text-strong">หมายเหตุของขั้นนี้</p>
                {step.notes ? <p className="mt-1 whitespace-pre-wrap text-muted">{step.notes}</p> : null}
                {step.qcNotes ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted">QC: {step.qcNotes}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {showSpec ? (
          <aside className="min-w-0 border-t border-divider bg-surface-muted px-5 py-7 sm:px-7 sm:py-8 xl:border-l xl:border-t-0">
            <div className="xl:sticky xl:top-28">
              <ProductionDesignCard
                order={order!}
                embedded
                focusStepType={step.stepType}
                missingApprovalIsReference={allPrintStepsCompleted}
              />
            </div>
          </aside>
        ) : null}
      </article>
    );
  };

  const productionHistoryContent = (
    <div aria-label="เส้นทางงานทั้งหมด">
      {workflowSteps.length > 0 ? (
        <ProductionStepsList
          readOnly
          compact={surface === "erp"}
          steps={workflowSteps}
          canOutsource={canOutsource}
          canUpdateStep={canUpdateStep}
          canSupervise={canSuperviseStep}
          canActOnStep={canActOnStep}
          canOpenStepDetails={canOpenStepDetails}
          meId={me?.id ?? null}
          busy={quickPass.isPending}
          onSelectStep={setSelectedStep}
          onOutsourceStep={setOutsourceStep}
          onQuickPass={handleQuickPass}
          onStartStep={handleStartStep}
          onCompleteStep={handleCompleteStep}
          printRunsHref={
            surface === "station"
              ? "/factory/station?station=dtf-print"
              : "/production/print-runs"
          }
        />
      ) : (
        <p className="text-sm text-muted">ใบผลิตนี้ยังไม่มีขั้นตอน</p>
      )}
    </div>
  );

  const productionHistoryPanel = (
    <section
      className="card-surface rounded-2xl p-5 sm:p-6"
      aria-labelledby="production-route"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 id="production-route" className="text-base font-semibold text-strong">
          เส้นทางงาน
        </h3>
        <span className="text-xs tabular-nums text-muted">
          {completedSteps}/{totalSteps} ขั้น
        </span>
      </div>
      {productionHistoryContent}
    </section>
  );

  const productionInventoryContent = production && order ? (
    <div
      className={cn(
        "grid gap-7",
        viewedStep?.stepType !== "GARMENT_PICK" &&
          viewedStep?.id !== legacyGarmentCheckNowStep?.step.id &&
          "lg:grid-cols-2",
      )}
    >
      {viewedStep?.stepType !== "GARMENT_PICK" &&
      viewedStep?.id !== legacyGarmentCheckNowStep?.step.id
        ? garmentPickPanel
        : null}
      {hasProductionPermission ? (
        <MaterialUsage
          productionId={production.id}
          orderNumber={order.orderNumber}
          showCosts={canSeeCost}
          readOnly={!canUpdateStep}
          embedded
        />
      ) : (
        <div>
          <h3 className="font-semibold text-strong">วัตถุดิบ</h3>
          <p className="mt-1 text-sm text-muted">
            บัญชีนี้ดูใบผลิตได้ แต่ไม่มีสิทธิ์จัดการรายการวัตถุดิบ
          </p>
        </div>
      )}
    </div>
  ) : null;

  return (
    <PageShell
      width={surface === "erp" ? "full" : "content"}
      className={
        surface === "erp"
          ? "-mx-4 -mt-6 min-h-[calc(100dvh-4rem)] sm:-mx-6 sm:-mt-8 lg:-mx-8"
          : undefined
      }
      title={order?.orderNumber ?? "งานผลิต"}
      description={order ? [order.title, order.customer?.name].filter(Boolean).join(" · ") : undefined}
      header={
        surface === "erp" ? (
          <ProductionWorkbenchHeader
            order={order}
            loading={productionQuery.isLoading || meQuery.isLoading}
            totalQty={totalQty}
            completedSteps={completedSteps}
            totalSteps={totalSteps}
            isOverdue={isOverdue}
            readOnly={!!me && !canUpdateStep && !canOutsource}
            onOpenInspector={() => setInspectorSection("inventory")}
          />
        ) : undefined
      }
      back={
        productionNotFound
          ? undefined
          : surface === "station"
            ? { href: stationHref, label: "กลับคิวสถานี" }
            : { href: "/production", label: "กลับคิวผลิต" }
      }
      titleBadge={
        surface === "station" && order ? (
          <>
            <OrderStatusBadge internalStatus={order.internalStatus} compact />
            {me && (!canUpdateStep || stationBlockMessage) && !canOutsource ? (
              <Badge variant="outline" size="sm">
                ดูอย่างเดียว
              </Badge>
            ) : null}
          </>
        ) : undefined
      }
      action={
        surface === "station" && order ? (
          <Button variant="outline" size="sm" asChild>
            <a href={`/print/job-ticket/${order.id}`} target="_blank" rel="noreferrer">
              <ClipboardList />
              ใบสั่งงาน
            </a>
          </Button>
        ) : undefined
      }
      headerChildren={
        surface === "station" && order ? (
          <dl
            aria-label="สรุปใบผลิต"
            className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl bg-surface-muted px-4 py-3 sm:flex sm:min-h-14 sm:flex-wrap sm:items-center sm:px-5"
          >
            {order.deadline ? (
              <ProductionJobFact icon={CalendarClock} label="กำหนดส่ง">
                <span className={cn(isOverdue && "text-red-700 dark:text-red-300")}>
                  {formatDate(order.deadline)}
                </span>
              </ProductionJobFact>
            ) : null}
            {order.priority === "HIGH" || order.priority === "URGENT" ? (
              <ProductionJobFact icon={Flag} label="ความสำคัญ">
                <Badge
                  variant={order.priority === "URGENT" ? "destructive" : "warning"}
                  size="sm"
                >
                  {PRIORITY_LABELS[order.priority] ?? order.priority}
                </Badge>
              </ProductionJobFact>
            ) : null}
            <ProductionJobFact icon={Shirt} label="จำนวน">
              <span className="tabular-nums">{totalQty.toLocaleString("th-TH")} ตัว</span>
            </ProductionJobFact>
            <ProductionJobFact icon={ListChecks} label="ขั้นตอน">
              <div className="flex min-w-0 items-center gap-3 sm:min-w-44">
                <span className="shrink-0 tabular-nums">
                  {completedSteps}/{totalSteps} ขั้น
                </span>
                <div
                  role="progressbar"
                  aria-label="ความคืบหน้าขั้นการผลิต"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completedPct}
                  className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-divider"
                >
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${completedPct}%` }}
                  />
                </div>
              </div>
            </ProductionJobFact>
          </dl>
        ) : undefined
      }
      loading={productionQuery.isLoading || meQuery.isLoading}
      error={
        meQuery.isError && !me
          ? {
              message: "โหลดสิทธิ์การผลิตไม่สำเร็จ",
              onRetry: () => meQuery.refetch(),
            }
          : productionQuery.isError && !production && !productionNotFound
            ? {
                message: "โหลดงานผลิตไม่สำเร็จ",
                onRetry: () => productionQuery.refetch(),
              }
            : null
      }
      skeleton={surface === "erp" ? <ProductionJacketSkeleton /> : <ProductionDetailSkeleton />}
    >
      {production && order ? (
        <div className={cn(surface === "erp" ? "min-w-0 bg-bg" : "space-y-5")}>
          {writeDataStale && (
            <div className={surface === "erp" ? "border-b border-divider px-4 py-3 sm:px-6 lg:px-8" : undefined}>
              <Alert variant="warning">
                ข้อมูลล่าสุดอาจยังไม่สด — ปิดปุ่มบันทึกชั่วคราวและกำลังลองเชื่อมต่อใหม่
              </Alert>
            </div>
          )}

          {surface === "erp" ? (
            <>
              <ProductionStepNavigator
                steps={workflowSteps}
                nowSteps={nowSteps}
                value={activeViewedStepId ?? ""}
                onValueChange={setViewedStepId}
                readOnly={!canUpdateStep && !canOutsource}
                renderStep={renderFocusedStep}
              />
              {inspectorSection ? (
                <ProductionJobInspector
                  section={inspectorSection}
                  onSectionChange={setInspectorSection}
                  onClose={() => setInspectorSection(null)}
                  inventory={productionInventoryContent}
                  history={productionHistoryContent}
                />
              ) : null}
            </>
          ) : (
            <>
              {currentActionRegion}
              {garmentPickIsCurrent || legacyGarmentShownWithCurrentWork
                ? garmentPickPanel
                : null}

              <section className="min-w-0 space-y-5" aria-labelledby="production-reference">
                <header>
                  <h2 id="production-reference" className="text-base font-semibold text-strong">
                    ข้อมูลสำหรับทำงาน
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    แบบ จำนวน ขั้นตอน และรายการเบิกของใบนี้
                  </p>
                </header>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)] xl:items-start">
                  <ProductionDesignCard
                    order={order}
                    missingApprovalIsReference={allPrintStepsCompleted}
                  />
                  {productionHistoryPanel}
                </div>

                {!garmentPickIsCurrent && !legacyGarmentShownWithCurrentWork
                  ? garmentPickPanel
                  : null}
              </section>
            </>
          )}

          {selectedStepLive && canOpenStepDetails(selectedStepLive) && (
            <StepUpdateDialog step={selectedStepLive} onClose={() => setSelectedStep(null)} />
          )}
          {outsourceStep && !writeDataStale && (
            <StepOutsourceDialog step={outsourceStep} onClose={() => setOutsourceStep(null)} />
          )}
          {qtySheetStep && !writeDataStale && (
            <StepQtySheet
              // key ผูกยอดจริง — ยอดเปลี่ยน (refetch/คนอื่นบันทึกคั่น) input reset เป็นที่เหลือใหม่
              key={`${qtySheetStep.id}:${qtySheetStep.qtyDone}`}
              step={qtySheetStep}
              busy={quickPass.isPending}
              onSubmit={(payload) => quickPass.mutate({ stepId: qtySheetStep.id, ...payload })}
              onClose={() => setQtyStepId(null)}
            />
          )}
        </div>
      ) : (
        <RecordNotFound
          what="งานผลิตใบนี้"
          backHref={surface === "station" ? stationHref : "/production"}
          backLabel={surface === "station" ? "กลับจอประจำสถานี" : "กลับไปการผลิต"}
        />
      )}
    </PageShell>
  );
}
