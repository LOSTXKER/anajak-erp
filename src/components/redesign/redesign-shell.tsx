"use client";

import type { ReactNode, RefObject } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Menu,
  Plus,
  Printer,
  Search,
  X,
} from "lucide-react";
import { CommandPalette } from "@/components/layout/command-palette";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONTROL_H, CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  FOCUS_BUTTON,
  FOCUS_INSET,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  INTERACTIVE_SELECTED,
} from "@/components/ui/tokens";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import {
  findActiveNavigationItem,
  groupedNavigationItems,
  navigationItemsForSurface,
  type NavigationGroupId,
  type NavigationItem,
} from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<NavigationGroupId, string> = {
  main: "วันนี้",
  sales: "งานขาย",
  production: "ปฏิบัติการ",
  finance: "การเงิน",
  products: "ทรัพยากร",
  system: "ระบบ",
};

const GROUP_ORDER: readonly NavigationGroupId[] = [
  "main",
  "sales",
  "production",
  "finance",
  "products",
  "system",
];

const MOBILE_NAV_IDS = [
  "dashboard",
  "my-tasks",
  "orders",
  "production",
] as const;

function navItemClass(active: boolean) {
  return cn(
    CONTROL_MIN_H,
    FOCUS_BUTTON,
    "redesign-nav-item group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
    active
      ? cn("font-semibold", INTERACTIVE_SELECTED)
      : cn("text-secondary", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
  );
}

function ShellNavigation({
  groups,
  activeNavigationId,
  onNavigate,
}: {
  groups: ReturnType<typeof groupedNavigationItems>;
  activeNavigationId?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="พื้นที่ทำงาน">
      {groups.map((group) => (
        <section key={group.id} className="redesign-nav-group mb-5 last:mb-0">
          <h2 className="redesign-nav-label px-3 pb-1.5 text-2xs font-semibold tracking-widest text-slate-400 dark:text-slate-500">
            {GROUP_LABELS[group.id]}
          </h2>
          <ul className="redesign-nav-list space-y-0.5">
            {group.items.map((item) => {
              const active = item.id === activeNavigationId;
              return (
                <li key={item.id}>
                  <Link
                    href={item.id === "dashboard" ? "/redesign" : item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={navItemClass(active)}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200",
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
                    {active && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-blue-600"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function MobileNavigationSheet({
  open,
  onOpenChange,
  groups,
  activeNavigationId,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ReturnType<typeof groupedNavigationItems>;
  activeNavigationId?: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        className="redesign-mobile-sheet bottom-0 left-0 right-0 top-auto w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-b-none rounded-t-2xl border-slate-200 bg-white p-0 pr-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom dark:border-slate-800 dark:bg-slate-950 sm:p-0 sm:pr-0 lg:hidden"
      >
        <DialogHeader className="redesign-mobile-sheet-header border-b border-slate-200 px-5 pb-4 pt-5 pr-14 text-left dark:border-slate-800">
          <DialogTitle className="text-lg text-slate-950 dark:text-white">
            พื้นที่ทำงานทั้งหมด
          </DialogTitle>
          <DialogDescription>เมนูจริงตามสิทธิ์ของคุณ</DialogDescription>
        </DialogHeader>
        <div className="redesign-mobile-sheet-body min-h-0 overflow-y-auto px-3 pb-6 pt-4">
          <ShellNavigation
            groups={groups}
            activeNavigationId={activeNavigationId}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RedesignShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const meQuery = trpc.user.me.useQuery();
  const unreadQuery = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const groups = useMemo(() => {
    const source = groupedNavigationItems("sidebar", meQuery.data?.permissions);
    return [...source].sort(
      (a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id),
    );
  }, [meQuery.data?.permissions]);

  const mobileItems = useMemo(() => {
    const visible = navigationItemsForSurface(
      "sidebar",
      meQuery.data?.permissions,
    );
    const byId = new Map(visible.map((item) => [item.id, item]));
    return MOBILE_NAV_IDS.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [meQuery.data?.permissions]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const me = meQuery.data;
  const unreadCount = unreadQuery.data ?? 0;
  const activeNavigationId =
    pathname === "/redesign"
      ? "dashboard"
      : pathname.startsWith("/redesign/orders/")
        ? "orders"
      : findActiveNavigationItem(pathname)?.id;
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);

  return (
    <div className="redesign-shell grid h-dvh grid-cols-1 overflow-hidden bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <a
        href="#redesign-main"
        className={cn(
          FOCUS_BUTTON,
          "redesign-skip-link fixed left-4 top-3 z-50 -translate-y-24 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-800 transition-transform focus:translate-y-0",
        )}
      >
        ข้ามไปเนื้อหาหลัก
      </a>

      <header className="redesign-topbar relative z-30 col-span-full row-start-1 flex h-16 min-w-0 items-center bg-blue-600 text-white">
        <Link
          href="/"
          aria-label="กลับไประบบหลัก"
          className={cn(
            FOCUS_INSET,
            "redesign-brand flex h-full w-16 shrink-0 items-center justify-center gap-3 border-white/15 sm:w-auto sm:px-4 lg:w-64 lg:justify-start lg:border-r lg:px-5",
          )}
        >
          <span className="redesign-brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/10">
            <Printer className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="redesign-brand-copy hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-semibold leading-4">
              Anajak ERP
            </span>
            <span className="block truncate text-2xs leading-4 text-blue-100">
              ศูนย์ปฏิบัติการ
            </span>
          </span>
        </Link>

        <div className="redesign-topbar-actions flex min-w-0 flex-1 items-center gap-1.5 px-2 sm:gap-2 sm:px-4 lg:px-5">
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="ค้นหาเลขงาน ลูกค้า เอกสาร หรือเมนู"
            aria-haspopup="dialog"
            className={cn(
              CONTROL_H,
              FOCUS_BUTTON,
              "redesign-search flex min-w-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-0 text-sm text-white transition-colors sm:min-w-0 sm:flex-1 sm:justify-start sm:px-3 lg:max-w-xl",
            )}
          >
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="hidden min-w-0 flex-1 truncate text-left text-blue-50 sm:block">
              ค้นหาเลขงาน ลูกค้า หรือเอกสาร
            </span>
            <kbd className="hidden rounded border border-white/20 px-1.5 py-0.5 text-2xs text-blue-100 md:inline">
              ⌘K
            </kbd>
          </button>

          <div className="redesign-topbar-utilities ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {canCreateOrder && (
              <Link
                href="/orders/new"
                className={cn(
                  CONTROL_H,
                  FOCUS_BUTTON,
                  INTERACTIVE_HOVER,
                  INTERACTIVE_PRESSED,
                  "redesign-create-order hidden items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-blue-800 transition-colors hover:text-blue-800 active:text-blue-800 dark:hover:text-blue-800 dark:active:text-blue-800 md:inline-flex",
                )}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                เปิดงานใหม่
              </Link>
            )}

            <Link
              href="/notifications"
              aria-label={
                unreadCount > 0
                  ? `การแจ้งเตือน ยังไม่อ่าน ${unreadCount} รายการ`
                  : "การแจ้งเตือน"
              }
              className={cn(
                CONTROL_H,
                FOCUS_INSET,
                "redesign-notifications relative flex w-11 items-center justify-center rounded-lg transition-colors sm:w-9",
              )}
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-2xs font-bold text-white ring-2 ring-blue-600 sm:-right-1 sm:-top-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            <div className="redesign-user-menu rounded-full bg-white p-0.5 shadow-sm">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <aside className="redesign-sidebar hidden min-h-0 border-r border-slate-200 bg-white lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col dark:border-slate-800 dark:bg-slate-950">
        <div className="redesign-sidebar-context border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-950 dark:text-white">
                {me?.name ?? "กำลังโหลด..."}
              </p>
              <p className="mt-0.5 truncate text-2xs text-slate-500 dark:text-slate-400">
                {me?.role ? ROLE_LABELS[me.role] : "พื้นที่ปฏิบัติการ"}
              </p>
            </div>
            <span className="redesign-live-indicator flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-green-700 dark:text-green-400">
              <span
                className="h-1.5 w-1.5 rounded-full bg-green-500"
                aria-hidden="true"
              />
              Live
            </span>
          </div>
        </div>

        <div className="redesign-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <ShellNavigation
            groups={groups}
            activeNavigationId={activeNavigationId}
          />
        </div>

        <div className="redesign-sidebar-footer border-t border-slate-200 p-3 dark:border-slate-800">
          <Link
            href="/"
            className={cn(
              CONTROL_MIN_H,
              FOCUS_BUTTON,
              INTERACTIVE_HOVER,
              INTERACTIVE_PRESSED,
              "redesign-back-link flex items-center gap-3 rounded-lg px-3 text-sm font-medium text-secondary transition-colors",
            )}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            <span className="flex-1">กลับหน้าระบบหลัก</span>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </aside>

      <main
        id="redesign-main"
        tabIndex={-1}
        className="redesign-main relative col-start-1 row-start-2 min-h-0 min-w-0 overflow-y-auto bg-slate-100 outline-none dark:bg-slate-900 lg:col-start-2"
      >
        <div className="redesign-content mx-auto w-full max-w-screen-2xl px-3 pb-28 pt-4 sm:px-5 sm:pt-6 lg:px-7 lg:pb-8 lg:pt-7">
          {children}
        </div>
      </main>

      <nav
        aria-label="เมนูหลักบนมือถือ"
        className="redesign-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-1 pb-1 pt-1 dark:border-slate-800 dark:bg-slate-950 lg:hidden"
      >
        <div
          className="redesign-bottom-nav-grid grid"
          style={{
            gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {mobileItems.map((item: NavigationItem) => {
            const active = activeNavigationId === item.id;
            return (
              <Link
                key={item.id}
                href={item.id === "dashboard" ? "/redesign" : item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_INSET,
                  "redesign-bottom-nav-item flex min-w-11 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-2xs font-medium transition-colors",
                  active
                    ? INTERACTIVE_SELECTED
                    : cn("text-muted", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
                )}
              >
                <item.icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2 : 1.75}
                />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={mobileMenuOpen}
            className={cn(
              CONTROL_MIN_H,
              FOCUS_INSET,
              INTERACTIVE_HOVER,
              INTERACTIVE_PRESSED,
              "redesign-bottom-nav-item flex min-w-11 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-2xs font-medium text-muted transition-colors",
            )}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            )}
            <span>ทั้งหมด</span>
          </button>
        </div>
      </nav>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        returnFocusRef={searchTriggerRef}
      />
      <MobileNavigationSheet
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        groups={groups}
        activeNavigationId={activeNavigationId}
        triggerRef={mobileMenuTriggerRef}
      />
    </div>
  );
}

export function RedesignShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className="redesign-shell-loading h-dvh bg-slate-100 dark:bg-slate-950"
          role="status"
          aria-label="กำลังโหลดพื้นที่ทำงานต้นแบบ"
        />
      }
    >
      <RedesignShellContent>{children}</RedesignShellContent>
    </Suspense>
  );
}
