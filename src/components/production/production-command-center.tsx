"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { PRIORITY_LABELS } from "@/lib/order-status";
import {
  AlertTriangle,
  Clock,
  ChevronRight,
  Plus,
  Flame,
  Truck,
  Factory,
  User,
} from "lucide-react";

// ── ศูนย์บัญชาการผลิต (floor overview) — จอโฟกัสเดียวของงานผลิต ──
// เบสเคาะ 2026-07-08: "เปิดมาต้องเห็นภาพรวมทั้งโรงงานก่อน" · ตอบ 3 คำถามใน 3 วิ:
// ① ตรงไหนไฟไหม้ (ต้องรีบ) ② งานเดินถึงไหนแต่ละสาย ③ คิวถัดไป · แล้วแตะเข้าไปดูราย
// ใช้ข้อมูลชุดเดิม (production.kanban + user.me) ไม่มี endpoint ใหม่ · ไม่มีเงินบนจอนี้

// งานไฟไหม้ — 1 ออเดอร์ยุบเหตุผลหลายข้อรวมแถวเดียว (เลยกำหนด+มีปัญหา+ติดด่าน)
export interface FireItem {
  orderId: string;
  orderNumber: string;
  title: string;
  customerName: string | null;
  deadline: Date | string | null;
  href: string;
  priority?: string | null; // ป้ายด่วน (URGENT/HIGH) — คงสัญญาณเด่นในภาพรวม
  reasons: { label: string; tone: "red" | "amber" }[];
  // "รอใคร" ของงานติดด่าน (จาก readiness.waitingOn) — ไม่ใช่ตัวเลขเงิน (detail มี ฿ จึงไม่หยิบมา)
  note?: string | null;
  // งานติดด่านพร้อมผลิต — หัวหน้าข้ามด่านได้ (soft-gate เดิม) · แถวเลยเป็น div+ปุ่ม ไม่ใช่ลิงก์ล้วน
  skippable?: boolean;
}

// สายการผลิต (เลนเทคนิค + หลังผลิต) — tile กวาดตาเห็นงานเดินถึงไหน แตะ = เข้าไปดูราย
export interface LaneTile {
  key: string;
  label: string;
  count: number;
  overdue: number; // งานเลยกำหนดในสายนี้ (จุดแดงมุม tile)
  isOutsource?: boolean;
  tone: "line" | "post"; // line = เลนผลิต · post = หลังผลิต (ตรวจ/แพ็ค/ส่ง)
}

// คิวรอเปิดใบผลิต (แถวสั้น)
export interface QueueItem {
  orderId: string;
  orderNumber: string;
  title: string;
  customerName: string | null;
  deadline: Date | string | null;
  priority?: string | null;
  totalQuantity?: number;
}

// งานของฉัน — ขั้นที่ช่างคน login ถืออยู่ (strip รอง สำหรับช่าง)
export interface MyWorkItem {
  stepId: string; // key เสถียร — 2 ขั้นชื่อ/ชนิดเดียวกันในใบเดียวจะไม่ชน key
  productionId: string;
  orderNumber: string;
  stepName: string;
  status: string;
}

// ป้ายด่วน — เหมือน OrderCardHeader เดิม (โชว์เมื่อ priority !== NORMAL)
function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority || priority === "NORMAL") return null;
  return (
    <Badge variant={priority === "URGENT" ? "destructive" : "warning"} size="sm">
      {PRIORITY_LABELS[priority] ?? priority}
    </Badge>
  );
}

function DeadlineTag({ deadline }: { deadline: Date | string | null }) {
  if (!deadline) return null;
  const overdue = new Date(deadline) < new Date();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium",
        overdue ? "text-red-600 dark:text-red-400" : "text-slate-400"
      )}
    >
      {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {overdue ? "เลยกำหนด " : "กำหนด "}
      {formatDate(deadline)}
    </span>
  );
}

export function ProductionCommandCenter({
  fires,
  lanes,
  queue,
  myWork,
  prioritizeMyWork,
  canCreate,
  onPickLane,
  onCreate,
}: {
  fires: FireItem[];
  lanes: LaneTile[];
  queue: QueueItem[];
  myWork: MyWorkItem[];
  // ช่างเปิดมาเห็นงานที่ตัวเองถือก่อน; หัวหน้ายังคงเห็นภาพรวมโรงงานก่อน
  prioritizeMyWork: boolean;
  // เปิด/ข้ามด่านใบผลิตได้ (หัวหน้าขึ้นไป — ตรง supervise_operations ฝั่ง server)
  canCreate: boolean;
  onPickLane: (tile: LaneTile) => void;
  onCreate: (orderId: string) => void;
}) {
  const lineLanes = lanes.filter((l) => l.tone === "line");
  const postLanes = lanes.filter((l) => l.tone === "post");

  return (
    <div className="space-y-6">
      {prioritizeMyWork && myWork.length > 0 && <MyWorkSection items={myWork} primary />}

      {/* ① ต้องรีบ — งานไฟไหม้ อยู่บนสุด สะดุดตาสุด (ว่าง = ไม่โชว์ ไม่รกจอ) */}
      {fires.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
            <Flame className="h-4 w-4" />
            ต้องรีบ
            <span className="rounded-full bg-red-100 px-1.5 text-xs tabular-nums text-red-700 dark:bg-red-950/60 dark:text-red-300">
              {fires.length}
            </span>
          </h2>
          <div className="space-y-2">
            {fires.map((f) => {
              const info = (
                <>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">
                      {f.orderNumber}
                    </span>
                    <PriorityBadge priority={f.priority} />
                    <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                      {[f.title, f.customerName].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {f.reasons.map((r) => (
                      <span
                        key={r.label}
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          r.tone === "red"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        )}
                      >
                        {r.label}
                      </span>
                    ))}
                  </div>
                  {/* "รอใคร" ของงานติดด่าน — คงคำถามในภาพรวมไม่ต้องแตะเข้าออเดอร์ก่อน */}
                  {f.note && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{f.note}</p>
                  )}
                </>
              );
              // งานติดด่าน + หัวหน้า → แถวมีปุ่ม "ข้ามด่าน" (เปิดใบผลิตทั้งที่ยังติด) จึงเป็น
              // div ไม่ใช่ลิงก์ล้วน · งานอื่น (เลยกำหนด/มีปัญหา) แตะทั้งแถวไปจัดการได้เลย
              if (f.skippable && canCreate) {
                return (
                  <div
                    key={f.orderId}
                    className="flex min-h-[56px] items-center gap-3 rounded-xl border border-red-200/80 bg-red-50/50 px-3.5 py-2.5 dark:border-red-900/50 dark:bg-red-950/20"
                  >
                    <Link href={f.href} className="min-w-0 flex-1">
                      {info}
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCreate(f.orderId)}
                      className="h-9 shrink-0 text-xs text-slate-500"
                    >
                      ข้ามด่าน
                    </Button>
                  </div>
                );
              }
              return (
                <Link
                  key={f.orderId}
                  href={f.href}
                  className="flex min-h-[56px] items-center gap-3 rounded-xl border border-red-200/80 bg-red-50/50 px-3.5 py-2.5 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:bg-red-950/40"
                >
                  <div className="min-w-0 flex-1">{info}</div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-red-300 dark:text-red-700" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ② สายการผลิต — กวาดตาเห็นงานเดินถึงไหนแต่ละสาย แตะ tile = เข้าไปดูรายการจริง */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Factory className="h-4 w-4 text-blue-500" />
          สายการผลิต
        </h2>
        {lineLanes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
            ยังไม่มีงานในไลน์ผลิต
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {lineLanes.map((tile) => (
              <LaneTileButton key={tile.key} tile={tile} onClick={() => onPickLane(tile)} />
            ))}
          </div>
        )}
        {postLanes.length > 0 && (
          <>
            <p className="pt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              หลังผลิต
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {postLanes.map((tile) => (
                <LaneTileButton key={tile.key} tile={tile} onClick={() => onPickLane(tile)} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ③ คิวถัดไป — รอเปิดใบผลิต (ต้นน้ำ) · กดเปิดใบผลิตได้จากตรงนี้เลย */}
      {queue.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            คิวถัดไป — รอเปิดใบผลิต
            <span className="rounded-full bg-amber-50 px-1.5 text-xs tabular-nums text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {queue.length}
            </span>
          </h2>
          <div className="space-y-2">
            {queue.map((q) => (
              <div
                key={q.orderId}
                className="card-surface flex min-h-[56px] items-center gap-3 rounded-xl px-3.5 py-2.5"
              >
                <Link href={`/orders/${q.orderId}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">
                      {q.orderNumber}
                    </span>
                    <PriorityBadge priority={q.priority} />
                    <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                      {[q.title, q.customerName].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <DeadlineTag deadline={q.deadline} />
                    {q.totalQuantity != null && q.totalQuantity > 0 && (
                      <span className="text-[11px] text-slate-400">
                        {q.totalQuantity.toLocaleString()} ชิ้น
                      </span>
                    )}
                  </div>
                </Link>
                {canCreate ? (
                  <Button
                    size="sm"
                    onClick={() => onCreate(q.orderId)}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    เปิดใบผลิต
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild className="h-9 shrink-0">
                    <Link href={`/orders/${q.orderId}`}>เปิดดู</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!prioritizeMyWork && myWork.length > 0 && <MyWorkSection items={myWork} />}
    </div>
  );
}

function MyWorkSection({ items, primary = false }: { items: MyWorkItem[]; primary?: boolean }) {
  return (
    <section
      className={cn(
        "space-y-2.5",
        primary && "rounded-2xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20"
      )}
      aria-labelledby="production-my-work"
    >
      <div>
        <h2
          id="production-my-work"
          className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          งานของฉัน
          <span className="rounded-full bg-blue-100 px-1.5 text-xs tabular-nums text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {items.length}
          </span>
        </h2>
        {primary && (
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            เลือกงานถัดไปแล้วบันทึกจำนวนหรือปิดขั้นได้จากหน้าใบผลิต
          </p>
        )}
      </div>
      <div className="card-surface overflow-hidden rounded-2xl">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((work) => (
            <li key={work.stepId}>
              <Link
                href={`/production/${work.productionId}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {work.stepName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{work.orderNumber}</p>
                </div>
                <Badge variant={work.status === "IN_PROGRESS" ? "accent" : "default"} size="sm">
                  {work.status === "IN_PROGRESS" ? "ทำต่อ" : "เริ่มงาน"}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// tile หนึ่งสาย — ตัวเลขงานใหญ่ กวาดตาเห็นแต่ไกล + จุดแดงถ้ามีงานเลยกำหนด · เป้านิ้ว ≥44px
function LaneTileButton({ tile, onClick }: { tile: LaneTile; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-surface flex min-h-[76px] flex-col justify-between rounded-2xl p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
    >
      <div className="flex items-start justify-between gap-1">
        <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {tile.label}
          {tile.isOutsource && <Truck className="h-3 w-3 text-slate-400" />}
        </span>
        {tile.overdue > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {tile.overdue}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
          {tile.count}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      </div>
    </button>
  );
}
