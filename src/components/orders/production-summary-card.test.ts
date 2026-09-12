import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductionSummaryCard } from "./production-summary-card";

type Props = ComponentProps<typeof ProductionSummaryCard>;
const base: Props = { orderId: "order-1", internalStatus: "PRODUCING", productions: [], isManagerUp: true, productionV2Enabled: false };

describe("สรุปใบผลิตในออเดอร์", () => {
  it("ระบุเลขใบพร้อมทางเปิด และไม่นับแพ็คเก่าเป็นขั้นผลิต", () => {
    const productions = [{ id: "production-1", workOrderNumber: "MO-2609-0042", steps: [
      { stepType: "DTF_PRINT", status: "COMPLETED", outsourceOrders: [] },
      { stepType: "HEAT_PRESS", status: "PENDING", assignedTo: { name: "ช่างทดสอบ" }, outsourceOrders: [] },
      { stepType: "PACKAGING", status: "PENDING", outsourceOrders: [] },
    ] }] as unknown as Props["productions"];
    const html = renderToStaticMarkup(createElement(ProductionSummaryCard, { ...base, productions }));
    expect(html).toContain("MO-2609-0042");
    expect(html).toContain('href="/production/production-1"');
    expect(html).toContain('aria-valuetext="1 จาก 2 ขั้นตอน"');
    expect(html).toContain("ช่างทดสอบ");
    expect(html).toContain("รีดร้อน");
  });

  it("เปิดใบผลิตเฉพาะผู้มีสิทธิ์และออเดอร์ที่ถึงขั้น", () => {
    const render = (props: Partial<Props>) => renderToStaticMarkup(createElement(ProductionSummaryCard, { ...base, ...props }));
    expect(render({ internalStatus: "CONFIRMED" })).toContain('href="/production?create=order-1"');
    expect(render({ internalStatus: "CONFIRMED", isManagerUp: false })).not.toContain("เปิดใบผลิต");
    expect(render({ internalStatus: "INQUIRY" })).toBe("");
  });
});
