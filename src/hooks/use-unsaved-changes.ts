"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { APP_NAVIGATION_REQUEST_EVENT, isAppNavigationRequestEvent } from "@/lib/navigation-request";

type GuardOptions = { confirmDiscard: () => Promise<boolean>; replace: (href: string) => void };
export type UnsavedChangesOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

/** วงจรนำทางแยกจาก React เพื่อทดสอบ Back/การยกเลิก/การบันทึกด้วย browser events ได้ */
export function createUnsavedChangesGuard({ confirmDiscard, replace }: GuardOptions) {
  let dirty = false;
  let guardUrl = window.location.href;
  let guarded = window.history.state?.__unsavedChangesGuard === guardUrl;
  let prompting = false;
  let leaving = false;
  let destroyed = false;
  let pendingExit: { href: string | null; proceed?: () => void } | null = null;

  const arm = () => {
    guardUrl = window.location.href;
    window.history.pushState({ ...window.history.state, __unsavedChangesGuard: guardUrl }, "", guardUrl);
    guarded = true;
  };
  const leave = (href: string, proceed?: () => void) => {
    leaving = true;
    dirty = false;
    if (guarded) {
      pendingExit = { href, proceed };
      window.history.back();
    } else if (proceed) proceed();
    else replace(href);
  };
  const askToLeave = async (href: string, proceed?: () => void) => {
    if (prompting || leaving) return;
    prompting = true;
    const discard = await confirmDiscard();
    if (destroyed) return;
    prompting = false;
    if (discard) leave(href, proceed);
  };
  const onPop = () => {
    if (pendingExit) {
      const pending = pendingExit;
      pendingExit = null;
      guarded = false;
      if (pending.proceed) pending.proceed();
      else if (pending.href) replace(pending.href);
      else if (dirty && !leaving) arm();
      return;
    }
    if (!guarded || !dirty || leaving) return;
    // Back ลงมาที่ URL เดิมก่อน จึงยังไม่ถอดฟอร์มออกระหว่างรอคำตอบ
    window.history.pushState({ ...window.history.state, __unsavedChangesGuard: guardUrl }, "", guardUrl);
    if (prompting) return;
    prompting = true;
    void confirmDiscard().then((discard) => {
      if (destroyed) return;
      prompting = false;
      if (!discard) return;
      leaving = true;
      dirty = false;
      guarded = false;
      window.history.go(-2);
    });
  };
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty || leaving) return;
    event.preventDefault();
    event.returnValue = "";
  };
  const leavesForm = (href: string) => {
    const current = new URL(window.location.href);
    const next = new URL(href, current);
    return next.origin === current.origin && (next.pathname !== current.pathname || next.search !== current.search);
  };
  const onLink = (event: MouseEvent) => {
    if (!dirty || leaving || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download") || !leavesForm(anchor.href)) return;
    event.preventDefault();
    event.stopPropagation();
    void askToLeave(anchor.href);
  };
  const onNavigation = (event: Event) => {
    if (!dirty || leaving || !isAppNavigationRequestEvent(event) || !leavesForm(event.detail.href)) return;
    event.preventDefault();
    void askToLeave(event.detail.href, () => event.detail.proceed("replace"));
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener(APP_NAVIGATION_REQUEST_EVENT, onNavigation);
  document.addEventListener("click", onLink, true);

  return {
    setDirty(value: boolean) {
      dirty = value && !leaving;
      if (leaving) return;
      if (dirty && !guarded) arm();
      else if (!dirty && guarded && !pendingExit) {
        pendingExit = { href: null };
        window.history.back();
      }
    },
    navigateAfterSave: leave,
    destroy() {
      destroyed = true;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener(APP_NAVIGATION_REQUEST_EVENT, onNavigation);
      document.removeEventListener("click", onLink, true);
    },
  };
}

/** กันฟอร์มที่ยังไม่บันทึกจากลิงก์ เมนูแอป ปุ่ม Back และการปิด/รีโหลดแท็บ */
export function useUnsavedChanges(dirty: boolean, options?: UnsavedChangesOptions) {
  const router = useRouter();
  const confirm = useConfirm();
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);
  const guard = useRef<ReturnType<typeof createUnsavedChangesGuard> | null>(null);
  useEffect(() => {
    guard.current = createUnsavedChangesGuard({
      replace: (href) => router.replace(href),
      confirmDiscard: () => confirm({
        title: optionsRef.current?.title ?? "ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?",
        description: optionsRef.current?.description ?? "ข้อมูลที่แก้ในฟอร์มจะหาย หากออกจากหน้านี้",
        confirmText: optionsRef.current?.confirmText ?? "ทิ้งการแก้ไข",
        cancelText: optionsRef.current?.cancelText ?? "กลับไปแก้ต่อ",
        destructive: true,
      }),
    });
    return () => { guard.current?.destroy(); guard.current = null; };
  }, [confirm, router]);
  useEffect(() => { guard.current?.setDirty(dirty); }, [confirm, dirty, router]);
  const navigateAfterSave = useCallback((href: string) => {
    if (guard.current) guard.current.navigateAfterSave(href);
    else router.replace(href);
  }, [router]);
  return { navigateAfterSave };
}
