import { describe, expect, it } from "vitest";
import {
  isOutsourceOverdue,
  outsourceActionAvailability,
  outsourceQueueForStatus,
  outsourceStatusMeta,
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
      label: "รับกลับแล้ว รอ QC",
      variant: "warning",
    });
    expect(outsourceStatusMeta("LEGACY")).toEqual({
      label: "LEGACY",
      variant: "default",
    });
  });

  it("ไม่เปิดปุ่มที่ permission ฝั่ง server จะปฏิเสธ", () => {
    expect(
      outsourceActionAvailability("DRAFT", {
        canHandleGoods: true,
        canJudgeQc: false,
        canManageSettings: false,
      })
    ).toMatchObject({
      canShare: true,
      canMarkSent: true,
      canCancelDraft: false,
      canReceiveBack: false,
      canPassQc: false,
    });

    expect(
      outsourceActionAvailability("RECEIVED_BACK", {
        canHandleGoods: true,
        canJudgeQc: true,
        canManageSettings: false,
      })
    ).toMatchObject({
      canShare: true,
      canMarkSent: false,
      canReceiveBack: false,
      canPassQc: true,
      canFailQc: true,
    });

    expect(
      outsourceActionAvailability("QC_PASSED", {
        canHandleGoods: true,
        canJudgeQc: true,
        canManageSettings: true,
      })
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
});
