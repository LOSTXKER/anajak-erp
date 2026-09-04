import { describe, expect, it } from "vitest";
import { FLOOR_HREF, floorJobHref, isFloorWorker } from "@/lib/production-surface";

describe("isFloorWorker — ใครถูกพาไปโหมดหน้างาน (หนึ่งโมดูล สองสายตา)", () => {
  it("ช่างผลิตที่ไม่มีสิทธิ์หัวหน้า = ช่างหน้างาน", () => {
    expect(isFloorWorker("PRODUCTION_STAFF", null)).toBe(true);
  });

  it("หัวหน้า/เจ้าของ/ขาย ไม่ใช่ช่างหน้างาน แม้จะมีสิทธิ์งานผลิต", () => {
    expect(isFloorWorker("OWNER", null)).toBe(false);
    expect(isFloorWorker("MANAGER", null)).toBe(false);
    expect(isFloorWorker("SALES", null)).toBe(false);
  });

  it("ช่างที่ได้สิทธิ์หัวหน้าเพิ่มรายคน → เห็นโต๊ะงาน ไม่ถูกพาไปหน้างาน", () => {
    expect(isFloorWorker("PRODUCTION_STAFF", { supervise_operations: true })).toBe(false);
  });

  it("ช่างที่ถูกถอดสิทธิ์งานผลิต → ไม่ใช่ช่างหน้างาน (ไม่มีอะไรให้ทำที่นั่น)", () => {
    expect(isFloorWorker("PRODUCTION_STAFF", { manage_production: false })).toBe(false);
  });
});

describe("floorJobHref — ลิงก์เปิดหน้าลงมือโดยไม่ต้องรู้สถานี", () => {
  it("มี job เสมอ · ใส่ step และ fix เมื่อส่งมา", () => {
    expect(floorJobHref("p1")).toBe(`${FLOOR_HREF}?s=job&job=p1`);
    expect(floorJobHref("p1", "st9", { fix: true })).toBe(`${FLOOR_HREF}?s=job&job=p1&step=st9&fix=1`);
    expect(floorJobHref("p1", null)).not.toContain("step=");
  });
});
