"use client";

/**
 * ชิ้นส่วนที่ทั้งสามทางใช้ร่วมกัน — เขียนเองเฉพาะ "แถบเส้นทางงาน" กับ "การ์ดใบงานบนจอทัช"
 * เพราะเป็นของที่กำลังเทียบ · ปุ่ม ป้าย รูปย่อ หัวหน้า ใช้ component ตัวจริงจาก src/components
 *
 * ทำใหม่ 2026-09-02 หลังเบสทัก "อัดหลายอย่างติดกันไม่มีการจัด อะไร ๆ ก็เป็น text ธรรมดา":
 * ข้อเท็จจริงทุกชิ้นผ่าน Fact / InfoChip / DueTag / Metric / ActionZone (ชิ้นส่วนกลางชุดใหม่)
 * ไม่มีบรรทัดไหนต่อข้อมูล 3 อย่างด้วยจุดอีก
 */

import { AlertTriangle, CalendarCheck, Truck, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { cn } from "@/lib/utils";
import { BigMockup } from "../_kit/pieces";
import { formatQty } from "../_kit/demo-jobs";
import { STEP_TONE, type ProductionJob, type RouteStep } from "./_data";

/** แถบเส้นทางงานแบ่งช่วง — สูตรสีเดียวกับคอลัมน์ "เส้นทางงาน" แบบ C ที่ลงของจริงไปแล้ว */
export function RouteBar({
  route,
  size = "sm",
  className,
}: {
  route: RouteStep[];
  size?: "sm" | "lg";
  className?: string;
}) {
  const done = route.filter((step) => step.state === "done").length;
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("flex gap-0.5", size === "lg" ? "h-2.5" : "h-1.5")}>
        {route.map((step, index) => (
          <span
            key={`${step.key}-${index}`}
            title={`${step.label} · ${STEP_TONE[step.state].label}`}
            className={cn(
              "flex-1 rounded-sm",
              STEP_TONE[step.state].bar,
              step.key === "outsource" && "bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,0.45)_3px_5px)]",
            )}
          />
        ))}
      </div>
      <p className={cn("mt-1 tabular-nums text-muted", size === "lg" ? "text-xs" : "text-2xs")}>
        ผ่านแล้ว {done} จาก {route.length} ช่วง
      </p>
    </div>
  );
}

function outsourceReturn(job: ProductionJob) {
  const o = job.outsource;
  if (!o) return null;
  if (o.backInDays < 0) return { text: `เลยนัดรับ ${Math.abs(o.backInDays)} วัน`, tone: "error" as const, strong: true };
  if (o.backInDays === 0) return { text: "นัดรับวันนี้", tone: "warning" as const, strong: true };
  return { text: `กลับ ${o.backLabel}`, tone: "info" as const, strong: false };
}

/**
 * "ตอนนี้อยู่ที่" — ขั้นปัจจุบันเป็นชิปนำ · ร้านนอกเป็นข้อเท็จจริงมีโครง (ร้าน / งาน / วันกลับ)
 * · ปัญหาเป็นชิปแดง — ไม่มีอะไรต่อกันด้วยจุด
 */
export function WhereNow({
  job,
  size = "md",
  className,
}: {
  job: ProductionJob;
  size?: "md" | "lg";
  className?: string;
}) {
  const step = job.current;
  const tone = STEP_TONE[step.state];
  const back = outsourceReturn(job);
  const chipSize = size === "lg" ? "lg" : "md";
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <InfoChipRow>
        <InfoChip
          size={chipSize}
          tone={step.state === "blocked" ? "error" : step.state === "active" ? "info" : "neutral"}
          strong={step.state !== "todo"}
          icon={step.key === "outsource" ? Truck : Wrench}
        >
          {step.key === "outsource" ? "อยู่ร้านนอก" : step.label}
          <span className="ml-1 font-normal opacity-80">{tone.label}</span>
        </InfoChip>
        {back ? (
          <InfoChip size={chipSize} tone={back.tone} strong={back.strong} icon={CalendarCheck}>
            {back.text}
          </InfoChip>
        ) : null}
        {job.problem ? (
          <InfoChip size={chipSize} tone="error" strong icon={AlertTriangle} title={job.problem}>
            {job.problem}
          </InfoChip>
        ) : null}
      </InfoChipRow>
      {job.outsource ? (
        <FactList columns={2}>
          <Fact icon={Truck} label="ร้านนอก" value={job.outsource.vendor} size={size === "lg" ? "md" : "sm"} />
          <Fact label="งานที่ส่ง" value={job.outsource.work} size={size === "lg" ? "md" : "sm"} />
        </FactList>
      ) : null}
    </div>
  );
}

/** แถวใบงานบนคอม — รูปย่อตัวจริง · เลขใบหนัก · ลูกค้า · จำนวนเป็นตัวเลข · กำหนดส่งเป็นป้าย */
export function JobCell({ job }: { job: ProductionJob }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพ ${job.orderNumber}`} size="lg" />
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-base font-semibold tabular-nums text-strong">{job.orderNumber}</span>
          {job.urgent ? (
            <Badge variant="destructive" size="sm">
              ด่วน
            </Badge>
          ) : null}
        </p>
        <p className="truncate text-sm text-secondary">{job.company}</p>
        <InfoChipRow>
          <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="sm" />
          <InfoChip size="sm">{formatQty(job.qty)} ตัว</InfoChip>
        </InfoChipRow>
      </div>
    </div>
  );
}

/**
 * การ์ดใบงานบนจอทัชหน้างาน — ทุกทางใช้การ์ดเดียวกันเมื่อเปิด "โหมดหน้างาน"
 * ตัวเลขจำนวนคือจุดโฟกัส · ข้อเท็จจริงมีโครง · โซนลงมือมีพื้นของตัวเอง · หนึ่งใบ = หนึ่งปุ่มหลัก
 */
export function TouchJobCard({
  job,
  action,
  compact = false,
}: {
  job: ProductionJob;
  action: string;
  compact?: boolean;
}) {
  const blocked = job.current.state === "blocked" || job.current.state === "waiting";
  return (
    <li
      className={cn(
        "card-surface rounded-2xl p-4",
        job.problem && "ring-1 ring-inset ring-red-600/40 dark:ring-red-400/40",
      )}
    >
      <div className={cn("flex gap-4", compact ? "items-center" : "items-start")}>
        <BigMockup
          src={job.mockup}
          alt={`ม็อกอัพ ${job.orderNumber}`}
          className={compact ? "h-16 w-16 shrink-0" : "h-24 w-24 shrink-0"}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold tabular-nums text-strong">{job.orderNumber}</span>
              {job.urgent ? <Badge variant="destructive">ด่วน</Badge> : null}
            </p>
            <p className="truncate text-sm text-secondary">{job.company}</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <Metric value={formatQty(job.qty)} unit="ตัว" label="จำนวน" size={compact ? "md" : "lg"} />
            <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="lg" />
          </div>
          <WhereNow job={job} size="lg" />
          {job.note ? (
            <InfoChip tone="warning" size="lg" icon={AlertTriangle} className="whitespace-normal">
              {job.note}
            </InfoChip>
          ) : null}
        </div>
      </div>
      <ActionZone
        touch
        className="mt-4"
        note={
          blocked
            ? job.current.state === "waiting"
              ? "รอของกลับจากร้านนอกก่อน จึงลงมือขั้นนี้ได้"
              : "ติดปัญหา — รอหัวหน้าตัดสินก่อน"
            : undefined
        }
      >
        {blocked ? (
          <Button variant="outline" className="h-14 text-base" disabled>
            {action}
          </Button>
        ) : (
          <Button className="h-14 text-base">{action}</Button>
        )}
        <Button variant="outline" className="h-14 text-base">
          แจ้งปัญหา
        </Button>
      </ActionZone>
    </li>
  );
}

/** ปุ่มเดียวต่อแถว (บนคอม) — ตามกติกา "หนึ่งหน้า primary action เดียว" */
export function RowAction({ job, action }: { job: ProductionJob; action: string }) {
  // ใบที่อยู่ร้านนอก: ปุ่มคือเรื่องร้าน (รับของกลับ/ตามร้าน) แม้จะเลยนัดรับก็ไม่ใช่ "จัดการปัญหา"
  if (job.current.key === "outsource" || job.current.state === "waiting") {
    const due = job.outsource && job.outsource.backInDays <= 0;
    return (
      <Button variant={due ? "default" : "outline"} size="sm" className="w-full sm:w-auto">
        <Truck /> {due ? "รับของกลับ" : "ตามร้าน"}
      </Button>
    );
  }
  if (job.current.state === "blocked") {
    return (
      <Button variant="destructive" size="sm" className="w-full sm:w-auto">
        จัดการปัญหา
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" className="w-full sm:w-auto">
      {action}
    </Button>
  );
}
