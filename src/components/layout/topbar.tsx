"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, CheckCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import { MobileSidebar } from "./mobile-sidebar";

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "เมื่อสักครู่";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} สัปดาห์ที่แล้ว`;
  const months = Math.floor(days / 30);
  return `${months} เดือนที่แล้ว`;
}

export function Topbar() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  // Cmd/Ctrl + K → open palette
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const { data: notifData } = trpc.notification.list.useQuery(
    { limit: 5 },
    { enabled: notifOpen },
  );

  const utils = trpc.useUtils();
  const markAllRead = useMutationWithInvalidation(trpc.notification.markAllRead, {
    invalidate: [utils.notification.unreadCount, utils.notification.list],
  });
  const markRead = useMutationWithInvalidation(trpc.notification.markRead, {
    invalidate: [utils.notification.unreadCount, utils.notification.list],
  });

  const count = unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-black/[0.07] bg-[#f5f5f7]/72 px-5 backdrop-blur-xl sm:px-8 lg:px-10 dark:border-white/[0.06] dark:bg-black/60">
      {/* เมนูมือถือ — จอเล็ก sidebar ซ่อน เปิดผ่าน hamburger */}
      <MobileSidebar />
      {/* Search trigger (opens command palette) */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-full bg-white/70 px-4 text-sm text-slate-400 shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)] transition-colors hover:bg-white hover:text-slate-600 dark:bg-white/[0.06] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.08)] dark:hover:bg-white/10"
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 text-left">ค้นหาเมนู หรือคำสั่ง</span>
        <kbd className="hidden items-center gap-0.5 rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline-flex dark:bg-white/10 dark:text-slate-400">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* เปิดงานใหม่ — ทางลัดเปิดออเดอร์จากทุกหน้า (แนวภาพ A) */}
        <Link
          href="/orders/new"
          className="hidden items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.97] sm:inline-flex"
        >
          <Plus className="h-4 w-4" strokeWidth={2.1} />
          เปิดงานใหม่
        </Link>
        <Link
          href="/orders/new"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-transform hover:bg-blue-700 active:scale-95 sm:hidden"
          aria-label="เปิดงานใหม่"
        >
          <Plus className="h-5 w-5" strokeWidth={2.1} />
        </Link>

        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label="การแจ้งเตือน"
          >
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950" />
            )}
          </Button>

          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] sm:w-96 dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  การแจ้งเตือน
                  {count > 0 && (
                    <span className="ml-2 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10.5px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </h3>
                {count > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 dark:text-slate-400 dark:hover:text-blue-400"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    อ่านทั้งหมด
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifData?.notifications && notifData.notifications.length > 0 ? (
                  notifData.notifications.map((notif) => (
                    // กดแจ้งเตือน → ติ๊กอ่าน + เด้งไปหน้างานจริงตาม link (เช่น /orders/xxx)
                    <Link
                      key={notif.id}
                      href={notif.link ?? "/notifications"}
                      onClick={() => {
                        if (!notif.isRead) markRead.mutate({ id: notif.id });
                        setNotifOpen(false);
                      }}
                      className={`flex gap-2.5 border-b border-slate-50 px-3.5 py-2.5 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/50 ${
                        !notif.isRead
                          ? "bg-blue-50/40 dark:bg-blue-950/20"
                          : ""
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          !notif.isRead ? "bg-blue-500" : "bg-transparent"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {notif.title}
                        </p>
                        {notif.message && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                            {notif.message}
                          </p>
                        )}
                        <p className="mt-1 text-[10.5px] text-slate-400 dark:text-slate-500">
                          {timeAgo(notif.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    ยังไม่มีการแจ้งเตือน
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block px-3.5 py-2 text-center text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-blue-400"
                >
                  ดูทั้งหมด
                </Link>
              </div>
            </div>
          )}
        </div>

        <UserMenu />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
