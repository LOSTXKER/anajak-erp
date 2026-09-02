"use client";

/**
 * B · หัวหน้าจ่ายงาน — ช่างไม่ต้องเลือกอะไรเลย: จอของช่างมี "งานของฉันตอนนี้" ใบเดียว + ถัดไป
 *   หัวหน้ามี "กระดานจ่ายงาน" ทุกสถานีเป็นคอลัมน์ ลากลำดับ (ปุ่ม ▲▼) จ่ายให้คน แก้ให้ในที่เดียว
 * วิธีคิด: ตัดโอกาสกดมั่วตั้งแต่ต้น — ช่างเห็นแค่ใบที่หัวหน้าจ่าย · หัวหน้าเป็นคนคุมคิวทุกสถานี
 */

import { useState } from "react";
import { ArrowDown, ArrowUp, BellRing, Hand, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Select } from "@/components/ui/select";
import { DASHED, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { BigMockup } from "../../_kit/pieces";
import { BOSS, STATIONS, assignedTo, jobById, meAt, queueAt, stationOf, workersAt, type StationJob } from "../_data";
import { FixDialog, JobScreen, STATION_ICON, StateChip, StationShell, WorkerChips, type ProtoNav, type Role } from "../_pieces";

/* ───────────────────────── ช่าง: งานของฉันใบเดียว ───────────────────────── */

function WorkerView({ empty, nav }: { empty: boolean; nav: ProtoNav }) {
  const me = meAt(nav.station);
  const mine = assignedTo(me, empty);
  const current = (nav.screen === "job" ? jobById(nav.jobId) : undefined) ?? mine[0];
  const next = mine.filter((j) => j.id !== current?.id).slice(0, 2);

  if (!current) {
    return (
      <StationShell title={`งานของ ${me.name}`} eyebrow="หัวหน้าจ่ายงานให้แล้วจะขึ้นที่นี่" who={me}>
        <EmptyState
          icon={Hand}
          title="ยังไม่มีงานจ่ายมา"
          description="หัวหน้ายังไม่ได้จ่ายงานให้คุณ — กดปุ่มข้างล่างเพื่อบอกว่าว่างแล้ว"
          action={
            <Button size="lg" className="h-14 text-base">
              <BellRing /> บอกหัวหน้าว่าว่างแล้ว
            </Button>
          }
        />
      </StationShell>
    );
  }
  const station = stationOf(current.station);
  return (
    <StationShell title={current.orderNumber} eyebrow={`งานของ ${me.name} — ${station.label} · ${current.stepLabel}`} who={me}>
      <div className="space-y-6">
        <JobScreen job={current} />
        <section aria-label="งานถัดไป" className="space-y-2">
          <p className="text-sm font-medium text-strong">ถัดไป — หัวหน้าจัดลำดับไว้แล้ว</p>
          {next.length === 0 ? (
            <p className="text-sm text-secondary">หมดคิวของคุณแล้ว เสร็จใบนี้แล้วบอกหัวหน้าได้เลย</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {next.map((job, i) => (
                <li key={job.id} className={cn("flex items-center gap-3 p-3", SUNK_PANEL, RADIUS.surface)}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold tabular-nums text-strong">{i + 1}</span>
                  <BigMockup src={job.mockup} alt="" className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tabular-nums text-strong">{job.orderNumber}</p>
                    <p className="truncate text-sm text-secondary">
                      {stationOf(job.station).label} · {job.qty.toLocaleString("th-TH")} ตัว
                    </p>
                  </div>
                  <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </StationShell>
  );
}

/* ───────────────────────── หัวหน้า: กระดานจ่ายงาน ───────────────────────── */

function BoardCard({ job, onFix, onOpen }: { job: StationJob; onFix: () => void; onOpen: () => void }) {
  const workers = workersAt(job.station);
  return (
    <li className={cn("card-surface space-y-3 p-3", RADIUS.surface, job.problem && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40")}>
      <div className="flex gap-3">
        <BigMockup src={job.mockup} alt="" className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="text-left font-semibold tabular-nums text-strong underline-offset-2 hover:underline">
            {job.orderNumber}
          </button>
          <p className="truncate text-sm text-secondary">{job.company}</p>
          <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
            <Metric value={job.qty.toLocaleString("th-TH")} unit="ตัว" size="sm" />
            <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="sm" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button variant="outline" size="icon-sm" aria-label="เลื่อนขึ้น">
            <ArrowUp />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="เลื่อนลง">
            <ArrowDown />
          </Button>
        </div>
      </div>
      <InfoChipRow>
        <StateChip job={job} size="sm" />
        {job.urgent ? <Badge variant="destructive">ด่วน</Badge> : null}
        {job.problem ? (
          <InfoChip size="sm" tone="error" strong title={job.problem.detail}>
            {job.problem.title}
          </InfoChip>
        ) : null}
      </InfoChipRow>
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <Select size="sm" value={job.owner ?? ""} onChange={() => undefined} placeholder="จ่ายให้…" aria-label="จ่ายงานให้" className="flex-1">
          {workers.map((w) => (
            <option key={w.id} value={w.name}>
              {w.name}
            </option>
          ))}
          {job.owner && !workers.some((w) => w.name === job.owner) ? <option value={job.owner}>{job.owner}</option> : null}
        </Select>
        <Button variant="outline" size="sm" onClick={onFix}>
          แก้ให้
        </Button>
      </div>
    </li>
  );
}

function BossBoard({ empty, nav }: { empty: boolean; nav: ProtoNav }) {
  const [fixJob, setFixJob] = useState<StationJob | null>(null);
  return (
    <StationShell title="กระดานจ่ายงาน — ทุกสถานี" eyebrow="โหมดหัวหน้า · ลำดับบนสุด = ใบที่ช่างเห็นก่อน" who={BOSS} boss>
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3 px-1">
          {STATIONS.map((station) => {
            const q = queueAt(station.key, empty);
            const jobs = [...q.doing, ...q.ready, ...q.blocked];
            const Icon = STATION_ICON[station.key];
            return (
              <section key={station.key} aria-label={station.label} className={cn("flex w-72 shrink-0 flex-col gap-3 p-3", SUNK_PANEL, RADIUS.surface)}>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-base font-semibold text-strong">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    {station.label}
                    <span className="ml-auto text-sm font-normal tabular-nums text-muted">{jobs.length}</span>
                  </p>
                  <WorkerChips workers={workersAt(station.key)} size="sm" />
                </div>
                {jobs.length === 0 ? (
                  <div className={cn("flex min-h-24 items-center justify-center p-3 text-center text-sm text-muted", DASHED, RADIUS.inner)}>ไม่มีงาน</div>
                ) : (
                  <ul className="space-y-2">
                    {jobs.map((job) => (
                      <BoardCard
                        key={job.id}
                        job={job}
                        onFix={() => setFixJob(job)}
                        onOpen={() => {
                          nav.setStation(job.station);
                          nav.setJobId(job.id);
                          nav.setScreen("job");
                        }}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <FixDialog job={fixJob} open={fixJob !== null} onClose={() => setFixJob(null)} />
    </StationShell>
  );
}

export function DispatchVariant({ role, empty, nav }: { role: Role; empty: boolean; nav: ProtoNav }) {
  const [fixJob, setFixJob] = useState<StationJob | null>(null);
  if (role === "worker") return <WorkerView empty={empty} nav={nav} />;
  if (nav.screen === "job") {
    const job = jobById(nav.jobId);
    if (job) {
      return (
        <StationShell title={job.orderNumber} eyebrow={`หัวหน้าเปิดดู — ${stationOf(job.station).label} · ${job.stepLabel}`} who={BOSS} boss onBack={() => nav.setScreen("pick")} backLabel="กระดาน">
          <JobScreen job={job} boss onFix={() => setFixJob(job)} />
          <FixDialog job={fixJob} open={fixJob !== null} onClose={() => setFixJob(null)} />
        </StationShell>
      );
    }
  }
  return <BossBoard empty={empty} nav={nav} />;
}
