import { describe, expect, it, vi } from "vitest";
import {
  STOCK_RESERVATION_PENDING_MESSAGE,
  STOCK_RESERVATION_PENDING_PRODUCTION_MESSAGE,
} from "@/lib/stock-reservation-state";
import { transitionOrder } from "./order-status";

function transitionTx(params?: { pendingInitially?: boolean; pendingAfterRead?: boolean }) {
  const initial = {
    orderType: "CUSTOM",
    internalStatus: "PRODUCTION_QUEUE",
    stockReservationError: params?.pendingInitially
      ? STOCK_RESERVATION_PENDING_MESSAGE
      : null,
  };
  const findUniqueOrThrow = vi
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce({
      stockReservationError: params?.pendingAfterRead
        ? STOCK_RESERVATION_PENDING_MESSAGE
        : null,
    });
  const updateMany = vi.fn().mockResolvedValue({
    count: params?.pendingAfterRead ? 0 : 1,
  });
  const tx = {
    order: { findUniqueOrThrow, updateMany },
    orderRevision: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "revision-1" }),
    },
  };
  return { tx, findUniqueOrThrow, updateMany };
}

describe("transitionOrder — pending stock reservation gate", () => {
  it("blocks PRODUCING when the reservation update is already pending", async () => {
    const { tx, updateMany } = transitionTx({ pendingInitially: true });

    await expect(
      transitionOrder(tx as never, {
        orderId: "order-1",
        to: "PRODUCING",
        changedBy: "user-1",
      }),
    ).rejects.toThrow(STOCK_RESERVATION_PENDING_PRODUCTION_MESSAGE);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("keeps the gate atomic when pending is set between read and update", async () => {
    const { tx, updateMany, findUniqueOrThrow } = transitionTx({
      pendingAfterRead: true,
    });

    await expect(
      transitionOrder(tx as never, {
        orderId: "order-1",
        to: "PRODUCING",
        changedBy: "user-1",
      }),
    ).rejects.toThrow(STOCK_RESERVATION_PENDING_PRODUCTION_MESSAGE);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        internalStatus: "PRODUCTION_QUEUE",
        OR: [
          { stockReservationError: null },
          {
            stockReservationError: {
              not: STOCK_RESERVATION_PENDING_MESSAGE,
            },
          },
        ],
      },
      data: expect.objectContaining({ internalStatus: "PRODUCING" }),
    });
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(2);
  });

  it("allows PRODUCING after the reservation settles", async () => {
    const { tx, updateMany } = transitionTx();

    await expect(
      transitionOrder(tx as never, {
        orderId: "order-1",
        to: "PRODUCING",
        changedBy: "user-1",
      }),
    ).resolves.toEqual({ changed: true, from: "PRODUCTION_QUEUE" });

    expect(updateMany).toHaveBeenCalledOnce();
  });
});
