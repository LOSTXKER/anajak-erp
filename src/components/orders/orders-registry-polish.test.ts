import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageSource = read("./orders-page.tsx");
const tableSource = read("./list/orders-table.tsx");
const pipelineSource = read("./list/order-pipeline.tsx");
const peekSource = read("./list/order-peek-panel.tsx");

/* หน้ารายการออเดอร์รื้อตามต้นแบบรอบ 2 ที่เบสเคาะ "โอเคทำจริงเลย" (2026-09-14)
   ต้นแบบ: สมอง records/projects/anajak-erp/mockup-orders-minimal-2026-09-14.html
   ล็อกโครงที่เคาะ + ข้อที่ห้ามหลุด (เงินตามสิทธิ์ · รูปม็อกอัพกลาง · กฎต้องจัดการชุดเดียวกับหน้าแรก) */
describe("หน้ารายการออเดอร์ — ต้นแบบรอบ 2", () => {
  it("หัวหน้า → ราง pipeline → ตารางในการ์ด · ปุ่มหลักตัวเดียวคือสร้างออเดอร์", () => {
    expect(pageSource).toContain('<h1 className="text-2xl font-semibold text-strong">ออเดอร์</h1>');
    expect(pageSource).toContain("ordersHeadline(data?.statusCounts, data?.overdueCounts)");
    expect(pageSource.indexOf("<OrderPipeline")).toBeGreaterThan(-1);
    expect(pageSource.indexOf("<OrderPipeline")).toBeLessThan(pageSource.indexOf("<OrdersTable"));
    expect(pageSource.match(/<Button asChild>/g)).toHaveLength(1);
    expect(pageSource).not.toContain("OrderStatusFilter");
  });

  it("ราง pipeline กรองด้วยสถานะใน URL และบอกงานเลยกำหนดต่อสถานะ", () => {
    expect(pageSource).toContain("updateList({ status: status || null, page: null })");
    expect(pipelineSource).toContain("aria-pressed={selected}");
    expect(pipelineSource).toContain("overdue?.[status]");
    expect(pipelineSource).toContain("prefers-reduced-motion");
    expect(pipelineSource).toContain("PIPELINE_EXCEPTIONS");
  });

  it("ตารางตอบ ใบไหน/ลูกค้า → ขั้นงาน → ต้องจัดการ ด้วยกฎเดียวกับหน้าแรกและรูปม็อกอัพกลาง", () => {
    for (const header of ["เลขออเดอร์", "ลูกค้า", "ขั้นงาน", "ต้องจัดการ", "กำหนดส่ง"]) {
      expect(tableSource).toMatch(new RegExp(`>\\s*${header}\\s*<`));
    }
    expect(tableSource).toContain("describeOrderAttention(order.progress)");
    expect(tableSource).toContain("<MockupThumbnail");
    expect(tableSource).toContain("mockupCoverImage");
    expect(tableSource).not.toContain("EntityMark");
    expect(tableSource).toContain('sortColumn("deadline")');
  });

  it("เงินอยู่หลังสิทธิ์ทั้งตาราง การ์ดมือถือ และแผงดูย่อ", () => {
    expect(pageSource).toContain('permAllows(me?.permissions, "see_order_money")');
    expect(tableSource).toContain("{canSeeMoney ? (");
    expect(peekSource).toContain("{canSeeMoney ? (");
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

  it("ส่งออก CSV บอกขอบเขตหน้านี้ และจอแคบย้าย action รองเข้าเมนู", () => {
    expect(pageSource.match(/ส่งออกหน้านี้/g)?.length).toBeGreaterThanOrEqual(2);
    expect(pageSource).toContain('aria-label="เพิ่มเติม"');
    expect(pageSource).toContain('className="hidden sm:inline-flex"');
  });

  it("ชิ้นที่ออกแบบใหม่ไม่มีเอฟเฟกต์ตอนชี้ (เบสสั่ง 2026-09-14) — ตอบสนองตอนกดแทน", () => {
    for (const source of [tableSource, pipelineSource, peekSource]) {
      expect(source).not.toMatch(/\bhover:/);
    }
  });
});
