import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NAVIGATION_REQUEST_EVENT } from "@/lib/navigation-request";
import { createUnsavedChangesGuard, useUnsavedChanges, type UnsavedChangesOptions } from "./use-unsaved-changes";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as { run: () => void | (() => void); deps: readonly unknown[] }[],
  confirm: vi.fn<(options: Record<string, unknown>) => Promise<boolean>>(),
  router: { replace: vi.fn() },
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useRef: (initial: unknown) => {
    const index = hooks.refIndex++;
    return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
  },
  useEffect: (run: () => void | (() => void), deps: readonly unknown[]) => hooks.effects.push({ run, deps }),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("next/navigation", () => ({ useRouter: () => hooks.router }));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => hooks.confirm }));

let mountedEffects: { deps: readonly unknown[]; cleanup: void | (() => void) }[] = [];
function UnsavedChangesHarness({ dirty, options }: { dirty: boolean; options?: UnsavedChangesOptions }) {
  useUnsavedChanges(dirty, options);
}
function renderHook(dirty: boolean, options?: UnsavedChangesOptions) {
  hooks.refIndex = 0;
  hooks.effects = [];
  UnsavedChangesHarness({ dirty, options });
  mountedEffects = hooks.effects.map((effect, index) => {
    const previous = mountedEffects[index];
    if (previous && effect.deps.length === previous.deps.length && effect.deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return previous;
    previous?.cleanup?.();
    return { deps: effect.deps, cleanup: effect.run() };
  });
}

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

beforeEach(() => {
  active = [];
  hooks.refs = [];
  hooks.confirm.mockReset().mockResolvedValue(false);
  hooks.router.replace.mockReset();
  mountedEffects = [];
});
afterEach(() => {
  mountedEffects.forEach((effect) => effect.cleanup?.());
  active.forEach((guard) => guard.destroy());
  vi.unstubAllGlobals();
});

describe("การป้องกันฟอร์มที่ยังไม่บันทึก", () => {
  it("hook ที่ไม่ส่ง options ยังใช้คำยืนยันเดิมครบทุกช่อง", async () => {
    const page = browser();
    renderHook(true);
    expect(page.click("/customers").defaultPrevented).toBe(true);
    await flush();
    expect(hooks.confirm).toHaveBeenCalledExactlyOnceWith({
      title: "ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?",
      description: "ข้อมูลที่แก้ในฟอร์มจะหาย หากออกจากหน้านี้",
      confirmText: "ทิ้งการแก้ไข",
      cancelText: "กลับไปแก้ต่อ",
      destructive: true,
    });
    expect(hooks.router.replace).not.toHaveBeenCalled();
  });

  it("สินค้าใช้ข้อความล่าสุดระหว่าง pending โดยไม่สร้าง guard ใหม่ และออกได้เมื่อยืนยัน", async () => {
    const page = browser();
    renderHook(true, { title: "กำลังแก้ราคา" });
    const guardBefore = hooks.refs.map((ref) => ref.current).find((value) => value && typeof value === "object" && "setDirty" in value);
    expect(guardBefore).toBeDefined();
    const productCopy = {
      title: "ออกจากหน้าสินค้า?",
      description: "ราคาที่ส่งบันทึกแล้วจะดำเนินการต่อ ค่าที่ยังบันทึกไม่สำเร็จจะหายเมื่อออกจากหน้านี้",
      confirmText: "ออกจากหน้านี้",
      cancelText: "อยู่หน้านี้",
    };
    const product = readFileSync(new URL("../app/(dashboard)/products/[id]/page.tsx", import.meta.url), "utf8");
    expect(product).toContain("useUnsavedChanges(Object.keys(priceDrafts).length > 0 || updateVariant.isPending, {");
    Object.values(productCopy).forEach((copy) => expect(product).toContain(copy));
    renderHook(true, productCopy);
    const guardAfter = hooks.refs.map((ref) => ref.current).find((value) => value && typeof value === "object" && "setDirty" in value);
    expect(guardAfter).toBe(guardBefore);
    expect(page.entryCount).toBe(3);
    hooks.confirm.mockResolvedValueOnce(true);
    expect(page.click("/products").defaultPrevented).toBe(true);
    await flush();
    expect(hooks.confirm).toHaveBeenCalledExactlyOnceWith({ ...productCopy, destructive: true });
    expect(hooks.router.replace).toHaveBeenCalledExactlyOnceWith("/products");
  });

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
