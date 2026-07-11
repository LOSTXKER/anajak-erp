"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { PageHeader } from "@/components/page-header";
import { CreateProductionDialog } from "@/components/production/create-production-dialog";
import { StepQtySheet } from "@/components/production/step-qty-sheet";
import {
  ProductionCommandCenter,
  type FireItem,
  type LaneTile,
} from "@/components/production/production-command-center";
import { QcCountDialog } from "@/components/qc/order-qc-section";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import { canPermsSetStatus, PRIORITY_LABELS } from "@/lib/order-status";
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
  Clock,
  AlertTriangle,
  Truck,
  CheckCircle2,
  ClipboardCheck,
  Play,
  FastForward,
  ChevronLeft,
  PackageCheck,
  Printer,
  Plus,
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
  // คอลัมน์ตรวจไม่มีปุ่มเลื่อนสถานะ — ผ่านด่านได้ทางเดียวคือนับจริง (ดีครบเด้งแพ็คเอง ·
  // Gate B4: เดิม "ผ่าน → แพ็ค" ข้ามด่านนับของได้ทุก role · server ก็กันแล้วชั้นหนึ่ง)
  { key: "qc", title: "ตรวจคุณภาพ", status: "QUALITY_CHECK" },
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
  const { data: orders, isLoading, isError, refetch } = trpc.production.kanban.useQuery();
  const utils = trpc.useUtils();

  const [createOrderId, setCreateOrderId] = useState<string | null>(null);
  // UX8: ขั้นนับจำนวนที่เปิด bottom sheet บันทึกจำนวนอยู่ (รีด/แพ็ค ฯลฯ) — ยิง updateStep เดิม
  const [qtyStep, setQtyStep] = useState<KanbanStep | null>(null);
  // ใบนับ QC จากคอลัมน์ตรวจ (Gate B4) — ผ่านด่านตรวจ = นับจริงเท่านั้น ไม่มีปุ่มข้าม
  const [qcOrderId, setQcOrderId] = useState<string | null>(null);
  // รับของกลับจากบอร์ดเลน — บังคับใบตรวจนับก่อน flip สถานะ (แบบเดียวกับหน้า /outsource)
  const [receiveTarget, setReceiveTarget] = useState<{
    id: string;
    orderId: string;
    description: string;
    quantity: number;
  } | null>(null);
  // ศูนย์บัญชาการ (default) → แตะ tile ลงลึกดูรายการจริงของสายนั้น (เลนผลิต/หลังผลิต)
  // ไม่มี toggle view ให้เลือกก่อนเห็นงานอีกแล้ว — เปิดมาเห็นภาพรวมทั้งโรงงานเลย
  const [focus, setFocus] = useState<
    { kind: "lane"; lane: ProductionLane } | { kind: "post"; key: string } | null
  >(null);

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

  // บอร์ดโหลดไม่สำเร็จต้องบอกตรงๆ — ไม่งั้น orders ?? [] โชว์บอร์ดว่างเหมือน "ไม่มีงาน"
  // && !orders: พังเฉพาะโหลดแรก — refetch เบื้องหลังล้มทั้งที่มี cache ห้ามถอนบอร์ด
  // (dialog นับ QC/รับของที่เปิดค้างจะโดน unmount ตัวเลขที่พิมพ์หาย — review จับ)
  if (isError && !orders) return <QueryError onRetry={() => refetch()} />;

  const all = orders ?? [];
  const role = me?.role;
  const canCreate = permAllows(me?.permissions, "supervise_operations");
  const canQc = canCreate;
  // ตรวจนับ QC + รับของกลับ = งานหน้างานทีมผลิต (ตรง server: qc.create / goodsReceipt.create)
  const canCountQc = permAllows(me?.permissions, "manage_production");

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
  // ช่างเห็นเฉพาะงานลงมือได้จริง · หัวหน้า/ขาย/การเงินเห็นกอง blocked เพื่อตามแก้ (PERM: คนถูก
  // ติ๊กงานหัวหน้าเห็นด้วย — คงเดิม role อื่นเห็นตามเจตนา)
  const showBlocked =
    (role !== "PRODUCTION_STAFF" || permAllows(me?.permissions, "supervise_operations")) &&
    blockedQueue.length > 0;
  const producing = all.filter(
    (o) => o.internalStatus === "PRODUCING" && o.productions.length > 0
  );
  const laneCards = buildLaneCards(producing);
  const lanesWithWork = LANE_ORDER.filter((l) => (laneCards.get(l)?.length ?? 0) > 0);

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

  // รับของกลับจากบอร์ดเลน — เปิดใบตรวจนับ (แบบเดียวกับ /outsource) · บันทึกใบเสร็จแล้ว
  // ค่อย flip สถานะเป็น RECEIVED_BACK — server ก็บังคับใบตรวจนับอีกชั้น (Gate B4)
  // เคยนับแล้ว (flip รอบก่อนพลาด เช่น เน็ตหลุด) → flip ตรงเลย ไม่บังคับนับซ้ำเป็นใบเบิ้ล
  async function handleReceiveBack(
    card: LaneCard,
    outsource: KanbanStep["outsourceOrders"][number]
  ) {
    try {
      const receipts = await utils.goodsReceipt.listByOrder.fetch({ orderId: card.order.id });
      if (
        receipts.some(
          (r) => r.outsourceOrderId === outsource.id && r.receiptType === "OUTSOURCE_RETURN"
        )
      ) {
        updateOutsource.mutate({ id: outsource.id, status: "RECEIVED_BACK" });
        return;
      }
    } catch {
      // อ่านประวัติใบตรวจไม่ได้ — ตกไปทางเปิดฟอร์มนับตามปกติ (ปลอดภัยกว่าข้าม)
    }
    setReceiveTarget({
      id: outsource.id,
      orderId: card.order.id,
      description: outsource.description,
      quantity: outsource.quantity,
    });
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

  // ── ข้อมูลศูนย์บัญชาการ (คำนวณจาก kanban เดิม ไม่มี query ใหม่) ──
  const now = new Date();
  const isPast = (d: Date | string | null) => !!d && new Date(d) < now;

  // ต้องรีบ: เลยกำหนด + มีปัญหา (step FAILED) + ติดด่านพร้อมผลิต — ยุบต่อออเดอร์
  const fireMap = new Map<string, FireItem>();
  const ensureFire = (o: KanbanOrder, href: string): FireItem => {
    let f = fireMap.get(o.id);
    if (!f) {
      f = {
        orderId: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        customerName: o.customerName,
        deadline: o.deadline,
        priority: o.priority,
        href,
        reasons: [],
      };
      fireMap.set(o.id, f);
    }
    return f;
  };
  for (const o of producing) {
    const href = o.productionId ? `/production/${o.productionId}` : `/orders/${o.id}`;
    if (isPast(o.deadline)) ensureFire(o, href).reasons.push({ label: "เลยกำหนด", tone: "red" });
    if (o.productions.some((p) => p.steps.some((s) => s.status === "FAILED")))
      ensureFire(o, href).reasons.push({ label: "มีปัญหา", tone: "red" });
  }
  // ติดด่านพร้อมผลิต — เฉพาะคนที่เห็นกองนี้ (หัวหน้า/ขาย/การเงิน) · ช่างไม่เห็น
  if (showBlocked) {
    for (const o of blockedQueue) {
      const f = ensureFire(o, `/orders/${o.id}`);
      f.skippable = true;
      if (isPast(o.deadline)) f.reasons.push({ label: "เลยกำหนด", tone: "red" });
      const failing = (o.readiness?.checks ?? []).filter((c) => !c.ok);
      for (const c of failing) f.reasons.push({ label: c.label, tone: "amber" });
      // "รอใคร" จาก waitingOn เท่านั้น — ไม่หยิบ detail (มีตัวเลขเงินบาท ห้ามขึ้นภาพรวม)
      const waiting = failing.map((c) => c.waitingOn).filter(Boolean);
      if (waiting.length > 0) f.note = waiting.join(" · ");
    }
  }
  // แดง (เลยกำหนด/ปัญหา) ขึ้นก่อนเหลือง (ติดด่าน)
  const fires = [...fireMap.values()].sort(
    (a, b) =>
      (a.reasons.some((r) => r.tone === "red") ? 0 : 1) -
      (b.reasons.some((r) => r.tone === "red") ? 0 : 1)
  );

  // สายการผลิต — เลนผลิต + หลังผลิต · tile กวาดตาเห็นจำนวน + จุดแดงถ้ามีงานเลยกำหนด
  const laneTiles: LaneTile[] = lanesWithWork.map((lane) => {
    const cards = laneCards.get(lane) ?? [];
    return {
      key: lane,
      label: LANE_LABELS[lane],
      count: cards.length,
      overdue: cards.filter((c) => isPast(c.order.deadline)).length,
      isOutsource: OUTSOURCE_LANES.has(lane),
      tone: "line",
    };
  });
  const postTiles: LaneTile[] = POST_COLUMNS.map((col) => {
    const cards = all.filter((o) => o.internalStatus === col.status);
    return {
      key: col.key,
      label: col.title,
      count: cards.length,
      overdue: cards.filter((o) => isPast(o.deadline)).length,
      tone: "post",
    };
  });

  const queueItems = queue.map((o) => ({
    orderId: o.id,
    orderNumber: o.orderNumber,
    title: o.title,
    customerName: o.customerName,
    deadline: o.deadline,
    priority: o.priority,
    totalQuantity: o.totalQuantity,
  }));

  // งานของฉัน — ขั้นที่คน login ถืออยู่ + ยังไม่เสร็จ (strip รอง สำหรับช่าง)
  const myWork = me?.id
    ? producing.flatMap((o) =>
        o.productions.flatMap((p) =>
          p.steps
            .filter((s) => s.assignedTo?.id === me.id && s.status !== "COMPLETED")
            .map((s) => ({
              stepId: s.id,
              productionId: p.id,
              orderNumber: o.orderNumber,
              stepName: s.customStepName || STEP_TYPE_LABELS[s.stepType] || s.stepType,
              status: s.status,
            }))
        )
      )
    : [];

  const focusPostCol = focus?.kind === "post" ? POST_COLUMNS.find((c) => c.key === focus.key) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={canCreate ? "ศูนย์บัญชาการผลิต" : "งานผลิตของฉัน"}
        description={
          focus
            ? "แตะ ← เพื่อกลับภาพรวม"
            : canCreate
              ? `ภาพรวมทั้งโรงงาน · ${all.length} งานในระบบ`
              : myWork.length > 0
                ? `${myWork.length} ขั้นที่คุณรับผิดชอบ · งานของคุณอยู่บนสุด`
                : "ยังไม่มีงานที่มอบให้คุณ · ดูคิวทีมด้านล่างได้"
        }
        action={
          focus ? (
            <Button variant="ghost" size="sm" onClick={() => setFocus(null)} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" />
              ภาพรวม
            </Button>
          ) : (
            // จอช่างพิมพ์ DTF — รวมหลายงานลงม้วนเดียว (FLOW-REDESIGN ก้อน 2)
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/production/print-runs">
                <Printer className="h-4 w-4" />
                รอบพิมพ์ฟิล์ม
              </Link>
            </Button>
          )
        }
      />

      {focus === null ? (
        // ── ภาพรวม (default) — ศูนย์บัญชาการ ──
        <ProductionCommandCenter
          fires={fires}
          lanes={[...laneTiles, ...postTiles]}
          queue={queueItems}
          myWork={myWork}
          prioritizeMyWork={!canCreate}
          canCreate={canCreate}
          onPickLane={(tile) =>
            setFocus(
              tile.tone === "line"
                ? { kind: "lane", lane: tile.key as ProductionLane }
                : { kind: "post", key: tile.key }
            )
          }
          onCreate={(orderId) => setCreateOrderId(orderId)}
        />
      ) : focus.kind === "lane" ? (
        // ── ลงลึกสายผลิต — รายการการ์ดเลนเดิม (ปุ่มกด/ผ่านรวด/ร้านนอกครบ) ──
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {LANE_LABELS[focus.lane]}
            <span className="rounded-full bg-blue-50 px-1.5 text-xs tabular-nums text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {(laneCards.get(focus.lane) ?? []).length}
            </span>
          </h2>
          {(laneCards.get(focus.lane) ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
              สายนี้เคลียร์แล้ว — กลับไปภาพรวม
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(laneCards.get(focus.lane) ?? []).map((card) => (
                <LaneCardView
                  key={`${card.productionId}:${card.lane}`}
                  card={card}
                  perms={me?.permissions}
                  meId={me?.id}
                  canQc={canQc}
                  busy={busy}
                  onStart={(stepId) => updateStep.mutate({ stepId, status: "IN_PROGRESS" })}
                  onComplete={(stepId) => updateStep.mutate({ stepId, status: "COMPLETED" })}
                  onOpenQty={setQtyStep}
                  onQuickPass={() => handleQuickPass(card)}
                  onOutsourceStatus={(id, status) => updateOutsource.mutate({ id, status })}
                  onOutsourceQcFail={handleOutsourceQcFail}
                  onReceiveBack={(os) => handleReceiveBack(card, os)}
                />
              ))}
            </div>
          )}
        </section>
      ) : focusPostCol ? (
        // ── ลงลึกหลังผลิต — ตรวจนับ QC / เลื่อนสถานะ / ไปจัดส่ง (ของเดิม) ──
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <PackageCheck className="h-4 w-4 text-slate-400" />
            {focusPostCol.title}
            <span className="rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {all.filter((o) => o.internalStatus === focusPostCol.status).length}
            </span>
          </h2>
          {all.filter((o) => o.internalStatus === focusPostCol.status).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
              — ว่าง —
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {all
                .filter((o) => o.internalStatus === focusPostCol.status)
                .map((o) => {
                  const canAdvance =
                    focusPostCol.next &&
                    canPermsSetStatus(
                      me?.permissions,
                      o.internalStatus as InternalStatus,
                      focusPostCol.next.to
                    );
                  const href = o.productionId
                    ? `/production/${o.productionId}`
                    : `/orders/${o.id}`;
                  return (
                    <div key={o.id} className="card-surface rounded-xl p-3">
                      <OrderCardHeader order={o} href={href} />
                      {/* ธง blind ship บนคอลัมน์แพ็ค/พร้อมส่ง (ตรวจไม่ใส่ ของยังไม่ถึงคนแพ็ค) */}
                      {(focusPostCol.key === "packing" || focusPostCol.key === "ready") &&
                        o.blindShip && (
                          <p className="mt-2 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white">
                            🚫 BLIND SHIP — ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง
                          </p>
                        )}
                      <div className="mt-2.5">
                        {focusPostCol.key === "qc" && canCountQc ? (
                          // ผ่านด่านตรวจทางเดียว: เปิดใบนับจริง (ดีครบ→เด้งแพ็ค · เสีย→ถอยกลับ B4)
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => setQcOrderId(o.id)}
                            className="h-9 w-full gap-1.5"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            ตรวจนับ QC
                          </Button>
                        ) : focusPostCol.next && canAdvance ? (
                          <Button
                            size="sm"
                            disabled={advance.isPending}
                            onClick={() =>
                              advance.mutate({
                                id: o.id,
                                internalStatus: focusPostCol.next!.to as never,
                              })
                            }
                            className="h-9 w-full gap-1.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {focusPostCol.next.label}
                          </Button>
                        ) : focusPostCol.key === "ready" ? (
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
                })}
            </div>
          )}
        </section>
      ) : null}

      {createOrderId && (
        <CreateProductionDialog
          orderId={createOrderId}
          onClose={() => setCreateOrderId(null)}
          onCreated={(p) => router.push(`/production/${p.id}`)}
        />
      )}

      {/* ใบนับ QC จากคอลัมน์ตรวจ — dialog เดียวกับหน้าออเดอร์ (นับดีครบ→เด้งแพ็คเอง) */}
      {qcOrderId && <QcCountDialog orderId={qcOrderId} onClose={() => setQcOrderId(null)} />}

      {/* รับกลับร้านนอกจากบอร์ดเลน: นับของก่อน (ใบตรวจรับ) → บันทึกแล้วค่อย flip สถานะรับกลับ
          — pattern เดียวกับหน้า /outsource · ถ้า flip พลาด ใบตรวจรับยังอยู่ กดซ้ำได้ */}
      {receiveTarget && (
        <GoodsReceiptDialog
          orderId={receiveTarget.orderId}
          receiptType="OUTSOURCE_RETURN"
          outsourceOrderId={receiveTarget.id}
          presetLines={[
            {
              description: receiveTarget.description,
              qtyExpected: receiveTarget.quantity,
            },
          ]}
          onCreated={() =>
            updateOutsource.mutate({ id: receiveTarget.id, status: "RECEIVED_BACK" })
          }
          onClose={() => setReceiveTarget(null)}
        />
      )}

      {/* UX8: บันทึกจำนวนจากการ์ดเลน (รีด/แพ็ค ฯลฯ) — sheet ตัวเดียวกับหน้าใบผลิต ยิง updateStep เดิม */}
      {qtyStep && (
        <StepQtySheet
          step={qtyStep}
          busy={busy}
          onSubmit={(payload) => {
            updateStep.mutate({ stepId: qtyStep.id, ...payload });
            setQtyStep(null);
          }}
          onClose={() => setQtyStep(null)}
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
  perms,
  meId,
  canQc,
  busy,
  onStart,
  onComplete,
  onOpenQty,
  onQuickPass,
  onOutsourceStatus,
  onOutsourceQcFail,
  onReceiveBack,
}: {
  card: LaneCard;
  perms: readonly string[] | undefined;
  meId: string | undefined;
  canQc: boolean;
  busy: boolean;
  onStart: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  onOpenQty: (step: KanbanStep) => void;
  onQuickPass: () => void;
  onOutsourceStatus: (outsourceId: string, status: "SENT" | "QC_PASSED") => void;
  onOutsourceQcFail: (outsourceId: string) => void;
  // รับของกลับ = เปิดใบตรวจนับก่อน (Gate B4) — ไม่ flip สถานะตรงจากการ์ดอีกแล้ว
  onReceiveBack: (outsource: KanbanStep["outsourceOrders"][number]) => void;
}) {
  const step = card.currentStep!;
  const stepName = step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
  const href = `/production/${card.productionId}`;
  const latestOutsource = step.outsourceOrders[0];
  const activeOutsource =
    latestOutsource && OUTSOURCE_ACTIVE_STATUSES.includes(latestOutsource.status)
      ? latestOutsource
      : null;
  // ขั้นอยู่ในรอบพิมพ์ค้าง (server กรองมาเฉพาะ PRINTING/PRINTED แล้ว) — updateStep ถูก
  // บล็อกฝั่ง server ปุ่มเริ่ม/เสร็จกดได้แต่ error → สลับเป็นลิงก์ไปหน้ารอบพิมพ์แทน
  const activePrintRun = step.printRunItems[0]?.printRun ?? null;
  // ช่างแตะได้เฉพาะงานของตัวเอง/งานที่ยังไม่มีเจ้าของ (ตรง server) — ปุ่มบนงานของ
  // คนอื่นกดแล้ว FORBIDDEN แน่นอน จึงไม่โชว์ แสดงชื่อเจ้าของแทน
  // ไม่ใช่หัวหน้า = แตะได้เฉพาะงานตัวเอง/งานยังไม่มีเจ้าของ (ตรง server updateStep)
  const ownedByOther =
    !permAllows(perms, "supervise_operations") && !!step.assignedTo && step.assignedTo.id !== meId;
  const canTouchStep = permAllows(perms, "manage_production") && !ownedByOther;

  const isOverdue =
    !!card.order.deadline && new Date(card.order.deadline) < new Date();
  // แถบสีสถานะ (ทิศ C) — ช่างกวาดตาเห็น: แดง=ปัญหา/สาย · เหลือง=รอของ · น้ำเงิน=ทำอยู่ · เทา=รอเริ่ม
  const railTone =
    step.status === "FAILED" || isOverdue
      ? "bg-red-500"
      : card.pressGate && !card.pressGate.ready
        ? "bg-amber-500"
        : step.status === "IN_PROGRESS"
          ? "bg-blue-500"
          : "bg-slate-300 dark:bg-slate-600";

  return (
    <div className="card-surface relative overflow-hidden rounded-xl p-3 pl-4">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", railTone)}
      />
      <OrderCardHeader order={card.order} href={href} />

      {/* ธง blind ship บนเลนแพ็ค — พลาดใส่เอกสาร Anajak ครั้งเดียวเสียลูกค้า reseller ทั้งราย */}
      {card.lane === "PACK" && card.order.blindShip && (
        <p className="mt-2 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white">
          🚫 BLIND SHIP — ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง
        </p>
      )}

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
          ) : activePrintRun ? (
            <Button variant="outline" size="sm" asChild className="h-9 w-full gap-1.5">
              <Link href="/production/print-runs">
                <Printer className="h-3.5 w-3.5" />
                อยู่ในรอบพิมพ์ {activePrintRun.runNumber} — เปิดดู
              </Link>
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
                onClick={() => onReceiveBack(activeOutsource)}
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
            // ยังเหลือให้ทำ → sheet บันทึกจำนวน · ครบแล้วแต่ค้าง IN_PROGRESS → ปิดตรง (กัน sheet ตัน remaining=0)
            step.qtyTotal != null && step.qtyTotal > 0 && (step.qtyDone ?? 0) < step.qtyTotal ? (
              // UX8: ขั้นนับจำนวน กำลังทำ → เปิด bottom sheet บันทึกบางส่วน/ครบ (2 แตะ ไม่เปลี่ยนหน้า)
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onOpenQty(step)}
                className="h-9 flex-1 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                บันทึกจำนวน ({step.qtyDone}/{step.qtyTotal})
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onComplete(step.id)}
                className="h-9 flex-1 gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                เสร็จขั้นนี้
              </Button>
            )
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
