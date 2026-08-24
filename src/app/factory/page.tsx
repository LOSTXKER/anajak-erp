"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  PackageCheck,
  Printer,
  ShieldCheck,
  Shirt,
  Truck,
  Factory,
} from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { ManufacturingFactoryBoard } from "@/components/factory/manufacturing-factory-board";
import { ProductionFreshness } from "@/components/production/production-freshness";
import { useProductionV2Enabled } from "@/components/factory/production-v2-context";
import { cn, formatDateShort } from "@/lib/utils";

// Factory TV — read-only pulse ของสายงานจริง 5 ด่าน
// endpoint factory.board ไม่มี field เงินโดยโครงสร้าง และหน้านี้ไม่มี action ใด ๆ
type Board = RouterOutput["factory"]["board"];

const STALE_MS = 2 * 60 * 1000;
const VISIBLE_ROWS = 4;

function isOverdue(deadline: Date | string | null): boolean {
  if (deadline == null) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(deadline).getTime() < startOfToday.getTime();
}

export default function FactoryBoardPage() {
  const productionV2 = useProductionV2Enabled();
  return productionV2 ? <ManufacturingFactoryBoard /> : <LegacyFactoryBoardPage />;
}

function LegacyFactoryBoardPage() {
  const query = trpc.factory.board.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const [now, setNow] = useState(0);

  useEffect(() => {
    const initialTick = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(initialTick);
      clearInterval(timer);
    };
  }, []);

  if (query.isLoading && !query.data) return <FactoryBoardLoading />;

  // background refetch พังต้องคง snapshot ล่าสุดไว้และขึ้น stale; full error ใช้เมื่อไม่มีข้อมูลเลย
  if (query.isError && !query.data) {
    return (
      <main className="flex h-dvh items-center justify-center overflow-hidden p-6">
        <div className="max-w-xl rounded-lg border border-red-500/40 bg-red-500/10 px-10 py-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-semibold text-strong">โหลดสถานะโรงงานไม่ได้</h1>
          <p className="mt-2 text-lg text-secondary">
            ตรวจสอบอินเทอร์เน็ตหรือบัญชีจอ ระบบจะลองเชื่อมต่อใหม่ทุก 30 วินาที
          </p>
        </div>
      </main>
    );
  }

  if (!query.data) return <FactoryBoardLoading />;

  const board = query.data;
  const stale = query.isError || (now > 0 && now - query.dataUpdatedAt > STALE_MS);

  return (
    <main className="flex h-dvh min-h-[640px] flex-col gap-3 overflow-hidden p-4">
      <BoardHeader
        board={board}
        stale={stale}
        updatedAt={query.dataUpdatedAt}
        isFetching={query.isFetching && !query.isLoading}
      />

      <section aria-label="สายการผลิต 5 ด่าน" className="grid min-h-0 flex-1 grid-cols-5 gap-2.5">
        <StagePanel
          number={1}
          icon={Shirt}
          title="เตรียมเสื้อ"
          count={board.stageTotals.prep.total}
          active={board.stageTotals.prep.activeTotal}
          caption="เรียงตามกำหนดส่ง"
          empty="ไม่มีคิวเตรียมเสื้อ"
        >
          {board.prepQueue.slice(0, VISIBLE_ROWS).map((item) => (
            <QueueRow
              key={item.stepId}
              orderNumber={item.orderNumber}
              customerName={item.customerName}
              deadline={item.deadline}
              status={item.status === "IN_PROGRESS" ? "กำลังทำ" : item.stepLabel}
              progress={progressText(item.qtyDone, item.qtyTotal)}
              assignee={item.assignedToName}
            />
          ))}
          <MoreJobs
            count={
              board.stageTotals.prep.total - Math.min(board.prepQueue.length, VISIBLE_ROWS)
            }
          />
        </StagePanel>

        <StagePanel
          number={2}
          icon={Printer}
          title="พิมพ์ DTF"
          count={board.stageTotals.dtf.total}
          active={board.stageTotals.dtf.activeTotal}
          caption="คิวพร้อมเข้ารอบพิมพ์"
          empty="ไม่มีรอบหรือคิวพิมพ์"
        >
          <DtfQueueRows board={board} />
        </StagePanel>

        <StagePanel
          number={3}
          icon={Flame}
          title="รีดร้อน"
          count={board.stageTotals.press.total}
          active={board.stageTotals.press.activeTotal}
          caption="ผ่านเงื่อนไขฟิล์มและเสื้อ"
          empty="ไม่มีคิวรีดร้อน"
        >
          {board.pressQueue.slice(0, VISIBLE_ROWS).map((item) => (
            <QueueRow
              key={item.stepId}
              orderNumber={item.orderNumber}
              customerName={item.customerName}
              deadline={item.deadline}
              status={item.status === "IN_PROGRESS" ? "กำลังรีด" : "พร้อมเริ่ม"}
              progress={progressText(item.qtyDone, item.qtyTotal)}
              assignee={item.assignedToName}
              active={item.status === "IN_PROGRESS"}
            />
          ))}
          <MoreJobs
            count={
              board.stageTotals.press.total - Math.min(board.pressQueue.length, VISIBLE_ROWS)
            }
          />
        </StagePanel>

        <StagePanel
          number={4}
          icon={ShieldCheck}
          title="ตรวจ QC"
          count={board.stageTotals.qc.total}
          active={board.stageTotals.qc.activeTotal}
          caption="ผลิตครบแล้ว · รอตรวจ"
          empty="ไม่มีงานรอตรวจ QC"
        >
          {board.qcQueue.slice(0, VISIBLE_ROWS).map((item) => (
            <QueueRow
              key={item.key}
              orderNumber={item.orderNumber}
              customerName={item.customerName}
              deadline={item.deadline}
              status="รอตรวจ"
              progress={`${item.totalQuantity} ตัว`}
            />
          ))}
          <MoreJobs
            count={board.stageTotals.qc.total - Math.min(board.qcQueue.length, VISIBLE_ROWS)}
          />
        </StagePanel>

        <StagePanel
          number={5}
          icon={PackageCheck}
          title="แพ็กสุดท้าย"
          count={board.stageTotals.pack.total}
          active={board.stageTotals.pack.activeTotal}
          caption="ผ่าน QC แล้ว · รอแพ็ก"
          empty="ไม่มีงานรอแพ็ก"
        >
          {board.packQueue.slice(0, VISIBLE_ROWS).map((item) => (
            <QueueRow
              key={item.stepId}
              orderNumber={item.orderNumber}
              customerName={item.customerName}
              deadline={item.deadline}
              status={item.blindShip ? "Blind ship" : "รอแพ็ก"}
              progress={`${item.totalQuantity} ตัว`}
              danger={item.blindShip}
            />
          ))}
          <MoreJobs
            count={board.stageTotals.pack.total - Math.min(board.packQueue.length, VISIBLE_ROWS)}
          />
        </StagePanel>
      </section>

      <BoardRail board={board} />
    </main>
  );
}

function BoardHeader({
  board,
  stale,
  updatedAt,
  isFetching,
}: {
  board: Board;
  stale: boolean;
  updatedAt: number;
  isFetching: boolean;
}) {
  const workInProcess =
    board.stageTotals.prep.total +
    board.stageTotals.dtf.total +
    board.stageTotals.press.total +
    board.stageTotals.qc.total +
    board.stageTotals.pack.total;

  return (
    <header className="flex min-h-14 items-center gap-4 border-b border-divider pb-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-module-production-text" aria-hidden="true">
        <Factory className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold text-strong">สถานะการผลิตทั้งโรงงาน</h1>
        <p className="mt-0.5 text-sm text-muted">เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็กสุดท้าย</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-5">
        <div className="text-right">
          <p className="text-xs text-muted">งานในสาย</p>
          <p className="text-2xl font-semibold tabular-nums text-strong">{workInProcess}</p>
        </div>
        <div className="h-9 w-px bg-divider" />
        <div className="text-right tabular-nums">
          <p className="text-base font-medium text-strong">{formatDateShort(board.generatedAt)}</p>
          <ProductionFreshness
            updatedAt={updatedAt}
            isFetching={isFetching}
            stale={stale}
            liveSurface
            className="justify-end"
          />
        </div>
      </div>
    </header>
  );
}

function StagePanel({
  number,
  icon: Icon,
  title,
  count,
  active,
  caption,
  empty,
  children,
}: {
  number: number;
  icon: ComponentType<{ className?: string }>;
  title: string;
  count: number;
  active: number;
  caption: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <article className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-divider bg-surface-muted px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-xs font-semibold tabular-nums text-muted">
            {number}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
          <h2 className="min-w-0 truncate text-base font-semibold text-strong">{title}</h2>
          <span className="ml-auto text-2xl font-semibold tabular-nums text-strong">{count}</span>
        </div>
        <p className="mt-1.5 truncate text-xs text-muted">
          {active > 0 ? (
            <span className="font-medium text-blue-300">{active} กำลังทำ</span>
          ) : (
            caption
          )}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border px-2 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-400" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted">{empty}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </article>
  );
}

function DtfQueueRows({ board }: { board: Board }) {
  const activeRows = board.activeRuns.flatMap((run) =>
    run.jobs.map((job, index) => ({
      key: `${run.runNumber}:${job.orderNumber}:${index}`,
      orderNumber: job.orderNumber,
      customerName: job.customerName,
      deadline: null,
      status: `${run.status === "PRINTING" ? "กำลังพิมพ์" : "รอตัดแยก"} · ${run.runNumber}`,
      progress: `${job.qty} ตัว`,
      active: true,
    })),
  );
  const queuedRows = board.printQueue.map((item) => ({
    key: item.stepId,
    orderNumber: item.orderNumber,
    customerName: item.customerName,
    deadline: item.deadline,
    status: "คิวพิมพ์",
    progress: `${item.remaining} ตัว`,
    active: false,
  }));
  const visibleRows = [...activeRows, ...queuedRows].slice(0, VISIBLE_ROWS);

  return (
    <>
      {visibleRows.map((row) => (
        <QueueRow
          key={row.key}
          orderNumber={row.orderNumber}
          customerName={row.customerName}
          deadline={row.deadline}
          status={row.status}
          progress={row.progress}
          active={row.active}
        />
      ))}
      <MoreJobs count={board.stageTotals.dtf.total - visibleRows.length} />
    </>
  );
}

function QueueRow({
  orderNumber,
  customerName,
  deadline,
  status,
  progress,
  assignee,
  active = false,
  danger = false,
}: {
  orderNumber: string;
  customerName: string;
  deadline: Date | string | null;
  status: string;
  progress?: string | null;
  assignee?: string | null;
  active?: boolean;
  danger?: boolean;
}) {
  const overdue = isOverdue(deadline);
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-2.5 py-2",
        danger
          ? "border-red-500/50 bg-red-500/10"
          : active
            ? "border-blue-500/40 bg-blue-500/10"
            : "border-border bg-bg/45",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 text-sm font-semibold tabular-nums text-strong">{orderNumber}</span>
        {overdue && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" title="เลยกำหนด" />}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted">
        {customerName}
        {assignee ? ` · ${assignee}` : ""}
      </p>
      <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 text-2xs">
        <span
          className={cn(
            "truncate",
            danger ? "font-medium text-red-300" : active ? "text-blue-300" : "text-secondary",
          )}
        >
          {status}
        </span>
        <span
          className={cn(
            "shrink-0 tabular-nums",
            overdue ? "font-medium text-red-300" : "text-muted",
          )}
        >
          {progress || (deadline ? `ส่ง ${formatDateShort(deadline)}` : "—")}
        </span>
      </div>
    </div>
  );
}

function BoardRail({ board }: { board: Board }) {
  const problemAlerts = board.problems.map((item) => ({
    key: `problem:${item.stepId}`,
    orderNumber: item.orderNumber,
    label: `${item.status === "FAILED" ? "งานเสีย" : "พักงาน"} · ${item.stepLabel}`,
    detail: item.assignedToName || item.customerName,
    danger: true,
  }));
  const priorityAlerts = board.urgentOrders.map((item) => ({
    key: `urgent:${item.orderId}`,
    orderNumber: item.orderNumber,
    label:
      item.priority === "URGENT" && isOverdue(item.deadline)
        ? "งานด่วน · เลยกำหนด"
        : item.priority === "URGENT"
          ? "งานด่วน"
          : "เลยกำหนดส่ง",
    detail: item.customerName,
    danger: isOverdue(item.deadline),
  }));
  const alerts = [
    // ช่องมีเพียง 4 แถว: กันพื้นที่อย่างน้อยอย่างละ 2 ให้ "ด่วน/เลยกำหนด" และ "ติดปัญหา"
    // เพื่อไม่ให้ปัญหากลุ่มใดกลุ่มหนึ่งบังอีกกลุ่มทั้งหมด
    ...priorityAlerts.slice(0, 2),
    ...problemAlerts.slice(0, 2),
    ...priorityAlerts.slice(2),
    ...problemAlerts.slice(2),
    ...board.outsourceDue.map((item) => ({
      key: `outsource:${item.orderNumber}:${item.vendorName}`,
      orderNumber: item.orderNumber,
      label: `ตามของจาก ${item.vendorName}`,
      detail: item.customerName,
      danger: false,
    })),
    ...board.dueSoon.map((item) => ({
      key: `due:${item.orderNumber}`,
      orderNumber: item.orderNumber,
      label: isOverdue(item.deadline)
        ? "เลยกำหนดส่ง"
        : item.deadline
          ? `ส่ง ${formatDateShort(item.deadline)}`
          : "ใกล้กำหนดส่ง",
      detail: item.customerName,
      danger: isOverdue(item.deadline),
    })),
  ];

  return (
    <section
      aria-label="งานที่ต้องจัดการและงานพร้อมส่ง"
      className="grid h-36 shrink-0 grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2.5"
    >
      <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn("h-4 w-4", board.alertTotal > 0 ? "text-yellow-300" : "text-green-400")}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-strong">ด่วน / ติดปัญหา</h2>
          <span className="ml-auto text-sm font-semibold tabular-nums text-secondary">{board.alertTotal}</span>
        </div>
        {board.alertTotal === 0 ? (
          <p className="mt-5 text-center text-sm text-muted">ไม่มีงานติดขัดหรือใกล้กำหนดส่ง</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {alerts.slice(0, 4).map((item) => (
              <div key={item.key} className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    item.danger ? "bg-red-400" : "bg-yellow-300",
                  )}
                />
                <span className="shrink-0 text-xs font-semibold tabular-nums text-strong">{item.orderNumber}</span>
                <span className={cn("min-w-0 truncate text-xs", item.danger ? "text-red-300" : "text-yellow-200")}>
                  {item.label}
                </span>
                <span className="ml-auto hidden max-w-28 truncate text-2xs text-muted xl:block">{item.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-lg border border-green-500/35 bg-green-500/10 p-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-green-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-green-200">ผลลัพธ์ · พร้อมส่ง</h2>
          <span className="ml-auto text-2xl font-semibold tabular-nums text-green-300">{board.readyToShipTotal}</span>
        </div>
        {board.readyToShipTotal === 0 ? (
          <p className="mt-4 text-center text-sm text-green-200/70">ยังไม่มีงานที่แพ็กครบพร้อมส่ง</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {board.readyToShip.slice(0, 5).map((item) => (
              <span
                key={item.key}
                className="rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold tabular-nums text-green-200"
              >
                {item.orderNumber}
              </span>
            ))}
            {board.readyToShipTotal > Math.min(board.readyToShip.length, 5) && (
              <span className="px-1 py-1 text-xs text-green-200/70">
                + อีก {board.readyToShipTotal - Math.min(board.readyToShip.length, 5)}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function progressText(done: number, total: number | null): string | null {
  if (total == null) return done > 0 ? `${done} ตัว` : null;
  return `${done}/${total}`;
}

function MoreJobs({ count }: { count: number }) {
  if (count <= 0) return null;
  return <p className="px-1 text-xs font-medium text-muted">+ อีก {count} งานในคิว</p>;
}

function FactoryBoardLoading() {
  return (
    <main className="flex h-dvh min-h-[640px] flex-col gap-3 overflow-hidden p-4" aria-busy="true">
      <div className="h-14 animate-pulse rounded-lg bg-surface" />
      <div className="grid min-h-0 flex-1 grid-cols-5 gap-2.5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
      <div className="h-36 animate-pulse rounded-lg bg-surface" />
      <span className="sr-only">กำลังโหลดสถานะการผลิต</span>
    </main>
  );
}
