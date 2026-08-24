import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const tokensSource = read("./tokens.ts");
const tabsSource = read("./tabs.tsx");
const filterChipSource = read("./filter-chip.tsx");
const flowFilterSource = read("./flow-filter-bar.tsx");
const shellSource = read("../layout/app-shell.tsx");
const productionNavSource = read("../production/production-module-nav.tsx");
const productionWorklistSource = read("../production/production-control-worklist.tsx");
const ordersSource = read("../orders/orders-page.tsx");

describe("Anajak selected-state contract", () => {
  it("ล็อก active underline และ toolbar filter เป็น Anajak Blue ทั้ง Light/Dark", () => {
    expect(tokensSource).toContain("export const ACTIVE_UNDERLINE");
    expect(tokensSource).toContain("border-blue-600 font-semibold text-blue-700");
    expect(tokensSource).toContain("dark:border-blue-400 dark:text-blue-400");
    expect(tokensSource).toContain('ACTIVE_FILTER =\n  "border-blue-600');
  });

  it("primitive แบบเส้นใต้ไม่ย้อนกลับไปใช้เส้นดำหรือขาว", () => {
    for (const source of [tabsSource, filterChipSource, flowFilterSource]) {
      expect(source).not.toContain("border-slate-900");
      expect(source).not.toContain("dark:border-white");
    }
    expect(tabsSource).toContain("data-[state=active]:border-blue-600");
    expect(filterChipSource).toContain("ACTIVE_UNDERLINE");
    expect(flowFilterSource).toContain("ACTIVE_UNDERLINE");
  });

  it("status flow ใช้ hairline จัดกลุ่มและบอก affordance โดยไม่คืน progress track", () => {
    expect(flowFilterSource).not.toContain("border-y border-divider");
    expect(flowFilterSource).not.toContain("border-l border-slate");
    expect(flowFilterSource).not.toContain("border-b-2 border-slate-100 pb-1");
    expect(flowFilterSource).not.toContain("ratioMax");
    expect(flowFilterSource).not.toContain("style={{ width:");
    expect(flowFilterSource).toContain("border-b border-divider pb-1");
    expect(flowFilterSource).toContain("INTERACTIVE_HOVER");
    expect(flowFilterSource).not.toContain("กดสถานะเพื่อกรอง · กดซ้ำเพื่อล้างตัวกรอง");
    expect(flowFilterSource).toContain('"กดเพื่อกรอง"');
    expect(flowFilterSource).toContain("เลือกอยู่ · กดซ้ำเพื่อล้างตัวกรอง");
    expect(flowFilterSource).toContain("item.dotClass");
    expect(flowFilterSource).toContain("ACTIVE_UNDERLINE");
  });

  it("navigation และ active filter เฉพาะหน้าใช้ selected role สีน้ำเงิน", () => {
    expect(shellSource).toContain(
      "bg-interactive-selected font-medium text-interactive-selected-text",
    );
    expect(shellSource).toContain('? "text-interactive-selected-text"');
    expect(productionNavSource).toContain(
      'active && "bg-interactive-selected font-medium text-interactive-selected-text"',
    );
    expect(productionNavSource).not.toContain("data-production-module-nav");
    expect(ordersSource).toContain(
      "border-b-2 border-blue-600",
    );
  });

  it("Production ใช้การ์ดตัวกรองเรียบและ selected คงสีประจำสถานะ", () => {
    expect(productionWorklistSource).toContain("card-surface card-surface-hover");
    expect(productionWorklistSource).not.toContain("INTERACTIVE_SELECTED");
    expect(productionWorklistSource).toContain("WORKLIST_LENS_PRESENTATION");
    expect(productionWorklistSource).toContain("text-module-production-text");
    expect(productionWorklistSource).toContain("PackageCheck");
    expect(productionWorklistSource).not.toContain("bg-module-production-surface");
    expect(productionWorklistSource).not.toContain("bg-module-brand-surface");
    expect(productionWorklistSource).toContain("selectedBorder");
    expect(productionWorklistSource).toContain("border-red-600 dark:border-red-400");
    expect(productionWorklistSource).toContain("border-module-production-solid");
    expect(productionWorklistSource).toContain("border-amber-600 dark:border-amber-400");
    expect(productionWorklistSource).toContain("border-green-600 dark:border-green-400");
    expect(productionWorklistSource).toContain('isOn ? presentation.iconColor : "text-muted"');
    expect(productionWorklistSource).not.toContain("bg-blue-600 text-white");
    expect(productionWorklistSource).toContain("aria-pressed={isOn}");
    expect(productionWorklistSource).not.toContain("<FlowFilterBar");
  });
});
