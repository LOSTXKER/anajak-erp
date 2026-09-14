import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderOverviewTab } from "./order-overview-tab";
import { OrderArtworkCardView } from "./order-artwork-card";
import { OrderTimelineCard, revisionTitle, type TimelineRevision } from "./order-timeline-card";
import { PREVIEW_ARTWORK, PREVIEW_ORDER } from "@/app/proto/ui-reset/_order-data";

const props: ComponentProps<typeof OrderOverviewTab> = {
  order: PREVIEW_ORDER, showMoney: true, totalAmount: 5992, totalQuantity: 30,
  dueInDays: 3, paidAmount: 2996, printLabel: "DTF",
  sizeBreakdown: [{ size: "S", quantity: 7 }, { size: "M", quantity: 12 }, { size: "L", quantity: 11 }],
  onOpenMoney: () => {}, onOpenDelivery: () => {}, onEditInfo: () => {}, onOpenCustomer: () => {},
  artwork: createElement("p", null, "แบบเสื้อที่ต้องผลิต"),
  channelColor: { bg: "bg-green-50", text: "text-green-700" }, isMarketplace: false,
};
const render = (overrides: Partial<typeof props> = {}) =>
  renderToStaticMarkup(createElement(OrderOverviewTab, { ...props, ...overrides }));
const text = (html: string) => html.replace(/<[^>]*>/g, "");

describe("ภาพรวมออเดอร์ — ต้นแบบรอบ 2 (2026-09-14)", () => {
  it("ข้อมูลออเดอร์ซ้าย ม็อกอัพขวา · การ์ดซ้ายเรียงสรุป → ลูกค้า → จัดส่ง", () => {
    const html = render();
    const at = (card: string) => html.indexOf(`data-order-overview-card="${card}"`);
    expect(at("summary")).toBeGreaterThanOrEqual(0);
    expect(at("summary")).toBeLessThan(at("customer"));
    expect(at("customer")).toBeLessThan(at("shipping"));
    expect(html.indexOf("แบบเสื้อที่ต้องผลิต")).toBeGreaterThan(at("shipping"));
    for (const action of ["แก้ไขข้อมูลออเดอร์", "แก้ไขที่อยู่จัดส่ง", "เปิดหน้าลูกค้า"]) expect(html).toContain(action);
    expect(html).toContain("มาตรฐานลูกค้า:");
  });

  it("ช่องข้อมูลหลักมีภาพช่วยอ่าน: วันที่เหลือ · ไซซ์แยก · รับเงินแล้ว", () => {
    const html = render();
    expect(html).toContain("อีก 3 วัน");
    expect(text(html)).toContain("S 7");
    expect(text(html)).toContain("M 12");
    expect(html).toContain("รับแล้ว");
    expect(html).toContain("(50%)");
  });

  it("ไม่ render เงินหรือปุ่มแก้เมื่อไม่ได้รับสิทธิ์ แต่ข้อมูลออกบิลยังอยู่", () => {
    const html = render({ showMoney: false, paidAmount: null, onOpenMoney: undefined, onEditInfo: undefined });
    for (const money of ["ยอดรวม", "ซื้อสะสม", "วงเงินเครดิต", "87,342.50", "5,992", "รับแล้ว"]) {
      expect(html).not.toContain(money);
    }
    expect(html).not.toContain("แก้ไขข้อมูลออเดอร์");
    expect(html).not.toContain("แก้ไขที่อยู่จัดส่ง");
    expect(html).toContain(PREVIEW_ORDER.customer!.taxId);
  });

  it("เก็บที่อยู่/โลโก้/โทรศัพท์และลิงก์ลูกค้าเมื่อไม่ส่ง callback", () => {
    const html = render({ onOpenCustomer: undefined });
    expect(html).toContain(`href="/customers/${PREVIEW_ORDER.customer!.id}"`);
    expect(html).toContain("tel:0800001280");
    expect(html).toContain(PREVIEW_ORDER.brandProfile!.logoUrl);
    expect(html).toContain(PREVIEW_ORDER.shippingAddress);
  });

  it("การ์ดม็อกอัพเป็นที่ดู: รูปปกจากสูตรกลาง จำนวนไฟล์ รายละเอียดงาน ทั้งมีแบบและยังไม่มี", () => {
    const artworkProps = {
      latest: PREVIEW_ARTWORK, versionCount: 2, rawCount: 2, printCount: 0,
      description: PREVIEW_ORDER.description, onOpenFiles: () => {},
    };
    const ready = renderToStaticMarkup(createElement(OrderArtworkCardView, artworkProps));
    expect(ready).toContain(PREVIEW_ORDER.description);
    expect(ready).toContain(PREVIEW_ARTWORK.fileUrl);
    expect(ready).toContain("ม็อกอัพ v2");
    expect(ready).toContain("แก้มาแล้ว 1 รอบ");
    const empty = renderToStaticMarkup(createElement(OrderArtworkCardView, { ...artworkProps, latest: null }));
    expect(empty).toContain("ยังไม่มีม็อกอัพของใบนี้");
    expect(empty).toContain("มีไฟล์จากลูกค้า");
    expect(empty).toContain("ม็อกอัพ &amp; ไฟล์");
  });

  it("เส้นเวลาแปลงแถวสถานะเป็นชื่อไทย เรียงเก่าไปใหม่ และไม่วาดเมื่อไม่มีประวัติ", () => {
    const revisions: TimelineRevision[] = [
      { id: "r2", description: "", changedBy: "u1", changedByName: "ศรุจ", changeType: "STATUS", oldValue: "INQUIRY", newValue: "CONFIRMED", createdAt: "2026-09-11T10:00:00+07:00" },
      { id: "r1", description: "เปิดออเดอร์", changedBy: "u1", changeType: "INFO", createdAt: "2026-09-10T10:00:00+07:00" },
    ];
    expect(revisionTitle(revisions[0]!)).toBe("สอบถาม → ยืนยันออเดอร์");
    const html = renderToStaticMarkup(createElement(OrderTimelineCard, { revisions }));
    expect(html.indexOf("เปิดออเดอร์")).toBeLessThan(html.indexOf("สอบถาม → ยืนยันออเดอร์"));
    expect(renderToStaticMarkup(createElement(OrderTimelineCard, { revisions: [] }))).toBe("");
  });
});
