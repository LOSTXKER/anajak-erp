export const APP_NAVIGATION_REQUEST_EVENT = "anajak:app-navigation-request";

export type AppNavigationMode = "push" | "replace";

export interface AppNavigationRequestDetail {
  href: string;
  proceed: (mode?: AppNavigationMode) => void;
}

export type AppNavigationRequestEvent =
  CustomEvent<AppNavigationRequestDetail>;

interface AppNavigationRequestOptions {
  push: (href: string) => void;
  replace: (href: string) => void;
  onProceed?: () => void;
  target?: EventTarget;
}

/**
 * จุดขอนำทางกลางสำหรับ control ที่ไม่ได้ render เป็น <a> (เช่น Command Palette)
 * form ที่มีข้อมูลค้างสามารถ preventDefault แบบ synchronous แล้วเรียก proceed ภายหลัง
 * เมื่อผู้ใช้ยืนยันได้ โดย source จะปิดตัวเองเฉพาะตอนนำทางจริงเท่านั้น
 */
export function requestAppNavigation(
  href: string,
  options: AppNavigationRequestOptions,
): boolean {
  let proceeded = false;
  const proceed = (mode: AppNavigationMode = "push") => {
    if (proceeded) return;
    proceeded = true;
    options.onProceed?.();
    if (mode === "replace") options.replace(href);
    else options.push(href);
  };
  const event = new CustomEvent<AppNavigationRequestDetail>(
    APP_NAVIGATION_REQUEST_EVENT,
    {
      cancelable: true,
      detail: { href, proceed },
    },
  );
  const allowed = (options.target ?? window).dispatchEvent(event);
  if (allowed) proceed();
  return allowed;
}

export function isAppNavigationRequestEvent(
  event: Event,
): event is AppNavigationRequestEvent {
  if (event.type !== APP_NAVIGATION_REQUEST_EVENT || !("detail" in event)) {
    return false;
  }
  const detail = (event as CustomEvent<Partial<AppNavigationRequestDetail>>)
    .detail;
  return typeof detail?.href === "string" && typeof detail.proceed === "function";
}
