"use client";

/**
 * สิ่งที่กำลังเทียบ = "จะแยกหมวดของขั้นงานยังไง" เท่านั้น
 * ปุ่มทุกปุ่ม ตัวเลข ไอคอน และสี ยกมาจากแถบจริงที่ลงไปแล้วทั้งหมด — ต่างกันแค่การจัดกลุ่ม
 *
 * หมวดของขั้นงาน (เส้นแบ่งจริงของโรงงาน): ก่อนเริ่ม · ในโรงงาน (ทำเอง) ·
 * ร้านนอก (outsource) · หลังผลิต — Anajak ทำเองมีแค่ DTF กับเตรียมเสื้อ ที่เหลือส่งร้าน
 */

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  Factory,
  ListFilter,
  PackageCheck,
  Timer,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { FilterChip } from "@/components/ui/filter-chip";
import { STATION_ALL, STATION_QUEUE } from "@/lib/production-board";
import { cn } from "@/lib/utils";
import type { WorklistStationChip } from "@/lib/production-worklist";

import { LENS_PRESENTATION } from "../production-list/_ui";
import type { WorklistState } from "../production-list/_ui";

/* ------------------------------------------------------------ ของกลางในไฟล์ */

const BAR_BASE = "-mx-1 flex w-full items-center gap-x-4 gap-y-1 px-1";

type StationGroup = "queue" | "factory" | "outsource" | "post";

const GROUP_LABEL: Record<StationGroup, string> = {
  queue: "ก่อนเริ่ม",
  factory: "ในโรงงาน",
  outsource: "ร้านนอก",
  post: "หลังผลิต",
};

function groupOf(chip: WorklistStationChip): StationGroup {
  if (chip.key === STATION_QUEUE) return "queue";
  if (chip.key.startsWith("post:") || chip.key === "legacy:qc") return "post";
  return chip.isOutsource ? "outsource" : "factory";
}

/** คืน element ไม่ใช่ตัว component — react-compiler ห้ามประกอบ component ตอน render */
function stationIconNode(key: string, isOutsource: boolean, tone: string) {
  const Icon: LucideIcon =
    key === STATION_QUEUE
      ? Timer
      : key === "post:qc" || key === "legacy:qc"
        ? ClipboardCheck
        : key === "post:pack" || key === "post:ship"
          ? PackageCheck
          : isOutsource
            ? Truck
            : Factory;
  return <Icon className={cn("h-4 w-4", tone)} strokeWidth={1.8} />;
}

function stationTone(key: string, isOutsource: boolean) {
  if (key === STATION_QUEUE) return "text-muted";
  if (key === "post:qc" || key === "legacy:qc") return LENS_PRESENTATION.qc.text;
  if (key === "post:pack" || key === "post:ship") return LENS_PRESENTATION.packing.text;
  if (isOutsource) return "text-secondary";
  return LENS_PRESENTATION.production.text;
}

/** ปุ่มขั้นงานหนึ่งปุ่ม — เหมือนของจริงทุกจุด รวมถึงเลขแดง "เลย N" */
function StationChip({
  chip,
  state,
}: {
  chip: WorklistStationChip;
  state: WorklistState;
}) {
  const isOn = state.station === chip.key;
  const tone = stationTone(chip.key, chip.isOutsource);
  const actionLabel = `${chip.label} · ${chip.count} งาน${
    chip.overdue > 0 ? ` · เลยกำหนด ${chip.overdue}` : ""
  } · ${isOn ? "เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง" : "กดเพื่อกรอง"}`;

  return (
    <FilterChip
      selected={isOn}
      onClick={() => state.setStation(isOn ? STATION_ALL : chip.key)}
      aria-label={actionLabel}
      title={actionLabel}
      className={cn(chip.count === 0 && !isOn && "opacity-45")}
      icon={stationIconNode(chip.key, chip.isOutsource, tone)}
    >
      <span className="whitespace-nowrap">{chip.label}</span>
      <span className={cn("ml-1 text-2xs font-semibold tabular-nums", tone)}>
        {chip.count}
      </span>
      {chip.overdue > 0 ? (
        <span className="ml-1.5 text-2xs font-semibold tabular-nums text-red-700 dark:text-red-300">
          เลย {chip.overdue}
        </span>
      ) : null}
    </FilterChip>
  );
}

/** ทั้งหมด + ต้องจัดการ — มุมข้ามสาย เหมือนกันทุกแบบ */
function LensChips({ state }: { state: WorklistState }) {
  const attentionOn = state.lens === "attention";
  return (
    <>
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
        icon={
          <AlertTriangle
            className={cn("h-4 w-4", LENS_PRESENTATION.attention.text)}
            strokeWidth={1.8}
          />
        }
      >
        <span className="whitespace-nowrap">ต้องจัดการ</span>
        <span
          className={cn(
            "ml-1 text-2xs font-semibold tabular-nums",
            LENS_PRESENTATION.attention.text,
          )}
        >
          {state.counts.attention}
        </span>
      </FilterChip>
    </>
  );
}

function groupChips(state: WorklistState, group: StationGroup) {
  return state.stations.filter((chip) => groupOf(chip) === group);
}

/* ------------------------------------------------- ของจริงตอนนี้ (ไม่แยกหมวด) */

export function FlatBar({ state }: { state: WorklistState }) {
  return (
    <div
      role="group"
      aria-label="กรองรายการงาน"
      className={cn(
        BAR_BASE,
        "flex-nowrap overflow-x-auto border-b border-divider @2xl:flex-wrap @2xl:overflow-x-visible",
      )}
    >
      <LensChips state={state} />
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-divider" />
      {state.stations.map((chip) => (
        <StationChip key={chip.key} chip={chip} state={state} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------ A · ป้ายกำกับหมวด */

const LABEL_GROUPS: StationGroup[] = ["queue", "factory", "outsource", "post"];

export function LabelledBar({ state }: { state: WorklistState }) {
  return (
    <div
      role="group"
      aria-label="กรองรายการงาน"
      className={cn(
        BAR_BASE,
        "flex-nowrap overflow-x-auto border-b border-divider @2xl:flex-wrap @2xl:overflow-x-visible",
      )}
    >
      <LensChips state={state} />
      {LABEL_GROUPS.map((group) => {
        const chips = groupChips(state, group);
        if (chips.length === 0) return null;
        return (
          <span key={group} className="flex items-center gap-x-4">
            {/* ป้ายหมวดเป็นตัวหนังสือเล็ก ไม่ใช่ปุ่ม — กดไม่ได้โดยตั้งใจ */}
            <span className="shrink-0 border-l border-divider pl-4 text-2xs font-medium uppercase tracking-wide text-muted">
              {GROUP_LABEL[group]}
            </span>
            {chips.map((chip) => (
              <StationChip key={chip.key} chip={chip} state={state} />
            ))}
          </span>
        );
      })}
    </div>
  );
}

/* -------------------------------------------- B · แยกสองแถวตามความถี่ที่ใช้ */

export function TwoRowBar({ state }: { state: WorklistState }) {
  const daily = [
    ...groupChips(state, "queue"),
    ...groupChips(state, "factory"),
    ...groupChips(state, "post"),
  ];
  const outsource = groupChips(state, "outsource");

  return (
    <div className="w-full border-b border-divider">
      <div
        role="group"
        aria-label="กรองรายการงาน"
        className={cn(BAR_BASE, "flex-nowrap overflow-x-auto @2xl:flex-wrap")}
      >
        <LensChips state={state} />
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-divider" />
        {daily.map((chip) => (
          <StationChip key={chip.key} chip={chip} state={state} />
        ))}
      </div>
      <div
        role="group"
        aria-label="กรองงานที่อยู่ร้านนอก"
        className={cn(BAR_BASE, "flex-nowrap overflow-x-auto pb-1 @2xl:flex-wrap")}
      >
        <span className="inline-flex shrink-0 items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          ร้านนอก
          <span className="tabular-nums">
            {state.groupCounts.outsource.count} ใบ
          </span>
        </span>
        {outsource.map((chip) => (
          <StationChip key={chip.key} chip={chip} state={state} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------- C · ยุบร้านนอกเป็นปุ่มเดียว */

export function FoldedBar({ state }: { state: WorklistState }) {
  const outsource = groupChips(state, "outsource");
  const outsourceOn = outsource.some((chip) => chip.key === state.station);
  const [open, setOpen] = useState(false);
  const expanded = open || outsourceOn;
  const { count, overdue } = state.groupCounts.outsource;

  return (
    <div className="w-full border-b border-divider">
      <div
        role="group"
        aria-label="กรองรายการงาน"
        className={cn(BAR_BASE, "flex-nowrap overflow-x-auto @2xl:flex-wrap")}
      >
        <LensChips state={state} />
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-divider" />
        {groupChips(state, "queue").map((chip) => (
          <StationChip key={chip.key} chip={chip} state={state} />
        ))}
        {groupChips(state, "factory").map((chip) => (
          <StationChip key={chip.key} chip={chip} state={state} />
        ))}
        {/* ร้านนอกทั้งหกสายยุบเป็นปุ่มเดียว — นับเป็นจำนวนใบไม่ซ้ำ ไม่ใช่ผลรวมของสาย */}
        <FilterChip
          selected={outsourceOn}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={expanded}
          aria-label={`ร้านนอก · ${count} งาน${
            overdue > 0 ? ` · เลยกำหนด ${overdue}` : ""
          } · กดเพื่อกางรายสาย`}
          className={cn(count === 0 && !outsourceOn && "opacity-45")}
          icon={<Truck className="h-4 w-4 text-secondary" strokeWidth={1.8} />}
        >
          <span className="whitespace-nowrap">ร้านนอก</span>
          <span className="ml-1 text-2xs font-semibold tabular-nums text-secondary">
            {count}
          </span>
          {overdue > 0 ? (
            <span className="ml-1.5 text-2xs font-semibold tabular-nums text-red-700 dark:text-red-300">
              เลย {overdue}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "ml-1 h-3.5 w-3.5 text-muted transition-transform",
              expanded && "rotate-180",
            )}
          />
        </FilterChip>
        {groupChips(state, "post").map((chip) => (
          <StationChip key={chip.key} chip={chip} state={state} />
        ))}
      </div>
      {expanded ? (
        <div
          role="group"
          aria-label="กรองตามสายงานร้านนอก"
          className={cn(BAR_BASE, "flex-nowrap overflow-x-auto pb-1 @2xl:flex-wrap")}
        >
          <span className="shrink-0 pl-1 text-2xs font-medium uppercase tracking-wide text-muted">
            สายร้านนอก
          </span>
          {outsource.map((chip) => (
            <StationChip key={chip.key} chip={chip} state={state} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
