import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageSource = read("./orders-page.tsx");
const tableSource = read("./list/orders-table.tsx");
const pipelineSource = read("./list/order-pipeline.tsx");
const peekSource = read("./list/order-peek-panel.tsx");
const cssSource = read("../kit/kit.module.css");

/* หน้ารายการออเดอร์ — ต้นแบบรอบ 2 (เบสเคาะ 2026-09-14 · รื้อเขียนใหม่ทีละชิ้น 2026-09-15)
   ต้นแบบ: สมอง records/projects/anajak-erp/mockup-orders-minimal-2026-09-14.html
   ล็อกโครงที่เคาะ + ข้อที่ห้ามหลุด (เงินตามสิทธิ์ · รูปม็อกอัพกลาง · กฎต้องจัดการชุดเดียวกับหน้าแรก) */
describe("หน้ารายการออเดอร์ — ต้นแบบรอบ 2", () => {
  it("หัวหน้า → เส้นสถานะ → ตารางในการ์ด · ปุ่มหลักตัวเดียวคือสร้างออเดอร์ · ไม่มีบรรทัดสรุปและหัวการ์ด (รอบโล่งขึ้น 09-16)", () => {
    expect(pageSource).toContain("<h1>ออเดอร์</h1>");
    expect(pageSource).not.toContain("ordersHeadline");
    expect(pageSource).not.toContain("CardHead");
    expect(pageSource.indexOf("<OrderPipeline")).toBeGreaterThan(-1);
    expect(pageSource.indexOf("<OrderPipeline")).toBeLessThan(pageSource.indexOf("<OrdersTable"));
    expect(pageSource.match(/className=\{c\("btn primary"\)\}/g)).toHaveLength(1);
    expect(pageSource).not.toContain("OrderStatusFilter");
  });

  it("ราง pipeline กรองด้วยสถานะใน URL และบอกงานเลยกำหนดต่อสถานะ", () => {
    expect(pageSource).toContain("updateList({ status: status || null, page: null })");
    expect(pipelineSource).toContain("aria-pressed={selected}");
    expect(pipelineSource).toContain("overdue?.[status]");
    expect(pipelineSource).not.toContain("useLayoutEffect");
    expect(pipelineSource).toContain("PIPELINE_EXCEPTIONS");
  });

  it("ตารางตอบ ใบไหน/ลูกค้า → ขั้นงาน → ต้องจัดการ ด้วยกฎเดียวกับหน้าแรกและรูปม็อกอัพกลาง", () => {
    for (const header of ["ลูกค้า", "จำนวน", "ขั้นงาน", "คนทำ", "ต้องจัดการ", "การชำระ"]) {
      expect(tableSource).toMatch(new RegExp(`>\\s*${header}\\s*<`));
    }
    for (const sortable of ["เลขออเดอร์", "ยอดรวม", "กำหนดส่ง"]) expect(tableSource).toContain(`label="${sortable}"`);
    expect(tableSource).toContain("describeOrderAttention(order.progress)");
    expect(tableSource).toContain("<Thumb cover={orderListCover(order)}");
    expect(tableSource).toContain("mockupCoverImage");
    expect(tableSource).not.toContain("EntityMark");
    expect(tableSource).toContain('sortColumn("deadline")');
  });

  it("เงินอยู่หลังสิทธิ์ทั้งตาราง การ์ดมือถือ และแผงดูย่อ", () => {
    expect(pageSource).toContain('permAllows(me?.permissions, "see_order_money")');
    expect(tableSource.match(/\{canSeeMoney \?/g)?.length).toBeGreaterThanOrEqual(4);
    expect(peekSource).toContain("{canSeeMoney ? (");
    expect(pageSource).toContain("exportOrdersCsv(rows, canSeeMoney)");
  });

  it("กดแถว = ดูย่อ · ลูกศร = เปิดใบเต็ม · ↑↓/Esc ใช้ได้และคืนโฟกัส · ดูย่อไม่เดินสถานะเอง", () => {
    expect(tableSource).toContain("onPeek(order.id)");
    expect(tableSource).toContain("aria-label={`เปิดออเดอร์ ${order.orderNumber}`}");
    expect(pageSource).toContain('event.key === "ArrowDown"');
    expect(pageSource).toContain('event.key === "Escape"');
    expect(pageSource).toContain("focusPeekTrigger");
    expect(peekSource).not.toContain("useMutation");
    expect(peekSource).not.toContain("updateStatus");
  });

  it("ส่งออก CSV บอกขอบเขตหน้านี้ · ตัวกรองความเร่งด่วนจากหน้าแรกเห็นและล้างได้", () => {
    expect(pageSource).toContain("ส่งออกหน้านี้");
    expect(pageSource).toContain('aria-label="ล้างตัวกรองความเร่งด่วน"');
    expect(pageSource).toContain('aria-label="ล้างคำค้น"');
    expect(pageSource).toContain('aria-label="ล้างตัวกรองสถานะ"');
    expect(pageSource).toContain("<KitDateRange");
  });

  it("ชิ้นที่ออกแบบใหม่ไม่มีเอฟเฟกต์ตอนชี้ (เบสสั่ง 2026-09-14) — ตอบสนองตอนกดแทน", () => {
    for (const source of [tableSource, pipelineSource, peekSource, pageSource]) {
      expect(source).not.toMatch(/\bhover:/);
    }
    expect(cssSource).not.toContain(":hover");
    expect(cssSource).toContain(":active");
  });
});
