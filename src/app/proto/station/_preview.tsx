"use client";

import { useProtoVariant } from "../_kit/use-proto-variant";
import { STATION_KEYS, type StationKey } from "./_data";
import type { ProtoNav, Role, Screen } from "./_pieces";
import { DispatchVariant } from "./_variants/dispatch";
import { QueueVariant } from "./_variants/queue";
import { RemovedVariant } from "./_variants/removed";
import { WorkOrderVariant } from "./_variants/workorder";

export const OPTIONS = [
  { value: "removed", label: "ที่ถอดไป (สรุป)" },
  { value: "queue", label: "A · หยิบงานเอง" },
  { value: "dispatch", label: "B · หัวหน้าจ่ายงาน" },
  { value: "workorder", label: "C · ใบผลิตเป็นศูนย์กลาง" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

export const ROLE_OPTIONS = [
  { value: "worker", label: "พนักงาน" },
  { value: "boss", label: "หัวหน้า" },
] as const;
export const ROLE_VALUES = ROLE_OPTIONS.map((o) => o.value) as readonly Role[];

const SCREENS = ["pick", "queue", "job"] as const satisfies readonly Screen[];
const JOB_IDS = ["", "j-0042", "j-0066", "j-0070", "j-0051", "j-0058", "j-0061", "j-0055", "j-0049", "j-0048", "j-0039", "j-0044", "j-0037", "j-0072", "j-0062", "j-0064"] as const;

/** สถานะการเดิน (สถานี · ชั้นจอ · ใบที่เปิด) อยู่ใน URL — ลิงก์พกได้ว่าเบสกดอยู่ตรงไหน */
export function useProtoNav(): ProtoNav {
  const [station, setStation] = useProtoVariant<StationKey>("st", STATION_KEYS, "press");
  const [screen, setScreen] = useProtoVariant<Screen>("s", SCREENS, "pick");
  const [jobId, setJobId] = useProtoVariant<(typeof JOB_IDS)[number]>("job", JOB_IDS, "");
  return {
    station,
    setStation,
    screen,
    setScreen,
    jobId,
    setJobId: (id) => setJobId((JOB_IDS as readonly string[]).includes(id) ? (id as (typeof JOB_IDS)[number]) : ""),
  };
}

export function Preview({ variant, role, empty, nav }: { variant: Variant; role: Role; empty: boolean; nav: ProtoNav }) {
  if (variant === "removed") return <RemovedVariant />;
  if (variant === "queue") return <QueueVariant role={role} empty={empty} nav={nav} />;
  if (variant === "dispatch") return <DispatchVariant role={role} empty={empty} nav={nav} />;
  return <WorkOrderVariant role={role} empty={empty} nav={nav} />;
}
