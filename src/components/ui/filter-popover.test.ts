import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const popoverSource = read("./filter-popover.tsx");
const ordersSource = read("../orders/orders-page.tsx");

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
    // หน้าออเดอร์ยกแถบเครื่องมือ .tools จากต้นแบบรอบ 2 (2026-09-15): select ตรงหน้า ช่วงวันที่ ช่องทาง ประเภท
    expect(ordersSource).toContain('aria-label="กรองช่องทาง"');
    expect(ordersSource).toContain('aria-label="กรองประเภทงาน"');
    expect(ordersSource).toContain('aria-label="ช่วงวันที่เปิดออเดอร์"');
    expect(ordersSource.match(/className=\{c\("sel/g)?.length).toBeGreaterThanOrEqual(3);
    expect(ordersSource).toContain("const clearFiltersAndSearch = () =>");
    expect(ordersSource).toContain("ล้างตัวกรอง");
  });
});
