import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRight, Banknote, Boxes, Factory, FileText, History, ImageIcon, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { HomeIconTile } from "@/components/dashboard/home/home-card";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn, formatDateCompact, formatTime } from "@/lib/utils";

/* ============================================================
   เส้นเวลาของใบนี้ — ใต้แท็บภาพรวม (ต้นแบบหน้าออเดอร์รอบ 2 · เบสเคาะ 2026-09-14 · ไล่ตรงต้นแบบ 2026-09-15)
   เรื่องล่าสุด 6 เรื่องเรียงซ้าย→ขวาบนเส้นเดียว จุดสีบอกหมวด (สถานะ/เงิน/แบบ/ผลิต) จุดล่าสุดมีวงน้ำเงิน
   ให้เห็นว่าใบนี้เดินมาอย่างไรโดยไม่ต้องเปิดแท็บประวัติ · ข้อมูลชุดเดียวกับแท็บประวัติ (order.revisions)
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

const TONE = {
  status: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  money: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  design: "bg-module-finance-surface text-module-finance-text",
  production: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  neutral: "bg-surface-muted text-secondary",
} as const;

/* หมวดของแถวประวัติ (ต้นแบบ HICON): สถานะ ฟ้า · เงิน เขียว · แบบ ม่วง · ผลิต/ของ ส้ม · อื่น ๆ เทา */
const TYPE_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  STATUS: { icon: Activity, tone: TONE.status },
  PRICE: { icon: Banknote, tone: TONE.money },
  FEES: { icon: Banknote, tone: TONE.money },
  QUOTATION: { icon: Banknote, tone: TONE.money },
  DESIGN: { icon: ImageIcon, tone: TONE.design },
  STOCK: { icon: Boxes, tone: TONE.production },
  QC_COUNT: { icon: Factory, tone: TONE.production },
  ITEMS: { icon: Package, tone: TONE.neutral },
  CHANGE_ORDER: { icon: Package, tone: TONE.neutral },
  INFO: { icon: FileText, tone: TONE.neutral },
};

/** ไอคอน+สีของแถวประวัติตามหมวด — ใช้ร่วมกับแท็บประวัติ ให้สองจุดพูดภาษาเดียวกัน */
export function revisionStyle(changeType: string): { icon: LucideIcon; tone: string } {
  return TYPE_STYLE[changeType] ?? TYPE_STYLE.INFO!;
}

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
      <div className="-mx-5 overflow-x-auto px-5 pb-1">
        <div className="relative sm:min-w-max">
          {/* เส้นเวลาเส้นเดียวหลังจุด (จอกว้าง) — จอแคบเรียงบนลงล่าง ไม่ต้องมีเส้น */}
          {recent.length > 1 ? (
            <span aria-hidden="true" className="absolute left-4 right-4 top-4 hidden h-0.5 bg-border sm:block" />
          ) : null}
          <ol className="relative grid gap-3.5 sm:auto-cols-[minmax(10rem,1fr)] sm:grid-flow-col sm:gap-2.5">
            {recent.map((revision, index) => {
              const style = revisionStyle(revision.changeType);
              const Icon = style.icon;
              const last = index === recent.length - 1;
              return (
                <li key={revision.id} className="flex min-w-0 gap-3 sm:max-w-[14.375rem] sm:flex-col sm:gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-surface",
                      style.tone,
                      last ? "ring-2 ring-blue-600 dark:ring-blue-400" : "ring-1 ring-border",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">{revisionTitle(revision)}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted [overflow-wrap:anywhere]">
                      {formatDateCompact(revision.createdAt)} {formatTime(revision.createdAt)} น. ·{" "}
                      {revision.changedByName ?? revision.changedBy}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Section>
  );
}
