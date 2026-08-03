"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  // จำสถานะย่อ/กางข้าม refresh — init false เสมอกัน hydration mismatch แล้วอ่านหลัง mount
  useEffect(() => {
    // rAF เลื่อน setState พ้น effect body — กัน cascading render (กติกา lint เดียวกับที่อื่น)
    if (localStorage.getItem("sidebar-collapsed") !== "1") return;
    const raf = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", prev ? "0" : "1");
      return !prev;
    });
  };
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
          ? "flex h-full w-full bg-chrome"
          : cn(
              // Light เป็นขาวทึบบนพื้นหน้าเทา · dark คงกรอบโปร่งและ blur เดิม
              "hidden h-screen border-r border-black/[0.07] bg-chrome md:flex dark:border-white/[0.07] dark:bg-chrome/90 dark:backdrop-blur-xl",
              collapsed ? "w-[68px]" : "w-64"
            )
      )}
    >
      {/* หัวแถบเมนู — ตอนย่อเหลือกว้าง 68px แต่ของข้างในกินรวม 112px
          (ขอบ 28 + โลโก้ 40 + ช่องไฟ 8 + ปุ่ม 36) โลโก้กับปุ่มจึงเบียดทับกัน
          (เบสเจอเอง 2026-08-02) → ตอนย่อเหลือปุ่มกางตรงกลางอย่างเดียว ซ่อนโลโก้
          (เคยลองให้โลโก้สลับเป็นไอคอนกางตอนเอาเมาส์ชี้ — ทดสอบแล้วไม่สลับจริง
          และถึงสลับได้ก็เดาไม่ออกอยู่ดีว่ากดโลโก้แล้วกางได้ · ตอนย่อคนต้องการพื้นที่
          ไม่ใช่โลโก้ — VS Code/Linear ก็ไม่โชว์โลโก้ตอนย่อ) */}
      <div
        className={cn(
          "flex h-14 items-center gap-2",
          collapsed && !mobile ? "justify-center px-2" : "justify-between px-3.5"
        )}
      >
        {collapsed && !mobile ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            title="ขยายแถบเมนู"
            aria-label="ขยายแถบเมนู"
            className="h-9 w-9 shrink-0 text-muted hover:bg-black/5 hover:text-secondary dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <PanelLeftOpen />
          </Button>
        ) : (
          <>
            <Link
              href="/home"
              onClick={onNavigate}
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Printer className="h-4 w-4" />
              </div>
              <span className="truncate text-base font-semibold text-slate-900 dark:text-white">
                Anajak Print
              </span>
            </Link>
            {!mobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={toggleCollapsed}
                title="ย่อแถบเมนู"
                aria-label="ย่อแถบเมนู"
                className="h-9 w-9 shrink-0 text-slate-400 hover:bg-black/5 hover:text-secondary dark:hover:bg-white/5 dark:hover:text-slate-200"
              >
                <PanelLeftClose />
              </Button>
            )}
          </>
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
                      title={
                        collapsed
                          ? badgeFor(item.href) !== undefined
                            ? `${item.label} — ค้าง ${badgeFor(item.href)} งาน`
                            : item.label
                          : undefined
                      }
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                        mobile ? "min-h-11" : "min-h-10",
                        // เมนูที่เปิดอยู่ = เทาอ่อน (เดิมเป็น "ขาวบนพื้นเทา" — พอพื้นเป็นขาว
                        // ก็หายไปทั้งอัน มองไม่ออกว่าตอนนี้อยู่หน้าไหน)
                        active
                          ? "bg-slate-200/70 text-slate-900 dark:bg-white/10 dark:text-white"
                          : "text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                      )}
                    >
                      {/* ย่อแล้วเลขงานค้างต้องไม่หายทั้งก้อน — จุดแดงบนไอคอน
                          (สูตรเดียวกับกระดิ่ง topbar) + จำนวนเต็มอยู่ใน title */}
                      <span className="relative shrink-0">
                        <item.icon
                          className={cn(
                            "h-[17px] w-[17px]",
                            active
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-500 dark:text-slate-500"
                          )}
                          strokeWidth={1.75}
                        />
                        {collapsed && badgeFor(item.href) !== undefined && (
                          <span
                            aria-hidden="true"
                            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-chrome"
                          />
                        )}
                      </span>
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
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
            >
              {me.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-white p-3 hairline-ring dark:bg-white/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {me.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
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
