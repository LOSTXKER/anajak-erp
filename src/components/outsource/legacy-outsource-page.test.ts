import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("./legacy-outsource-page.tsx", import.meta.url),
  "utf8",
);

describe("Outsource worklist command contract", () => {
  it("แสดง action และเหตุผลจาก server โดยไม่เดาจาก status หรือ role ในหน้า", () => {
    expect(pageSource).toContain(
      "outsourceActionAvailability(o.availableCommands",
    );
    expect(pageSource).not.toContain("outsourceActionAvailability(o.status");
    expect(pageSource).toContain("o.blockedReason");
    expect(pageSource).toContain('role="status"');
    expect(pageSource).not.toMatch(
      /const can(?:HandleGoods|JudgeQc|Supervise)\s*=/,
    );
  });

  it("dialog ที่เขียนข้อมูลยังตรวจ availableCommands ล่าสุดของใบงาน", () => {
    expect(pageSource).toContain(
      'currentQcFailTarget.availableCommands.includes("failQc")',
    );
    expect(pageSource).toContain(
      'currentReceiveTarget.availableCommands.includes("receiveBack")',
    );
    expect(pageSource).toContain(
      'currentShareTarget?.availableCommands.includes("share")',
    );
  });
});
