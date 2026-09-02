"use client";

/**
 * ชิ้นส่วนที่ทั้งสามทางใช้ร่วมกัน — เขียนเองเฉพาะ "แถบเส้นทางงาน" กับ "การ์ดใบงานบนจอทัช"
 * เพราะเป็นของที่กำลังเทียบ · ปุ่ม ป้าย รูปย่อ หัวหน้า ใช้ component ตัวจริงจาก src/components
 *
 * ทำใหม่ 2026-09-02 หลังเบสทัก "อัดหลายอย่างติดกันไม่มีการจัด อะไร ๆ ก็เป็น text ธรรมดา":
 * ข้อเท็จจริงทุกชิ้นผ่าน Fact / InfoChip / DueTag / Metric / ActionZone (ชิ้นส่วนกลางชุดใหม่)
 * ไม่มีบรรทัดไหนต่อข้อมูล 3 อย่างด้วยจุดอีก
 */

import { Fragment } from "react";
import { AlertTriangle, CalendarCheck, Truck, UserRound, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
        {size === "lg" ? `ผ่านแล้ว ${done} จาก ${route.length} ช่วง` : `${done}/${route.length} ช่วง`}
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

/* ───────────────────────────── ตารางใบงาน (ทาง A และ B) ─────────────────────────────
   เบสสั่ง 2026-09-02: "ทำให้รายการมันเป็นตารางมีคอลัมน์ จัดข้อมูลเป็นสัดส่วน"
   → DataTable ตัวจริง หนึ่งข้อมูลหนึ่งคอลัมน์ หัวคอลัมน์บอกว่าช่องนั้นคืออะไร
   กลุ่ม (กอง/สถานี) เป็นแถวหัวกลุ่มในตารางเดียวกัน คอลัมน์จึงตรงกันทั้งหน้า */

export type JobTableGroup = {
  key: string;
  label: string;
  items: ProductionJob[];
};

function CurrentStepChip({ job }: { job: ProductionJob }) {
  const step = job.current;
  const tone = STEP_TONE[step.state];
  return (
    <InfoChip
      size="sm"
      tone={step.state === "blocked" ? "error" : step.state === "active" ? "info" : "neutral"}
      strong={step.state !== "todo"}
      icon={step.key === "outsource" ? Truck : Wrench}
    >
      {step.key === "outsource" ? "อยู่ร้านนอก" : step.label}
      <span className="ml-1 font-normal opacity-80">{tone.label}</span>
    </InfoChip>
  );
}

function OutsourceCell({ job }: { job: ProductionJob }) {
  if (!job.outsource) return <span className="text-muted">—</span>;
  const back = outsourceReturn(job)!;
  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate font-medium text-strong">{job.outsource.vendor}</p>
      <p className="truncate text-xs text-secondary">{job.outsource.work}</p>
      <InfoChip size="sm" tone={back.tone} strong={back.strong} icon={CalendarCheck}>
        {back.text}
      </InfoChip>
    </div>
  );
}

export function JobTable({
  groups,
  actionFor,
  emptyLabel = "ไม่มีงาน",
}: {
  groups: JobTableGroup[];
  /** ป้ายปุ่มลงมือของแถวนั้น (ตามสถานีที่ใบอยู่) */
  actionFor: (job: ProductionJob) => string;
  emptyLabel?: string;
}) {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  return (
    <DataTable.Root className="[&_td]:px-4 [&_th:not([aria-sort])]:px-4">
      <DataTable.Head>
        <tr>
          <DataTable.Th>ใบงาน</DataTable.Th>
          <DataTable.Th align="right">จำนวน</DataTable.Th>
          <DataTable.Th>กำหนดส่ง</DataTable.Th>
          <DataTable.Th>เส้นทางงาน</DataTable.Th>
          <DataTable.Th>ตอนนี้อยู่ที่ · ผู้รับผิดชอบ</DataTable.Th>
          <DataTable.Th>ร้านนอก</DataTable.Th>
          <DataTable.Th align="right">ลงมือ</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {total === 0 ? (
          <tr>
            <DataTable.Td colSpan={7} align="center" className="py-10 text-muted">
              {emptyLabel}
            </DataTable.Td>
          </tr>
        ) : null}
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <Fragment key={group.key}>
              {groups.length > 1 ? (
                <tr className="bg-surface-muted">
                  <th
                    colSpan={7}
                    scope="rowgroup"
                    className="px-4 py-2 text-left text-xs font-semibold text-strong"
                  >
                    {group.label}
                    <span className="ml-2 font-normal tabular-nums text-muted">{group.items.length} ใบ</span>
                  </th>
                </tr>
              ) : null}
              {group.items.map((job) => (
                <DataTable.Row key={job.id} className={cn(job.problem && "bg-red-50/40 dark:bg-red-950/15")}>
                  <DataTable.Td className="min-w-56">
                    <div className="flex items-center gap-3">
                      <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพ ${job.orderNumber}`} size="md" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold tabular-nums text-strong">{job.orderNumber}</span>
                          {job.urgent ? (
                            <Badge variant="destructive" size="sm">
                              ด่วน
                            </Badge>
                          ) : null}
                        </p>
                        <p className="truncate text-secondary">{job.company}</p>
                      </div>
                    </div>
                  </DataTable.Td>
                  <DataTable.Td align="right" className="whitespace-nowrap">
                    <span className="text-base font-semibold tabular-nums text-strong">{formatQty(job.qty)}</span>
                    <span className="ml-1 text-xs text-muted">ตัว</span>
                  </DataTable.Td>
                  <DataTable.Td className="whitespace-nowrap">
                    <DueTag dueInDays={job.dueInDays} dateLabel={job.dueLabel} size="sm" />
                  </DataTable.Td>
                  <DataTable.Td className="w-32 min-w-28">
                    <RouteBar route={job.route} />
                  </DataTable.Td>
                  <DataTable.Td className="min-w-44 max-w-60">
                    <div className="space-y-1.5">
                      <InfoChipRow>
                        <CurrentStepChip job={job} />
                        {job.problem ? (
                          <InfoChip size="sm" tone="error" strong icon={AlertTriangle} title={job.problem} className="max-w-52">
                            {job.problem}
                          </InfoChip>
                        ) : null}
                      </InfoChipRow>
                      <p className="flex items-center gap-1.5 text-xs text-secondary">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                        <span className="truncate">{job.next.owner}</span>
                      </p>
                    </div>
                  </DataTable.Td>
                  <DataTable.Td className="min-w-40 max-w-52">
                    <OutsourceCell job={job} />
                  </DataTable.Td>
                  <DataTable.Td align="right" className="whitespace-nowrap">
                    <RowAction job={job} action={actionFor(job)} />
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </Fragment>
          ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}
