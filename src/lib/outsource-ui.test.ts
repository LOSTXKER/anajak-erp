import { describe, expect, it } from "vitest";
import {
  isOutsourceOverdue,
  outsourceActionAvailability,
  outsourceQueueForStatus,
  outsourceStatusMeta,
  sortOutsourceByExpectedReturn,
} from "./outsource-ui";

describe("outsource UI policy", () => {
  it("แบ่งคิวตามจังหวะส่งร้าน รับกลับ และ QC", () => {
    expect(outsourceQueueForStatus("DRAFT")).toBe("send");
    expect(outsourceQueueForStatus("SENT")).toBe("receive");
    expect(outsourceQueueForStatus("IN_PROGRESS")).toBe("receive");
    expect(outsourceQueueForStatus("COMPLETED")).toBe("receive");
    expect(outsourceQueueForStatus("RECEIVED_BACK")).toBe("qc");
    expect(outsourceQueueForStatus("QC_PASSED")).toBe("done");
    expect(outsourceQueueForStatus("QC_FAILED")).toBe("done");
  });

  it("คืนป้ายสถานะจากแหล่งเดียว และมี fallback สำหรับข้อมูลเก่า", () => {
    expect(outsourceStatusMeta("RECEIVED_BACK")).toEqual({
      label: "รับกลับแล้ว รอตรวจรับ",
      variant: "warning",
    });
    expect(outsourceStatusMeta("LEGACY")).toEqual({
      label: "LEGACY",
      variant: "default",
    });
  });

  it("เปิดปุ่มจาก availableCommands ของ server เท่านั้น", () => {
    expect(
      outsourceActionAvailability(["share", "markSent"]),
    ).toMatchObject({
      canShare: true,
      canMarkSent: true,
      canCancelDraft: false,
      canReceiveBack: false,
      canPassQc: false,
    });

    expect(
      outsourceActionAvailability(["share", "passQc", "failQc"]),
    ).toMatchObject({
      canShare: true,
      canMarkSent: false,
      canReceiveBack: false,
      canPassQc: true,
      canFailQc: true,
    });

    expect(
      outsourceActionAvailability([]),
    ).toEqual({
      canShare: false,
      canMarkSent: false,
      canReceiveBack: false,
      canPassQc: false,
      canFailQc: false,
      canCancelDraft: false,
    });

    expect(
      outsourceActionAvailability(["cancelDraft"]),
    ).toMatchObject({ canCancelDraft: true });
  });

  it("ปิดทุกปุ่มเมื่อข้อมูล cache ไม่สดโดยไม่เดากติกาจาก status", () => {
    expect(
      outsourceActionAvailability(
        ["share", "markSent", "cancelDraft"],
        { enabled: false },
      ),
    ).toEqual({
      canShare: false,
      canMarkSent: false,
      canReceiveBack: false,
      canPassQc: false,
      canFailQc: false,
      canCancelDraft: false,
    });
  });

  it("นับเลยกำหนดหลังสิ้นวัน และไม่นับใบที่รับกลับแล้ว", () => {
    const due = new Date(2026, 6, 11, 9, 0, 0);
    expect(
      isOutsourceOverdue(
        { expectedBackAt: due, status: "SENT" },
        new Date(2026, 6, 11, 23, 59, 59, 999)
      )
    ).toBe(false);
    expect(
      isOutsourceOverdue(
        { expectedBackAt: due, status: "SENT" },
        new Date(2026, 6, 12, 0, 0, 0)
      )
    ).toBe(true);
    expect(
      isOutsourceOverdue(
        { expectedBackAt: due, status: "RECEIVED_BACK" },
        new Date(2026, 6, 12, 0, 0, 0)
      )
    ).toBe(false);
  });

  it("เรียงคิวรับกลับโดยเอางานเลยกำหนดและวันที่ใกล้สุดขึ้นก่อน", () => {
    const now = new Date(2026, 6, 12, 9, 0, 0);
    const orders = [
      { id: "no-date", status: "SENT", expectedBackAt: null },
      { id: "later", status: "SENT", expectedBackAt: new Date(2026, 6, 15) },
      { id: "overdue", status: "SENT", expectedBackAt: new Date(2026, 6, 10) },
      { id: "nearer", status: "SENT", expectedBackAt: new Date(2026, 6, 13) },
    ];

    expect(sortOutsourceByExpectedReturn(orders, now).map((order) => order.id)).toEqual([
      "overdue",
      "nearer",
      "later",
      "no-date",
    ]);
  });
});
