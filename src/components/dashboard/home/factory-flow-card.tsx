"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarClock,
  Cpu,
  Flame,
  PackageCheck,
  PenLine,
  Printer,
  Send,
  ShieldCheck,
  Shirt,
  Truck,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import {
  buildFactoryNodes,
  factoryHealth,
  findBottleneck,
  relativeLoad,
  FACTORY_TONE_LABELS,
  type FactoryNode,
  type FactoryNodeCounts,
  type FactoryNodeKey,
  type FactoryTone,
} from "@/lib/home-factory";
import type { HomeFacts } from "@/server/services/home-overview";
import { HomeCard, HomeChip, HomeIconTile, type HomeTone } from "./home-card";

/* ============================================================
   ผังงานในโรงงาน + สุขภาพ (เบสเคาะ 2026-09-14 รอบ 4)

   node จัดบนกริด 8 คอลัมน์: 3 คอลัมน์สายเสื้อ · ช่องบรรจบ · 4 คอลัมน์หลังรีดร้อน
   สายฟิล์ม (พิมพ์ DTF) อยู่แถวล่างใต้เตรียมเสื้อ–ร้านนอก แล้ววิ่งขึ้นมารวมที่จุดเชื่อม
   รางวาดเป็น SVG ทับกริดจากตำแหน่งจริงของ node (วัดหลัง layout · วาดใหม่เมื่อย่อจอ)
   รางที่ติดด่านรีดร้อน (รอฟิล์ม/รอเสื้อ) เป็นสีเหลือง · จุดวิ่งตามรางปิดตาม reduced-motion
   ============================================================ */

const ICONS: Record<FactoryNodeKey, LucideIcon> = {
  design: PenLine,
  prep: Shirt,
  vendor: Truck,
  film: Printer,
  press: Flame,
  qc: ShieldCheck,
  pack: PackageCheck,
  ship: Send,
};

// ตำแหน่งบนกริด (คอลัมน์ 4 = ช่องบรรจบ ไม่มี node)
const PLACEMENT: Record<FactoryNodeKey, { col: number; row: number; span?: number }> = {
  design: { col: 1, row: 1 },
  prep: { col: 2, row: 1 },
  vendor: { col: 3, row: 1 },
  film: { col: 2, row: 2, span: 2 },
  press: { col: 5, row: 1 },
  qc: { col: 6, row: 1 },
  pack: { col: 7, row: 1 },
  ship: { col: 8, row: 1 },
};

const TONE_TO_HOME: Record<FactoryTone, HomeTone> = { ok: "success", warn: "warning", bad: "danger" };

const NODE_TONE: Record<FactoryTone, string> = {
  ok: "border-border",
  warn: "border-amber-300 dark:border-amber-700",
  bad: "border-red-300 ring-2 ring-red-100 dark:border-red-700 dark:ring-red-950",
};
const DOT_TONE: Record<FactoryTone, string> = {
  ok: "bg-green-600 dark:bg-green-400",
  warn: "bg-amber-500 dark:bg-amber-400",
  bad: "bg-red-600 dark:bg-red-400",
};
const DETAIL_TONE: Record<FactoryTone, string> = {
  ok: "text-muted",
  warn: "font-medium text-amber-700 dark:text-amber-300",
  bad: "font-medium text-red-700 dark:text-red-300",
};

type Edge = { d: string; gate: boolean; label?: { text: string; x: number; y: number } };
type Box = { l: number; r: number; t: number; b: number; cx: number; cy: number };

/** เส้นหักมุมโค้งเล็กน้อยผ่านจุดที่กำหนด */
function roundedPath(points: [number, number][]): string {
  const r = 10;
  let out = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const dx0 = Math.sign(x1 - x0);
    const dy0 = Math.sign(y1 - y0);
    const dx1 = Math.sign(x2 - x1);
    const dy1 = Math.sign(y2 - y1);
    out += ` L ${x1 - dx0 * r} ${y1 - dy0 * r} Q ${x1} ${y1} ${x1 + dx1 * r} ${y1 + dy1 * r}`;
  }
  const [xe, ye] = points[points.length - 1];
  return `${out} L ${xe} ${ye}`;
}

function MiniRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const circumference = 2 * Math.PI * 16;
  return (
    <span className="relative h-10 w-10 shrink-0" role="img" aria-label={`ขั้นงานวันนี้เสร็จ ${done} จาก ${total}`}>
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
        <circle cx="20" cy="20" r="16" className="fill-none stroke-surface-muted" strokeWidth="5" />
        <circle
          cx="20"
          cy="20"
          r="16"
          className="fill-none stroke-blue-600 dark:stroke-blue-400"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xs font-semibold tabular-nums text-strong">
        {Math.round(pct * 100)}%
      </span>
    </span>
  );
}

function Fact({
  icon,
  tone,
  label,
  value,
  ring,
}: {
  icon?: LucideIcon;
  tone?: HomeTone;
  label: string;
  value: string;
  ring?: { done: number; total: number };
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface-muted px-3 py-2">
      {ring ? <MiniRing done={ring.done} total={ring.total} /> : icon ? <HomeIconTile icon={icon} tone={tone} className="bg-surface" /> : null}
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted">{label}</span>
        <span className="block text-base font-semibold tabular-nums text-strong">{value}</span>
      </span>
    </div>
  );
}

export function FactoryFlowCard({ counts, facts }: { counts: FactoryNodeCounts; facts: HomeFacts }) {
  const nodes = useMemo(() => buildFactoryNodes(counts, facts), [counts, facts]);
  const bottleneck = findBottleneck(nodes);
  const health = factoryHealth(nodes);
  const load = relativeLoad(nodes);
  const gridRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [join, setJoin] = useState<{ x: number; y: number; gate: boolean } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);

  const waitingGarment = counts.press.waitingGarment > 0;
  const waitingFilm = counts.press.waitingFilm > 0;

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const compute = () => {
      const rect = grid.getBoundingClientRect();
      const box = (key: FactoryNodeKey): Box | null => {
        const el = grid.querySelector<HTMLElement>(`[data-node="${key}"]`);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {
          l: b.left - rect.left,
          r: b.right - rect.left,
          t: b.top - rect.top,
          b: b.bottom - rect.top,
          cx: b.left - rect.left + b.width / 2,
          cy: b.top - rect.top + b.height / 2,
        };
      };
      const d = box("design");
      const p = box("prep");
      const v = box("vendor");
      const f = box("film");
      const h = box("press");
      const q = box("qc");
      const k = box("pack");
      const s = box("ship");
      if (!d || !p || !v || !f || !h || !q || !k || !s) return;
      const y1 = p.cy;
      const y2 = f.cy;
      const xj = (v.r + h.l) / 2;
      setSize({ w: rect.width, h: rect.height });
      setJoin({ x: xj, y: y1, gate: waitingGarment || waitingFilm });
      setEdges([
        { d: `M ${d.r} ${y1} L ${p.l} ${y1}`, gate: false },
        { d: `M ${p.r} ${y1} L ${v.l} ${y1}`, gate: false },
        { d: `M ${v.r} ${y1} L ${xj} ${y1}`, gate: waitingGarment, label: { text: waitingGarment ? "เสื้อ · รอ" : "เสื้อ", x: (v.r + xj) / 2, y: y1 - 16 } },
        { d: roundedPath([[d.cx, d.b], [d.cx, y2], [f.l, y2]]), gate: false },
        { d: roundedPath([[f.r, y2], [xj, y2], [xj, y1]]), gate: waitingFilm, label: { text: waitingFilm ? "ฟิล์ม · รอ" : "ฟิล์ม", x: xj, y: (y1 + y2) / 2 } },
        { d: `M ${xj} ${y1} L ${h.l} ${y1}`, gate: waitingGarment || waitingFilm },
        { d: `M ${h.r} ${y1} L ${q.l} ${y1}`, gate: false },
        { d: `M ${q.r} ${y1} L ${k.l} ${y1}`, gate: false },
        { d: `M ${k.r} ${y1} L ${s.l} ${y1}`, gate: false },
      ]);
    };

    compute();
    const observer = new ResizeObserver(() => compute());
    observer.observe(grid);
    void document.fonts?.ready.then(compute);
    return () => observer.disconnect();
  }, [nodes, waitingFilm, waitingGarment]);

  const headerStatus =
    health.tone === "bad" ? (
      <HomeChip tone="danger" dot>ติด {health.bad} จุด</HomeChip>
    ) : health.tone === "warn" ? (
      <HomeChip tone="warning" dot>ต้องดู {health.warn} จุด</HomeChip>
    ) : (
      <HomeChip tone="success" dot>ปกติทุกจุด</HomeChip>
    );
  const onTime = facts.onTime.rate;

  return (
    <HomeCard
      id="home-factory"
      title="ผังงานในโรงงาน"
      icon={Workflow}
      tone={TONE_TO_HOME[health.tone]}
      action={
        <>
          {health.tone !== "ok" && health.warn > 0 && health.bad > 0 ? (
            <HomeChip tone="warning" dot>ต้องดู {health.warn} จุด</HomeChip>
          ) : null}
          {headerStatus}
          <Button asChild variant="ghost" size="sm">
            <Link href="/production">
              คิวผลิต
              <ArrowRight />
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 px-4 pb-2 sm:px-5 lg:grid-cols-4" aria-label="สุขภาพโรงงานวันนี้">
        <Fact
          label="ขั้นงานวันนี้"
          value={`${facts.todayQueue.done}/${facts.todayQueue.done + facts.todayQueue.open}`}
          ring={{ done: facts.todayQueue.done, total: facts.todayQueue.done + facts.todayQueue.open }}
        />
        <Fact
          icon={CalendarClock}
          tone={onTime === null ? "neutral" : onTime >= 90 ? "success" : "warning"}
          label="ส่งตรงเวลา 7 วัน"
          value={onTime === null ? "—" : `${onTime}%`}
        />
        <Fact icon={Flame} tone={facts.overdueOrders > 0 ? "danger" : "success"} label="เลยกำหนดส่ง" value={facts.overdueOrders.toLocaleString("th-TH")} />
        <Fact icon={Cpu} tone="brand" label="รอบพิมพ์ DTF วันนี้" value={facts.printRunsToday.toLocaleString("th-TH")} />
      </div>

      <div className="overflow-x-auto px-4 pb-5 pt-3 sm:px-5">
        <div
          ref={gridRef}
          className="relative grid min-w-[64rem] grid-cols-[repeat(3,minmax(7.5rem,1fr))_4rem_repeat(4,minmax(7.5rem,1fr))] grid-rows-[auto_auto] gap-x-6 gap-y-8 py-2"
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`}
            preserveAspectRatio="none"
          >
            {edges.map((edge, index) => (
              <path
                key={index}
                d={edge.d}
                strokeWidth={2}
                strokeLinecap="round"
                className={cn("fill-none", edge.gate ? "stroke-amber-500" : "stroke-border-strong")}
              />
            ))}
            {!reducedMotion
              ? edges.map((edge, index) => (
                  <circle key={`dot-${index}`} r={3} className={edge.gate ? "fill-amber-500" : "fill-blue-600 dark:fill-blue-400"}>
                    <animateMotion
                      dur={`${(2.4 + (index % 3) * 0.5).toFixed(1)}s`}
                      begin={`-${((index * 0.9) % 2.4).toFixed(1)}s`}
                      repeatCount="indefinite"
                      path={edge.d}
                    />
                  </circle>
                ))
              : null}
            {join ? (
              <circle
                cx={join.x}
                cy={join.y}
                r={5}
                strokeWidth={2}
                className={cn("fill-surface", join.gate ? "stroke-amber-500" : "stroke-border-strong")}
              />
            ) : null}
          </svg>

          {edges.map((edge, index) =>
            edge.label ? (
              <span
                key={`label-${index}`}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border bg-surface px-2 py-0.5 text-xs font-medium",
                  edge.gate ? "border-amber-500 text-amber-700 dark:text-amber-300" : "border-border-strong text-secondary",
                )}
                style={{ left: edge.label.x, top: edge.label.y }}
              >
                {edge.label.text}
              </span>
            ) : null,
          )}

          {nodes.map((node) => (
            <FlowNode key={node.key} node={node} bottleneck={bottleneck === node.key} load={load.get(node.key)} />
          ))}
        </div>
      </div>
    </HomeCard>
  );
}

function FlowNode({ node, bottleneck, load }: { node: FactoryNode; bottleneck: boolean; load: number | undefined }) {
  const Icon = ICONS[node.key];
  const place = PLACEMENT[node.key];
  return (
    <Link
      href={node.href}
      data-node={node.key}
      aria-label={`${node.name} ${node.count} ${node.unit} · ${node.detail} · ${FACTORY_TONE_LABELS[node.tone]}`}
      className={cn(
        FOCUS_BUTTON,
        INTERACTIVE_PRESSED,
        "relative z-[1] flex min-h-32 min-w-0 flex-col gap-1.5 rounded-xl border bg-surface p-3 text-left transition-colors",
        NODE_TONE[node.tone],
        node.external && "border-dashed",
      )}
      style={{
        gridColumn: place.span ? `${place.col} / span ${place.span}` : String(place.col),
        gridRow: String(place.row),
      }}
    >
      {bottleneck ? (
        <span className="absolute -top-2.5 right-2.5 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">คอขวด</span>
      ) : null}
      <span className="flex items-center justify-between">
        <HomeIconTile icon={Icon} tone={TONE_TO_HOME[node.tone]} size="sm" />
        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", DOT_TONE[node.tone])} />
      </span>
      <span className="truncate text-xs font-medium text-secondary">{node.name}</span>
      <span className="text-xl font-semibold tabular-nums text-strong">
        {node.count.toLocaleString("th-TH")}
        <span className="ml-1 text-xs font-normal text-muted">{node.unit}</span>
      </span>
      <span className={cn("line-clamp-2 text-xs", DETAIL_TONE[node.tone])}>{node.detail}</span>
      {load !== undefined ? (
        <span className="mt-auto block h-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          <span className="block h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${Math.round(load * 100)}%` }} />
        </span>
      ) : null}
    </Link>
  );
}
