import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as { run: () => void | (() => void); deps: readonly unknown[] }[],
}));

vi.mock("react", () => ({
  useRef: (initial: unknown) => {
    const index = hooks.refIndex++;
    return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
  },
  useEffect: (run: () => void | (() => void), deps: readonly unknown[]) => hooks.effects.push({ run, deps }),
  useLayoutEffect: (run: () => void | (() => void), deps: readonly unknown[]) => hooks.effects.push({ run, deps }),
}));

import { useWorkspaceScroll } from "./use-workspace-scroll";

function ScrollHarness({ pathname }: { pathname: string }) {
  return useWorkspaceScroll(pathname);
}

class MainElement extends EventTarget {
  firstElementChild = {};
  maxScroll = 3_000;
  private top = 0;
  get scrollTop() { return this.top; }
  set scrollTop(top: number) { this.top = Math.min(this.maxScroll, Math.max(0, top)); }
  scrollTo(top: number) {
    this.scrollTop = top;
    this.dispatchEvent(new Event("scroll"));
  }
}

// Browser targets invoke capture listeners before ordinary listeners. Node's
// EventTarget does not model this order, so use separate queues for this boundary.
class WindowTarget extends EventTarget {
  private captureEvents = new EventTarget();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    const capture = typeof options === "boolean" ? options : options?.capture;
    if (capture) this.captureEvents.addEventListener(type, listener);
    else super.addEventListener(type, listener, options);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
    const capture = typeof options === "boolean" ? options : options?.capture;
    if (capture) this.captureEvents.removeEventListener(type, listener);
    else super.removeEventListener(type, listener, options);
  }
  override dispatchEvent(event: Event) {
    this.captureEvents.dispatchEvent(event);
    return super.dispatchEvent(event);
  }
}

function browser() {
  const windowTarget = new WindowTarget();
  const location = { pathname: "/production", search: "", get href() { return `https://erp.test${this.pathname}${this.search}`; } };
  const main = new MainElement();
  const frames = new Map<number, FrameRequestCallback>();
  const observers = new Set<() => void>();
  let frameId = 0;
  let mounted: { deps: readonly unknown[]; cleanup: void | (() => void) }[] = [];
  let commitDuringPopState = false;

  // Next registers before the shell and can synchronously commit a cached route
  // inside its ordinary popstate listener, as observed in the browser trace.
  windowTarget.addEventListener("popstate", () => {
    if (commitDuringPopState) render(location.pathname);
  });

  vi.stubGlobal("window", Object.assign(windowTarget, { location }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class {
    constructor(readonly callback: () => void) {}
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
  });

  const render = (pathname: string) => {
    hooks.refIndex = 0;
    hooks.effects = [];
    const ref = ScrollHarness({ pathname });
    ref.current = main as unknown as HTMLElement;
    mounted = hooks.effects.map((effect, index) => {
      const previous = mounted[index];
      if (previous && effect.deps.every((dep, i) => dep === previous.deps[i])) return previous;
      previous?.cleanup?.();
      return { deps: effect.deps, cleanup: effect.run() };
    });
  };
  const paint = () => {
    const next = [...frames.values()];
    frames.clear();
    next.forEach((callback) => callback(0));
  };
  const navigate = (pathname: string, back = false, synchronousCommit = false) => {
    location.pathname = pathname;
    commitDuringPopState = synchronousCommit;
    if (back) windowTarget.dispatchEvent(new Event("popstate"));
    render(pathname);
  };
  const lateBack = (pathname: string, afterPaint = false) => {
    location.pathname = pathname;
    render(pathname);
    if (afterPaint) paint();
    windowTarget.dispatchEvent(new Event("popstate"));
  };
  const resize = (maxScroll: number) => {
    main.maxScroll = maxScroll;
    main.scrollTop = main.scrollTop;
    [...observers].forEach((callback) => callback());
  };
  return { main, location, render, paint, navigate, lateBack, resize, pop: () => windowTarget.dispatchEvent(new Event("popstate")), destroy: () => mounted.forEach((effect) => effect.cleanup?.()) };
}

let page: ReturnType<typeof browser>;
beforeEach(() => {
  hooks.refs = [];
  page = browser();
  page.render("/production");
  page.paint();
});
afterEach(() => { page.destroy(); vi.unstubAllGlobals(); });

function openDetail() {
  page.main.scrollTo(1_200);
  page.main.dispatchEvent(new Event("click"));
  page.navigate("/production/work-1");
  page.paint();
  expect(page.main.scrollTop).toBe(0);
}

describe("workspace route scroll", () => {
  it.each([false, true])("restores when popstate arrives after the route commit (already painted: %s)", (afterPaint) => {
    openDetail();
    page.lateBack("/production", afterPaint);
    page.paint();
    expect(page.main.scrollTop).toBe(1_200);
  });

  it("recognizes Back before Next synchronously commits the cached route", () => {
    openDetail();
    page.navigate("/production", true, true);
    page.paint();
    expect(page.main.scrollTop).toBe(1_200);
  });

  it("opens a detail at the top and restores Back after the route scroll handler", () => {
    openDetail();
    page.navigate("/production", true);
    // Next's ancestor layout handler can scroll/focus after the shell layout effect.
    page.main.scrollTo(0);
    page.paint();
    expect(page.main.scrollTop).toBe(1_200);
  });

  it("does not save the next route's clamped scroll as the list position", () => {
    page.main.scrollTo(1_200);
    page.main.dispatchEvent(new Event("click"));
    page.location.pathname = "/production/work-1";
    page.main.scrollTo(0);
    page.render("/production/work-1");
    page.paint();
    page.navigate("/production", true);
    page.paint();
    expect(page.main.scrollTop).toBe(1_200);
  });

  it("waits for async list height and restores after the content commit", () => {
    openDetail();
    page.main.maxScroll = 0;
    page.navigate("/production", true);
    page.paint();
    expect(page.main.scrollTop).toBe(0);
    page.resize(3_000);
    page.main.scrollTo(0);
    page.paint();
    expect(page.main.scrollTop).toBe(1_200);
  });

  it("stops pending restoration when the user starts interacting", () => {
    openDetail();
    page.main.maxScroll = 0;
    page.navigate("/production", true);
    page.paint();
    page.main.dispatchEvent(new Event("pointerdown"));
    page.resize(3_000);
    page.main.scrollTo(100);
    page.paint();
    expect(page.main.scrollTop).toBe(100);
  });

  it("keeps scroll on query-tab rerenders and starts new navigation at the top", () => {
    openDetail();
    page.main.scrollTo(600);
    page.render("/production/work-1");
    page.paint();
    expect(page.main.scrollTop).toBe(600);
    page.main.dispatchEvent(new Event("click"));
    page.location.search = "?tab=pieces";
    page.render("/production/work-1");
    page.main.scrollTo(300);
    page.location.search = "";
    page.pop();
    page.paint();
    expect(page.main.scrollTop).toBe(300);
    page.navigate("/production");
    page.paint();
    expect(page.main.scrollTop).toBe(0);
  });

  it("cancels an unfinished Back when navigating somewhere else", () => {
    openDetail();
    page.main.maxScroll = 0;
    page.navigate("/production", true);
    page.navigate("/customers");
    page.resize(3_000);
    page.paint();
    expect(page.main.scrollTop).toBe(0);
    page.main.scrollTo(200);
    page.resize(4_000);
    page.paint();
    expect(page.main.scrollTop).toBe(200);
  });
});
