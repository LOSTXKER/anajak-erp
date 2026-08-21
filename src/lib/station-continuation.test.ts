import { describe, expect, it } from "vitest";
import {
  resolveStationContinuation,
  type StationContinuationEntry,
} from "@/lib/station-continuation";

function entry(
  overrides: Partial<StationContinuationEntry> = {},
): StationContinuationEntry {
  return {
    station: "prep",
    orderId: "order-1",
    productionId: "production-1",
    stepId: "step-prep",
    status: "ready",
    sortOrder: 0,
    ...overrides,
  };
}

describe("resolveStationContinuation", () => {
  it("ส่งต่องานเตรียมเสื้อที่จบแล้วไป DTF พร้อมทำ ก่อนงานรีดที่ติดปัญหา", () => {
    const result = resolveStationContinuation({
      currentStation: "prep",
      selection: { productionId: "production-1" },
      productionOrderId: "order-1",
      entries: [
        entry({
          station: "heat-press",
          stepId: "step-heat",
          status: "blocked",
          sortOrder: 0,
        }),
        entry({
          station: "dtf-print",
          stepId: "step-dtf",
          status: "ready",
          sortOrder: 10,
        }),
      ],
    });

    expect(result).toEqual({
      primary: entry({
        station: "dtf-print",
        stepId: "step-dtf",
        status: "ready",
        sortOrder: 10,
      }),
      alternatives: [
        entry({
          station: "heat-press",
          stepId: "step-heat",
          status: "blocked",
          sortOrder: 0,
        }),
      ],
      alternativeCount: 1,
    });
  });

  it("ไม่เสนอ handoff เมื่อ context ที่เลือกยังอยู่ในสถานีเดิม", () => {
    const result = resolveStationContinuation({
      currentStation: "prep",
      selection: { productionId: "production-1" },
      productionOrderId: "order-1",
      entries: [
        entry({ status: "active" }),
        entry({ station: "dtf-print", stepId: "step-dtf" }),
      ],
    });

    expect(result).toBeNull();
  });

  it("fallback ไป context ของออเดอร์เดิมเมื่อใบผลิตที่เลือกจบแล้ว", () => {
    const qcEntry = entry({
      station: "qc",
      productionId: null,
      stepId: null,
      status: "ready",
    });

    const result = resolveStationContinuation({
      currentStation: "heat-press",
      selection: { productionId: "production-completed" },
      productionOrderId: "order-1",
      entries: [qcEntry],
    });

    expect(result).toEqual({
      primary: qcEntry,
      alternatives: [],
      alternativeCount: 0,
    });
  });

  it("แก้ deep link ผิดสถานีด้วย context ของใบผลิตที่ยังมีอยู่", () => {
    const heatEntry = {
      ...entry({
        station: "heat-press",
        stepId: "step-heat",
        status: "active",
      }),
      orderNumber: "ORD-001",
      waitingOn: null,
    };

    const result = resolveStationContinuation({
      currentStation: "prep",
      selection: { productionId: "production-1" },
      productionOrderId: "order-1",
      entries: [heatEntry],
    });

    expect(result).toEqual({
      primary: heatEntry,
      alternatives: [],
      alternativeCount: 0,
    });
    expect(result?.primary.orderNumber).toBe("ORD-001");
  });

  it("เรียงผลเหมือนเดิมทุกครั้งและไม่นับ context ซ้ำเป็นทางเลือกเพิ่ม", () => {
    const candidates = [
      entry({
        station: "final-pack",
        productionId: null,
        stepId: null,
        status: "blocked",
        sortOrder: null,
      }),
      entry({
        station: "qc",
        productionId: null,
        stepId: null,
        status: "ready",
        sortOrder: null,
      }),
      entry({
        station: "heat-press",
        productionId: null,
        stepId: "step-b",
        status: "ready",
        sortOrder: 2,
      }),
      entry({
        station: "dtf-print",
        productionId: null,
        stepId: "step-a",
        status: "ready",
        sortOrder: 2,
      }),
      entry({
        station: "dtf-print",
        productionId: null,
        stepId: "step-a",
        status: "blocked",
        sortOrder: null,
      }),
    ];

    const resolve = (entries: StationContinuationEntry[]) =>
      resolveStationContinuation({
        currentStation: "prep",
        selection: { orderId: "order-1" },
        entries,
      });

    expect(resolve(candidates)).toEqual(resolve([...candidates].reverse()));
    expect(resolve(candidates)).toEqual({
      primary: candidates[3],
      alternatives: [candidates[2], candidates[1], candidates[0]],
      alternativeCount: 3,
    });
  });

  it("ไม่ใช้ orderId ที่ขัดกับ productionId เป็น fallback ข้ามออเดอร์", () => {
    const wrongOrderEntry = entry({
      station: "qc",
      orderId: "order-wrong",
      productionId: null,
      stepId: null,
    });

    const result = resolveStationContinuation({
      currentStation: "heat-press",
      selection: {
        productionId: "production-completed",
        orderId: "order-wrong",
      },
      productionOrderId: "order-correct",
      entries: [wrongOrderEntry],
    });

    expect(result).toBeNull();
  });

  it("คืน null เมื่อไม่เหลือ context ของใบผลิตหรือออเดอร์เดิม", () => {
    const result = resolveStationContinuation({
      currentStation: "prep",
      selection: { productionId: "production-missing" },
      productionOrderId: "order-missing",
      entries: [entry()],
    });

    expect(result).toBeNull();
  });
});
