"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STEP_TYPE_LABELS, OUTSOURCE_ACTIVE_STATUSES } from "@/lib/production-steps";
import { Factory, Plus, ArrowRight, Truck, User } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

// การ์ดสรุปการผลิตบนหน้าออเดอร์ — อ่านอย่างเดียว ไม่มี dialog/ไม่มีเงิน
// ตัวจัดการจริง (ขั้นตอน/QC/outsource/เบิกวัตถุดิบ) อยู่หน้าใบผลิต /production/[id]
// (แยกโมดูลผลิตออกจากหน้าออเดอร์ — เบสเคาะ 2026-06-12)

type OrderProductions = RouterOutput["order"]["getById"]["productions"];

interface ProductionSummaryCardProps {
  orderId: string;
  internalStatus: string;
  productions: OrderProductions;
  isManagerUp: boolean;
}

export function ProductionSummaryCard({
  orderId,
  internalStatus,
  productions,
  isManagerUp,
}: ProductionSummaryCardProps) {
  const hasProduction = productions.length > 0;

  // เงื่อนไขโชว์การ์ดเดียวกับ section เดิม — มีใบผลิต หรือสถานะอยู่ช่วงผลิต
  if (
    !hasProduction &&
    ![
      "PRODUCTION_QUEUE",
      "DESIGN_APPROVED",
      "CONFIRMED",
      "PRODUCING",
      "QUALITY_CHECK",
      "PACKING",
    ].includes(internalStatus)
  ) {
    return null;
  }

  // เปิดใบผลิต = อำนาจหัวหน้า + สถานะถึงเกณฑ์ (ชุดเดียวกับปุ่มเดิม)
  const canCreate =
    isManagerUp &&
    !hasProduction &&
    ["PRODUCTION_QUEUE", "DESIGN_APPROVED", "CONFIRMED"].includes(internalStatus);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Factory className="h-4 w-4" />
          การผลิต
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasProduction ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีใบผลิต
              {canCreate && " — เปิดได้ที่หน้าการผลิต"}
            </p>
            {canCreate && (
              <Button size="sm" asChild className="gap-1.5">
                <Link href={`/production?create=${orderId}`}>
                  <Plus className="h-3.5 w-3.5" />
                  เปิดใบผลิต
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {productions.map((prod) => {
              const completed = prod.steps.filter((s) => s.status === "COMPLETED").length;
              const total = prod.steps.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              // ขั้นที่กำลังทำอยู่ = ขั้นแรกที่ยังไม่เสร็จ
              const currentStep = prod.steps.find((s) => s.status !== "COMPLETED");
              const hasActiveOutsource = prod.steps.some((s) =>
                s.outsourceOrders.some((os) => OUTSOURCE_ACTIVE_STATUSES.includes(os.status))
              );

              return (
                <div key={prod.id} className="space-y-2.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        ความคืบหน้า
                      </span>
                      <span className="font-medium tabular-nums text-slate-900 dark:text-white">
                        {completed}/{total} ขั้นตอน ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {currentStep ? (
                      <span>
                        ขั้นปัจจุบัน:{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {currentStep.customStepName ||
                            STEP_TYPE_LABELS[currentStep.stepType] ||
                            currentStep.stepType}
                        </span>
                      </span>
                    ) : (
                      <span className="font-medium text-green-600 dark:text-green-400">
                        ผลิตครบทุกขั้นตอนแล้ว
                      </span>
                    )}
                    {currentStep?.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {currentStep.assignedTo.name}
                      </span>
                    )}
                    {hasActiveOutsource && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Truck className="h-3 w-3" />
                        มีงานอยู่ร้านนอก
                      </span>
                    )}
                  </div>

                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <Link href={`/production/${prod.id}`}>
                      จัดการการผลิต
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
