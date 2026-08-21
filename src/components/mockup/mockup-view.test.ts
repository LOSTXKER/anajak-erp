import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MockupGallery } from "./mockup-gallery";
import { MockupThumbnail } from "./mockup-thumbnail";

// ตรวจ markup จริงของตัวดูม็อกอัพที่ทุกจอใช้ร่วมกัน — ถ้าตัวนี้เพี้ยน หน้าออเดอร์
// หน้าผลิต และจอสถานีเพี้ยนพร้อมกันหมด

const panelSource = readFileSync(new URL("./mockup-panel.tsx", import.meta.url), "utf8");

function renderGallery(
  version: Parameters<typeof MockupGallery>[0]["version"],
  versionNumber = 2,
) {
  return renderToStaticMarkup(
    createElement(MockupGallery, { version, versionNumber }),
  );
}

describe("MockupGallery", () => {
  it("กางรูปครบทั้งชุดพร้อมป้ายบอกด้าน", () => {
    const html = renderGallery({
      fileUrl: "/api/files/designs/front.png",
      files: [
        { fileUrl: "/api/files/designs/front.png", position: "FRONT" },
        { fileUrl: "/api/files/designs/back.png", position: "BACK" },
      ],
    });

    expect(html).toContain("front.png");
    expect(html).toContain("back.png");
    expect(html).toContain("หน้า");
    expect(html).toContain("หลัง");
  });

  it("เวอร์ชันเก่าที่ยังไม่มี files แสดงรูปปกได้ตามเดิม (ไม่ต้อง backfill)", () => {
    const html = renderGallery({ fileUrl: "/api/files/designs/cover.png", files: [] });
    expect(html).toContain("cover.png");
  });

  it("ไฟล์ที่พรีวิวไม่ได้ต้องบอกตรงๆ ไม่ปล่อย img ชี้ไฟล์ .ai จนรูปแตก", () => {
    const html = renderGallery({
      fileUrl: "/api/files/designs/master.ai",
      files: [{ fileUrl: "/api/files/designs/master.ai" }],
    });

    expect(html).toContain("ไฟล์นี้ดูตัวอย่างไม่ได้");
    expect(html).not.toContain("master.ai\"");
  });

  it("ปุ่มขยายมีชื่อให้เครื่องอ่านหน้าจอ ไม่ใช่ปุ่มเปล่า", () => {
    const html = renderGallery({
      fileUrl: "/api/files/designs/front.png",
      files: [{ fileUrl: "/api/files/designs/front.png", position: "FRONT" }],
    });
    expect(html).toContain("aria-label=\"ขยายม็อกอัพ v2 ด้านหน้า\"");
  });
});

describe("MockupThumbnail", () => {
  it("ไม่มีรูปให้แสดงกรอบว่าง ไม่ใช่ img ที่ src ว่าง", () => {
    const html = renderToStaticMarkup(
      createElement(MockupThumbnail, { cover: null }),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("aria-hidden");
  });

  it("มีหลายรูปให้ติดตัวเลขบอกว่ายังมีด้านอื่น", () => {
    const html = renderToStaticMarkup(
      createElement(MockupThumbnail, { cover: "/a.png", count: 3, alt: "ม็อกอัพ v1" }),
    );
    expect(html).toContain("/a.png");
    expect(html).toContain(">3<");
  });

  it("รูปเดียวไม่ต้องมีตัวเลขกำกับ", () => {
    const html = renderToStaticMarkup(
      createElement(MockupThumbnail, { cover: "/a.png", count: 1 }),
    );
    expect(html).not.toContain(">1<");
  });
});

describe("MockupPanel — สัญญาที่ห้ามหลุด", () => {
  it("fail closed: ปุ่มอัป/อนุมัติผูกกับสิทธิ์ที่โหลดมาแล้วเท่านั้น", () => {
    expect(panelSource).toContain('permAllows(me.permissions, "manage_design_files")');
    expect(panelSource).toContain('permAllows(me.permissions, "create_sales_docs")');
    expect(panelSource).toContain("const roleCanUpload = !!me &&");
  });

  it("readOnly (หน้าผลิต) ต้องไม่มีทางโผล่ก้อนเงินหรือปุ่มอัป", () => {
    expect(panelSource).toContain("const canUpload = !readOnly &&");
    expect(panelSource).toContain("const canApprove = !readOnly &&");
    expect(panelSource).toContain("{!readOnly && hasVersions && overage.revisionRounds > 0 &&");
  });

  it("แยก loading/error/empty ออกจากกัน — จอห้ามบอกว่าไม่มีม็อกอัพตอนที่โหลดพัง", () => {
    expect(panelSource).toContain("designs.isLoading ?");
    expect(panelSource).toContain("designs.isError ?");
    expect(panelSource).toContain("โหลดม็อกอัพไม่สำเร็จ");
    expect(panelSource).toContain("ยังไม่มีม็อกอัพ");
  });
});
