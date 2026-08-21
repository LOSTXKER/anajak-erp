import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  isStationPreviewImageUrl,
  stationSideForPosition,
  StationGarmentPreview,
  type StationGarmentLine,
  type StationPreviewDesign,
  type StationPreviewPrint,
  type StationPreviewWorkGroup,
} from "./station-garment-preview";

const source = readFileSync(
  new URL("./station-garment-preview.tsx", import.meta.url),
  "utf8",
);

const dataImage =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";

const approvedDesign: StationPreviewDesign = {
  versionNumber: 3,
  fileUrl: "https://example.com/approved-v3.pdf",
  thumbnailUrl: dataImage,
  approvedAt: new Date("2026-08-21T03:00:00.000Z"),
};

const frontPrint: StationPreviewPrint = {
  id: "print-front",
  position: "FRONT",
  printType: "DTF",
  printSize: "A4",
  width: 21,
  height: 29.7,
  colorCount: 2,
  note: "กึ่งกลางอกตามแบบ",
  imageUrl: "https://example.com/front-art.png",
};

const garmentLines: StationGarmentLine[] = [
  {
    id: "line-l",
    product: "Anajak Oversize CVC",
    size: "L",
    color: "ดำ",
    quantity: 12,
  },
];

function renderPreview({
  design = approvedDesign,
  groups = [
    {
      id: "item-black",
      garmentLines,
      prints: [frontPrint],
      showShirtDiagram: true,
    },
  ],
}: {
  design?: StationPreviewDesign | null;
  groups?: StationPreviewWorkGroup[];
} = {}) {
  return renderToStaticMarkup(
    createElement(StationGarmentPreview, {
      approvedDesign: design,
      workGroups: groups,
      embedded: true,
    }),
  );
}

describe("station preview image boundary", () => {
  it("รับเฉพาะ URL รูปปกติและ data:image ชนิดที่กำหนด", () => {
    expect(isStationPreviewImageUrl("https://example.com/work.png")).toBe(true);
    expect(isStationPreviewImageUrl(dataImage)).toBe(true);
    expect(isStationPreviewImageUrl("data:text/html,<script />")).toBe(false);
    expect(isStationPreviewImageUrl("data:image/bmp;base64,AA==")).toBe(false);
    expect(isStationPreviewImageUrl("https://example.com/work.pdf")).toBe(false);
  });

  it("บอกเพียงด้านที่ระบบรู้จัก โดยไม่เดาตำแหน่งย่อยหรือด้านของ OTHER", () => {
    expect(stationSideForPosition("FRONT")?.sideLabel).toBe("ด้านหน้า");
    expect(stationSideForPosition("SLEEVE_L")?.sideLabel).toBe(
      "แขนซ้ายของผู้สวม",
    );
    expect(stationSideForPosition("OTHER")).toBeNull();
    expect(stationSideForPosition("CUSTOM_UNKNOWN")).toBeNull();
  });
});

describe("StationGarmentPreview", () => {
  it("ให้จุดทำงานนำ และเก็บไฟล์อนุมัติชนิดไม่ชัดเป็นข้อมูลอ้างอิงรอง", () => {
    const html = renderPreview();

    expect(html).toContain("data-station-approved-reference");
    expect(html).toContain("data-station-approved-reference-image");
    expect(html.indexOf("data-station-work-group")).toBeLessThan(
      html.indexOf("data-station-approved-reference"),
    );
    expect(html).toContain("ไฟล์แบบที่ลูกค้าอนุมัติ");
    expect(html).toContain("ใช้เป็นไฟล์อ้างอิงเท่านั้น ห้ามวางตำแหน่งจากภาพนี้");
    expect(html).toContain("v3");
    expect(html).toContain("data-station-standalone-art");
    expect(html).toContain("รูปลายแยกในใบงาน · ไม่ใช่ภาพวางบนเสื้อ");
    expect(html).toContain("data-station-side-diagram=\"FRONT\"");
    expect(html).not.toContain("data-station-position-marker");
    expect(html).toContain("แผนภาพบอกด้านเท่านั้น · ไม่ระบุตำแหน่งย่อย");
    expect(html).toContain("21 × 29.7 ซม. · 2 สี");
    expect(html).toContain("กึ่งกลางอกตามแบบ");
    expect(html).toContain("Anajak Oversize CVC");
    expect(html).toContain("L · ดำ");
    expect(html).toContain("×12");
  });

  it("ไฟล์อนุมัติที่ไม่ใช่รูปยังบอกให้เปิดไฟล์เต็ม และแสดงลายแยกโดยไม่ปลอม mockup", () => {
    const html = renderPreview({
      design: { ...approvedDesign, thumbnailUrl: null },
    });

    expect(html).not.toContain("data-station-approved-reference-image");
    expect(html).toContain("แบบอนุมัติเป็นไฟล์ที่จอนี้แสดงภาพไม่ได้");
    expect(html).toContain("เปิดไฟล์เต็ม");
    expect(html).toContain("data-station-standalone-art");
  });

  it("OTHER แสดงคำเตือนและไม่วาง marker เดาตำแหน่ง", () => {
    const html = renderPreview({
      design: null,
      groups: [
        {
          id: "item-other",
          garmentLines,
          prints: [{ ...frontPrint, id: "print-other", position: "OTHER" }],
          showShirtDiagram: true,
        },
      ],
    });

    expect(html).toContain("ยังไม่มีแบบที่ลูกค้าอนุมัติ");
    expect(html).not.toContain("data-station-position-marker");
    expect(html).toContain("ข้อมูลนี้บอกด้านไม่ได้");
    expect(html).toContain("ห้ามเดาตำแหน่ง");
  });

  it("Prep ที่มีเฉพาะเสื้อแสดงหัวข้อครั้งเดียวและไม่มีภาพลายท้ายหน้า", () => {
    const html = renderPreview({
      design: null,
      groups: [
        {
          id: "item-black",
          garmentLines,
          prints: [],
          showShirtDiagram: true,
        },
      ],
    });

    expect(html.match(/เสื้อ ไซส์ และจำนวน/g)).toHaveLength(1);
    expect(html).not.toContain("แบบและจุดที่ต้องทำ");
    expect(html).not.toContain("data-station-approved-reference");
    expect(html).not.toContain("data-station-standalone-art");
    expect(html).not.toContain("แผนผังตำแหน่งโดยประมาณ");
  });

  it("แยกเสื้อคนละ item แม้ใช้ตำแหน่ง FRONT เหมือนกัน เพื่อไม่จับลายผิดตัว", () => {
    const html = renderPreview({
      groups: [
        {
          id: "item-black",
          garmentLines: [
            {
              id: "black-l",
              product: "เสื้อดำ",
              size: "L",
              color: "ดำ",
              quantity: 4,
            },
          ],
          prints: [
            { ...frontPrint, id: "black-front", imageUrl: "/black-front.png" },
          ],
          showShirtDiagram: true,
        },
        {
          id: "item-white",
          garmentLines: [
            {
              id: "white-xl",
              product: "เสื้อขาว",
              size: "XL",
              color: "ขาว",
              quantity: 6,
            },
          ],
          prints: [
            { ...frontPrint, id: "white-front", imageUrl: "/white-front.png" },
          ],
          showShirtDiagram: true,
        },
      ],
    });

    expect(html).toContain("รายการที่ 1 จาก 2");
    expect(html).toContain("รายการที่ 2 จาก 2");
    expect(html).toContain("ใช้กับ เสื้อดำ · ดำ");
    expect(html).toContain("ใช้กับ เสื้อขาว · ขาว");
    expect(html).toContain("รูปลายแยก หน้า สำหรับ เสื้อดำ · ดำ");
    expect(html).toContain("รูปลายแยก หน้า สำหรับ เสื้อขาว · ขาว");
  });

  it("สินค้าไม่ใช่เสื้อไม่ถูกวาดบน silhouette เสื้อ", () => {
    const html = renderPreview({
      groups: [
        {
          id: "item-cap",
          garmentLines: [
            {
              id: "cap-free",
              product: "หมวกแก๊ป",
              size: "FREE",
              color: "ดำ",
              quantity: 10,
            },
          ],
          prints: [frontPrint],
          showShirtDiagram: false,
        },
      ],
    });

    expect(html).toContain("data-station-no-shirt-diagram");
    expect(html).toContain("สินค้านี้ไม่มีแผนภาพเสื้อที่ตรงชนิด");
    expect(html).toContain("ห้ามเทียบตำแหน่งกับทรงเสื้อ");
    expect(html).not.toContain("data-station-side-diagram");

    const productOnlyHtml = renderPreview({
      design: null,
      groups: [
        {
          id: "item-cap",
          garmentLines: [
            {
              id: "cap-free",
              product: "หมวกแก๊ป",
              size: "FREE",
              color: "ดำ",
              quantity: 10,
            },
          ],
          prints: [],
          showShirtDiagram: false,
        },
      ],
    });
    expect(productOnlyHtml).toContain('aria-label="รายการสินค้า"');
    expect(productOnlyHtml).not.toContain('aria-label="รายการเสื้อ"');
  });

  it("มี onError state แยกสำหรับภาพอนุมัติและรูปลาย ไม่ปล่อยภาพเสียค้าง", () => {
    expect(source).toContain("onError={() => setImageFailed(true)}");
    expect(source).toContain("onError={() => setArtImageFailed(true)}");
    expect(source).toContain("data-station-approved-image-error");
    expect(source).toContain("data-station-art-image-error");
    expect(source).toContain("โหลดภาพแบบอนุมัติไม่ได้");
    expect(source).toContain("โหลดรูปลายไม่ได้");
  });
});
