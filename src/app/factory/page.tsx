"use client";

import { useEffect, useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AlertTriangle, Printer, Flame, Package, Clock, Truck } from "lucide-react";

// ทีวีคิวรวมโรงงาน (UX4) — read-only จอติดผนัง อ่านที่ 3-5 เมตร · โพลล์ 30 วิ · ไม่มีเงินเลย
// endpoint factory.board ไม่มีฟิลด์เงินโดยโครงสร้าง (getFactoryBoard) — ปลอดภัยเชิงโครงสร้าง

type Board = RouterOutput["factory"]["board"];

const STALE_MS = 2 * 60 * 1000; // เกิน 2 นาทีไม่มีข้อมูลใหม่ = ขึ้นแถบ "ข้อมูลค้าง" (B8 ห้ามจอโกหก)

function fmtTime(d: Date | string | number) {
  return new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date | string | number) {
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
function isOverdue(deadline: Date | string | null): boolean {
  return deadline != null && new Date(deadline) < new Date();
}

export default function FactoryBoardPage() {
  const query = trpc.factory.board.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // นาฬิกาเดินเองทุก 30 วิ — ให้แถบ "ข้อมูลค้าง" สดโดยไม่ต้องรอ refetch
  // (อ่านเวลาใน effect ไม่ใช่ตอน render — เลี่ยง react-hooks/purity)
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (query.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-2xl text-neutral-500">
        กำลังโหลดคิวการผลิต…
      </div>
    );
  }
  // query พัง (เน็ต/สิทธิ์) ต้องบอกตรงๆ — ห้ามโชว์จอเปล่าหลอกว่าไม่มีงาน (B8)
  if (query.isError || !query.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-14 w-14 text-red-500" />
        <p className="text-3xl font-bold">โหลดคิวไม่ได้</p>
        <p className="text-xl text-neutral-400">เช็คเน็ต/บัญชีจอ แล้วรอระบบลองใหม่เอง (ทุก 30 วิ)</p>
      </div>
    );
  }

  const board = query.data;
  const stale = now > 0 && now - query.dataUpdatedAt > STALE_MS;

  return (
    <div className="flex h-screen flex-col gap-4 p-6">
      {/* หัวจอ — ชื่อ + เวลาอัปเดต */}
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          ANAJAK <span className="text-neutral-500">·</span> สายการผลิตวันนี้
        </h1>
        <div className="flex items-baseline gap-5 text-neutral-400">
          <span className="text-lg tabular-nums">
            อัปเดต {fmtTime(board.generatedAt)} · ทุก 30 วิ
          </span>
          <span className="text-2xl font-semibold tabular-nums text-white">
            {fmtDate(board.generatedAt)}
          </span>
        </div>
      </header>

      {/* B8: ข้อมูลค้างเกิน 2 นาที ต้องบอก — จอสวยแต่โกหกไม่ได้ */}
      {stale && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-500/50 bg-yellow-500/10 px-4 py-2.5 text-lg font-semibold text-yellow-300">
          <AlertTriangle className="h-5 w-5" />
          ข้อมูลค้างตั้งแต่ {fmtTime(query.dataUpdatedAt)} — ระบบกำลังลองต่อใหม่
        </div>
      )}

      {/* 4 คอลัมน์หลัก */}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
        <ProblemsColumn problems={board.problems} />
        <DtfColumn activeRuns={board.activeRuns} printQueue={board.printQueue} />
        <PressColumn pressQueue={board.pressQueue} />
        <PackColumn packQueue={board.packQueue} />
      </div>

      {/* แถบล่าง — กำลังจะมา + ร้านนอกครบกำหนด */}
      <FooterStrip dueSoon={board.dueSoon} outsourceDue={board.outsourceDue} />
    </div>
  );
}

// ============================================================
// คอลัมน์ — โครงร่วม
// ============================================================
function Column({
  icon: Icon,
  title,
  count,
  danger,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border p-4",
        danger ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-white/5"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-6 w-6", danger ? "text-red-400" : "text-neutral-400")} />
        <h2
          className={cn(
            "text-sm font-bold uppercase tracking-wider",
            danger ? "text-red-300" : "text-neutral-400"
          )}
        >
          {title}
        </h2>
        <span className="ml-auto text-2xl font-bold tabular-nums">{count}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">{children}</div>
    </section>
  );
}

function EmptyLane({ label }: { label: string }) {
  return <p className="mt-2 text-lg text-neutral-600">{label}</p>;
}

// ป้ายลูกค้า+ช่าง — เบสเคาะให้โชว์ทั้งคู่ (§4 ข้อ 2-3)
function CustomerLine({ customer, assignee }: { customer: string; assignee?: string | null }) {
  return (
    <p className="truncate text-base text-neutral-400">
      {customer}
      {assignee && <span className="text-neutral-500"> · {assignee}</span>}
    </p>
  );
}

// ============================================================
function ProblemsColumn({ problems }: { problems: Board["problems"] }) {
  const label = (s: string) => (s === "FAILED" ? "งานเสีย" : "พักงาน");
  return (
    <Column icon={AlertTriangle} title="ด่วน / ติดปัญหา" count={problems.length} danger>
      {problems.length === 0 ? (
        <EmptyLane label="ไม่มีงานติดปัญหา 👍" />
      ) : (
        problems.slice(0, 6).map((p) => (
          <div key={p.stepId} className="rounded-xl border-l-4 border-red-500 bg-red-500/10 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold tabular-nums">{p.orderNumber}</span>
              <span className="shrink-0 text-sm font-semibold text-red-300">{label(p.status)}</span>
            </div>
            <CustomerLine customer={p.customerName} assignee={p.assignedToName} />
            <p className="truncate text-sm text-red-300/90">
              ติดด่าน{p.stepLabel}
              {isOverdue(p.deadline) && " · เลยกำหนด"}
            </p>
          </div>
        ))
      )}
      {problems.length > 6 && <MoreRow n={problems.length - 6} />}
    </Column>
  );
}

// ============================================================
function DtfColumn({
  activeRuns,
  printQueue,
}: {
  activeRuns: Board["activeRuns"];
  printQueue: Board["printQueue"];
}) {
  return (
    <Column icon={Printer} title="DTF · พิมพ์ฟิล์ม" count={activeRuns.length + printQueue.length}>
      {activeRuns.length === 0 && printQueue.length === 0 ? (
        <EmptyLane label="ไม่มีงานพิมพ์" />
      ) : (
        <>
          {activeRuns.slice(0, 2).map((r) => (
            <div key={r.runNumber} className="rounded-xl border border-green-500/50 bg-green-500/10 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold text-green-300">กำลังพิมพ์ {r.runNumber}</span>
                <span className="shrink-0 text-sm text-neutral-400">{r.openedByName}</span>
              </div>
              <p className="truncate text-base text-neutral-300 tabular-nums">
                {r.jobs.map((j) => `${j.orderNumber} (${j.qty})`).join(" · ") || "—"}
              </p>
            </div>
          ))}
          {printQueue.length > 0 && (
            <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">คิวถัดไป</p>
          )}
          {printQueue.slice(0, 4).map((e) => (
            <div key={e.orderNumber} className="flex items-baseline justify-between gap-2 px-1">
              <span className="truncate text-xl font-semibold tabular-nums">
                {e.orderNumber}
                {isOverdue(e.deadline) && <span className="ml-1.5 text-red-400">●</span>}
              </span>
              <span className="shrink-0 text-sm text-neutral-400">
                {e.customerName} · {e.qtyTotal}
              </span>
            </div>
          ))}
          {printQueue.length > 4 && <MoreRow n={printQueue.length - 4} />}
        </>
      )}
    </Column>
  );
}

// ============================================================
function PressColumn({ pressQueue }: { pressQueue: Board["pressQueue"] }) {
  return (
    <Column icon={Flame} title="รีดร้อน" count={pressQueue.length}>
      {pressQueue.length === 0 ? (
        <EmptyLane label="ไม่มีคิวรีด" />
      ) : (
        pressQueue.slice(0, 6).map((s) => (
          <div key={s.stepId} className="rounded-xl bg-white/5 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold tabular-nums">
                {s.orderNumber}
                {isOverdue(s.deadline) && <span className="ml-1.5 text-red-400">●</span>}
              </span>
              <span className="shrink-0 text-lg font-bold tabular-nums text-neutral-200">
                {s.qtyDone}
                <span className="text-sm text-neutral-500">/{s.qtyTotal}</span>
              </span>
            </div>
            <CustomerLine customer={s.customerName} assignee={s.assignedToName} />
          </div>
        ))
      )}
      {pressQueue.length > 6 && <MoreRow n={pressQueue.length - 6} />}
    </Column>
  );
}

// ============================================================
function PackColumn({ packQueue }: { packQueue: Board["packQueue"] }) {
  return (
    <Column icon={Package} title="แพ็ค / ส่ง" count={packQueue.length}>
      {packQueue.length === 0 ? (
        <EmptyLane label="ไม่มีคิวแพ็ค" />
      ) : (
        packQueue.slice(0, 6).map((s) => (
          <div
            key={s.stepId}
            className={cn(
              "rounded-xl px-3 py-2",
              s.blindShip ? "border border-red-500 bg-red-500/10" : "bg-white/5"
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold tabular-nums">
                {s.orderNumber}
                {isOverdue(s.deadline) && <span className="ml-1.5 text-red-400">●</span>}
              </span>
              {s.blindShip && (
                <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  BLIND SHIP
                </span>
              )}
            </div>
            <CustomerLine customer={s.customerName} assignee={s.assignedToName} />
          </div>
        ))
      )}
      {packQueue.length > 6 && <MoreRow n={packQueue.length - 6} />}
    </Column>
  );
}

// ============================================================
function FooterStrip({
  dueSoon,
  outsourceDue,
}: {
  dueSoon: Board["dueSoon"];
  outsourceDue: Board["outsourceDue"];
}) {
  return (
    <footer className="grid grid-cols-2 gap-4">
      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
        <Clock className="h-5 w-5 shrink-0 text-neutral-400" />
        <span className="shrink-0 text-sm uppercase tracking-wide text-neutral-500">กำลังจะมา</span>
        <span className="truncate text-lg tabular-nums text-neutral-300">
          {dueSoon.length === 0
            ? "—"
            : dueSoon
                .slice(0, 6)
                .map((o) => `${o.orderNumber} (${o.customerName})`)
                .join("  ·  ")}
        </span>
      </div>
      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
        <Truck className="h-5 w-5 shrink-0 text-neutral-400" />
        <span className="shrink-0 text-sm uppercase tracking-wide text-neutral-500">รอร้านนอกส่งกลับ</span>
        <span className="truncate text-lg tabular-nums text-neutral-300">
          {outsourceDue.length === 0
            ? "—"
            : outsourceDue
                .slice(0, 6)
                .map((o) => `${o.orderNumber} · ${o.vendorName}`)
                .join("  ·  ")}
        </span>
      </div>
    </footer>
  );
}

function MoreRow({ n }: { n: number }) {
  return <p className="px-1 text-base font-medium text-neutral-500">+ อีก {n} งาน</p>;
}
