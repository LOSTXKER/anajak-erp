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

  /* กลับคำตัดสินใจเดิม (2026-08-26 · UI-2026 เฟส 6) — เบสเห็นของจริงบนจอกว้างแล้วบอกว่า
     "การที่เอาตารางวางบนพื้นเลยดูแปลกๆ และไม่ชอบ" จึงคืนกล่องครอบให้ตาราง
     สาเหตุที่แบบไม่มีกล่องใช้ไม่ได้จริง มีสองชั้นและวัดได้ทั้งคู่:
     1) ธีมสว่างไม่เคยมีชั้นความลึกจริง การ์ดต่างจากผืนหน้าเดิม 1.03 เท่า
        สิ่งที่ตาเห็นว่าเป็นกล่องคือเส้นขอบล้วน ๆ พอถอดกล่อง เส้นหายไปด้วย
     2) prop flush สั่ง pl-0 ที่ <th> แต่ SortableTh วางระยะขอบไว้ที่ <button> ข้างใน
        หัวคอลัมน์แรกจึงเยื้องขวากว่าข้อมูล 20px — ตรงกับสิ่งที่ flush อ้างว่าจะกัน
     ตอนนี้ผืนหน้าเป็นเทาจริง (#f1f2f4) และตารางกลับไปใช้ bordered ปริยาย */
  it("ทะเบียนกลับมามีกล่องครอบ และ prop flush ถูกถอดออกจากระบบแล้ว", () => {
    expect(pageSource).toContain("<DataTable.Root>");
    expect(pageSource).not.toContain("bordered={false}");
    expect(pageSource).not.toContain(" flush");
    // primitive ต้องไม่เหลือทางกลับไปสู่แบบไม่มีกล่อง
    expect(tableSource).not.toContain("flush?: boolean");
    expect(tableSource).not.toContain("[&_th:first-child]:pl-0");
    expect(tableSource).not.toContain("[&_thead]:bg-transparent");
    expect(tableSource).toContain('bordered && "card-surface overflow-hidden rounded-lg"');
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
