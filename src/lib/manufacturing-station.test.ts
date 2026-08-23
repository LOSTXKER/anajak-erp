import { describe, expect, it } from "vitest";
import {
  nextSameOrderJob,
  primaryStationCommand,
  remainingGoodQuantity,
  workCenterCodeFromStationParam,
} from "./manufacturing-station";

describe("manufacturing station policy", () => {
  it("แปลงลิงก์สถานีเดิมเป็น Work Center V2 โดยไม่ auto-start", () => {
    expect(workCenterCodeFromStationParam("dtf-print")).toBe("DTF_PRINT");
    expect(workCenterCodeFromStationParam("FINAL_QC")).toBe("FINAL_QC");
    expect(workCenterCodeFromStationParam(null)).toBeNull();
  });

  it("เลือกหนึ่ง primary action จาก availableCommands ของ server เท่านั้น", () => {
    expect(
      primaryStationCommand({
        state: "READY",
        remaining: 10,
        availableCommands: ["startOperation", "raiseException"],
      }),
    ).toBe("startOperation");
    expect(
      primaryStationCommand({
        state: "RUNNING",
        remaining: 3,
        availableCommands: ["reportOutput", "pauseOperation", "completeOperation"],
      }),
    ).toBe("reportOutput");
    expect(
      primaryStationCommand({
        state: "RUNNING",
        remaining: 0,
        availableCommands: ["reportOutput", "completeOperation"],
      }),
    ).toBe("completeOperation");
    expect(
      primaryStationCommand({
        state: "READY",
        remaining: 10,
        availableCommands: ["raiseException"],
      }),
    ).toBeNull();
    expect(
      primaryStationCommand({
        state: "READY",
        remaining: 10,
        availableCommands: ["recordQuality", "raiseException"],
      }),
    ).toBe("recordQuality");
    expect(
      primaryStationCommand({
        state: "READY",
        remaining: 1,
        availableCommands: ["reinspectQuality", "recordQuality"],
      }),
    ).toBe("reinspectQuality");
  });

  it("ของเสียและ rework ไม่ลดจำนวนของดีที่ยังขาด", () => {
    expect(remainingGoodQuantity(20, 12)).toBe(8);
    expect(remainingGoodQuantity(20, 22)).toBe(0);
  });

  it("handoff คงออเดอร์เดิมและเลือกเฉพาะงานที่ actor ลงมือได้จริง", () => {
    const jobs = [
      {
        id: "blocked",
        state: "BLOCKED",
        order: { id: "order-1" },
        quantities: { remaining: 10 },
        availableCommands: ["raiseException"],
      },
      {
        id: "other",
        state: "RUNNING",
        order: { id: "order-2" },
        quantities: { remaining: 4 },
        availableCommands: ["reportOutput"],
      },
      {
        id: "ready-not-assigned",
        state: "READY",
        order: { id: "order-1" },
        quantities: { remaining: 10 },
        availableCommands: ["raiseException"],
      },
      {
        id: "ready",
        state: "READY",
        order: { id: "order-1" },
        quantities: { remaining: 10 },
        availableCommands: ["startOperation", "raiseException"],
      },
      {
        id: "running",
        state: "RUNNING",
        order: { id: "order-1" },
        quantities: { remaining: 4 },
        availableCommands: ["reportOutput", "pauseOperation"],
      },
    ];
    expect(nextSameOrderJob(jobs, "order-1", "completed")?.id).toBe("running");
    expect(nextSameOrderJob(jobs, "missing", "completed")).toBeNull();
  });
});
