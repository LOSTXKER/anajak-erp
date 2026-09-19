import { describe, expect, it } from "vitest";

import { problemAge, waitingOnText } from "./production-problems-page";

const NOW = Date.parse("2026-09-20T10:00:00+07:00");

type Problem = Parameters<typeof waitingOnText>[0];

function problem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: "x1",
    legacy: false,
    title: "ฟิล์มลอกหลังรีด",
    detail: null,
    blocksStep: true,
    state: "OPEN",
    source: "STATION",
    reportedAt: new Date(NOW - 3_600_000),
    acknowledgedAt: null,
    resolvedAt: null,
    resolution: null,
    raisedByName: "บาส",
    ownerName: null,
    scrapQty: 3,
    productionId: "prod-1",
    stepId: "step-1",
    stepLabel: "รีดร้อน",
    orderId: "order-1",
    orderNumber: "ORD-2609-0031",
    customerName: "นอร์ทสตาร์",
    deadline: new Date(NOW + 86_400_000),
    ...overrides,
  } as Problem;
}

describe("คิวปัญหาบอกอายุของเรื่อง", () => {
  it("นับเป็นชั่วโมงจนครบวัน — เรื่องที่เพิ่งแจ้งต้องไม่ขึ้นว่า 0 วัน", () => {
    expect(problemAge(new Date(NOW - 60_000), NOW)).toBe("เพิ่งแจ้ง");
    expect(problemAge(new Date(NOW - 5 * 3_600_000), NOW)).toBe("5 ชม.");
    expect(problemAge(new Date(NOW - 26 * 3_600_000), NOW)).toBe("1 วัน");
    expect(problemAge(new Date(NOW - 3 * 86_400_000), NOW)).toBe("3 วัน");
  });

  it("เวลาในอนาคต (นาฬิกาเครื่องเพี้ยน) ต้องไม่ได้ตัวเลขติดลบ", () => {
    expect(problemAge(new Date(NOW + 86_400_000), NOW)).toBe("เพิ่งแจ้ง");
  });
});

describe("คิวปัญหาบอกว่าตอนนี้รอใคร", () => {
  it("ยังไม่มีใครรับ = รอหัวหน้ารับเรื่อง", () => {
    expect(waitingOnText(problem())).toBe("รอหัวหน้ารับเรื่อง");
  });

  it("รับเรื่องแล้วบอกชื่อคนที่ถือเรื่องอยู่", () => {
    expect(waitingOnText(problem({ acknowledgedAt: new Date(NOW), ownerName: "พี่ก้อย" }))).toBe("พี่ก้อย กำลังแก้");
    expect(waitingOnText(problem({ acknowledgedAt: new Date(NOW) }))).toBe("หัวหน้ากำลังแก้");
  });

  it("ปิดแล้วบอกว่าตัดสินว่าอะไร", () => {
    expect(waitingOnText(problem({ resolvedAt: new Date(NOW), resolution: "เปลี่ยนหัวรีดแล้ว" }))).toBe("เปลี่ยนหัวรีดแล้ว");
    expect(waitingOnText(problem({ resolvedAt: new Date(NOW) }))).toBe("ปิดแล้ว");
  });
});
