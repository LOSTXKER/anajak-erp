"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  MoreHorizontal,
  Printer,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  findActiveNavigationItem,
  groupedNavigationItems,
  navigationItemsForSurface,
  type NavigationItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONTROL_H, CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON, FOCUS_INSET, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { CommandPalette } from "@/components/layout/command-palette";
import { UserMenu } from "@/components/layout/user-menu";

type AppNavItem = Pick<NavigationItem, "id" | "label" | "href" | "icon">;

const PRIMARY_NAV_IDS = ["dashboard", "my-tasks", "orders", "production", "customers"] as const;
const MOBILE_NAV_IDS = ["dashboard", "my-tasks", "orders", "production"] as const;
const PRIMARY_NAV_ID_SET = new Set<string>(PRIMARY_NAV_IDS);
const MOBILE_EXCLUDED_IDS = new Set<string>(MOBILE_NAV_IDS);

function MoreMenu({
  open,
  permissions,
  user,
  activeNavigationId,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  permissions?: readonly string[];
  user?: { name: string; role: string };
  activeNavigationId?: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const groups = groupedNavigationItems("sidebar", permissions)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !MOBILE_EXCLUDED_IDS.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        className="bottom-0 left-0 right-0 top-auto max-h-[82dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-b-none p-0 pr-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:p-0 sm:pr-0"
      >
        <DialogHeader className="border-b border-slate-200 px-5 pb-4 pt-5 pr-14 text-left dark:border-white/10">
          <DialogTitle>พื้นที่ทำงานทั้งหมด</DialogTitle>
          <DialogDescription className={user ? undefined : "sr-only"}>
            {user
              ? `${user.name} · ${ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}`
              : "เมนูเพิ่มเติม"}
          </DialogDescription>
        </DialogHeader>

        <nav aria-label="เมนูเพิ่มเติม" className="min-h-0 overflow-y-auto px-3 py-3">
          {groups.map((group) => (
            <div key={group.id} className="mb-4 last:mb-0">
              {group.label && (
                <p className="px-3 pb-2 text-xs font-medium text-muted">{group.label}</p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={activeNavigationId === item.id ? "page" : undefined}
                      className={cn(
                        CONTROL_MIN_H,
                        FOCUS_INSET,
                        RADIUS.item,
                        "group flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                        activeNavigationId === item.id
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          : "text-secondary hover:bg-slate-100 hover:text-strong dark:hover:bg-white/[0.06]",
                      )}
                    >
                      <item.icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

      </DialogContent>
    </Dialog>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const { data: me } = trpc.user.me.useQuery();
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const primaryItems = useMemo(() => {
    const visible = navigationItemsForSurface("sidebar", me?.permissions);
    const byId = new Map(visible.map((item) => [item.id, item]));
    return PRIMARY_NAV_IDS.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [me?.permissions]);

  const mobileItems = useMemo(() => {
    const byId = new Map(primaryItems.map((item) => [item.id, item]));
    return MOBILE_NAV_IDS.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [primaryItems]);

  const secondaryGroups = useMemo(
    () =>
      groupedNavigationItems("sidebar", me?.permissions)
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !PRIMARY_NAV_ID_SET.has(item.id)),
        }))
        .filter((group) => group.items.length > 0),
    [me?.permissions],
  );

  const closeMoreMenu = () => {
    setMoreOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => moreTriggerRef.current?.focus());
    });
  };

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

  const count = unreadCount ?? 0;
  const activeNavigationId = findActiveNavigationItem(pathname)?.id;
  const secondaryActive = secondaryGroups.some((group) =>
    group.items.some((item) => item.id === activeNavigationId),
  );
  const mobileMoreActive = groupedNavigationItems("sidebar", me?.permissions).some(
    (group) =>
      group.items.some(
        (item) =>
          !MOBILE_EXCLUDED_IDS.has(item.id) && item.id === activeNavigationId,
      ),
  );
  const [allMenuOpen, setAllMenuOpen] = useState(false);

  return (
    <div
      className="flex h-dvh overflow-hidden bg-bg"
      style={
        {
          "--app-bottom-nav-offset":
            "calc(5rem + env(safe-area-inset-bottom))",
        } as CSSProperties
      }
    >
      <a
        href="#main-content"
        className={cn(
          CONTROL_MIN_H,
          FOCUS_BUTTON,
          RADIUS.inner,
          "fixed left-4 top-4 z-[100] inline-flex -translate-y-24 items-center bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0 dark:bg-white dark:text-slate-950",
        )}
      >
        ข้ามไปเนื้อหาหลัก
      </a>

      <aside className="hidden h-full w-60 shrink-0 border-r border-black/[0.07] bg-chrome lg:block dark:border-white/[0.07]">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 px-5">
            <div
              className={cn(
                RADIUS.inner,
                "flex h-9 w-9 items-center justify-center bg-blue-600 text-white",
              )}
            >
              <Printer className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-strong">Anajak Print</p>
            </div>
          </div>

          <nav aria-label="เมนูหลัก" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {primaryItems.map((item: AppNavItem) => {
                const active = activeNavigationId === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        CONTROL_MIN_H,
                        FOCUS_BUTTON,
                        RADIUS.inner,
                        "group flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          : "text-secondary hover:bg-slate-100 hover:text-strong dark:hover:bg-white/[0.06]",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px]",
                          active
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-muted",
                        )}
                        strokeWidth={1.75}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="my-5 h-px bg-slate-200 dark:bg-white/10" />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className={cn(
                CONTROL_H,
                FOCUS_BUTTON,
                RADIUS.pill,
                SUNK_PANEL,
                "flex w-full items-center gap-2 px-3 text-left text-sm text-muted transition-colors hover:text-strong",
              )}
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">ค้นหาทั้งระบบ</span>
              <kbd className="text-2xs">⌘K</kbd>
            </button>

            <details
              className="group mt-3"
              open={secondaryActive || allMenuOpen}
              onToggle={(event) => {
                if (!secondaryActive) setAllMenuOpen(event.currentTarget.open);
              }}
            >
              <summary
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_BUTTON,
                  RADIUS.inner,
                  "flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden",
                  secondaryActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    : "text-secondary hover:bg-slate-100 hover:text-strong dark:hover:bg-white/[0.06]",
                )}
              >
                <MoreHorizontal className="h-[18px] w-[18px] text-muted" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">เมนูทั้งหมด</span>
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-3 space-y-4 border-t border-slate-200 pt-3 dark:border-white/10">
                {secondaryGroups.map((group) => (
                  <div key={group.id}>
                    {group.label && (
                      <p className="px-3 pb-1.5 text-2xs font-medium text-muted">{group.label}</p>
                    )}
                    <ul className="space-y-1">
                      {group.items.map((item) => {
                        const active = activeNavigationId === item.id;
                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                CONTROL_MIN_H,
                                FOCUS_BUTTON,
                                RADIUS.inner,
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                                active
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                  : "text-secondary hover:bg-slate-100 hover:text-strong dark:hover:bg-white/[0.06]",
                              )}
                            >
                              <item.icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-black/[0.07] bg-chrome px-3 sm:px-5 dark:border-white/[0.07]">
          <Link href="/" className={cn(FOCUS_BUTTON, RADIUS.inner, "flex h-11 w-11 shrink-0 items-center justify-center bg-blue-600 text-white lg:hidden")} aria-label="ภาพรวม">
            <Printer className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="ค้นหาเมนู ออเดอร์ ลูกค้า ใบเสนอราคา หรือบิล"
            aria-haspopup="dialog"
            className={cn(
              CONTROL_H,
              FOCUS_BUTTON,
              RADIUS.pill,
              SUNK_PANEL,
              "group flex min-w-0 flex-1 items-center gap-2 px-3 text-sm text-muted transition-colors hover:text-strong sm:max-w-lg sm:px-4",
            )}
          >
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-left">ค้นหาเลขงาน ลูกค้า หรือเมนู</span>
            <kbd className="hidden text-2xs sm:inline">⌘K</kbd>
          </button>

          <Button asChild variant="ghost" size="icon" className="relative shrink-0">
            <Link
              href="/notifications"
              aria-label={count > 0 ? `การแจ้งเตือน ยังไม่อ่าน ${count} รายการ` : "การแจ้งเตือน"}
            >
              <Bell />
              {count > 0 && (
                <span className="absolute right-0 top-0 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-2xs font-semibold text-white ring-2 ring-chrome">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          </Button>
          <UserMenu />
        </header>

        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-screen-2xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
            {children}
          </div>
        </main>
      </div>

      <nav
        aria-label="เมนูหลักบนมือถือ"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.07] bg-chrome px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1 lg:hidden dark:border-white/[0.07]"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {mobileItems.map((item) => {
            const active = activeNavigationId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_INSET,
                  RADIUS.item,
                  "flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-medium",
                  active ? "text-blue-700 dark:text-blue-300" : "text-muted",
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            ref={moreTriggerRef}
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              CONTROL_MIN_H,
              FOCUS_INSET,
              RADIUS.item,
              "flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs font-medium",
              mobileMoreActive ? "text-blue-700 dark:text-blue-300" : "text-muted",
            )}
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
            <span>เพิ่มเติม</span>
          </button>
        </div>
      </nav>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        returnFocusRef={searchTriggerRef}
      />
      <MoreMenu
        open={moreOpen}
        permissions={me?.permissions}
        user={me ? { name: me.name, role: me.role } : undefined}
        activeNavigationId={activeNavigationId}
        onClose={closeMoreMenu}
        returnFocusRef={moreTriggerRef}
      />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className="h-dvh bg-bg"
          role="status"
          aria-label="กำลังโหลดพื้นที่ทำงาน"
        />
      }
    >
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}
