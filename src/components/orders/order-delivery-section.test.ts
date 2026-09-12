import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderDeliverySection } from "./order-delivery-section";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

const state = vi.hoisted(() => ({
  deliveries: { data: [] as unknown[], isError: false, isPending: false, refetch: vi.fn() },
  pack: { data: { blindShip: false, customerName: "ผู้รับทดลอง" }, isError: false, refetch: vi.fn() },
  permissions: ["ship_orders"] as string[],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ delivery: { getByOrderId: { invalidate: vi.fn() } }, order: { getById: { invalidate: vi.fn() } } }),
    delivery: {
      getByOrderId: { useQuery: () => state.deliveries },
      packContext: { useQuery: () => state.pack },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    user: { me: { useQuery: () => ({ data: { permissions: state.permissions } }) } },
  },
}));

const render = () => renderToStaticMarkup(createElement(ConfirmDialogProvider, null,
  createElement(OrderDeliverySection, { orderId: "order-1", internalStatus: "PACKING" }),
));

beforeEach(() => {
  state.deliveries.data = [];
  state.deliveries.isError = false;
  state.deliveries.isPending = false;
  state.pack.isError = false;
  state.pack.data.blindShip = false;
  state.permissions = ["ship_orders"];
});

describe("ข้อมูลและทางเดินในแท็บจัดส่ง", () => {
  it("มีปุ่มสร้างเมื่อพร้อม และไม่เปิดให้ผู้ไม่มีสิทธิ์จัดส่ง", () => {
    expect(render()).toContain("สร้างรายการจัดส่ง");
    state.permissions = [];
    expect(render()).not.toContain("สร้างรายการจัดส่ง");
  });

  it("แพ็คอัปเดตไม่สำเร็จแม้มี cache ต้องอธิบายเหตุที่สร้างใบส่งไม่ได้", () => {
    state.pack.isError = true;
    const html = render();
    expect(html).toContain("โหลดข้อมูลสำหรับแพ็คสินค้าไม่สำเร็จ จึงยังสร้างใบส่งไม่ได้");
    expect(html).toContain("ลองใหม่");
    expect(html).not.toContain("สร้างรายการจัดส่ง");
    expect(html).not.toContain("ยังไม่มีใบส่งของ");
  });

  it("แสดงใบส่งที่โหลดไว้พร้อมคำเตือนเมื่อ refetch ล้มเหลว", () => {
    state.deliveries.isError = true;
    state.deliveries.data = [{
      id: "delivery-1", status: "PENDING", recipientName: "ผู้รับจากข้อมูลเดิม", phone: "0812345678",
      address: "ที่อยู่จัดส่ง", lines: [], trackingNumber: null, shippingMethod: "KERRY", shippingCost: 0,
      createdAt: "2026-09-13T00:00:00Z",
    }];
    const html = render();
    expect(html).toContain("อัปเดตรายการจัดส่งไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดไว้");
    expect(html).toContain("ผู้รับจากข้อมูลเดิม");
    expect(html).not.toContain("ยังไม่มีใบส่งของ");
  });

  it("คำสั่ง blind ship ยังคงเห็นชัดเมื่อโหลดแพ็คซ้ำไม่สำเร็จ", () => {
    state.pack.data.blindShip = true;
    state.pack.isError = true;
    expect(render()).toContain("ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง");
  });
});
