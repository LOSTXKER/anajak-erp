"use client";

/**
 * A · หยิบงานเอง — จอสถานีแยก `/station` เต็มจอ 3 ชั้น: เลือกสถานี → คิวของสถานี → หน้าลงมือ
 *   ช่าง: เลือกสถานีที่ตัวเองยืนอยู่ → เห็นคิว 3 กลุ่ม (กำลังทำ / พร้อมทำ / ติด) → กดใบ → ข้อกำหนด + ปุ่มเดียว
 *   หัวหน้า: จอเดียวกัน แต่หน้าแรกเป็น "แผงสถานี" เห็นทุกสถานีพร้อมตัวเลข + ใครอยู่ · ทุกการ์ดมีปุ่ม "แก้ให้"
 * วิธีคิด: ช่างตัดสินใจเองว่าหยิบใบไหน (คิวเรียงให้แล้ว) · หัวหน้าเข้ามาเฉพาะตอนต้องแก้
 */

import { useState } from "react";
import { LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { DASHED, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { BOSS, STATIONS, jobById, meAt, queueAt, stationCounts, stationOf, type StationJob } from "../_data";
import { FixButton, FixDialog, JobScreen, QueueGroups, STATION_ICON, StationShell, StationTile, type ProtoNav, type Role } from "../_pieces";

export function QueueVariant({ role, empty, nav }: { role: Role; empty: boolean; nav: ProtoNav }) {
  const boss = role === "boss";
  const who = boss ? BOSS : meAt(nav.station);
  const station = stationOf(nav.station);
  const [fixJob, setFixJob] = useState<StationJob | null>(null);
  const openFix = (job: StationJob) => setFixJob(job);

  /* ── ชั้น 1: เลือกสถานี (ช่าง) / แผงสถานี (หัวหน้า) ── */
  if (nav.screen === "pick") {
    const counts = stationCounts(empty);
    return (
      <StationShell title={boss ? "แผงสถานี — ทั้งโรงงาน" : "วันนี้คุณอยู่สถานีไหน"} eyebrow={boss ? "โหมดหัวหน้า" : "จอสถานี"} who={who} boss={boss}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {counts.map((c) => (
            <StationTile
              key={c.station.key}
              station={c.station}
              counts={c}
              workers={c.workers}
              boss={boss}
              onPick={() => {
                nav.setStation(c.station.key);
                nav.setScreen("queue");
              }}
            />
          ))}
          {boss ? (
            <div className={cn("flex min-h-[9.5rem] flex-col items-center justify-center gap-2 p-4 text-center", DASHED, RADIUS.surface)}>
              <Plus className="h-6 w-6 text-muted" aria-hidden="true" />
              <p className="text-sm font-medium text-strong">เพิ่มสถานีใหม่</p>
              <p className="text-xs text-secondary">ทำในหน้าตั้งค่า → สูตรขั้นงาน · จอนี้จะขึ้นให้เองโดยไม่ต้องแก้โค้ด</p>
            </div>
          ) : null}
        </div>
      </StationShell>
    );
  }

  /* ── ชั้น 2: คิวของสถานี ── */
  if (nav.screen === "queue") {
    const queue = queueAt(nav.station, empty);
    const Icon = STATION_ICON[nav.station];
    return (
      <StationShell
        title={
          <span className="inline-flex items-center gap-2">
            <Icon className="h-6 w-6 text-strong" strokeWidth={1.75} aria-hidden="true" /> {station.label}
          </span>
        }
        eyebrow={boss ? "โหมดหัวหน้า — แก้ให้ได้ทุกใบ" : "งานที่สถานีนี้"}
        who={who}
        boss={boss}
        onBack={() => nav.setScreen("pick")}
        backLabel={boss ? "แผงสถานี" : "เปลี่ยนสถานี"}
        right={
          boss ? (
            <div className="hidden overflow-x-auto lg:block">
              <SegmentedControl
                options={STATIONS.map((s) => ({ value: s.key, label: s.short }))}
                value={nav.station}
                onChange={(key) => nav.setStation(key)}
                aria-label="สลับสถานี"
                size="sm"
                className="min-w-max"
              />
            </div>
          ) : null
        }
      >
        <QueueGroups
          queue={queue}
          station={station}
          showOwner={boss}
          onOpen={(job) => {
            nav.setJobId(job.id);
            nav.setScreen("job");
          }}
          extra={boss ? (job) => <FixButton onClick={() => openFix(job)} /> : undefined}
        />
        <FixDialog job={fixJob} open={fixJob !== null} onClose={() => setFixJob(null)} />
      </StationShell>
    );
  }

  /* ── ชั้น 3: หน้าลงมือ ── */
  const job = jobById(nav.jobId) ?? queueAt(nav.station, false).doing[0] ?? queueAt(nav.station, false).ready[0];
  if (!job) {
    return (
      <StationShell title={station.label} who={who} boss={boss} onBack={() => nav.setScreen("queue")} backLabel="กลับคิว">
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <LayoutGrid className="h-8 w-8 text-muted" aria-hidden="true" />
          <p className="text-sm text-secondary">ไม่มีใบนี้ในสถานีแล้ว — อาจถูกส่งต่อไปสถานีถัดไป</p>
          <Button variant="outline" size="lg" onClick={() => nav.setScreen("queue")}>
            กลับไปดูคิว
          </Button>
        </div>
      </StationShell>
    );
  }
  return (
    <StationShell title={job.orderNumber} eyebrow={`${station.label} — ${job.stepLabel}`} who={who} boss={boss} onBack={() => nav.setScreen("queue")} backLabel="กลับคิว">
      <JobScreen job={job} boss={boss} onFix={() => openFix(job)} />
      <FixDialog job={fixJob} open={fixJob !== null} onClose={() => setFixJob(null)} />
    </StationShell>
  );
}
