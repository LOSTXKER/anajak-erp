"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
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
  ORDER: <Package className="h-4 w-4" strokeWidth={1.75} />,
  PAYMENT: <CreditCard className="h-4 w-4" strokeWidth={1.75} />,
  ALERT: <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />,
  INFO: <Info className="h-4 w-4" strokeWidth={1.75} />,
  MESSAGE: <MessageSquare className="h-4 w-4" strokeWidth={1.75} />,
};

const FILTER_TABS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "unread", label: "ยังไม่อ่าน" },
] as const;

type FilterValue = (typeof FILTER_TABS)[number]["value"];

type NotifItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: Date | string;
};

function dayBucket(date: Date | string): "today" | "week" | "earlier" {
  const d = new Date(date);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  if (d >= startOfToday) return "today";
  const week = new Date(startOfToday);
  week.setDate(week.getDate() - 7);
  if (d >= week) return "week";
  return "earlier";
}

const BUCKET_LABELS: Record<"today" | "week" | "earlier", string> = {
  today: "วันนี้",
  week: "สัปดาห์นี้",
  earlier: "ก่อนหน้านี้",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = trpc.notification.list.useQuery({
    limit,
    page,
    unreadOnly: filter === "unread" ? true : undefined,
  });

  const utils = trpc.useUtils();

  const markRead = useMutationWithInvalidation(trpc.notification.markRead, {
    invalidate: [utils.notification.unreadCount, utils.notification.list],
  });

  const markAllRead = useMutationWithInvalidation(
    trpc.notification.markAllRead,
    {
      invalidate: [utils.notification.unreadCount, utils.notification.list],
    }
  );

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery();

  const notifications = (data?.notifications ?? []) as NotifItem[];
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  const grouped = useMemo(() => {
    const result: Record<"today" | "week" | "earlier", NotifItem[]> = {
      today: [],
      week: [],
      earlier: [],
    };
    notifications.forEach((n) => {
      result[dayBucket(n.createdAt)].push(n);
    });
    return result;
  }, [notifications]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="การแจ้งเตือน"
        description="ติดตามการแจ้งเตือนทั้งหมดของคุณ"
        action={
          (unreadCount ?? 0) > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              อ่านทั้งหมด
            </Button>
          ) : undefined
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_TABS.map((tab) => (
          <FilterChip
            key={tab.value}
            selected={filter === tab.value}
            onClick={() => {
              setFilter(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
            {tab.value === "unread" && (unreadCount ?? 0) > 0 && (
              <Badge variant="accent" size="sm" className="ml-1.5">
                {unreadCount}
              </Badge>
            )}
          </FilterChip>
        ))}
      </div>

      {/* List */}
      <div className="card-surface overflow-hidden rounded-2xl">
        {isLoading && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 px-5 py-3.5">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-72" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <EmptyState
            icon={Bell}
            title={
              filter === "unread"
                ? "ไม่มีการแจ้งเตือนที่ยังไม่อ่าน"
                : "ไม่มีการแจ้งเตือน"
            }
          />
        )}

        {!isLoading && notifications.length > 0 && (
          <div>
            {(["today", "week", "earlier"] as const).map((bucket) => {
              const items = grouped[bucket];
              if (items.length === 0) return null;
              return (
                <div key={bucket}>
                  <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400">
                    {BUCKET_LABELS[bucket]}
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((notif) => (
                      <li key={notif.id}>
                        <button
                          onClick={() => {
                            if (!notif.isRead) {
                              markRead.mutate({ id: notif.id });
                            }
                            // มี link = พาไปหน้างานจริง (เช่น ออเดอร์/บิลที่เกี่ยว)
                            if (notif.link) router.push(notif.link);
                          }}
                          className={cn(
                            "flex w-full gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                            !notif.isRead && "bg-blue-50/40 dark:bg-blue-950/20"
                          )}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {TYPE_ICONS[notif.type] ?? (
                              <Bell className="h-4 w-4" strokeWidth={1.75} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p
                                className={cn(
                                  "text-sm",
                                  !notif.isRead
                                    ? "font-semibold text-slate-900 dark:text-white"
                                    : "font-medium text-slate-700 dark:text-slate-300"
                                )}
                              >
                                {notif.title}
                              </p>
                              {!notif.isRead && (
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                              )}
                            </div>
                            {notif.message && (
                              <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                                {notif.message}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                              {timeAgo(notif.createdAt)}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5 dark:border-slate-800">
            <p className="text-xs text-slate-500">ทั้งหมด {total} รายการ</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-1 text-xs text-slate-500">
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
      </div>
    </div>
  );
}
