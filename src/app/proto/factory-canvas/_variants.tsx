"use client";

/* ============================================================
   จอรวมการผลิตแบบ "canvas" — เห็นทั้งโรงงานในภาพเดียว (เบสสั่ง 2026-09-01)

   คำต่อคำ: *"อยากได้ฟีล canvas ที่เห็นภาพรวมของโรงงานทั้งหมด แต่ละ node แต่ละสาย
   รวมถึงสายนอกโรงงาน"*

   ⚠️ ของเดิมที่มีอยู่แล้ว: `/factory` เป็นกริดการ์ดศูนย์งาน (ตัวเลข running/ready/blocked
   ต่อศูนย์) — บอกภาระแต่ละจุดได้ แต่ **ไม่มีเส้นทาง ไม่เห็นว่างานไหลไปไหน และไม่แยก
   ในโรงงาน/นอกโรงงาน** สามแบบนี้จึงเติมสิ่งที่ขาด ไม่ได้เขียนตัวเลขใหม่

   ตัวเลขทุกตัวมาจาก board.stations ตัวจริง (จำนวนงานค้าง + เลยกำหนดรายสถานี)
   ============================================================ */

import {
  AlertTriangle,
  ClipboardCheck,
  Factory,
  PackageCheck,
  Printer,
  Shirt,
  Timer,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { PROTO_BOARD } from "../production-list/_data";

export type StationNode = {
  key: string;
  label: string;
  count: number;
  overdue: number;
  isOutsource: boolean;
};

/** สถานีทั้งหมดที่มีงานอยู่ตอนนี้ — ยกจาก board ตัวจริง */
export function stations(): StationNode[] {
  return PROTO_BOARD.stations.map((station) => ({
    key: station.key,
    label: station.label,
    count: station.count,
    overdue: station.overdue,
    isOutsource: station.isOutsource,
  }));
}

/** คืน element ไม่ใช่ตัว component — react-compiler ห้ามประกอบ component ตอน render */
export function stationIcon(key: string, isOutsource: boolean, className: string) {
  const Icon: LucideIcon =
    key === "queue"
      ? Timer
      : key === "post:qc" || key === "legacy:qc"
        ? ClipboardCheck
        : key === "post:pack" || key === "post:ship"
          ? PackageCheck
          : key === "lane:PREP"
            ? Shirt
            : key === "lane:DTF"
              ? Printer
              : isOutsource
                ? Truck
                : Factory;
  return <Icon className={className} strokeWidth={1.8} aria-hidden="true" />;
}

/** ความหนาของเส้น = ปริมาณงานที่ไหลผ่าน — เห็นได้ทันทีว่าสายไหนหนัก */
function flowWidth(count: number) {
  if (count >= 8) return "h-2";
  if (count >= 4) return "h-1.5";
  if (count >= 1) return "h-1";
  return "h-0.5";
}

/* -------------------------------------------------- การ์ด node */

export function NodeCard({
  node,
  size = "md",
}: {
  node: StationNode;
  size?: "md" | "lg";
}) {
  const busy = node.count > 0;
  return (
    <div
      className={cn(
        "card-surface relative rounded-2xl p-3 transition-shadow",
        size === "lg" ? "min-w-40" : "min-w-32",
        !busy && "opacity-55",
        node.overdue > 0 && "ring-1 ring-red-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {stationIcon(
          node.key,
          node.isOutsource,
          cn(
            "h-4 w-4 shrink-0",
            node.isOutsource ? "text-secondary" : "text-module-production-text",
          ),
        )}
        {node.overdue > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {node.overdue}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums text-strong",
          size === "lg" ? "text-2xl" : "text-xl",
        )}
      >
        {node.count}
      </p>
      <p className="text-2xs leading-tight text-secondary">{node.label}</p>
      {/* แถบภาระ — เทียบกับสถานีที่หนักที่สุดในโรงงาน */}
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-muted">
        <span
          className={cn(
            "block h-full rounded-full",
            node.overdue > 0 ? "bg-red-500" : "bg-module-production-solid",
          )}
          style={{
            width: `${Math.min(100, (node.count / Math.max(1, Math.max(...stations().map((item) => item.count)))) * 100)}%`,
          }}
        />
      </span>
    </div>
  );
}

function Connector({ count, vertical = false }: { count: number; vertical?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 self-center rounded-full",
        count > 0 ? "bg-module-production-solid/50" : "bg-divider",
        vertical ? cn("w-1 h-6") : cn("w-6", flowWidth(count)),
      )}
    />
  );
}

/* -------------------------------- A · ผังสายการผลิต (เส้นทางเดียว) */

export function FlowCanvas() {
  const all = stations();
  const inHouse = all.filter((node) => !node.isOutsource);
  const outsource = all.filter((node) => node.isOutsource);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface-muted/40 p-4">
        <p className="mb-3 text-2xs font-medium uppercase tracking-wide text-module-production-text">
          ในโรงงาน
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {inHouse.map((node, index) => (
            <div key={node.key} className="flex items-center">
              {index > 0 ? <Connector count={node.count} /> : null}
              <NodeCard node={node} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pl-4 text-xs text-secondary">
        <span aria-hidden="true" className="text-base">⤴</span>
        งานที่ต้องออกไปข้างนอกแล้วกลับเข้ามา
      </div>

      <div className="rounded-2xl border border-dashed border-border p-4">
        <p className="mb-3 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-secondary">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          นอกโรงงาน
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {outsource.length === 0 ? (
            <p className="text-xs text-muted">ตอนนี้ไม่มีงานอยู่ร้านนอก</p>
          ) : (
            outsource.map((node) => <NodeCard key={node.key} node={node} />)
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ B · แผนที่โรงงาน (โซนตามพื้นที่จริง) */

/* โซนต้องตรงกับสถานีที่ระบบมีจริง — ตอนแรกแยก "โซนรีด" ไว้ต่างหาก แล้วมันว่างเปล่าตลอด
   เพราะรีดร้อนอยู่ในเลนเดียวกับ DTF (STEP_LANE: HEAT_PRESS → DTF) จึงยุบเป็นโซนเดียว */
const ZONES: { key: string; title: string; stations: string[]; hint: string }[] = [
  { key: "in", title: "รับเข้า", stations: ["queue", "lane:PREP"], hint: "เสื้อเข้ามา · เตรียมงาน" },
  { key: "print", title: "โซนพิมพ์ + รีด", stations: ["lane:DTF"], hint: "พิมพ์ฟิล์ม · รีดร้อน" },
  { key: "check", title: "โซนตรวจ", stations: ["post:qc", "legacy:qc"], hint: "ตรวจคุณภาพ" },
  { key: "out", title: "แพ็ก + ส่ง", stations: ["post:pack", "post:ship"], hint: "แพ็ก · รอส่งมอบ" },
];

export function FactoryMap() {
  const all = stations();
  const outsource = all.filter((node) => node.isOutsource);
  const zoneNodes = (keys: string[]) =>
    all.filter((node) => keys.includes(node.key));
  const placed = new Set(ZONES.flatMap((zone) => zone.stations));
  const others = all.filter(
    (node) => !node.isOutsource && !placed.has(node.key),
  );

  return (
    <div className="space-y-4">
      {/* กรอบโรงงาน — ทุกอย่างในนี้คืองานที่เราคุมเอง */}
      <div className="rounded-3xl border-2 border-border p-4">
        <p className="mb-3 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-module-production-text">
          <Factory className="h-3.5 w-3.5" aria-hidden="true" />
          ในโรงงาน Anajak
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ZONES.map((zone) => {
            const nodes = zoneNodes(zone.stations);
            const total = nodes.reduce((sum, node) => sum + node.count, 0);
            return (
              <div key={zone.key} className="rounded-2xl bg-surface-muted/50 p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-strong">{zone.title}</p>
                  <p className="text-2xs tabular-nums text-muted">{total} ใบ</p>
                </div>
                <p className="mb-2 text-2xs text-muted">{zone.hint}</p>
                <div className="space-y-2">
                  {nodes.length === 0 ? (
                    <p className="text-2xs text-muted">ไม่มีงานในโซนนี้</p>
                  ) : (
                    nodes.map((node) => <NodeCard key={node.key} node={node} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {others.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((node) => (
              <NodeCard key={node.key} node={node} />
            ))}
          </div>
        ) : null}
      </div>

      {/* นอกกรอบโรงงาน = งานที่อยู่ในมือคนอื่น */}
      <div className="rounded-3xl border-2 border-dashed border-border p-4">
        <p className="mb-3 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-secondary">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          นอกโรงงาน (ร้านรับจ้าง)
        </p>
        <div className="flex flex-wrap gap-2">
          {outsource.length === 0 ? (
            <p className="text-xs text-muted">ตอนนี้ไม่มีงานอยู่ร้านนอก</p>
          ) : (
            outsource.map((node) => <NodeCard key={node.key} node={node} size="lg" />)
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------ C · กระดานงานตามสถานี (เห็นตัวงาน) */

export function StationBoard() {
  const all = stations().filter((node) => node.count > 0);

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-max gap-3">
        {all.map((node) => {
          const jobs = PROTO_BOARD.jobs.filter((job) =>
            job.stationKeys.includes(node.key),
          );
          return (
            <div
              key={node.key}
              className={cn(
                "w-56 shrink-0 rounded-2xl p-3",
                node.isOutsource
                  ? "border border-dashed border-border"
                  : "bg-surface-muted/50",
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                {stationIcon(
                  node.key,
                  node.isOutsource,
                  cn(
                    "h-4 w-4",
                    node.isOutsource ? "text-secondary" : "text-module-production-text",
                  ),
                )}
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-strong">
                  {node.label}
                </p>
                <span className="text-xs font-semibold tabular-nums text-secondary">
                  {node.count}
                </span>
              </div>
              <div className="space-y-1.5">
                {jobs.slice(0, 5).map((job) => (
                  <div
                    key={job.key}
                    className={cn(
                      "card-surface rounded-lg px-2 py-1.5",
                      job.overdue && "ring-1 ring-red-500/40",
                    )}
                  >
                    <p className="truncate text-2xs font-medium tabular-nums text-strong">
                      {job.order.orderNumber}
                    </p>
                    <p className="truncate text-2xs text-muted">
                      {job.order.customerName ?? "ไม่ระบุลูกค้า"}
                    </p>
                  </div>
                ))}
                {jobs.length > 5 ? (
                  <p className="text-2xs text-muted">+ อีก {jobs.length - 5} ใบ</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CANVAS_MODES = ["flow", "map", "board"] as const;
export type FactoryCanvasVariant = (typeof CANVAS_MODES)[number];

export const CANVAS_COMPONENTS = {
  flow: FlowCanvas,
  map: FactoryMap,
  board: StationBoard,
} as const;
