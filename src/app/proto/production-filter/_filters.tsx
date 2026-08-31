"use client";

/**
 * สิ่งที่กำลังเทียบ = "แถบกรองเหนือตาราง" เท่านั้น · ตารางข้างล่างเป็นชุดเดียวกันทุกแบบ
 * (แบบ C ที่เบสเคาะไปแล้ว) เพื่อให้เห็นชัดว่าต่างกันแค่แถบกรองจริง ๆ
 *
 * ทุกแบบใช้ FilterChip / Select ตัวจริงของระบบ และสีหมวดชุดเดียวกับหน้าจริง
 */

import {
  AlertTriangle,
  ClipboardCheck,
  Factory,
  ListFilter,
  PackageCheck,
  Timer,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { FilterChip } from "@/components/ui/filter-chip";
import { Select } from "@/components/ui/select";
import { STATION_ALL, STATION_QUEUE } from "@/lib/production-board";
import { cn } from "@/lib/utils";

import { LENSES, LENS_PRESENTATION } from "../production-list/_ui";
import type { WorklistState } from "../production-list/_ui";

const BAR =
  "-mx-1 flex w-full items-center gap-4 overflow-x-auto border-b border-divider px-1";

/* ------------------------------------------------- ของจริงตอนนี้: 5 มุมตามสถานะ */

/** ยกมาจาก production-control-worklist.tsx ตัวจริง — รวมถึงเลขที่ไม่มีพื้นเม็ดแล้ว */
export function LensChips({ state }: { state: WorklistState }) {
  return (
    <div role="group" aria-label="กรองรายการงาน" className={BAR}>
      {LENSES.map((item) => {
        const isOn = state.lens === item.key;
        const tone = LENS_PRESENTATION[item.key];
        const Icon = tone.icon;
        const actionLabel = `${item.label} · ${state.counts[item.key]} งาน · ${
          isOn ? "เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง" : "กดเพื่อกรอง"
        }`;
        return (
          <FilterChip
            key={item.key}
            selected={isOn}
            onClick={() => state.setLens(isOn ? "all" : item.key)}
            aria-label={actionLabel}
            title={actionLabel}
            icon={<Icon className={cn("h-4 w-4", tone.text)} strokeWidth={1.8} />}
          >
            <span className="whitespace-nowrap">{item.label}</span>
            <span className={cn("ml-1 text-2xs font-semibold tabular-nums", tone.text)}>
              {state.counts[item.key]}
            </span>
          </FilterChip>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- A · กรองตามสายงานจริง */

/** ไอคอนตามชนิดของสาย — คิวรอ / สายในบ้าน / ร้านนอก / QC / แพ็ก-ส่ง */
function stationIcon(key: string, isOutsource: boolean): LucideIcon {
  if (key === STATION_QUEUE) return Timer;
  if (key === "post:qc" || key === "legacy:qc") return ClipboardCheck;
  if (key === "post:pack" || key === "post:ship") return PackageCheck;
  return isOutsource ? Truck : Factory;
}

function stationTone(key: string, isOutsource: boolean) {
  if (key === STATION_QUEUE) return "text-muted";
  if (key === "post:qc" || key === "legacy:qc") return LENS_PRESENTATION.qc.text;
  if (key === "post:pack" || key === "post:ship") return LENS_PRESENTATION.packing.text;
  /* สายร้านนอกแยกด้วย "ไอคอนรถ" ไม่ใช่ด้วยสีใหม่ — จานสีของระบบมีแค่
     slate/blue/red/amber/green และสามสีหลังจองไว้ให้ความหมายอื่นแล้ว */
  if (isOutsource) return "text-secondary";
  return LENS_PRESENTATION.production.text;
}

export function StationChips({ state }: { state: WorklistState }) {
  const attention = LENS_PRESENTATION.attention;
  const attentionOn = state.lens === "attention";

  return (
    <div role="group" aria-label="กรองรายการงาน" className={BAR}>
      {/* ทั้งหมด + ต้องจัดการ ยังเป็นมุมข้ามสาย — เป็นคำถามคนละชนิดกับ "อยู่ขั้นไหน" */}
      <FilterChip
        selected={state.station === STATION_ALL && !attentionOn}
        onClick={() => {
          state.setStation(STATION_ALL);
          state.setLens("all");
        }}
        aria-label={`ทั้งหมด · ${state.counts.all} งาน · กดเพื่อล้างตัวกรอง`}
        icon={
          <ListFilter
            className={cn("h-4 w-4", LENS_PRESENTATION.all.text)}
            strokeWidth={1.8}
          />
        }
      >
        <span className="whitespace-nowrap">ทั้งหมด</span>
        <span
          className={cn(
            "ml-1 text-2xs font-semibold tabular-nums",
            LENS_PRESENTATION.all.text,
          )}
        >
          {state.counts.all}
        </span>
      </FilterChip>

      <FilterChip
        selected={attentionOn}
        onClick={() => state.setLens(attentionOn ? "all" : "attention")}
        aria-label={`ต้องจัดการ · ${state.counts.attention} งาน · ${
          attentionOn ? "เลือกอยู่ · กดซ้ำเพื่อล้าง" : "กดเพื่อกรอง"
        }`}
        icon={<AlertTriangle className={cn("h-4 w-4", attention.text)} strokeWidth={1.8} />}
      >
        <span className="whitespace-nowrap">ต้องจัดการ</span>
        <span className={cn("ml-1 text-2xs font-semibold tabular-nums", attention.text)}>
          {state.counts.attention}
        </span>
      </FilterChip>

      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-divider" />

      {state.stations.map((item) => {
        const isOn = state.station === item.key;
        const Icon = stationIcon(item.key, item.isOutsource);
        const tone = stationTone(item.key, item.isOutsource);
        const empty = item.count === 0;
        const actionLabel = `${item.label} · ${item.count} งาน${
          item.overdue > 0 ? ` · เลยกำหนด ${item.overdue}` : ""
        } · ${isOn ? "เลือกอยู่ · กดซ้ำเพื่อล้าง" : "กดเพื่อกรอง"}`;

        return (
          <FilterChip
            key={item.key}
            selected={isOn}
            onClick={() => state.setStation(isOn ? STATION_ALL : item.key)}
            aria-label={actionLabel}
            title={actionLabel}
            className={cn(empty && !isOn && "opacity-45")}
            icon={<Icon className={cn("h-4 w-4", tone)} strokeWidth={1.8} />}
          >
            <span className="whitespace-nowrap">{item.label}</span>
            <span className={cn("ml-1 text-2xs font-semibold tabular-nums", tone)}>
              {item.count}
            </span>
            {/* เลยกำหนดในสายนั้นกี่ใบ — สิ่งที่ชิปแบบเดิมบอกไม่ได้เลย */}
            {item.overdue > 0 ? (
              /* ไม่มีพื้นเม็ด — กติกา "ไม่มีกล่อง" ที่เบสเคาะไว้ 2026-08-31 สีแดงพอแล้ว */
              <span className="ml-1.5 text-2xs font-semibold tabular-nums text-red-700 dark:text-red-300">
                เลย {item.overdue}
              </span>
            ) : null}
          </FilterChip>
        );
      })}
    </div>
  );
}

/* ------------------------------------------- B · สองชิป + ขั้นงานอยู่ในดรอปดาวน์ */

/** ช่องเลือกขั้นงาน — จอกว้างอยู่ท้ายแถบ จอแคบลงมาเต็มบรรทัดข้างล่าง (ของจริงทำแบบเดียวกันกับช่องเรียง) */
function StationSelect({
  state,
  className,
}: {
  state: WorklistState;
  className?: string;
}) {
  return (
    <Select
      value={state.station}
      onChange={(event) => state.setStation(event.target.value)}
      aria-label="กรองตามขั้นงาน"
      shape="pill"
      surface="raised"
      className={className}
    >
      <option value={STATION_ALL}>ทุกขั้นงาน</option>
      {state.stations.map((item) => (
        <option key={item.key} value={item.key}>
          {item.label} ({item.count})
        </option>
      ))}
    </Select>
  );
}

export function TwoChips({ state }: { state: WorklistState }) {
  const attentionOn = state.lens === "attention";
  const attention = LENS_PRESENTATION.attention;

  return (
    <div className="w-full">
      <div className="flex w-full items-center gap-3 border-b border-divider">
        <div
          role="group"
          aria-label="กรองรายการงาน"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-4 overflow-x-auto px-1"
        >
      <FilterChip
        selected={!attentionOn && state.station === STATION_ALL}
        onClick={() => {
          state.setLens("all");
          state.setStation(STATION_ALL);
        }}
        aria-label={`ทั้งหมด · ${state.counts.all} งาน · กดเพื่อล้างตัวกรอง`}
        icon={
          <ListFilter
            className={cn("h-4 w-4", LENS_PRESENTATION.all.text)}
            strokeWidth={1.8}
          />
        }
      >
        <span className="whitespace-nowrap">ทั้งหมด</span>
        <span
          className={cn(
            "ml-1 text-2xs font-semibold tabular-nums",
            LENS_PRESENTATION.all.text,
          )}
        >
          {state.counts.all}
        </span>
      </FilterChip>

      <FilterChip
        selected={attentionOn}
        onClick={() => state.setLens(attentionOn ? "all" : "attention")}
        aria-label={`ต้องจัดการ · ${state.counts.attention} งาน · ${
          attentionOn ? "เลือกอยู่ · กดซ้ำเพื่อล้าง" : "กดเพื่อกรอง"
        }`}
        icon={<AlertTriangle className={cn("h-4 w-4", attention.text)} strokeWidth={1.8} />}
      >
        <span className="whitespace-nowrap">ต้องจัดการ</span>
        <span className={cn("ml-1 text-2xs font-semibold tabular-nums", attention.text)}>
          {state.counts.attention}
        </span>
      </FilterChip>

        </div>
        <span className="hidden shrink-0 pb-1.5 @2xl:block">
          <StationSelect state={state} className="w-44" />
        </span>
      </div>
      <div className="mt-2 @2xl:hidden">
        <StationSelect state={state} className="w-full" />
      </div>
    </div>
  );
}
