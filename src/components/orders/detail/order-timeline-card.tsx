import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  Factory,
  FileText,
  History,
  ImageIcon,
  Package,
} from "lucide-react";
import { c, CardHead, statusLabel, timeText } from "@/components/kit/kit";
import { formatDateCompact } from "@/lib/utils";

/* ============================================================
   เส้นเวลาของใบนี้ — ต้นแบบ timelineHTML() (รื้อ 2026-09-15)
   เรื่องล่าสุด 6 เรื่องเรียงซ้าย→ขวาบนเส้นเดียว จุดสีบอกหมวด สถานะ/เงิน/แบบ/ผลิต จุดล่าสุดมีวงน้ำเงิน
   ข้อมูลชุดเดียวกับแท็บประวัติ (order.revisions)
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

type Kind = "st" | "fin" | "des" | "prod" | "bad" | "";

const KIND: Record<string, { kind: Kind; icon: LucideIcon }> = {
  STATUS: { kind: "st", icon: Activity },
  PRICE: { kind: "fin", icon: Banknote },
  FEES: { kind: "fin", icon: Banknote },
  QUOTATION: { kind: "fin", icon: Banknote },
  PAYMENT: { kind: "fin", icon: Banknote },
  DESIGN: { kind: "des", icon: ImageIcon },
  STOCK: { kind: "prod", icon: Boxes },
  QC_COUNT: { kind: "prod", icon: Factory },
  PRODUCTION: { kind: "prod", icon: Factory },
  ITEMS: { kind: "", icon: Package },
  CHANGE_ORDER: { kind: "", icon: Package },
  INFO: { kind: "", icon: FileText },
};

/** หมวด+ไอคอนของแถวประวัติ (ต้นแบบ HICON) — ใช้ร่วมกับแท็บประวัติ ให้สองจุดพูดภาษาเดียวกัน */
export function revisionKind(revision: Pick<TimelineRevision, "changeType" | "newValue">): { kind: Kind; icon: LucideIcon } {
  if (revision.changeType === "STATUS" && (revision.newValue === "CANCELLED" || revision.newValue === "ON_HOLD")) {
    return { kind: "bad", icon: AlertTriangle };
  }
  return KIND[revision.changeType] ?? KIND.INFO!;
}

/** หัวเรื่องของแถวประวัติ — แถวเปลี่ยนสถานะใช้ชื่อสถานะใหม่ภาษาไทย (description เก่าอาจเป็นอังกฤษดิบ) */
export function revisionTitle(revision: TimelineRevision): string {
  if (revision.changeType === "STATUS" && revision.newValue) return statusLabel(revision.newValue);
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
    <section className={c("card")} aria-labelledby="tl-h" data-order-overview-card="timeline">
      <CardHead
        icon={History}
        id="tl-h"
        title="เส้นเวลาของใบนี้"
        right={
          onOpenHistory ? (
            <button type="button" className={c("btn ghost sm")} onClick={onOpenHistory}>
              ประวัติทั้งหมด {revisions.length.toLocaleString("th-TH")}
              <ArrowRight aria-hidden="true" />
            </button>
          ) : undefined
        }
      />
      <div className={c("htlw")}>
        <ol className={c("htl")}>
          {recent.map((revision, index) => {
            const { kind, icon: Icon } = revisionKind(revision);
            return (
              <li key={revision.id} className={c("hev", index === recent.length - 1 && "last")}>
                <span className={c("dot", kind)} aria-hidden="true">
                  <Icon />
                </span>
                <b>{revisionTitle(revision)}</b>
                <small>
                  {formatDateCompact(revision.createdAt)} {timeText(revision.createdAt)} · {revision.changedByName ?? revision.changedBy}
                </small>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
