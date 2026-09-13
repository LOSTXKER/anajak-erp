import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NAVIGATION_REQUEST_EVENT } from "@/lib/navigation-request";
import { createUnsavedChangesGuard } from "./use-unsaved-changes";

const FORM_URL = "https://erp.test/quotations/new?edit=quote-1";
const PREVIOUS_URL = "https://erp.test/quotations/quote-1";

class TestAnchor {
  constructor(readonly href: string, readonly target = "") {}
  closest() { return this; }
  hasAttribute() { return false; }
}

function browser() {
  const target = new EventTarget();
  const documentTarget = new EventTarget();
  const entries = [
    { url: PREVIOUS_URL, state: {} as Record<string, unknown> },
    { url: FORM_URL, state: {} as Record<string, unknown> },
  ];
  let index = 1;
  const history = {
    get state() { return entries[index].state; },
    pushState(state: Record<string, unknown>, _title: string, url: string) {
      entries.splice(index + 1);
      entries.push({ state, url });
      index += 1;
    },
    back() { history.go(-1); },
    go(delta: number) {
      queueMicrotask(() => {
        index = Math.min(entries.length - 1, Math.max(0, index + delta));
        target.dispatchEvent(new Event("popstate"));
      });
    },
  };
  const location = { get href() { return entries[index].url; } };
  vi.stubGlobal("window", Object.assign(target, { history, location }));
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("Element", TestAnchor);
  return {
    target, history, location,
    get entryCount() { return entries.length; },
    click(href: string, anchorTarget = "", modifiers: Record<string, unknown> = {}) {
      const event = new Event("click", { cancelable: true });
      Object.defineProperties(event, {
        target: { value: new TestAnchor(href, anchorTarget) },
        button: { value: 0 },
        ...Object.fromEntries(Object.entries(modifiers).map(([key, value]) => [key, { value }])),
      });
      documentTarget.dispatchEvent(event);
      return event;
    },
  };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
let active: ReturnType<typeof createUnsavedChangesGuard>[] = [];
const createGuard = (confirmDiscard: () => Promise<boolean>, replace = vi.fn()) => {
  const guard = createUnsavedChangesGuard({ confirmDiscard, replace });
  active.push(guard);
  return { guard, replace };
};

beforeEach(() => { active = []; });
afterEach(() => { active.forEach((guard) => guard.destroy()); vi.unstubAllGlobals(); });

describe("การป้องกันฟอร์มที่ยังไม่บันทึก", () => {
  it("ฟอร์มไม่เปลี่ยนไม่เตือน และการเปลี่ยนกลับเป็นค่าเดิมเอา guard ออก", async () => {
    const page = browser();
    const confirm = vi.fn(async () => false);
    const { guard } = createGuard(confirm);
    guard.setDirty(false);
    expect(page.click("/customers").defaultPrevented).toBe(false);
    guard.setDirty(true);
    expect(page.entryCount).toBe(3);
    guard.setDirty(false);
    await flush();
    page.history.back();
    await flush();
    expect(page.location.href).toBe(PREVIOUS_URL);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("Back แล้วไม่ทิ้งข้อมูลยังอยู่ URL เดิม และยืนยันรอบถัดไปกลับหน้าก่อนฟอร์ม", async () => {
    const page = browser();
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { guard } = createGuard(confirm);
    guard.setDirty(true);
    page.history.back();
    await flush();
    expect(page.location.href).toBe(FORM_URL);
    page.history.back();
    await flush();
    expect(page.location.href).toBe(PREVIOUS_URL);
  });

  it("ลิงก์ภายในรอคำตอบ แต่ลิงก์แท็บใหม่และ modifier ไม่ทิ้งหน้าปัจจุบัน", async () => {
    const page = browser();
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { guard, replace } = createGuard(confirm);
    guard.setDirty(true);
    expect(page.click("/customers", "_blank").defaultPrevented).toBe(false);
    expect(page.click("/customers", "", { metaKey: true }).defaultPrevented).toBe(false);
    expect(page.click("/customers").defaultPrevented).toBe(true);
    await flush();
    expect(replace).not.toHaveBeenCalled();
    page.click("/customers");
    await flush();
    expect(replace).toHaveBeenCalledWith("/customers");
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("เมนูแอปรอการยืนยันและ resume คำสั่งเดิมได้หลังถอด guard", async () => {
    const page = browser();
    const { guard } = createGuard(async () => true);
    guard.setDirty(true);
    const proceed = vi.fn();
    const request = new CustomEvent(APP_NAVIGATION_REQUEST_EVENT, { cancelable: true, detail: { href: "/login", proceed } });
    page.target.dispatchEvent(request);
    expect(request.defaultPrevented).toBe(true);
    await flush();
    expect(proceed).toHaveBeenCalledExactlyOnceWith("replace");
  });

  it("บันทึกสำเร็จออกได้โดยไม่เตือนซ้ำ และปิดแท็บเตือนเฉพาะตอน dirty", async () => {
    const page = browser();
    const confirm = vi.fn(async () => false);
    const { guard, replace } = createGuard(confirm);
    guard.setDirty(true);
    const before = new Event("beforeunload", { cancelable: true });
    page.target.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    guard.navigateAfterSave(PREVIOUS_URL);
    await flush();
    expect(replace).toHaveBeenCalledWith(PREVIOUS_URL);
    expect(confirm).not.toHaveBeenCalled();
    const after = new Event("beforeunload", { cancelable: true });
    page.target.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("StrictMode/effect สร้าง controller ใหม่รับช่วง sentinel เดิมโดยไม่เพิ่ม history ซ้ำ", async () => {
    const page = browser();
    const first = createGuard(async () => false).guard;
    first.setDirty(true);
    first.destroy();
    const confirm = vi.fn(async () => false);
    const second = createGuard(confirm).guard;
    second.setDirty(true);
    expect(page.entryCount).toBe(3);
    page.history.back();
    await flush();
    expect(confirm).toHaveBeenCalledOnce();
    expect(page.location.href).toBe(FORM_URL);
    second.setDirty(false);
    await flush();
    page.history.back();
    await flush();
    expect(page.location.href).toBe(PREVIOUS_URL);
  });

  it("คำตอบ modal ที่มาหลังถอด controller ไม่พาออกจากหน้า", async () => {
    const page = browser();
    let answer!: (value: boolean) => void;
    const { guard, replace } = createGuard(() => new Promise((resolve) => { answer = resolve; }));
    guard.setDirty(true);
    page.click("/customers");
    guard.destroy();
    answer(true);
    await flush();
    expect(replace).not.toHaveBeenCalled();
    expect(page.location.href).toBe(FORM_URL);
  });
});
