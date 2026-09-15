import { describe, expect, it } from "vitest";
import { metricMonths, summarizeProductionMetrics, type ProductionMetricsInput } from "./production-metrics";

const now = new Date("2026-09-16T10:00:00+07:00");
const base: ProductionMetricsInput = { now, monthIndex: 5, orders: [], qc: [], steps: [], outsource: [], productions: [] };
const at = (iso: string) => new Date(`${iso}+07:00`);

describe("production metrics", () => {
  it("นับเดือนตามเวลาไทย ย้อน 6 เดือนข้ามปีได้", () => {
    const months = metricMonths(now);
    expect(months.map((m) => m.key)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(metricMonths(new Date("2026-01-01T00:30:00+07:00"))[0]!.key).toBe("2025-08");
    // 31 ส.ค. 23:30 เวลาไทย ยังเป็นเดือนสิงหาคม แม้ UTC จะเป็นวันเดียวกัน
    expect(metricMonths(new Date("2026-08-31T23:30:00+07:00")).at(-1)!.key).toBe("2026-08");
  });

  it("งวดว่างไม่หารศูนย์ และคืน null แทนเปอร์เซ็นต์", () => {
    const result = summarizeProductionMetrics(base);
    expect(result.onTime.percent).toBeNull();
    expect(result.firstPass.percent).toBeNull();
    expect(result.cycleDays.average).toBeNull();
    expect(result.defects.total).toBe(0);
    expect(result.trend).toHaveLength(6);
  });

  it("ส่งตรงเวลาเทียบวันไทย ไม่นับยกเลิก/ไม่มีกำหนด/ยังไม่ส่ง และใช้วันส่งครั้งล่าสุด", () => {
    const result = summarizeProductionMetrics({
      ...base,
      orders: [
        { orderNumber: "A", customerName: "ก", internalStatus: "SHIPPED", deadline: at("2026-09-10T00:00:00"), shippedAt: [at("2026-09-10T22:00:00")] },
        { orderNumber: "B", customerName: "ข", internalStatus: "COMPLETED", deadline: at("2026-09-05T00:00:00"), shippedAt: [at("2026-09-04T10:00:00"), at("2026-09-07T10:00:00")] },
        { orderNumber: "C", customerName: "ค", internalStatus: "CANCELLED", deadline: at("2026-09-05T00:00:00"), shippedAt: [at("2026-09-09T10:00:00")] },
        { orderNumber: "D", customerName: "ง", internalStatus: "SHIPPED", deadline: null, shippedAt: [at("2026-09-09T10:00:00")] },
        { orderNumber: "E", customerName: "จ", internalStatus: "PRODUCING", deadline: at("2026-09-05T00:00:00"), shippedAt: [] },
        { orderNumber: "F", customerName: "ฉ", internalStatus: "SHIPPED", deadline: at("2026-08-20T00:00:00"), shippedAt: [at("2026-08-19T10:00:00")] },
      ],
    });
    expect(result.onTime).toMatchObject({ counted: 2, onTime: 1, percent: 50, previousPercent: 100 });
    expect(result.late).toEqual([{ orderNumber: "B", customerName: "ข", daysLate: 2 }]);
  });

  it("ทำถูกครั้งแรก = ดี ÷ (ดี + เสีย) และรวมของเสียตามสาเหตุ/ไซซ์ในงวด", () => {
    const result = summarizeProductionMetrics({
      ...base,
      qc: [
        { checkedAt: at("2026-09-02T10:00:00"), qtyGood: 97, qtyDefect: 3, defects: [{ qty: 2, reason: "PRINT_PEEL", size: "L" }, { qty: 1, reason: "COLOR_OFF", size: null }] },
        { checkedAt: at("2026-08-02T10:00:00"), qtyGood: 50, qtyDefect: 0, defects: [] },
      ],
    });
    expect(result.firstPass).toMatchObject({ percent: 97, good: 97, total: 100, previousPercent: 100 });
    expect(result.defects.byReason[0]).toMatchObject({ reason: "PRINT_PEEL", qty: 2 });
    expect(result.defects.bySize).toEqual([{ size: "L", qty: 2 }, { size: "ไม่ระบุ", qty: 1 }]);
  });

  it("เวลาต่อขั้นนับเฉพาะขั้นที่กดเริ่ม · ใบผลิตนับรอบเวลาเมื่อทุกขั้นปิดแล้ว", () => {
    const result = summarizeProductionMetrics({
      ...base,
      steps: [
        { stepType: "HEAT_PRESS", customStepName: null, startedAt: at("2026-09-03T09:00:00"), completedAt: at("2026-09-03T11:00:00") },
        { stepType: "HEAT_PRESS", customStepName: null, startedAt: null, completedAt: at("2026-09-03T11:00:00") },
      ],
      outsource: [{ sentAt: at("2026-09-01T09:00:00"), receivedAt: at("2026-09-04T09:00:00") }],
      productions: [
        { createdAt: at("2026-09-01T09:00:00"), steps: [{ status: "COMPLETED", completedAt: at("2026-09-05T09:00:00") }] },
        { createdAt: at("2026-09-01T09:00:00"), steps: [{ status: "COMPLETED", completedAt: at("2026-09-05T09:00:00") }, { status: "PENDING", completedAt: null }] },
      ],
    });
    expect(result.stepTimes).toEqual(expect.arrayContaining([expect.objectContaining({ label: "รีดร้อน", value: 2, count: 1 }), expect.objectContaining({ unit: "วัน", value: 3 })]));
    expect(result.cycleDays).toEqual({ average: 4, count: 1 });
  });
});
