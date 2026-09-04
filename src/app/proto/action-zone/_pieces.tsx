"use client";

/**
 * ชิ้นส่วนที่กำลังเทียบ = โซนลงมือของ "ขั้นที่เลือก" ในใบผลิต (เบสส่งรูป 09-03: "CTA ดูเยอะ อัดกัน")
 * กรอบการ์ดขั้น (หัว · ชิป · ตัวเลข · ข้อกำหนด) = ของจริงชุดเดิม · เทียบเฉพาะ "ปุ่มอยู่ตรงไหน กี่ปุ่ม น้ำหนักแค่ไหน"
 */

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, CircleCheck, Clock, Ellipsis, Pencil, Printer, UserRound, Wrench } from "lucide-react";
import { ActionZone } from "@/components/ui/action-zone";
import { Button } from "@/components/ui/button";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

export type StepState = "waiting" | "ready" | "problem" | "done";

export type StepSample = {
  key: StepState;
  label: string;
  title: string;
  chip: { label: string; tone: "neutral" | "info" | "error" | "success"; strong: boolean };
  owner: string | null;
  qty: { done: number; total: number };
  startedAt: string | null;
  completedAt: string | null;
  /** ประโยคบอกเงื่อนไข (ของจริง = blockedReason) */
  note: string | null;
  /** ปุ่มหลักถ้ามี */
  primary: string | null;
};

export const SAMPLES: readonly StepSample[] = [
  { key: "waiting", label: "รอขั้นก่อนหน้า (ตัวที่เบสส่งรูป)", title: "รีดร้อน", chip: { label: "รอ", tone: "neutral", strong: false }, owner: null, qty: { done: 0, total: 240 }, startedAt: null, completedAt: null, note: "รอเสื้อ — เตรียมเสื้อ/งานร้านนอกยังไม่จบ", primary: null },
  { key: "ready", label: "กำลังทำ ลงมือได้", title: "รีดร้อน", chip: { label: "กำลังทำ", tone: "info", strong: true }, owner: "บาส", qty: { done: 96, total: 240 }, startedAt: "30 ส.ค. 09:10", completedAt: null, note: null, primary: "บันทึกยอด / ปิดขั้น" },
  { key: "problem", label: "ติดปัญหา", title: "เตรียมเสื้อ — เบิกจากสต๊อก", chip: { label: "ติดปัญหา", tone: "error", strong: true }, owner: "เนส", qty: { done: 180, total: 240 }, startedAt: "27 ส.ค. 09:10", completedAt: null, note: "ติดปัญหาอยู่ — ต้องปลดก่อน ช่างถึงทำต่อได้", primary: null },
  { key: "done", label: "ผ่านแล้ว", title: "พิมพ์ฟิล์ม DTF", chip: { label: "ผ่านแล้ว", tone: "success", strong: false }, owner: "บาส", qty: { done: 240, total: 240 }, startedAt: "28 ส.ค. 08:40", completedAt: "28 ส.ค. 11:30", note: "ปิดขั้นแล้ว 28 ส.ค. 11:30 · โดย บาส", primary: null },
];

const STANDARDS = ["ตั้งอุณหภูมิ/เวลา/แรงกดตามค่าของลายในใบงาน", "รีดตัวอย่าง 1 ตัว ตรวจตำแหน่งเทียบม็อกอัพก่อนรีดทั้งล็อต", "เช็คการลอกหลังเย็น 1 ตัวต่อ 50 ตัว"];

/* ───────────────────────── กรอบการ์ดขั้น (ของจริง) ───────────────────────── */

export function StepFrame({ step, headerAction, children }: { step: StepSample; headerAction?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Section
      title={step.title}
      meta={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <InfoChip size="md" tone={step.chip.tone} strong={step.chip.strong} icon={Wrench}>
            {step.chip.label}
          </InfoChip>
          <InfoChip size="md" icon={Printer}>
            พิมพ์ DTF / รีดร้อน
          </InfoChip>
        </span>
      }
      action={
        headerAction ?? (
          step.owner ? (
            <span className="inline-flex items-center gap-1.5 text-secondary">
              <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              {step.owner}
            </span>
          ) : (
            <span className="text-muted">ยังไม่มีคนรับ</span>
          )
        )
      }
      tone="production"
    >
      <div className="space-y-5">
        <FactList columns={3}>
          <div>
            <Metric label="ทำแล้ว" value={step.qty.done.toLocaleString("th-TH")} unit={`/ ${step.qty.total.toLocaleString("th-TH")} ตัว`} size="lg" tone={step.qty.done >= step.qty.total ? "success" : "default"} />
          </div>
          <Fact label="เริ่มเมื่อ" value={step.startedAt ?? "ยังไม่เริ่ม"} tone={step.startedAt ? "default" : "muted"} />
          <Fact label="เสร็จเมื่อ" value={step.completedAt ?? "ยังไม่เสร็จ"} tone={step.completedAt ? "success" : "muted"} />
        </FactList>
        <div>
          <p className="text-xs font-medium text-muted">ข้อกำหนดมาตรฐานของขั้นนี้</p>
          <ul className="mt-1.5 space-y-1">
            {STANDARDS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="text-strong">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {children}
      </div>
    </Section>
  );
}

/* ───────────────────────── เมนูรวม (Radix dropdown ตัวจริง — ยังไม่มี wrapper กลาง) ───────────────────────── */

type MenuItem = { label: string; icon: LucideIcon; danger?: boolean; disabled?: boolean };

export function MoreMenu({ items, label = "เพิ่มเติม" }: { items: MenuItem[]; label?: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" aria-label={label}>
          <Ellipsis /> {label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={cn("card-surface z-50 min-w-56 p-2 text-sm", RADIUS.inner)}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-interactive-hover data-[disabled]:cursor-default data-[disabled]:opacity-50",
                  item.danger ? "text-red-700 dark:text-red-300" : "text-strong",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", item.danger ? "text-red-600 dark:text-red-400" : "text-muted")} aria-hidden="true" />
                {item.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const FIX_ITEMS: MenuItem[] = [
  { label: "แก้ยอดที่บันทึก", icon: Pencil },
  { label: "เปลี่ยนคนทำ", icon: UserRound },
  { label: "พักงานนี้ไว้ก่อน", icon: Clock },
  { label: "คืนกลับคิวพร้อมทำ", icon: Wrench },
  { label: "ผ่านขั้นนี้แทนช่าง", icon: CircleCheck, danger: true },
];

/* ───────────────────────── ปัจจุบัน ───────────────────────── */

export function ZoneNow({ step, boss }: { step: StepSample; boss: boolean }) {
  const done = step.key === "done";
  return (
    <ActionZone note={step.note ?? undefined}>
      {step.primary ? (
        <Button>{step.primary}</Button>
      ) : (
        <Button variant="outline" disabled>
          ลงมือไม่ได้ตอนนี้
        </Button>
      )}
      {!done ? <Button variant="outline">บันทึกรายละเอียด</Button> : null}
      {!done && step.key !== "problem" ? (
        <Button variant="outline">
          <AlertTriangle /> แจ้งปัญหา
        </Button>
      ) : null}
      {boss && !done ? (
        <Button variant="outline">
          <Wrench /> แก้ให้
        </Button>
      ) : null}
    </ActionZone>
  );
}

/* ───────────────────────── A · หนึ่งปุ่มหลัก + เมนูรวม ───────────────────────── */

const STATUS_ICON: Record<StepState, LucideIcon> = { waiting: Clock, ready: Wrench, problem: AlertTriangle, done: CircleCheck };
const STATUS_INK: Record<StepState, string> = { waiting: "text-muted", ready: "text-blue-600 dark:text-blue-400", problem: "text-red-600 dark:text-red-400", done: "text-green-600 dark:text-green-400" };

/** ประโยคสถานะเต็มแถวอยู่บน (ไม่มีปุ่มที่กดไม่ได้) → แถวปุ่ม: ปุ่มหลัก 1 · แจ้งปัญหา (เบา) · เพิ่มเติม (เมนูรวม บันทึกรายละเอียด + แก้ให้) */
export function ZoneA({ step, boss }: { step: StepSample; boss: boolean }) {
  const done = step.key === "done";
  const Icon = STATUS_ICON[step.key];
  const status = step.note ?? (step.primary ? "ติ๊กข้อกำหนดครบแล้ว ปิดขั้นได้" : null);
  const primary = step.primary ?? (step.key === "problem" && boss ? "ปลดปัญหา / เปลี่ยนคน" : null);
  const items: MenuItem[] = [{ label: "บันทึกรายละเอียด", icon: Pencil }, ...(boss ? FIX_ITEMS : [])];
  return (
    <div className={cn("space-y-3", SUNK_PANEL, RADIUS.surface, "p-3")}>
      {status ? (
        <p className={cn("flex items-start gap-2 text-sm", done ? "text-secondary" : "text-strong")}>
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_INK[step.key])} aria-hidden="true" />
          <span>{status}</span>
        </p>
      ) : null}
      {!done ? (
        <div className="flex flex-wrap items-center gap-2">
          {primary ? <Button variant={step.key === "problem" ? "destructive" : "default"}>{primary}</Button> : null}
          {step.key !== "problem" ? (
            <Button variant="ghost">
              <AlertTriangle /> แจ้งปัญหา
            </Button>
          ) : null}
          <span className="ml-auto">
            <MoreMenu items={items} />
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── B · ปุ่มหลักขึ้นหัวการ์ด ───────────────────────── */

/** ปุ่มหลักตัวเดียวอยู่มุมขวาบนของการ์ดขั้น (ตาเจอก่อน) · ล่างเหลือแถบสถานะเงียบ ๆ + ลิงก์รอง */
export function headerActionB(step: StepSample, boss: boolean) {
  if (step.primary) return <Button>{step.primary}</Button>;
  if (step.key === "problem" && boss) return <Button variant="destructive">ปลดปัญหา / เปลี่ยนคน</Button>;
  return undefined;
}

export function ZoneB({ step, boss }: { step: StepSample; boss: boolean }) {
  const done = step.key === "done";
  const Icon = STATUS_ICON[step.key];
  const status = step.note ?? (step.owner ? `${step.owner} กำลังทำ — ปิดขั้นได้จากปุ่มมุมขวาบน` : null);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-divider pt-3")}>
      <p className="flex min-w-0 items-start gap-2 text-sm text-secondary">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_INK[step.key])} aria-hidden="true" />
        <span>{status}</span>
      </p>
      {!done ? (
        <span className="flex flex-wrap items-center gap-1">
          {step.key !== "problem" ? (
            <Button variant="ghost" size="sm">
              แจ้งปัญหา
            </Button>
          ) : null}
          <Button variant="ghost" size="sm">
            บันทึกรายละเอียด
          </Button>
          {boss ? (
            <Button variant="ghost" size="sm">
              <Wrench /> แก้ให้
            </Button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
