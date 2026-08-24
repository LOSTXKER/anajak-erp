import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductionDetail } from "./types";

const mocks = vi.hoisted(() => ({
  useGarmentQuery: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    production: {
      garmentPick: { useQuery: mocks.useGarmentQuery },
    },
  },
}));

import { ProductionControlRecord } from "./production-control-record";

function production({ legacy = false }: { legacy?: boolean } = {}) {
  return {
    id: "production-1",
    orderId: "order-1",
    status: "IN_PROGRESS",
    notes: null,
    order: {
      id: "order-1",
      orderNumber: "ORD-2606-0021",
      title: "ใบเสนอราคา",
      deadline: new Date("2026-08-25T00:00:00+07:00"),
      priority: "NORMAL",
      internalStatus: "PRODUCING",
      customer: { id: "customer-1", name: "ลูกค้าทดสอบ" },
      designs: [],
      items: [
        {
          id: "item-1",
          totalQuantity: 1,
          prints: [],
          products: [
            {
              id: "product-1",
              productType: "TSHIRT",
              description: "Anajak Oversize CVC",
              itemSource: "FROM_STOCK",
              fabricColor: "ดำ",
              totalQuantity: 1,
              variants: [],
            },
          ],
        },
      ],
    },
    steps: [
      ...(legacy
        ? []
        : [
            {
              id: "pick",
              stepType: "GARMENT_PICK",
              customStepName: null,
              status: "PENDING",
              sortOrder: 1,
              qtyDone: 0,
              qtyTotal: 1,
              notes: null,
              qcNotes: null,
              assignedTo: null,
              completedAt: null,
              outsourceOrders: [],
              printRunItems: [],
            },
          ]),
      {
        id: "print",
        stepType: "DTF_PRINT",
        customStepName: null,
        status: "COMPLETED",
        sortOrder: 2,
        qtyDone: 1,
        qtyTotal: 1,
        notes: null,
        qcNotes: null,
        assignedTo: { id: "user-1", name: "นามิ" },
        completedAt: new Date("2026-08-20T09:00:00+07:00"),
        outsourceOrders: [],
        printRunItems: [],
      },
      {
        id: "press",
        stepType: "HEAT_PRESS",
        customStepName: null,
        status: "PENDING",
        sortOrder: 3,
        qtyDone: 0,
        qtyTotal: 1,
        notes: null,
        qcNotes: null,
        assignedTo: null,
        completedAt: null,
        outsourceOrders: [],
        printRunItems: [],
      },
    ],
  } as unknown as ProductionDetail;
}

function renderRecord(detail = production()) {
  return renderToStaticMarkup(
    createElement(ProductionControlRecord, {
      production: detail,
      canSupervise: true,
      writeDataStale: false,
      dataUpdatedAt: new Date("2026-08-24T23:48:00+07:00").getTime(),
      isFetching: false,
      onManageStep: vi.fn(),
    }),
  );
}

describe("ProductionControlRecord Direction A contract", () => {
  beforeEach(() => {
    mocks.useGarmentQuery.mockReset();
    mocks.useGarmentQuery.mockReturnValue({
      data: {
        orderId: "order-1",
        orderNumber: "ORD-2606-0021",
        configured: true,
        problems: [],
        lines: [
          {
            sku: "CVC-BLACK-FREE",
            productName: "Anajak Oversize CVC",
            size: "FREE",
            color: "ดำ",
            needed: 1,
            issued: 0,
            returned: 0,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("แสดงข้อมูลจริงและเหลือ managerial action เดียวโดยไม่มีปุ่ม execution/utility เกิน mockup", () => {
    const html = renderRecord();

    expect(html).toContain("data-production-control-record");
    expect(html).toContain("ORD-2606-0021");
    expect(html).not.toContain("ยังไม่กำหนด");
    expect(html).toContain("นามิ");
    expect(html.match(/มอบหมายผู้รับผิดชอบ/g)).toHaveLength(1);
    expect(html).not.toContain("จัดการข้อยกเว้น");
    expect(html).not.toContain("ใบสั่งงาน");
    expect(html).not.toContain("ดูออเดอร์");
    expect(html).not.toContain("กลับหน้าควบคุมการผลิต");
    expect(html).toContain("<ol");
    expect(html).toContain("หลักฐานที่ระบบบันทึกตอนนี้");
    expect(html).not.toContain("ข้อมูลที่ต้องเพิ่ม");
    expect(html).not.toContain("border-dashed");
  });

  it("ขั้นที่มีผู้รับผิดชอบแล้วใช้คำว่าเปลี่ยน ไม่หลอกว่าเป็นงานที่ยังไม่มีเจ้าของ", () => {
    const detail = production();
    const pick = detail.steps.find((step) => step.id === "pick");
    if (!pick) throw new Error("missing fixture step");
    pick.assignedTo = { id: "user-2", name: "พี่ก้อย" };

    const html = renderRecord(detail);

    expect(html).toContain("เปลี่ยนผู้รับผิดชอบ");
    expect(html).not.toContain("มอบหมายผู้รับผิดชอบ");
  });

  it("ขั้นที่สถานีแจ้ง FAILED ใช้ CTA จัดการปัญหา ไม่เรียกแค่มอบหมาย", () => {
    const detail = production();
    const pick = detail.steps.find((step) => step.id === "pick");
    if (!pick) throw new Error("missing fixture step");
    pick.status = "FAILED";
    pick.notes = "เสื้อขาด 1 ตัว";

    const html = renderRecord(detail);

    expect(html).toContain("จัดการปัญหา");
    expect(html).not.toContain(">มอบหมายผู้แก้ไข<");
    expect(html).toContain("เสื้อขาด 1 ตัว");
  });

  it("ยังแสดง FAILED และ CTA หลักระหว่างกำลังโหลดหลักฐานเสื้อ", () => {
    const detail = production();
    const pick = detail.steps.find((step) => step.id === "pick");
    if (!pick) throw new Error("missing fixture step");
    pick.status = "FAILED";
    pick.notes = "เสื้อขาด 1 ตัว";
    mocks.useGarmentQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const html = renderRecord(detail);

    expect(html).toContain("เสื้อขาด 1 ตัว");
    expect(html).toContain("จัดการปัญหา");
    expect(html).toContain("กำลังตรวจหลักฐานการเบิกเสื้อ");
  });

  it("ยังแสดง FAILED และ CTA หลักเมื่อโหลดหลักฐานเสื้อไม่สำเร็จ", () => {
    const detail = production();
    const pick = detail.steps.find((step) => step.id === "pick");
    if (!pick) throw new Error("missing fixture step");
    pick.status = "FAILED";
    pick.notes = "เสื้อขาด 1 ตัว";
    mocks.useGarmentQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    const html = renderRecord(detail);

    expect(html).toContain("เสื้อขาด 1 ตัว");
    expect(html).toContain("จัดการปัญหา");
    expect(html).toContain("ตรวจความพร้อมเสื้อไม่ได้");
    expect(html).toContain("ลองใหม่");
  });

  it("ใบเก่าที่ไม่มี GARMENT_PICK แสดง unknown แม้ query mock มียอดขาด", () => {
    const html = renderRecord(production({ legacy: true }));

    expect(mocks.useGarmentQuery).toHaveBeenCalledWith(
      { productionId: "production-1" },
      {
        enabled: false,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    );
    expect(html).toContain("ยังยืนยันความพร้อมเสื้อไม่ได้");
    expect(html).toContain("ใบเก่านี้ไม่มีขั้นเตรียมเสื้อ");
    expect(html).toContain("ยังไม่ทราบ");
    expect(html).not.toContain("ยังไม่ได้เบิกเสื้อ 1 ตัว");
    expect(html).not.toContain(">ขาด 1<");
  });

  it("หลาย SKU ใช้ชื่อรวมชั้นเดียวและบอกชัดว่าตัวเลขเป็นยอดรวม", () => {
    const queryState = mocks.useGarmentQuery();
    queryState.data.lines.push({
      sku: "CVC-WHITE-L",
      productName: "Anajak Oversize CVC White",
      size: "L",
      color: "ขาว",
      needed: 2,
      issued: 0,
      returned: 0,
    });
    mocks.useGarmentQuery.mockReturnValue(queryState);

    const html = renderRecord();

    expect(html.match(/เสื้อขาด 2 รายการ/g)).toHaveLength(1);
    expect(html).toContain("ต้องใช้รวม");
    expect(html).toContain("เบิกสุทธิรวม");
    expect(html).toContain("ยังขาดรวม");
  });

  it("query เสื้อ refetch พังพร้อม cache ต้องเตือนว่าไม่สดและไม่สรุปว่าพร้อม", () => {
    const queryState = mocks.useGarmentQuery();
    mocks.useGarmentQuery.mockReturnValue({
      ...queryState,
      isError: true,
      refetch: vi.fn(),
    });

    const html = renderRecord();

    expect(html).toContain("ข้อมูลเสื้ออาจไม่สด");
    expect(html).toContain("ระบบจะยังไม่สรุปว่างานพร้อม");
    expect(html).toContain("ลองโหลดข้อมูลล่าสุด");
    expect(html).not.toContain(">พร้อม<");
  });

  it("ใบที่ผลิตครบยกเวลาปิดงานและผู้รับช่วงต่อขึ้นแทน progress ซ้ำ", () => {
    const detail = production();
    detail.order.internalStatus = "READY_TO_SHIP";
    detail.steps.forEach((step, index) => {
      step.status = "COMPLETED";
      step.qtyDone = step.qtyTotal ?? 0;
      step.completedAt = new Date(`2026-08-2${index + 1}T09:00:00+07:00`);
    });
    const queryState = mocks.useGarmentQuery();
    queryState.data.lines[0].issued = 1;
    mocks.useGarmentQuery.mockReturnValue(queryState);

    const html = renderRecord(detail);

    expect(mocks.useGarmentQuery).toHaveBeenCalledWith(
      { productionId: detail.id },
      expect.objectContaining({ enabled: false }),
    );
    expect(html).toContain("สรุปการปิดงานผลิต");
    expect(html).toContain("ผลิตเสร็จ");
    expect(html).toContain("ส่งมอบให้ลูกค้า");
    expect(html).toContain("เจ้าของถัดไป: ฝ่ายจัดส่ง");
    expect(html).toContain(`/orders/order-1?tab=delivery`);
    expect(html).toContain("หลักฐานปิดงาน");
    expect(html).not.toContain('aria-label="ความคืบหน้าการผลิต"');
    expect(html).not.toContain("ไม่มีปัญหาที่เปิดอยู่");
    expect(html).not.toContain("ความพร้อม</h2>");
  });
});
