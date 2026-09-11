import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResponsiveList } from "./responsive-list";

const renderRows = (rows: readonly string[]) => createElement("p", null, rows.join(", "));
const renderList = (props: { items: string[]; isError?: boolean; isLoading?: boolean }) =>
  renderToStaticMarkup(createElement(ResponsiveList<string>, {
    ...props,
    renderDesktop: renderRows,
    renderMobile: renderRows,
    onRetry: () => undefined,
  }));

describe("ResponsiveList failed refresh", () => {
  it("keeps cached rows visible but identifies them as old and offers recovery", () => {
    const html = renderList({ items: ["ORD-2609-0017"], isError: true });
    expect(html).toContain("ORD-2609-0017");
    expect(html).toContain("อัปเดตรายการไม่สำเร็จ");
    expect(html).toContain("รายการอาจไม่ตรงกับตัวกรองหรือหน้าที่เลือก");
    expect(html).toContain('role="alert"');
    expect(html).toContain("ลองใหม่");
  });

  it("does not call failed initial data an empty list or stale result", () => {
    const html = renderList({ items: [], isError: true });
    expect(html).toContain("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    expect(html).not.toContain("ยังไม่มีรายการ");
    expect(html).not.toContain("ข้อมูลที่โหลดไว้ก่อนหน้า");
  });

  it("does not warn about stale data after a successful empty or populated response", () => {
    expect(renderList({ items: [] })).toContain("ยังไม่มีรายการ");
    const html = renderList({ items: ["ORD-2609-0017"] });
    expect(html).not.toContain("อัปเดตรายการไม่สำเร็จ");
    expect(html).toContain("ORD-2609-0017");
  });
});
