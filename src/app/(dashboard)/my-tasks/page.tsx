"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  UserRound,
  UsersRound,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FOCUS_INSET } from "@/components/ui/tokens";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import {
  groupTaskItems,
  type TaskGroup,
  type TaskListItem,
} from "@/lib/task-groups";
import { cn, formatDate } from "@/lib/utils";
import { buildTaskItems } from "./task-items";

const GROUP_ICONS: Record<TaskGroup["id"], ComponentType<{ className?: string }>> = {
  attention: AlertTriangle,
  mine: UserRound,
  team: UsersRound,
};

function attentionLabel(attention: TaskListItem["attention"]) {
  if (attention === "blocked") return "ติดปัญหา";
  if (attention === "overdue") return "เลยกำหนด";
  if (attention === "due-soon") return "ใกล้กำหนด";
  return null;
}


function TaskRow({ item, urgent }: { item: TaskListItem; urgent?: boolean }) {
  const attention = attentionLabel(item.attention);
  // ติดปัญหา/เลยกำหนด = ปลายทางของแถวนี้ (ไม่เดินต่อเองจนกว่าจะมีคนแตะ) → ย้อมข้อความ
  // ส่วน "ใกล้กำหนด" ยังเป็นระหว่างทาง ปล่อยให้จุดสีอำพันเป็นตัวบอกพอ
  const urgentAttention = item.attention === "blocked" || item.attention === "overdue";
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          FOCUS_INSET,
          "flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-interactive-hover active:bg-interactive-pressed",
          // rail ซ้ายเฉพาะกลุ่ม "ต้องทำก่อน" — สัญญาณแยกจากแถวคิวทีมโดยไม่เปลี่ยนโครง
          urgent && "border-l-2 border-red-400"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words text-sm font-medium text-strong">
              {item.title}
            </p>
            {attention && (
              <StatusLabel
                label={attention}
                tone={urgentAttention ? "danger" : "warning"}
                emphasize={urgentAttention}
              />
            )}
          </div>
          {item.description && (
            <p className="break-words text-xs leading-relaxed text-secondary">
              {item.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
            {/* ป้ายสถานะของงานอยู่ในแถว meta (flex-wrap) เพื่อให้เห็นทุกขนาดจอ — ห้ามซ่อนบนมือถือ */}
            {item.badge && (
              <StatusLabel
                label={item.badge}
                tone={toneFromBadgeVariant(item.badgeTone)}
                // แดง = บิลเลยกำหนด ซึ่งเป็นปลายทางที่ต้องสะดุดตาตอนสแกน
                emphasize={item.badgeTone === "destructive"}
              />
            )}
            {item.deadline && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  (item.attention === "overdue" || item.attention === "blocked") &&
                    "font-medium text-red-600 dark:text-red-400",
                  item.attention === "due-soon" && "text-amber-700 dark:text-amber-400"
                )}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(item.deadline)}
              </span>
            )}
            {item.meta && <span className="tabular-nums">{item.meta}</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}

function TaskGroupCard({ group }: { group: TaskGroup }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = GROUP_ICONS[group.id];
  const visible = expanded ? group.items : group.items.slice(0, 5);
  const remaining = group.items.length - visible.length;

  return (
    <section
      className={cn(
        "card-surface overflow-hidden rounded-2xl",
        // ต้องมี `border` คู่ด้วย ไม่งั้นสั่งแค่สีขอบ = เส้นไม่ขึ้นเลย (audit สี 2026-08-02)
        group.id === "attention" && "border border-red-200 dark:border-red-900"
      )}
    >
      <div className="flex items-start gap-3 border-b border-divider px-4 py-3">
        <div
          className={cn(
            "mt-0.5 rounded-lg p-2",
            group.id === "attention"
              ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              : "bg-surface-muted text-secondary"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-strong">{group.title}</h2>
            <Badge variant={group.id === "attention" ? "destructive" : "default"} size="sm">
              {group.items.length}
            </Badge>
          </div>
          {group.description && (
            <p className="text-xs text-secondary">{group.description}</p>
          )}
        </div>
      </div>
      <ul id={`tasks-${group.id}`} className="divide-y divide-divider" aria-label={group.title}>
        {visible.map((item) => (
          <TaskRow key={item.key} item={item} urgent={group.id === "attention"} />
        ))}
      </ul>
      {group.items.length > 5 && (
        <div className="border-t border-divider p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls={`tasks-${group.id}`}
          >
            {expanded ? "ย่อรายการ" : `ดูทั้งหมดอีก ${remaining} งาน`}
            <ChevronDown
              className={cn(" transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        </div>
      )}
    </section>
  );
}

export default function MyTasksPage() {
  const { data, isLoading, isError, refetch } = trpc.task.myToday.useQuery(undefined, { refetchOnWindowFocus: true, refetchInterval: 30_000 });

  const groups = data
    ? groupTaskItems(buildTaskItems(data)).filter((group) => group.items.length > 0)
    : [];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <PageShell
      title="งานของฉัน"
      description="รวมงานที่ถึงขั้นลงมือและเรื่องที่ต้องติดตาม ตามหน้าที่ของคุณ"
      // ระหว่างโหลด/พังยังไม่รู้จำนวนงาน — ใช้ข้อความกลางเดิม (header อยู่ครบทุก state)
      meta={
        !data
          ? "เรียงสิ่งที่ต้องทำก่อนให้แล้ว"
          : total > 0
            ? `${total} งาน · เรียงงานติดปัญหาและใกล้กำหนดไว้ก่อนแล้ว`
            : "ไม่มีงานที่ต้องลงมือหรือติดตามตอนนี้"
      }
      loading={isLoading}
      skeleton={<ListSkeleton rows={5} />}
      error={
        isError || (!isLoading && !data)
          ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetch() }
          : null
      }
    >
      {groups.length === 0 ? (
        <div className="card-surface rounded-2xl">
          <EmptyState
            icon={CheckCircle2}
            title="ยังไม่มีงานที่ถึงคิวคุณ"
            description="เมื่อขั้นก่อนหน้าเสร็จ งานที่ถึงคิวและตรงกับหน้าที่ของคุณจะมาอยู่ที่นี่"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => <TaskGroupCard key={group.id} group={group} />)}
        </div>
      )}
    </PageShell>
  );
}
