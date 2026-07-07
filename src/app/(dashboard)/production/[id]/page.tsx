"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { PageHeader } from "@/components/page-header";
import { MaterialUsage } from "@/components/material-usage";
import { GarmentPickCard } from "@/components/production/garment-pick-card";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { ProductionStepsList } from "@/components/production/production-steps-list";
import { StepUpdateDialog } from "@/components/production/step-update-dialog";
import { StepOutsourceDialog } from "@/components/production/step-outsource-dialog";
import { StepQtySheet } from "@/components/production/step-qty-sheet";
import type { ProductionStep } from "@/components/production/types";
import {
  INTERNAL_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { formatDate } from "@/lib/utils";
import { ClipboardList, ExternalLink, Clock, AlertTriangle, Shirt } from "lucide-react";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { toast } from "sonner";

function ProductionDetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-72" />
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

// หน้าใบผลิต — บ้านของฝั่งโรงงาน (แยกจากหน้าออเดอร์ 2026-06-12 เบสเคาะ)
// ช่างใช้หน้านี้บนมือถือหน้างาน: อัปเดตขั้นตอน/QC/เบิกวัตถุดิบ — ไม่มีเงินของออเดอร์บนหน้านี้
export default function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [selectedStep, setSelectedStep] = useState<ProductionStep | null>(null);
  const [outsourceStep, setOutsourceStep] = useState<ProductionStep | null>(null);
  // ขั้นนับจำนวนที่กด "เสร็จขั้นนี้" — เปิด sheet ถามจำนวน (UX1: 2 แตะ)
  // เก็บแค่ id แล้ว derive ตัว step สดจาก query ทุก render — snapshot เก่าทำยอดถอยหลังได้
  // (sheet ส่ง qtyDone แบบ absolute ถ้าฐานเก่าจะทับของจริง)
  const [qtyStepId, setQtyStepId] = useState<string | null>(null);

  const { data: production, isLoading, isError, refetch } =
    trpc.production.getById.useQuery({ id });
  const { data: me } = trpc.user.me.useQuery();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  // PERM: ต้นทุน/หน่วยเห็นเฉพาะสายการเงิน (server listMaterials คืน cost ให้ทุก role ที่ผ่าน
  // gate ผลิต — ชั้นนี้เป็น cosmetic กันช่างเห็นตัวเลขต้นทุนบนจอ)
  const canSeeCost = permAllows(me?.permissions, "see_finance");
  // เปิดใบส่งร้านนอก = ผู้จัดการขึ้นไป (ตรง managerUp ฝั่ง server)
  const canOutsource = !!me && permAllows(me.permissions, "supervise_operations");
  // อัปเดต/ผ่านรวดขั้นตอน = ทีมผลิตขึ้นไป (ตรง productionTeam ฝั่ง server — กันปุ่มที่กดแล้ว FORBIDDEN)
  const canUpdateStep = !!me && permAllows(me.permissions, "manage_production");

  // mutation ก้อนเดียวใช้ทุกปุ่มเร็ว (ผ่านรวด/รับงาน/เริ่ม/เสร็จ/sheet จำนวน) —
  // ยิง updateStep เดิมเสมอ ไม่มีทางลัดสถานะใหม่ (การ์ดกัน regress ใบงาน UX)
  const quickPass = useMutationWithInvalidation(trpc.production.updateStep, {
    invalidate: [
      utils.production.getById,
      utils.production.getByOrderId,
      utils.production.kanban,
      utils.order.getById,
      utils.task.myToday,
    ],
    onSuccess: () => setQtyStepId(null),
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "อัปเดตขั้นตอนไม่สำเร็จ");
    },
  });

  async function handleQuickPass(step: ProductionStep) {
    const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
    const ok = await confirm({
      title: "ผ่านรวดขั้นตอนนี้?",
      description: `"${stepName}" จะถูกบันทึกว่าเสร็จแล้ว — ใช้เมื่องานร้านนอกเสร็จเรียบร้อยโดยไม่ได้เปิดใบส่งร้านในระบบ`,
      confirmText: "ผ่านรวด",
    });
    if (!ok) return;
    quickPass.mutate({ stepId: step.id, status: "COMPLETED" });
  }

  // รับงาน/เริ่มทำ 1 แตะ — ช่างกดบนขั้นว่าง server auto-claim เป็นชื่อตัวเองเอง
  function handleStartStep(step: ProductionStep) {
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

  if (isLoading) return <ProductionDetailSkeleton />;
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (!production) return null;

  const order = production.order;
  // step ของ sheet จำนวน — อ่านสดจาก query เสมอ (ดูคอมเมนต์ที่ qtyStepId)
  const qtySheetStep = qtyStepId
    ? (production.steps.find((s) => s.id === qtyStepId) ?? null)
    : null;
  const totalQty = order.items.reduce((s, it) => s + it.totalQuantity, 0);
  const completedSteps = production.steps.filter((s) => s.status === "COMPLETED").length;
  const totalSteps = production.steps.length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const isOverdue =
    order.deadline &&
    new Date(order.deadline) < new Date() &&
    !["SHIPPED", "COMPLETED", "CANCELLED"].includes(order.internalStatus);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[{ label: "การผลิต", href: "/production" }, { label: order.orderNumber }]}
        title={order.orderNumber}
        description={[order.title, order.customer?.name].filter(Boolean).join(" · ")}
        action={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`/print/job-ticket/${order.id}`} target="_blank" rel="noreferrer">
                <ClipboardList className="h-4 w-4" />
                ใบสั่งงาน
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${order.id}`}>
                <ExternalLink className="h-4 w-4" />
                ดูออเดอร์
              </Link>
            </Button>
          </>
        }
      />

      {/* บริบทงานที่ช่างต้องเห็นก่อนจับงาน — กำหนดส่ง/ด่วน/จำนวน/สถานะออเดอร์ */}
      <div className="card-surface flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 text-sm">
        {order.deadline && (
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Clock className="h-4 w-4 text-slate-400" />
            กำหนดส่ง {formatDate(order.deadline)}
          </span>
        )}
        {isOverdue && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[12px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            เลยกำหนด
          </span>
        )}
        {order.priority && order.priority !== "NORMAL" && (
          <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">
            {PRIORITY_LABELS[order.priority] ?? order.priority}
          </Badge>
        )}
        {totalQty > 0 && (
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Shirt className="h-4 w-4 text-slate-400" />
            {totalQty.toLocaleString()} ชิ้น
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">
          สถานะออเดอร์:{" "}
          {(INTERNAL_STATUS_LABELS as Record<string, string>)[order.internalStatus] ??
            order.internalStatus}
        </span>
      </div>

      {/* แบบอนุมัติ + ลายพิมพ์ + ตารางไซส์ — ช่างเห็นครบโดยไม่ต้องพึ่งใบกระดาษ (UX1) */}
      <ProductionDesignCard order={order} />

      {/* ความคืบหน้า + ขั้นตอน */}
      <div className="card-surface space-y-4 rounded-2xl p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">ความคืบหน้า</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {completedSteps}/{totalSteps} ขั้นตอน ({progressPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <ProductionStepsList
          steps={production.steps}
          canOutsource={canOutsource}
          canUpdateStep={canUpdateStep}
          canSupervise={canOutsource}
          meId={me?.id ?? null}
          busy={quickPass.isPending}
          onSelectStep={setSelectedStep}
          onOutsourceStep={setOutsourceStep}
          onQuickPass={handleQuickPass}
          onStartStep={handleStartStep}
          onCompleteStep={handleCompleteStep}
        />
      </div>

      {/* เสื้อจากสต๊อค: เบิก (ตัดยอดจอง) + คืนเศษ — ผูกขั้น GARMENT_PICK (ก้อน 1) */}
      <GarmentPickCard
        productionId={production.id}
        steps={production.steps}
        canUpdateStep={canUpdateStep}
      />

      {/* เบิกวัตถุดิบ — ช่างเบิกได้ แต่เงิน (ต้นทุน/หน่วย) โชว์เฉพาะหัวหน้า */}
      <MaterialUsage
        productionId={production.id}
        orderNumber={order.orderNumber}
        showCosts={canSeeCost}
      />

      {selectedStep && (
        <StepUpdateDialog step={selectedStep} onClose={() => setSelectedStep(null)} />
      )}
      {outsourceStep && (
        <StepOutsourceDialog step={outsourceStep} onClose={() => setOutsourceStep(null)} />
      )}
      {qtySheetStep && (
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
  );
}
