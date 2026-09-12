import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderStatusBadge } from "../order-status-badge";
import { OrderStatusFlowBar } from "./order-status-flow-bar";
import { DataTable } from "../ui/data-table";
import { CUSTOMER_STATUS_LABELS, INTERNAL_STATUS_LABELS, ORDER_TYPE_UI_LABELS } from "@/lib/order-status";
import { formatBaht } from "@/lib/utils";

const pageSource = readFileSync(new URL("./orders-page.tsx", import.meta.url), "utf8");
const tableSource = readFileSync(new URL("../ui/data-table.tsx", import.meta.url), "utf8");

describe("Orders registry information and navigation", () => {
  it("ระบุใบด้วยเลขออเดอร์และลูกค้า โดยไม่คืน field ชื่องานที่ถอดจากระบบแล้ว", () => {
    expect(pageSource).toContain("order.customer?.name?.trim()");
    expect(pageSource).toContain("{order.orderNumber}");
    expect(pageSource).toContain("<DataTable.Th>ลูกค้า</DataTable.Th>");
    expect(pageSource).not.toContain("order.title");
    expect(pageSource).not.toContain("orderTitle");
  });

  it("คงประเภทงาน ช่องทาง และสถานะโดยใช้ป้ายร่วมของระบบ", () => {
    expect(pageSource).toContain("<DataTable.Th>ประเภทงาน</DataTable.Th>");
    expect(pageSource).toContain("ORDER_TYPE_UI_LABELS[orderType]");
    expect(pageSource).toContain("CHANNEL_LABELS[order.channel]");
    expect(pageSource).toContain("<OrderStatusBadge");
    expect(ORDER_TYPE_UI_LABELS.CUSTOM).toBeTruthy();
    expect(ORDER_TYPE_UI_LABELS.READY_MADE).toBeTruthy();
    expect(ORDER_TYPE_UI_LABELS.CUSTOM).not.toBe(ORDER_TYPE_UI_LABELS.READY_MADE);
  });

  it("สถานะภายในยังอ่านได้ในหน้าที่ต้องใช้และซ่อนได้เฉพาะบริบททะเบียน", () => {
    const props = { customerStatus: "PREPARING", internalStatus: "DESIGNING" } as const;
    const detailed = renderToStaticMarkup(createElement(OrderStatusBadge, { ...props, labelInternalStatus: true }));
    const registry = renderToStaticMarkup(createElement(OrderStatusBadge, { ...props, showInternalStatus: false }));
    expect(detailed).toContain(CUSTOMER_STATUS_LABELS.PREPARING);
    expect(detailed).toContain(`ภายใน: ${INTERNAL_STATUS_LABELS.DESIGNING}`);
    expect(registry).toContain(CUSTOMER_STATUS_LABELS.PREPARING);
    expect(registry).not.toContain(INTERNAL_STATUS_LABELS.DESIGNING);
    const internalOnly = renderToStaticMarkup(createElement(OrderStatusBadge, { internalStatus: "DESIGNING" }));
    expect(internalOnly).toContain(INTERNAL_STATUS_LABELS.DESIGNING);
  });

  it("เลขออเดอร์ยังเป็นลิงก์จริงทั้งสองมุมมอง และแถวไม่แย่งคลิกจาก controls ภายใน", () => {
    const desktop = pageSource.slice(pageSource.indexOf("renderDesktop="), pageSource.indexOf("renderMobile="));
    const mobile = pageSource.slice(pageSource.indexOf("renderMobile="));
    for (const source of [desktop, mobile]) {
      expect(source).toContain('href={`/orders/${order.id}`}');
      expect(source).toContain("{order.orderNumber}");
    }
    expect(tableSource).toContain('t.closest("a,button,input,select,textarea,label,');
    expect(tableSource).toContain("window.getSelection()?.toString()");
    expect(tableSource).toContain("requestAppNavigation(href");
  });

  it.each([true, false])("ตารางคง semantics และข้อมูลเมื่อ bordered=%s", (bordered) => {
    const html = renderToStaticMarkup(createElement(DataTable.Root, { bordered },
      createElement(DataTable.Head, null, createElement("tr", null, createElement(DataTable.Th, null, "เลขออเดอร์"))),
      createElement(DataTable.Body, null, createElement("tr", null,
        createElement(DataTable.Td, null, createElement("a", { href: "/orders/order-1" }, "ORD-001")),
      )),
    ));
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain('scope="col"');
    expect(html).toContain('href="/orders/order-1"');
    expect(html).toContain("ORD-001");
  });

  it("วันส่งยังเรียงได้และประกาศทิศที่เลือกให้โปรแกรมอ่านหน้าจอ", () => {
    expect(pageSource).toContain('sortColumn("deadline")');
    expect(pageSource).toContain("<OrderDeadline");
    expect(pageSource).toContain("deadline={order.deadline}");
    for (const [direction, ariaSort] of [["asc", "ascending"], ["desc", "descending"]] as const) {
      const html = renderToStaticMarkup(createElement("table", null,
        createElement("thead", null, createElement("tr", null,
          createElement(DataTable.SortableTh, { direction, onSort: () => {} }, "กำหนดส่ง"),
        )),
      ));
      expect(html).toContain(`aria-sort="${ariaSort}"`);
      expect(html).toContain('type="button"');
      expect(html).toContain("กำหนดส่ง");
    }
  });

  it("ยอดเงินคงทศนิยมและอยู่หลังด่านสิทธิ์ทั้งหน้าจอและ CSV", () => {
    expect(formatBaht(1234.5)).toContain("1,234.50");
    expect(formatBaht(0)).toContain("0.00");
    expect(pageSource).toContain('permAllows(me?.permissions, "see_order_money")');
    expect(pageSource).toContain("{canSeeMoney && (");
    expect(pageSource).toContain("{formatBaht(order.totalAmount ?? 0)}");
    expect(pageSource).toContain('...(canSeeMoney ? ["ยอดรวม"] : [])');
    expect(pageSource).toContain("...(canSeeMoney ? [String(o.totalAmount ?? 0)] : [])");
  });

  it("ตัวกรองสถานะคงจำนวนและคำสั่งล้างสถานะ รวมงานนอกเส้นทาง", () => {
    const html = renderToStaticMarkup(createElement(OrderStatusFlowBar, {
      counts: { PRODUCING: 12, ON_HOLD: 3 }, selected: "PRODUCING", onSelect: () => {},
    }));
    expect(html).toContain(`${INTERNAL_STATUS_LABELS.PRODUCING} · 12 งาน · เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง`);
    expect(html).toContain(`${INTERNAL_STATUS_LABELS.ON_HOLD} · 3 งาน · กดเพื่อกรอง`);
    expect(html).toContain('aria-label="สถานะนอกเส้นทางงาน"');
    expect(pageSource).toContain("counts={data?.statusCounts}");
    expect(pageSource).toContain("selected={internalStatus}");
  });

  it("ส่งออกตามหน้าที่เห็น และยังค้นหา แบ่งหน้า และล้างตัวกรองผ่าน URL เดิม", () => {
    expect(pageSource).toContain("ส่งออกหน้านี้");
    expect(pageSource).toContain("exportOrdersCsv(data.orders, canSeeMoney)");
    expect(pageSource).toContain("useListPageState()");
    expect(pageSource).toContain("<TablePagination");
    expect(pageSource).toContain("total={data.total}");
    expect(pageSource).toContain("onClick={clearFiltersAndSearch}");
    expect(pageSource).toContain("onChange={(event) => onSearchChange(event.target.value)}");
  });
});
