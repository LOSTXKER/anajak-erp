import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ACTIVE_FILTER, ACTIVE_UNDERLINE } from "./tokens";
import { FilterChip } from "./filter-chip";
import { FlowFilterBar } from "./flow-filter-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { groupedNavigationItems, findActiveNavigationItem } from "@/lib/navigation";
import { PublicPageShell } from "../public/public-page";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const shellSource = read("../layout/app-shell.tsx");
const knownBrand = /blue-\d+|module-brand|interactive-selected/;

describe("Anajak selected-state semantics", () => {
  it("selected tokens ใช้สีแบรนด์และมีค่าของธีมมืด โดยไม่ล็อกรูปร่างหรือเฉด", () => {
    expect(ACTIVE_UNDERLINE).toMatch(knownBrand);
    expect(ACTIVE_FILTER).toMatch(knownBrand);
    const css = read("../../app/globals.css");
    expect(css).toContain(".dark");
    expect(css).toContain("--color-interactive-selected:");
    expect(css).toContain("--color-interactive-selected-text:");
  });

  it.each([true, false])("ตัวกรองบอกการเลือก %s และส่งคำสั่งให้ caller", (selected) => {
    const onClick = vi.fn();
    const element = FilterChip({ selected, onClick, children: "รอผลิต 4 งาน", "aria-label": "กรองงานรอผลิต" });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(`aria-pressed="${selected}"`);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="กรองงานรอผลิต"');
    expect(html).toContain("รอผลิต 4 งาน");
    element.props.onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("เส้นทางงานบอกจำนวนจริงและผลของการกดตัวกรองที่เลือกอยู่", () => {
    const html = renderToStaticMarkup(createElement(FlowFilterBar, {
      items: [
        { key: "ready", label: "พร้อมผลิต", count: 4, dotClass: "bg-blue-500" },
        { key: "waiting", label: "รอเสื้อ", count: 0, dotClass: "bg-amber-500" },
      ],
      selected: "ready",
      onSelect: () => {},
      ariaLabel: "กรองงานผลิต",
    }));
    expect(html).toContain('role="group" aria-label="กรองงานผลิต"');
    expect(html).toContain('aria-label="พร้อมผลิต · 4 งาน · เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง"');
    expect(html).toContain('aria-label="รอเสื้อ · 0 งาน · กดเพื่อกรอง"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("แท็บประกาศส่วนที่เลือกและเชื่อมกับ panel ของตัวเอง", () => {
    const html = renderToStaticMarkup(createElement(Tabs, { defaultValue: "items" },
      createElement(TabsList, { "aria-label": "ส่วนของงาน" },
        createElement(TabsTrigger, { value: "items" }, "รายการ"),
        createElement(TabsTrigger, { value: "files" }, "ไฟล์"),
      ),
      createElement(TabsContent, { value: "items" }, "รายละเอียดรายการ"),
      createElement(TabsContent, { value: "files" }, "ไฟล์แนบ"),
    ));
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("รายละเอียดรายการ");
    const panelId = html.match(/role="tabpanel"[^>]*id="([^"]+)"/)?.[1];
    expect(panelId).toBeTruthy();
    expect(html).toContain(`aria-controls="${panelId}"`);
  });

  it("navigation ระบุหน้าที่อยู่จริงและกรองหมวดเงินด้วยสิทธิ์", () => {
    const visibleIds = (permissions: Parameters<typeof groupedNavigationItems>[1]) =>
      groupedNavigationItems("sidebar", permissions).flatMap((group) => group.items.map((item) => item.id));
    expect(visibleIds([])).not.toContain("quotations");
    expect(visibleIds(["see_order_money"])).toContain("quotations");
    expect(findActiveNavigationItem("/orders/order-1")?.id).toBe("orders");
    expect(shellSource).toContain('groupedNavigationItems("sidebar", me?.permissions)');
    expect(shellSource).toContain('aria-current={active ? "page" : undefined}');
    expect(shellSource).toContain("href={item.href}");
  });

  it("ตรา Anajak ยังอยู่ใน shell login และจอโรงงาน โดยไม่บังคับจำนวนหรือรูปแบบตรา", () => {
    expect(shellSource).toContain("Anajak Print");
    expect(shellSource).toMatch(knownBrand);
    expect(read("../../app/(auth)/login/page.tsx")).toMatch(knownBrand);
    for (const source of [read("../../app/factory/page.tsx"), read("../factory/manufacturing-factory-board.tsx")]) {
      expect(source).toContain("Anajak Print");
      expect(source).toMatch(knownBrand);
    }
  });

  it("เอกสารพิมพ์รักษาแบรนด์และเปิดการพิมพ์สีของเอกสาร", () => {
    const printSource = read("../print/print-document.tsx");
    expect(printSource).toMatch(knownBrand);
    expect(read("../../app/globals.css")).toContain("print-color-adjust: exact");
  });

  it("public มีตัวตน Anajak ปกติ และ blind ship ไม่เผยชื่อร้านหรือ footer", () => {
    const render = (blindShip: boolean) => {
      const props: ComponentProps<typeof PublicPageShell> = {
        icon: createElement("span", null, "ตรา"),
        title: blindShip ? "ร้านลูกค้า" : "Anajak Print",
        subtitle: "สถานะงาน",
        hideFooter: blindShip,
        children: "ข้อมูลของลูกค้า",
      };
      return renderToStaticMarkup(createElement(PublicPageShell, props));
    };
    expect(render(false)).toContain("Powered by Anajak Print ERP");
    expect(render(false)).toMatch(knownBrand);
    const blind = render(true);
    expect(blind).toContain("ร้านลูกค้า");
    expect(blind).toContain("ข้อมูลของลูกค้า");
    expect(blind).not.toContain("Anajak");
    expect(blind).not.toContain("<footer");
    expect(blind).not.toMatch(knownBrand);
  });

  it("เมนูผู้ใช้ยังมีชื่อและเส้นทางออกจากระบบผ่าน navigation guard", () => {
    const userMenuSource = read("../layout/user-menu.tsx");
    expect(userMenuSource).toContain("aria-label");
    expect(userMenuSource).toContain("requestAppNavigation");
    expect(userMenuSource).toContain("signOut");
  });
});
