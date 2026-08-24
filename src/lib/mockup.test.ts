import { describe, it, expect } from "vitest";
import {
  canSubmitMockupSet,
  mockupCoverImage,
  mockupFilesNeedingPreview,
  mockupImageCount,
  mockupImages,
  mockupPositionLabel,
  mockupPreviewUrl,
  orderMockupCover,
} from "./mockup";

describe("mockupPreviewUrl", () => {
  it("ไฟล์รูปตรงๆ ใช้ตัวมันเองได้", () => {
    expect(mockupPreviewUrl({ fileUrl: "/api/files/designs/a.png" })).toBe(
      "/api/files/designs/a.png",
    );
  });

  it("ไฟล์งาน .ai ต้องพึ่ง thumbnail ที่แนบมา", () => {
    expect(
      mockupPreviewUrl({
        fileUrl: "/api/files/designs/a.ai",
        thumbnailUrl: "/api/files/designs/a-preview.jpg",
      }),
    ).toBe("/api/files/designs/a-preview.jpg");
  });

  it(".ai ที่ไม่มี thumbnail = ไม่มีรูปให้ดู (ห้ามคืน .ai ไป render <img>)", () => {
    expect(mockupPreviewUrl({ fileUrl: "/api/files/designs/a.ai" })).toBeNull();
  });

  it("thumbnail ที่ไม่ใช่ไฟล์รูปก็ไม่นับ — ถอยไปดูไฟล์หลักแทน", () => {
    expect(
      mockupPreviewUrl({
        fileUrl: "/api/files/designs/a.png",
        thumbnailUrl: "/api/files/designs/broken.pdf",
      }),
    ).toBe("/api/files/designs/a.png");
  });

  it("ภาพ data URL ที่ browser แสดงได้ใช้เป็นม็อกอัพได้", () => {
    const svg = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'/%3E";

    expect(mockupPreviewUrl({ fileUrl: svg })).toBe(svg);
  });
});

describe("mockupImages", () => {
  it("เวอร์ชันเก่าที่ยังไม่มี files → ถอยไปใช้รูปปก ไม่ต้อง backfill", () => {
    const images = mockupImages({
      fileUrl: "/api/files/designs/cover.png",
      thumbnailUrl: null,
      files: [],
    });
    expect(images).toHaveLength(1);
    expect(images[0].previewUrl).toBe("/api/files/designs/cover.png");
  });

  it("files เป็น null (ไม่ได้ include มา) ก็ถอยไปรูปปกเหมือนกัน", () => {
    expect(
      mockupImages({ fileUrl: "/api/files/designs/cover.png", files: null }),
    ).toHaveLength(1);
  });

  it("มี files แล้วต้องใช้ทั้งชุด ไม่เอารูปปกมาซ้ำ", () => {
    const images = mockupImages({
      fileUrl: "/api/files/designs/front.png",
      files: [
        { fileUrl: "/api/files/designs/front.png", position: "FRONT" },
        { fileUrl: "/api/files/designs/back.png", position: "BACK" },
        { fileUrl: "/api/files/designs/sleeve.png", position: "SLEEVE_L" },
      ],
    });
    expect(images).toHaveLength(3);
    expect(images.map((i) => i.positionLabel)).toEqual(["หน้า", "หลัง", "แขนซ้าย"]);
  });

  it("ตำแหน่งที่ไม่รู้จักไม่ทำให้พัง — คืน label เป็น null", () => {
    const images = mockupImages({
      fileUrl: "/api/files/designs/a.png",
      files: [{ fileUrl: "/api/files/designs/a.png", position: "SOMEWHERE" }],
    });
    expect(images[0].position).toBe("SOMEWHERE");
    expect(images[0].positionLabel).toBeNull();
  });
});

describe("mockupCoverImage", () => {
  it("ข้ามไฟล์ที่ไม่มีรูป ไปหยิบรูปแรกที่แสดงได้จริง", () => {
    expect(
      mockupCoverImage({
        fileUrl: "/api/files/designs/master.ai",
        files: [
          { fileUrl: "/api/files/designs/master.ai" },
          { fileUrl: "/api/files/designs/back.png" },
        ],
      }),
    ).toBe("/api/files/designs/back.png");
  });

  it("ไม่มีรูปให้ดูเลยคืน null (การ์ดจะได้โชว์ไอคอนแทนรูปแตก)", () => {
    expect(
      mockupCoverImage({
        fileUrl: "/api/files/designs/master.ai",
        files: [{ fileUrl: "/api/files/designs/master.ai" }],
      }),
    ).toBeNull();
  });
});

describe("mockupImageCount", () => {
  it("นับรูปทั้งชุด", () => {
    expect(
      mockupImageCount({
        fileUrl: "/a.png",
        files: [{ fileUrl: "/a.png" }, { fileUrl: "/b.png" }],
      }),
    ).toBe(2);
  });

  it("เวอร์ชันเก่านับเป็น 1 (รูปปก)", () => {
    expect(mockupImageCount({ fileUrl: "/a.png", files: [] })).toBe(1);
  });
});

describe("canSubmitMockupSet / mockupFilesNeedingPreview", () => {
  it("ชุดว่างส่งไม่ได้", () => {
    expect(canSubmitMockupSet([])).toBe(false);
  });

  it("ทุกไฟล์มีรูปให้ดู = ส่งได้", () => {
    expect(
      canSubmitMockupSet([{ fileUrl: "/a.png" }, { fileUrl: "/b.jpg" }]),
    ).toBe(true);
  });

  it("มี .ai ที่ยังไม่แนบรูปตัวอย่าง = ส่งไม่ได้ และชี้ตำแหน่งไฟล์ที่ขาด", () => {
    const files = [
      { fileUrl: "/a.png" },
      { fileUrl: "/b.ai" },
      { fileUrl: "/c.psd", thumbnailUrl: "/c.png" },
    ];
    expect(mockupFilesNeedingPreview(files)).toEqual([1]);
    expect(canSubmitMockupSet(files)).toBe(false);
  });
});

describe("orderMockupCover", () => {
  it("ม็อกอัพอนุมัติมาก่อนรูปลายเสมอ (ตรงกับของที่จะผลิตที่สุด)", () => {
    expect(
      orderMockupCover({
        designs: [{ fileUrl: "/mockup.png", files: [{ fileUrl: "/mockup.png" }] }],
        items: [{ prints: [{ designImageUrl: "/print.png" }] }],
      }),
    ).toBe("/mockup.png");
  });

  it("ไม่มีม็อกอัพ → ถอยไปรูปลายบนรายการ", () => {
    expect(
      orderMockupCover({
        designs: [],
        items: [{ prints: [{ designImageUrl: "/print.png" }] }],
      }),
    ).toBe("/print.png");
  });

  it("ไม่มีรูปลายบนรายการ → ถอยไปรูปในคลังลาย", () => {
    expect(
      orderMockupCover({
        items: [
          { prints: [{ designImageUrl: null, artwork: { imageUrl: "/artwork.png" } }] },
        ],
      }),
    ).toBe("/artwork.png");
  });

  it("ม็อกอัพที่เปิดดูไม่ได้ (.ai ล้วน) ต้องไม่บังรูปลายที่ดูได้", () => {
    expect(
      orderMockupCover({
        designs: [{ fileUrl: "/master.ai", files: [{ fileUrl: "/master.ai" }] }],
        items: [{ prints: [{ designImageUrl: "/print.png" }] }],
      }),
    ).toBe("/print.png");
  });

  it("ไม่มีอะไรเลยคืน null และรับ null/undefined ได้", () => {
    expect(orderMockupCover({})).toBeNull();
    expect(orderMockupCover(null)).toBeNull();
    expect(orderMockupCover({ designs: null, items: null })).toBeNull();
  });
});

describe("mockupPositionLabel", () => {
  it("แปลงเป็นภาษาที่หน้างานอ่านออก", () => {
    expect(mockupPositionLabel("FRONT")).toBe("หน้า");
    expect(mockupPositionLabel("POCKET")).toBe("กระเป๋า");
  });

  it("ว่าง/ไม่รู้จัก = null", () => {
    expect(mockupPositionLabel(null)).toBeNull();
    expect(mockupPositionLabel("")).toBeNull();
    expect(mockupPositionLabel("NOPE")).toBeNull();
  });
});
