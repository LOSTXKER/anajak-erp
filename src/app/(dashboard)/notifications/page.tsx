"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { c } from "@/components/kit/kit";
import { TablePagination } from "@/components/ui/table-pagination";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { FOCUS_INSET, TINT } from "@/components/ui/tokens";
import { cn, formatDateTime } from "@/lib/utils";
import { differenceInBangkokDays } from "@/lib/date-utils";
import {
  Bell,
  CheckCheck,
  ChevronRight,
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

/* กล่องไอคอนมีโทนตามความหนักของเรื่อง (ต้นแบบ .nlist .ni) — เรื่องด่วนกับเรื่องบอกเฉยๆ
   ต้องไม่เท่ากันตั้งแต่ยังไม่อ่านข้อความ · สีมากับไอคอนคนละรูป ไม่ได้ใช้สีอย่างเดียว */
const TYPE_TONES: Record<string, string> = {
  ALERT: TINT.error,
  PAYMENT: TINT.warning,
  ORDER: TINT.info,
  INFO: TINT.neutral,
  MESSAGE: TINT.neutral,
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
  week: "สัปดาห์นี้",
  earlier: "ก่อนหน้านี้",
};

export default function NotificationsPage() {
  return <Suspense fallback={<ListSkeleton rows={5} />}><NotificationsContent /></Suspense>;
}

function NotificationsContent() {
  const router = useRouter();
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
      meta={
        (unreadCount ?? 0) > 0
          ? `${(unreadCount ?? 0).toLocaleString("th-TH")} เรื่องยังไม่อ่าน`
          : "อ่านครบทุกเรื่องแล้ว"
      }
      error={isError ? { onRetry: () => void refetch(), message: "เกิดข้อผิดพลาดในการโหลดข้อมูล" } : null}
      action={
        (unreadCount ?? 0) > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck />
            อ่านทั้งหมดแล้ว
          </Button>
        ) : undefined
      }
    >
      {/* ทั้งแถบกรอง รายการ และตัวแบ่งหน้าอยู่ในการ์ดใบเดียวกันทุกสถานะ — จอไม่กระโดดตอนข้อมูลมา */}
      <div className="card-surface overflow-hidden rounded-2xl">
        <div className="px-4.5 pb-2.5 pt-3.5">
          <Toolbar>
            {/* ปุ่มแถบชุดเดียวกับหน้าออเดอร์ — มีจำนวนกำกับให้รู้ว่าเหลือเท่าไรก่อนกด */}
            <SegmentedControl
              value={filter}
              onChange={(value) => replaceListState({ view: value === "unread" ? "unread" : null, page: null })}
              options={FILTER_TABS.map((tab) => ({
                value: tab.value,
                label: (
                  <>
                    {tab.label}
                    {tab.value === "all" && total > 0 ? <span className={c("n")}>{total.toLocaleString("th-TH")}</span> : null}
                    {tab.value === "unread" && (unreadCount ?? 0) > 0 ? (
                      <span className={c("n")}>{(unreadCount ?? 0).toLocaleString("th-TH")}</span>
                    ) : null}
                  </>
                ),
              }))}
              aria-label="กรองการแจ้งเตือน"
            />
            <ToolbarGroup align="end">
              {/* จำนวนที่เห็นอยู่ตอนนี้ — ตัวแบ่งหน้าหายไปเมื่อมีหน้าเดียว จำนวนจึงต้องอยู่ตรงนี้ */}
              <span className="text-xs tabular-nums text-muted">
                {total.toLocaleString("th-TH")} รายการ
              </span>
            </ToolbarGroup>
          </Toolbar>
        </div>

        <div className="border-t border-divider/60">
          {isLoading && (
            <div className="divide-y divide-divider">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 px-4.5 py-3.5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-[11px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                  <Skeleton className="h-3 w-20 shrink-0" />
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
                    <div className="border-b border-divider bg-surface-muted px-4.5 py-1.5 text-xs font-semibold text-muted">
                      {BUCKET_LABELS[bucket]}
                    </div>
                    <ul className="divide-y divide-divider">
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
                              FOCUS_INSET,
                              "group flex w-full items-center gap-3 px-4.5 py-3 text-left transition-colors active:bg-interactive-pressed dark:active:bg-interactive-pressed",
                              // ยังไม่อ่าน = พื้นฟ้าอ่อนของชุดกลาง (หัวกลุ่มวันเป็นเทา จะได้ไม่ชนกัน)
                              !notif.isRead && "bg-[var(--accent-soft)]"
                            )}
                            aria-label={`${notif.isRead ? "" : "ยังไม่อ่าน: "}${notif.title}`}
                          >
                            <span
                              className={cn(
                                "grid size-9 shrink-0 place-items-center rounded-[11px]",
                                TYPE_TONES[notif.type] ?? TINT.neutral
                              )}
                            >
                              {TYPE_ICONS[notif.type] ?? (
                                <Bell className="h-4 w-4" strokeWidth={1.75} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "min-w-0 truncate text-sm",
                                    !notif.isRead
                                      ? "font-semibold text-strong"
                                      : "font-medium text-secondary"
                                  )}
                                >
                                  {notif.title}
                                </span>
                                {!notif.isRead && (
                                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                                )}
                              </span>
                              {notif.message && (
                                <span className="mt-0.5 line-clamp-2 text-sm text-muted group-active:text-secondary dark:group-active:text-secondary">
                                  {notif.message}
                                </span>
                              )}
                            </span>
                            <time
                              dateTime={new Date(notif.createdAt).toISOString()}
                              title={formatDateTime(notif.createdAt)}
                              className="shrink-0 text-xs text-muted group-active:text-secondary dark:group-active:text-secondary"
                            >
                              {timeAgo(notif.createdAt, dataUpdatedAt)}
                            </time>
                            {/* ลูกศรเฉพาะเรื่องที่มีหน้างานให้เปิด — เรื่องที่ไม่มีลิงก์กดแล้วแค่ทำเครื่องหมายอ่าน
                                (ปุ่มซ้อนปุ่มทำไม่ได้ จึงใช้ลูกศรแทนปุ่ม "เปิด" ของต้นแบบ) */}
                            {notif.link ? (
                              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                            ) : (
                              <span className="size-4 shrink-0" aria-hidden="true" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
