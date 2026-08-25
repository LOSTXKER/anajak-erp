import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./orders-page.tsx", import.meta.url), "utf8");
const statusSource = readFileSync(
  new URL("./order-status-filter.tsx", import.meta.url),
  "utf8",
);
const tableSource = readFileSync(
  new URL("../ui/data-table.tsx", import.meta.url),
  "utf8",
);
const badgeSource = readFileSync(
  new URL("../order-status-badge.tsx", import.meta.url),
  "utf8",
);

describe("Orders scan-first registry contract", () => {
  // สัญญาเดิม (2026-08-23) คือ "ชื่องานเป็นบรรทัดรอง + มีบรรทัดสถานะภายในใต้สถานะหลัก"
  // เบสกลับคำ 2026-08-25 จาก mockup UI-2026: ให้ตัวงานเด่นกว่าลูกค้า และไม่เอาคำอธิบายใต้สถานะ
  it("ชื่องานเป็นบรรทัดหลักของแถว และทะเบียนไม่มีบรรทัดสถานะภายใน", () => {
    expect(pageSource).toContain("{order.title?.trim() || order.customer?.name || \"—\"}");
    expect(pageSource).toContain("text-base font-medium text-strong");
    expect(pageSource).toContain("showInternalStatus={false}");
    expect(pageSource).not.toContain("labelInternalStatus");
  });

  it("ยังเปิดบรรทัดสถานะภายในให้หน้าที่ต้องรู้ขั้นจริงได้", () => {
    expect(badgeSource).toContain("showInternalStatus = true");
    expect(badgeSource).toContain("sub={showInternalStatus ? internalSubLabel : undefined}");
    expect(badgeSource).toContain("`ภายใน: ${internalLabel}`");
  });

  it("เลขออเดอร์ไม่ใช่ลิงก์สีแบรนด์แล้ว — สงวนน้ำเงินให้ปุ่มหลัก/สิ่งที่เลือก/โฟกัส", () => {
    expect(pageSource).toContain("font-medium tabular-nums text-strong hover:underline");
    expect(pageSource).not.toContain("text-blue-600 hover:underline");
  });

  it("ทะเบียนวางบนผืนหน้าโดยไม่มีกล่องครอบ", () => {
    expect(pageSource).not.toContain("lg:rounded-lg lg:border lg:border-border lg:bg-surface");
    expect(pageSource).toContain("<DataTable.Root bordered={false} flush>");
    // flush = เซลล์แรก/สุดท้ายเสมอขอบเนื้อหา และหัวตารางเลิกใช้แถบพื้น
    // (บนผืนหน้าธีมมืด แถบพื้นต่างจาก bg ไม่ถึง 1% = กลืนหาย)
    expect(tableSource).toContain("[&_th:first-child]:pl-0");
    expect(tableSource).toContain("[&_thead]:bg-transparent");
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
