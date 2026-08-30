import type { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { productionRouter } from "./production";

type StepState = {
  id: string;
  productionId: string;
  stepType: string;
  customStepName: string | null;
  status: string;
  sortOrder: number;
  qtyDone: number;
  qtyTotal: number | null;
  assignedToId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  qcPassed: boolean | null;
  qcNotes: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  executionEnabled: boolean;
};

const baseStep: StepState = {
  id: "step-1",
  productionId: "production-1",
  stepType: "HEAT_PRESS",
  customStepName: null,
  status: "IN_PROGRESS",
  sortOrder: 3,
  qtyDone: 2,
  qtyTotal: 10,
  assignedToId: "production-staff-1",
  startedAt: new Date("2026-08-20T01:00:00.000Z"),
  completedAt: null,
  qcPassed: null,
  qcNotes: null,
  notes: null,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  updatedAt: new Date("2026-08-20T01:00:00.000Z"),
  executionEnabled: false,
};

function makeHarness(options: {
  step?: Partial<StepState>;
  siblings?: StepState[];
  orderStatus?: string;
  role?: Role;
  userId?: string;
  permissionOverrides?: unknown;
  activeRun?: { runNumber: string; status: "PRINTING" | "PRINTED" } | null;
  managers?: Array<{ id: string; role: Role; permissionOverrides: unknown }>;
  assignees?: Record<
    string,
    { id: string; role: Role; permissionOverrides: unknown; isActive: boolean }
  >;
} = {}) {
  let state: StepState = { ...baseStep, ...options.step };
  const orderStatus = options.orderStatus ?? "PRODUCING";
  const userId = options.userId ?? "production-staff-1";
  const role = options.role ?? "PRODUCTION_STAFF";

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    productionStep: {
      findUniqueOrThrow: vi.fn(async () => ({ ...state })),
      findMany: vi.fn(async () => {
        const defaultSiblings: StepState[] = [
          {
            ...baseStep,
            id: "prep-1",
            stepType: "GARMENT_PICK",
            status: "COMPLETED",
            sortOrder: 1,
          },
          {
            ...baseStep,
            id: "dtf-1",
            stepType: "DTF_PRINT",
            status: "COMPLETED",
            sortOrder: 2,
          },
          state,
        ];
        return (options.siblings ?? defaultSiblings).map((step) =>
          step.id === state.id ? { ...state } : { ...step },
        );
      }),
      update: vi.fn(async ({
        data,
      }: {
        where: { id: string };
        data: Partial<StepState>;
        select: unknown;
      }) => {
        state = {
          ...state,
          ...data,
          updatedAt: new Date("2026-08-20T02:00:00.000Z"),
        };
        return { ...state };
      }),
    },
    production: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ orderId: "order-1" }),
    },
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "order-1",
        internalStatus: orderStatus,
        orderNumber: "ORD-2608-0041",
      }),
    },
    printRunItem: {
      findFirst: vi.fn().mockResolvedValue(
        options.activeRun ? { printRun: options.activeRun } : null,
      ),
    },
    outsourceOrder: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(
        options.managers ?? [
          { id: "manager-1", role: "MANAGER", permissionOverrides: null },
        ],
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        options.assignees?.[where.id] ??
        (where.id === state.assignedToId
          ? {
              id: where.id,
              role: "PRODUCTION_STAFF" as const,
              permissionOverrides: null,
              isActive: true,
            }
          : null),
      ),
    },
    notification: { create: vi.fn().mockResolvedValue({ id: "notification-1" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  const transaction = vi.fn(
    async (callback: (transaction: typeof tx) => unknown) => callback(tx),
  );
  const ctx: Context = {
    prisma: { $transaction: transaction } as unknown as Context["prisma"],
    userId,
    userRole: role,
    permissionOverrides: options.permissionOverrides ?? null,
  };

  return { ctx, tx, transaction };
}

function expectSharedProductionLockOrder(queryRaw: ReturnType<typeof vi.fn>) {
  expect(String(queryRaw.mock.calls[0]?.[0])).toContain("pg_advisory_xact_lock");
  expect(String(queryRaw.mock.calls[1]?.[0])).toContain("production_steps");
  expect(String(queryRaw.mock.calls[1]?.[0])).toContain("ORDER BY id");
  expect(String(queryRaw.mock.calls[1]?.[0])).not.toContain("sort_order");
  expect(String(queryRaw.mock.calls[2]?.[0])).toContain("productions");
  expect(String(queryRaw.mock.calls[3]?.[0])).toContain("orders");
}

describe("production.reportStationProblem", () => {
  it("บังคับเหตุผลหลัง trim อย่างน้อย 3 ตัวอักษรก่อนเปิด transaction", async () => {
    const harness = makeHarness();

    await expect(
      productionRouter
        .createCaller(harness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "  x  " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.transaction).not.toHaveBeenCalled();
  });

  it("derive work center จาก stepType, trim เหตุผล, auto-claim และไม่รับ station/source จาก client", async () => {
    const harness = makeHarness({ step: { assignedToId: null } });

    const result = await productionRouter.createCaller(harness.ctx).reportStationProblem({
      stepId: "step-1",
      reason: "  เครื่องรีดหยุดกลางงาน  ",
      station: "final-pack",
      source: "ERP",
    } as never);

    expect(result).toMatchObject({
      id: "step-1",
      status: "FAILED",
      notes: "[แจ้งปัญหาจากสถานี] เครื่องรีดหยุดกลางงาน",
      assignedToId: "production-staff-1",
      workCenter: "heat-press",
      operation: "REPORT_PROBLEM",
    });
    expect(harness.tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: {
        status: "FAILED",
        notes: "[แจ้งปัญหาจากสถานี] เครื่องรีดหยุดกลางงาน",
        assignedToId: "production-staff-1",
      },
      select: expect.any(Object),
    });
    expect(harness.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValue: expect.objectContaining({
          source: "STATION",
          workCenter: "heat-press",
          operation: "REPORT_PROBLEM",
        }),
      }),
    });
    expect(harness.tx.notification.create).toHaveBeenCalledOnce();
    expectSharedProductionLockOrder(harness.tx.$queryRaw);
  });

  it("ปฏิเสธ stepType ที่ไม่มี Factory Station mapping", async () => {
    const harness = makeHarness({ step: { stepType: "CUSTOM" } });

    await expect(
      productionRouter
        .createCaller(harness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "เครื่องมือเสีย" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ปฏิเสธขั้นที่เสร็จแล้ว", async () => {
    const harness = makeHarness({ step: { status: "COMPLETED" } });

    await expect(
      productionRouter
        .createCaller(harness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "พบปัญหาย้อนหลัง" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("staff แตะงานของคนอื่นไม่ได้ แต่ supervisor รายงานได้โดยไม่แย่ง owner", async () => {
    const staffHarness = makeHarness({ step: { assignedToId: "other-staff" } });
    await expect(
      productionRouter
        .createCaller(staffHarness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "อุณหภูมิไม่คงที่" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(staffHarness.tx.productionStep.update).not.toHaveBeenCalled();

    const managerHarness = makeHarness({
      role: "MANAGER",
      userId: "manager-2",
      step: { assignedToId: "other-staff" },
    });
    const result = await productionRouter
      .createCaller(managerHarness.ctx)
      .reportStationProblem({ stepId: "step-1", reason: "อุณหภูมิไม่คงที่" });

    expect(result.assignedToId).toBe("other-staff");
    expect(managerHarness.tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "FAILED",
          notes: "[แจ้งปัญหาจากสถานี] อุณหภูมิไม่คงที่",
        },
      }),
    );
  });

  it("ปฏิเสธคำสั่งเมื่อออเดอร์ถูกพัก", async () => {
    const harness = makeHarness({ orderStatus: "ON_HOLD" });

    await expect(
      productionRouter
        .createCaller(harness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "เครื่องรีดมีปัญหา" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธ DTF ที่ยังอยู่ในรอบพิมพ์ active เพื่อไม่ให้รอบเขียนทับ FAILED", async () => {
    const harness = makeHarness({
      step: { stepType: "DTF_PRINT" },
      activeRun: { runNumber: "FR-2608-0001", status: "PRINTING" },
    });

    await expect(
      productionRouter
        .createCaller(harness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "ฟิล์มติดในเครื่อง" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธใบ legacy ที่ step เดียวกันยังอยู่ระหว่างงานร้านนอก", async () => {
    const harness = makeHarness();
    harness.tx.outsourceOrder.findFirst.mockResolvedValueOnce({ id: "outsource-1" });

    await expect(
      productionRouter.createCaller(harness.ctx).reportStationProblem({
        stepId: "step-1",
        reason: "ของที่สถานีไม่ตรงใบงาน",
      }),
    ).rejects.toThrow("ขั้นนี้อยู่ระหว่างงานร้านนอก");

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.notification.create).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธ deep-link ขั้นอนาคตในเลนเดียวกันก่อน claim/write/audit/notification", async () => {
    const future = { ...baseStep, assignedToId: null };
    const harness = makeHarness({
      step: future,
      siblings: [
        {
          ...baseStep,
          id: "dtf-current",
          stepType: "DTF_PRINT",
          status: "PENDING",
          sortOrder: 2,
          assignedToId: null,
        },
        future,
      ],
    });

    await expect(
      productionRouter.createCaller(harness.ctx).reportStationProblem({
        stepId: "step-1",
        reason: "เครื่องรีดสั่นผิดปกติ",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
    expect(harness.tx.notification.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธ HEAT_PRESS ที่เป็น current แต่ readiness ยังรอฟิล์ม", async () => {
    const harness = makeHarness({
      step: { assignedToId: null },
      siblings: [
        {
          ...baseStep,
          id: "prep-1",
          stepType: "GARMENT_PICK",
          status: "COMPLETED",
          sortOrder: 1,
        },
        {
          ...baseStep,
          id: "dtf-1",
          stepType: "DTF_PRINT",
          status: "IN_PROGRESS",
          sortOrder: 2,
        },
        { ...baseStep, assignedToId: null },
      ],
    });

    await expect(
      productionRouter.createCaller(harness.ctx).reportStationProblem({
        stepId: "step-1",
        reason: "เครื่องรีดสั่นผิดปกติ",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("retry FAILED ด้วยเหตุผลเดิมเป็น no-op ไม่แจ้งเตือนหรือ audit ซ้ำ", async () => {
    const harness = makeHarness();
    const caller = productionRouter.createCaller(harness.ctx);

    await caller.reportStationProblem({ stepId: "step-1", reason: "แรงดันตก" });
    await caller.reportStationProblem({ stepId: "step-1", reason: "  แรงดันตก  " });

    expect(harness.tx.productionStep.update).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("FAILED เดิมรับเฉพาะ retry เหตุผลเดิม ไม่ append เหตุใหม่ทับ exception ที่รอหัวหน้า", async () => {
    const harness = makeHarness({
      step: {
        status: "FAILED",
        notes: "[แจ้งปัญหาจากสถานี] แรงดันตก",
      },
    });

    await expect(
      productionRouter.createCaller(harness.ctx).reportStationProblem({
        stepId: "step-1",
        reason: "อุณหภูมิแกว่ง",
      }),
    ).rejects.toThrow("ขั้นนี้แจ้งปัญหาไว้แล้ว");

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.notification.create).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("ไม่รับ stale retry ของเหตุที่ resolve แล้ว เมื่อเหตุปัจจุบันเป็นคนละเรื่อง", async () => {
    const harness = makeHarness({
      step: {
        status: "FAILED",
        notes: [
          "[แจ้งปัญหาจากสถานี] แรงดันตก",
          "[แก้ปัญหาแล้ว] เปลี่ยนวาล์ว",
          "[แจ้งปัญหาจากสถานี] อุณหภูมิแกว่ง",
        ].join("\n"),
      },
    });

    await expect(
      productionRouter.createCaller(harness.ctx).reportStationProblem({
        stepId: "step-1",
        reason: "แรงดันตก",
      }),
    ).rejects.toThrow("ขั้นนี้แจ้งปัญหาไว้แล้ว");

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("เก็บคำสั่งงานเดิมแล้ว append marker ปัญหาโดย retry ไม่ซ้ำ", async () => {
    const harness = makeHarness({ step: { notes: "ตั้งแรงกด 6 bar" } });
    const caller = productionRouter.createCaller(harness.ctx);

    const first = await caller.reportStationProblem({
      stepId: "step-1",
      reason: "  อุณหภูมิแกว่ง  ",
    });
    const retry = await caller.reportStationProblem({
      stepId: "step-1",
      reason: "  อุณหภูมิแกว่ง  ",
    });

    expect(first.notes).toBe(
      "ตั้งแรงกด 6 bar\n[แจ้งปัญหาจากสถานี] อุณหภูมิแกว่ง",
    );
    expect(retry.notes).toBe(first.notes);
    expect(harness.tx.productionStep.update).toHaveBeenCalledOnce();
  });

  it("แจ้งเฉพาะ active user ที่มี supervise_operations ตาม effective override", async () => {
    const harness = makeHarness({
      managers: [
        {
          id: "manager-disabled",
          role: "MANAGER",
          permissionOverrides: { supervise_operations: false },
        },
        {
          id: "staff-supervisor",
          role: "PRODUCTION_STAFF",
          permissionOverrides: { supervise_operations: true },
        },
      ],
    });

    await productionRouter.createCaller(harness.ctx).reportStationProblem({
      stepId: "step-1",
      reason: "แรงดันเครื่องตก",
    });

    expect(harness.tx.notification.create).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "staff-supervisor" }),
    });
  });

  it("audit และ notification อยู่ใน transaction เดียว และ response/select ไม่มีเงิน", async () => {
    const harness = makeHarness();

    const result = await productionRouter
      .createCaller(harness.ctx)
      .reportStationProblem({ stepId: "step-1", reason: "ความร้อนไม่ถึง" });

    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).toHaveBeenCalledOnce();
    const select = harness.tx.productionStep.update.mock.calls[0]?.[0]?.select;
    expect(JSON.stringify(select)).not.toMatch(/amount|price|cost|payment/i);
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost|payment/i);
  });

  it("ไม่ตอบว่าสำเร็จเมื่อ audit ใน transaction เขียนไม่ได้", async () => {
    const harness = makeHarness();
    harness.tx.auditLog.create.mockRejectedValueOnce(new Error("audit write failed"));

    await expect(
      productionRouter
        .createCaller(harness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "ความร้อนไม่ถึง" }),
    ).rejects.toThrow("audit write failed");

    expect(harness.tx.productionStep.update).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("permission manage_production fail closed", async () => {
    const harness = makeHarness({ role: "SALES" });

    await expect(
      productionRouter
        .createCaller(harness.ctx)
        .reportStationProblem({ stepId: "step-1", reason: "เครื่องรีดมีปัญหา" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(harness.transaction).not.toHaveBeenCalled();
  });
});

describe("production.resolveStationProblem", () => {
  it.each([
    { stepType: "GARMENT_RECEIVE", station: "prep" },
    { stepType: "DTF_PRINT", station: "dtf-print" },
  ])(
    "หัวหน้า recover ขั้น guarded $stepType จาก FAILED กลับ safe PENDING พร้อม trail เดิม",
    async ({ stepType, station }) => {
      const harness = makeHarness({
        role: "MANAGER",
        userId: "manager-2",
        step: {
          stepType,
          status: "FAILED",
          notes: "เครื่องหยุดกลางงาน",
        },
      });

      const result = await productionRouter
        .createCaller(harness.ctx)
        .resolveStationProblem({
          stepId: "step-1",
          resolutionReason: "  เปลี่ยนอะไหล่และทดสอบแล้ว  ",
        });

      expect(result).toMatchObject({
        id: "step-1",
        status: "PENDING",
        operation: "RESOLVE_PROBLEM",
      });
      expect(result.notes).toContain("เครื่องหยุดกลางงาน");
      expect(result.notes).toContain("[แก้ปัญหาแล้ว] เปลี่ยนอะไหล่และทดสอบแล้ว");
      expect(harness.tx.productionStep.update).toHaveBeenCalledWith({
        where: { id: "step-1" },
        data: {
          status: "PENDING",
          startedAt: null,
          completedAt: null,
          notes: "เครื่องหยุดกลางงาน\n[แก้ปัญหาแล้ว] เปลี่ยนอะไหล่และทดสอบแล้ว",
        },
        select: expect.any(Object),
      });
      expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
      expect(harness.tx.notification.create).toHaveBeenCalledOnce();
      expect(harness.tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          link: `/factory/station?station=${station}&productionId=production-1`,
        }),
      });
      expectSharedProductionLockOrder(harness.tx.$queryRaw);
    },
  );

  it("retry resolution เดิมเป็น no-op และไม่ rewind/audit/notify ซ้ำ", async () => {
    const harness = makeHarness({
      role: "MANAGER",
      userId: "manager-2",
      step: { status: "FAILED", notes: "แรงดันตก" },
    });
    const caller = productionRouter.createCaller(harness.ctx);

    await caller.resolveStationProblem({
      stepId: "step-1",
      resolutionReason: "ปรับระบบไฟแล้ว",
    });
    await caller.resolveStationProblem({
      stepId: "step-1",
      resolutionReason: "  ปรับระบบไฟแล้ว  ",
    });

    expect(harness.tx.productionStep.update).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).toHaveBeenCalledOnce();
  });

  it("ห้าม resolve ขั้นที่เดินต่อเป็น IN_PROGRESS แล้ว", async () => {
    const harness = makeHarness({
      role: "MANAGER",
      userId: "manager-2",
      step: { status: "IN_PROGRESS", notes: "[แก้ปัญหาแล้ว] เปลี่ยนหัวรีด" },
    });

    await expect(
      productionRouter.createCaller(harness.ctx).resolveStationProblem({
        stepId: "step-1",
        resolutionReason: "เปลี่ยนหัวรีด",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("production.assignProductionStep", () => {
  it("มอบหมายให้ผู้ใช้ active ที่ได้ manage_production ผ่าน override", async () => {
    const harness = makeHarness({
      role: "MANAGER",
      userId: "manager-2",
      assignees: {
        "sales-with-production": {
          id: "sales-with-production",
          role: "SALES",
          permissionOverrides: { manage_production: true },
          isActive: true,
        },
      },
    });

    const result = await productionRouter
      .createCaller(harness.ctx)
      .assignProductionStep({
        stepId: "step-1",
        assignedToId: "sales-with-production",
      });

    expect(result).toMatchObject({
      assignedToId: "sales-with-production",
      operation: "ASSIGN_STEP",
    });
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "sales-with-production",
        title: "ได้รับมอบหมายงาน — ORD-2608-0041",
        message: "รีดร้อน",
        link: "/factory/station?station=heat-press&productionId=production-1",
        entityType: "PRODUCTION_STEP",
        entityId: "step-1",
      }),
    });
    expectSharedProductionLockOrder(harness.tx.$queryRaw);
  });

  it.each([
    {
      label: "inactive",
      target: {
        id: "target",
        role: "PRODUCTION_STAFF" as Role,
        permissionOverrides: null,
        isActive: false,
      },
    },
    {
      label: "ไม่มีสิทธิ์งานผลิต",
      target: {
        id: "target",
        role: "SALES" as Role,
        permissionOverrides: null,
        isActive: true,
      },
    },
  ])("ปฏิเสธ assignee $label ก่อน write/audit", async ({ target }) => {
    const harness = makeHarness({
      role: "MANAGER",
      userId: "manager-2",
      assignees: { target },
    });

    await expect(
      productionRouter.createCaller(harness.ctx).assignProductionStep({
        stepId: "step-1",
        assignedToId: "target",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("ขั้นที่ไม่มี Station mapping ส่ง deep link fallback ไป Production Control", async () => {
    const harness = makeHarness({
      role: "MANAGER",
      userId: "manager-2",
      step: { stepType: "CUSTOM", customStepName: "ตรวจบล็อกพิเศษ" },
      assignees: {
        "production-staff-2": {
          id: "production-staff-2",
          role: "PRODUCTION_STAFF",
          permissionOverrides: null,
          isActive: true,
        },
      },
    });

    await productionRouter.createCaller(harness.ctx).assignProductionStep({
      stepId: "step-1",
      assignedToId: "production-staff-2",
    });

    expect(harness.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "production-staff-2",
        message: "ตรวจบล็อกพิเศษ",
        link: "/production/production-1",
      }),
    });
  });

  it("รองรับ unassign และ retry ค่าเดิมเป็น no-op ไม่ audit ซ้ำ", async () => {
    const harness = makeHarness({ role: "MANAGER", userId: "manager-2" });
    const caller = productionRouter.createCaller(harness.ctx);

    const result = await caller.assignProductionStep({
      stepId: "step-1",
      assignedToId: null,
    });
    await caller.assignProductionStep({ stepId: "step-1", assignedToId: null });

    expect(result).toMatchObject({ assignedToId: null, operation: "ASSIGN_STEP" });
    expect(harness.tx.productionStep.update).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).not.toHaveBeenCalled();
  });

  it("มอบหมายค่าเดิมเป็น no-op และไม่ส่ง notification ซ้ำ", async () => {
    const harness = makeHarness({ role: "MANAGER", userId: "manager-2" });

    await productionRouter.createCaller(harness.ctx).assignProductionStep({
      stepId: "step-1",
      assignedToId: "production-staff-1",
    });

    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
    expect(harness.tx.notification.create).not.toHaveBeenCalled();
  });

  it("หัวหน้ามอบหมายให้ตัวเองได้แต่ไม่ส่ง notification หาตัวเอง", async () => {
    const harness = makeHarness({
      role: "MANAGER",
      userId: "manager-2",
      assignees: {
        "manager-2": {
          id: "manager-2",
          role: "MANAGER",
          permissionOverrides: null,
          isActive: true,
        },
      },
    });

    await productionRouter.createCaller(harness.ctx).assignProductionStep({
      stepId: "step-1",
      assignedToId: "manager-2",
    });

    expect(harness.tx.productionStep.update).toHaveBeenCalledOnce();
    expect(harness.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(harness.tx.notification.create).not.toHaveBeenCalled();
  });

  it("manager-only fail closed ก่อน transaction", async () => {
    const harness = makeHarness({ role: "PRODUCTION_STAFF" });

    await expect(
      productionRouter.createCaller(harness.ctx).assignProductionStep({
        stepId: "step-1",
        assignedToId: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(harness.transaction).not.toHaveBeenCalled();
  });
});

describe("production.updateStep assignment boundary", () => {
  it("legacy writer ปฏิเสธ Operation Job ของ Production V2", async () => {
    const harness = makeHarness({
      step: { executionEnabled: true },
      role: "MANAGER",
      userId: "manager-2",
    });

    await expect(
      productionRouter.createCaller(harness.ctx).updateStep({
        stepId: "step-1",
        qtyDone: 3,
      }),
    ).rejects.toThrow("Production V2");
    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("schema ไม่ expose assignedToId และ unknown input ถูก strip โดยไม่เปลี่ยน owner", async () => {
    const harness = makeHarness({ role: "MANAGER", userId: "manager-2" });

    const result = await productionRouter.createCaller(harness.ctx).updateStep({
      stepId: "step-1",
      assignedToId: "bypass-target",
    } as never);

    expect(result.assignedToId).toBe("production-staff-1");
    expect(harness.tx.productionStep.update).not.toHaveBeenCalled();
    expect(harness.tx.auditLog.create).not.toHaveBeenCalled();
    expect(harness.tx.user.findUnique).not.toHaveBeenCalled();
  });
});
