"use client";

import { useRef, useState } from "react";
import { Factory, Plus } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DeskTable, DeskTiles, DeskToolbar, STATION_OUTSOURCE_ALL } from "@/components/production/production-desk-view";
import { bucketOf, STATION_QUEUE, type BoardOrderLike, type BoardRailPoint, type BoardStation } from "@/lib/production-board";
import { deskSummary, filterDeskRows, type DeskCurrent, type DeskLens, type DeskOutsource, type DeskRow, type DeskStepLike } from "@/lib/production-desk";
import { sortDeskRows, type DeskSort } from "@/lib/production-desk-sort";
import { worklistStationChips } from "@/lib/production-worklist";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { selectOrders } from "../_domain/engine";
import type { FlowOperation, FlowRole, FlowState, OperationView, OrderView } from "../_domain/types";

export interface FamiliarListProps {
  state: FlowState;
  role: FlowRole;
  onSelectOrder: (orderId: string) => void;
}

type FamiliarOrder = BoardOrderLike<DeskStepLike> & { flow: OrderView };
type FamiliarRow = DeskRow<DeskStepLike, FamiliarOrder>;

function stationOf(operation: OperationView, source: FlowOperation): Pick<BoardStation, "key" | "label" | "kind" | "isOutsource"> {
  if (source.outsourced) return { key: "external:backup", label: "ร้านสำรอง", kind: "lane", isOutsource: true };
  if (operation.kind === "vendor") {
    const lane = operation.name.includes("ปัก") ? "EMBROIDERY" : operation.name.includes("ป้าย") ? "LABEL" : operation.name.includes("ตัดเย็บ") ? "CUTSEW" : operation.name.includes("สกรีน") ? "SILKSCREEN" : "OTHER";
    return { key: `lane:${lane}`, label: operation.name, kind: "lane", isOutsource: true };
  }
  if (operation.kind === "qc") return { key: "post:qc", label: "ตรวจ QC", kind: "post", isOutsource: false };
  if (operation.kind === "pack") return { key: "post:pack", label: "กำลังแพ็ค", kind: "post", isOutsource: false };
  const lane = operation.kind === "prepare" ? "PREP" : ["film", "press"].includes(operation.kind) ? "DTF" : "OTHER";
  return { key: `lane:${lane}`, label: operation.kind === "prepare" ? "เตรียมเสื้อ" : lane === "DTF" ? "DTF" : operation.name, kind: "lane", isOutsource: false };
}

function activeOperations(order: OrderView): OperationView[] {
  return order.operations.filter((operation) => operation.lots.some((lot) => lot.condition !== "waste" && lot.condition !== "packed")
    || (operation.kind === "film" && operation.state !== "done")
    || operation.actions.some((action) => action.kind === "acquire"));
}

/** The existing table accepts a pure row model; all operational facts come from the new ledger. */
export function familiarDeskRows(state: FlowState, role: FlowRole): { rows: FamiliarRow[]; stations: BoardStation[]; unknown: OrderView[] } {
  const views = selectOrders(state, role);
  const stationMap = new Map<string, BoardStation>();
  const now = new Date(state.clock);
  const rows = views.filter((view) => !view.unknown).map((view): FamiliarRow => {
    const sourceOrder = state.orders.find((order) => order.id === view.id)!;
    const sourceOperations = new Map(state.operations.filter((operation) => operation.orderId === view.id).map((operation) => [operation.id, operation]));
    const current = activeOperations(view);
    const stationKeys: string[] = [];
    const dueInDays = differenceInBangkokDays(view.dueAt, now);
    const overdue = dueInDays !== null && dueInDays < 0;
    function includeStation(station: Pick<BoardStation, "key" | "label" | "kind" | "isOutsource">) {
      if (stationKeys.includes(station.key)) return;
      stationKeys.push(station.key);
      const previous = stationMap.get(station.key);
      stationMap.set(station.key, { ...station, count: (previous?.count ?? 0) + 1, overdue: (previous?.overdue ?? 0) + Number(overdue) });
    }
    if (sourceOrder.released === false) includeStation({ key: STATION_QUEUE, label: "รอเปิดใบผลิต", kind: "queue", isOutsource: false });
    else if (view.status === "packed") includeStation({ key: "post:ship", label: "พร้อมส่ง", kind: "post", isOutsource: false });
    else current.forEach((operation) => includeStation(stationOf(operation, sourceOperations.get(operation.id)!)));

    const next = view.actions.find((action) => action.enabled && action.label === view.nextAction) ?? view.actions.find((action) => action.enabled && action.primary);
    const currentState: DeskCurrent["state"] = sourceOrder.released === false ? "queue"
      : view.status === "problem" ? "failed"
        : view.status === "packed" ? "post"
          : view.status === "waiting" ? "waiting" : "active";
    const currentCells: DeskCurrent[] = [{ label: view.nextAction, reason: view.summary, state: currentState }];
    current.filter((operation) => operation.id !== next?.operationId || (next?.kind === "transfer" && operation.qtyReady > 0)).forEach((operation) => {
      const summary = operation.qtyAtVendor ? `${operation.name}อยู่ร้าน ${operation.qtyAtVendor} ตัว`
        : operation.qtyAwaitingInspection ? `${operation.name}รอตรวจรับ ${operation.qtyAwaitingInspection} ตัว`
          : operation.qtyReady ? `${operation.name}พร้อมทำ ${operation.qtyReady} ตัว`
            : operation.qtyRework ? `${operation.name}รอแก้ ${operation.qtyRework} ตัว` : null;
      if (summary) currentCells.push({ label: summary, reason: null, state: operation.qtyAtVendor ? "external" : operation.qtyRework ? "failed" : "active" });
    });

    const vendorOperations = current.filter((operation) => operation.kind === "vendor" || sourceOperations.get(operation.id)?.outsourced);
    const rawLots = state.lots.filter((lot) => lot.orderId === view.id);
    const vendors = [...new Set([
      ...rawLots.filter((lot) => lot.custody.kind === "vendor").map((lot) => lot.custody.name),
      ...vendorOperations.map((operation) => sourceOperations.get(operation.id)?.vendor).filter((name): name is string => Boolean(name)),
    ])];
    const vendorRework = vendorOperations.reduce((total, operation) => total + operation.qtyRework, 0);
    const outsource: DeskOutsource | null = vendors.length ? {
      vendor: vendors.join(" / "),
      work: [
        view.metrics.atVendor ? `อยู่ร้าน ${view.metrics.atVendor} ตัว` : null,
        view.metrics.awaitingInspection ? `กลับรอตรวจ ${view.metrics.awaitingInspection} ตัว` : null,
        vendorRework ? `รอแก้ ${vendorRework} ตัว` : null,
      ].filter(Boolean).join(" / ") || "เตรียมส่งงานให้ร้าน",
      status: view.metrics.atVendor ? "SENT" : view.metrics.awaitingInspection ? "RECEIVED_BACK" : "PENDING",
      statusLabel: view.metrics.awaitingInspection ? "มีของกลับรอตรวจ" : view.metrics.atVendor ? "ยังไม่ระบุวันนัดรับ" : vendorRework ? "รอจัดการงานแก้" : "รอส่งร้าน",
      expectedBackAt: null,
      backInDays: null,
    } : null;
    const responsible = sourceOrder.released === false || view.status === "packed" ? [view.owner]
      : [...new Set([
        ...(next?.supervisorOnly ? [view.owner] : []),
        ...current.map((operation) => operation.assignedTo?.name).filter((name): name is string => Boolean(name)),
      ])];
    const rail: BoardRailPoint[] = view.operations.map((operation) => ({
      key: operation.id,
      label: operation.name,
      statusLabel: sourceOrder.released === false ? "ยังไม่เปิดใบผลิต" : operation.statusLabel,
      state: operation.state === "done" ? "done" : operation.state === "problem" ? "failed"
        : operation.state === "waiting" ? "wait" : operation.state === "vendor" ? "stuck" : "now",
    }));
    const blocked = sourceOrder.released !== false && (view.status === "problem" || view.missingQty > 0);
    const order: FamiliarOrder = {
      id: view.id,
      orderNumber: view.number,
      customerName: view.customer,
      deadline: view.dueAt,
      internalStatus: view.status === "packed" ? "READY_TO_SHIP" : sourceOrder.released === false ? "PRODUCTION_QUEUE" : "PRODUCING",
      totalQuantity: view.totalQty,
      productions: [],
      designs: [{ fileUrl: "/proto-production-flow/uniform.png", thumbnailUrl: "/proto-production-flow/uniform.png" }],
      flow: view,
    };
    return {
      job: { key: view.id, order, bucket: bucketOf(view.dueAt, now), overdue, dueSoon: dueInDays !== null && dueInDays >= 0 && dueInDays <= 2, stationKeys, spots: [], rail, searchText: `${view.number} ${view.customer}`.toLowerCase() },
      current: currentCells,
      outsource,
      responsible,
      dueInDays,
      blocked,
      // A customer deadline cannot be substituted for a subcontractor's promised return date.
      outsourceDue: false,
      pile: blocked ? "blocked" : sourceOrder.released === false ? "queue" : view.status === "packed" ? "ready" : view.status === "waiting" ? "waiting" : "doing",
    };
  });
  return { rows, stations: [...stationMap.values()], unknown: views.filter((view) => view.unknown) };
}

export function FamiliarList({ state, role, onSelectOrder }: FamiliarListProps) {
  const [lens, setLens] = useState<DeskLens>("all");
  const [search, setSearch] = useState("");
  const [station, setStation] = useState("");
  const [sort, setSort] = useState<DeskSort>({ key: "deadline", direction: "asc" });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { rows, stations, unknown } = familiarDeskRows(state, role);
  const lensRows = filterDeskRows(rows, lens).filter((row) => row.job.searchText.includes(search.toLowerCase().trim()));
  const chips = worklistStationChips(stations, lensRows.map((row) => row.job));
  const outsourceKeys = new Set(stations.filter((item) => item.isOutsource).map((item) => item.key));
  const outsourceRows = lensRows.filter((row) => row.job.stationKeys.some((key) => outsourceKeys.has(key)));
  const visible = station === STATION_OUTSOURCE_ALL ? outsourceRows : lensRows.filter((row) => !station || row.job.stationKeys.includes(station));
  const unconfirmed = lens === "all" && !station ? unknown.filter((order) => `${order.number} ${order.customer}`.toLowerCase().includes(search.toLowerCase().trim())) : [];
  const queued = rows.filter((row) => row.pile === "queue").length;

  return (
    <PageShell title="การผลิต" icon={Factory} tone="production" description={`งานในโรงงาน ${state.orders.length} ออเดอร์ · รอเปิดใบผลิต ${queued} ใบ`} action={role === "supervisor" && queued > 0 ? <Button onClick={() => { setLens("all"); setStation(STATION_QUEUE); setSearch(""); if (searchInputRef.current) searchInputRef.current.value = ""; }}><Plus /> เปิดใบผลิต ({queued})</Button> : undefined}>
      <div className="space-y-3 sm:space-y-5">
        <DeskTiles summary={deskSummary(rows)} lens={lens} onSelectLens={setLens} />
        <DeskToolbar searchDefault={search} searchInputRef={searchInputRef} onSearchChange={setSearch} station={station} stations={chips} outsourceTotal={outsourceRows.length} outsourceOverdue={outsourceRows.filter((row) => row.job.overdue).length} onSelectStation={setStation} total={lensRows.length + unconfirmed.length} />
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-secondary" aria-live="polite"><span className="font-semibold tabular-nums text-strong">{visible.length + unconfirmed.length}</span> ออเดอร์</p>
          <div className="ml-auto w-40 sm:hidden"><Select aria-label="เรียงรายการผลิต" value={`${sort.key}:${sort.direction}`} onChange={(event) => { const [key, direction] = event.target.value.split(":"); setSort({ key: key as DeskSort["key"], direction: direction as DeskSort["direction"] }); }}><option value="deadline:asc">กำหนดส่งใกล้สุด</option><option value="deadline:desc">กำหนดส่งไกลสุด</option><option value="order:asc">เลขออเดอร์</option><option value="quantity:desc">จำนวนมากสุด</option><option value="quantity:asc">จำนวนน้อยสุด</option></Select></div>
        </div>
        <div onClickCapture={(event) => {
          const target = event.target as HTMLElement;
          const link = target.closest("tbody tr")?.querySelector<HTMLAnchorElement>('a[href*="order="]');
          if (!link || window.getSelection()?.toString()) return;
          event.preventDefault();
          event.stopPropagation();
          const id = new URL(link.href, window.location.href).searchParams.get("order");
          if (id) onSelectOrder(id);
        }}>
          <DeskTable rows={sortDeskRows(visible, sort)} sort={sort} onSort={(key, direction) => setSort({ key, direction })} hrefFor={(row) => `/proto/production-flow?order=${encodeURIComponent(row.job.order.id)}`} emptyLabel={unconfirmed.length ? "ดูใบที่ยังยืนยันข้อมูลไม่ได้ด้านล่าง" : "ไม่พบงานที่ตรงกับตัวกรอง"} />
        </div>
        {unconfirmed.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-surface-muted p-4"><div className="space-y-1"><p className="text-sm font-semibold text-strong">{order.number} — ข้อมูลยังไม่ยืนยัน</p><p className="text-sm text-secondary">{order.customer}</p></div><Button variant="outline" size="sm" onClick={() => onSelectOrder(order.id)}>ตรวจข้อมูลใบเดิม</Button></div>)}
      </div>
    </PageShell>
  );
}
