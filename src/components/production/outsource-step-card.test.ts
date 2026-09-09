import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutsourceStepCard } from "./outsource-step-card";
import type { ProductionStep } from "./types";

const { jobsQuery, receiptsQuery } = vi.hoisted(() => ({ jobsQuery: vi.fn(), receiptsQuery: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    outsource: { listOrders: { useQuery: jobsQuery }, updateOrderStatus: {}, cancelDraftOrder: {} },
    goodsReceipt: { listByOrder: { useQuery: receiptsQuery } },
    outsourceShare: { generateLink: { useMutation: () => ({}) } },
    useUtils: () => ({ outsource: {}, production: {}, factory: {}, order: {}, goodsReceipt: {} }),
  },
}));
vi.mock("@/hooks/use-mutation-with-invalidation", () => ({ useMutationWithInvalidation: () => ({ isPending: false, mutate: vi.fn() }) }));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => vi.fn() }));

const step = { id: "step-1", qtyTotal: 10, qtyDone: 0, status: "IN_PROGRESS" } as unknown as ProductionStep;
function render(canCancelDraft: boolean) {
  return renderToStaticMarkup(createElement(OutsourceStepCard, {
    step, orderId: "order-1", canCreate: false, enabled: false, canCancelDraft,
  }));
}

describe("outsource draft recovery", () => {
  beforeEach(() => {
    jobsQuery.mockReturnValue({
      dataUpdatedAt: Date.now(), isLoading: false, isError: false, isFetching: false,
      data: [{
        id: "job-1", vendor: { name: "ร้านปัก" }, description: "ปักอก", quantity: 10,
        status: "DRAFT", availableCommands: ["markSent", "cancelDraft"],
      }],
    });
    receiptsQuery.mockReturnValue({ data: [], isLoading: false, isError: false, isFetching: false });
  });

  it("หัวหน้าลบใบร่างได้แม้ออเดอร์ถูกพัก โดยยังส่งของหรือสร้างใบใหม่ไม่ได้", () => {
    const html = render(true);
    expect(html).toContain("ยกเลิกใบร่าง");
    expect(html).not.toContain("ส่งของให้ร้านแล้ว");
    expect(html).not.toContain("สร้างใบส่งร้าน");
  });

  it("คนที่ไม่มีสิทธิ์หัวหน้าไม่เห็นปุ่มยกเลิกร่าง", () => {
    expect(render(false)).not.toContain("ยกเลิกใบร่าง");
  });

  it("สิทธิ์หัวหน้าไม่เปิดปุ่มยกเลิกหาก server ไม่อนุญาตแล้ว", () => {
    jobsQuery.mockReturnValue({
      dataUpdatedAt: Date.now(), isLoading: false, isError: false, isFetching: false,
      data: [{ id: "job-1", vendor: { name: "ร้านปัก" }, quantity: 10, status: "SENT", availableCommands: [] }],
    });
    expect(render(true)).not.toContain("ยกเลิกใบร่าง");
  });
});
