import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderOverviewTab, type OrderOverviewVariant } from "./order-overview-tab";
import { OrderArtworkCardView } from "./order-artwork-card";
import { PREVIEW_ARTWORK, PREVIEW_ORDER } from "@/app/proto/ui-reset/_order-data";

const props: ComponentProps<typeof OrderOverviewTab> = {
  order: PREVIEW_ORDER, showMoney: true, totalAmount: 5992, totalQuantity: 30,
  onOpenMoney: () => {}, onOpenDelivery: () => {}, onEditInfo: () => {}, onOpenCustomer: () => {},
  artwork: createElement("p", null, "แบบเสื้อที่ต้องผลิต"),
  channelColor: { bg: "bg-green-50", text: "text-green-700" }, isMarketplace: false,
};
const variants: OrderOverviewVariant[] = ["current", "a", "b"];
const render = (overrides: Partial<typeof props> = {}) => renderToStaticMarkup(createElement(OrderOverviewTab, { ...props, ...overrides }));
const textParts = (html: string) => html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).sort();

describe("ทางเลือกภาพรวมออเดอร์ A16", () => {
  it("ไม่ส่ง variant ยังคงหน้าปัจจุบัน", () => {
    expect(render()).toBe(render({ variant: "current" }));
  });

  it.each(variants)("%s คงข้อเท็จจริงและจำนวนปุ่มเดิมเมื่อย้ายตำแหน่ง", (variant) => {
    const baseline = render();
    const html = render({ variant });
    expect(textParts(html)).toEqual(textParts(baseline));
    expect(html.match(/<button\b/g)?.length).toBe(baseline.match(/<button\b/g)?.length);
    for (const action of ["แก้ไขข้อมูลออเดอร์", "แก้ไขที่อยู่จัดส่ง", "เปิดหน้าลูกค้า"]) {
      expect(html).toContain(action);
    }
    expect(html).toContain("มาตรฐานลูกค้า:");
  });

  it.each(variants)("%s ไม่ render เงินหรือปุ่มแก้เมื่อไม่ได้รับสิทธิ์", (variant) => {
    const html = render({ variant, showMoney: false, onOpenMoney: undefined, onEditInfo: undefined });
    for (const money of ["ยอดรวม", "ชำระสะสม", "วงเงินเครดิต", "87,342.50", "5,992"]) expect(html).not.toContain(money);
    expect(html).not.toContain("แก้ไขข้อมูลออเดอร์");
    expect(html).not.toContain("แก้ไขที่อยู่จัดส่ง");
    expect(html).toContain(PREVIEW_ORDER.customer!.taxId);
  });

  it.each(variants)("%s เก็บที่อยู่/โลโก้/โทรศัพท์และลิงก์ลูกค้าเมื่อไม่ส่ง callback", (variant) => {
    const html = render({ variant, onOpenCustomer: undefined });
    expect(html).toContain(`href="/customers/${PREVIEW_ORDER.customer!.id}"`);
    expect(html).toContain("tel:0800001280");
    expect(html).toContain(PREVIEW_ORDER.brandProfile!.logoUrl);
    expect(html).toContain(PREVIEW_ORDER.shippingAddress);
  });

  it.each(variants)("%s คงข้อมูลแบบและทางไปไฟล์ทั้งมีแบบและยังไม่มี", (variant) => {
    const artworkProps = { variant, latest: PREVIEW_ARTWORK, versionCount: 2, rawCount: 2, printCount: 0, description: PREVIEW_ORDER.description, onOpenFiles: () => {} };
    const ready = renderToStaticMarkup(createElement(OrderArtworkCardView, artworkProps));
    expect(ready).toContain(PREVIEW_ORDER.description);
    expect(ready).toContain(PREVIEW_ARTWORK.fileUrl);
    expect(ready).toContain("ม็อกอัพ v");
    const empty = renderToStaticMarkup(createElement(OrderArtworkCardView, { ...artworkProps, latest: null }));
    expect(empty).toContain("ยังไม่มีม็อกอัพของใบนี้");
    expect(empty).toContain("มีไฟล์จากลูกค้า");
    expect(empty).toContain("ม็อกอัพ &amp; ไฟล์");
  });

  it("โหลดไฟล์ไม่สำเร็จบอกข้อผิดพลาดและทางลองใหม่ โดยไม่อ้างว่าไม่มีไฟล์", () => {
    const artworkProps = {
      latest: null, versionCount: 0, rawCount: 0, printCount: 0, description: null,
      loadError: "โหลดม็อกอัพหรือไฟล์ไม่สำเร็จ", onRetry: () => {},
    };
    const html = renderToStaticMarkup(createElement(OrderArtworkCardView, artworkProps));
    expect(html).toContain(artworkProps.loadError);
    expect(html).toContain("ลองใหม่");
    expect(html).not.toContain("ยังไม่มีม็อกอัพของใบนี้");
    expect(html).not.toContain("ยังไม่มีไฟล์อะไรเลย");

    const cached = renderToStaticMarkup(createElement(OrderArtworkCardView, {
      ...artworkProps, latest: PREVIEW_ARTWORK, versionCount: 2,
    }));
    expect(cached).toContain(artworkProps.loadError);
    expect(cached).toContain(PREVIEW_ARTWORK.fileUrl);
    expect(cached).toContain("ม็อกอัพ v");
  });
});
