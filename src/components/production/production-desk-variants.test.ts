import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiResetDesk } from "@/app/proto/ui-reset/_desk";
import { DeskTable, DeskTiles, DeskToolbar, type ProductionDeskVariant } from "./production-desk-view";
import { CurrentCell } from "./production-desk-cells";
import { createDemoState } from "@/app/proto/production-flow/_domain";
import { baselineDeskOrders } from "@/app/proto/production-flow/_components/current-baseline";
import { buildProductionBoard } from "@/lib/production-board";
import { buildDeskRows } from "@/lib/production-desk";

const location = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
(globalThis as Record<string, unknown>).React = React;
afterEach(() => { location.search = ""; });
const state = createDemoState();
const now = new Date(state.clock);
const rows = buildDeskRows(buildProductionBoard(baselineDeskOrders(state, "supervisor").orders, { now, showBlocked: true }), now);

describe("production desk presentation variants", () => {
  it("keeps omitted tile and toolbar variants identical to current", () => {
    const tiles = { summary: { late: 2, blocked: 1, outsource: 3, ready: 4 }, lens: "all" as const, onSelectLens: vi.fn() };
    expect(renderToStaticMarkup(React.createElement(DeskTiles, tiles))).toBe(renderToStaticMarkup(React.createElement(DeskTiles, { ...tiles, variant: "current" })));
    const toolbar = { searchDefault: "", searchInputRef: null, onSearchChange: vi.fn(), station: "", stations: [], outsourceTotal: 0, outsourceOverdue: 0, onSelectStation: vi.fn(), total: 10 };
    expect(renderToStaticMarkup(React.createElement(DeskToolbar, toolbar))).toBe(renderToStaticMarkup(React.createElement(DeskToolbar, { ...toolbar, variant: "current" })));
  });

  it("keeps the live table links and full cell rendering identical when no variant is passed", () => {
    const props = { rows, sort: { key: "deadline" as const, direction: "asc" as const }, onSort: vi.fn(), hrefFor: () => "/production/demo", emptyLabel: "ว่าง" };
    const current = renderToStaticMarkup(React.createElement(DeskTable, { ...props, variant: "current" }));
    expect(renderToStaticMarkup(React.createElement(DeskTable, props))).toBe(current);
    expect(current).toContain('href="/production/demo"');
    expect(current).not.toContain("<details");
  });

  it("keeps problems visible outside the route disclosure and in the compact queue", () => {
    const row: typeof rows[number] = { ...rows[0], current: [
      { label: "รอรีดร้อน", state: "active", reason: null },
      { label: "ร้านปักมีปัญหา", state: "failed", reason: "โลโก้ผิดสี" },
      { label: "ตรวจรอบสอง", state: "waiting", reason: "รอขั้นก่อน" },
    ] };
    const disclosure = renderToStaticMarkup(React.createElement(CurrentCell, { row, mode: "disclosure" }));
    expect(disclosure.indexOf("โลโก้ผิดสี")).toBeLessThan(disclosure.indexOf("<details"));
    expect(disclosure).toContain("สถานะทุกช่วงงาน");
    expect(disclosure).toContain("ตรวจรอบสอง");
    const summary = renderToStaticMarkup(React.createElement(CurrentCell, { row, mode: "summary" }));
    expect(summary).toContain("โลโก้ผิดสี");
    expect(summary).not.toContain("ตรวจรอบสอง");
    expect(summary).not.toContain("<details");
    expect(renderToStaticMarkup(React.createElement(CurrentCell, { row }))).toBe(renderToStaticMarkup(React.createElement(CurrentCell, { row, mode: "full" })));
  });

  it.each(["current", "a", "b"] as const)("renders %s with the shared fixture and preserves unknown records without a live query provider", (variant: ProductionDeskVariant) => {
    const html = renderToStaticMarkup(React.createElement(UiResetDesk, { variant }));
    expect(html).toContain("ORD-2609-0041");
    expect(html).toContain("คาเฟ่ริมปิง");
    expect(html).toContain("ร้านปักพี่ดาว");
    expect(html).toContain("งานเดิมรอยืนยัน");
    expect(html).toContain("ยังไม่มีหลักฐานยืนยันจำนวนที่รับ");
    expect(html).toContain("เปิดดูอย่างเดียว");
    expect(html).not.toContain('href="/production/');
    expect(html).not.toContain("บาท");
    expect(html).not.toContain("฿");
  });

  it("keeps the sort control visible when the workspace moves columns into detail", () => {
    const html = renderToStaticMarkup(React.createElement(UiResetDesk, { variant: "b" }));
    expect(html).toContain('aria-label="เรียงรายการผลิต"');
    expect(html).toContain("ส่งใกล้ก่อน");
    expect(html).toContain('aria-label="รายละเอียดใบงานที่เปิดดู"');
    expect(html).toContain("กลับรายการ");
    expect(html).toContain("งานตอนนี้");
    expect(html).toContain("ผู้รับผิดชอบ");
  });

  it.each(["current", "a", "b"] as const)("keeps the empty %s state empty instead of inventing a selected row", (variant) => {
    location.search = "empty=1";
    const html = renderToStaticMarkup(React.createElement(UiResetDesk, { variant }));
    expect(html).toContain("ไม่พบงานที่ตรงกับตัวกรอง");
    expect(html).not.toContain("ORD-");
    expect(html).not.toContain('aria-label="รายละเอียดใบงานที่เปิดดู"');
  });
});
