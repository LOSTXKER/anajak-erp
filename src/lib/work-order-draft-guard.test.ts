import { describe, expect, it, vi } from "vitest";
import { canChangeWorkOrder, guardWorkOrderDraft } from "./work-order-draft-guard";

describe("work-order draft preflight", () => {
  it("ยอดยังไม่บันทึกต้องไม่เริ่มคำสั่งส่งร้าน/พัก/ย้อนขั้น และบันทึกหรือคืนค่าแล้วจึงทำต่อได้", () => {
    const target = new EventTarget();
    const notify = vi.fn();
    const mutate = vi.fn();
    const stopGuarding = guardWorkOrderDraft(target, notify);
    if (canChangeWorkOrder(target)) mutate();
    expect(mutate).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledOnce();

    stopGuarding();
    if (canChangeWorkOrder(target)) mutate();
    expect(mutate).toHaveBeenCalledOnce();
  });

  it("สองขั้นที่เปิดคู่กันต้องบันทึกครบทั้งคู่ แม้ขั้นแรกคืนค่าไปแล้ว", () => {
    const target = new EventTarget();
    const notify = vi.fn();
    const stopFirst = guardWorkOrderDraft(target, notify);
    const stopSecond = guardWorkOrderDraft(target, notify);
    expect(canChangeWorkOrder(target)).toBe(false);
    expect(notify).toHaveBeenCalledOnce();
    stopFirst();
    expect(canChangeWorkOrder(target)).toBe(false);
    stopSecond();
    expect(canChangeWorkOrder(target)).toBe(true);
  });
});
