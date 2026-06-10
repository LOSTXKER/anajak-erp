import { describe, it, expect, vi } from "vitest";
import { overdueCutoffUtc, sweepOverdueInvoices, maybeSweepOverdue } from "./overdue";
import type { ExtendedPrismaClient } from "@/lib/prisma";

// เกราะนิยาม "เลยกำหนด" + semantics ของ sweep (แจ้งเตือนครั้งเดียว ไม่ spam ตอน race)

describe("overdueCutoffUtc — เลยกำหนด = พ้นสิ้นวันไทยของ dueDate", () => {
  it("cutoff คือ UTC midnight ของวันนี้ตามปฏิทินไทย", () => {
    // 17:30Z = 00:30 ไทยของวันถัดไป → วันไทยขยับแล้ว
    expect(overdueCutoffUtc(new Date("2026-06-10T17:30:00Z")).toISOString()).toBe(
      "2026-06-11T00:00:00.000Z"
    );
    expect(overdueCutoffUtc(new Date("2026-06-10T16:30:00Z")).toISOString()).toBe(
      "2026-06-10T00:00:00.000Z"
    );
  });

  it("บิลครบกำหนด 'วันนี้' ยังไม่เลยกำหนด (เทียบด้วย lt)", () => {
    const cutoff = overdueCutoffUtc(new Date("2026-06-10T08:00:00+07:00"));
    const dueToday = new Date("2026-06-10T00:00:00Z");
    const dueYesterday = new Date("2026-06-09T00:00:00Z");
    expect(dueToday < cutoff).toBe(false);
    expect(dueYesterday < cutoff).toBe(true);
  });
});

function mockPrisma(opts: {
  due?: Array<{ id: string; invoiceNumber: string; totalAmount: number; customer: { name: string } }>;
  markedRows?: Array<{ id: string; invoiceNumber: string; totalAmount: number }>;
  staff?: Array<{ id: string }>;
  setting?: { value: string } | null;
  settingClaimCount?: number;
}) {
  const defaultMarked = (opts.due ?? []).map(({ id, invoiceNumber, totalAmount }) => ({
    id,
    invoiceNumber,
    totalAmount,
  }));
  const tx = {
    invoice: {
      findMany: vi.fn().mockResolvedValue(opts.due ?? []),
      updateManyAndReturn: vi.fn().mockResolvedValue(opts.markedRows ?? defaultMarked),
    },
    user: { findMany: vi.fn().mockResolvedValue(opts.staff ?? []) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    setting: {
      findUnique: vi.fn().mockResolvedValue(opts.setting ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: opts.settingClaimCount ?? 1 }),
      create: vi.fn().mockResolvedValue({}),
    },
    ...tx,
  };
  return { prisma: prisma as unknown as ExtendedPrismaClient, tx };
}

const dueInvoice = {
  id: "inv1",
  invoiceNumber: "INV-F-2606-0001",
  totalAmount: 1605,
  customer: { name: "ลูกค้าทดสอบ" },
};

describe("sweepOverdueInvoices", () => {
  it("ไม่มีบิลถึงกำหนด → ไม่แตะอะไร", async () => {
    const { prisma, tx } = mockPrisma({ due: [] });
    expect(await sweepOverdueInvoices(prisma)).toEqual({ marked: 0, notified: 0 });
    expect(tx.invoice.updateManyAndReturn).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("mark แล้วแจ้งเตือนทีมการเงินคนละ 1 รายการ", async () => {
    const { prisma, tx } = mockPrisma({
      due: [dueInvoice],
      staff: [{ id: "u1" }, { id: "u2" }],
    });
    expect(await sweepOverdueInvoices(prisma)).toEqual({ marked: 1, notified: 2 });
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    const data = tx.notification.create.mock.calls[0][0].data;
    expect(data.type).toBe("PAYMENT");
    expect(data.link).toBe("/billing");
    expect(data.message).toContain("INV-F-2606-0001");
  });

  it("race: sweep ซ้อนกัน ตัวที่ update ได้ 0 แถว ห้ามแจ้งเตือนซ้ำ", async () => {
    const { prisma, tx } = mockPrisma({
      due: [dueInvoice],
      markedRows: [],
      staff: [{ id: "u1" }],
    });
    expect(await sweepOverdueInvoices(prisma)).toEqual({ marked: 0, notified: 0 });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("จ่ายเงินคั่นกลาง: ข้อความนับเฉพาะใบที่ mark ได้จริง ไม่ใช่ชุดที่เห็นตอนแรก", async () => {
    const other = { ...dueInvoice, id: "inv2", invoiceNumber: "INV-F-2606-0002" };
    const { prisma, tx } = mockPrisma({
      due: [dueInvoice, other],
      markedRows: [{ id: "inv2", invoiceNumber: "INV-F-2606-0002", totalAmount: 1605 }],
      staff: [{ id: "u1" }],
    });
    expect(await sweepOverdueInvoices(prisma)).toEqual({ marked: 1, notified: 1 });
    const data = tx.notification.create.mock.calls[0][0].data;
    expect(data.title).toContain("1 ใบ");
    expect(data.message).toContain("INV-F-2606-0002");
    expect(data.message).not.toContain("INV-F-2606-0001");
  });
});

describe("maybeSweepOverdue — throttle 6 ชม.", () => {
  const now = new Date("2026-06-10T08:00:00+07:00");

  it("เพิ่งกวาดไป → ข้าม", async () => {
    const { prisma } = mockPrisma({
      setting: { value: new Date(now.getTime() - 60_000).toISOString() },
    });
    expect(await maybeSweepOverdue(prisma, now)).toBeNull();
  });

  it("เกิน 6 ชม. → ชิงสิทธิ์แล้วกวาด", async () => {
    const { prisma } = mockPrisma({
      setting: { value: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString() },
      due: [],
    });
    expect(await maybeSweepOverdue(prisma, now)).toEqual({ marked: 0, notified: 0 });
  });

  it("แพ้ race ตอนชิงสิทธิ์ (updateMany ได้ 0) → ไม่กวาดซ้ำ", async () => {
    const { prisma, tx } = mockPrisma({
      setting: { value: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString() },
      settingClaimCount: 0,
    });
    expect(await maybeSweepOverdue(prisma, now)).toBeNull();
    expect(tx.invoice.findMany).not.toHaveBeenCalled();
  });

  it("ค่าใน Setting เพี้ยน (parse ไม่ได้) → ถือว่าเก่า กวาดได้", async () => {
    const { prisma } = mockPrisma({ setting: { value: "not-a-date" }, due: [] });
    expect(await maybeSweepOverdue(prisma, now)).toEqual({ marked: 0, notified: 0 });
  });
});
