"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/page-shell";
import { MaterialUsage } from "@/components/material-usage";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProductionMockupTab } from "@/components/production/production-mockup-tab";
import { ProductionStepsList } from "@/components/production/production-steps-list";
import { ProductionNowCard } from "@/components/production/production-now-card";
import { ProductionControlRecord } from "@/components/production/production-control-record";
import { defaultProductionStepId } from "@/components/production/production-step-navigator";
import { StepUpdateDialog } from "@/components/production/step-update-dialog";
import { StepOutsourceDialog } from "@/components/production/step-outsource-dialog";
import { StepQtySheet } from "@/components/production/step-qty-sheet";
import type { ProductionStep } from "@/components/production/types";
import { PRIORITY_LABELS } from "@/lib/order-status";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowRight,
  ClipboardList,
  CalendarClock,
  Flag,
  AlertTriangle,
  Shirt,
  ListChecks,
  ClipboardCheck,
  PackageOpen,
  Route,
  type LucideIcon,
} from "lucide-react";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import {
  STEP_TYPE_LABELS,
  evaluateHeatPressGate,
  productionWorkflowSteps,
} from "@/lib/production-steps";
import { selectNowSteps } from "@/lib/production-step-actions";
import { toast } from "sonner";
import { RecordNotFound } from "@/components/ui/record-not-found";
import {
  FOCUS_INSET,
  TINT,
} from "@/components/ui/tokens";
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
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-5">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <ListPageSkeleton />
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
      <div className="border-b border-divider bg-surface">
        <div className="mx-auto max-w-[96rem] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-7 w-56 max-w-full rounded-md" />
              <Skeleton className="h-4 w-80 max-w-full rounded-md" />
            </div>
            <Skeleton className="hidden h-9 w-72 rounded-full sm:block" />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[96rem] xl:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="border-b border-divider bg-surface p-5 xl:min-h-[30rem] xl:border-b-0 xl:border-r">
          <Skeleton className="h-5 w-24 rounded-md" />
          <div className="mt-4 flex gap-2 xl:flex-col">
            <Skeleton className="h-14 w-40 shrink-0 rounded-lg xl:w-full" />
            <Skeleton className="h-14 w-40 shrink-0 rounded-lg xl:w-full" />
            <Skeleton className="h-14 w-40 shrink-0 rounded-lg xl:w-full" />
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-7">
          <div className="card-surface mx-auto max-w-4xl space-y-5 rounded-2xl p-6 sm:p-8">
            <Skeleton className="h-8 w-64 max-w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-11 w-60 max-w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

type ProductionInspectorSection = Exclude<ProductionDetailTab, "work">;

function ProductionJobInspector({
  section,
  onSectionChange,
  onClose,
  returnFocusRef,
  inventory,
  mockup,
  history,
}: {
  section: ProductionInspectorSection;
  onSectionChange: (section: ProductionInspectorSection) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  inventory: ReactNode;
  mockup: ReactNode;
  history: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-production-job-inspector=""
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
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
            <TabsTrigger value="mockup">
              <Shirt />
              ม็อกอัพ
            </TabsTrigger>
            <TabsTrigger value="history">
              <Route />
              เส้นทางทั้งหมด
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inventory" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {inventory}
          </TabsContent>
          <TabsContent value="mockup" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {mockup}
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

// ใบผลิตมี controller เดียว แต่แยก surface ชัด: ERP ใช้ควบคุมข้อยกเว้น ส่วน
// ช่างลงมือ/บันทึกผลที่ Station ตาม work center — ทั้งสองฝั่งไม่มีข้อมูลเงินของออเดอร์
export function ProductionDetailScreen({
  id,
  surface = "erp",
  station = null,
  stationQueueStatus = null,
  stationFocusStepId = null,
  initialTab = PRODUCTION_DETAIL_DEFAULT_TAB,
}: {
  id: string;
  surface?: "erp" | "station";
  station?: FactoryStationKey | null;
  stationQueueStatus?: "active" | "ready" | "blocked" | null;
  stationFocusStepId?: string | null;
  initialTab?: ProductionDetailTab;
}) {
  const inspectorButtonRef = useRef<HTMLButtonElement>(null);
  const stepDialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const [selectedStep, setSelectedStep] = useState<ProductionStep | null>(null);
  const [selectedStepMode, setSelectedStepMode] = useState<"operation" | "manager">(
    "operation",
  );
  const [outsourceStep, setOutsourceStep] = useState<ProductionStep | null>(null);
  // การเลือกขั้นใน navigator เป็น view state เท่านั้น — ห้ามใช้เป็น workflow status/action
  const [viewedStepId] = useState<string | null>(null);
  const [inspectorSection, setInspectorSection] = useState<ProductionInspectorSection | null>(
    initialTab === "inventory" || initialTab === "mockup" || initialTab === "history"
      ? initialTab
      : null,
  );
  // ขั้นนับจำนวนที่กด "เสร็จขั้นนี้" — เปิด sheet ถามจำนวน (UX1: 2 แตะ)
  // เก็บแค่ id แล้ว derive ตัว step สดจาก query ทุก render — snapshot เก่าทำยอดถอยหลังได้
  // (sheet ส่ง qtyDone แบบ absolute ถ้าฐานเก่าจะทับของจริง)
  const [qtyStepId, setQtyStepId] = useState<string | null>(null);
  // snapshot target ตอนเปิด — refetch ที่เลื่อนไป GARMENT_RECEIVE ตัวถัดไปต้องไม่
  // rebind ฟอร์ม/หลักฐาน/idempotency key ไปอีก step โดยผู้ใช้ไม่รู้ตัว.
  const [goodsReceiptStepId, setGoodsReceiptStepId] = useState<string | null>(null);

  function openOperationStep(step: ProductionStep) {
    stepDialogReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedStepMode("operation");
    setSelectedStep(step);
  }

  function openManagerStep(step: ProductionStep) {
    stepDialogReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedStepMode("manager");
    setSelectedStep(step);
  }

  const productionQuery = trpc.production.getById.useQuery(
    { id },
    {
      retry: (failureCount, error) =>
        error.data?.code !== "NOT_FOUND" && failureCount < 3,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const production = productionQuery.data;
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const confirm = useConfirm();
  const promptText = usePromptText();
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
  const reportProblem = useMutationWithInvalidation(
    trpc.production.reportStationProblem,
    {
      invalidate: [
        utils.production.getById,
        utils.production.getByOrderId,
        utils.production.kanban,
        utils.factory.stationQueue,
        utils.order.getById,
        utils.task.myToday,
      ],
      onSuccess: () => {
        toast.success("แจ้งปัญหาให้หัวหน้าแล้ว");
      },
      onError: (err: { message?: string }) => {
        toast.error("แจ้งปัญหาไม่สำเร็จ", { description: err.message });
      },
    },
  );
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

  async function handleReportProblem(step: ProductionStep) {
    const reason = await promptText({
      title: "แจ้งปัญหาของงานนี้",
      description:
        "ระบุสิ่งที่พบให้หัวหน้าตัดสินใจ งานขั้นนี้จะหยุดไว้และบันทึกต้นทางจาก Station",
      label: "รายละเอียดปัญหา",
      placeholder: "เช่น เสื้อไม่ครบ 1 ตัว หรือฟิล์มมีตำหนิ",
      confirmText: "แจ้งปัญหา",
      required: true,
      minLength: 3,
      validationMessage: "กรุณาระบุปัญหาอย่างน้อย 3 ตัวอักษร",
      destructive: true,
    });
    if (reason === null) return;
    if (reason.trim().length < 3) {
      toast.error("กรุณาระบุปัญหาอย่างน้อย 3 ตัวอักษร");
      return;
    }
    reportProblem.mutate({ stepId: step.id, reason: reason.trim() });
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
    (surface === "erp" || (
      step.status !== "FAILED" &&
      !["GARMENT_PICK", "GARMENT_RECEIVE", "DTF_PRINT"].includes(step.stepType)
    ));
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
  const stationCurrentNowStep = surface === "station"
    ? (nowSteps.find(({ step }) => step.id === stationFocusStepId) ??
      nowSteps.find(({ group }) => group === "current") ??
      nowSteps[0] ??
      null)
    : null;
  // Station เป็น one-task kiosk: แสดง action ของงานที่อยู่ตรงหน้าเพียงขั้นเดียว
  // พอปิดขั้น query จะ refetch แล้วเลื่อนขั้นถัดไปของออเดอร์เดิมขึ้นมาแทนเอง
  const actionNowSteps = surface === "station"
    ? (stationCurrentNowStep ? [stationCurrentNowStep] : [])
    : nowSteps;
  const stationCurrentStep = stationCurrentNowStep?.step ?? (
    surface === "station"
      ? workflowSteps.find(
          (step) =>
            step.status !== "COMPLETED" &&
            factoryStationKeyForStep(step.stepType) === station,
        ) ?? null
      : null
  );
  // action target ต้องเป็นงาน current ใบเดียวกับที่แสดง และผ่าน owner/readiness จริง
  // fallback มีไว้ให้เห็นบริบทเท่านั้น — ห้ามวาดปุ่มที่กดแล้ว server ปฏิเสธ
  const stationCurrentActionTarget =
    surface === "station" &&
    canUpdateStep &&
    stationCurrentNowStep?.group === "current" &&
    stationCurrentNowStep.waitingOn.length === 0 &&
    stationCurrentNowStep.step.id === stationCurrentStep?.id &&
    ["PENDING", "IN_PROGRESS"].includes(stationCurrentNowStep.step.status) &&
    canOwnOrSuperviseStep(stationCurrentNowStep.step)
      ? stationCurrentNowStep.step
      : null;
  // ปุ่มแจ้งปัญหาใช้ได้เฉพาะ current candidate ที่ผ่าน readiness จริงเท่านั้น
  // fallback มีไว้แสดงบริบท blocked/future แบบอ่านอย่างเดียว ไม่ใช่ action target
  const stationProblemTarget =
    stationCurrentActionTarget?.printRunItems.length === 0
      ? stationCurrentActionTarget
      : null;
  const stationCurrentStepIndex = stationCurrentStep
    ? workflowSteps.findIndex((step) => step.id === stationCurrentStep.id) + 1
    : 0;
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
  const canReportStationProblem =
    surface === "station" &&
    !!stationProblemTarget &&
    hasProductionPermission &&
    orderCanProduce &&
    !writeDataStale &&
    stationProblemTarget.status !== "COMPLETED" &&
    stationProblemTarget.status !== "FAILED" &&
    factoryStationKeyForStep(stationProblemTarget.stepType) === station;
  const stationContextLabel =
    stationQueueStatus === "active"
      ? "งานปัจจุบัน"
      : stationQueueStatus === "ready"
        ? "งานพร้อมที่เปิดดู"
        : stationQueueStatus === "blocked"
          ? "งานติดปัญหาที่เปิดดู"
          : "บริบทงานที่เปิดดู";
  const stationContextStepLabel =
    stationQueueStatus === "active"
      ? "ขั้นที่สถานีกำลังทำ"
      : stationQueueStatus === "ready"
        ? "ขั้นที่พร้อมรับต่อ"
        : stationQueueStatus === "blocked"
          ? "ขั้นที่ติดปัญหา"
          : "ขั้นที่เปิดดู";

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
      onOpenStep={openOperationStep}
      canOpenStep={canOpenStepDetails}
      printRunsHref={
        surface === "station"
          ? "/factory/station?station=dtf-print"
          : "/production/print-runs"
      }
      embedded={surface === "erp"}
      focused={focused}
      stationMode={surface === "station"}
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
            "flex flex-col gap-3 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between",
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
      ) : renderProductionNow(actionNowSteps)}
    </div>
  ) : null;

  const garmentPickPanel = production ? (
    <div
      id="production-garments"
      tabIndex={-1}
      className={cn("scroll-mt-24 rounded-lg", FOCUS_INSET)}
    >
      <GarmentPickCard
        productionId={production.id}
        steps={workflowSteps}
        stepId={
          surface === "station" && stationCurrentStep?.stepType === "GARMENT_PICK"
            ? stationCurrentStep.id
            : surface === "erp" && viewedStep?.stepType === "GARMENT_PICK"
              ? viewedStep.id
              : undefined
        }
        canIssueGarments={
          surface === "station" &&
          station === "prep" &&
          stationCurrentActionTarget?.stepType === "GARMENT_PICK"
        }
        canReturnGarments={
          // คืนเศษเป็น recovery ของหัวหน้าใน ERP; Station ทำเฉพาะ current operation
          surface === "erp" &&
          canSuperviseStep &&
          hasProductionPermission &&
          !writeDataStale
        }
        legacyReadinessUnknown={legacyGarmentReadinessUnknown}
        embedded
        primaryTask={
          surface === "erp"
            ? garmentPickIsCurrent && viewedStep?.id === garmentPickNowStep?.step.id
            : garmentPickIsCurrent
        }
        stationMode={surface === "station"}
      />
    </div>
  ) : null;

  const stationCurrentJob = production && order ? (
    <article
      data-station-current-job=""
      className="card-surface flex min-h-[34rem] min-w-0 flex-col rounded-2xl lg:min-h-[calc(100dvh-8rem)]"
    >
      <header className="flex flex-col gap-3 border-b border-divider px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-300">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                stationQueueStatus === "blocked"
                  ? "bg-amber-500"
                  : stationQueueStatus === "ready"
                    ? "bg-green-500"
                    : "bg-blue-500",
              )}
              aria-hidden="true"
            />
            {stationContextLabel}
          </p>
          <h1
            data-station-current-job-heading=""
            tabIndex={-1}
            className="mt-1 text-2xl font-semibold text-strong outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-3xl"
          >
            {order.orderNumber}
          </h1>
          <p className="mt-1 truncate text-sm text-muted">
            {[order.customer?.name, `${totalQty.toLocaleString("th-TH")} ตัว`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <dl className="shrink-0 text-left sm:text-right">
          <dt className="text-xs text-muted">ขั้นตอนนี้</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-strong">
            {stationCurrentStepIndex > 0
              ? `${stationCurrentStepIndex} / ${workflowSteps.length}`
              : `— / ${workflowSteps.length}`}
          </dd>
        </dl>
      </header>

      <div className="min-w-0 flex-1 space-y-5 px-5 pb-32 pt-5 sm:px-6">
        {stationCurrentStep?.stepType === "GARMENT_PICK" ? (
          garmentPickPanel
        ) : stationCurrentStep?.stepType === "GARMENT_RECEIVE" ? (
          <section className="space-y-5" aria-labelledby="station-garment-receive-title">
            <div>
              <h2
                id="station-garment-receive-title"
                className="text-2xl font-semibold text-strong"
              >
                ตรวจรับเสื้อลูกค้า
              </h2>
              <p className="mt-1 text-sm text-muted">
                นับจริงต่อไซส์ บันทึกตำหนิ และแนบรูปเมื่อจำเป็น ระบบจะปิดขั้นเมื่อรับครบ
              </p>
            </div>
            <ProductionDesignCard
              order={order}
              embedded
              focusStepType="GARMENT_RECEIVE"
              presentation="station-work-sheet"
            />
            {station === "prep" &&
            stationCurrentActionTarget?.stepType === "GARMENT_RECEIVE" ? (
              <div
                data-station-action-bar=""
                className="fixed left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-border bg-surface p-3 shadow-lg sm:w-[calc(100%-3rem)]"
                style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <Button
                  size="lg"
                  className="h-14 w-full gap-2 text-base"
                  onClick={() => setGoodsReceiptStepId(stationCurrentActionTarget.id)}
                >
                  <ClipboardCheck />
                  นับและรับเสื้อลูกค้า
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-divider bg-surface-muted px-4 py-3 text-sm text-muted">
                {!hasProductionPermission
                  ? "บัญชีนี้เปิดดูได้ แต่ไม่มีสิทธิ์บันทึกใบตรวจรับ"
                  : "ขั้นนี้ยังไม่ใช่งานที่ลงมือได้ของสถานี ดูเหตุที่รอจากคิวก่อนรับเสื้อ"}
              </p>
            )}
          </section>
        ) : (
          <>
            {stationCurrentStep && hasProductionSpec ? (
              <ProductionDesignCard
                order={order}
                embedded
                focusStepType={stationCurrentStep.stepType}
                missingApprovalIsReference={allPrintStepsCompleted}
                presentation="station-work-sheet"
              />
            ) : null}
            {currentActionRegion}
            {legacyGarmentShownWithCurrentWork ? garmentPickPanel : null}
          </>
        )}
      </div>

      <footer className="flex flex-col gap-3 border-t border-divider px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{stationContextStepLabel}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-strong">
            {stationCurrentStep
              ? stationCurrentStep.customStepName ||
                STEP_TYPE_LABELS[stationCurrentStep.stepType] ||
                stationCurrentStep.stepType
              : "ไม่พบขั้นที่ตรงกับสถานีนี้"}
          </p>
        </div>
        {stationCurrentStep?.status === "FAILED" ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/45 dark:text-red-300">
            แจ้งปัญหาแล้ว · รอหัวหน้าตัดสินใจ
          </p>
        ) : canReportStationProblem && stationProblemTarget ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-12 shrink-0 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
            disabled={reportProblem.isPending}
            aria-busy={reportProblem.isPending || undefined}
            onClick={() => void handleReportProblem(stationProblemTarget)}
          >
            <AlertTriangle />
            {reportProblem.isPending ? "กำลังแจ้ง..." : "แจ้งปัญหา"}
          </Button>
        ) : (
          <p className="text-sm text-muted">
            {writeDataStale ? "กำลังรอข้อมูลสิทธิ์ล่าสุด" : "จอนี้เปิดดูได้อย่างเดียว"}
          </p>
        )}
      </footer>

      {goodsReceiptStepId &&
      stationCurrentActionTarget?.stepType === "GARMENT_RECEIVE" &&
      stationCurrentActionTarget.id === goodsReceiptStepId ? (
        <GoodsReceiptDialog
          key={goodsReceiptStepId}
          orderId={order.id}
          productionStepId={goodsReceiptStepId}
          receiptType="CUSTOMER_GARMENT"
          onClose={() => setGoodsReceiptStepId(null)}
        />
      ) : null}
    </article>
  ) : null;

  const productionMockupContent = order ? (
    <ProductionMockupTab order={order} />
  ) : null;

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
          onSelectStep={openOperationStep}
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
          readOnly={!canUpdateStep || !canSuperviseStep}
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
      width="full"
      className={
        surface === "erp"
          ? "-mx-4 -mt-6 min-h-[calc(100dvh-4rem)] sm:-mx-6 sm:-mt-8 lg:-mx-8"
          : undefined
      }
      title={order?.orderNumber ?? "งานผลิต"}
      header={<></>}
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
            className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg bg-surface-muted px-4 py-3 sm:flex sm:min-h-14 sm:flex-wrap sm:items-center sm:px-5"
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
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out"
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
              <ProductionControlRecord
                production={production}
                canSupervise={canSuperviseOperations && hasProductionPermission}
                writeDataStale={writeDataStale}
                dataUpdatedAt={productionQuery.dataUpdatedAt}
                isFetching={productionQuery.isFetching && !productionQuery.isLoading}
                onManageStep={openManagerStep}
                onOpenMockup={() => setInspectorSection("mockup")}
                mockupButtonRef={inspectorButtonRef}
              />
              {inspectorSection ? (
                <ProductionJobInspector
                  section={inspectorSection}
                  onSectionChange={setInspectorSection}
                  onClose={() => setInspectorSection(null)}
                  returnFocusRef={inspectorButtonRef}
                  inventory={productionInventoryContent}
                  mockup={productionMockupContent}
                  history={productionHistoryContent}
                />
              ) : null}
            </>
          ) : (
            stationCurrentJob
          )}

          {selectedStepLive && canOpenStepDetails(selectedStepLive) && (
            <StepUpdateDialog
              step={selectedStepLive}
              mode={selectedStepMode}
              returnFocusRef={stepDialogReturnFocusRef}
              onClose={() => setSelectedStep(null)}
            />
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
