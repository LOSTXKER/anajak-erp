import type { Context } from "../trpc";
import { describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({
  getPrintQueue: vi.fn().mockResolvedValue([]),
  buildPressQueue: vi.fn().mockResolvedValue([]),
  buildPackQueue: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/server/services/print-run", () => ({
  getPrintQueue: queueMocks.getPrintQueue,
}));
vi.mock("@/server/services/factory-board", () => ({
  buildPressQueue: queueMocks.buildPressQueue,
  buildPackQueue: queueMocks.buildPackQueue,
}));

import { taskRouter } from "./task";

type TaskRow = ReturnType<typeof taskRow>;

function taskRow(input: {
  id: string;
  executionEnabled: boolean;
  assignedToId?: string | null;
  operationState?: string;
  workOrderState?: string;
  orderStatus?: string;
  workCenterActive?: boolean;
  activeMember?: boolean;
  workResource?: { isActive: boolean; state: string } | null;
}) {
  return {
    id: input.id,
    stepType: input.executionEnabled ? "CUSTOM" : "CUTTING",
    customStepName: null,
    executionEnabled: input.executionEnabled,
    operationCode: input.executionEnabled ? "PREP" : null,
    operationName: input.executionEnabled ? "เตรียมงาน" : null,
    executionMode: input.executionEnabled ? "IN_HOUSE" : null,
    operationState: input.operationState ?? (input.executionEnabled ? "READY" : "PLANNED"),
    workCenterId: input.executionEnabled ? "wc-prep" : null,
    workCenter: input.executionEnabled
      ? {
          code: "PREP",
          name: "เตรียมงาน",
          isActive: input.workCenterActive ?? true,
          members: input.activeMember === false
            ? []
            : [{ userId: "worker-1", isActive: true }],
        }
      : null,
    workResourceId: input.workResource === undefined || input.workResource === null
      ? null
      : "resource-1",
    workResource: input.workResource ?? null,
    status: "PENDING",
    assignedToId: input.assignedToId ?? null,
    assignedTo: input.assignedToId
      ? { id: input.assignedToId, name: input.assignedToId }
      : null,
    production: {
      id: `production-${input.id}`,
      workOrderState: input.workOrderState ?? (input.executionEnabled ? "IN_PROGRESS" : "DRAFT"),
      order: {
        id: `order-${input.id}`,
        orderNumber: `ORD-${input.id}`,
        title: input.id,
        deadline: null,
        internalStatus: input.orderStatus ?? "PRODUCING",
        customer: { name: "ลูกค้า" },
      },
    },
  };
}

function matchesTaskWhere(row: TaskRow, where: Record<string, unknown>): boolean {
  const status = where.status as { in?: string[] } | undefined;
  if (status?.in && !status.in.includes(row.status)) return false;

  const and = (where.AND as Array<Record<string, unknown>> | undefined) ?? [];
  return and.every((clause) => {
    const branches = clause.OR as Array<Record<string, unknown>> | undefined;
    if (!branches) return true;

    if (branches.some((branch) => "executionEnabled" in branch)) {
      return branches.some((branch) => {
        if (branch.executionEnabled !== row.executionEnabled) return false;
        const operationState = branch.operationState as { in?: string[] } | undefined;
        if (operationState?.in && !operationState.in.includes(row.operationState)) return false;
        const stepType = branch.stepType as { notIn?: string[] } | undefined;
        if (stepType?.notIn?.includes(row.stepType)) return false;
        const production = branch.production as {
          workOrderState?: { in?: string[] };
          order?: { internalStatus?: { in?: string[] } };
        } | undefined;
        if (
          production?.workOrderState?.in &&
          !production.workOrderState.in.includes(row.production.workOrderState)
        ) return false;
        if (
          production?.order?.internalStatus?.in &&
          !production.order.internalStatus.in.includes(row.production.order.internalStatus)
        ) return false;
        const workCenter = branch.workCenter as {
          is?: {
            isActive?: boolean;
            members?: { some?: { userId?: string; isActive?: boolean } };
          };
        } | undefined;
        if (workCenter?.is?.isActive && !row.workCenter?.isActive) return false;
        const requiredMember = workCenter?.is?.members?.some;
        if (
          requiredMember &&
          !row.workCenter?.members.some(
            (member) => member.userId === requiredMember.userId && member.isActive,
          )
        ) return false;
        if (branch.AND && row.workResource) {
          if (!row.workResource.isActive || !["AVAILABLE", "IN_USE"].includes(row.workResource.state)) {
            return false;
          }
        }
        return true;
      });
    }

    return branches.some((branch) => {
      if ("assignedToId" in branch) {
        return branch.assignedToId === row.assignedToId;
      }
      return false;
    });
  });
}

describe("task.myToday production topology", () => {
  it("ใช้ topology และ assignment ร่วมกัน และไม่คืนลิงก์ Station ของงาน V2 ที่เปิดไม่ได้", async () => {
    const rows = [
      taskRow({ id: "v2-ready", executionEnabled: true }),
      taskRow({ id: "legacy-unassigned", executionEnabled: false }),
      taskRow({ id: "v2-planned", executionEnabled: true, operationState: "PLANNED" }),
      taskRow({ id: "v2-held", executionEnabled: true, orderStatus: "ON_HOLD" }),
      taskRow({ id: "v2-cancelled", executionEnabled: true, workOrderState: "CANCELLED" }),
      taskRow({ id: "v2-closed-center", executionEnabled: true, workCenterActive: false }),
      taskRow({ id: "v2-non-member", executionEnabled: true, activeMember: false }),
      taskRow({
        id: "v2-down-resource",
        executionEnabled: true,
        workResource: { isActive: true, state: "DOWN" },
      }),
      taskRow({ id: "legacy-other", executionEnabled: false, assignedToId: "worker-2" }),
    ];
    const findMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      rows.filter((row) => matchesTaskWhere(row, where)),
    );
    const ctx: Context = {
      prisma: {
        productionStep: { findMany },
      } as unknown as Context["prisma"],
      userId: "worker-1",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    const result = await taskRouter.createCaller(ctx).myToday();

    expect(result.production.map((item) => item.stepId)).toEqual([
      "v2-ready",
      "legacy-unassigned",
    ]);
    const where = findMany.mock.calls[0]?.[0].where;
    expect(where).toEqual(expect.objectContaining({
      AND: expect.arrayContaining([
        expect.objectContaining({ OR: expect.any(Array) }),
        { OR: [{ assignedToId: "worker-1" }, { assignedToId: null }] },
      ]),
    }));
    expect(JSON.stringify(where)).toContain(
      '"members":{"some":{"userId":"worker-1","isActive":true}}',
    );
  });
});
