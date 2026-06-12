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
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import { canRoleSetStatus, PRIORITY_LABELS } from "@/lib/order-status";
import {
  STEP_TYPE_LABELS,
  laneOf,
  isOutsourceStep,
  LANE_LABELS,
  LANE_ORDER,
  OUTSOURCE_LANES,
  OUTSOURCE_STATUS_LABELS,
  OUTSOURCE_ACTIVE_STATUSES,
  evaluateHeatPressGate,
  type HeatPressGate,
  type ProductionLane,
} from "@/lib/production-steps";
import type { InternalStatus } from "@prisma/client";
import { formatDate, cn } from "@/lib/utils";
import {
  Plus,
  Clock,
  AlertTriangle,
  Truck,
  CheckCircle2,
  Play,
  FastForward,
  LayoutGrid,
  Rows3,
  PackageCheck,
  Printer,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

// หน้าการผลิต — มุมมองแยกตามเทคนิคสกรีน (เบสเคาะ 2026-06-12: "เอาทั้งสองแบบ")
// 1) คิวรอเปิดใบผลิต  2) งานในไลน์: แท็บต่อเทคนิค (มือถือ) / บอร์ดเลนรวม (จอใหญ่)
// 3) หลังผลิต: ตรวจคุณภาพ → แพ็ค → พร้อมส่ง
// ความจริงโรงงาน: ทำเอง = DTF เท่านั้น · DTG/สกรีน/ปัก/Sublimation/ตัดเย็บ/ป้ายคอ = ร้านนอก
// งานร้านนอกกด "ผ่านรวด" ปิดขั้นได้เลย — ไม่บังคับเปิดใบส่งร้าน/ไม่ถามเงิน

type KanbanOrder = RouterOutput["production"]["kanban"][number];
type KanbanStep = KanbanOrder["productions"][number]["steps"][number];

// การ์ดบนเลน = งานหนึ่งใบใน "สายงานหนึ่ง" — ออเดอร์ผสมหลายเทคนิคโผล่หลายเลนพร้อมกัน
type LaneCard = {
  order: KanbanOrder;
  productionId: string;
  lane: ProductionLane;
  currentStep: KanbanStep | null; // ขั้นแรกที่ยังไม่เสร็จในเลนนี้
  done: number;
  total: number;
  // คิวรีด DTF: gate ฟิล์ม∧เสื้อ — มีค่าเฉพาะการ์ดที่ขั้นปัจจุบันคือรีดร้อน
  pressGate?: HeatPressGate;
};

const POST_COLUMNS: {
  key: string;
  title: string;
  status: InternalStatus;
  next?: { to: InternalStatus; label: string };
}[] = [
  { key: "qc", title: "ตรวจคุณภาพ", status: "QUALITY_CHECK", next: { to: "PACKING", label: "ผ่าน → แพ็ค" } },
  { key: "packing", title: "กำลังแพ็ค", status: "PACKING", next: { to: "READY_TO_SHIP", label: "แพ็คเสร็จ →" } },
  { key: "ready", title: "พร้อมจัดส่ง", status: "READY_TO_SHIP" },
];

function buildLaneCards(orders: KanbanOrder[]): Map<ProductionLane, LaneCard[]> {
  const byLane = new Map<ProductionLane, LaneCard[]>();
  for (const order of orders) {
    for (const production of order.productions) {
      const laneSteps = new Map<ProductionLane, KanbanStep[]>();
      for (const step of production.steps) {
        const lane = laneOf(step.stepType);
        const list = laneSteps.get(lane) ?? [];
        list.push(step);
        laneSteps.set(lane, list);
      }
      // เลนแพ็คคือ "คิวงานพร้อมแพ็ค" — โผล่เฉพาะเมื่อสายอื่นเสร็จครบ ไม่งั้นทุกใบผลิต
      // จะกองในเลนแพ็คตั้งแต่วันแรก (กดเสร็จข้ามขั้นได้ทั้งที่ของยังไม่มีจริง)
      const nonPackDone = production.steps
        .filter((s) => laneOf(s.stepType) !== "PACK")
        .every((s) => s.status === "COMPLETED");
      for (const [lane, steps] of laneSteps) {
        const pending = steps.filter((s) => s.status !== "COMPLETED");
        if (pending.length === 0) continue; // สายนี้จบแล้ว — การ์ดหายจากเลน
        if (lane === "PACK" && !nonPackDone) continue; // ยังแพ็คไม่ได้ — รอสายอื่น
        const card: LaneCard = {
          order,
          productionId: production.id,
          lane,
          currentStep: pending[0],
          done: steps.length - pending.length,
          total: steps.length,
          // ช่างรีดลงมือได้เมื่อ ฟิล์มเสร็จ∧เสื้อพร้อม — การ์ดติด gate โชว์ "รออะไร" แทนปุ่ม
          ...(pending[0].stepType === "HEAT_PRESS"
            ? { pressGate: evaluateHeatPressGate(production.steps) }
            : {}),
        };
        const list = byLane.get(lane) ?? [];
        list.push(card);
        byLane.set(lane, list);
      }
    }
  }
  return byLane;
}

function ProductionWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createParam = searchParams.get("create");
  const confirm = useConfirm();
  const promptText = usePromptText();

  const { data: me } = trpc.user.me.useQuery();
  const { data: orders, isLoading } = trpc.production.kanban.useQuery();
  const utils = trpc.useUtils();

  const [createOrderId, setCreateOrderId] = useState<string | null>(null);
  // มุมมองงานในไลน์: แท็บต่อเทคนิค (ค่าเริ่ม — มือถือ) / บอร์ดเลนรวม (จอใหญ่)
  const [view, setView] = useState<"tabs" | "board">("tabs");
  const [activeLane, setActiveLane] = useState<ProductionLane | null>(null);

  // โหลด preference หลัง mount — เลี่ยง hydration mismatch (localStorage ไม่มีตอน SSR)
  useEffect(() => {
    const saved = localStorage.getItem("production-view");
    if (saved === "board" || saved === "tabs") setView(saved);
  }, []);

  function changeView(v: "tabs" | "board") {
    setView(v);
    localStorage.setItem("production-view", v);
  }

  const invalidateAll = [
    utils.production.kanban,
    utils.production.getByOrderId,
    utils.production.getById,
    utils.order.getById,
    utils.order.list,
    utils.task.myToday,
    utils.outsource.listOrders,
  ];

  const advance = useMutationWithInvalidation(trpc.order.updateStatus, {
    invalidate: invalidateAll,
    onError: (err: { message?: string }) => toast.error(err.message ?? "เลื่อนสถานะไม่สำเร็จ"),
  });
  const updateStep = useMutationWithInvalidation(trpc.production.updateStep, {
    invalidate: invalidateAll,
    onError: (err: { message?: string }) => toast.error(err.message ?? "อัปเดตขั้นตอนไม่สำเร็จ"),
  });
  const updateOutsource = useMutationWithInvalidation(trpc.outsource.updateOrderStatus, {
    invalidate: invalidateAll,
    onError: (err: { message?: string }) => toast.error(err.message ?? "อัปเดตงานร้านนอกไม่สำเร็จ"),
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
        <PageHeader title="การผลิต" description="สายการผลิตแยกตามเทคนิค" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const all = orders ?? [];
  const role = me?.role;
  const canCreate = !!role && ["OWNER", "MANAGER"].includes(role);
  const canQc = canCreate;

  // คิวรอเปิดใบผลิต — CONFIRMED มาเฉพาะ READY_MADE (server กรองแล้ว: เสื้อเปล่าจาก
  // สต๊อคไม่มีขั้นออกแบบ จุดพร้อมผลิตคือ CONFIRMED) + เคสหลุด: PRODUCING ไร้ใบผลิต
  const queueAll = all.filter(
    (o) =>
      ["CONFIRMED", "DESIGN_APPROVED", "PRODUCTION_QUEUE"].includes(o.internalStatus) ||
      (o.internalStatus === "PRODUCING" && o.productions.length === 0)
  );
  // ด่านพร้อมผลิต (เงิน/แบบ/ของครบ): งานติดด่านแยกกอง "ติดอะไร รอใคร" — ช่างไม่เห็นเลย
  // (ช่างเห็นเฉพาะงานที่ลงมือได้จริง) · หัวหน้า/ขาย/การเงินเห็นเพื่อตามแก้ต้นเหตุ
  const queue = queueAll.filter((o) => o.readiness?.ready !== false);
  const blockedQueue = queueAll.filter((o) => o.readiness?.ready === false);
  const showBlocked = role !== "PRODUCTION_STAFF" && blockedQueue.length > 0;
  const producing = all.filter(
    (o) => o.internalStatus === "PRODUCING" && o.productions.length > 0
  );
  const laneCards = buildLaneCards(producing);
  const lanesWithWork = LANE_ORDER.filter((l) => (laneCards.get(l)?.length ?? 0) > 0);
  const currentLane =
    activeLane && lanesWithWork.includes(activeLane) ? activeLane : lanesWithWork[0] ?? null;

  // ── actions ต่อการ์ดเลน ──
  async function handleQuickPass(card: LaneCard) {
    const step = card.currentStep!;
    const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
    const ok = await confirm({
      title: "ผ่านรวดขั้นตอนนี้?",
      description: `"${stepName}" ของ ${card.order.orderNumber} จะถูกบันทึกว่าเสร็จแล้ว — ใช้เมื่องานร้านนอกเสร็จเรียบร้อยโดยไม่ได้เปิดใบส่งร้านในระบบ`,
      confirmText: "ผ่านรวด",
    });
    if (!ok) return;
    updateStep.mutate({ stepId: step.id, status: "COMPLETED" });
  }

  async function handleOutsourceQcFail(outsourceId: string) {
    const reason = await promptText({
      title: "QC ไม่ผ่าน — เพราะอะไร?",
      placeholder: "เช่น สีเพี้ยน / ปักผิดตำแหน่ง",
      required: true,
      destructive: true,
      confirmText: "บันทึกไม่ผ่าน",
    });
    if (reason === null) return;
    updateOutsource.mutate({ id: outsourceId, status: "QC_FAILED", qcNotes: reason });
  }

  const busy = updateStep.isPending || updateOutsource.isPending || advance.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="การผลิต"
        description={`สายการผลิตแยกตามเทคนิค · ${all.length} งานในระบบ`}
        action={
          // จอช่างพิมพ์ DTF — รวมหลายงานลงม้วนเดียว (FLOW-REDESIGN ก้อน 2)
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/production/print-runs">
              <Printer className="h-4 w-4" />
              รอบพิมพ์ฟิล์ม
            </Link>
          </Button>
        }
      />

      {/* ── 1) รอเปิดใบผลิต ── */}
      {queue.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            รอเปิดใบผลิต
            <span className="rounded-full bg-amber-50 px-1.5 text-xs tabular-nums text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {queue.length}
            </span>
          </h2>
          <div className="flex snap-x gap-3 overflow-x-auto pb-1.5">
            {queue.map((o) => (
              <div
                key={o.id}
                className="w-[260px] shrink-0 snap-start rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-900"
              >
                <OrderCardHeader order={o} href={`/orders/${o.id}`} />
                <div className="mt-2.5">
                  {canCreate ? (
                    <Button
                      size="sm"
                      onClick={() => setCreateOrderId(o.id)}
                      className="h-9 w-full gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      เปิดใบผลิต
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild className="h-9 w-full">
                      <Link href={`/orders/${o.id}`}>เปิดดูออเดอร์</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 1b) ติดด่านพร้อมผลิต — "ติดอะไร รอใคร" (ช่างไม่เห็นกองนี้) ── */}
      {showBlocked && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            ติดด่านพร้อมผลิต
            <span className="rounded-full bg-red-50 px-1.5 text-xs tabular-nums text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {blockedQueue.length}
            </span>
            <span className="hidden text-xs font-normal text-slate-400 sm:inline">
              เงินตามเทอม · แบบอนุมัติ · ของครบ — แก้ต้นเหตุก่อน งานถึงเข้าคิวช่าง
            </span>
          </h2>
          <div className="flex snap-x gap-3 overflow-x-auto pb-1.5">
            {blockedQueue.map((o) => (
              <div
                key={o.id}
                className="w-[280px] shrink-0 snap-start rounded-xl border border-red-200/80 bg-red-50/40 p-3 shadow-sm dark:border-red-900/50 dark:bg-red-950/20"
              >
                <OrderCardHeader order={o} href={`/orders/${o.id}`} />
                <ul className="mt-2 space-y-1.5">
                  {(o.readiness?.checks ?? [])
                    .filter((c) => !c.ok)
                    .map((c) => (
                      <li key={c.key} className="text-xs">
                        <p className="flex items-start gap-1.5 font-medium text-red-700 dark:text-red-300">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            {c.label}: {c.detail}
                          </span>
                        </p>
                        {c.waitingOn && (
                          <p className="pl-[18px] text-slate-500 dark:text-slate-400">
                            {c.waitingOn}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
                <div className="mt-2.5 flex gap-2">
                  <Button variant="outline" size="sm" asChild className="h-9 flex-1">
                    <Link href={`/orders/${o.id}`}>ไปแก้ที่ออเดอร์</Link>
                  </Button>
                  {canCreate && (
                    // soft-gate: หัวหน้าข้ามด่านได้ (งานด่วน/เคสยกเว้น) — dialog โชว์คำเตือนซ้ำ
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreateOrderId(o.id)}
                      className="h-9 text-xs text-slate-500"
                    >
                      ข้ามด่าน
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 2) งานในไลน์ผลิต — แท็บต่อเทคนิค / บอร์ดเลนรวม ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            งานในไลน์ผลิต
            <span className="rounded-full bg-blue-50 px-1.5 text-xs tabular-nums text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {producing.length}
            </span>
          </h2>
          <div className="ml-auto flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            <button
              type="button"
              onClick={() => changeView("tabs")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "tabs"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Rows3 className="h-3.5 w-3.5" />
              แท็บเทคนิค
            </button>
            <button
              type="button"
              onClick={() => changeView("board")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "board"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              บอร์ดเลน
            </button>
          </div>
        </div>

        {lanesWithWork.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
            ยังไม่มีงานในไลน์ผลิต
          </p>
        ) : view === "tabs" ? (
          <>
            {/* แถบแท็บเลน — เลื่อนแนวนอนบนมือถือ */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {lanesWithWork.map((lane) => {
                const count = laneCards.get(lane)?.length ?? 0;
                const active = lane === currentLane;
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => setActiveLane(lane)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    )}
                  >
                    {LANE_LABELS[lane]}
                    {OUTSOURCE_LANES.has(lane) && (
                      <Truck className={cn("h-3 w-3", active ? "text-white/80" : "text-slate-400")} />
                    )}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2.5">
              {(currentLane ? laneCards.get(currentLane) ?? [] : []).map((card) => (
                <LaneCardView
                  key={`${card.productionId}:${card.lane}`}
                  card={card}
                  role={role}
                  meId={me?.id}
                  canQc={canQc}
                  busy={busy}
                  onStart={(stepId) => updateStep.mutate({ stepId, status: "IN_PROGRESS" })}
                  onComplete={(stepId) => updateStep.mutate({ stepId, status: "COMPLETED" })}
                  onQuickPass={() => handleQuickPass(card)}
                  onOutsourceStatus={(id, status) => updateOutsource.mutate({ id, status })}
                  onOutsourceQcFail={handleOutsourceQcFail}
                />
              ))}
            </div>
          </>
        ) : (
          /* บอร์ดเลนรวม — คอลัมน์ต่อเทคนิค เลื่อนแนวนอน */
          <div className="flex snap-x gap-4 overflow-x-auto pb-3">
            {lanesWithWork.map((lane) => {
              const cards = laneCards.get(lane) ?? [];
              return (
                <div
                  key={lane}
                  className="flex w-[284px] shrink-0 snap-start flex-col rounded-2xl border border-slate-200/70 bg-slate-50/40 dark:border-slate-800/60 dark:bg-slate-900/40"
                >
                  <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-blue-50 px-3.5 py-2.5 text-sm font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                    <span className="flex items-center gap-2">
                      {LANE_LABELS[lane]}
                      {OUTSOURCE_LANES.has(lane) && (
                        <Badge variant="warning" size="sm">
                          ร้านนอก
                        </Badge>
                      )}
                    </span>
                    <span className="rounded-full bg-white/70 px-1.5 text-xs tabular-nums dark:bg-black/20">
                      {cards.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2.5 p-2.5">
                    {cards.map((card) => (
                      <LaneCardView
                        key={`${card.productionId}:${card.lane}`}
                        card={card}
                        role={role}
                        meId={me?.id}
                        canQc={canQc}
                        busy={busy}
                        onStart={(stepId) => updateStep.mutate({ stepId, status: "IN_PROGRESS" })}
                        onComplete={(stepId) => updateStep.mutate({ stepId, status: "COMPLETED" })}
                        onQuickPass={() => handleQuickPass(card)}
                        onOutsourceStatus={(id, status) => updateOutsource.mutate({ id, status })}
                        onOutsourceQcFail={handleOutsourceQcFail}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3) หลังผลิต: ตรวจคุณภาพ → แพ็ค → พร้อมส่ง ── */}
      <section className="space-y-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <PackageCheck className="h-4 w-4 text-slate-400" />
          หลังผลิต — ตรวจ / แพ็ค / ส่ง
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {POST_COLUMNS.map((col) => {
            const cards = all.filter((o) => o.internalStatus === col.status);
            return (
              <div
                key={col.key}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/40 dark:border-slate-800/60 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {col.title}
                  <span className="rounded-full bg-white px-1.5 text-xs tabular-nums text-slate-500 dark:bg-black/20">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2.5 p-2.5 pt-0">
                  {cards.length === 0 ? (
                    <p className="py-5 text-center text-xs text-slate-300 dark:text-slate-600">
                      — ว่าง —
                    </p>
                  ) : (
                    cards.map((o) => {
                      const canAdvance =
                        col.next && canRoleSetStatus(role, o.internalStatus as InternalStatus, col.next.to);
                      const href = o.productionId ? `/production/${o.productionId}` : `/orders/${o.id}`;
                      return (
                        <div
                          key={o.id}
                          className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-900"
                        >
                          <OrderCardHeader order={o} href={href} />
                          <div className="mt-2.5">
                            {col.next && canAdvance ? (
                              <Button
                                size="sm"
                                disabled={advance.isPending}
                                onClick={() =>
                                  advance.mutate({ id: o.id, internalStatus: col.next!.to as never })
                                }
                                className="h-9 w-full gap-1.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {col.next.label}
                              </Button>
                            ) : col.key === "ready" ? (
                              <Button variant="outline" size="sm" asChild className="h-9 w-full gap-1.5">
                                <Link href={`/orders/${o.id}`}>
                                  <Truck className="h-3.5 w-3.5" />
                                  ไปจัดส่ง
                                </Link>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" asChild className="h-9 w-full">
                                <Link href={href}>เปิดดู</Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

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

// หัวการ์ดงาน — เลขออเดอร์/ชื่อ/ลูกค้า/กำหนดส่ง/จำนวน (ใช้ร่วมทุก section)
function OrderCardHeader({ order, href }: { order: KanbanOrder; href: string }) {
  const isOverdue = order.deadline && new Date(order.deadline) < new Date();
  return (
    <Link href={href} className="block space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
          {order.orderNumber}
        </span>
        {order.priority && order.priority !== "NORMAL" && (
          <Badge variant={order.priority === "URGENT" ? "destructive" : "warning"} size="sm">
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
    </Link>
  );
}

// การ์ดงานบนเลนเทคนิค — โชว์ขั้นปัจจุบันของสายนั้น + ปุ่มกดสั้นๆ ตามชนิดงาน
function LaneCardView({
  card,
  role,
  meId,
  canQc,
  busy,
  onStart,
  onComplete,
  onQuickPass,
  onOutsourceStatus,
  onOutsourceQcFail,
}: {
  card: LaneCard;
  role: string | null | undefined;
  meId: string | undefined;
  canQc: boolean;
  busy: boolean;
  onStart: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  onQuickPass: () => void;
  onOutsourceStatus: (outsourceId: string, status: "SENT" | "RECEIVED_BACK" | "QC_PASSED") => void;
  onOutsourceQcFail: (outsourceId: string) => void;
}) {
  const step = card.currentStep!;
  const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
  const href = `/production/${card.productionId}`;
  const latestOutsource = step.outsourceOrders[0];
  const activeOutsource =
    latestOutsource && OUTSOURCE_ACTIVE_STATUSES.includes(latestOutsource.status)
      ? latestOutsource
      : null;
  // ช่างแตะได้เฉพาะงานของตัวเอง/งานที่ยังไม่มีเจ้าของ (ตรง server) — ปุ่มบนงานของ
  // คนอื่นกดแล้ว FORBIDDEN แน่นอน จึงไม่โชว์ แสดงชื่อเจ้าของแทน
  const ownedByOther =
    role === "PRODUCTION_STAFF" && !!step.assignedTo && step.assignedTo.id !== meId;
  const canTouchStep =
    !!role && ["OWNER", "MANAGER", "PRODUCTION_STAFF"].includes(role) && !ownedByOther;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      <OrderCardHeader order={card.order} href={href} />

      {/* ขั้นปัจจุบันของสายนี้ */}
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            step.status === "IN_PROGRESS"
              ? "bg-blue-500"
              : step.status === "FAILED"
                ? "bg-red-500"
                : "bg-slate-300 dark:bg-slate-600"
          )}
        />
        <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
          {stepName}
        </span>
        {/* บอกบางส่วนได้: ทำแล้วกี่ตัวจากทั้งกอง (โชว์เมื่อขั้นนับจำนวน) */}
        {step.qtyTotal !== null && step.qtyTotal > 0 && (
          <span className="shrink-0 tabular-nums text-slate-400">
            {step.qtyDone}/{step.qtyTotal} ตัว
          </span>
        )}
        {step.assignedTo && (
          <span className="max-w-[90px] shrink-0 truncate text-slate-400">
            {step.assignedTo.name}
          </span>
        )}
        <span className="shrink-0 tabular-nums text-slate-400">
          {card.done}/{card.total}
        </span>
      </div>
      {activeOutsource && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <Truck className="h-3 w-3 shrink-0" />
          {activeOutsource.vendor.name} ·{" "}
          {OUTSOURCE_STATUS_LABELS[activeOutsource.status] ?? activeOutsource.status}
          {activeOutsource.expectedBackAt &&
            ` · กำหนดรับ ${formatDate(activeOutsource.expectedBackAt)}`}
        </p>
      )}

      {/* ปุ่มตามชนิดงาน — ทำเอง: เริ่ม/เสร็จ · ร้านนอก: ส่งร้าน-รับกลับ-QC หรือผ่านรวด
          ขั้นมีปัญหา (FAILED) / QC ร้านไม่ผ่าน ต้องเข้าไปดูหน้าใบผลิต ห้ามผ่านรวดจากการ์ด */}
      {ownedByOther && (
        <div className="mt-2.5">
          <Button variant="outline" size="sm" asChild className="h-9 w-full">
            <Link href={href}>งานของ {step.assignedTo!.name} — เปิดดู</Link>
          </Button>
        </div>
      )}
      {/* คิวรีดติด gate — บอกตรงๆ ว่ารออะไร ไม่โชว์ปุ่มเริ่ม (เสื้อ/ฟิล์มยังไม่บรรจบ
          ช่างเริ่มรีดไม่ได้จริง เช่น เสื้อยังอยู่ร้านปัก) · แก้ที่ต้นเหตุผ่านหน้าใบผลิต */}
      {card.pressGate && !card.pressGate.ready && step.status !== "FAILED" && (
        <div className="mt-2.5 space-y-1.5">
          {card.pressGate.waitingOn.map((w) => (
            <p
              key={w}
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
      {canTouchStep && !(card.pressGate && !card.pressGate.ready && step.status !== "FAILED") && (
        <div className="mt-2.5 flex gap-2">
          {step.status === "FAILED" ? (
            <Button variant="outline" size="sm" asChild className="h-9 w-full">
              <Link href={href}>มีปัญหา — เปิดดู</Link>
            </Button>
          ) : latestOutsource?.status === "QC_FAILED" && step.status !== "COMPLETED" ? (
            <Button variant="outline" size="sm" asChild className="h-9 w-full">
              <Link href={href}>QC ร้านไม่ผ่าน — ส่งแก้รอบใหม่</Link>
            </Button>
          ) : activeOutsource ? (
            activeOutsource.status === "DRAFT" ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onOutsourceStatus(activeOutsource.id, "SENT")}
                className="h-9 flex-1 gap-1.5"
              >
                <Truck className="h-3.5 w-3.5" />
                ส่งของให้ร้านแล้ว
              </Button>
            ) : activeOutsource.status === "RECEIVED_BACK" ? (
              canQc ? (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onOutsourceStatus(activeOutsource.id, "QC_PASSED")}
                    className="h-9 flex-1 gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    QC ผ่าน
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onOutsourceQcFail(activeOutsource.id)}
                    className="h-9 flex-1 text-red-600 hover:text-red-700"
                  >
                    ไม่ผ่าน
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" asChild className="h-9 w-full">
                  <Link href={href}>รอหัวหน้าตัดสิน QC</Link>
                </Button>
              )
            ) : (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onOutsourceStatus(activeOutsource.id, "RECEIVED_BACK")}
                className="h-9 flex-1 gap-1.5"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                รับของกลับแล้ว
              </Button>
            )
          ) : isOutsourceStep(step.stepType) ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onQuickPass}
              className="h-9 flex-1 gap-1.5"
            >
              <FastForward className="h-3.5 w-3.5" />
              ผ่านรวด
            </Button>
          ) : step.status === "IN_PROGRESS" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onComplete(step.id)}
              className="h-9 flex-1 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              เสร็จขั้นนี้
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onStart(step.id)}
              className="h-9 flex-1 gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              เริ่มทำ
            </Button>
          )}
        </div>
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
