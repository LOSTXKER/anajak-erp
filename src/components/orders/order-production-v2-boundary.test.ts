import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  new URL("../../app/(dashboard)/orders/[id]/page.tsx", import.meta.url),
  "utf8",
);
const detailSource = readFileSync(
  new URL("./detail/order-detail-page.tsx", import.meta.url),
  "utf8",
);
const summarySource = readFileSync(
  new URL("./production-summary-card.tsx", import.meta.url),
  "utf8",
);
// หน้าออเดอร์รื้อตามต้นแบบรอบ 2 (2026-09-15): แท็บงานผลิต/รายการแยกไฟล์ของหน้าออเดอร์เอง
// OrderItemsDisplay ตัวเดิมยังเป็นของหน้าใบผลิต — ด่านนี้ดูไฟล์ที่หน้าออเดอร์ใช้จริง
const productionTabSource = readFileSync(
  new URL("./detail/order-production-tab.tsx", import.meta.url),
  "utf8",
);
const itemsSource = readFileSync(
  new URL("./detail/order-items-tab.tsx", import.meta.url),
  "utf8",
);

describe("Order production V2 boundary", () => {
  it("ส่ง feature flag จาก server route เข้าหน้าออเดอร์", () => {
    expect(routeSource).toContain("productionV2Enabled={productionV2Enabled()}");
  });

  it("ซ่อน surface รับของและ QC เมื่อเปิด V2 แต่เก็บ legacy fallback", () => {
    expect(detailSource).toContain("<OrderProductionTab");
    expect(detailSource).toContain("productionV2Enabled={productionV2Enabled}");
    expect(productionTabSource).toContain("{!productionV2Enabled ? (");
    expect(productionTabSource).toContain("<OrderGoodsReceiptSection");
    expect(productionTabSource).toContain("<OrderQcSection");
    expect(productionTabSource).toContain("productionV2Enabled={productionV2Enabled}");
  });

  it("CTA ของ V2 เป็นการเปิดใบสั่งผลิต ไม่สื่อว่าทำงานซ้ำในหน้าออเดอร์", () => {
    expect(summarySource).toContain(
      'productionV2Enabled ? "เปิดใบสั่งผลิต" : "เปิดงานผลิต"',
    );
  });

  it("หลักฐานรับเสื้อในหน้า Order เป็น read-only เมื่อเปิด V2", () => {
    expect(detailSource).toContain("!productionV2Enabled &&");
    expect(detailSource).toContain("!hasV2Production &&");
    expect(detailSource).toContain(
      "canEditReceiveTracking={canEditReceiveTracking}",
    );
    expect(itemsSource).toContain("readOnly={!canEditReceiveTracking}");
    expect(itemsSource).toContain("!readOnly ? (");
  });

  it("ออเดอร์ที่มีใบผลิตแล้วไม่เปิด action เปลี่ยนนิยามหรือสถานะซ้ำ", () => {
    expect(detailSource).toContain("const hasV2Production =");
    expect(detailSource).toContain(
      'hasV2Production && target !== "COMPLETED"',
    );
    expect(detailSource).toContain("const canEditItems =\n    !hasV2Production &&");
  });
});
