"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Moon, Sun, Bell, Search, CheckCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

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
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  // tRPC queries
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const { data: notifData, refetch: refetchNotifs } =
    trpc.notification.list.useQuery(
      { limit: 5 },
      { enabled: notifOpen }
    );

  const utils = trpc.useUtils();
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
      refetchNotifs();
    },
  });

  const count = unreadCount ?? 0;

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input placeholder="ค้นหาออเดอร์, ลูกค้า..." className="pl-9" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setNotifOpen((prev) => !prev)}
          >
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>

          {/* Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  การแจ้งเตือน
                </h3>
                {count > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    ทำเครื่องหมายอ่านทั้งหมด
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-80 overflow-y-auto">
                {notifData?.notifications && notifData.notifications.length > 0 ? (
                  notifData.notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex gap-3 border-b border-slate-50 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/50 ${
                        !notif.readAt
                          ? "bg-blue-50/50 dark:bg-blue-950/20"
                          : ""
                      }`}
                    >
                      {/* Unread dot */}
                      <div className="flex shrink-0 pt-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            !notif.readAt
                              ? "bg-blue-500"
                              : "bg-transparent"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                            {notif.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          {timeAgo(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    ไม่มีการแจ้งเตือน
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                <Link
                  href="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block text-center text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  ดูทั้งหมด
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
          A
        </div>
      </div>
    </header>
  );
}
