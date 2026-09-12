"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/page-shell";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { FOCUS_INSET } from "@/components/ui/tokens";
import { cn, formatDateTime } from "@/lib/utils";
import { differenceInBangkokDays } from "@/lib/date-utils";
import {
  Bell,
  CheckCheck,
  Package,
  CreditCard,
  AlertTriangle,
  Info,
  MessageSquare,
} from "lucide-react";

function timeAgo(date: Date | string, now: number): string {
  const d = new Date(date);
  const seconds = Math.floor((now - d.getTime()) / 1000);

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

function dayBucket(date: Date | string, now: number): "today" | "week" | "earlier" {
  const days = differenceInBangkokDays(date, now);
  if (days !== null && days >= 0) return "today";
  if (days !== null && days >= -7) return "week";
  return "earlier";
}

const BUCKET_LABELS: Record<"today" | "week" | "earlier", string> = {
  today: "วันนี้",
  week: "7 วันที่ผ่านมา",
  earlier: "ก่อนหน้านี้",
};

export default function NotificationsPage() {
  return <Suspense fallback={<ListSkeleton rows={5} />}><NotificationsContent /></Suspense>;
}

function NotificationsContent() {
  const { page, searchParams, replaceListState } = useListPageState();
  const filter: FilterValue = searchParams.get("view") === "unread" ? "unread" : "all";
  const limit = 20;

  const { data, isLoading, isError, refetch, dataUpdatedAt } = trpc.notification.list.useQuery({
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
  usePageClamp(page, data?.pages, replaceListState);

  const grouped: Record<"today" | "week" | "earlier", NotifItem[]> = {
    today: [],
    week: [],
    earlier: [],
  };
  for (const notification of notifications) {
    grouped[dayBucket(notification.createdAt, dataUpdatedAt)].push(notification);
  }

  return (
    <PageShell
      title="การแจ้งเตือน"
      error={isError ? { onRetry: () => void refetch(), message: "เกิดข้อผิดพลาดในการโหลดข้อมูล" } : null}
      action={
        (unreadCount ?? 0) > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck />
            {markAllRead.isPending ? "กำลังทำเครื่องหมาย…" : "ทำเครื่องหมายอ่านแล้วทั้งหมด"}
          </Button>
        ) : undefined
      }
    >

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_TABS.map((tab) => (
          <FilterChip
            key={tab.value}
            surface="raised"
            selected={filter === tab.value}
            onClick={() => replaceListState({ view: tab.value === "unread" ? "unread" : null, page: null })}
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

      {markAllRead.error && <Alert variant="error">ทำเครื่องหมายไม่สำเร็จ: {markAllRead.error.message}</Alert>}
      {/* List */}
      <div>
        {isLoading && (
          <div className="divide-y divide-divider">
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
                  <div className="border-b border-divider bg-slate-50/50 px-5 py-1.5 text-xs font-semibold text-muted dark:bg-slate-800/30">
                    {BUCKET_LABELS[bucket]}
                  </div>
                  <ul className="divide-y divide-divider">
                    {items.map((notif) => (
                      <li key={notif.id}>
                        <NotificationAction notification={notif} onRead={() => markRead.mutate({ id: notif.id })} pending={markRead.isPending && markRead.variables?.id === notif.id}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-muted dark:bg-slate-800">
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
                                    ? "font-semibold text-strong"
                                    : "font-medium text-secondary"
                                )}
                              >
                                {notif.title}
                              </p>
                              {!notif.isRead && (
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                              )}
                            </div>
                            {notif.message && (
                              <p id={`notification-message-${notif.id}`} className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
                                {notif.message}
                              </p>
                            )}
                            <time dateTime={new Date(notif.createdAt).toISOString()} title={formatDateTime(notif.createdAt)} className="mt-1 block text-xs text-muted group-hover:text-secondary group-active:text-secondary dark:group-hover:text-secondary dark:group-active:text-secondary">
                              {timeAgo(notif.createdAt, dataUpdatedAt)}
                            </time>
                            <p className="mt-1 text-xs text-secondary">{notif.link ? "เปิดงานที่เกี่ยวข้อง →" : notif.isRead ? "อ่านแล้ว" : "แตะเพื่อทำเครื่องหมายว่าอ่านแล้ว"}</p>
                          </div>
                        </NotificationAction>
                        {markRead.error && markRead.variables?.id === notif.id && <p role="alert" className="px-5 pb-3 text-sm text-red-700 dark:text-red-300">ทำเครื่องหมายไม่สำเร็จ: {markRead.error.message}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* เดิมก๊อปโครง TablePagination มาเขียนเอง (ขาด aria-label/nav landmark) — ใช้ตัวกลาง */}
        <TablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={(nextPage) => replaceListState({ page: String(nextPage) })}
          limit={limit}
        />
      </div>
    </PageShell>
  );
}

function NotificationAction({ notification, onRead, pending, children }: {
  notification: NotifItem; onRead: () => void; pending: boolean; children: React.ReactNode;
}) {
  const className = cn(FOCUS_INSET, "group flex w-full gap-3 px-5 py-4 text-left transition-colors", !notification.isRead && "bg-surface-muted", (notification.link || !notification.isRead) && "hover:bg-interactive-hover active:bg-interactive-pressed");
  const description = notification.message ? `notification-message-${notification.id}` : undefined;
  const label = `${notification.isRead ? "" : "ยังไม่อ่าน: "}${notification.title}`;
  if (notification.link) return <Link href={notification.link} className={className} onClick={() => { if (!notification.isRead && !pending) onRead(); }} aria-label={`เปิดงาน: ${label}`} aria-describedby={description}>{children}</Link>;
  if (!notification.isRead) return <button type="button" className={className} onClick={onRead} disabled={pending} aria-busy={pending} aria-label={`ทำเครื่องหมายว่าอ่านแล้ว: ${label}`} aria-describedby={description}>{children}</button>;
  return <div className={className}>{children}</div>;
}
