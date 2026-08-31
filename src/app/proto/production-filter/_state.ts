"use client";

/**
 * สถานะของหน้าลอง = ของเดิมจาก /proto/production-list ทุกอย่าง (มุม/ค้นหา/เรียง)
 * แล้วเติมชั้นเดียวคือ "กรองตามสายงาน" ซึ่งเป็นสิ่งที่กำลังเทียบ
 *
 * ตัวกรองสายงานไม่ได้เขียนตรรกะใหม่ — ใช้ `job.stationKeys` ที่ buildProductionBoard()
 * ทำไว้อยู่แล้ว และเป็นสูตรเดียวกับที่จอโรงงาน /factory ใช้กรองคอลัมน์ (filterBoardJobs)
 */

import { useMemo, useState } from "react";

import { STATION_ALL } from "@/lib/production-board";

import type { ProtoBoard } from "../production-list/_data";
import { useWorklist } from "../production-list/_ui";

export { STATION_ALL } from "@/lib/production-board";

export function useFilterProto(board: ProtoBoard) {
  const base = useWorklist(board);
  const [station, setStation] = useState<string>(STATION_ALL);

  const jobs = useMemo(
    () =>
      station === STATION_ALL
        ? base.jobs
        : base.jobs.filter((job) => job.stationKeys.includes(station)),
    [base.jobs, station],
  );

  /* นับจากงานที่ผ่านมุม/คำค้นแล้ว ไม่ใช่จากทั้งบอร์ด — ตัวเลขในชิปจึงตรงกับสิ่งที่จะเห็นจริง
     เมื่อกดแล้ว · สายที่นับได้ 0 ยังอยู่ในแถบ (แค่จาง) ไม่ให้ชิปเต้นหายไปมาระหว่างกรอง */
  const stations = useMemo(
    () =>
      board.stations.map((item) => ({
        key: item.key,
        label: item.label,
        isOutsource: item.isOutsource,
        count: base.jobs.filter((job) => job.stationKeys.includes(item.key)).length,
        overdue: base.jobs.filter(
          (job) => job.stationKeys.includes(item.key) && job.overdue,
        ).length,
      })),
    [board.stations, base.jobs],
  );

  return { ...base, jobs, station, setStation, stations };
}

export type FilterProtoState = ReturnType<typeof useFilterProto>;
