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
import { HelpTip } from "./ui/help-tip";
import { pageDescriptionForLabel } from "@/lib/page-identity";
import { visualToneForLabel } from "@/lib/visual-tone";

describe("system visual identity", () => {
  it("วาด module marker แบบเส้นเรียบโดย h1 ยังมีข้อความหัวข้อชุดเดียว", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "ควบคุมการผลิต" }));
    expect(html).toContain('data-page-identity="ควบคุมการผลิต"');
    expect(html).toContain("page-module-mark");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("ควบคุมการผลิต");
    expect(html).toContain("text-secondary");
    expect(html).not.toContain("bg-module-production-solid");
    expect(html).not.toContain("shadow-sm");
    expect(html).toContain('data-page-description=""');
    expect(html).toContain("ดูคิวผลิต งานที่ติดขัด และขั้นตอนที่ต้องจัดการต่อ");
  });

  it("แยกคำอธิบายหน้าที่เห็นเสมอออกจาก metadata ของรายการ", () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        title: "สินค้า Demo Tee",
        description: "ดู SKU ตัวเลือกสินค้า ราคา และสถานะที่ใช้เปิดงาน",
        meta: "DEMO-TEE-001",
      }),
    );
    expect(html).toContain('data-page-description=""');
    expect(html).toContain("ดู SKU ตัวเลือกสินค้า ราคา และสถานะที่ใช้เปิดงาน");
    expect(html).toContain('data-page-meta=""');
    expect(html).toContain("DEMO-TEE-001");
  });

  it("มีคำอธิบายสั้น fallback ครบทุกกลุ่มหน้าหลัก", () => {
    const labels = [
      "ภาพรวมวันนี้",
      "ออเดอร์ทั้งหมด",
      "ลูกค้า",
      "ใบเสนอราคา",
      "ควบคุมการผลิต",
      "บิล/การเงิน",
      "สินค้า",
      "ตั้งค่า",
      "หน้าระบบอื่น",
    ];
    for (const label of labels) {
      const description = pageDescriptionForLabel(label);
      expect(description.length).toBeGreaterThan(10);
      expect(description.length).toBeLessThanOrEqual(80);
    }
  });

  it("ผูกสีตามบริบทโดยไม่เปลี่ยนน้ำเงินของงานขาย", () => {
    expect(visualToneForLabel("ออเดอร์")).toBe("brand");
    expect(visualToneForLabel("ควบคุมการผลิต")).toBe("production");
    expect(visualToneForLabel("สินค้าและแพทเทิร์น")).toBe("product");
    expect(visualToneForLabel("บิลและการเงิน")).toBe("finance");
    expect(visualToneForLabel("ตั้งค่าผู้ใช้")).toBe("system");
  });

  it("HelpTip มีปุ่มที่เข้าถึงได้และไม่ปลอมเป็น alert", () => {
    const html = renderToStaticMarkup(
      createElement(HelpTip, {
        label: "อายุหนี้",
        children: "นับจากวันครบกำหนด",
      } as ComponentProps<typeof HelpTip>),
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="ดูคำอธิบาย: อายุหนี้"');
    expect(html).not.toContain('role="alert"');
  });

  it("EntityMark เลือก image แล้วค่อย initials แล้วค่อย icon", () => {
    const image = renderToStaticMarkup(
      createElement(EntityMark, { label: "งานตัวอย่าง", imageSrc: "/demo-mockups/front.svg" }),
    );
    const initials = renderToStaticMarkup(createElement(EntityMark, { label: "บริษัท อาณาจักร" }));
    const icon = renderToStaticMarkup(
      createElement(EntityMark, { label: "เอกสาร", icon: Factory, fallback: "icon", tone: "finance" }),
    );
    expect(image).toContain('data-entity-mark="image"');
    expect(initials).toContain('data-entity-mark="initials"');
    expect(icon).toContain('data-entity-mark="icon"');
    expect(icon).toContain("bg-module-finance-surface");
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
