import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillingNavigation } from "./billing-navigation";

describe("ทางไปงานการเงิน", () => {
  it.each(["/billing", "/billing/notes", "/billing/aging", "/billing/tax", "/billing/wht"] as const)(
    "%s แสดงทางไปทั้งห้างานและระบุหน้าที่เปิดเพียงหน้าเดียว",
    (active) => {
      const html = renderToStaticMarkup(createElement(BillingNavigation, { active }));
      expect(html).toContain('aria-label="งานการเงิน"');
      for (const path of ["/billing", "/billing/notes", "/billing/aging", "/billing/tax", "/billing/wht"]) {
        expect(html).toContain(`href="${path}"`);
      }
      const selected = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
      expect(selected).toHaveLength(1);
      expect(selected[0]).toContain(`href="${active}"`);
    },
  );
});
