"use client";

import Image from "next/image";
import { ArrowDownUp, ArrowRight, CheckCircle2, CircleAlert, Package, Search, Truck, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { FilterChip } from "@/components/ui/filter-chip";
import { InfoChip } from "@/components/ui/info-chip";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Fact } from "@/components/ui/fact";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { OrderView } from "../_domain/types";

export type FlowFilter = "all" | "attention" | "vendor" | "unassigned" | "packed";
export type FlowSort = "due" | "quantity" | "number";
export function needsAttention(order: OrderView) {
  return order.unknown || (order.status !== "packed" && (order.blockers.length > 0 || order.reworkQty > 0 || order.missingQty > 0 || order.operations.some(op => op.qtyReady > 0 && !op.assignedTo)));
}
export function filterOrders(orders: OrderView[], filter: FlowFilter, query: string, sort: FlowSort) {
  const q = query.trim().toLocaleLowerCase();
  return orders.filter(order => {
    if (q && ![order.number, order.customer, ...order.operations.map(op => op.name), ...order.lots.map(lot => lot.location)].join(" ").toLocaleLowerCase().includes(q)) return false;
    if (filter === "attention") return needsAttention(order);
    if (filter === "vendor") return order.metrics.atVendor > 0 || order.metrics.awaitingInspection > 0;
    if (filter === "unassigned") return order.operations.some(op => !op.assignedTo && op.state !== "done");
    if (filter === "packed") return order.status === "packed";
    return true;
  }).sort((a, b) => {
    if (sort === "quantity") return b.totalQty - a.totalQty || a.number.localeCompare(b.number);
    if (sort === "number") return a.number.localeCompare(b.number);
    if ((a.status === "packed") !== (b.status === "packed")) return a.status === "packed" ? 1 : -1;
    return a.dueAt.localeCompare(b.dueAt) || a.number.localeCompare(b.number);
  });
}

const FILTERS: { key: FlowFilter; label: string; icon: typeof Package }[] = [
  { key: "all", label: "ทุกออเดอร์", icon: Package },
  { key: "attention", label: "ต้องจัดการ", icon: CircleAlert },
  { key: "vendor", label: "งานร้านนอก", icon: Truck },
  { key: "unassigned", label: "ยังไม่มีคนรับ", icon: UserRound },
  { key: "packed", label: "พร้อมส่ง", icon: CheckCircle2 },
];

export function FlowFilters({ orders, filter, query, sort, onFilter, onQuery, onSort, compact = false }: {
  orders: OrderView[]; filter: FlowFilter; query: string; sort: FlowSort;
  compact?: boolean;
  onFilter: (value: FlowFilter) => void; onQuery: (value: string) => void; onSort: (value: FlowSort) => void;
}) {
  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-divider [&>button]:shrink-0">
      {FILTERS.map(({ key, label, icon: Icon }) => <FilterChip key={key} selected={filter === key} onClick={() => onFilter(key)} icon={<Icon className="size-4" />} className="text-sm">
        {label}<span className="ml-1 tabular-nums text-secondary">{filterOrders(orders, key, "", "due").length}</span>
      </FilterChip>)}
    </div>
    <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row sm:items-center sm:justify-between")}>
      <div className={cn("flex min-w-0 items-center gap-2", !compact && "sm:w-96")}><SearchInput surface="raised" value={query} onChange={e => onQuery(e.target.value)} placeholder="ค้นหาเลขงาน ลูกค้า ร้าน หรือขั้นผลิต" containerClassName="min-w-0 flex-1" aria-label="ค้นหางานผลิต" />{query && <Button size="icon" variant="ghost" onClick={() => onQuery("")} aria-label="ล้างคำค้น"><X /></Button>}</div>
      <div className="flex items-center gap-2">
        <ArrowDownUp className="size-4 text-muted" aria-hidden="true" />
        <Select aria-label="เรียงงานผลิต" value={sort} onChange={e => onSort(e.target.value as FlowSort)} className="min-w-44">
          <option value="due">กำหนดส่งใกล้ก่อน</option><option value="quantity">จำนวนมากก่อน</option><option value="number">เลขออเดอร์</option>
        </Select>
      </div>
    </div>
  </div>;
}

function Due({ order, clock }: { order: OrderView; clock: string }) {
  return <DueTag dueInDays={differenceInBangkokDays(order.dueAt, new Date(clock))} dateLabel={new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(order.dueAt))} />;
}
function ActionSummary({ order }: { order: OrderView }) {
  const Icon = order.status === "packed" ? CheckCircle2 : needsAttention(order) ? CircleAlert : ArrowRight;
  return <div className="flex items-start gap-2">
    <Icon className={cn("mt-0.5 size-4 shrink-0", order.status === "packed" ? "text-green-700 dark:text-green-400" : "text-secondary")} aria-hidden="true" />
    <div className="min-w-0"><p className="text-sm font-medium text-strong">{order.nextAction}</p><p className="mt-1 text-xs leading-relaxed text-secondary">{order.summary}</p></div>
  </div>;
}
function Owner({ order }: { order: OrderView }) {
  if (order.unknown) return <Fact label="ผู้ดูแลงาน" value={order.owner || "ยังไม่ทราบ"} icon={UserRound} />;
  const vendors = vendorCustody(order);
  if (vendors.length > 0) {
    const lot = order.lots.find(item => item.condition === "vendor");
    const operation = order.operations.find(item => item.id === lot?.operationId);
    return <Fact label="อยู่ร้านนอก" icon={Truck} value={<>{vendors.map(vendor => <span key={vendor.name} className="block">{vendor.name} <span className="tabular-nums">{vendor.qty} ตัว</span></span>)}</>} sub={`ผู้ดูแล: ${operation?.assignedTo?.name ?? order.owner ?? "ยังไม่มอบหมาย"}`} />;
  }
  const op = order.operations.find(op => op.qtyReady > 0 && op.state !== "done") ?? order.operations.find(op => op.state !== "done");
  return <Fact label={op?.name ?? "ผู้ดูแลงาน"} value={op?.assignedTo?.name ?? (op ? "ยังไม่มอบหมาย" : order.owner)} icon={UserRound} />;
}

function vendorCustody(order: OrderView) {
  const byVendor = new Map<string, number>();
  for (const lot of order.lots) if (lot.condition === "vendor") byVendor.set(lot.location, (byVendor.get(lot.location) ?? 0) + lot.qty);
  return [...byVendor].map(([name, qty]) => ({ name, qty }));
}

export function FlowList({ orders, clock, selectedId, onOpen, compact = false, onClear }: {
  orders: OrderView[]; clock: string; selectedId?: string; onOpen: (id: string) => void; compact?: boolean; onClear: () => void;
}) {
  if (!orders.length) return <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-divider py-16 text-center">
    <Search className="size-7 text-muted" aria-hidden="true" /><h2 className="font-semibold text-strong">ไม่พบงานที่ตรงกับตัวกรอง</h2><p className="text-sm text-secondary">ลองค้นหาเลขงานหรือล้างตัวกรองเพื่อดูทุกออเดอร์</p><Button variant="outline" onClick={onClear}>ล้างตัวกรอง</Button>
  </div>;
  if (compact) return <nav aria-label="เลือกออเดอร์ติดตาม" className="divide-y divide-divider overflow-hidden rounded-xl border border-divider bg-surface">
    {orders.map(order => <button key={order.id} type="button" onClick={() => onOpen(order.id)} aria-current={order.id === selectedId ? "page" : undefined} className={cn("block w-full space-y-3 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500", order.id === selectedId ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-surface-muted")}>
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-strong">{order.number}</span><ArrowRight className="size-4 text-muted" aria-hidden="true" /></div>
      <p className="text-sm text-secondary">{order.customer}</p><Due order={order} clock={clock} /><ActionSummary order={order} />
      {vendorCustody(order).map(vendor => <span key={vendor.name} className="flex items-start gap-2 text-xs text-secondary"><Truck className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" /><span>{vendor.name} <span className="font-medium tabular-nums">{vendor.qty} ตัว</span></span></span>)}
    </button>)}
  </nav>;
  return <>
    <div className="hidden overflow-hidden rounded-xl border border-divider bg-surface lg:block">
      <table className="w-full text-left text-sm" aria-label="ทุกออเดอร์การผลิต">
        <thead className={cn(TABLE_HEAD_SURFACE, "border-b border-divider text-xs text-secondary")}><tr><th className="px-5 py-3 font-medium">ออเดอร์ / ลูกค้า</th><th className="px-4 py-3 font-medium">กำหนดส่ง</th><th className="w-[30%] px-4 py-3 font-medium">ต้องจัดการอะไร</th><th className="px-4 py-3 font-medium">จำนวน / ของข้างนอก</th><th className="px-4 py-3 font-medium">รับผิดชอบ</th><th className="w-12"><span className="sr-only">เปิดใบผลิต</span></th></tr></thead>
        <tbody className="divide-y divide-divider">{orders.map(order => <tr key={order.id} className="group align-top hover:bg-surface-muted/60">
          <td className="min-w-56 px-5 py-5"><button type="button" onClick={() => onOpen(order.id)} className="flex min-h-11 items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-blue-500"><Image src="/proto-production-flow/uniform.png" alt="แบบเสื้อตัวอย่าง" width={52} height={52} className="size-13 rounded-lg border border-divider object-contain bg-white" /><span><span className="block whitespace-nowrap font-semibold text-strong group-hover:text-blue-700 dark:group-hover:text-blue-300">{order.number}</span><span className="mt-1 block max-w-52 text-sm text-secondary">{order.customer}</span><span className="mt-2 block text-xs text-muted">{order.unknown ? "รอตรวจใบผลิตเดิม" : `${order.workOrders.length} ใบผลิต`}</span></span></button></td>
          <td className="px-4 py-5"><Due order={order} clock={clock} /></td><td className="px-4 py-5"><ActionSummary order={order} /></td>
          <td className="px-4 py-5">{order.unknown ? <><p className="font-medium text-strong">ยังไม่ยืนยันจำนวน</p><p className="mt-1 text-xs text-secondary">ตรวจหลักฐานก่อนนับยอด</p></> : <><p className="font-semibold tabular-nums text-strong">{order.packedQty}<span className="font-normal text-muted"> / {order.totalQty} ตัว</span></p><p className="mt-1 text-xs text-secondary">แพ็กแล้ว / ต้องส่ง</p>{order.metrics.atVendor > 0 && <InfoChip icon={Truck} className="mt-3">ร้านนอก {order.metrics.atVendor}</InfoChip>}{order.metrics.awaitingInspection > 0 && <p className="mt-2 text-xs text-secondary">รอตรวจรับ {order.metrics.awaitingInspection} ตัว</p>}</>}</td>
          <td className="px-4 py-5"><Owner order={order} /></td><td className="pr-3 py-5"><Button variant="ghost" size="icon" onClick={() => onOpen(order.id)} aria-label={`เปิด ${order.number}`}><ArrowRight /></Button></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="divide-y divide-divider overflow-hidden rounded-xl border border-divider bg-surface lg:hidden">
      {orders.map(order => <article key={order.id} className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3"><div><button type="button" onClick={() => onOpen(order.id)} className="min-h-11 text-left font-semibold text-strong underline-offset-4 hover:underline">{order.number}</button><p className="text-sm text-secondary">{order.customer}</p></div><Button variant="ghost" size="icon" onClick={() => onOpen(order.id)} aria-label={`เปิด ${order.number}`}><ArrowRight /></Button></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><Due order={order} clock={clock} /><span className="text-sm tabular-nums text-secondary">{order.unknown ? "ยังไม่ยืนยันจำนวน" : `แพ็ก ${order.packedQty}/${order.totalQty}`}</span></div><ActionSummary order={order} />
        <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3"><Owner order={order} /><Fact label="ของร้านนอก" value={order.unknown ? "ยังไม่ทราบ" : order.metrics.atVendor ? `${order.metrics.atVendor} ตัว` : "ไม่มีของค้าง"} icon={Truck} /></div>
      </article>)}
    </div>
  </>;
}
