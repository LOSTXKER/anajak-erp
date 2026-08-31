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
  // เบสกลับ hierarchy หลังดูหน้าจริง 2026-08-27: คนใช้ต้องหา "ลูกค้าคนไหน" ก่อน
  // 2026-08-30 เบสสั่งเอาระบบชื่องานออกทั้งหมด → บรรทัดรองที่เคยเป็นชื่องานหายไปเลย
  // เหลือ "เลขที่ออเดอร์ + ลูกค้า" · ห้ามมีชื่องาน/บรรทัดสถานะภายในกลับมา
  it("ลูกค้าเป็นบรรทัดเดียวของช่องระบุตัว ไม่มีชื่องานและไม่มีบรรทัดสถานะภายใน", () => {
    expect(pageSource.match(/const primaryIdentity = order\.customer\?\.name\?\.trim\(\) \|\| "—"/g)).toHaveLength(2);
    expect(pageSource).not.toContain("orderTitle");
    expect(pageSource).not.toContain("secondaryTitle");
    expect(pageSource).not.toContain("order.title");
    expect(pageSource.match(/text-base font-semibold text-strong/g)).toHaveLength(1);
    expect(pageSource).toContain("max-w-80 truncate text-sm font-semibold text-strong");
    expect(pageSource).toContain("<DataTable.Th>ลูกค้า</DataTable.Th>");
    expect(pageSource).toContain("showInternalStatus={false}");
    expect(pageSource).not.toContain("labelInternalStatus");
  });

  it("ใช้ contract หัวตารางและขนาดข้อมูลกลางโดยไม่มี one-off พร้อมคอลัมน์ประเภทงาน", () => {
    expect(pageSource).toContain("max-xl:[&_td]:px-4");
    expect(pageSource).toContain("<DataTable.Head>");
    expect(pageSource).toContain("<DataTable.Body>");
    expect(pageSource).not.toContain("<DataTable.Head className=");
    expect(pageSource).not.toContain("<DataTable.Body className=");
    expect(tableSource).toContain("[&_td]:text-sm");
    expect(tableSource).toContain(":not(:is(button");
    expect(pageSource).toContain("<DataTable.Th>ประเภทงาน</DataTable.Th>");
    /* ประเภทงานเป็นชิปพื้นสีอ่อนตามหมวดตั้งแต่ 2026-08-31 (แบบ B "สีบอกหมวด")
       ใจความเดิมที่ยังต้องจริง: คอลัมน์นี้ยังอยู่ และสั่งทำกับสำเร็จรูปต้องแยกออกจากกันด้วยสี
       — โดยไม่ไปแย่งกับจุดสีสถานะ ซึ่งยังเป็นจุด+ข้อความไม่มีพื้นสี */
    expect(pageSource).toContain("<OrderTypeChip orderType={order.orderType} />");
    expect(pageSource).toContain('orderType === "CUSTOM" ? "brand" : "product"');
    expect(badgeSource).not.toContain("bg-module");
    expect(pageSource).not.toContain('secondaryTitle || order.orderType === "CUSTOM"');
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
     ตั้งแต่เฟส 11 ผืนหน้าเป็น near-white แต่ตารางยังใช้ bordered ปริยายและแยกด้วย edge+shadow */
  it("ทะเบียนกลับมามีกล่องครอบ และ prop flush ถูกถอดออกจากระบบแล้ว", () => {
    expect(pageSource).toContain("<DataTable.Root");
    expect(pageSource).not.toContain("bordered={false}");
    expect(pageSource).not.toContain(" flush");
    // primitive ต้องไม่เหลือทางกลับไปสู่แบบไม่มีกล่อง
    expect(tableSource).not.toContain("flush?: boolean");
    expect(tableSource).not.toContain("[&_th:first-child]:pl-0");
    expect(tableSource).not.toContain("[&_thead]:bg-transparent");
    expect(tableSource).toContain('bordered && "card-surface overflow-hidden rounded-2xl"');
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
