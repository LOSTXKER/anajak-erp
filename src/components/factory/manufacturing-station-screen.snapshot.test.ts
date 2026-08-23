import { describe, expect, it } from "vitest";
import { releasedMockupImages } from "./manufacturing-station-screen";

describe("Manufacturing Station released mockup snapshot", () => {
  it("แสดง files จาก snapshot v1 โดยไม่ต้องอ่านแบบอนุมัติสดของออเดอร์", () => {
    expect(
      releasedMockupImages({
        designId: "design-v1",
        versionNumber: 1,
        fileUrl: "/mockups/v1-cover.png",
        files: [
          {
            fileUrl: "/mockups/v1-front.png",
            thumbnailUrl: "/mockups/v1-front-thumb.png",
            position: "FRONT",
          },
          {
            fileUrl: "/mockups/v1-back.png",
            caption: "ด้านหลัง",
          },
        ],
      }),
    ).toEqual([
      { url: "/mockups/v1-front-thumb.png", position: "FRONT" },
      { url: "/mockups/v1-back.png", position: "ด้านหลัง" },
    ]);
  });

  it("snapshot รุ่นเก่าที่ไม่มี files ถอยไปใช้ fileUrl ปก", () => {
    expect(
      releasedMockupImages({
        designId: "design-v1",
        versionNumber: 1,
        fileUrl: "/mockups/v1-cover.png",
      }),
    ).toEqual([{ url: "/mockups/v1-cover.png", position: "ม็อกอัพ" }]);
  });
});
