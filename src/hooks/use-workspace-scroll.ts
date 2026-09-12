"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/** Next handles window scrolling; the ERP workspace scrolls its own main element. */
export function useWorkspaceScroll(pathname: string) {
  const mainRef = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  const activePath = useRef(pathname);
  const restorePath = useRef<string | null>(null);
  const restoreCommittedPath = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onPopState = () => {
      const nextPath = window.location.pathname;
      restorePath.current = nextPath !== activePath.current ? nextPath : null;
      if (!restorePath.current) restoreCommittedPath.current?.();
    };
    // Next's ordinary listener can commit a cached route before later listeners
    // run. Mark Back/Forward during capture while activePath is still the source.
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, []);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const savedPosition = positions.current.get(pathname) ?? 0;
    const isBack = restorePath.current === pathname;
    const changedPath = activePath.current !== pathname;
    const entryHref = window.location.href;
    let target = isBack ? savedPosition : 0;
    restorePath.current = null;
    activePath.current = pathname;
    let pending = true;
    let restoreFrame = 0;

    // Next can scroll/focus an ancestor after this layout effect. Restore after
    // that commit, and retry when async content makes the saved position reachable.
    const observer = new ResizeObserver(scheduleRestore);
    // A cached route may commit before popstate is delivered. Keep its previous
    // position until that event arrives or the user starts interacting. Matching
    // the complete entry URL prevents query-only Back from restoring another tab.
    restoreCommittedPath.current = changedPath && !isBack ? () => {
      restoreCommittedPath.current = null;
      if (window.location.href !== entryHref) return;
      target = savedPosition;
      pending = true;
      if (main.firstElementChild) observer.observe(main.firstElementChild);
      scheduleRestore();
    } : null;
    function scheduleRestore() {
      if (!pending || restoreFrame) return;
      restoreFrame = requestAnimationFrame(() => {
        restoreFrame = 0;
        restore();
      });
    }
    function restore() {
      if (!pending) return;
      main!.scrollTop = target;
      if (Math.abs(main!.scrollTop - target) < 1) {
        pending = false;
        observer.disconnect();
        positions.current.set(pathname, main!.scrollTop);
      }
    }
    const cancelRestore = () => {
      pending = false;
      restoreCommittedPath.current = null;
      observer.disconnect();
      cancelAnimationFrame(restoreFrame);
      savePosition();
    };
    const savePosition = () => {
      // The old page can receive a scroll event while its replacement is being
      // committed. Do not replace its saved position with the new page's top.
      if (!pending && window.location.pathname === pathname) {
        positions.current.set(pathname, main.scrollTop);
      }
    };
    if (main.firstElementChild) observer.observe(main.firstElementChild);
    main.scrollTop = target;
    scheduleRestore();
    main.addEventListener("scroll", savePosition, { passive: true });
    main.addEventListener("wheel", cancelRestore, { passive: true });
    main.addEventListener("touchstart", cancelRestore, { passive: true });
    main.addEventListener("pointerdown", cancelRestore, { passive: true });
    main.addEventListener("click", cancelRestore, true);
    main.addEventListener("keydown", cancelRestore);
    return () => {
      pending = false;
      restoreCommittedPath.current = null;
      observer.disconnect();
      cancelAnimationFrame(restoreFrame);
      main.removeEventListener("scroll", savePosition);
      main.removeEventListener("wheel", cancelRestore);
      main.removeEventListener("touchstart", cancelRestore);
      main.removeEventListener("pointerdown", cancelRestore);
      main.removeEventListener("click", cancelRestore, true);
      main.removeEventListener("keydown", cancelRestore);
    };
  }, [pathname]);

  return mainRef;
}
