import { describe, expect, it } from "vitest";
import { pickNewOverdueOutsource } from "./outsource-overdue";

const now = new Date("2026-09-16T08:00:00+07:00");
const at = (iso: string) => new Date(`${iso}+07:00`);

describe("pickNewOverdueOutsource", () => {
  it("เลือกเฉพาะใบที่อยู่ที่ร้าน นัดรับก่อนวันนี้ตามวันไทย และยังไม่เคยแจ้ง", () => {
    const orders = [
      { id: "late", status: "SENT", expectedBackAt: at("2026-09-15T00:00:00") },
      { id: "today", status: "IN_PROGRESS", expectedBackAt: at("2026-09-16T00:00:00") },
      { id: "back", status: "RECEIVED_BACK", expectedBackAt: at("2026-09-10T00:00:00") },
      { id: "draft", status: "DRAFT", expectedBackAt: at("2026-09-10T00:00:00") },
      { id: "noDate", status: "SENT", expectedBackAt: null },
      { id: "done", status: "COMPLETED", expectedBackAt: at("2026-09-14T23:00:00") },
      { id: "seen", status: "SENT", expectedBackAt: at("2026-09-01T00:00:00") },
    ];
    expect(pickNewOverdueOutsource(orders, new Set(["seen"]), now).map((o) => o.id)).toEqual(["late", "done"]);
  });
});
