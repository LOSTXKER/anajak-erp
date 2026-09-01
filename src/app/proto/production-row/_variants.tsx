"use client";

/* ============================================================
   แถวในหน้ารวมการผลิต — ให้เข้าชุดกับผังสายพานคู่ (R3) ในหน้าใบงาน

   เบสถามหลังเลือก R3: *"แล้วหน้ารวมการผลิตต้องปรับด้วยมั้ย"*
   คำตอบสั้น: ไม่พัง แต่มีสองจุดที่พูดคนละภาษากับใบงาน
   ① ความคืบหน้าเป็น "0/5 ช่วง + แถบ %" ซึ่งไม่บอกว่าค้างตรงไหนของเส้นทาง
   ② ในแถวไม่มีอะไรบอกว่างานอยู่ "ร้านนอก" ทั้งที่งานสองแบบนี้ตามคนละวิธี
   (โทรตามร้าน vs เร่งคนเอง)

   ทุกแบบใช้ rail ตัวจริงจาก buildProductionBoard() — 6 จุด: เตรียมเสื้อ · พิมพ์ฟิล์ม ·
   รีดร้อน · ร้านนอก · ตรวจ QC · แพ็ค พร้อมสถานะจริงของแต่ละจุด
   ============================================================ */

import { Truck } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import type { BoardRailPoint, BoardRailState } from "@/lib/production-board";

import { PROTO_BOARD, type ProtoJobRow } from "../production-list/_data";
import {
  ChevronCell,
  DeadlineText,
  JobIdentity,
  ProgressBar,
  StatusCell,
  jobHref,
  stationLabels,
} from "../production-list/_ui";

const OUTSOURCE_KEYS = new Set(["outsource"]);

/** สีของจุดบนราง — ชุดเดียวกับที่ใช้ในผังใบงาน (R3) */
function dotClass(state: BoardRailState) {
  switch (state) {
    case "done":
      return "bg-green-600 dark:bg-green-400";
    case "now":
      return "bg-amber-500 ring-4 ring-amber-500/20";
    case "stuck":
      return "bg-amber-500/70";
    case "failed":
      return "bg-red-600 dark:bg-red-400";
    case "na":
      return "bg-transparent ring-1 ring-divider";
    default:
      return "bg-border";
  }
}

function linkClass(done: boolean) {
  return done ? "bg-green-600/50 dark:bg-green-400/40" : "bg-divider";
}

const STATE_WORD: Record<BoardRailState, string> = {
  done: "ผ่านแล้ว",
  now: "กำลังทำ",
  stuck: "ติดรอของ",
  failed: "มีปัญหา",
  wait: "ยังไม่ถึง",
  na: "ไม่มีขั้นนี้",
};

/* ------------------------------------------------ A · รางย่อในแถว */

export function MiniRail({ rail }: { rail: readonly BoardRailPoint[] }) {
  const points = rail.filter((point) => point.state !== "na");
  const current = points.find((point) => point.state === "now" || point.state === "stuck");
  return (
    <span className="block min-w-32">
      <span className="flex items-center">
        {points.map((point, index) => (
          <span key={point.key} className="flex items-center" title={`${point.label} · ${STATE_WORD[point.state]}`}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn("h-0.5 w-3", linkClass(points[index - 1]!.state === "done"))}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn("h-2 w-2 shrink-0 rounded-full", dotClass(point.state))}
            />
          </span>
        ))}
      </span>
      <span className="mt-1 block text-2xs text-muted">
        {/* ไม่มีจุดที่กำลังทำ = จบทุกขั้นแล้ว หรือยังไม่เริ่มสักขั้น — คนละความหมาย ห้ามรวบเป็นคำเดียว */}
        {current
          ? `อยู่ที่ ${current.label}`
          : points.every((point) => point.state === "done")
            ? "ผ่านครบแล้ว"
            : "ยังไม่เริ่ม"}
      </span>
    </span>
  );
}

/* ------------------------------- B · รางย่อสองสาย (เข้าชุดกับ R3) */

export function TwoLaneRail({ job }: { job: ProtoJobRow }) {
  const rail = job.rail.filter((point) => point.state !== "na");
  const outsource = rail.filter((point) => OUTSOURCE_KEYS.has(point.key));
  const inHouse = rail.filter((point) => !OUTSOURCE_KEYS.has(point.key));

  const lane = (points: BoardRailPoint[], label: string, icon: boolean) =>
    points.length === 0 ? null : (
      <span className="flex items-center gap-1.5">
        {icon ? (
          /* ไอคอนรถอย่างเดียว — ป้ายยาวกว่านี้ตัดคำเป็นสองบรรทัดแล้วแถวเบี้ยว
             (ไอคอนรถ = ร้านนอก เป็นภาษาที่ใช้ทั่วเว็บอยู่แล้ว) */
          <Truck className="h-3.5 w-4 shrink-0 text-secondary" aria-hidden="true" />
        ) : (
          <span className="w-4 shrink-0 text-2xs text-muted">เรา</span>
        )}
        <span className="flex items-center">
          {points.map((point, index) => (
            <span key={point.key} className="flex items-center" title={`${point.label} · ${STATE_WORD[point.state]}`}>
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-0.5 w-2.5", linkClass(points[index - 1]!.state === "done"))}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn("h-2 w-2 shrink-0 rounded-full", dotClass(point.state))}
              />
            </span>
          ))}
        </span>
        <span className="sr-only">{label}</span>
      </span>
    );

  return (
    <span className="block min-w-32 space-y-1">
      {lane(inHouse, "สายเรา", false)}
      {lane(outsource, "สายร้านนอก", true)}
    </span>
  );
}

/* ------------------------------ C · แถบเดียวแบ่งช่วงสี + ขั้นที่ค้าง */

export function SegmentedBar({ job }: { job: ProtoJobRow }) {
  const points = job.rail.filter((point) => point.state !== "na");
  const stations = stationLabels(job);
  return (
    <span className="block min-w-32">
      <span className="flex h-1.5 overflow-hidden rounded-full">
        {points.map((point) => (
          <span
            key={point.key}
            title={`${point.label} · ${STATE_WORD[point.state]}`}
            className={cn("h-full flex-1 border-r border-surface last:border-r-0", dotClass(point.state))}
          />
        ))}
      </span>
      <span className="mt-1 block truncate text-2xs text-muted">
        {stations.join(" · ") || "ยังไม่เริ่ม"}
      </span>
    </span>
  );
}

/* --------------------------------------------------------- ตาราง */

type RowMode = "current" | "rail" | "twolane" | "segment";

function ProgressCell({ job, mode }: { job: ProtoJobRow; mode: RowMode }) {
  if (mode === "rail") return <MiniRail rail={job.rail} />;
  if (mode === "twolane") return <TwoLaneRail job={job} />;
  if (mode === "segment") return <SegmentedBar job={job} />;
  return <ProgressBar rail={job.rail} />;
}

export function RowTable({ mode }: { mode: RowMode }) {
  const jobs = PROTO_BOARD.jobs.slice(0, 6);
  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ออเดอร์</DataTable.Th>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.Th>{mode === "current" ? "ความคืบหน้า" : "เส้นทางงาน"}</DataTable.Th>
          <DataTable.Th align="right" className="hidden lg:table-cell">จำนวน</DataTable.Th>
          <DataTable.Th>กำหนดส่ง</DataTable.Th>
          <DataTable.Th className="w-12"><span className="sr-only">เปิด</span></DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {jobs.map((job) => (
          <DataTable.Row key={job.key} href={jobHref(job)} className="h-[70px]">
            <DataTable.Td className="min-w-44">
              <JobIdentity job={job} />
            </DataTable.Td>
            <DataTable.Td className="min-w-40">
              <StatusCell job={job} />
            </DataTable.Td>
            <DataTable.Td className="w-40">
              <ProgressCell job={job} mode={mode} />
            </DataTable.Td>
            <DataTable.Td align="right" className="hidden tabular-nums lg:table-cell">
              {(job.order.totalQuantity ?? 0).toLocaleString("th-TH")}
            </DataTable.Td>
            <DataTable.Td className="min-w-24">
              <DeadlineText job={job} />
            </DataTable.Td>
            <DataTable.Td className="text-muted">
              <ChevronCell />
            </DataTable.Td>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

export const ROW_MODES = ["current", "rail", "twolane", "segment"] as const;
export type ProductionRowVariant = (typeof ROW_MODES)[number];
