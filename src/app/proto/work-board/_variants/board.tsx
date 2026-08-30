"use client";

/**
 * B · กระดานตามช่วงงาน — คอลัมน์เดินซ้ายไปขวาตามสายการผลิตจริง
 *
 * วิธีคิด: เห็นทั้งโรงงานในจอเดียว รู้ทันทีว่างานกองอยู่ช่วงไหน (คอขวด)
 * และรูปลายพิมพ์ใหญ่พอให้จำงานได้จากภาพ ไม่ต้องอ่านเลขออเดอร์
 */

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import {
  PROTO_TODAY_LABEL,
  STAGES,
  byUrgency,
  formatQty,
  type ProtoJob,
} from "../../_kit/demo-jobs";
import { BigMockup, DueBadge, DueText } from "../../_kit/pieces";

function Card({ job }: { job: ProtoJob }) {
  return (
    <li
      className={cn(
        "card-surface card-surface-hover rounded-xl p-3",
        job.problem && "ring-1 ring-inset ring-red-600/30 dark:ring-red-400/30",
      )}
    >
      <BigMockup
        src={job.mockup}
        alt={`ม็อกอัพของ ${job.orderNumber}`}
        className="mb-2 h-24 w-full"
      />
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums text-strong">{job.orderNumber}</span>
        {job.urgent ? (
          <Badge variant="destructive" size="sm">
            ด่วน
          </Badge>
        ) : null}
        <DueBadge job={job} />
      </p>
      <p className="mt-0.5 truncate text-xs text-secondary">{job.contact}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{job.title}</p>

      {job.problem ? (
        <p className="mt-2 flex items-start gap-1 text-2xs font-medium text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">{job.problem}</span>
        </p>
      ) : (
        <p className="mt-2 line-clamp-2 text-2xs text-secondary">{job.next.label}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-divider pt-2 text-2xs">
        <span className="tabular-nums text-muted">{formatQty(job.qty)} ตัว</span>
        <DueText job={job} className="text-muted" />
      </div>
    </li>
  );
}

function Column({
  label,
  sub,
  jobs,
  width,
}: {
  label: string;
  sub: string;
  jobs: ProtoJob[];
  width: string;
}) {
  const late = jobs.filter((job) => (job.dueInDays ?? 99) < 0).length;

  return (
    <section className={cn("flex shrink-0 flex-col", width)}>
      <header className="mb-2 border-b-2 border-divider pb-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-semibold text-strong">{label}</h4>
          <span className="rounded-md bg-surface-muted px-1.5 text-xs tabular-nums text-secondary">
            {jobs.length}
          </span>
        </div>
        <p className="mt-0.5 truncate text-2xs text-muted">{sub}</p>
        {late > 0 ? (
          <p className="mt-1 text-2xs font-medium text-red-700 dark:text-red-300">
            เลยกำหนด {late} ใบ
          </p>
        ) : null}
      </header>
      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-2xs text-muted">
          ไม่มีงานค้าง
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <Card key={job.id} job={job} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function BoardVariant({
  jobs,
  device,
}: {
  jobs: ProtoJob[];
  device: "desktop" | "mobile";
}) {
  const columns = STAGES.map((stage) => ({
    ...stage,
    items: jobs.filter((job) => job.stage === stage.key).sort(byUrgency),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-strong">กระดานโรงงาน</h3>
          <p className="text-xs text-muted">
            วันนี้ {PROTO_TODAY_LABEL} · {jobs.length} ใบเดินอยู่
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            surface="raised"
            placeholder="ค้นหา"
            containerClassName={device === "desktop" ? "w-56" : "w-full"}
            readOnly
          />
          {device === "desktop" ? (
            <Button variant="outline" size="sm">
              ดูเป็นรายการ
            </Button>
          ) : null}
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-max gap-3">
          {columns.map((column) => (
            <Column
              key={column.key}
              label={column.label}
              sub={column.sub}
              jobs={column.items}
              width={device === "desktop" ? "w-[228px]" : "w-[232px]"}
            />
          ))}
        </div>
      </div>

      <p className="text-2xs text-muted">
        {device === "desktop"
          ? "คอลัมน์ 7 ช่วงกว้างเกินจอ 1,440px เล็กน้อย — ต้องเลื่อนซ้าย-ขวาเล็กน้อยเสมอ"
          : "บนมือถือกระดานต้องเลื่อนซ้าย-ขวาทีละคอลัมน์ — เห็นภาพรวมทั้งกระดานไม่ได้"}
      </p>
    </div>
  );
}
