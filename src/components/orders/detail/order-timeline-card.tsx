import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRight, FileText, History, ImageIcon, Package, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { HomeIconTile } from "@/components/dashboard/home/home-card";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn, formatDateTime } from "@/lib/utils";

/* ============================================================
   เส้นเวลาของใบนี้ — ใต้แท็บภาพรวม (ต้นแบบหน้าออเดอร์รอบ 2 · เบสเคาะ 2026-09-14)
   เรื่องล่าสุด 6 เรื่องเรียงซ้าย→ขวา ให้เห็นว่าใบนี้เดินมาอย่างไรโดยไม่ต้องเปิดแท็บประวัติ
   ข้อมูลชุดเดียวกับแท็บประวัติ (order.revisions) ไม่ยิง query เพิ่ม
   ============================================================ */

export interface TimelineRevision {
  id: string;
  description: string;
  changedBy: string;
  changedByName?: string;
  changeType: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: Date | string;
}

const TYPE_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  STATUS: { icon: Activity, tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  DESIGN: { icon: ImageIcon, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  FEES: { icon: Receipt, tone: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300" },
  QUOTATION: { icon: Receipt, tone: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300" },
  ITEMS: { icon: Package, tone: "bg-surface-muted text-secondary" },
  CHANGE_ORDER: { icon: Package, tone: "bg-surface-muted text-secondary" },
  INFO: { icon: FileText, tone: "bg-surface-muted text-secondary" },
};

const statusLabel = (value: string) => (INTERNAL_STATUS_LABELS as Record<string, string>)[value] ?? value;

/** หัวเรื่องของแถวประวัติ — แถวเปลี่ยนสถานะแปลเป็นชื่อไทย (description เก่าอาจเป็นอังกฤษดิบ) */
export function revisionTitle(revision: TimelineRevision): string {
  if (revision.changeType === "STATUS" && revision.oldValue && revision.newValue) {
    return `${statusLabel(revision.oldValue)} → ${statusLabel(revision.newValue)}`;
  }
  return revision.description;
}

export function OrderTimelineCard({
  revisions,
  onOpenHistory,
  limit = 6,
}: {
  revisions: readonly TimelineRevision[];
  onOpenHistory?: () => void;
  limit?: number;
}) {
  if (revisions.length === 0) return null;
  const recent = [...revisions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .reverse();

  return (
    <Section
      data-order-overview-card="timeline"
      title={
        <span className="flex items-center gap-2.5">
          <HomeIconTile icon={History} />
          เส้นเวลาของใบนี้
        </span>
      }
      action={
        onOpenHistory ? (
          <Button type="button" variant="ghost" size="sm" onClick={onOpenHistory}>
            ประวัติทั้งหมด
            <span className="tabular-nums">{revisions.length.toLocaleString("th-TH")}</span>
            <ArrowRight />
          </Button>
        ) : undefined
      }
    >
      <ol className="grid gap-4 overflow-x-auto pb-1 sm:auto-cols-[minmax(10.5rem,1fr)] sm:grid-flow-col sm:gap-3">
        {recent.map((revision, index) => {
          const style = TYPE_STYLE[revision.changeType] ?? TYPE_STYLE.INFO!;
          const Icon = style.icon;
          const last = index === recent.length - 1;
          return (
            <li key={revision.id} className="relative flex min-w-0 gap-3 sm:flex-col sm:gap-2">
              {!last ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-[-1rem] left-4 top-8 w-0.5 bg-divider sm:bottom-auto sm:left-9 sm:right-[-0.75rem] sm:top-4 sm:h-0.5 sm:w-auto"
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  style.tone,
                  last && "ring-2 ring-blue-600 ring-offset-2 ring-offset-surface dark:ring-blue-400",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">{revisionTitle(revision)}</p>
                <p className="mt-0.5 text-xs tabular-nums text-muted">{formatDateTime(revision.createdAt)}</p>
                <p className="text-xs text-muted [overflow-wrap:anywhere]">{revision.changedByName ?? revision.changedBy}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
