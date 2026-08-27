import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const popoverSource = read("./filter-popover.tsx");
const ordersSource = read("../orders/orders-page.tsx");
const productionSource = read("../production-v2/production-v2-workspace.tsx");

describe("FilterPopover visual contract", () => {
  it("ใช้ hierarchy กลางและไม่ autofocus ปุ่มปิดตอนเปิด", () => {
    expect(popoverSource).toContain("FilterPopoverField");
    expect(popoverSource).toContain("border-b border-divider px-4 py-2");
    expect(popoverSource).toContain("border-t border-divider px-4 py-2");
    expect(popoverSource).toContain("event.preventDefault()");
    expect(popoverSource).toContain("contentRef.current?.focus");
    expect(popoverSource).not.toContain('className="flex-1"');
  });

  it("ใช้ Anajak Blue เฉพาะสถานะกรองค้าง", () => {
    expect(popoverSource).toContain("bg-blue-600");
    expect(popoverSource).toContain("ACTIVE_FILTER");
  });

  it("orders เปิดตัวกรองที่ใช้ประจำไว้ตรงหน้า ส่วน production ยังใช้ popover กับเงื่อนไขรอง", () => {
    expect(ordersSource).not.toContain("<FilterPopover");
    expect(ordersSource).not.toContain("<FilterChip");
    expect(ordersSource).toContain('aria-label="กรองช่องทางออเดอร์"');
    expect(ordersSource).toContain('aria-label="กรองประเภทออเดอร์"');
    expect(ordersSource.match(/surface="raised"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(ordersSource).toContain("const clearToolbarFilters = () =>");
    expect(ordersSource).toContain("ล้างตัวกรอง");
    expect(productionSource.match(/<FilterPopoverField/g)).toHaveLength(3);
  });
});
