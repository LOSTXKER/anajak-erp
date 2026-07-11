"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS } from "@/lib/roles";
import { findActiveNavigationItem, groupedNavigationItems } from "@/lib/navigation";

export function Sidebar({
  mobile = false,
  onNavigate,
}: {
  // โหมด drawer บนมือถือ — พื้นทึบ เต็มสูง ไม่ย่อ (audit ข้อ 30: เดิม sidebar กิน 2/3 จอมือถือ)
  mobile?: boolean;
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: me } = trpc.user.me.useQuery();
  const { data: navBadges } = trpc.task.navBadges.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  // ตัวเลขงานค้างบนเมนู — โชว์เฉพาะที่มีค่า > 0
  const badgeFor = (href: string): number | undefined => {
    const n =
      href === "/production"
        ? navBadges?.production
        : href === "/outsource"
          ? navBadges?.outsource
          : undefined;
    return n && n > 0 ? n : undefined;
  };

  const visibleGroups = groupedNavigationItems("sidebar", me?.permissions);
  const activeItem = findActiveNavigationItem(
    pathname,
    visibleGroups.flatMap((group) => group.items)
  );

  return (
    <aside
      className={cn(
        "flex-col transition-[width] duration-200",
        mobile
          ? "flex h-full w-full bg-[#f5f5f7] dark:bg-slate-950"
          : cn(
              "hidden h-screen border-r border-black/[0.07] bg-[#f5f5f7]/80 backdrop-blur-xl md:flex dark:border-white/[0.06] dark:bg-black/60",
              collapsed ? "w-[68px]" : "w-64"
            )
      )}
    >
      {/* Brand row */}
      <div className="flex h-14 items-center justify-between gap-2 px-3.5">
        <Link
          href="/home"
          onClick={onNavigate}
          className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Printer className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
              Anajak Print
            </span>
          )}
        </Link>
        {!mobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((v) => !v)}
            className="h-9 w-9 shrink-0 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="เมนูหลัก" className="flex-1 overflow-y-auto px-2.5 pb-6 pt-2">
        {visibleGroups.map((group, idx) => (
          <div key={group.id} className={idx === 0 ? "" : "mt-5"}>
            {group.label && !collapsed && (
              <p className="px-3 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeItem?.id === item.id;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors",
                        mobile ? "min-h-11" : "min-h-10",
                        active
                          ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-white/10 dark:text-white"
                          : "text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0",
                          active
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500 dark:text-slate-500"
                        )}
                        strokeWidth={1.75}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {badgeFor(item.href) !== undefined && (
                            <Badge
                              variant={active ? "accent" : "default"}
                              size="sm"
                              className="ml-auto shrink-0 font-semibold tabular-nums"
                            >
                              {badgeFor(item.href)}
                            </Badge>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* การ์ดผู้ใช้ท้ายแถบเมนู (แนวภาพ A) — ย่อเหลือ avatar ตอน collapse */}
      {me && (
        <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
          {collapsed ? (
            <div
              title={me.name ?? undefined}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[12px] font-semibold text-white"
            >
              {me.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-white/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[12px] font-semibold text-white">
                {me.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-slate-900 dark:text-white">
                  {me.name ?? "..."}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {me.role ? ROLE_LABELS[me.role] ?? me.role : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
