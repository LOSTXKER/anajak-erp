"use client";

/**
 * B · โต๊ะงาน + แผงข้าง — หัวหน้าไม่ต้องออกจากหน้าการผลิตเลย
 * กดแถวในตารางโต๊ะงาน = แผงข้างเปิดทางขวา: หัวใบย่อ → ปัญหา → ตารางขั้นงาน (กางแถวแล้วลงมือ/แก้ให้ได้)
 * ตารางซ้ายย่อคอลัมน์ให้ที่แผง · ปิดแผงกลับเป็นตารางเต็ม · "เปิดใบเต็ม" ไปหน้าใบผลิตเมื่ออยากดูทำอะไร/ประวัติ
 * ⚠️ แผงใช้ใบตัวอย่างชุดเดียว (7 ขั้นของ ORD-2608-0061) กับทุกแถว — เลขที่/ลูกค้า/กำหนดส่งเปลี่ยนตามแถวที่กด
 */

import { useState } from "react";
import { AlertTriangle, ExternalLink, Factory, Plus, Shirt, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Metric } from "@/components/ui/metric";
import { RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { productionJobs, type ProductionJob } from "../../production-module/_data";
import { JobTable } from "../../production-module/_pieces";
import { STEPS, currentStep, summarize } from "../../work-order/_data";
import { ProblemCard } from "../../work-order/_pieces";
import { StepsTable } from "../_pieces";

function SidePanel({ job, boss, onClose }: { job: ProductionJob; boss: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(() => currentStep(STEPS).id);
  const sum = summarize(STEPS);
  const problems = STEPS.filter((s) => s.problem);
  return (
    <aside className={cn("card-surface sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto", RADIUS.surface)} aria-label={`ใบผลิต ${job.orderNumber}`}>
      <div className="flex items-start justify-between gap-3 border-b border-divider px-5 py-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-xl font-semibold tabular-nums text-strong">{job.orderNumber}</span>
            <Badge variant="accent" size="sm">
              กำลังผลิต
            </Badge>
            {job.urgent ? (
              <Badge variant="destructive" size="sm">
                ด่วน
              </Badge>
            ) : null}
          </p>
          <p className="truncate text-sm text-secondary">{job.company}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm">
            เปิดใบเต็ม <ExternalLink />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="ปิดแผง" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 px-5 py-4">
        <Metric label="จำนวน" value={job.qty.toLocaleString("th-TH")} unit="ตัว" size="md" icon={Shirt} />
        <div>
          <p className="text-xs font-medium text-muted">กำหนดส่ง</p>
          <div className="mt-1">
            <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="md" />
          </div>
        </div>
        <Metric label="ติดปัญหา" value={sum.problems} unit="ขั้น" size="md" icon={AlertTriangle} tone={sum.problems > 0 ? "danger" : "muted"} />
      </div>
      {problems.length > 0 ? (
        <div className="space-y-3 px-5 pb-4">
          {problems.map((s) => (
            <ProblemCard key={s.id} step={s} />
          ))}
        </div>
      ) : null}
      <div className="border-t border-divider">
        <StepsTable steps={STEPS} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} boss={boss} compact />
      </div>
    </aside>
  );
}

export function DeskPanelVariant({ boss }: { boss: boolean }) {
  const jobs = productionJobs(false).slice().sort((a, b) => Number(Boolean(b.problem)) - Number(Boolean(a.problem)) || (a.dueInDays ?? 99) - (b.dueInDays ?? 99));
  const [openId, setOpenId] = useState<string | null>(() => jobs.find((j) => j.problem)?.id ?? jobs[0]?.id ?? null);
  const open = jobs.find((j) => j.id === openId) ?? null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="การผลิต"
        icon={Factory}
        tone="production"
        description={`งานในโรงงาน ${jobs.length} ใบ · กดแถวเพื่อดูและลงมือในแผงข้าง`}
        action={
          <Button>
            <Plus /> เปิดใบผลิต
          </Button>
        }
      />
      <div className={cn("grid items-start gap-5", open && "xl:grid-cols-[minmax(0,1fr)_minmax(440px,520px)]")}>
        <JobTable groups={[{ key: "all", label: "งานในโรงงาน", items: jobs }]} onOpen={(job) => setOpenId(job.id === openId ? null : job.id)} selectedId={openId} compact={Boolean(open)} />
        {open ? <SidePanel key={open.id} job={open} boss={boss} onClose={() => setOpenId(null)} /> : null}
      </div>
    </div>
  );
}
