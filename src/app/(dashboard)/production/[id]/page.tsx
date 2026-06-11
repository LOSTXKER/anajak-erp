"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { PageHeader } from "@/components/page-header";
import { MaterialUsage } from "@/components/material-usage";
import { ProductionStepsList } from "@/components/production/production-steps-list";
import { StepUpdateDialog } from "@/components/production/step-update-dialog";
import { StepOutsourceDialog } from "@/components/production/step-outsource-dialog";
import type { ProductionStep } from "@/components/production/types";
import {
  INTERNAL_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { formatDate } from "@/lib/utils";
import { ClipboardList, ExternalLink, Clock, AlertTriangle, Shirt } from "lucide-react";

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

  const { data: production, isLoading, isError, refetch } =
    trpc.production.getById.useQuery({ id });
  const { data: me } = trpc.user.me.useQuery();

  const isProductionStaff = me?.role === "PRODUCTION_STAFF";
  // ส่งงานร้านนอก = ผูกต้นทุน — ผู้จัดการขึ้นไป (ตรง managerUp ฝั่ง server)
  const canOutsource = !!me && ["OWNER", "MANAGER"].includes(me.role);

  if (isLoading) return <ProductionDetailSkeleton />;
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (!production) return null;

  const order = production.order;
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm dark:border-slate-800/60 dark:bg-slate-900/80">
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

      {/* ความคืบหน้า + ขั้นตอน */}
      <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 dark:border-slate-800/60 dark:bg-slate-900/80">
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
          isProductionStaff={isProductionStaff}
          canOutsource={canOutsource}
          onSelectStep={setSelectedStep}
          onOutsourceStep={setOutsourceStep}
        />
      </div>

      {/* เบิกวัตถุดิบ — ช่างเบิกได้ แต่เงิน (ต้นทุน/หน่วย) โชว์เฉพาะหัวหน้า */}
      <MaterialUsage
        productionId={production.id}
        orderNumber={order.orderNumber}
        showCosts={!isProductionStaff}
      />

      {selectedStep && (
        <StepUpdateDialog step={selectedStep} onClose={() => setSelectedStep(null)} />
      )}
      {outsourceStep && (
        <StepOutsourceDialog step={outsourceStep} onClose={() => setOutsourceStep(null)} />
      )}
    </div>
  );
}
