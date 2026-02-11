"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  CheckCheck,
  Package,
  CreditCard,
  AlertTriangle,
  Info,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ORDER: <Package className="h-5 w-5 text-blue-500" />,
  PAYMENT: <CreditCard className="h-5 w-5 text-green-500" />,
  ALERT: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  INFO: <Info className="h-5 w-5 text-cyan-500" />,
  MESSAGE: <MessageSquare className="h-5 w-5 text-purple-500" />,
};

const FILTER_TABS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "unread", label: "ยังไม่อ่าน" },
] as const;

type FilterValue = (typeof FILTER_TABS)[number]["value"];

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, refetch } = trpc.notification.list.useQuery({
    limit,
    page,
    unreadOnly: filter === "unread" ? true : undefined,
  });

  const utils = trpc.useUtils();

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
      refetch();
    },
  });

  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
      refetch();
    },
  });

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery();

  const notifications = data?.notifications ?? [];
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            การแจ้งเตือน
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ติดตามการแจ้งเตือนทั้งหมดของคุณ
          </p>
        </div>
        {(unreadCount ?? 0) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <CheckCheck className="h-4 w-4" />
            ทำเครื่องหมายอ่านทั้งหมด
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setFilter(tab.value);
              setPage(1);
            }}
            className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
            {tab.value === "unread" && (unreadCount ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-xs">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <Card>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading &&
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}

          {!isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <Bell className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filter === "unread"
                  ? "ไม่มีการแจ้งเตือนที่ยังไม่อ่าน"
                  : "ไม่มีการแจ้งเตือน"}
              </p>
            </div>
          )}

          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => {
                if (!notif.readAt) {
                  markRead.mutate({ id: notif.id });
                }
              }}
              className={`flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                !notif.readAt ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
              }`}
            >
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                {TYPE_ICONS[notif.type] ?? (
                  <Bell className="h-5 w-5 text-slate-400" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`text-sm ${
                      !notif.readAt
                        ? "font-semibold text-slate-900 dark:text-white"
                        : "font-medium text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {notif.title}
                  </p>
                  {/* Unread indicator */}
                  {!notif.readAt && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
                {notif.body && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {notif.body}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {timeAgo(notif.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <p className="text-xs text-slate-500">ทั้งหมด {total} รายการ</p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center px-2 text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
