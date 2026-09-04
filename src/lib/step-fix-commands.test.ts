import { describe, expect, it, vi } from "vitest";
import { SERVICE_OWNED_STEP_TYPES, buildFixCommands, type FixStepLike } from "@/lib/step-fix-commands";

function actions() {
  return { openQty: vi.fn(), openManagerEdit: vi.fn(), setStatus: vi.fn() };
}
function step(over: Partial<FixStepLike>): FixStepLike {
  return { id: "s1", stepType: "HEAT_PRESS", status: "IN_PROGRESS", qtyTotal: 240, ...over };
}
const enabledKeys = (s: FixStepLike) =>
  buildFixCommands(s, actions())
    .filter((c) => c.enabled)
    .map((c) => c.key);

describe("buildFixCommands — รายการแก้ให้ของหัวหน้า ตรงกับกติกา server", () => {
  it("ขั้นกำลังทำ (ในโรงงาน): แก้ยอด · เปลี่ยนคน · พัก · คืนคิว · ผ่านแทน ได้ · reopen ไม่ได้", () => {
    expect(enabledKeys(step({ status: "IN_PROGRESS" }))).toEqual(["qty", "assign", "hold", "requeue", "skip"]);
  });

  it("ขั้นรอทำ: คืนคิวไม่ได้ (ยังไม่ได้เริ่ม) ที่เหลือได้", () => {
    expect(enabledKeys(step({ status: "PENDING" }))).toEqual(["qty", "assign", "hold", "skip"]);
  });

  it("ขั้นติดปัญหา/พัก: เหลือแค่ปลดปัญหา/เปลี่ยนคน และป้ายเปลี่ยนเป็น 'ปลดปัญหา'", () => {
    for (const status of ["FAILED", "ON_HOLD"]) {
      const cmds = buildFixCommands(step({ status }), actions());
      expect(cmds.filter((c) => c.enabled).map((c) => c.key)).toEqual(["assign"]);
      expect(cmds.find((c) => c.key === "assign")?.label).toContain("ปลดปัญหา");
    }
  });

  it("ขั้นปิดแล้ว: ทำอะไรไม่ได้เลย และทุกรายการบอกเหตุ", () => {
    const cmds = buildFixCommands(step({ status: "COMPLETED" }), actions());
    expect(cmds.every((c) => !c.enabled)).toBe(true);
    expect(cmds.every((c) => typeof c.why === "string" && c.why.length > 0)).toBe(true);
  });

  it("ขั้นที่บริการเฉพาะเป็นเจ้าของ (เบิกเสื้อ/ตรวจรับ/พิมพ์ DTF): เปลี่ยนคนได้อย่างเดียว", () => {
    for (const stepType of SERVICE_OWNED_STEP_TYPES) {
      expect(enabledKeys(step({ stepType }))).toEqual(["assign"]);
    }
  });

  it("ขั้นที่ไม่นับตัว: แก้ยอดไม่ได้และบอกว่าไม่นับตัว", () => {
    const qty = buildFixCommands(step({ qtyTotal: null }), actions()).find((c) => c.key === "qty")!;
    expect(qty.enabled).toBe(false);
    expect(qty.why).toBe("ขั้นนี้ไม่นับตัว");
  });

  it("run ของแต่ละรายการวิ่งไปคำสั่งที่ถูกต้อง (ยอด → openQty · คน → manager edit · พัก/คืน/ผ่าน → สถานะ)", () => {
    const a = actions();
    const s = step({});
    const by = Object.fromEntries(buildFixCommands(s, a).map((c) => [c.key, c]));
    by.qty!.run();
    by.assign!.run();
    by.hold!.run();
    by.requeue!.run();
    by.skip!.run();
    expect(a.openQty).toHaveBeenCalledWith("s1");
    expect(a.openManagerEdit).toHaveBeenCalledWith(s);
    expect(a.setStatus.mock.calls.map((c) => c[1])).toEqual(["ON_HOLD", "PENDING", "COMPLETED"]);
    expect(by.skip!.danger).toBe(true);
  });
});
