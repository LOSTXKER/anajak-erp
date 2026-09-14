import { describe, expect, it } from "vitest";
import {
  describeOrderProgress,
  isAttentionStatus,
  productionStepLabel,
  type OrderProgressSource,
} from "./order-progress";
import { describeOrderAttention } from "./home-orders";

// จันทร์ 14 ก.ย. 2569 10:00 เวลาไทย
const NOW = new Date("2026-09-14T03:00:00.000Z");
const bkk = (iso: string) => new Date(`${iso}+07:00`);

function source(over: Partial<OrderProgressSource> = {}): OrderProgressSource {
  return {
    orderNumber: "ORD-2609-0142",
    internalStatus: "PRODUCING",
    deadline: bkk("2026-09-14T09:00:00"),
    updatedAt: bkk("2026-09-13T09:00:00"),
    designs: [],
    revisions: [],
    productions: [],
    ...over,
  };
}

describe("describeOrderProgress — สูตรเดียวของหน้าแรก ตารางออเดอร์ และหน้ารายละเอียด", () => {
  it("รูปทรงจาก getById: ใบผลิตไม่เรียง · ใบจ้างร้านนอกทุกสถานะ · ประวัติไม่เรียง", () => {
    const progress = describeOrderProgress(
      source({
        updatedAt: bkk("2026-09-10T09:00:00"),
        revisions: [{ createdAt: bkk("2026-09-11T09:00:00") }, { createdAt: bkk("2026-09-13T15:00:00") }],
        productions: [
          {
            createdAt: bkk("2026-09-01T09:00:00"),
            steps: [{ stepType: "GARMENT_PICK", customStepName: null, status: "IN_PROGRESS", assignedTo: null, outsourceOrders: [] }],
          },
          {
            createdAt: bkk("2026-09-10T09:00:00"),
            steps: [
              { stepType: "GARMENT_PICK", customStepName: null, status: "COMPLETED", assignedTo: null, outsourceOrders: [] },
              {
                stepType: "SCREEN_PRINTING",
                customStepName: null,
                status: "IN_PROGRESS",
                assignedTo: { name: "นนท์" },
                outsourceOrders: [
                  { status: "RECEIVED", expectedBackAt: bkk("2026-09-05T09:00:00"), vendor: { name: "ร้านที่รับกลับแล้ว" } },
                  { status: "SENT", expectedBackAt: bkk("2026-09-12T09:00:00"), vendor: { name: "ร้านสกรีนบางพลี" } },
                ],
              },
            ],
          },
        ],
      }),
      NOW,
    );
    expect(progress.stepsDone).toBe(1);
    expect(progress.stepsTotal).toBe(2);
    expect(progress.currentStep).toEqual({ label: "สกรีน", assigneeName: "นนท์", outsource: true });
    expect(progress.vendor).toEqual({ name: "ร้านสกรีนบางพลี", overdueDays: 2 });
    expect(progress.stuckDays).toBe(1);
    expect(progress.dueInDays).toBe(0);
    expect(progress.ready).toBe(false);
  });

  it("รอลูกค้าอนุมัติแบบนับเฉพาะช่วงยืนยัน/ออกแบบ", () => {
    const designs = [{ approvalStatus: "PENDING", createdAt: bkk("2026-09-12T09:00:00") }];
    expect(describeOrderProgress(source({ internalStatus: "DESIGNING", designs }), NOW).waitingCustomerDays).toBe(2);
    expect(describeOrderProgress(source({ internalStatus: "PRODUCING", designs }), NOW).waitingCustomerDays).toBeNull();
  });

  it("ใบที่จบ/ส่ง/ยกเลิกไม่มีเรื่องต้องจัดการแม้เลยกำหนด · ใบที่ยังเดินขึ้นเลยกำหนด", () => {
    const late = { deadline: bkk("2026-09-10T09:00:00") };
    for (const internalStatus of ["COMPLETED", "SHIPPED", "CANCELLED", "DRAFT"] as const) {
      expect(describeOrderAttention(describeOrderProgress(source({ ...late, internalStatus }), NOW))).toBeNull();
    }
    expect(describeOrderAttention(describeOrderProgress(source(late), NOW))?.group).toBe("late");
    expect(isAttentionStatus("ON_HOLD")).toBe(true);
  });

  it("ชื่อขั้นที่ตั้งเองมาก่อน และตัดคำว่า (ร้านนอก)", () => {
    expect(productionStepLabel({ stepType: "HEAT_PRESS", customStepName: "รีดโลโก้ (ร้านนอก)" })).toBe("รีดโลโก้");
  });
});
