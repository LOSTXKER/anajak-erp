"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import {
  Factory,
  Clock,
  User,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { MaterialUsage } from "@/components/material-usage";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { STEP_TYPE_LABELS as stepTypeLabels } from "@/lib/production-steps";

type StepVariant = "default" | "accent" | "success" | "warning" | "destructive";

const stepStatusConfig: Record<string, { label: string; variant: StepVariant }> = {
  PENDING: { label: "รอ", variant: "default" },
  IN_PROGRESS: { label: "กำลังทำ", variant: "accent" },
  COMPLETED: { label: "เสร็จ", variant: "success" },
  ON_HOLD: { label: "พัก", variant: "warning" },
  FAILED: { label: "ล้มเหลว", variant: "destructive" },
};

function MaterialToggle({
  productionId,
  orderNumber,
}: {
  productionId: string;
  orderNumber: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />
          วัตถุดิบ / Materials
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <MaterialUsage productionId={productionId} orderNumber={orderNumber} />
        </div>
      )}
    </div>
  );
}

export default function ProductionPage() {
  const { data: productions, isLoading } = trpc.production.board.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="การผลิต" description="Production Board" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="การผลิต"
        description={`Production Board · งานที่กำลังดำเนินการ ${productions?.length ?? 0} รายการ`}
      />

      {(!productions || productions.length === 0) && (
        <div className="rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80">
          <EmptyState icon={Factory} title="ไม่มีงานผลิตกำลังดำเนินการ" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {productions?.map((prod) => {
          const completedSteps = prod.steps.filter(
            (s) => s.status === "COMPLETED"
          ).length;
          const totalSteps = prod.steps.length;
          const progress =
            totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
          const isOverdue =
            prod.order.deadline && new Date(prod.order.deadline) < new Date();

          return (
            <div
              key={prod.id}
              className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80"
            >
              <div className="space-y-2 px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/orders/${prod.order.id}`}
                      className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {prod.order.orderNumber}
                    </Link>
                    <p className="truncate text-sm text-slate-900 dark:text-white">
                      {prod.order.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {prod.order.customer.name}
                    </p>
                  </div>
                  {isOverdue && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" />
                      เลยกำหนด
                    </span>
                  )}
                </div>
                {prod.order.deadline && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    กำหนด: {formatDate(prod.order.deadline)}
                  </div>
                )}
              </div>

              <div className="space-y-3 px-4 pb-4">
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500">ความคืบหน้า</span>
                    <span className="font-medium tabular-nums">
                      {completedSteps}/{totalSteps}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {prod.steps.map((step) => {
                    const cfg =
                      stepStatusConfig[step.status] ?? stepStatusConfig.PENDING;
                    return (
                      <li
                        key={step.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              step.status === "COMPLETED"
                                ? "bg-green-500"
                                : step.status === "IN_PROGRESS"
                                  ? "bg-blue-500"
                                  : "bg-slate-300"
                            )}
                          />
                          <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                            {step.customStepName ||
                              stepTypeLabels[step.stepType] ||
                              step.stepType}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {step.assignedTo && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <User className="h-3 w-3" />
                              {step.assignedTo.name}
                            </span>
                          )}
                          <Badge variant={cfg.variant} size="sm">
                            {cfg.label}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <MaterialToggle
                productionId={prod.id}
                orderNumber={prod.order.orderNumber}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
