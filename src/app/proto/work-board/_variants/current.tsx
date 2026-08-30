"use client";

/**
 * ปัจจุบัน — สองหน้าแยกกัน ที่เล่าเรื่องออเดอร์ชุดเดียวกัน
 *
 * โครง คอลัมน์ ตัวกรอง และ component ทุกชิ้นยกมาจากของจริง:
 *  · /orders        → src/components/orders/orders-page.tsx (+ order-status-filter)
 *  · /production    → src/components/production/production-control-worklist.tsx
 * ที่ไม่ได้ยกมาคือการต่อฐานข้อมูลจริงเท่านั้น
 */

import { ChevronDown, ChevronRight, Download, ListFilter, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { StatusLabel } from "@/components/ui/status-label";
import { Toolbar } from "@/components/ui/toolbar";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { ACTIVE_UNDERLINE, FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { byUrgency, formatAmount, formatQty, type ProtoJob } from "../../_kit/demo-jobs";
import { DueBadge, DueText, NextAction, Progress } from "../../_kit/pieces";

/** ช่วงงานของแถบสถานะหน้า /orders — ยกมาจาก INTERNAL_STATUS_STAGES ตัวจริง */
const ORDER_STAGES = [
  { label: "รับงาน", statuses: ["ร่าง", "สอบถาม", "ยืนยันออเดอร์"] },
  { label: "ออกแบบ", statuses: ["กำลังออกแบบ", "อนุมัติแบบแล้ว"] },
  { label: "ผลิต", statuses: ["รอคิวผลิต", "กำลังผลิต", "ตรวจสอบคุณภาพ"] },
  { label: "ส่งของ", statuses: ["กำลังแพ็ค", "พร้อมจัดส่ง", "จัดส่งแล้ว"] },
  { label: "ปิดงาน", statuses: ["เสร็จสิ้น"] },
] as const;

const WORKLIST_LENSES = ["ทั้งหมด", "ต้องจัดการ", "กำลังผลิต", "รอ QC", "แพ็ก / พร้อมส่ง"];

function PageBlock({
  route,
  title,
  action,
  children,
}: {
  route: string;
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface-muted p-3 ring-1 ring-inset ring-border">
      <p className="mb-3 text-2xs font-medium uppercase tracking-wide text-muted">
        หน้า {route}
      </p>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-strong">{title}</h3>
          <div className="flex items-center gap-2">{action}</div>
        </div>
        {children}
      </div>
    </section>
  );
}

function OrderStatusStrip({ jobs }: { jobs: ProtoJob[] }) {
  const countOf = (statuses: readonly string[]) =>
    jobs.filter((job) => statuses.includes(job.statusLabel)).length;

  return (
    <section
      aria-label="กรองตามสถานะ"
      className="overflow-hidden rounded-lg border border-border bg-surface px-5 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          aria-pressed
          className={cn(
            "group inline-flex min-h-11 items-center gap-2 border-b-2 bg-transparent px-1 text-sm",
            FOCUS_BUTTON,
            ACTIVE_UNDERLINE,
          )}
        >
          ทั้งหมด
          <span className="text-xs tabular-nums text-blue-700 dark:text-blue-400">
            {jobs.length}
          </span>
        </button>
        {ORDER_STAGES.map((stage) => (
          <button
            key={stage.label}
            type="button"
            className={cn(
              "group inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent bg-transparent px-1 text-sm font-medium text-muted transition-colors hover:text-secondary",
              FOCUS_BUTTON,
            )}
          >
            {stage.label}
            <span className="text-xs tabular-nums text-muted">{countOf(stage.statuses)}</span>
          </button>
        ))}
        <span className="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-secondary">
          ทุกสถานะ
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}

function OrdersTable({ jobs }: { jobs: ProtoJob[] }) {
  return (
    <DataTable.Root>
      <DataTable.Head>
        <tr>
          <DataTable.Th>เลขออเดอร์</DataTable.Th>
          <DataTable.Th>ลูกค้า / งาน</DataTable.Th>
          <DataTable.Th>ประเภทงาน</DataTable.Th>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.Th align="right">ยอดรวม</DataTable.Th>
          <DataTable.Th>การชำระ</DataTable.Th>
          <DataTable.Th>กำหนดส่ง</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {jobs.map((job) => (
          <DataTable.Row key={job.id}>
            <DataTable.Td className="whitespace-nowrap">
              <div className="flex items-center gap-3">
                <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพของ ${job.orderNumber}`} size="sm" />
                <span className="font-medium tabular-nums text-strong">{job.orderNumber}</span>
              </div>
            </DataTable.Td>
            <DataTable.Td>
              <div className="min-w-0">
                <p className="max-w-72 truncate text-sm font-semibold text-strong">
                  {job.contact}
                </p>
                <p className="mt-0.5 max-w-72 truncate text-sm text-secondary">{job.title}</p>
              </div>
            </DataTable.Td>
            <DataTable.Td className="whitespace-nowrap">
              <Badge variant={job.orderType === "สั่งทำ" ? "accent" : "outline"} size="sm">
                {job.orderType}
              </Badge>
            </DataTable.Td>
            <DataTable.Td className="whitespace-nowrap">
              <StatusLabel
                label={job.statusLabel}
                tone={
                  job.statusLabel === "กำลังผลิต" || job.statusLabel === "ตรวจสอบคุณภาพ"
                    ? "warning"
                    : "accent"
                }
              />
            </DataTable.Td>
            <DataTable.Td align="right" className="whitespace-nowrap tabular-nums">
              {formatAmount(job.amount)}
            </DataTable.Td>
            <DataTable.Td className="whitespace-nowrap text-secondary">
              {job.payment ?? "—"}
            </DataTable.Td>
            <DataTable.Td className="whitespace-nowrap">
              <span className="block">
                <DueText job={job} />
              </span>
              <span className="mt-1 block">
                <DueBadge job={job} />
              </span>
            </DataTable.Td>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function ProductionTable({ jobs }: { jobs: ProtoJob[] }) {
  return (
    <DataTable.Root bordered={false}>
      <DataTable.Head>
        <tr>
          <DataTable.Th>ออเดอร์</DataTable.Th>
          <DataTable.Th>ต้องทำต่อ</DataTable.Th>
          <DataTable.Th>ความคืบหน้า</DataTable.Th>
          <DataTable.Th align="right">จำนวน</DataTable.Th>
          <DataTable.Th>กำหนดส่ง</DataTable.Th>
          <DataTable.Th className="w-12">
            <span className="sr-only">เปิด</span>
          </DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {jobs.map((job) => (
          <DataTable.Row key={job.id} className="h-[82px]">
            <DataTable.Td className="min-w-44">
              <span className="inline-flex min-w-0 items-center gap-3">
                <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพของ ${job.orderNumber}`} size="sm" />
                <span className="flex min-w-0 flex-col justify-center">
                  <span className="flex items-center gap-1.5 font-semibold tabular-nums text-strong">
                    {job.orderNumber}
                    {job.urgent ? (
                      <Badge variant="destructive" size="sm">
                        ด่วน
                      </Badge>
                    ) : null}
                  </span>
                  <span className="max-w-44 truncate text-xs text-muted">{job.contact}</span>
                </span>
              </span>
            </DataTable.Td>
            <DataTable.Td className="min-w-56">
              <NextAction job={job} />
            </DataTable.Td>
            <DataTable.Td className="w-32">
              <Progress done={job.progress.done} total={job.progress.total} />
            </DataTable.Td>
            <DataTable.Td align="right" className="tabular-nums">
              {formatQty(job.qty)}
            </DataTable.Td>
            <DataTable.Td className="min-w-28">
              <span className="block">
                <DueText job={job} />
              </span>
              <span className="mt-1 block">
                <DueBadge job={job} />
              </span>
            </DataTable.Td>
            <DataTable.Td className="text-muted">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </DataTable.Td>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function MobileOrderCards({ jobs }: { jobs: ProtoJob[] }) {
  return (
    <ul className="space-y-2">
      {jobs.map((job) => (
        <li key={job.id} className="card-surface rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพของ ${job.orderNumber}`} size="md" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-semibold tabular-nums text-strong">
                {job.orderNumber}
                <DueBadge job={job} />
              </p>
              <p className="truncate text-sm text-secondary">{job.contact}</p>
              <p className="truncate text-xs text-muted">{job.title}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <StatusLabel label={job.statusLabel} tone="accent" />
            <span className="tabular-nums text-secondary">{formatAmount(job.amount)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MobileProductionCards({ jobs }: { jobs: ProtoJob[] }) {
  return (
    <ul className="space-y-2">
      {jobs.map((job) => (
        <li key={job.id} className="card-surface rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <MockupThumbnail cover={job.mockup} alt={`ม็อกอัพของ ${job.orderNumber}`} size="md" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold tabular-nums text-strong">
                {job.orderNumber}
                <DueBadge job={job} />
              </p>
              <p className="truncate text-sm text-secondary">{job.contact}</p>
            </div>
          </div>
          <div className="mt-3">
            <NextAction job={job} />
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-4">
            <Progress done={job.progress.done} total={job.progress.total} />
            <span className="text-right text-xs text-muted">
              <span className="block">
                <DueText job={job} />
              </span>
              <span className="block tabular-nums">{formatQty(job.qty)} ตัว</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CurrentVariant({
  jobs,
  device,
}: {
  jobs: ProtoJob[];
  device: "desktop" | "mobile";
}) {
  const sorted = [...jobs].sort(byUrgency);
  // หน้าผลิตจริงแสดงเฉพาะงานที่มีใบผลิตแล้ว — ใบที่ยังอยู่ขั้นรับงาน/ออกแบบไม่โผล่
  const productionJobs = sorted.filter((job) => job.stage !== "intake" && job.stage !== "design");

  return (
    <div className="space-y-4">
      <PageBlock
        route="/orders"
        title="ออเดอร์ทั้งหมด"
        action={
          <>
            {device === "desktop" ? (
              <Button variant="outline" size="sm">
                <Download />
                ส่งออกหน้านี้
              </Button>
            ) : null}
            <Button size="sm">
              <Plus />
              สร้างออเดอร์
            </Button>
          </>
        }
      >
        {device === "desktop" ? <OrderStatusStrip jobs={jobs} /> : null}
        <Toolbar>
          <SearchInput
            surface="raised"
            placeholder="ค้นหาเลขออเดอร์, ชื่อ, ลูกค้า..."
            containerClassName={device === "desktop" ? "max-w-sm flex-1" : "w-full"}
            readOnly
          />
          <div
            className={cn(
              "grid w-full min-w-0 grid-cols-2 items-center gap-2",
              device === "desktop" && "flex w-auto flex-nowrap",
            )}
          >
            <Select surface="raised" aria-label="ช่วงวันที่" className="min-w-0" value="">
              <option value="">ทุกช่วงวันที่</option>
            </Select>
            <Select surface="raised" aria-label="ช่องทาง" className="min-w-0" value="">
              <option value="">ทุกช่องทาง</option>
            </Select>
            <Select surface="raised" aria-label="ประเภท" className="min-w-0" value="">
              <option value="">ทุกประเภท</option>
            </Select>
          </div>
          <p className="self-end whitespace-nowrap text-xs tabular-nums text-muted">
            {jobs.length} ออเดอร์
          </p>
        </Toolbar>
        {device === "desktop" ? (
          <OrdersTable jobs={sorted} />
        ) : (
          <MobileOrderCards jobs={sorted} />
        )}
      </PageBlock>

      <PageBlock
        route="/production"
        title="ควบคุมการผลิต"
        action={
          <Button variant="outline" size="sm">
            งานผลิต
            <ChevronDown />
          </Button>
        }
      >
        <Toolbar>
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            {WORKLIST_LENSES.map((lens, index) => (
              <button
                key={lens}
                type="button"
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm transition-colors",
                  FOCUS_BUTTON,
                  index === 0
                    ? ACTIVE_UNDERLINE
                    : "border-transparent font-medium text-muted hover:text-secondary",
                )}
              >
                {index === 0 ? <ListFilter className="h-4 w-4" aria-hidden="true" /> : null}
                {lens}
              </button>
            ))}
          </div>
          <SearchInput
            surface="raised"
            placeholder="ค้นหางานผลิต..."
            containerClassName={device === "desktop" ? "max-w-xs" : "w-full"}
            readOnly
          />
        </Toolbar>
        {device === "desktop" ? (
          <ProductionTable jobs={productionJobs} />
        ) : (
          <MobileProductionCards jobs={productionJobs} />
        )}
      </PageBlock>
    </div>
  );
}
