import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatCard } from "./stat-card";

describe("StatCard data state", () => {
  it("does not announce a placeholder balance or change while loading", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { title: "ยอดค้าง", value: "฿0", change: 20, caption: "ยังไม่มีหนี้", loading: true }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("กำลังโหลดยอดค้าง");
    expect(html).not.toContain("฿0");
    expect(html).not.toContain("20.0%");
    expect(html).not.toContain("ยังไม่มีหนี้");
  });

  it("shows a genuine zero after the query resolves", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { title: "ยอดค้าง", value: "฿0", caption: "ไม่มีหนี้" }));
    expect(html).toContain("฿0");
    expect(html).toContain("ไม่มีหนี้");
    expect(html).not.toContain("กำลังโหลด");
  });
});
