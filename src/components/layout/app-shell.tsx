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
import {
  FOCUS_BUTTON,
  FOCUS_INSET,
  INTERACTIVE_CHROME_HOVER,
  INTERACTIVE_CHROME_PRESSED,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  RADIUS,
} from "@/components/ui/tokens";
import { CommandPalette } from "@/components/layout/command-palette";
import { UserMenu } from "@/components/layout/user-menu";

const MOBILE_NAV_IDS = ["dashboard", "my-tasks", "orders", "production"] as const;
const MOBILE_EXCLUDED_IDS = new Set<string>(MOBILE_NAV_IDS);

function sidebarNavItemClass({
  active,
  onChrome = false,
}: {
  active: boolean;
  onChrome?: boolean;
}) {
  return cn(
    CONTROL_MIN_H,
    FOCUS_INSET,
    RADIUS.item,
    "group/sidebar-item flex scroll-m-4 items-center gap-3 px-3 py-2 text-sm transition-colors",
    active
      ? "bg-interactive-selected font-medium text-interactive-selected-text"
      : cn(
          "font-normal",
          "text-secondary",
          onChrome ? INTERACTIVE_CHROME_HOVER : INTERACTIVE_HOVER,
          onChrome ? INTERACTIVE_CHROME_PRESSED : INTERACTIVE_PRESSED,
        ),
  );
}

function SidebarGroupLabel({
  label,
}: {
  label: string | null;
}) {
  if (!label) return null;

  return (
    <p className="px-3 pb-1.5 text-2xs font-medium text-muted">{label}</p>
  );
}

function sidebarNavIconClass(active: boolean) {
  return active
    ? "text-interactive-selected-text"
    : "text-muted group-hover/sidebar-item:text-secondary group-active/sidebar-item:text-strong";
}

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
        <DialogHeader className="border-b border-divider px-5 pb-4 pt-5 pr-14 text-left">
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
              <SidebarGroupLabel
                label={group.label}
              />
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={activeNavigationId === item.id ? "page" : undefined}
                      className={sidebarNavItemClass({
                        active: activeNavigationId === item.id,
                      })}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4",
                          sidebarNavIconClass(activeNavigationId === item.id),
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform group-hover/sidebar-item:translate-x-0.5",
                          sidebarNavIconClass(activeNavigationId === item.id),
                        )}
                      />
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
  const activeSidebarRef = useRef<HTMLAnchorElement>(null);
  const { data: me } = trpc.user.me.useQuery();
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const sidebarGroups = useMemo(
    () => groupedNavigationItems("sidebar", me?.permissions),
    [me?.permissions],
  );

  const mobileItems = useMemo(() => {
    const byId = new Map(
      sidebarGroups.flatMap((group) => group.items).map((item) => [item.id, item]),
    );
    return MOBILE_NAV_IDS.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [sidebarGroups]);

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
  const mobileMoreActive = sidebarGroups.some(
    (group) =>
      group.items.some(
        (item) =>
          !MOBILE_EXCLUDED_IDS.has(item.id) && item.id === activeNavigationId,
      ),
  );

  useEffect(() => {
    let positionFrame = 0;
    const openFrame = requestAnimationFrame(() => {
      positionFrame = requestAnimationFrame(() => {
        activeSidebarRef.current?.scrollIntoView({ block: "nearest" });
      });
    });
    return () => {
      cancelAnimationFrame(openFrame);
      cancelAnimationFrame(positionFrame);
    };
  }, [activeNavigationId, sidebarGroups]);

  return (
    <div
      className="app-workspace grid h-dvh grid-cols-1 grid-rows-[4rem_minmax(0,1fr)] overflow-hidden bg-bg lg:grid-cols-[15rem_minmax(0,1fr)]"
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

      <header className="relative z-30 col-span-full row-start-1 flex h-16 min-w-0 items-center border-b border-divider bg-chrome">
        <Link
          href="/"
          aria-label="ภาพรวม"
          className={cn(
            FOCUS_BUTTON,
            "flex h-full w-16 shrink-0 items-center justify-center lg:w-60 lg:justify-start lg:gap-3 lg:border-r lg:border-divider lg:px-5",
          )}
        >
          <div
            className={cn(
              RADIUS.inner,
              "flex h-9 w-9 items-center justify-center bg-blue-600 text-white",
            )}
          >
            <Printer className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <span className="hidden truncate text-sm font-semibold text-strong lg:block">
            Anajak Print
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:px-5">
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="ค้นหาเมนู ออเดอร์ ลูกค้า ใบเสนอราคา หรือบิล"
            aria-haspopup="dialog"
            className={cn(
              CONTROL_H,
              FOCUS_BUTTON,
              RADIUS.field,
              // chrome เป็นเทาอ่อนแล้ว (UI-2026 เฟส 1) — ถ้ายังใช้ SUNK_PANEL
              // พื้นช่องจะเกือบเท่าพื้นแถบจนมองไม่เห็นว่าเป็นช่องค้นหา
              "border border-border bg-surface",
              INTERACTIVE_HOVER,
              INTERACTIVE_PRESSED,
              "group flex min-w-0 flex-1 items-center gap-2 px-3 text-sm text-muted transition-colors sm:max-w-lg sm:px-4",
            )}
          >
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-left">ค้นหาเลขงาน ลูกค้า หรือเมนู</span>
            <kbd className="hidden text-2xs sm:inline">⌘K</kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* ปุ่มบนแถบบนยืนบน chrome (เทา) ไม่ใช่ surface (ขาว) — hover ชุดปกติ
                จึงเกือบเท่าพื้นตัวเอง ต้องใช้ชุด chrome ที่เข้มกว่าหนึ่งขั้น */}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={cn(INTERACTIVE_CHROME_HOVER, INTERACTIVE_CHROME_PRESSED, "relative shrink-0")}
            >
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
          </div>
        </div>
      </header>

      <aside className="hidden min-h-0 border-r border-divider bg-chrome lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col">
        <nav aria-label="เมนูหลัก" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-4">
            {sidebarGroups.map((group) => (
              <div key={group.id}>
                <SidebarGroupLabel label={group.label} />
                <ul aria-label={group.label ?? undefined} className="space-y-1">
                  {group.items.map((item) => {
                    const active = activeNavigationId === item.id;
                    return (
                      <li key={item.id}>
                        <Link
                          ref={active ? activeSidebarRef : undefined}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={sidebarNavItemClass({ active, onChrome: true })}
                        >
                          <item.icon
                            className={cn("h-4 w-4", sidebarNavIconClass(active))}
                            strokeWidth={1.75}
                          />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative col-start-1 row-start-2 min-h-0 min-w-0 overflow-y-auto outline-none lg:col-start-2"
      >
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-[calc(var(--app-bottom-nav-offset)+2rem)] pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
          {children}
        </div>
      </main>

      <nav
        aria-label="เมนูหลักบนมือถือ"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-chrome px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1 lg:hidden"
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
                  INTERACTIVE_CHROME_PRESSED,
                  "flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs transition-colors",
                  active
                    ? "font-semibold text-interactive-selected-text"
                    : "font-medium text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 min-w-10 items-center justify-center",
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                </span>
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
            aria-current={mobileMoreActive ? "page" : undefined}
            className={cn(
              CONTROL_MIN_H,
              FOCUS_INSET,
              RADIUS.item,
              INTERACTIVE_CHROME_PRESSED,
                  "flex flex-col items-center justify-center gap-1 px-1 py-2 text-2xs transition-colors",
              mobileMoreActive
                ? "font-semibold text-interactive-selected-text"
                : "font-medium text-muted",
            )}
          >
            <span
              className={cn(
                "flex h-6 min-w-10 items-center justify-center",
              )}
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
            </span>
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
          className="app-workspace h-dvh bg-bg"
          role="status"
          aria-label="กำลังโหลดพื้นที่ทำงาน"
        />
      }
    >
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}
