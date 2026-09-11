import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ exceptions: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: { manufacturing: {
    workCenterLoad: { useQuery: () => ({ data: [], isLoading: false, isError: false, dataUpdatedAt: 0 }) },
    exceptionList: { useQuery: queries.exceptions },
  } },
}));

import { ManufacturingFactoryBoard } from "./manufacturing-factory-board";

(globalThis as Record<string, unknown>).React = React;

describe("Factory แยกโหลดปัญหาไม่สำเร็จจากไม่มีปัญหา", () => {
  it("โหลดรายการปัญหาครั้งแรกล้มเหลวต้องไม่แสดงไฟเขียวว่าไม่มีปัญหา", () => {
    queries.exceptions.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    const html = renderToStaticMarkup(React.createElement(ManufacturingFactoryBoard));
    expect(html).toContain("โหลดรายการปัญหาไม่สำเร็จ");
    expect(html).not.toContain("ไม่มีปัญหาเปิดอยู่");
  });

  it("แสดงไม่มีปัญหาได้เมื่อ query สำเร็จและว่างจริง", () => {
    queries.exceptions.mockReturnValue({ isLoading: false, isError: false, data: { items: [] } });
    const html = renderToStaticMarkup(React.createElement(ManufacturingFactoryBoard));
    expect(html).toContain("ไม่มีปัญหาเปิดอยู่");
    expect(html).not.toContain("โหลดรายการปัญหาไม่สำเร็จ");
  });
});
