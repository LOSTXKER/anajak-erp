"use client";

/**
 * จอสถานี `/station` — แบบ A "หยิบงานเอง" (เบสเคาะ 2026-09-03 จากหน้าลอง /proto/station)
 *
 *   ชั้น 1 เลือกสถานี (ช่าง) / แผงสถานีทั้งโรงงาน (หัวหน้า)  →  ชั้น 2 คิวของสถานี 3 กลุ่ม  →  ชั้น 3 หน้าลงมือ (station-job)
 *   ข้อมูล: factory.stationQueue (no-money โดยโครงสร้าง) → buildProductionBoard สูตรเดิม → lib/station-desk
 *   สถานะการเดินอยู่ใน URL: ?st=<สถานี> &s=job &job=<productionId> &step=<stepId> (&fix=1 = หัวหน้ากดแก้ให้จากคิว)
 *   สถานีที่ช่างเลือกล่าสุดจำไว้ในเครื่อง (localStorage) — จอเดิมเปิดมาก็อยู่สถานีเดิม
 */

import { Suspense, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Factory, ShieldX } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { createClient } from "@/lib/supabase";
import { useListPageState } from "@/hooks/use-list-page-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { buildProductionBoard } from "@/lib/production-board";
import { daysFromNow } from "@/lib/production-desk";
import { resolveStation, stationCards, stationCounts, stationDefs, stationQueue, visibleCards } from "@/lib/station-desk";
import { formatDate, formatDateTime } from "@/lib/utils";
import { QueueGroups, StationIcon, StationShell, StationTile, WhoChip } from "./station-pieces";
import { StationJob } from "./station-job";

type QueueOrder = RouterOutput["factory"]["stationQueue"][number];
type QueueStep = QueueOrder["productions"][number]["steps"][number];

const REMEMBER_KEY = "anajak.station";

function rememberStation(key: string | null) {
  try {
    if (key) window.localStorage.setItem(REMEMBER_KEY, key);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* โหมดส่วนตัว/บล็อกที่เก็บ — ไม่จำก็ยังใช้ได้ */
  }
}

function rememberedStation(): string | null {
  try {
    return window.localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

function Screen() {
  const list = useListPageState();
  const router = useRouter();
  const st = list.searchParams.get("st");
  const screen = list.searchParams.get("s");
  const jobId = list.searchParams.get("job");
  const stepId = list.searchParams.get("step");
  const autoFix = list.searchParams.get("fix") === "1";

  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const queueQuery = trpc.factory.stationQueue.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const orders = queueQuery.data;

  const canSupervise = !!me && permAllows(me.permissions, "supervise_operations");
  const canProduce = !!me && permAllows(me.permissions, "manage_production");
  const viewer = useMemo(() => ({ id: me?.id ?? null, canSupervise }), [me?.id, canSupervise]);

  // now อ้างจากเวลาที่ข้อมูลอัปเดตล่าสุด ไม่ใช่ new Date() สด (react-compiler + SSR)
  const now = useMemo(() => (queueQuery.dataUpdatedAt > 0 ? new Date(queueQuery.dataUpdatedAt) : new Date(0)), [queueQuery.dataUpdatedAt]);
  const board = useMemo(
    () => buildProductionBoard<QueueStep, QueueOrder>(orders ?? [], { now, viewerId: me?.id, showBlocked: true }),
    [orders, now, me?.id],
  );
  const defs = useMemo(() => stationDefs(board), [board]);
  const station = resolveStation(st, defs);
  const clock = queueQuery.dataUpdatedAt > 0 ? formatDateTime(new Date(queueQuery.dataUpdatedAt)) : null;

  // ช่างเปิดจอมาแล้วอยู่สถานีเดิมเลย (หัวหน้าเปิดมาเจอแผงทั้งโรงงานเสมอ)
  useEffect(() => {
    if (st || !me || canSupervise || !orders) return;
    const saved = rememberedStation();
    if (saved && defs.some((def) => def.key === saved)) list.replaceListState({ st: saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- list เป็น object ใหม่ทุก render · อ่านครั้งเดียวตอนพร้อม
  }, [st, me, canSupervise, orders, defs]);

  const pickStation = (key: string) => {
    rememberStation(key);
    list.replaceListState({ st: key, s: null, job: null, step: null, fix: null });
  };
  const changeUser = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    rememberStation(null);
    router.replace("/login?next=/station");
    router.refresh();
  };
  const who = <WhoChip name={me?.name ?? "…"} boss={canSupervise} onChange={me ? () => void changeUser() : undefined} />;

  /* ── โหลด / พัง / ไม่มีสิทธิ์ ── */
  if (meQuery.isLoading || (queueQuery.isLoading && !orders)) {
    return (
      <StationShell title="จอสถานี" who={who}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </StationShell>
    );
  }
  if (meQuery.isError && !me) {
    return (
      <StationShell title="จอสถานี" who={who}>
        <EmptyState icon={AlertTriangle} title="โหลดสิทธิ์ไม่สำเร็จ" action={<Button size="lg" onClick={() => meQuery.refetch()}>ลองใหม่</Button>} />
      </StationShell>
    );
  }
  if (!canProduce) {
    return (
      <StationShell title="จอสถานี" who={who}>
        <EmptyState icon={ShieldX} title="บัญชีนี้ไม่มีสิทธิ์งานผลิต" description="จอสถานีใช้ได้เฉพาะบัญชีที่มีสิทธิ์งานผลิต — เปลี่ยนคนที่มุมขวาบน" />
      </StationShell>
    );
  }
  if (queueQuery.isError && !orders) {
    return (
      <StationShell title="จอสถานี" who={who}>
        <EmptyState icon={AlertTriangle} title="โหลดคิวงานไม่สำเร็จ" action={<Button size="lg" onClick={() => queueQuery.refetch()}>ลองใหม่</Button>} />
      </StationShell>
    );
  }
  const stale = queueQuery.isError && Boolean(orders);
  const staleAlert = stale ? (
    <Alert variant="warning" title="ข้อมูลล่าสุดอาจยังไม่ครบ" className="mb-4">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span>กำลังแสดงคิวเดิมที่โหลดไว้</span>
        <Button variant="ghost" size="sm" onClick={() => queueQuery.refetch()}>
          ลองใหม่
        </Button>
      </span>
    </Alert>
  ) : null;

  /* ── ชั้น 3: หน้าลงมือ ── */
  if (station && screen === "job" && jobId) {
    return (
      <StationJob
        productionId={jobId}
        stepId={stepId}
        station={station}
        boss={canSupervise}
        autoFix={autoFix && canSupervise}
        onBack={() => list.replaceListState({ s: null, job: null, step: null, fix: null })}
        who={who}
        clock={clock}
      />
    );
  }

  /* ── ชั้น 1: เลือกสถานี / แผงสถานี ── */
  if (!station) {
    const counts = stationCounts(board, viewer);
    return (
      <StationShell title={canSupervise ? "แผงสถานี — ทั้งโรงงาน" : "วันนี้คุณอยู่สถานีไหน"} eyebrow={canSupervise ? "โหมดหัวหน้า — เห็นทุกคน แก้ให้ได้ทุกใบ" : "จอสถานี"} who={who} clock={clock}>
        {staleAlert}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {counts.map((count) => {
            const doingBy = [...new Set(stationCards(board, count).filter((card) => card.state === "doing").map((card) => card.owner?.name).filter((name): name is string => Boolean(name)))];
            return <StationTile key={count.key} count={count} doingBy={doingBy} boss={canSupervise} onPick={() => pickStation(count.key)} />;
          })}
        </div>
        {canSupervise ? (
          <p className="mt-6 text-sm text-secondary">
            สถานีตามสายงานในใบผลิต — ตรวจ QC และแพ็กสุดท้ายยังทำในหน้าออเดอร์ (กดการ์ดแล้วไปต่อได้) · โต๊ะงานหัวหน้าอยู่ที่{" "}
            <Button variant="link" className="h-auto p-0 text-sm" onClick={() => router.push("/production")}>
              หน้าการผลิต
            </Button>
          </p>
        ) : null}
      </StationShell>
    );
  }

  /* ── ชั้น 2: คิวของสถานี ── */
  const queue = stationQueue(visibleCards(stationCards(board, station), viewer));
  const openCard = (card: (typeof queue.ready)[number], fix = false) => {
    if (card.spot.productionId && card.step) {
      list.replaceListState({ s: "job", job: card.spot.productionId, step: card.step.id, fix: fix ? "1" : null });
      return;
    }
    // ช่วงหลังผลิต (QC / แพ็ก) ยังไม่มีหน้าลงมือบนจอนี้ — ไปทำในหน้าออเดอร์ (ROADMAP §A2)
    router.push(`/orders/${card.job.order.id}`);
  };
  return (
    <StationShell
      title={
        <span className="inline-flex items-center gap-2">
          <StationIcon stationKey={station.key} className="h-6 w-6 text-strong" /> {station.label}
        </span>
      }
      eyebrow={canSupervise ? "โหมดหัวหน้า — แก้ให้ได้ทุกใบ" : "งานที่สถานีนี้"}
      onBack={() => {
        if (!canSupervise) rememberStation(null);
        list.replaceListState({ st: null, s: null, job: null, step: null, fix: null });
      }}
      backLabel={canSupervise ? "แผงสถานี" : "เปลี่ยนสถานี"}
      right={
        canSupervise ? (
          <div className="hidden overflow-x-auto lg:block">
            <SegmentedControl options={defs.map((def) => ({ value: def.key, label: def.label }))} value={station.key} onChange={pickStation} aria-label="สลับสถานี" size="sm" className="min-w-max" />
          </div>
        ) : null
      }
      who={who}
      clock={clock}
    >
      {staleAlert}
      {station.kind === "post" ? (
        <Alert variant="info" className="mb-4" title={`${station.label}ทำในหน้าออเดอร์`}>
          กดการ์ดแล้วจะเปิดหน้าออเดอร์ของงานนั้น — หน้าลงมือของ QC/แพ็กบนจอนี้จะตามมารุ่นถัดไป
        </Alert>
      ) : null}
      <QueueGroups
        queue={queue}
        station={station}
        showOwner={canSupervise}
        dueOf={(card) => ({ dueInDays: daysFromNow(card.job.order.deadline, now), dateLabel: card.job.order.deadline ? formatDate(card.job.order.deadline) : null })}
        onOpen={(card) => openCard(card)}
        extra={
          canSupervise
            ? (card) =>
                card.step ? (
                  <Button variant="outline" size="lg" className="h-12" onClick={() => openCard(card, true)}>
                    แก้ให้
                  </Button>
                ) : null
            : undefined
        }
        emptyAction={
          canSupervise ? (
            <Button variant="outline" size="lg" onClick={() => router.push("/production")}>
              <Factory /> ไปหน้าการผลิต
            </Button>
          ) : undefined
        }
      />
    </StationShell>
  );
}

export function StationScreen() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-40 rounded-2xl" /></div>}>
      <Screen />
    </Suspense>
  );
}
