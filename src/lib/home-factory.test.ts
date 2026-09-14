import { describe, expect, it } from "vitest";
import {
  buildFactoryNodes,
  factoryHealth,
  findBottleneck,
  relativeLoad,
  type FactoryNodeCounts,
} from "./home-factory";

const QUIET: FactoryNodeCounts = {
  design: { total: 2, awaitingApproval: 0 },
  prep: { total: 3, active: 1 },
  film: { total: 6, active: 2 },
  vendor: { pending: 1, overduePickup: 0 },
  press: { total: 4, active: 1, ready: 4, waitingFilm: 0, waitingGarment: 0 },
  qc: { total: 2, checkedToday: 3 },
  pack: { total: 1 },
  ship: { readyToShip: 2, dueToday: 2 },
};

describe("buildFactoryNodes — สีสุขภาพและคอขวด", () => {
  it("โรงงานปกติ: ทุก node เขียว ไม่มีคอขวด", () => {
    const nodes = buildFactoryNodes(QUIET, { printRunsToday: 2 });
    expect(nodes.map((node) => node.key)).toEqual(["design", "prep", "vendor", "film", "press", "qc", "pack", "ship"]);
    expect(nodes.every((node) => node.tone === "ok")).toBe(true);
    expect(findBottleneck(nodes)).toBeNull();
    expect(factoryHealth(nodes)).toEqual({ bad: 0, warn: 0, tone: "ok" });
  });

  it("ร้านนอกเลยกำหนดรับ = แดงและเป็นคอขวด · รีดร้อนติดรอ = เหลือง · รอลูกค้า = เหลือง", () => {
    const nodes = buildFactoryNodes(
      {
        ...QUIET,
        design: { total: 4, awaitingApproval: 2 },
        vendor: { pending: 3, overduePickup: 2 },
        press: { total: 4, active: 1, ready: 2, waitingFilm: 1, waitingGarment: 1 },
      },
      { printRunsToday: 2 },
    );
    const byKey = Object.fromEntries(nodes.map((node) => [node.key, node]));
    expect(byKey.vendor).toMatchObject({ tone: "bad", late: 2, detail: "เลยกำหนดรับ 2" });
    expect(byKey.press).toMatchObject({ tone: "warn", waiting: 2 });
    expect(byKey.press.detail).toBe("พร้อมรีด 2 · รอฟิล์ม 1 · รอเสื้อ 1");
    expect(byKey.design.tone).toBe("warn");
    expect(findBottleneck(nodes)).toBe("vendor");
    expect(factoryHealth(nodes)).toEqual({ bad: 1, warn: 2, tone: "bad" });
  });

  it("แถบงานในมือเทียบ node ทำเองที่หนักสุด — node นอกโรงงานไม่มีแถบ", () => {
    const load = relativeLoad(buildFactoryNodes(QUIET, { printRunsToday: 0 }));
    expect(load.get("film")).toBe(1);
    expect(load.get("prep")).toBe(0.5);
    expect(load.has("vendor")).toBe(false);
    expect(load.has("design")).toBe(false);
  });
});
