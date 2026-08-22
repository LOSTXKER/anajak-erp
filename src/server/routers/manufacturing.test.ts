import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";
import type { Context } from "../trpc";

const readMocks = vi.hoisted(() => ({
  getManufacturingControlList: vi.fn(),
  getManufacturingWorkOrder: vi.fn(),
  getManufacturingWorkCenterLoad: vi.fn(),
  getManufacturingStationDispatch: vi.fn(),
  getManufacturingStationJob: vi.fn(),
  getManufacturingExceptionList: vi.fn(),
}));

const commandMocks = vi.hoisted(() => ({
  releaseManufacturingWorkOrder: vi.fn(),
  assignManufacturingOperation: vi.fn(),
  resequenceManufacturingOperation: vi.fn(),
  startManufacturingOperation: vi.fn(),
  pauseManufacturingOperation: vi.fn(),
  reportManufacturingOutput: vi.fn(),
  completeManufacturingOperation: vi.fn(),
  raiseManufacturingException: vi.fn(),
  decideQcDisposition: vi.fn(),
  resolveManufacturingException: vi.fn(),
  planManufacturingRework: vi.fn(),
  releaseManufacturingRework: vi.fn(),
}));

vi.mock("@/server/services/manufacturing-read-model", () => readMocks);
vi.mock("@/server/services/manufacturing-commands", () => commandMocks);

import { manufacturingRouter } from "./manufacturing";

function context(role: Role, permissionOverrides: unknown = null): Context {
  return {
    prisma: {} as Context["prisma"],
    userId: "actor-1",
    userRole: role,
    permissionOverrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(readMocks)) mock.mockResolvedValue({ items: [] });
  readMocks.getManufacturingWorkCenterLoad.mockResolvedValue([]);
  readMocks.getManufacturingStationDispatch.mockResolvedValue({
    workCenter: { id: "wc-1", code: "PREP", name: "เตรียมงาน" },
    currentJob: null,
    queue: [],
    nextCursor: null,
  });
  readMocks.getManufacturingStationJob.mockResolvedValue({
    operation: { id: "step-1" },
    availableCommands: [],
  });
  readMocks.getManufacturingWorkOrder.mockResolvedValue({ id: "wo-1" });
  for (const mock of Object.values(commandMocks)) mock.mockResolvedValue({ ok: true });
});

describe("manufacturing router contract", () => {
  it("read-only login เปิด Station DTO ได้ แต่ server ส่ง canOperate=false", async () => {
    await manufacturingRouter
      .createCaller(context("DESIGNER"))
      .stationDispatch({ workCenterCode: "PREP" });

    expect(readMocks.getManufacturingStationDispatch).toHaveBeenCalledWith(
      expect.anything(),
      { workCenterCode: "PREP", limit: 30 },
      { actorId: "actor-1", canOperate: false, canSupervise: false },
    );
  });

  it("Production Staff เริ่มงานได้และ actor มาจาก session ไม่รับค่าปลอมใน input", async () => {
    await manufacturingRouter.createCaller(context("PRODUCTION_STAFF")).startOperation({
      commandId: "command-0001",
      expectedRevision: 2,
      operationJobId: "step-1",
      actorId: "spoofed-user",
    } as never);

    expect(commandMocks.startManufacturingOperation).toHaveBeenCalledWith(
      expect.anything(),
      {
        commandId: "command-0001",
        expectedRevision: 2,
        operationJobId: "step-1",
        actorId: "actor-1",
      },
      { actorId: "actor-1", canOperate: true, canSupervise: false },
    );
  });

  it("SALES เริ่มงาน Station ไม่ได้", async () => {
    await expect(
      manufacturingRouter.createCaller(context("SALES")).startOperation({
        commandId: "command-0001",
        expectedRevision: 0,
        operationJobId: "step-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(commandMocks.startManufacturingOperation).not.toHaveBeenCalled();
  });

  it("เฉพาะ supervisor release work order ได้", async () => {
    await manufacturingRouter.createCaller(context("MANAGER")).releaseWorkOrder({
      commandId: "command-0002",
      expectedRevision: 0,
      workOrderId: "wo-1",
    });
    expect(commandMocks.releaseManufacturingWorkOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: "actor-1", workOrderId: "wo-1" }),
    );

    await expect(
      manufacturingRouter.createCaller(context("PRODUCTION_STAFF")).releaseWorkOrder({
        commandId: "command-0003",
        expectedRevision: 0,
        workOrderId: "wo-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ทุก mutation บังคับ commandId และ expectedRevision ที่ขอบ API", async () => {
    await expect(
      manufacturingRouter.createCaller(context("PRODUCTION_STAFF")).reportOutput({
        operationJobId: "step-1",
        qtyGood: 1,
        qtyScrap: 0,
        qtyRework: 0,
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(commandMocks.reportManufacturingOutput).not.toHaveBeenCalled();
  });

  it("permission override ถูกใช้กับ supervisor command", async () => {
    await manufacturingRouter
      .createCaller(context("PRODUCTION_STAFF", { supervise_operations: true }))
      .resolveException({
        commandId: "command-0004",
        expectedRevision: 1,
        exceptionId: "exception-1",
        resolution: "แก้แล้ว",
      });
    expect(commandMocks.resolveManufacturingException).toHaveBeenCalledOnce();
  });

  it("เฉพาะ supervisor ตัดสิน QC HOLD และ actor มาจาก session", async () => {
    await manufacturingRouter.createCaller(context("MANAGER")).decideQcDisposition({
      commandId: "qc-hold-command-0001",
      expectedRevision: 3,
      exceptionId: "exception-1",
      disposition: "REWORK",
      note: "ส่งกลับรีดใหม่",
    });
    expect(commandMocks.decideQcDisposition).toHaveBeenCalledWith(
      expect.anything(),
      {
        commandId: "qc-hold-command-0001",
        expectedRevision: 3,
        exceptionId: "exception-1",
        disposition: "REWORK",
        note: "ส่งกลับรีดใหม่",
        actorId: "actor-1",
      },
    );

    await expect(
      manufacturingRouter
        .createCaller(context("PRODUCTION_STAFF"))
        .decideQcDisposition({
          commandId: "qc-hold-command-0002",
          expectedRevision: 3,
          exceptionId: "exception-1",
          disposition: "SCRAP",
        }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
