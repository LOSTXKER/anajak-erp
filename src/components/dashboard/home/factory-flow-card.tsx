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
import { c, CardHead, MiniRing, type Tone } from "@/components/kit/kit";
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

/* ============================================================
   ผังงานในโรงงาน + สุขภาพ — ต้นแบบ factoryHTML()/drawFlow() รอบ 4 (เบสเคาะ 2026-09-14)

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

const HEAD_TONE: Record<FactoryTone, Tone> = { ok: "good", warn: "warn", bad: "bad" };

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

/** ช่องสุขภาพ (.hf) */
function HealthFact({ icon: Icon, tone = "", label, value }: { icon: LucideIcon; tone?: Tone; label: string; value: string }) {
  return (
    <div className={c("hf")}>
      <span className={c("ic", tone)} aria-hidden="true">
        <Icon />
      </span>
      <span className={c("t")}>
        {label}
        <b>{value}</b>
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

  const queueTotal = facts.todayQueue.done + facts.todayQueue.open;
  const onTime = facts.onTime.rate;

  return (
    <section className={c("card")} aria-labelledby="home-factory">
      <CardHead
        icon={Workflow}
        tone={HEAD_TONE[health.tone]}
        id="home-factory"
        title="ผังงานในโรงงาน"
        after={
          <span className={c("legend")} aria-hidden="true">
            <span>
              <i className={c("ok")} />
              ปกติ
            </span>
            <span>
              <i className={c("warn")} />
              ต้องดู
            </span>
            <span>
              <i className={c("bad")} />
              ติด
            </span>
          </span>
        }
        right={
          <>
            {health.bad > 0 ? (
              <span className={c("chip bad")}>
                <span className={c("d")} aria-hidden="true" />
                ติด {health.bad} จุด
              </span>
            ) : null}
            {health.warn > 0 ? (
              <span className={c("chip warn")}>
                <span className={c("d")} aria-hidden="true" />
                ต้องดู {health.warn} จุด
              </span>
            ) : null}
            {health.bad === 0 && health.warn === 0 ? (
              <span className={c("chip good")}>
                <span className={c("d")} aria-hidden="true" />
                ปกติทุกจุด
              </span>
            ) : null}
            <Link href="/production" className={c("btn ghost sm")}>
              คิวผลิต
              <ArrowRight aria-hidden="true" />
            </Link>
          </>
        }
      />

      <div className={c("hfacts")} aria-label="สุขภาพโรงงานวันนี้">
        <div className={c("hf")}>
          <span role="img" aria-label={`ขั้นงานวันนี้เสร็จ ${facts.todayQueue.done} จาก ${queueTotal}`}>
            <MiniRing
              pct={queueTotal > 0 ? facts.todayQueue.done / queueTotal : 0}
              label={`${queueTotal > 0 ? Math.round((facts.todayQueue.done / queueTotal) * 100) : 0}%`}
            />
          </span>
          <span className={c("t")}>
            ขั้นงานวันนี้
            <b>
              {facts.todayQueue.done}/{queueTotal}
            </b>
          </span>
        </div>
        <HealthFact
          icon={CalendarClock}
          tone={onTime === null ? "" : onTime >= 90 ? "good" : "warn"}
          label="ส่งตรงเวลา 7 วัน"
          value={onTime === null ? "—" : `${onTime}%`}
        />
        <HealthFact
          icon={Flame}
          tone={facts.overdueOrders > 0 ? "bad" : "good"}
          label="เลยกำหนดส่ง"
          value={facts.overdueOrders.toLocaleString("th-TH")}
        />
        <HealthFact icon={Cpu} tone="blue" label="รอบพิมพ์ DTF วันนี้" value={facts.printRunsToday.toLocaleString("th-TH")} />
      </div>

      <div className={c("flow")}>
        <div ref={gridRef} className={c("grid")}>
          <svg
            aria-hidden="true"
            className={c("edges")}
            viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`}
            preserveAspectRatio="none"
          >
            {edges.map((edge, index) => (
              <path key={index} d={edge.d} className={c("edge", edge.gate && "gate")} />
            ))}
            {!reducedMotion
              ? edges.map((edge, index) => (
                  <circle key={`dot-${index}`} r={3} className={c("fdot", edge.gate && "gate")}>
                    <animateMotion
                      dur={`${(2.4 + (index % 3) * 0.5).toFixed(1)}s`}
                      begin={`-${((index * 0.9) % 2.4).toFixed(1)}s`}
                      repeatCount="indefinite"
                      path={edge.d}
                    />
                  </circle>
                ))
              : null}
            {join ? <circle cx={join.x} cy={join.y} r={5} className={c("join", join.gate && "gate")} /> : null}
          </svg>

          {edges.map((edge, index) =>
            edge.label ? (
              <span
                key={`label-${index}`}
                aria-hidden="true"
                className={c("elab", edge.gate && "gate")}
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
    </section>
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
      className={c("node", node.tone, node.external && "out")}
      style={{
        gridColumn: place.span ? `${place.col} / span ${place.span}` : String(place.col),
        gridRow: String(place.row),
      }}
    >
      {bottleneck ? <span className={c("nb")}>คอขวด</span> : null}
      <span className={c("nt")}>
        <span className={c("ni")} aria-hidden="true">
          <Icon />
        </span>
        <span className={c("nd")} aria-hidden="true" />
      </span>
      <span className={c("nn")}>{node.name}</span>
      <span className={c("nc")}>
        {node.count.toLocaleString("th-TH")}
        <small>{node.unit}</small>
      </span>
      <span className={c("ns")}>{node.detail}</span>
      {load !== undefined ? (
        <span className={c("nl")} aria-hidden="true">
          {/* แถบงานในมือย้อมตามสุขภาพของด่านนั้น (ต้นแบบ .nl i.warn/.bad) — ระบบยังไม่มีกำลังผลิตต่อวันจริง
              จึงใช้ tone ของ node แทนสัดส่วนต่อ cap
              สีสั่งตรงที่แท่งไว้ก่อน จนกว่าชุดกลางจะมีกฎ .node .nl i.warn/.bad (แบบเดียวกับแท่ง 7 วัน) */}
          <i
            className={c(node.tone !== "ok" && node.tone)}
            style={{
              width: `${Math.round(load * 100)}%`,
              background: node.tone === "bad" ? "var(--bad)" : node.tone === "warn" ? "var(--warn)" : undefined,
            }}
          />
        </span>
      ) : (
        <span className={c("nl none")} aria-hidden="true" />
      )}
    </Link>
  );
}
