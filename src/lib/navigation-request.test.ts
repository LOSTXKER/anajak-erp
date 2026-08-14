import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  APP_NAVIGATION_REQUEST_EVENT,
  isAppNavigationRequestEvent,
  requestAppNavigation,
  type AppNavigationRequestEvent,
} from "./navigation-request";

describe("requestAppNavigation", () => {
  it("navigates immediately and closes the source when nobody intercepts", () => {
    const target = new EventTarget();
    const push = vi.fn();
    const replace = vi.fn();
    const onProceed = vi.fn();

    expect(
      requestAppNavigation("/orders", {
        target,
        push,
        replace,
        onProceed,
      }),
    ).toBe(true);
    expect(push).toHaveBeenCalledWith("/orders");
    expect(replace).not.toHaveBeenCalled();
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it("keeps navigation paused until an interceptor resumes it safely", () => {
    const target = new EventTarget();
    const push = vi.fn();
    const replace = vi.fn();
    const onProceed = vi.fn();
    let pending: AppNavigationRequestEvent | null = null;
    target.addEventListener(APP_NAVIGATION_REQUEST_EVENT, (event) => {
      if (!isAppNavigationRequestEvent(event)) return;
      event.preventDefault();
      pending = event;
    });

    expect(
      requestAppNavigation("/customers", {
        target,
        push,
        replace,
        onProceed,
      }),
    ).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(onProceed).not.toHaveBeenCalled();

    expect(pending).not.toBeNull();
    (pending as AppNavigationRequestEvent | null)?.detail.proceed("replace");
    expect(replace).toHaveBeenCalledWith("/customers");
    expect(push).not.toHaveBeenCalled();
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it("commits a resumed request at most once", () => {
    const target = new EventTarget();
    const push = vi.fn();
    let pending: AppNavigationRequestEvent | null = null;
    target.addEventListener(APP_NAVIGATION_REQUEST_EVENT, (event) => {
      if (!isAppNavigationRequestEvent(event)) return;
      event.preventDefault();
      pending = event;
    });

    requestAppNavigation("/orders/new", {
      target,
      push,
      replace: vi.fn(),
    });
    (pending as AppNavigationRequestEvent | null)?.detail.proceed();
    (pending as AppNavigationRequestEvent | null)?.detail.proceed();

    expect(push).toHaveBeenCalledOnce();
  });
});

describe("navigation request wiring", () => {
  const paletteSource = readFileSync(
    new URL("../components/layout/command-palette.tsx", import.meta.url),
    "utf8",
  );
  const orderFormSource = readFileSync(
    new URL("../components/orders/new/order-create-page.tsx", import.meta.url),
    "utf8",
  );
  const userMenuSource = readFileSync(
    new URL("../components/layout/user-menu.tsx", import.meta.url),
    "utf8",
  );

  it("routes both keyboard Enter and item clicks through the same palette action", () => {
    expect(paletteSource).toContain("requestAppNavigation(path");
    expect(paletteSource).toContain("filtered[safeActiveIdx]?.action();");
    expect(paletteSource).toContain("onClick={() => item.action()}");
  });

  it("lets the shared dirty edit form cancel and safely resume palette navigation", () => {
    expect(orderFormSource).toContain("APP_NAVIGATION_REQUEST_EVENT");
    expect(orderFormSource).toContain("event.preventDefault();");
    expect(orderFormSource).toContain('event.detail.proceed("replace")');
    expect(orderFormSource).not.toContain("window.confirm");
  });

  it("defers sign out until the shared navigation guard allows logout", () => {
    expect(userMenuSource).toContain('requestAppNavigation("/login"');
    expect(userMenuSource).toContain(
      'push: (href) => void signOutAndNavigate(href, "push")',
    );
    expect(userMenuSource).toContain(
      'replace: (href) => void signOutAndNavigate(href, "replace")',
    );
    expect(userMenuSource).toContain("await supabase.auth.signOut()");
    expect(userMenuSource).not.toContain("const handleLogout = async");
  });
});
