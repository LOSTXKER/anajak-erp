import { describe, expect, it, vi } from "vitest";
import {
  bucketDeadlines,
  computeOnTime,
  describeHomeOrderRow,
  getHomeOverview,
  summarizePressGate,
  type HomeOrderRow,
} from "./home-overview";

// จันทร์ 14 ก.ย. 2569 10:00 เวลาไทย
const NOW = new Date("2026-09-14T03:00:00.000Z");
const bkk = (iso: string) => new Date(`${iso}+07:00`);

describe("summarizePressGate — ด่านรีดร้อนรอฟิล์ม∧เสื้อ", () => {
  it("แยกใบพร้อมรีดออกจากใบที่ติดรอ และนับรอฟิล์ม/รอเสื้อแยกกัน", () => {
    const result = summarizePressGate([
      // พร้อม: ฟิล์มเสร็จ เตรียมเสื้อเสร็จ
      {
        status: "IN_PROGRESS",
        steps: [
          { stepType: "GARMENT_PICK", status: "COMPLETED" },
          { stepType: "DTF_PRINT", status: "COMPLETED" },
          { stepType: "HEAT_PRESS", status: "IN_PROGRESS" },
        ],
      },
      // รอฟิล์ม
      {
        status: "PENDING",
        steps: [
          { stepType: "GARMENT_PICK", status: "COMPLETED" },
          { stepType: "DTF_PRINT", status: "IN_PROGRESS" },
          { stepType: "HEAT_PRESS", status: "PENDING" },
        ],
      },
      // รอเสื้อจากร้านปัก (งานร้านนอกไปก่อนเสมอ)
      {
        status: "PENDING",
        steps: [
          { stepType: "GARMENT_RECEIVE", status: "COMPLETED" },
          { stepType: "EMBROIDERY", status: "IN_PROGRESS" },
          { stepType: "DTF_PRINT", status: "COMPLETED" },
          { stepType: "HEAT_PRESS", status: "PENDING" },
        ],
      },
      // ติดทั้งสองอย่าง — นับทั้งสองช่อง แต่เป็นใบเดียวใน total
      {
        status: "PENDING",
        steps: [
          { stepType: "GARMENT_PICK", status: "PENDING" },
          { stepType: "DTF_PRINT", status: "PENDING" },
          { stepType: "HEAT_PRESS", status: "PENDING" },
        ],
      },
    ]);
    expect(result).toEqual({ total: 4, active: 1, ready: 1, waitingFilm: 2, waitingGarment: 2 });
  });
});

describe("bucketDeadlines — กำหนดส่ง 7 วันตามปฏิทินไทย", () => {
  it("วันนี้เป็นช่อง 0 · เลยกำหนดรวมเป็น overdue · เกินหน้าต่างไม่นับ", () => {
    const week = bucketDeadlines(
      [
        bkk("2026-09-14T23:30:00"), // วันนี้ (ดึกแค่ไหนก็ยังวันนี้)
        bkk("2026-09-14T00:10:00"), // วันนี้
        bkk("2026-09-13T18:00:00"), // เมื่อวาน = เลยกำหนด
        bkk("2026-09-16T09:00:00"), // อีก 2 วัน
        bkk("2026-09-20T09:00:00"), // อีก 6 วัน (ช่องสุดท้าย)
        bkk("2026-09-21T09:00:00"), // อีก 7 วัน = นอกหน้าต่าง
      ],
      NOW,
    );
    expect(week.overdue).toBe(1);
    expect(week.days.map((day) => day.count)).toEqual([2, 0, 1, 0, 0, 0, 1]);
    expect(week.days[0]).toEqual({ offset: 0, count: 2 });
  });
});

describe("computeOnTime — ส่งตรงเวลา 7 วัน", () => {
  it("นับเฉพาะใบส่งที่มีกำหนดส่ง และส่งวันเดียวกับกำหนดยังนับว่าตรงเวลา", () => {
    const result = computeOnTime([
      { shippedAt: bkk("2026-09-12T15:00:00"), deadline: bkk("2026-09-12T09:00:00") }, // วันเดียวกัน = ตรง
      { shippedAt: bkk("2026-09-10T15:00:00"), deadline: bkk("2026-09-12T09:00:00") }, // ก่อนกำหนด
      { shippedAt: bkk("2026-09-13T15:00:00"), deadline: bkk("2026-09-12T09:00:00") }, // เลย 1 วัน
      { shippedAt: bkk("2026-09-13T15:00:00"), deadline: null }, // ไม่มีกำหนด ไม่นับ
      { shippedAt: null, deadline: bkk("2026-09-12T09:00:00") }, // ยังไม่ส่ง ไม่นับ
    ]);
    expect(result).toEqual({ shipped: 3, onTime: 2, rate: 67 });
  });

  it("ไม่มีใบส่งเลย = rate null ไม่ใช่ 0 หรือ 100", () => {
    expect(computeOnTime([]).rate).toBeNull();
  });
});

function orderRow(over: Partial<HomeOrderRow> = {}): HomeOrderRow {
  return {
    id: "o1",
    orderNumber: "ORD-2609-0131",
    description: "เสื้อกีฬาสี",
    deadline: bkk("2026-09-12T09:00:00"),
    totalAmount: 48000,
    customerStatus: "IN_PRODUCTION",
    internalStatus: "PRODUCING",
    updatedAt: bkk("2026-09-13T09:00:00"),
    customer: { name: "ครูแอน", company: "โรงเรียนอนุบาลบ้านรัก" },
    items: [
      {
        description: "",
        totalQuantity: 300,
        products: [{ description: "เสื้อคอกลม" }],
        prints: [{ printType: "SILK_SCREEN" }],
      },
    ],
    designs: [],
    revisions: [],
    productions: [
      {
        steps: [
          { stepType: "GARMENT_PICK", customStepName: null, status: "COMPLETED", assignedTo: null, outsourceOrders: [] },
          {
            stepType: "SCREEN_PRINTING",
            customStepName: null,
            status: "IN_PROGRESS",
            assignedTo: null,
            outsourceOrders: [{ expectedBackAt: bkk("2026-09-12T09:00:00"), vendor: { name: "ร้านสกรีนบางพลี" } }],
          },
          { stepType: "HEAT_PRESS", customStepName: null, status: "PENDING", assignedTo: { name: "นนท์" }, outsourceOrders: [] },
        ],
      },
    ],
    ...over,
  } as HomeOrderRow;
}

describe("describeHomeOrderRow — แปลงออเดอร์เป็นแถวหน้าแรก", () => {
  it("อ่านขั้นที่ค้าง ร้านนอกเลยรับ จำนวนวันเลยกำหนด และป้ายชนิดงาน", () => {
    const order = describeHomeOrderRow(orderRow(), NOW, true);
    expect(order.customerName).toBe("โรงเรียนอนุบาลบ้านรัก");
    expect(order.title).toBe("เสื้อกีฬาสี");
    expect(order.printLabel).toBe("สกรีน");
    expect(order.quantity).toBe(300);
    expect(order.totalAmount).toBe(48000);
    expect(order.dueInDays).toBe(-2);
    expect(order.currentStep).toEqual({ label: "สกรีน", assigneeName: null, outsource: true });
    expect(order.stepsDone).toBe(1);
    expect(order.stepsTotal).toBe(3);
    expect(order.vendor).toEqual({ name: "ร้านสกรีนบางพลี", overdueDays: 2 });
    expect(order.stuckDays).toBe(1);
    expect(order.ready).toBe(false);
  });

  it("ไม่มีสิทธิ์เห็นเงิน = ยอดเป็น null", () => {
    expect(describeHomeOrderRow(orderRow(), NOW, false).totalAmount).toBeNull();
  });

  it("รอลูกค้าอนุมัติแบบนับเฉพาะช่วงออกแบบ และใช้ประวัติล่าสุดคำนวณวันที่นิ่ง", () => {
    const order = describeHomeOrderRow(
      orderRow({
        internalStatus: "DESIGNING",
        designs: [{ approvalStatus: "PENDING", createdAt: bkk("2026-09-12T09:00:00") }],
        updatedAt: bkk("2026-09-01T09:00:00"),
        revisions: [{ createdAt: bkk("2026-09-10T09:00:00") }],
        productions: [],
      }),
      NOW,
      true,
    );
    expect(order.waitingCustomerDays).toBe(2);
    expect(order.stuckDays).toBe(4);
    expect(order.currentStep).toBeNull();
    expect(order.vendor).toBeNull();
  });

  it("ร้านนอกที่ยังไม่ถึงกำหนดรับ = overdueDays 0", () => {
    const order = describeHomeOrderRow(
      orderRow({
        deadline: bkk("2026-09-19T09:00:00"),
        productions: [
          {
            steps: [
              {
                stepType: "EMBROIDERY",
                customStepName: null,
                status: "IN_PROGRESS",
                assignedTo: null,
                outsourceOrders: [{ expectedBackAt: bkk("2026-09-16T09:00:00"), vendor: { name: "ร้านปัก" } }],
              },
            ],
          },
        ],
      }),
      NOW,
      true,
    );
    expect(order.vendor).toEqual({ name: "ร้านปัก", overdueDays: 0 });
    expect(order.dueInDays).toBe(5);
  });
});

describe("getHomeOverview — รวมตัวเลขและ gate เงิน", () => {
  function fakePrisma() {
    return {
      order: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockImplementation(async (args: { select?: { deadline?: boolean } }) =>
          args.select && Object.keys(args.select).length === 1
            ? [{ deadline: bkk("2026-09-14T09:00:00") }, { deadline: bkk("2026-09-13T09:00:00") }]
            : [],
        ),
      },
      outsourceOrder: { count: vi.fn().mockResolvedValue(0) },
      productionStep: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      invoice: {
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { totalAmount: 38400 } }),
      },
      quotation: {
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _count: { _all: 5 }, _sum: { totalAmount: null } }),
      },
      delivery: { findMany: vi.fn().mockResolvedValue([]) },
      printRun: { count: vi.fn().mockResolvedValue(2) },
      qcRecord: { count: vi.fn().mockResolvedValue(3) },
    };
  }

  it("มีสิทธิ์เงิน: คืนยอดบิลเลยกำหนดและใบเสนอที่รอ · ยอดที่ไม่มีเป็น 0", async () => {
    const prisma = fakePrisma();
    const overview = await getHomeOverview(prisma as never, { canSeeFinance: true, now: NOW });
    expect(overview.money).toEqual({
      overdueInvoices: { count: 2, amount: 38400 },
      quotationsAwaiting: { count: 5, amount: 0 },
    });
    expect(overview.facts.printRunsToday).toBe(2);
    expect(overview.nodes.qc.checkedToday).toBe(3);
    // กำหนดส่ง: วันนี้ 1 · เลยกำหนด 1 → ส่งวันนี้และเลยกำหนดอ่านจากชุดเดียวกัน
    expect(overview.week.overdue).toBe(1);
    expect(overview.nodes.ship.dueToday).toBe(1);
    expect(overview.facts.overdueOrders).toBe(1);
  });

  it("ไม่มีสิทธิ์เงิน: ไม่ยิง aggregate เงินและคืน null", async () => {
    const prisma = fakePrisma();
    const overview = await getHomeOverview(prisma as never, { canSeeFinance: false, now: NOW });
    expect(overview.money).toBeNull();
    expect(prisma.invoice.aggregate).not.toHaveBeenCalled();
    expect(prisma.quotation.aggregate).not.toHaveBeenCalled();
  });
});
