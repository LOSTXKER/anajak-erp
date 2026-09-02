"use client";

/**
 * A · ตารางขั้นงาน — ใบผลิตคือ "ตารางเดียว" เหมือนหน้าการผลิตที่เบสเคาะ
 * ทุกขั้นเป็นแถว คอลัมน์เดียวกันหมด (ขั้น · สถานะ · ยอด · ผู้รับผิดชอบ · แผน · ร้านนอก · ลงมือ)
 * กดแถวไหน = กางโซนลงมือมาตรฐานของขั้นนั้นใต้แถว · ปัญหาเป็นการ์ดแดงเหนือตาราง
 * ภาพรวม (ทำอะไร / ข้อมูลใบ) อยู่ล่างตาราง เพราะขั้นงานคือสิ่งที่หัวหน้ากับช่างดูบ่อยสุด
 */

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Truck } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { InfoChip } from "@/components/ui/info-chip";
import { cn } from "@/lib/utils";
import { STEPS, currentStep, type WorkStep } from "../_data";
import {
  OutsourceFacts,
  OwnerText,
  ProblemCard,
  StepQty,
  StepStateChip,
  StepWorkZone,
  WhatToMake,
  WorkOrderFacts,
  WorkOrderHeader,
} from "../_pieces";

function StepRow({ step, open, onToggle }: { step: WorkStep; open: boolean; onToggle: () => void }) {
  return (
    <Fragment>
      <DataTable.Row
        onClick={onToggle}
        aria-expanded={open}
        className={cn("cursor-pointer", step.problem && "bg-red-50/40 dark:bg-red-950/15", open && "bg-surface-muted")}
      >
        <DataTable.Td className="w-10 pr-0 text-muted">
          {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        </DataTable.Td>
        <DataTable.Td>
          <p className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium tabular-nums text-muted">
              {step.order}
            </span>
            <span className="font-medium text-strong">{step.label}</span>
          </p>
          {step.note ? <p className="mt-0.5 pl-8 text-xs text-secondary">{step.note}</p> : null}
        </DataTable.Td>
        <DataTable.Td className="whitespace-nowrap">
          <StepStateChip step={step} />
        </DataTable.Td>
        <DataTable.Td align="right" className="whitespace-nowrap">
          <StepQty step={step} />
        </DataTable.Td>
        <DataTable.Td className="whitespace-nowrap">
          <OwnerText step={step} />
        </DataTable.Td>
        <DataTable.Td className="whitespace-nowrap tabular-nums text-secondary">{step.planEnd}</DataTable.Td>
        <DataTable.Td className="max-w-56">
          {step.outsource ? (
            <div className="min-w-0">
              <p className="truncate text-secondary">{step.outsource.vendor}</p>
              <InfoChip size="sm" tone={step.outsource.backInDays < 0 ? "error" : "info"} strong={step.outsource.backInDays < 0} icon={Truck} className="mt-1">
                {step.outsource.backInDays < 0 ? `เลยนัดรับ ${Math.abs(step.outsource.backInDays)} วัน` : `กลับ ${step.outsource.backLabel}`}
              </InfoChip>
            </div>
          ) : (
            <span className="text-muted">—</span>
          )}
        </DataTable.Td>
      </DataTable.Row>
      {open ? (
        <tr className="bg-surface-muted/60">
          <td colSpan={7} className="px-4 pb-5 pt-2 sm:px-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                {step.outsource ? <OutsourceFacts step={step} /> : null}
                {step.startedAt ? (
                  <p className="text-xs text-muted">
                    เริ่ม {step.startedAt}
                    {step.completedAt ? ` · เสร็จ ${step.completedAt}` : ""}
                  </p>
                ) : null}
              </div>
              <StepWorkZone step={step} />
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

export function TableVariant({ touch }: { touch: boolean }) {
  const [openId, setOpenId] = useState<string>(() => currentStep(STEPS).id);
  const problems = STEPS.filter((s) => s.problem);
  return (
    <div className="space-y-6">
      <WorkOrderHeader steps={STEPS} />

      {problems.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {problems.map((step) => (
            <ProblemCard key={step.id} step={step} />
          ))}
        </div>
      ) : null}

      <DataTable.Root className="[&_td]:px-4 [&_th:not([aria-sort])]:px-4">
        <DataTable.Head>
          <tr>
            <DataTable.Th className="w-10" />
            <DataTable.Th>ขั้นงาน</DataTable.Th>
            <DataTable.Th>สถานะ</DataTable.Th>
            <DataTable.Th align="right">ยอด</DataTable.Th>
            <DataTable.Th>ผู้รับผิดชอบ</DataTable.Th>
            <DataTable.Th>ควรเสร็จ</DataTable.Th>
            <DataTable.Th>ร้านนอก</DataTable.Th>
          </tr>
        </DataTable.Head>
        <DataTable.Body>
          {STEPS.map((step) => (
            <StepRow key={step.id} step={step} open={openId === step.id} onToggle={() => setOpenId(openId === step.id ? "" : step.id)} />
          ))}
        </DataTable.Body>
      </DataTable.Root>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <WhatToMake compact={touch} />
        <WorkOrderFacts />
      </div>
    </div>
  );
}
