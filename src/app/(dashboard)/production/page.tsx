"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { Factory, Clock, User, AlertTriangle, Package, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { MaterialUsage } from "@/components/material-usage";

const stepTypeLabels: Record<string, string> = {
  PATTERN_MAKING: "แพทเทิร์น",
  SCREEN_PRINTING: "สกรีน",
  TAGGING: "ป้ายแท็ก",
  PACKAGING: "แพ็คสินค้า",
  EMBROIDERY: "ปัก",
  SPECIAL_PRINT: "พิมพ์พิเศษ",
  SEWING: "เย็บ",
  CUSTOM: "อื่นๆ",
};

const stepStatusConfig: Record<string, { label: string; variant: "secondary" | "default" | "success" | "warning" | "destructive" }> = {
  PENDING: { label: "รอ", variant: "secondary" },
  IN_PROGRESS: { label: "กำลังทำ", variant: "default" },
  COMPLETED: { label: "เสร็จ", variant: "success" },
  ON_HOLD: { label: "พัก", variant: "warning" },
  FAILED: { label: "ล้มเหลว", variant: "destructive" },
};

function MaterialToggle({ productionId, orderNumber }: { productionId: string; orderNumber: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex items-center gap-1.5">
          <Package className="h-3 w-3" />
          วัตถุดิบ / Materials
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">การผลิต</h1>
          <p className="text-sm text-slate-500">Production Board</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">การผลิต</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Production Board -- งานที่กำลังดำเนินการ ({productions?.length ?? 0})
          </p>
        </div>
      </div>

      {productions?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Factory className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm text-slate-400">ไม่มีงานผลิตกำลังดำเนินการ</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {productions?.map((prod) => {
          const completedSteps = prod.steps.filter((s) => s.status === "COMPLETED").length;
          const totalSteps = prod.steps.length;
          const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
          const isOverdue = prod.order.deadline && new Date(prod.order.deadline) < new Date();

          return (
            <Card key={prod.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/orders/${prod.order.id}`}
                      className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {prod.order.orderNumber}
                    </Link>
                    <p className="text-sm text-slate-900 dark:text-white">{prod.order.title}</p>
                    <p className="text-xs text-slate-400">{prod.order.customer.name}</p>
                  </div>
                  {isOverdue && (
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs">เลยกำหนด</span>
                    </div>
                  )}
                </div>
                {prod.order.deadline && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    กำหนด: {formatDate(prod.order.deadline)}
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Progress bar */}
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">ความคืบหน้า</span>
                    <span className="font-medium tabular-nums">{completedSteps}/{totalSteps}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {prod.steps.map((step) => {
                    const cfg = stepStatusConfig[step.status] ?? stepStatusConfig.PENDING;
                    return (
                      <div
                        key={step.id}
                        className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              step.status === "COMPLETED"
                                ? "bg-green-500"
                                : step.status === "IN_PROGRESS"
                                ? "bg-blue-500"
                                : "bg-slate-300"
                            }`}
                          />
                          <span className="text-xs font-medium">
                            {step.customStepName || stepTypeLabels[step.stepType] || step.stepType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {step.assignedTo && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <User className="h-3 w-3" />
                              {step.assignedTo.name}
                            </span>
                          )}
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>

              {/* Material Usage Section */}
              <MaterialToggle
                productionId={prod.id}
                orderNumber={prod.order.orderNumber}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
