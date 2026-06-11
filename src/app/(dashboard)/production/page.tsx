"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PageHeader } from "@/components/page-header";
import { CreateProductionDialog } from "@/components/production/create-production-dialog";
import { formatDate, cn } from "@/lib/utils";
import { STEP_TYPE_LABELS as stepTypeLabels } from "@/lib/production-steps";
import { PRINT_TYPES } from "@/types/order-form";
import {
  Factory,
  Clock,
  User,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";

type StepVariant = "default" | "accent" | "success" | "warning" | "destructive";

const stepStatusConfig: Record<string, { label: string; variant: StepVariant }> = {
  PENDING: { label: "รอ", variant: "default" },
  IN_PROGRESS: { label: "กำลังทำ", variant: "accent" },
  COMPLETED: { label: "เสร็จ", variant: "success" },
  ON_HOLD: { label: "พัก", variant: "warning" },
  FAILED: { label: "ล้มเหลว", variant: "destructive" },
};

type QueueOrder = {
  id: string;
  orderNumber: string;
  title: string;
  deadline: Date | string | null;
  internalStatus: string;
  customerName: string | null;
  totalQuantity: number;
  printTypes: string[];
};

// แถวออเดอร์ในคิวรอเปิดใบผลิต — ปุ่มเป้านิ้ว ≥44px
function QueueRow({ order, onCreate }: { order: QueueOrder; onCreate: () => void }) {
  const isOverdue = order.deadline && new Date(order.deadline) < new Date();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {order.orderNumber}
          </span>
          <span className="truncate text-sm text-slate-600 dark:text-slate-300">
            {order.title}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          {order.customerName && <span>{order.customerName}</span>}
          {order.totalQuantity > 0 && <span>· {order.totalQuantity.toLocaleString()} ชิ้น</span>}
          {order.deadline && (
            <span className={cn("flex items-center gap-1", isOverdue && "text-red-600 dark:text-red-400")}>
              <Clock className="h-3 w-3" />
              {formatDate(order.deadline)}
              {isOverdue && " (เลยกำหนด)"}
            </span>
          )}
          {order.printTypes.map((pt) => (
            <Badge key={pt} variant="secondary" size="sm">
              {PRINT_TYPES[pt] ?? pt}
            </Badge>
          ))}
        </div>
      </div>
      <Button size="sm" onClick={onCreate} className="h-10 gap-1.5">
        <Plus className="h-4 w-4" />
        เปิดใบผลิต
      </Button>
    </div>
  );
}

function ProductionWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createOrderId = searchParams.get("create");

  const { data: me } = trpc.user.me.useQuery();
  // เปิดใบผลิต = อำนาจหัวหน้า (server บังคับ managerUp) — queue โหลดเฉพาะหัวหน้า
  const isManagerUp = !!me && ["OWNER", "MANAGER"].includes(me.role);

  const { data: productions, isLoading } = trpc.production.board.useQuery();
  const queue = trpc.production.queue.useQuery(undefined, { enabled: isManagerUp });

  // dialog สร้างใบผลิต — เก็บทั้งแถว (มี printTypes สำหรับแนะนำขั้นตอน)
  const [createTarget, setCreateTarget] = useState<QueueOrder | null>(null);

  // deep-link ?create=<orderId> จากหน้าออเดอร์/my-tasks — เปิด dialog ให้เอง
  // ยิงครั้งเดียวต่อค่า param (ref กันซ้ำตอน query refetch)
  const handledCreateParam = useRef<string | null>(null);
  useEffect(() => {
    if (!createOrderId || !queue.data) return;
    if (handledCreateParam.current === createOrderId) return;
    handledCreateParam.current = createOrderId;
    const target = queue.data.find((o) => o.id === createOrderId);
    if (target) {
      setCreateTarget(target);
    } else {
      // มีใบผลิตแล้ว/สถานะไม่ถึงเกณฑ์ — บอกตรงๆ แล้วล้าง param
      toast.info("ออเดอร์นี้มีใบผลิตแล้วหรือไม่อยู่ในคิวรอเปิดใบผลิต");
    }
    router.replace("/production", { scroll: false });
  }, [createOrderId, queue.data, router]);

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

  // คิวแยก 2 กลุ่ม: พร้อมผลิตจริง (คิวผลิต/แบบผ่านแล้ว) เด่น · CONFIRMED พับไว้
  // (อาจยังรอออกแบบ — เจตนาเดียวกับ my-tasks ที่ไม่นับ CONFIRMED เป็น "รอเปิดใบผลิต")
  const readyQueue = (queue.data ?? []).filter((o) =>
    ["PRODUCTION_QUEUE", "DESIGN_APPROVED"].includes(o.internalStatus)
  );
  const confirmedQueue = (queue.data ?? []).filter(
    (o) => o.internalStatus === "CONFIRMED"
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="การผลิต"
        description={`งานที่กำลังดำเนินการ ${productions?.length ?? 0} รายการ${
          isManagerUp && readyQueue.length > 0 ? ` · รอเปิดใบผลิต ${readyQueue.length}` : ""
        }`}
      />

      {/* คิวรอเปิดใบผลิต — เฉพาะหัวหน้า (จุดสร้างใบผลิตย้ายมาที่นี่จากหน้าออเดอร์) */}
      {isManagerUp && readyQueue.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white dark:border-amber-900/40 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
            <Factory className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              รอเปิดใบผลิต ({readyQueue.length})
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {readyQueue.map((o) => (
              <QueueRow key={o.id} order={o} onCreate={() => setCreateTarget(o)} />
            ))}
          </div>
        </div>
      )}

      {isManagerUp && confirmedQueue.length > 0 && (
        <CollapsibleSection
          title={`ยืนยันแล้ว — อาจรอออกแบบ (${confirmedQueue.length})`}
          summary="เปิดใบผลิตได้เลยถ้างานไม่ต้องออกแบบ"
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {confirmedQueue.map((o) => (
              <QueueRow key={o.id} order={o} onCreate={() => setCreateTarget(o)} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {(!productions || productions.length === 0) && (
        <div className="rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80">
          <EmptyState icon={Factory} title="ไม่มีงานผลิตกำลังดำเนินการ" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {productions?.map((prod) => {
          const completedSteps = prod.steps.filter((s) => s.status === "COMPLETED").length;
          const totalSteps = prod.steps.length;
          const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
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
                      href={`/production/${prod.id}`}
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

              <div className="space-y-3 px-4 pb-3">
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
                    const cfg = stepStatusConfig[step.status] ?? stepStatusConfig.PENDING;
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

              {/* จัดการขั้นตอน/เบิกวัตถุดิบ → หน้าใบผลิต (MaterialToggle เดิมย้ายไปที่นั่น) */}
              <Link
                href={`/production/${prod.id}`}
                className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50/50 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-blue-950/20"
              >
                จัดการใบผลิต
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>

      {createTarget && (
        <CreateProductionDialog
          orderId={createTarget.id}
          orderLabel={`${createTarget.orderNumber} · ${createTarget.title}`}
          printTypes={createTarget.printTypes}
          onClose={() => setCreateTarget(null)}
          onCreated={(p) => router.push(`/production/${p.id}`)}
        />
      )}
    </div>
  );
}

export default function ProductionPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense (ข้อบังคับ Next.js ตอน prerender)
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ProductionWorkspace />
    </Suspense>
  );
}
