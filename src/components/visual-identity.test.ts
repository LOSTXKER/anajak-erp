import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Factory, Users } from "lucide-react";
import { PageHeader } from "./page-header";
import { EntityMark } from "./ui/entity-mark";
import { ContextPanel } from "./ui/context-panel";
import { Section } from "./ui/section";
import { PublicPageShell } from "./public/public-page";
import { DocumentStamp } from "./print/print-document";

describe("system visual identity", () => {
  it("วาด module marker โดย h1 ยังมีข้อความหัวข้อชุดเดียว", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "ควบคุมการผลิต" }));
    expect(html).toContain('data-page-identity="ควบคุมการผลิต"');
    expect(html).toContain("page-module-mark");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("ควบคุมการผลิต");
  });

  it("EntityMark เลือก image แล้วค่อย initials แล้วค่อย icon", () => {
    const image = renderToStaticMarkup(
      createElement(EntityMark, { label: "งานตัวอย่าง", imageSrc: "/demo-mockups/front.svg" }),
    );
    const initials = renderToStaticMarkup(createElement(EntityMark, { label: "บริษัท อาณาจักร" }));
    const icon = renderToStaticMarkup(
      createElement(EntityMark, { label: "เอกสาร", icon: Factory, fallback: "icon" }),
    );
    expect(image).toContain('data-entity-mark="image"');
    expect(initials).toContain('data-entity-mark="initials"');
    expect(icon).toContain('data-entity-mark="icon"');
  });

  it("Section รองรับ icon และ ContextPanel ไม่ปลอมเป็น alert", () => {
    const section = renderToStaticMarkup(
      createElement(Section, { title: "ลูกค้า", icon: Users }, "ข้อมูล"),
    );
    const context = renderToStaticMarkup(
      createElement(ContextPanel, { title: "ข้อมูลประกอบ" } as ComponentProps<typeof ContextPanel>, "ข้อความคงที่"),
    );
    expect(section).toContain("<svg");
    expect(context).toContain("<aside");
    expect(context).not.toContain('role="alert"');
  });

  it("public blind-ship ซ่อน footer และ print stamp มีรหัสเอกสาร", () => {
    const publicHtml = renderToStaticMarkup(
      createElement(
        PublicPageShell,
        { icon: createElement(Factory), title: "แบรนด์ลูกค้า", subtitle: "สถานะงาน", hideFooter: true } as ComponentProps<typeof PublicPageShell>,
        "ข้อมูลลูกค้า",
      ),
    );
    const printHtml = renderToStaticMarkup(
      createElement(DocumentStamp, { title: "ใบรายการสินค้า", code: "PL", label: "Packing document" }),
    );
    expect(publicHtml).not.toContain("Powered by Anajak Print ERP");
    expect(publicHtml).toContain("แบรนด์ลูกค้า");
    expect(printHtml).toContain("PL");
    expect(printHtml).toContain("Packing document");
  });
});
