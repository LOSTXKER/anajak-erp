"use client";

/**
 * ชิ้นส่วนที่กำลังเทียบในหน้าลองนี้ = "หัวใบไม่มีปุ่มลงมือ" + "การ์ดที่ยืน" (แทนโซนลงมือเดิม)
 * ของที่ไม่ได้เทียบ (ชิป ตัวเลข ป้าย ไอคอนสถานี แท็บ ตาราง) = component ตัวจริงทั้งหมด
 */

import { AlertTriangle, CalendarCheck, CheckCircle2, Factory, MonitorSmartphone, Shirt, UserRound, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { STATION_ICON, StationIcon } from "@/components/station/station-pieces";
import { ActionZone } from "@/components/ui/action-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueTag } from "@/components/ui/due-tag";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { Metric } from "@/components/ui/metric";
import { SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { summarize } from "../work-order/_data";
import { STEPS, WORK_ORDER, stationOf, whereabouts, type WorkStep } from "./_data";

/* ───────────────────────── หัวใบ — ไม่มี "แจ้งปัญหา" แล้ว (ย้ายไปจอสถานี) ───────────────────────── */

export function DeskHeader({ boss }: { boss: boolean }) {
  const sum = summarize(STEPS);
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Factory}
        tone="production"
        back={{ href: "/production", label: "กลับหน้าการผลิต" }}
        breadcrumb={[{ label: "การผลิต", href: "/production" }, { label: WORK_ORDER.orderNumber }]}
        title={WORK_ORDER.orderNumber}
        description={`${WORK_ORDER.company} · ${WORK_ORDER.contact}`}
        titleBadge={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="accent" size="sm">
              {WORK_ORDER.status}
            </Badge>
            {WORK_ORDER.priority === "HIGH" ? (
              <Badge variant="warning" size="sm">
                สำคัญ
              </Badge>
            ) : null}
          </span>
        }
        action={
          boss ? (
            <Button variant="outline">
              <UserRound /> มอบหมาย / แก้แผน
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-surface rounded-2xl p-4">
          <Metric label="จำนวนที่ต้องผลิต" value={WORK_ORDER.qty.toLocaleString("th-TH")} unit="ตัว" size="lg" icon={Shirt} />
        </div>
        <div className="card-surface rounded-2xl p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" /> กำหนดส่ง
          </p>
          <div className="mt-2">
            <DueTag dueInDays={WORK_ORDER.dueInDays} dateLabel={WORK_ORDER.dueLabel} size="lg" />
          </div>
        </div>
        <div className="card-surface rounded-2xl p-4">
          <Metric label="ผ่านแล้ว" value={`${sum.done}/${sum.total}`} unit="ขั้น" size="lg" icon={CheckCircle2} tone={sum.done === sum.total ? "success" : "default"} />
        </div>
        <div className="card-surface rounded-2xl p-4">
          <Metric label="ติดปัญหา" value={sum.problems} unit="ขั้น" size="lg" icon={AlertTriangle} tone={sum.problems > 0 ? "danger" : "muted"} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── การ์ดที่ยืน — แทนโซนลงมือ ───────────────────────── */

const HEADLINE_TONE: Record<ReturnType<typeof whereabouts>["tone"], string> = {
  info: "text-blue-700 dark:text-blue-300",
  neutral: "text-strong",
  error: "text-red-700 dark:text-red-300",
  warning: "text-amber-800 dark:text-amber-200",
  success: "text-green-700 dark:text-green-300",
};

/**
 * "งานอยู่ไหน ใครถือ แล้วฉันทำอะไรได้จากโต๊ะ" — ชั้น 1 = ประโยคที่ยืน · ชั้น 2 = สถานี/คน/ควรเสร็จ · ชั้น 3 = ปุ่มวางแผน + ทางไปจอสถานี
 * ปุ่มลงมือ (เริ่ม/ปิด/ลงยอด/แจ้งปัญหา) ไม่มีที่นี่โดยตั้งใจ
 */
export function WhereCard({ step, boss, compact = false }: { step: WorkStep; boss: boolean; compact?: boolean }) {
  const st = stationOf(step);
  const w = whereabouts(step);
  return (
    <div className={cn("rounded-xl border border-border", SUNK_PANEL, compact ? "p-4" : "p-5")}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-secondary ring-1 ring-border">
          <StationIcon stationKey={st.key} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-base font-semibold leading-snug", HEADLINE_TONE[w.tone])}>{w.headline}</p>
          {w.detail ? <p className="mt-1 text-sm text-secondary">{w.detail}</p> : null}
        </div>
      </div>
      {!compact ? (
        <FactList columns={3} className="mt-4">
          <Fact label="สถานี" value={st.label} />
          <Fact icon={UserRound} label="คนทำ" value={step.owner ?? "ยังไม่มีคนรับ"} tone={step.owner ? "default" : "muted"} />
          <Fact icon={CalendarCheck} label="ควรเสร็จ" value={step.planEnd} tone={step.state === "blocked" ? "warning" : "default"} />
        </FactList>
      ) : null}
      <ActionZone
        className="mt-4"
        note={
          step.state === "done"
            ? "ขั้นที่ปิดแล้วแก้ผลไม่ได้ — ต้องเปิดงานแก้"
            : boss
              ? "ปุ่มลงมืออยู่ที่จอสถานี · จากโต๊ะนี้แก้ได้แค่แผน"
              : "ดูได้อย่างเดียว — ลงมือที่จอสถานี"
        }
      >
        {boss && step.state !== "done"
          ? w.planActions.map((label) => (
              <Button key={label} variant="outline">
                {label}
              </Button>
            ))
          : null}
        <Button variant={step.state === "done" ? "ghost" : "default"}>
          <MonitorSmartphone /> {step.state === "done" ? "ดูที่จอสถานี" : "ไปทำที่จอสถานี"}
        </Button>
      </ActionZone>
    </div>
  );
}

/** ชิปสถานี — ใช้ในตาราง/รายการ */
export function StationChip({ step, size = "sm" }: { step: WorkStep; size?: "sm" | "md" }) {
  const st = stationOf(step);
  return (
    <InfoChip size={size} icon={STATION_ICON[st.key] ?? Wrench} className="max-w-full">
      {st.label}
    </InfoChip>
  );
}
