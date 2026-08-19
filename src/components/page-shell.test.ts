import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageShell } from "./page-shell";

describe("PageShell custom header", () => {
  it("ให้ workspace แทน PageHeader ได้โดยยังคง body state ของ shell", () => {
    const props = {
      title: "หัวมาตรฐานที่ไม่ควรวาด",
      header: createElement("header", { "data-workspace-header": "" }, "หัว workspace"),
      loading: true,
      skeleton: createElement("div", { "data-workspace-skeleton": "" }, "กำลังโหลด"),
      children: createElement("main", null, "ข้อมูลจริง"),
    };
    const html = renderToStaticMarkup(
      createElement(PageShell, props),
    );

    expect(html).toContain("data-workspace-header");
    expect(html).toContain("data-workspace-skeleton");
    expect(html).not.toContain("หัวมาตรฐานที่ไม่ควรวาด");
    expect(html).not.toContain("ข้อมูลจริง");
  });
});
