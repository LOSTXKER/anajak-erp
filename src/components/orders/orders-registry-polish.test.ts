import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./orders-page.tsx", import.meta.url), "utf8");
const statusSource = readFileSync(
  new URL("./order-status-filter.tsx", import.meta.url),
  "utf8",
);
const badgeSource = readFileSync(
  new URL("../order-status-badge.tsx", import.meta.url),
  "utf8",
);

describe("Orders scan-first registry contract", () => {
  it("แสดงชื่องานใน desktop และระบุสถานะภายในเมื่อมีสองสถานะ", () => {
    expect(pageSource).toContain("{order.title}");
    expect(pageSource).toContain("labelInternalStatus");
    expect(badgeSource).toContain("`ภายใน: ${internalLabel}`");
  });

  it("รวมวันส่งกับ countdown ไว้ใต้หัว sortable เดียว", () => {
    expect(pageSource.match(/sortColumn\("deadline"\)/g)).toHaveLength(1);
    expect(pageSource).toContain("<OrderDeadline");
    expect(pageSource).not.toContain("เหลือเวลา");
  });

  it("ใช้ยอดเงินสองตำแหน่งและ label เดียวกันบน mobile", () => {
    expect(pageSource).toContain("{formatBaht(order.totalAmount ?? 0)}");
    expect(pageSource).toContain(">ยอดรวม</p>");
    expect(pageSource).not.toContain("formatCurrency");
  });

  it("คืน status flow เต็มบน desktop และใช้ quick set แบบเดิมบนจอแคบ", () => {
    expect(statusSource).toContain('className="hidden xl:block"');
    expect(statusSource).toContain("<details");
    expect(statusSource).toContain("ACTIVE_UNDERLINE");
    expect(statusSource).not.toContain("<PopoverPrimitive.Content");
  });

  it("บอกขอบเขต CSV ตรงและย้าย action รองเข้าเมนู mobile", () => {
    expect(pageSource.match(/ส่งออกหน้านี้/g)?.length).toBeGreaterThanOrEqual(2);
    expect(pageSource).toContain('aria-label="เพิ่มเติม"');
    expect(pageSource).toContain('className="hidden sm:inline-flex"');
  });
});
