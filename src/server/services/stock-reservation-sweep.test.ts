import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { requiredUpfrontAmount } from "@/lib/payment-terms";
import {
  classifyReservation,
  sweepStaleReservations,
  type ReservationCandidate,
} from "./stock-reservation-sweep";
import { releaseOrderStockReservation } from "./stock-reservation";

// ปลดจองค้างพึ่ง releaseOrderStockReservation (มี HTTP ภายใน) — stub เพื่อทดสอบ orchestration เพียวๆ
vi.mock("./stock-reservation", () => ({
  releaseOrderStockReservation: vi.fn(),
}));
const mockedRelease = vi.mocked(releaseOrderStockReservation);

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-17T03:00:00Z");

// ── requiredUpfrontAmount — ยอดที่ต้องจ่ายก่อนเริ่มงานตามเทอม ──
describe("requiredUpfrontAmount", () => {
  it("จ่ายเต็มล่วงหน้า = ยอดเต็ม", () => {
    expect(requiredUpfrontAmount("FULL_PREPAY", 1000)).toBe(1000);
  });
  it("มัดจำ 30/50 = % ของยอด", () => {
    expect(requiredUpfrontAmount("DEPOSIT_30", 1000)).toBe(300);
    expect(requiredUpfrontAmount("DEPOSIT_50", 1000)).toBe(500);
  });
  it("เครดิต/COD/ไม่ระบุ/ค่าแปลก = 0 (ไม่ต้องมัดจำ)", () => {
    expect(requiredUpfrontAmount("NET_30", 1000)).toBe(0);
    expect(requiredUpfrontAmount("COD", 1000)).toBe(0);
    expect(requiredUpfrontAmount(null, 1000)).toBe(0);
    expect(requiredUpfrontAmount("GARBAGE", 1000)).toBe(0);
  });
});

// ── classifyReservation — เกราะการตัดสินใจ ปลด/เตือน/ปล่อย ──
function cand(over: Partial<ReservationCandidate> = {}): ReservationCandidate {
  return {
    internalStatus: "CONFIRMED",
    paymentTerms: "DEPOSIT_50", // ต้องมัดจำ 50%
    totalAmount: 1000,
    paidAmount: 0,
    stockReservedAt: new Date(NOW.getTime() - 4 * DAY),
    reservationExpiryWarnedAt: null,
    ...over,
  };
}

describe("classifyReservation", () => {
  it("ไม่ได้จองอยู่ (stockReservedAt null) → skip", () => {
    expect(classifyReservation(cand({ stockReservedAt: null }), NOW)).toBe("skip");
  });

  it("เริ่มผลิต/ปิดงาน/ยกเลิกแล้ว → skip (ไม่แตะ)", () => {
    for (const s of ["PRODUCING", "COMPLETED", "CANCELLED", "READY_TO_SHIP", "INQUIRY", "DRAFT"]) {
      expect(classifyReservation(cand({ internalStatus: s }), NOW)).toBe("skip");
    }
  });

  it("เครดิตเทอม/COD/ไม่ระบุ → skip (ไม่ต้องมัดจำ จองนานแค่ไหนก็ไม่ปลด)", () => {
    expect(classifyReservation(cand({ paymentTerms: "NET_30" }), NOW)).toBe("skip");
    expect(classifyReservation(cand({ paymentTerms: "COD" }), NOW)).toBe("skip");
    expect(classifyReservation(cand({ paymentTerms: null }), NOW)).toBe("skip");
  });

  it("จ่ายมัดจำครบแล้ว → skip (รวมเคสเศษสตางค์)", () => {
    expect(classifyReservation(cand({ paidAmount: 500 }), NOW)).toBe("skip");
    expect(classifyReservation(cand({ paidAmount: 499.997 }), NOW)).toBe("skip"); // เผื่อ Decimal→number
    expect(classifyReservation(cand({ paidAmount: 600 }), NOW)).toBe("skip");
  });

  it("ยังไม่จ่ายมัดจำ + จองค้าง < 2 วัน → skip (ยังไม่ถึงเวลา)", () => {
    const reservedAt = new Date(NOW.getTime() - 1.5 * DAY);
    expect(classifyReservation(cand({ stockReservedAt: reservedAt }), NOW)).toBe("skip");
  });

  it("ยังไม่จ่ายมัดจำ + ค้าง 2–3 วัน + ยังไม่เคยเตือน → warn", () => {
    const reservedAt = new Date(NOW.getTime() - 2.5 * DAY);
    expect(classifyReservation(cand({ stockReservedAt: reservedAt }), NOW)).toBe("warn");
  });

  it("ค้าง 2–3 วัน แต่เตือนไปแล้ว → skip (ไม่เตือนซ้ำ)", () => {
    const reservedAt = new Date(NOW.getTime() - 2.5 * DAY);
    expect(
      classifyReservation(
        cand({ stockReservedAt: reservedAt, reservationExpiryWarnedAt: NOW }),
        NOW
      )
    ).toBe("skip");
  });

  it("ยังไม่จ่ายมัดจำ + ค้าง ≥ 3 วัน → release (แม้ยังไม่เคยเตือน — เกินกำหนดคือเกิน)", () => {
    expect(classifyReservation(cand({ stockReservedAt: new Date(NOW.getTime() - 3 * DAY) }), NOW)).toBe(
      "release"
    );
    expect(
      classifyReservation(
        cand({ stockReservedAt: new Date(NOW.getTime() - 5 * DAY), reservationExpiryWarnedAt: NOW }),
        NOW
      )
    ).toBe("release");
  });

  it("จ่ายเต็มล่วงหน้า ยังไม่จ่าย + ค้าง ≥ 3 วัน → release", () => {
    expect(
      classifyReservation(cand({ paymentTerms: "FULL_PREPAY", paidAmount: 0 }), NOW)
    ).toBe("release");
  });
});

// ── sweepStaleReservations — orchestration (mock prisma + stub release) ──
interface SweepOrder {
  id: string;
  orderNumber: string;
  createdById: string;
  internalStatus: string;
  paymentTerms: string | null;
  totalAmount: number;
  stockReservedAt: Date | null;
  reservationExpiryWarnedAt: Date | null;
  customer: { name: string };
  invoices: { payments: { amount: number; whtAmount: number }[] }[];
}

function sweepOrder(over: Partial<SweepOrder> = {}): SweepOrder {
  return {
    id: "o1",
    orderNumber: "OR-2606-0001",
    createdById: "u1",
    internalStatus: "CONFIRMED",
    paymentTerms: "DEPOSIT_50",
    totalAmount: 1000,
    stockReservedAt: new Date(NOW.getTime() - 4 * DAY),
    reservationExpiryWarnedAt: null,
    customer: { name: "ลูกค้าหาย" },
    invoices: [],
    ...over,
  };
}

function mockPrisma(opts: {
  orders?: SweepOrder[];
  staff?: { id: string }[];
  warnClaimCount?: number;
  freshOverride?: SweepOrder | null;
}) {
  const m = {
    order: {
      findMany: vi.fn().mockResolvedValue(opts.orders ?? []),
      // re-validate สดก่อนปลด — คืนออเดอร์เดิม (สถานะยังเข้าเกณฑ์) เว้นแต่ test override ผ่าน freshOverride
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          opts.freshOverride !== undefined
            ? opts.freshOverride
            : (opts.orders?.find((o) => o.id === where.id) ?? null)
        )
      ),
      updateMany: vi.fn().mockResolvedValue({ count: opts.warnClaimCount ?? 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    user: { findMany: vi.fn().mockResolvedValue(opts.staff ?? []) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  };
  return { prisma: m as unknown as ExtendedPrismaClient, m };
}

describe("sweepStaleReservations", () => {
  beforeEach(() => {
    mockedRelease.mockReset();
    mockedRelease.mockResolvedValue({ status: "released" });
  });

  it("ไม่มีออเดอร์เข้าเกณฑ์ → ไม่ปลด ไม่เตือน", async () => {
    const { prisma, m } = mockPrisma({ orders: [] });
    expect(await sweepStaleReservations(prisma, NOW)).toEqual({ released: 0, warned: 0, notified: 0 });
    expect(mockedRelease).not.toHaveBeenCalled();
    expect(m.notification.create).not.toHaveBeenCalled();
  });

  it("ค้าง ≥ 3 วัน → ปลดจอง + แจ้งเจ้าของ+ทีม (dedupe ถ้าเจ้าของซ้ำทีม)", async () => {
    const { prisma, m } = mockPrisma({
      orders: [sweepOrder()],
      staff: [{ id: "u1" }, { id: "u2" }], // u1 = เจ้าของออเดอร์ด้วย → ต้องไม่แจ้งซ้ำ
    });
    const res = await sweepStaleReservations(prisma, NOW);
    expect(res).toEqual({ released: 1, warned: 0, notified: 2 });
    expect(mockedRelease).toHaveBeenCalledTimes(1);
    expect(m.notification.create).toHaveBeenCalledTimes(2);
    expect(m.notification.create.mock.calls[0][0].data.title).toContain("ปลดจองสต๊อกอัตโนมัติ");
  });

  it("ปลดไม่สำเร็จ (ท่อ Stock ล่ม) → ไม่นับ ไม่แจ้ง (รอบหน้าลองใหม่)", async () => {
    mockedRelease.mockResolvedValue({ status: "error", message: "ท่อล่ม" });
    const { prisma, m } = mockPrisma({ orders: [sweepOrder()], staff: [{ id: "u2" }] });
    expect(await sweepStaleReservations(prisma, NOW)).toEqual({ released: 0, warned: 0, notified: 0 });
    expect(m.notification.create).not.toHaveBeenCalled();
  });

  it("แพ้ race (release คืน skipped) → ไม่นับ ไม่แจ้งซ้ำ", async () => {
    mockedRelease.mockResolvedValue({ status: "skipped", reason: "ปลดไปแล้วระหว่างนั้น" });
    const { prisma, m } = mockPrisma({ orders: [sweepOrder()], staff: [{ id: "u2" }] });
    expect(await sweepStaleReservations(prisma, NOW)).toEqual({ released: 0, warned: 0, notified: 0 });
    expect(m.notification.create).not.toHaveBeenCalled();
  });

  it("re-validate: ลูกค้าจ่ายมัดจำระหว่าง sweep รัน → ไม่ปลด (TOCTOU)", async () => {
    // snapshot แรกบอกค้างไม่จ่าย แต่ตอน re-read สด จ่ายมัดจำครบ 500 แล้ว → ต้องข้าม ไม่เรียก release
    const { prisma, m } = mockPrisma({
      orders: [sweepOrder()],
      staff: [{ id: "u2" }],
      freshOverride: sweepOrder({ invoices: [{ payments: [{ amount: 500, whtAmount: 0 }] }] }),
    });
    expect(await sweepStaleReservations(prisma, NOW)).toEqual({ released: 0, warned: 0, notified: 0 });
    expect(mockedRelease).not.toHaveBeenCalled();
    expect(m.notification.create).not.toHaveBeenCalled();
  });

  it("ค้าง 2–3 วัน → เตือนล่วงหน้า + จำว่าเตือนแล้ว (atomic claim)", async () => {
    const { prisma, m } = mockPrisma({
      orders: [sweepOrder({ stockReservedAt: new Date(NOW.getTime() - 2.5 * DAY) })],
      staff: [{ id: "u2" }],
    });
    const res = await sweepStaleReservations(prisma, NOW);
    expect(res).toEqual({ released: 0, warned: 1, notified: 2 }); // เจ้าของ u1 + ทีม u2
    expect(mockedRelease).not.toHaveBeenCalled();
    expect(m.order.updateMany).toHaveBeenCalledWith({
      where: { id: "o1", reservationExpiryWarnedAt: null },
      data: { reservationExpiryWarnedAt: NOW },
    });
    expect(m.notification.create.mock.calls[0][0].data.title).toContain("ใกล้ถูกปลดจอง");
  });

  it("เตือน: แพ้ race (updateMany ได้ 0 แถว) → ไม่แจ้งซ้ำ", async () => {
    const { prisma, m } = mockPrisma({
      orders: [sweepOrder({ stockReservedAt: new Date(NOW.getTime() - 2.5 * DAY) })],
      staff: [{ id: "u2" }],
      warnClaimCount: 0,
    });
    expect(await sweepStaleReservations(prisma, NOW)).toEqual({ released: 0, warned: 0, notified: 0 });
    expect(m.notification.create).not.toHaveBeenCalled();
  });

  it("นับ WHT เป็นเงินที่จ่ายแล้ว → ไม่ปลดปลอม", async () => {
    const { prisma } = mockPrisma({
      orders: [sweepOrder({ invoices: [{ payments: [{ amount: 200, whtAmount: 300 }] }] })], // รวม 500 = มัดจำครบ
      staff: [{ id: "u2" }],
    });
    expect(await sweepStaleReservations(prisma, NOW)).toEqual({ released: 0, warned: 0, notified: 0 });
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it("เครดิตเทอมค้างนานแค่ไหนก็ไม่ปลด (กรองในขั้น classify)", async () => {
    const { prisma } = mockPrisma({
      orders: [sweepOrder({ paymentTerms: "NET_30", stockReservedAt: new Date(NOW.getTime() - 30 * DAY) })],
      staff: [{ id: "u2" }],
    });
    expect(await sweepStaleReservations(prisma, NOW)).toEqual({ released: 0, warned: 0, notified: 0 });
    expect(mockedRelease).not.toHaveBeenCalled();
  });
});
