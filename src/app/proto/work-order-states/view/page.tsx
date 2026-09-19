"use client";

/** หน้าเต็มสำหรับหน้าต่างมือถือ 390 — อ่านสถานะ/บทบาทจาก URL เหมือนหน้าหลัก */
import { WorkOrderKitView } from "@/components/production/work-order-kit";

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { useProtoController } from "../_controller";
import { DEFAULT_STATE, STATE_KEYS, stateOf } from "../_fixtures";

export default function WorkOrderStateView() {
  const [key] = useProtoVariant("s", STATE_KEYS, DEFAULT_STATE);
  const [boss] = useProtoFlag("boss", true);
  const fx = stateOf(key);
  const c = useProtoController(fx, boss ? "boss" : "staff");
  return (
    <WorkOrderKitView key={`${key}:${boss ? "boss" : "staff"}`} c={c} scannedMockup={fx.flags?.scannedMockup ?? Number.NaN} />
  );
}
