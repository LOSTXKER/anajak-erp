import { describe, expect, it } from "vitest";
import {
  FACTORY_STATIONS,
  FACTORY_STATION_KEYS,
  buildFactoryStationQueue,
  factoryStationKeyForOrderStatus,
  factoryStationKeyForStep,
} from "@/lib/factory-station";

describe("factory station model", () => {
  it("ล็อก 5 สถานีหน้างานตาม flow ผลิต → QC → แพ็กสุดท้าย", () => {
    expect(FACTORY_STATION_KEYS).toEqual([
      "prep",
      "dtf-print",
      "heat-press",
      "qc",
      "final-pack",
    ]);
    expect(FACTORY_STATIONS.map((station) => station.label)).toEqual([
      "เตรียมเสื้อ",
      "พิมพ์ DTF",
      "รีดร้อน",
      "QC",
      "แพ็กสุดท้าย",
    ]);
  });

  it.each([
    ["GARMENT_PICK", "prep"],
    ["GARMENT_RECEIVE", "prep"],
    ["DTF_PRINT", "dtf-print"],
    ["HEAT_PRESS", "heat-press"],
    ["PACKAGING", null],
    ["SCREEN_PRINTING", null],
  ])("map step %s ไปสถานี %s", (stepType, station) => {
    expect(factoryStationKeyForStep(stepType)).toBe(station);
  });

  it("แยก QC และแพ็กสุดท้ายจาก internal status ไม่ปลอมเป็น production step", () => {
    expect(factoryStationKeyForOrderStatus("QUALITY_CHECK")).toBe("qc");
    expect(factoryStationKeyForOrderStatus("PACKING")).toBe("final-pack");
    expect(factoryStationKeyForOrderStatus("PRODUCING")).toBeNull();
  });
});

describe("buildFactoryStationQueue", () => {
  const entries = [
    {
      key: "ready-later",
      station: "heat-press" as const,
      orderId: "order-1",
      productionId: "prod-1",
      stepId: "step-1",
      orderNumber: "ORD-2",
      deadline: "2026-08-20T00:00:00.000Z",
      priority: "NORMAL",
      status: "PENDING",
      qtyDone: 0,
      qtyTotal: 100,
    },
    {
      key: "working",
      station: "heat-press" as const,
      orderId: "order-2",
      productionId: "prod-2",
      stepId: "step-2",
      orderNumber: "ORD-1",
      deadline: "2026-08-21T00:00:00.000Z",
      priority: "NORMAL",
      status: "IN_PROGRESS",
      qtyDone: 40,
      qtyTotal: 100,
    },
    {
      key: "ready-sooner",
      station: "heat-press" as const,
      orderId: "order-3",
      productionId: "prod-3",
      stepId: "step-3",
      orderNumber: "ORD-3",
      deadline: "2026-08-18T00:00:00.000Z",
      priority: "URGENT",
      status: "PENDING",
      qtyDone: 0,
      qtyTotal: 50,
    },
    {
      key: "blocked",
      station: "heat-press" as const,
      orderId: "order-4",
      productionId: "prod-4",
      stepId: "step-4",
      orderNumber: "ORD-4",
      deadline: null,
      priority: "HIGH",
      status: "ON_HOLD",
      qtyDone: 10,
      qtyTotal: 20,
    },
    {
      key: "completed",
      station: "heat-press" as const,
      orderId: "order-5",
      productionId: "prod-5",
      stepId: "step-5",
      orderNumber: "ORD-5",
      deadline: null,
      priority: "NORMAL",
      status: "COMPLETED",
      qtyDone: 20,
      qtyTotal: 20,
    },
    {
      key: "other-station",
      station: "dtf-print" as const,
      orderId: "order-6",
      productionId: "prod-6",
      stepId: "step-6",
      orderNumber: "ORD-6",
      deadline: null,
      priority: "NORMAL",
      status: "PENDING",
      qtyDone: 0,
      qtyTotal: 20,
    },
  ];

  it("แบ่งกำลังทำ/พร้อมทำ/ติดปัญหา และไม่เอางานจบหรือคนละสถานี", () => {
    const queue = buildFactoryStationQueue("heat-press", entries);

    expect(queue.active.map((entry) => entry.key)).toEqual(["working"]);
    expect(queue.ready.map((entry) => entry.key)).toEqual(["ready-sooner", "ready-later"]);
    expect(queue.blocked.map((entry) => entry.key)).toEqual(["blocked"]);
  });

  it("ไม่ยุบงานคนละใบผลิตของออเดอร์เดียวกัน", () => {
    const sameOrder = entries.slice(0, 2).map((entry) => ({
      ...entry,
      orderId: "order-shared",
      status: "PENDING",
    }));

    expect(buildFactoryStationQueue("heat-press", sameOrder).ready).toHaveLength(2);
  });

  it("งานไม่มีกำหนดส่งยังเรียงด่วนก่อนโดยไม่โดน Infinity ทำลำดับหาย", () => {
    const noDeadline = [
      { ...entries[0], key: "low", deadline: null, priority: "LOW" },
      { ...entries[0], key: "urgent", deadline: null, priority: "URGENT" },
    ];

    expect(buildFactoryStationQueue("heat-press", noDeadline).ready.map((entry) => entry.key)).toEqual([
      "urgent",
      "low",
    ]);
  });
});
