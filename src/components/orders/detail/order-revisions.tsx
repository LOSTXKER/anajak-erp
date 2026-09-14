import { History } from "lucide-react";
import { Section } from "@/components/ui/section";
import { HomeChip, HomeIconTile } from "@/components/dashboard/home/home-card";
import { revisionStyle } from "@/components/orders/detail/order-timeline-card";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { BANGKOK_TZ, cn, formatTime } from "@/lib/utils";

/* ============================================================
   แท็บประวัติ (ต้นแบบหน้าออเดอร์รอบ 2 · ไล่ตรงต้นแบบ 2026-09-15)
   จัดกลุ่มตามวัน ใหม่ไปเก่า · แต่ละแถวมีจุดสีบอกหมวด (ชุดเดียวกับเส้นเวลาในภาพรวม) ·
   แถวเปลี่ยนสถานะบอก "สถานะ: เดิม → ใหม่" ด้วยชื่อไทย · ชื่อคนมาจาก server (changedByName)
   โชว์ประวัติทั้งหมดโดยไม่พับซ่อน (เบสชี้ 2026-06-12)
   ============================================================ */

interface Revision {
  id: string;
  description: string;
  changedBy: string;
  changedByName?: string;
  changeType: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: Date | string;
}

interface OrderRevisionsProps {
  revisions: Revision[];
}

const statusLabel = (value: string | null | undefined) =>
  value ? ((INTERNAL_STATUS_LABELS as Record<string, string>)[value] ?? value) : "";

const dayLabel = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BANGKOK_TZ,
});

export function OrderRevisions({ revisions }: OrderRevisionsProps) {
  const sorted = [...(revisions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const days: { day: string; items: Revision[] }[] = [];
  for (const revision of sorted) {
    const day = dayLabel.format(new Date(revision.createdAt));
    const current = days[days.length - 1];
    if (current && current.day === day) current.items.push(revision);
    else days.push({ day, items: [revision] });
  }

  return (
    <Section
      title={
        <span className="flex items-center gap-2.5">
          <HomeIconTile icon={History} />
          ประวัติออเดอร์
        </span>
      }
      action={sorted.length > 0 ? <HomeChip>{sorted.length.toLocaleString("th-TH")} รายการ</HomeChip> : undefined}
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
      ) : (
        <div className="grid gap-4">
          {days.map(({ day, items }) => (
            <section key={day} aria-label={day}>
              <h3 className="mb-1.5 text-xs font-medium text-muted">{day}</h3>
              <ol>
                {items.map((revision, index) => {
                  const { icon: Icon, tone } = revisionStyle(revision.changeType);
                  // แถวเปลี่ยนสถานะ: แปลจาก oldValue/newValue (enum) เป็นชื่อไทย — description เก่าอาจเป็นอังกฤษดิบ
                  const isStatusRow = revision.changeType === "STATUS" && revision.oldValue && revision.newValue;
                  const first = index === 0;
                  const last = index === items.length - 1;
                  return (
                    <li key={revision.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-1.5">
                      {items.length > 1 ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute left-[0.9375rem] w-0.5 bg-divider",
                            first ? "bottom-0 top-[1.125rem]" : last ? "top-0 h-[1.125rem]" : "inset-y-0",
                          )}
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-surface",
                          tone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-strong [overflow-wrap:anywhere]">
                          {isStatusRow ? statusLabel(revision.newValue) : revision.description}
                        </p>
                        <p className="text-xs tabular-nums text-muted [overflow-wrap:anywhere]">
                          {revision.changedByName ?? revision.changedBy} · {formatTime(revision.createdAt)} น.
                        </p>
                        {isStatusRow ? (
                          <p className="mt-1 text-xs text-secondary">
                            สถานะ: <span className="text-muted line-through">{statusLabel(revision.oldValue)}</span>
                            {" → "}
                            <span className="font-medium text-strong">{statusLabel(revision.newValue)}</span>
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Section>
  );
}
