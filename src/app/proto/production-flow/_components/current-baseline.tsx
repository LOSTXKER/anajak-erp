"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { ArrowLeft, Factory } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { DeskTable, DeskTiles, DeskToolbar, STATION_OUTSOURCE_ALL } from "@/components/production/production-desk-view";
import { WorkOrderView } from "@/components/production/work-order-page";
import type { WorkOrderController } from "@/components/production/work-order-controller";
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { buildProductionBoard, filterBoardJobs, type BoardOrderLike } from "@/lib/production-board";
import { buildDeskRows, deskSummary, filterDeskRows, type DeskLens } from "@/lib/production-desk";
import { sortDeskRows, type DeskSort } from "@/lib/production-desk-sort";
import { filterWorklistByStation, worklistStationChips } from "@/lib/production-worklist";
import { DEFAULT_ACTORS, type FlowOperation, type FlowOrder, type FlowRole, type FlowState, type OperationView, type OrderView } from "../_domain/types";
import { selectOrder, selectOrders } from "../_domain/engine";
import { useProtoController } from "../../work-order-states/_controller";
import { makeOrder, makeStep, type StateFixture } from "../../work-order-states/_fixtures";

export interface CurrentBaselineProps {
  state: FlowState;
  role: FlowRole;
  selectedOrderId?: string;
  onSelectOrder: (orderId: string) => void;
  onBack: () => void;
}

/** Adapt only the shared scenario's facts; the old view still uses its own rail and readiness rules. */
function legacyStep(operation: FlowOperation, view: OperationView, order: FlowOrder, index: number, now: Date): ProductionStep {
  const vendorType: ProductionStep["stepType"] = operation.name.includes("ปัก") ? "EMBROIDERY"
    : operation.name.includes("ตัดเย็บ") ? "SEWING"
      : operation.name.includes("ป้าย") ? "TAGGING"
        : operation.name.includes("สกรีน") ? "SCREEN_PRINTING" : "CUSTOM";
  const kind: Record<FlowOperation["kind"], ProductionStep["stepType"]> = {
    prepare: order.scopes.every((scope) => scope.source === "stock") ? "GARMENT_PICK" : "GARMENT_RECEIVE",
    film: "DTF_PRINT",
    press: "HEAT_PRESS",
    vendor: vendorType,
    qc: "CUSTOM",
    pack: "PACKAGING",
    manual: "CUSTOM",
  };
  const status: ProductionStep["status"] = view.state === "done" ? "COMPLETED"
    : view.state === "problem" ? "FAILED"
      : ["working", "vendor", "inspection"].includes(view.state) ? "IN_PROGRESS" : "PENDING";
  const vendorLots = view.lots.filter((lot) => lot.condition === "vendor" || lot.condition === "inspection");
  const atVendor = view.qtyAtVendor > 0;
  return makeStep({
    key: operation.id,
    id: operation.id,
    productionId: operation.workOrderId,
    stepType: kind[operation.kind],
    customStepName: operation.name,
    sortOrder: (index + 1) * 10,
    status,
    assignedTo: operation.assignedTo,
    qtyTotal: view.qtyPlanned,
    qtyDone: view.qtyGood,
    notes: operation.issue ?? null,
    quantities: view.lines.map((line) => ({
      id: `${operation.id}-${line.scopeKey}`,
      sourceOrderItemVariantId: order.scopes.find((scope) => scope.key === line.scopeKey)?.variantId ?? line.scopeKey,
      qtyPlanned: line.planned,
      qtyGood: line.good,
      qtyScrap: line.waste,
    })) as ProductionStep["quantities"],
    outsourceOrders: vendorLots.length ? [{
      id: `baseline-vendor-${operation.id}`,
      status: atVendor ? "SENT" : "RECEIVED_BACK",
      description: operation.name,
      quantity: view.qtyAtVendor + view.qtyAwaitingInspection,
      sentAt: null,
      expectedBackAt: null,
      receivedAt: null,
      qcPassed: null,
      qcNotes: null,
      notes: null,
      createdAt: now,
      vendor: { id: `vendor-${operation.id}`, name: operation.vendor ?? vendorLots[0]!.location },
    }] as ProductionStep["outsourceOrders"] : [],
  });
}

function legacyFixture(state: FlowState, order: FlowOrder, view: OrderView): StateFixture {
  const now = new Date(state.clock);
  const operations = state.operations.filter((operation) => operation.orderId === order.id).sort((a, b) => a.sequence - b.sequence);
  const steps = operations.flatMap((operation, index) => {
    const operationView = view.operations.find((item) => item.id === operation.id);
    return operationView ? [legacyStep(operation, operationView, order, index, now)] : [];
  });
  const legacyOrder = {
    ...makeOrder({}),
    id: order.id,
    orderNumber: order.number,
    deadline: new Date(order.dueAt),
    customer: { id: `customer-${order.id}`, name: order.customer },
    notes: null,
    designs: [],
    items: order.scopes.map((scope) => ({
      id: scope.key,
      totalQuantity: scope.orderedQty,
      prints: scope.prints.map((print) => ({
        id: print.id,
        position: print.label,
        printType: print.technique === "SCREEN" ? "SILKSCREEN" : print.technique,
        printSize: null,
        width: null,
        height: null,
        colorCount: null,
        designNote: `แบบ ${print.artworkVersion}`,
        designImageUrl: null,
        artwork: null,
      })),
      products: [{
        id: scope.key,
        productType: "T_SHIRT",
        description: scope.product,
        itemSource: scope.source === "customer" ? "CUSTOMER_PROVIDED" : "OUR_STOCK",
        fabricColor: scope.color,
        totalQuantity: scope.orderedQty,
        variants: [{ id: scope.variantId, size: scope.size, color: scope.color, quantity: scope.orderedQty }],
      }],
    })),
  } as ProductionDetail["order"];
  return { key: `${order.id}:${state.revision}`, title: order.number, group: "แบบปัจจุบัน", order: legacyOrder, steps };
}

function BaselineDetail({ state, role, view, onBack }: { state: FlowState; role: FlowRole; view: OrderView; onBack: () => void }) {
  const order = state.orders.find((item) => item.id === view.id)!;
  const fixture = useMemo(() => legacyFixture(state, order, view), [state, order, view]);
  const original = useProtoController(fixture, role === "supervisor" ? "boss" : "staff");
  const controller: WorkOrderController = {
    ...original,
    me: { ...DEFAULT_ACTORS[role], permissions: [], email: "", role: role === "supervisor" ? "OWNER" : "PRODUCTION_STAFF", avatarUrl: null },
    totalQty: view.totalQty,
    nowMs: new Date(state.clock).getTime(),
    canUpdateStep: false,
    canSuperviseStep: false,
    hasProductionPermission: false,
    canSeeCost: false,
    canOwnOrSupervise: () => false,
    primaryButton: (step, now, options) => <fieldset disabled className="contents">{original.primaryButton(step, now, options)}</fieldset>,
  };
  const limitations = [
    view.lots.some((lot) => lot.parentLotId) ? "ล็อตที่แยกส่งต่อ" : null,
    view.reworkQty > 0 ? "จำนวนรอแก้และตรวจซ้ำ" : null,
    view.workOrders.length > 1 ? "หลายใบผลิตในออเดอร์เดียว" : null,
    view.operations.some((operation, index) => index > 0 && operation.predecessorIds.length !== 1) ? "เส้นทางที่ทำคู่ขนานและรอบรรจบ" : null,
  ].filter(Boolean);
  function guardNavigation(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor) {
      event.preventDefault();
      event.stopPropagation();
      if (anchor.getAttribute("href") === "/production") onBack();
    }
    // Keep tab navigation available; baseline action buttons never execute even a mock mutation.
    if (target.closest("button") && !target.closest('[role="tab"]')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-6">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft /> กลับรายการ</Button>
        <p className="text-sm text-secondary">แบบปัจจุบันสำหรับดูเปรียบเทียบ ใช้ข้อมูลสถานการณ์เดียวกับแบบ A/B</p>
      </div>
      {limitations.length ? <p className="mx-4 rounded-lg border border-divider bg-surface-muted px-4 py-3 text-sm text-secondary sm:mx-6">จอนี้ยังแสดง {limitations.join(" / ")} แยกกันไม่ได้ จึงใช้เทียบการจัดวางเท่านั้น</p> : null}
      <div onClickCapture={guardNavigation}>
        <WorkOrderView c={controller} itemsTab={
          <div className="card-surface overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-sm">
              <caption className="px-4 py-3 text-left font-semibold text-strong">รายการในออเดอร์ {order.number}</caption>
              <thead className={TABLE_HEAD_SURFACE}><tr><th className="px-4 py-3">สินค้า</th><th className="px-4 py-3">สี / ไซซ์</th><th className="px-4 py-3">งานตกแต่ง</th><th className="px-4 py-3 text-right">จำนวน</th></tr></thead>
              <tbody className="divide-y divide-divider">{order.scopes.map((scope) => <tr key={scope.key}><td className="px-4 py-3">{scope.product}</td><td className="px-4 py-3">{scope.color} / {scope.size}</td><td className="px-4 py-3">{scope.prints.map((print) => print.label).join(", ") || "—"}</td><td className="px-4 py-3 text-right tabular-nums">{scope.orderedQty}</td></tr>)}</tbody>
            </table>
          </div>
        } />
      </div>
    </div>
  );
}

function BaselineList({ state, role, onSelectOrder }: CurrentBaselineProps) {
  const [lens, setLens] = useState<DeskLens>("all");
  const [search, setSearch] = useState("");
  const [station, setStation] = useState("");
  const [sort, setSort] = useState<DeskSort>({ key: "deadline", direction: "asc" });
  const views: OrderView[] = selectOrders(state, role);
  // The current desk cannot represent an unknown ledger; keep those records visible separately.
  const unknownOrders = views.filter((view) => view.unknown);
  const orders: BoardOrderLike<ProductionStep>[] = views.filter((view) => !view.unknown).map((view) => {
    const order = state.orders.find((item) => item.id === view.id)!;
    const fixture = legacyFixture(state, order, view);
    return {
      id: order.id,
      orderNumber: order.number,
      customerName: order.customer,
      deadline: order.dueAt,
      internalStatus: view.status === "packed" ? "READY_TO_SHIP" : "PRODUCING",
      totalQuantity: view.totalQty,
      productions: order.released === false ? [] : [{ id: order.workOrders[0]?.id ?? order.id, steps: fixture.steps }],
    };
  });
  const now = new Date(state.clock);
  const board = buildProductionBoard(orders, { now, viewerId: DEFAULT_ACTORS[role].id, showBlocked: true });
  const rows = buildDeskRows(board, now);
  const searched = new Set(filterBoardJobs(board.jobs, board.stations, "", search).map((job) => job.key));
  const lensRows = filterDeskRows(rows, lens).filter((row) => searched.has(row.job.key));
  const stations = worklistStationChips(board.stations, lensRows.map((row) => row.job));
  const outsourceKeys = new Set(stations.filter((chip) => chip.isOutsource).map((chip) => chip.key));
  const outsourceRows = lensRows.filter((row) => row.job.stationKeys.some((key) => outsourceKeys.has(key)));
  const stationKeys = new Set(filterWorklistByStation(lensRows.map((row) => row.job), station).map((job) => job.key));
  const visibleRows = station === STATION_OUTSOURCE_ALL ? outsourceRows : lensRows.filter((row) => stationKeys.has(row.job.key));

  return (
    <PageShell title="การผลิต" icon={Factory} tone="production" description={`แบบปัจจุบัน · ${views.length} ออเดอร์จากสถานการณ์เดียวกับแบบ A/B`}>
      <div className="space-y-5">
        <DeskTiles summary={deskSummary(rows)} lens={lens} onSelectLens={setLens} />
        <DeskToolbar searchDefault={search} searchInputRef={null} onSearchChange={setSearch} station={station} stations={stations} outsourceTotal={outsourceRows.length} outsourceOverdue={outsourceRows.filter((row) => row.dueInDays !== null && row.dueInDays < 0).length} onSelectStation={setStation} total={lensRows.length} />
        <div onClickCapture={(event) => {
          const target = event.target as HTMLElement;
          const row = target.closest("tbody tr");
          const link = row?.querySelector<HTMLAnchorElement>('a[href*="baseline-order="]');
          if (!link || window.getSelection()?.toString()) return;
          event.preventDefault();
          event.stopPropagation();
          const id = new URL(link.href, window.location.href).searchParams.get("baseline-order");
          if (id) onSelectOrder(id);
        }}>
          <DeskTable rows={sortDeskRows(visibleRows, sort)} sort={sort} onSort={(key, direction) => setSort({ key, direction })} hrefFor={(row) => `/proto/production-flow?baseline-order=${encodeURIComponent(row.job.order.id)}`} emptyLabel="ไม่พบงานที่ตรงกับตัวกรอง" />
        </div>
        {lens === "all" && station === "" && unknownOrders.filter((order) => `${order.number} ${order.customer}`.toLowerCase().includes(search.toLowerCase())).map((order) => (
          <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-surface-muted p-4">
            <div className="space-y-1"><p className="text-sm font-semibold text-strong">{order.number} — ข้อมูลยังไม่ยืนยัน</p><p className="text-sm text-secondary">{order.customer} · แบบปัจจุบันยังแสดงยอดและขั้นจริงของใบนี้ไม่ได้</p></div>
            <Button variant="outline" size="sm" onClick={() => onSelectOrder(order.id)}>ดูข้อมูลใบเดิม</Button>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function CurrentBaseline(props: CurrentBaselineProps) {
  const view = props.selectedOrderId ? selectOrder(props.state, props.selectedOrderId, props.role) : undefined;
  const order = props.state.orders.find((item) => item.id === view?.id);
  if (view && (view.unknown || order?.released === false)) {
    return (
      <section className="space-y-4 rounded-xl border border-divider bg-surface p-5">
        <Button variant="outline" size="sm" onClick={props.onBack}><ArrowLeft /> กลับรายการ</Button>
        <div className="space-y-2"><h1 className="text-xl font-semibold text-strong">{view.number}</h1><p className="text-sm text-secondary">{view.customer}</p></div>
        <p className="text-base font-medium text-strong">{view.unknown ? "ข้อมูลใบเดิมยังไม่ยืนยัน" : "รอหัวหน้าเปิดใบผลิต"}</p>
        <p className="max-w-2xl text-sm leading-relaxed text-secondary">{view.unknown ? "ยังไม่มีหลักฐานยืนยันจำนวนที่รับมา งานที่ทำแล้ว และสถานที่ของเสื้อ จึงยังแสดงหน้ารายละเอียดแบบปัจจุบันโดยไม่แต่งข้อมูลไม่ได้" : "ออเดอร์นี้มีแผนที่รอตรวจ แต่ยังไม่ได้เปิดใบผลิตให้ทีมลงมือ หน้ารายละเอียดแบบปัจจุบันจึงยังไม่มีใบให้แสดง"}</p>
        <p className="text-xs text-muted">แบบปัจจุบันสำหรับดูเปรียบเทียบ สลับ A หรือ B เพื่อดูแผนและขั้นตอนที่เสนอ</p>
      </section>
    );
  }
  return view ? <BaselineDetail key={view.id} state={props.state} role={props.role} view={view} onBack={props.onBack} /> : <BaselineList {...props} />;
}
