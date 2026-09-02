"use client";

/**
 * B · สายพาน — หน้าแรกคือผังการผลิตเอง: สถานีในโรงงานเรียงซ้ายไปขวา ร้านนอกเป็นอีกแถวใต้
 * กดสถานีไหน = เห็นคิวสถานีนั้น และ "จอสถานี" คือหน้าเดียวกันนี้ที่ซูมเข้าไปสถานีเดียว
 *
 * วิธีคิด: คนหน้างานกับหัวหน้าดูภาพเดียวกัน — ต่างกันแค่ซูม · ร้านนอกเป็นสถานีชนิดหนึ่ง
 * ไม่ใช่หน้าแยก (รู้ทันทีว่างานอยู่ร้านไหน กลับเมื่อไร)
 */

import { useState } from "react";
import { ArrowRight, Factory, PackageCheck, Plus, Truck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

import {
  STATIONS,
  STATION_LABEL,
  stationCounts,
  type ProductionJob,
  type StationKey,
} from "../_data";
import { JobTable, TouchJobCard } from "../_pieces";

type Node = StationKey | `vendor:${string}`;

function vendorGroups(jobs: ProductionJob[]) {
  const map = new Map<string, ProductionJob[]>();
  for (const job of jobs) {
    if (!job.outsource) continue;
    const list = map.get(job.outsource.vendor) ?? [];
    list.push(job);
    map.set(job.outsource.vendor, list);
  }
  return [...map.entries()].map(([vendor, list]) => ({
    key: `vendor:${vendor}` as Node,
    vendor,
    jobs: list,
    late: list.filter((job) => (job.outsource?.backInDays ?? 1) < 0).length,
    nextBack: list.slice().sort((a, b) => a.outsource!.backInDays - b.outsource!.backInDays)[0]!.outsource!,
  }));
}

function StationNode({
  label,
  count,
  late,
  blocked,
  selected,
  onClick,
  big,
}: {
  label: string;
  count: number;
  late: number;
  blocked: number;
  selected: boolean;
  onClick: () => void;
  big: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex shrink-0 flex-col justify-center rounded-2xl border px-4 text-left transition-colors",
        big ? "min-h-20 min-w-40" : "min-h-16 min-w-32",
        selected
          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
          : "card-surface card-surface-hover border-border",
      )}
    >
      <span className={cn("text-xs font-medium", selected ? "text-white/85" : "text-muted")}>{label}</span>
      <span className={cn("font-semibold tabular-nums", big ? "text-3xl" : "text-2xl")}>{count}</span>
      {late > 0 || blocked > 0 ? (
        <span className={cn("text-2xs", selected ? "text-white/85" : "text-red-600 dark:text-red-400")}>
          {late > 0 ? `เลยกำหนด ${late}` : ""}
          {late > 0 && blocked > 0 ? " · " : ""}
          {blocked > 0 ? `ติด ${blocked}` : ""}
        </span>
      ) : (
        <span className={cn("text-2xs", selected ? "text-white/70" : "text-muted")}>ปกติ</span>
      )}
    </button>
  );
}

export function FlowVariant({
  jobs,
  station,
  awaiting,
}: {
  jobs: ProductionJob[];
  station: boolean;
  awaiting: number;
}) {
  const counts = stationCounts(jobs);
  const vendors = vendorGroups(jobs);
  const [node, setNode] = useState<Node>(
    () => counts.slice().sort((a, b) => b.late - a.late || b.count - a.count)[0]!.key,
  );

  const selectedStation = STATIONS.find((s) => s.key === node) ?? null;
  const selectedVendor = vendors.find((v) => v.key === node) ?? null;
  const queue = (selectedStation
    ? jobs.filter((job) => job.station === selectedStation.key)
    : selectedVendor
      ? selectedVendor.jobs
      : []
  )
    .slice()
    .sort((a, b) => Number(Boolean(b.problem)) - Number(Boolean(a.problem)) || (a.dueInDays ?? 99) - (b.dueInDays ?? 99));

  const strip = (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-2">
          {counts.map((item, index) => (
            <div key={item.key} className="flex items-center gap-2">
              <StationNode
                label={item.label}
                count={item.count}
                late={item.late}
                blocked={item.blocked}
                selected={node === item.key}
                onClick={() => setNode(item.key)}
                big={station}
              />
              {index < counts.length - 1 ? (
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {!station || vendors.some((v) => v.late > 0) ? (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max items-center gap-2">
            <span className="flex items-center gap-1.5 pr-1 text-xs font-medium text-muted">
              <Truck className="h-4 w-4" aria-hidden="true" /> ร้านนอก
            </span>
            {vendors.length === 0 ? (
              <span className="text-xs text-muted">ไม่มีงานอยู่ร้านนอก</span>
            ) : (
              vendors.map((vendor) => (
                <button
                  key={vendor.key}
                  type="button"
                  aria-pressed={node === vendor.key}
                  onClick={() => setNode(vendor.key)}
                  className={cn(
                    "flex min-h-14 shrink-0 items-center gap-3 rounded-2xl border border-dashed px-4 text-left",
                    node === vendor.key
                      ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                      : vendor.late > 0
                        ? "border-red-500/60 bg-red-50 dark:bg-red-950/30"
                        : "card-surface card-surface-hover border-border",
                  )}
                >
                  <span className="text-2xl font-semibold tabular-nums">{vendor.jobs.length}</span>
                  <span className="min-w-0">
                    <span className="block max-w-48 truncate text-sm font-medium">{vendor.vendor}</span>
                    <span
                      className={cn(
                        "block text-2xs",
                        node === vendor.key
                          ? "text-white/85"
                          : vendor.late > 0
                            ? "font-medium text-red-700 dark:text-red-300"
                            : "text-muted",
                      )}
                    >
                      {vendor.late > 0
                        ? `เลยนัดรับ ${vendor.late} งาน`
                        : vendor.nextBack.backInDays === 0
                          ? "นัดรับวันนี้"
                          : `กลับเร็วสุด ${vendor.nextBack.backLabel}`}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );

  const title = selectedStation ? selectedStation.label : selectedVendor ? selectedVendor.vendor : "";
  const action = selectedStation ? selectedStation.action : "รับของกลับ / ตรวจรับ";

  if (station) {
    return (
      <div className="space-y-5">
        {strip}
        <p className="text-sm text-secondary">
          <span className="font-medium text-strong">{title}</span> · {queue.length} ใบ · ปุ่มหลัก “{action}”
        </p>
        {queue.length === 0 ? (
          <div className="card-surface rounded-2xl">
            <EmptyState icon={PackageCheck} title={`ไม่มีงานที่${title}`} description="แตะสถานีอื่นข้างบน" />
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {queue.map((job) => (
              <TouchJobCard key={job.id} job={job} action={action} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="การผลิต"
        icon={Factory}
        tone="production"
        description={`งานในโรงงาน ${jobs.length} ใบ · อยู่ร้านนอก ${jobs.filter((j) => j.outsource).length} ใบ · รอเปิดใบผลิต ${awaiting} ใบ`}
        action={
          <Button>
            <Plus /> เปิดใบผลิต {awaiting > 0 ? `(${awaiting})` : ""}
          </Button>
        }
      />

      {strip}

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-strong">
          {selectedStation ? `คิว${selectedStation.label}` : `งานที่ ${title}`}
        </h2>
        <span className="text-xs tabular-nums text-muted">{queue.length} ใบ</span>
        <span className="ml-auto text-xs text-muted">
          {selectedVendor
            ? `ร้านดูงานผ่านลิงก์ · นัดรับใกล้สุด ${selectedVendor.nextBack.backLabel}`
            : "เรียง: ติดปัญหา → เลยกำหนด → กำหนดส่ง"}
        </span>
      </div>
      <JobTable
        groups={[{ key: String(node), label: title, items: queue }]}
        emptyLabel={`ไม่มีงานที่${title} — เลือกสถานีอื่นในสายพาน`}
      />

      <p className="text-xs text-muted">
        สถานีที่กำลังดู: {selectedStation ? STATION_LABEL[selectedStation.key] : title} — บนจอทัชหน้างาน
        หน้านี้เปิดค้างไว้ที่สถานีเดียว (กด “โหมดหน้างาน” ข้างบนเพื่อดู)
      </p>
    </div>
  );
}
