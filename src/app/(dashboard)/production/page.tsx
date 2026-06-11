"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { CreateProductionDialog } from "@/components/production/create-production-dialog";
import { canRoleSetStatus, PRIORITY_LABELS } from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { formatDate, cn } from "@/lib/utils";
import {
  Plus,
  Clock,
  AlertTriangle,
  ArrowRight,
  Truck,
  Factory,
  CheckCircle2,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

type KanbanOrder = RouterOutput["production"]["kanban"][number];

// คอลัมน์ = สายการผลิตจริง (DTF/สกรีน): งานไหลซ้าย→ขวา
const COLUMNS: {
  key: string;
  title: string;
  statuses: string[];
  head: string; // สีหัวคอลัมน์
  dot: string;
}[] = [
  {
    key: "queue",
    title: "รอเปิดใบผลิต",
    statuses: ["DESIGN_APPROVED", "PRODUCTION_QUEUE"],
    head: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    dot: "bg-amber-400",
  },
  {
    key: "producing",
    title: "กำลังผลิต",
    statuses: ["PRODUCING"],
    head: "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  {
    key: "qc",
    title: "ตรวจคุณภาพ",
    statuses: ["QUALITY_CHECK"],
    head: "bg-violet-50 text-violet-800 dark:bg-violet-950/30 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  {
    key: "packing",
    title: "กำลังแพ็ค",
    statuses: ["PACKING"],
    head: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  {
    key: "ready",
    title: "พร้อมจัดส่ง",
    statuses: ["READY_TO_SHIP"],
    head: "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300",
    dot: "bg-green-500",
  },
];

// ปุ่มเลื่อนคอลัมน์ถัดไป (forward in-phase ไม่ต้อง confirm/เหตุผล — server validate ซ้ำ)
const ADVANCE: Record<string, { to: InternalStatus; label: string }> = {
  QUALITY_CHECK: { to: "PACKING", label: "ผ่าน → แพ็ค" },
  PACKING: { to: "READY_TO_SHIP", label: "แพ็คเสร็จ →" },
};

function ProductionKanban() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createParam = searchParams.get("create");

  const { data: me } = trpc.user.me.useQuery();
  const { data: orders, isLoading } = trpc.production.kanban.useQuery();
  const utils = trpc.useUtils();

  const [createOrderId, setCreateOrderId] = useState<string | null>(null);

  const advance = useMutationWithInvalidation(trpc.order.updateStatus, {
    invalidate: [
      utils.production.kanban,
      utils.order.getById,
      utils.order.list,
      utils.task.myToday,
    ],
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "เลื่อนสถานะไม่สำเร็จ");
    },
  });

  // deep-link ?create=<orderId> — เปิด dialog ได้เลย (dialog ดึง context เอง ไม่พึ่ง list)
  const handledCreate = useRef<string | null>(null);
  useEffect(() => {
    if (!createParam || handledCreate.current === createParam) return;
    handledCreate.current = createParam;
    setCreateOrderId(createParam);
    router.replace("/production", { scroll: false });
  }, [createParam, router]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="การผลิต" description="สายการผลิต" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((c) => (
            <Skeleton key={c.key} className="h-80 w-[280px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const all = orders ?? [];
  const activeCount = all.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="การผลิต"
        description={`สายการผลิต · ${activeCount} งานในระบบ`}
      />

      {/* board เลื่อนแนวนอน — มือถือปัดดูทีละคอลัมน์ (snap) · desktop เห็นทั้งสาย */}
      <div className="flex snap-x gap-4 overflow-x-auto pb-3">
        {COLUMNS.map((col) => {
          const cards = all.filter((o) => col.statuses.includes(o.internalStatus));
          return (
            <div
              key={col.key}
              className="flex w-[284px] shrink-0 snap-start flex-col rounded-2xl border border-slate-200/70 bg-slate-50/40 dark:border-slate-800/60 dark:bg-slate-900/40"
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-t-2xl px-3.5 py-2.5 text-sm font-semibold",
                  col.head
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  {col.title}
                </span>
                <span className="rounded-full bg-white/70 px-1.5 text-xs tabular-nums dark:bg-black/20">
                  {cards.length}
                </span>
              </div>

              <div className="flex-1 space-y-2.5 p-2.5">
                {cards.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-300 dark:text-slate-600">
                    — ว่าง —
                  </p>
                ) : (
                  cards.map((o) => (
                    <KanbanCard
                      key={o.id}
                      order={o}
                      columnKey={col.key}
                      meRole={me?.role}
                      advancing={advance.isPending}
                      onCreate={() => setCreateOrderId(o.id)}
                      onAdvance={(to) =>
                        advance.mutate({ id: o.id, internalStatus: to as never })
                      }
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {createOrderId && (
        <CreateProductionDialog
          orderId={createOrderId}
          onClose={() => setCreateOrderId(null)}
          onCreated={(p) => router.push(`/production/${p.id}`)}
        />
      )}
    </div>
  );
}

function KanbanCard({
  order,
  columnKey,
  meRole,
  advancing,
  onCreate,
  onAdvance,
}: {
  order: KanbanOrder;
  columnKey: string;
  meRole: string | null | undefined;
  advancing: boolean;
  onCreate: () => void;
  onAdvance: (to: InternalStatus) => void;
}) {
  const isOverdue =
    order.deadline && new Date(order.deadline) < new Date();
  const next = ADVANCE[order.internalStatus];
  const canAdvance = next && canRoleSetStatus(meRole, order.internalStatus as InternalStatus, next.to);
  const pct =
    order.stepsTotal > 0 ? Math.round((order.stepsDone / order.stepsTotal) * 100) : 0;

  // การ์ดทั้งใบลิงก์เข้าหน้าใบผลิต (ถ้ามีใบ) — ยกเว้นคอลัมน์รอเปิด (ยังไม่มีใบ)
  const href = order.productionId ? `/production/${order.productionId}` : `/orders/${order.id}`;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      <Link href={href} className="block space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
            {order.orderNumber}
          </span>
          {order.priority && order.priority !== "NORMAL" && (
            <Badge
              variant={order.priority === "URGENT" ? "destructive" : "warning"}
              size="sm"
            >
              {PRIORITY_LABELS[order.priority] ?? order.priority}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-slate-600 dark:text-slate-300">{order.title}</p>
        {order.customerName && (
          <p className="truncate text-xs text-slate-400">{order.customerName}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
          {order.deadline && (
            <span
              className={cn(
                "flex items-center gap-1",
                isOverdue && "font-medium text-red-600 dark:text-red-400"
              )}
            >
              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {formatDate(order.deadline)}
            </span>
          )}
          {order.totalQuantity > 0 && <span>· {order.totalQuantity.toLocaleString()} ชิ้น</span>}
        </div>
        {order.stepsTotal > 0 && (
          <div className="flex items-center gap-2 pt-0.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-slate-400">
              {order.stepsDone}/{order.stepsTotal}
            </span>
          </div>
        )}
      </Link>

      {/* ปุ่ม action ตามคอลัมน์ — กดถึงบนมือถือ (h-9) */}
      <div className="mt-2.5">
        {columnKey === "queue" && (
          <Button size="sm" onClick={onCreate} className="h-9 w-full gap-1.5">
            <Plus className="h-4 w-4" />
            เปิดใบผลิต
          </Button>
        )}
        {columnKey === "producing" && (
          <Button variant="outline" size="sm" asChild className="h-9 w-full gap-1.5">
            <Link href={href}>
              <Factory className="h-3.5 w-3.5" />
              จัดการผลิต
            </Link>
          </Button>
        )}
        {(columnKey === "qc" || columnKey === "packing") &&
          (canAdvance ? (
            <Button
              size="sm"
              disabled={advancing}
              onClick={() => onAdvance(next!.to)}
              className="h-9 w-full gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {next!.label}
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild className="h-9 w-full">
              <Link href={href}>เปิดดู</Link>
            </Button>
          ))}
        {columnKey === "ready" && (
          <Button variant="outline" size="sm" asChild className="h-9 w-full gap-1.5">
            <Link href={`/orders/${order.id}`}>
              <Truck className="h-3.5 w-3.5" />
              ไปจัดส่ง
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProductionPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense (ข้อบังคับ Next.js ตอน prerender)
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ProductionKanban />
    </Suspense>
  );
}
