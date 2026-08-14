import { describe, expect, it } from "vitest";
import { resolvePinnedOrderEditSession } from "@/lib/order-edit-session";

interface SessionFixture {
  orderId: string;
  orderNumber: string;
  internalStatus: string;
  orderType: string;
  seed: {
    expectedUpdatedAt: string;
    expectedItemsFingerprint: string;
    expectedFeesFingerprint: string;
    expectedReferenceImagesFingerprint: string;
  };
}

function session(
  orderId: string,
  version: string,
  overrides: Partial<SessionFixture> = {},
): SessionFixture {
  return {
    orderId,
    orderNumber: `ORD-${version}`,
    internalStatus: version === "v1" ? "INQUIRY" : "DESIGN_APPROVED",
    orderType: version === "v1" ? "CUSTOM" : "READY_MADE",
    seed: {
      expectedUpdatedAt: version,
      expectedItemsFingerprint: `items-${version}`,
      expectedFeesFingerprint: `fees-${version}`,
      expectedReferenceImagesFingerprint: `images-${version}`,
    },
    ...overrides,
  };
}

describe("resolvePinnedOrderEditSession", () => {
  it("ตรึง seed/status/เลข/ชนิดและ optimistic baselines ชุดแรกของ orderId เดิม", () => {
    const opened = session("order-1", "v1");
    const refetched = session("order-1", "v2");

    const pinned = resolvePinnedOrderEditSession(opened, "order-1", refetched);

    expect(pinned).toBe(opened);
    expect(pinned).toEqual(opened);
  });

  it("คง session เดิมเมื่อ background refetch ไม่มีข้อมูลหรือพัง", () => {
    const opened = session("order-1", "v1");

    expect(resolvePinnedOrderEditSession(opened, "order-1", null)).toBe(opened);
  });

  it("ไม่รั่ว session ข้าม orderId และรับ candidate ใหม่เมื่อพร้อม", () => {
    const opened = session("order-1", "v1");
    const next = session("order-2", "v2");

    expect(resolvePinnedOrderEditSession(opened, "order-2", null)).toBeNull();
    expect(resolvePinnedOrderEditSession(opened, "order-2", next)).toBe(next);
  });
});
