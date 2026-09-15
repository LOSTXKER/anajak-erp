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
  onOpenMoney: () => {}, onOpenDelivery: () => {}, onEditInfo: () => {}, onOpenCustomer: () => {},
  artwork: createElement("p", null, "แบบเสื้อที่ต้องผลิต"),
  isMarketplace: false,
};
const render = (overrides: Partial<typeof props> = {}) =>
  renderToStaticMarkup(createElement(OrderOverviewTab, { ...props, ...overrides }));
const text = (html: string) => html.replace(/<[^>]*>/g, "");

/* ภาพรวมรื้อตามต้นแบบรอบ 2 ทีละชิ้น (2026-09-15 เบส "รื้อเขียนใหม่ refactor ไปเลย")
   ล็อกข้อมูล/สิทธิ์/ลำดับ ไม่ล็อกคลาสจัดวาง — หน้าตาอยู่ kit/kit.module.css ที่ยกจากต้นแบบ */
describe("ภาพรวมออเดอร์ — ต้นแบบรอบ 2", () => {
  it("ข้อมูลออเดอร์ซ้าย ม็อกอัพขวา · การ์ดซ้ายเรียงสรุป → ลูกค้า → จัดส่ง", () => {
    const html = render();
    const at = (card: string) => html.indexOf(`data-order-overview-card="${card}"`);
    expect(at("summary")).toBeGreaterThanOrEqual(0);
    expect(at("summary")).toBeLessThan(at("customer"));
    expect(at("customer")).toBeLessThan(at("shipping"));
    expect(html.indexOf("แบบเสื้อที่ต้องผลิต")).toBeGreaterThan(at("shipping"));
    for (const action of ["แก้ไขข้อมูลออเดอร์", "ไปแท็บจัดส่ง", "เปิดหน้าลูกค้า"]) expect(html).toContain(action);
    expect(html).toContain("มาตรฐานลูกค้า:");
  });

  it("กล่องตัวเลขไม่มีบรรทัดเล็กใต้ค่า (เบส 09-15) แต่แถบชำระยังอ่านออกด้วยเครื่องอ่านหน้าจอ", () => {
    const html = render();
    expect(text(html)).not.toContain("เหลือ 3 วัน");
    expect(text(html)).not.toContain("ใช้ไป");
    expect(text(html)).not.toContain("ชำระแล้ว 50%");
    expect(html).toContain('aria-label="ชำระแล้ว 50% · ค้าง ฿2,996.00"');
    expect(render({ totalAmount: 0 })).toContain("ยอดเป็นศูนย์ — ตรวจสอบราคา");
  });

  it("ลูกค้าและการจัดส่งเป็นช่องพรีวิวที่กดไปที่ดูเต็ม ไม่มีปุ่มแก้ที่อยู่ในภาพรวม", () => {
    const html = render();
    expect(text(html)).toContain(PREVIEW_ORDER.customer!.phone!);
    expect(text(html)).toContain("ดูการจัดส่ง");
    expect(html).not.toContain("แก้ไขที่อยู่จัดส่ง");
    expect(html).not.toContain("tel:");
  });

  it("ไม่ render เงินหรือปุ่มแก้เมื่อไม่ได้รับสิทธิ์ แต่ข้อมูลออกบิลยังอยู่", () => {
    const html = render({ showMoney: false, paidAmount: null, onOpenMoney: undefined, onEditInfo: undefined });
    for (const money of ["ยอดรวม", "ซื้อสะสม", "วงเงินเครดิต", "87,342.50", "5,992", "ชำระแล้ว", "ค้าง ฿"]) {
      expect(html).not.toContain(money);
    }
    expect(html).not.toContain("แก้ไขข้อมูลออเดอร์");
    expect(html).not.toContain("แก้ไขที่อยู่จัดส่ง");
    expect(html).toContain(PREVIEW_ORDER.customer!.taxId);
  });

  it("เก็บที่อยู่/โทรศัพท์และลิงก์ลูกค้าเมื่อไม่ส่ง callback", () => {
    const html = render({ onOpenCustomer: undefined });
    expect(html).toContain(`href="/customers/${PREVIEW_ORDER.customer!.id}"`);
    expect(html).toContain(PREVIEW_ORDER.shippingAddress);
  });

  it("การ์ดม็อกอัพเป็นที่ดู: รูปปกจากสูตรกลาง จำนวนไฟล์ รายละเอียดงาน/แบรนด์ ทั้งมีแบบและยังไม่มี", () => {
    const artworkProps = {
      latest: PREVIEW_ARTWORK, versionCount: 2, rawCount: 2, printCount: 0,
      description: PREVIEW_ORDER.description, brand: PREVIEW_ORDER.brandProfile, onOpenFiles: () => {},
    };
    const ready = renderToStaticMarkup(createElement(OrderArtworkCardView, artworkProps));
    expect(ready).toContain(PREVIEW_ORDER.description);
    expect(ready).toContain(PREVIEW_ARTWORK.fileUrl);
    expect(ready).toContain(">v2<");
    expect(ready).toContain("ส่งให้ลูกค้าดู");
    expect(ready).toContain("รอลูกค้าตรวจ");
    // แบรนด์ลูกค้าย้ายมาอยู่ใต้รายละเอียดงานตามต้นแบบ — โลโก้ยังเปิดได้
    expect(ready).toContain(PREVIEW_ORDER.brandProfile!.logoUrl);
    const empty = renderToStaticMarkup(createElement(OrderArtworkCardView, { ...artworkProps, latest: null }));
    expect(empty).toContain("ยังไม่มีม็อกอัพ");
    expect(empty).toContain("มีไฟล์จากลูกค้า");
    expect(empty).toContain("ม็อกอัพ &amp; ไฟล์");
  });

  it("เส้นเวลาใช้ชื่อสถานะใหม่ภาษาไทยเป็นหัวเรื่อง เรียงเก่าไปใหม่ และไม่วาดเมื่อไม่มีประวัติ", () => {
    const revisions: TimelineRevision[] = [
      { id: "r2", description: "", changedBy: "u1", changedByName: "ศรุจ", changeType: "STATUS", oldValue: "INQUIRY", newValue: "CONFIRMED", createdAt: "2026-09-11T10:00:00+07:00" },
      { id: "r1", description: "เปิดออเดอร์", changedBy: "u1", changeType: "INFO", createdAt: "2026-09-10T10:00:00+07:00" },
    ];
    expect(revisionTitle(revisions[0]!)).toBe("ยืนยันออเดอร์");
    const html = renderToStaticMarkup(createElement(OrderTimelineCard, { revisions }));
    expect(html.indexOf("เปิดออเดอร์")).toBeLessThan(html.indexOf("ยืนยันออเดอร์"));
    expect(html).toContain("ศรุจ");
    expect(renderToStaticMarkup(createElement(OrderTimelineCard, { revisions: [] }))).toBe("");
  });
});
