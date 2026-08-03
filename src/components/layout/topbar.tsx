"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTROL_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON, OVERLAY_PANEL, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
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
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setNotifOpen(false);
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
  const notifQuery = trpc.notification.list.useQuery(
    { limit: 5 },
    { enabled: notifOpen },
  );
  const notifData = notifQuery.data;
  const notifLoading =
    !notifData && (notifQuery.isLoading || notifQuery.isFetching);
  const notifError = !notifData && notifQuery.isError;

  const utils = trpc.useUtils();
  const markAllRead = useMutationWithInvalidation(trpc.notification.markAllRead, {
    invalidate: [utils.notification.unreadCount, utils.notification.list],
  });
  const markRead = useMutationWithInvalidation(trpc.notification.markRead, {
    invalidate: [utils.notification.unreadCount, utils.notification.list],
  });

  const count = unreadCount ?? 0;

  return (
    // Light เป็นขาวทึบบนพื้นหน้าเทา · dark คงความโปร่งและ blur เดิม
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-black/[0.07] bg-chrome px-3 sm:gap-3 sm:px-8 lg:px-10 dark:border-white/[0.07] dark:bg-chrome/90 dark:backdrop-blur-xl">
      {/* เมนูมือถือ — จอเล็ก sidebar ซ่อน เปิดผ่าน hamburger */}
      <MobileSidebar />
      {/* Search trigger (opens command palette) */}
      <button
        ref={searchTriggerRef}
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="ค้นหาเมนู ออเดอร์ ลูกค้า ใบเสนอราคา หรือบิล"
        aria-haspopup="dialog"
        // ความสูงเอาจากของกลาง ไม่เขียนสูตรเอง — ปุ่มนี้ยืนแถวเดียวกับปุ่มแจ้งเตือน/โปรไฟล์
        // (audit 2026-08-01 จับได้ว่าที่นี่ก๊อปสูตร "h-11 … sm:h-9" มาไว้เอง
        //  ด่าน lint ตัวนั้นบังคับเฉพาะ src/components/ui/** จึงลอดมาได้)
        className={cn(
          CONTROL_H,
          RADIUS.pill,
          FOCUS_BUTTON,
          // Navbar ขาว — ช่องค้นหาใช้เทาอ่อนเป็นของที่จมลงไป ให้เห็นว่าตรงนี้กดได้
          "group flex w-full min-w-0 max-w-md items-center gap-2 bg-surface-muted/70 px-3 text-sm text-slate-400 hairline-ring transition-colors hover:bg-surface-muted hover:text-slate-600 sm:px-4 dark:bg-white/[0.06] dark:hover:bg-white/10",
        )}
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 truncate text-left">ค้นหาเมนู เลขงาน ลูกค้า หรือบิล</span>
        <kbd className="hidden items-center gap-0.5 rounded-lg bg-black/[0.05] px-1.5 py-0.5 text-xs font-medium text-slate-500 sm:inline-flex dark:bg-white/10 dark:text-slate-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* ปุ่ม "เปิดงานใหม่" ถูกถอดออกจากแถบบน (เบสสั่ง 2026-08-01) —
            ทุกหน้าที่เปิดออเดอร์ได้มีปุ่มของตัวเองอยู่แล้ว (/orders, แดชบอร์ด, งานของฉัน)
            และยังเปิดจาก ⌘K ได้ · แถบบนเหลือเฉพาะค้นหา/แจ้งเตือน/โปรไฟล์ */}

        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label={count > 0 ? `การแจ้งเตือน ยังไม่อ่าน ${count} รายการ` : "การแจ้งเตือน"}
            aria-expanded={notifOpen}
            aria-haspopup="true"
          >
            <Bell />
            {/* วงแหวนรอบจุดแดงต้องเป็นสีพื้นแถบบน ไม่ใช่ขาว/ดำตายตัว — ไม่งั้นเห็นเป็นวงขาวคาด */}
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-chrome" />
            )}
          </Button>

          {notifOpen && (
            <div className={cn(OVERLAY_PANEL, "fixed left-2 right-2 top-16 z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96")}>
              <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  การแจ้งเตือน
                  {count > 0 && (
                    <Badge variant="accent" size="sm" className="ml-2">
                      {count > 99 ? "99+" : count}
                    </Badge>
                  )}
                </h3>
                {count > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 dark:text-slate-400 dark:hover:text-blue-400"
                  >
                    <CheckCheck />
                    อ่านทั้งหมด
                  </Button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <div
                    role="status"
                    aria-label="กำลังโหลดการแจ้งเตือน"
                    className=""
                  >
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex gap-2 px-3.5 py-3">
                        <Skeleton className="mt-1 h-2 w-2 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-3.5 w-3/5" />
                          <Skeleton className="h-3 w-4/5" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifError ? (
                  <QueryError
                    message="โหลดการแจ้งเตือนไม่สำเร็จ"
                    onRetry={() => void notifQuery.refetch()}
                  />
                ) : notifData && notifData.notifications.length > 0 ? (
                  notifData.notifications.map((notif) => (
                    // กดแจ้งเตือน → ติ๊กอ่าน + เด้งไปหน้างานจริงตาม link (เช่น /orders/xxx)
                    <Link
                      key={notif.id}
                      href={notif.link ?? "/notifications"}
                      onClick={() => {
                        if (!notif.isRead) markRead.mutate({ id: notif.id });
                        setNotifOpen(false);
                      }}
                      className={`flex gap-2 border-b border-slate-50 px-3.5 py-2.5 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/50 ${
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
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        returnFocusRef={searchTriggerRef}
      />
    </header>
  );
}
