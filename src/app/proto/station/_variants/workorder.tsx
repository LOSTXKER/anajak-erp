"use client";

/**
 * C · ใบผลิตเป็นศูนย์กลาง — ไม่มีจอสถานีแยก: หน้าการผลิต `/production` ที่เบสเคาะแล้ว เปิดบนจอทัช
 *   → กรองสถานี (ชิปเดิม `?station=`) → การ์ดใหญ่ → กดเข้าใบผลิต `/production/[id]` แบบ D ที่เบสเคาะ ในโหมดจอทัช
 *   หัวหน้าแก้ให้จากในใบผลิต (ปุ่ม "มอบหมาย / จัดการขั้นที่เลือก" ที่มีอยู่แล้ว)
 * วิธีคิด: ไม่เพิ่มหน้าใหม่เลย ทุกคนใช้ 2 หน้าเดิม ต่างกันแค่ขนาดปุ่มและสิทธิ์
 * ใช้ component ของหน้าลองที่เคาะแล้วตรง ๆ (production-module แบบ A · work-order แบบ D) — ไม่วาดเลียน
 */

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { STATIONS as MODULE_STATIONS, productionJobs, type StationKey as ModuleStationKey } from "../../production-module/_data";
import { TouchJobCard } from "../../production-module/_pieces";
import { TabsVariant } from "../../work-order/_variants/tabs";
import { BOSS, STATIONS, meAt, stationOf, type StationKey } from "../_data";
import { STATION_ICON, StationShell, type ProtoNav, type Role } from "../_pieces";

/** สถานีของจอนี้ → ชิปสถานีของหน้าการผลิต (ที่ยังเป็น 5 ค่าตายตัว) — สถานีที่หน้าการผลิตไม่รู้จัก = ไม่มีทางเข้า */
const TO_MODULE: Partial<Record<StationKey, ModuleStationKey>> = {
  prep: "prep",
  dtf: "dtf-print",
  press: "heat-press",
  qc: "qc",
  pack: "pack",
};

export function WorkOrderVariant({ role, empty, nav }: { role: Role; empty: boolean; nav: ProtoNav }) {
  const boss = role === "boss";
  const who = boss ? BOSS : meAt(nav.station);
  const station = stationOf(nav.station);

  if (nav.screen === "job") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="lg" className="h-12" onClick={() => nav.setScreen("queue")}>
            <ChevronLeft /> กลับหน้าการผลิต
          </Button>
          <p className="text-sm text-secondary">
            {boss ? "หัวหน้าเห็นใบผลิตเต็ม — แก้ให้ผ่านปุ่ม “มอบหมาย / จัดการขั้นที่เลือก”" : "ช่างเห็นใบผลิตใบเดียวกับหัวหน้า — ต้องหาแท็บ “ขั้นงาน” แล้วเลือกขั้นของตัวเองเอง"}
          </p>
        </div>
        <TabsVariant touch={!boss} />
      </div>
    );
  }

  const moduleKey = TO_MODULE[nav.station];
  const jobs = empty || !moduleKey ? [] : productionJobs(false).filter((job) => job.station === moduleKey);
  const moduleStation = MODULE_STATIONS.find((s) => s.key === moduleKey);
  const Icon = STATION_ICON[nav.station];

  return (
    <StationShell
      title={
        <span className="inline-flex items-center gap-2">
          <Icon className="h-6 w-6 text-strong" strokeWidth={1.75} aria-hidden="true" /> การผลิต — {station.label}
        </span>
      }
      eyebrow={boss ? "หน้าการผลิตเดิม (โต๊ะงานหัวหน้า) บนคอม" : "หน้าการผลิตเดิม เปิดบนจอทัช · โหมดหน้างาน"}
      who={who}
      boss={boss}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {STATIONS.map((s) => (
            <FilterChip key={s.key} selected={s.key === nav.station} onClick={() => nav.setStation(s.key)} className="min-h-11 px-4 text-base">
              {s.short}
            </FilterChip>
          ))}
        </div>
        {!moduleKey ? (
          <EmptyState
            icon={Icon}
            title={`หน้าการผลิตยังไม่มีชิป “${station.label}”`}
            description="สถานีที่เพิ่มจากหน้าตั้งค่าไม่ขึ้นเองในหน้านี้ — ต้องแก้โค้ดชิปสถานีทุกครั้งที่เพิ่มสถานี (นี่คือข้อแลกของทาง C)"
          />
        ) : jobs.length === 0 ? (
          <EmptyState icon={Icon} title={`ไม่มีงานที่${station.label}`} description="งานจะโผล่เมื่อขั้นก่อนหน้าปิด" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {jobs.map((job) => (
              // การ์ดของหน้าลองโมดูลผลิตเป็น <li> ที่ไม่มี onOpen — ครอบด้วยชั้นกดได้ชั้นเดียว ไม่ทำลายโครงการ์ด
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                aria-label={`เปิดใบผลิต ${job.orderNumber}`}
                className="cursor-pointer"
                onClick={() => {
                  nav.setJobId(job.id);
                  nav.setScreen("job");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    nav.setJobId(job.id);
                    nav.setScreen("job");
                  }
                }}
              >
                <ul className="contents">
                  <TouchJobCard job={job} action={moduleStation?.action ?? station.action} />
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </StationShell>
  );
}
