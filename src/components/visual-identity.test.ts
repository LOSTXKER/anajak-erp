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
import { visualToneForLabel } from "@/lib/visual-tone";

describe("system visual identity", () => {
  it("หัวหน้ามี h1 เดียวและไม่เติมคำอธิบายที่ caller ไม่ได้ส่ง", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, {
      title: "ควบคุมการผลิต",
      titleBadge: createElement("span", null, "กำลังผลิต"),
    }));
    expect(html).toContain('data-page-identity="ควบคุมการผลิต"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>ควบคุมการผลิต<\/h1>/);
    expect(html).toContain("กำลังผลิต");
    expect(html).not.toContain('data-page-description=""');
    expect(html).not.toContain("ดูคิวผลิต งานที่ติดขัด และขั้นตอนที่ต้องจัดการต่อ");
  });

  it("หัวรายละเอียดคงทางกลับจาก breadcrumb และยอมรับทางกลับที่ caller ระบุ", () => {
    const breadcrumb = [{ label: "ออเดอร์", href: "/orders" }, { label: "ORD-001" }];
    const implicit = renderToStaticMarkup(createElement(PageHeader, { title: "ORD-001", breadcrumb }));
    expect(implicit).toContain('href="/orders"');
    expect(implicit).toContain('aria-label="กลับไปออเดอร์"');
    const explicit = renderToStaticMarkup(createElement(PageHeader, {
      title: "ORD-001", breadcrumb,
      back: { href: "/my-tasks", label: "กลับงานของฉัน" },
    }));
    expect(explicit).toContain('href="/my-tasks"');
    expect(explicit).toContain('aria-label="กลับงานของฉัน"');
    expect(explicit).not.toContain('href="/orders"');
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

  it("กลุ่มงานแสดงคำช่วยที่จำเป็นก่อนเนื้อหา โดยไม่ซ่อนหลังปุ่มข้อมูล", () => {
    const instruction = "ตรวจยอดรับจริงก่อนยืนยัน หากนับผิดให้แก้ยอดพร้อมเหตุผล";
    const html = renderToStaticMarkup(createElement(Section, {
      title: "ตรวจรับเสื้อ", description: instruction,
    }, "รายการไซซ์"));
    expect(html).toContain('data-section-description=""');
    expect(html).toContain(instruction);
    expect(html.indexOf(instruction)).toBeLessThan(html.indexOf("รายการไซซ์"));
    expect(html).not.toContain('aria-label="ดูคำอธิบาย');
    expect(html).not.toContain(`description="${instruction}"`);
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
    expect(image).toContain('src="/demo-mockups/front.svg"');
    expect(icon).toContain('aria-hidden="true"');
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
    expect(publicHtml).not.toContain("Anajak");
    expect(publicHtml).not.toContain("<footer");
    expect(publicHtml).toContain("สถานะงาน");
    expect(publicHtml).toContain("ข้อมูลลูกค้า");
    expect(printHtml).toContain('data-document-stamp="PL"');
    expect(printHtml).toContain("PL");
    expect(printHtml).toContain("Packing document");
  });
});
