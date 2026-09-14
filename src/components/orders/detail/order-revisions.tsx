import { History } from "lucide-react";
import { c, CardHead, Empty, statusLabel, timeText } from "@/components/orders/orders-ui";
import { revisionKind, revisionTitle, type TimelineRevision } from "@/components/orders/detail/order-timeline-card";
import { BANGKOK_TZ } from "@/lib/utils";

/* ============================================================
   แท็บประวัติ — ต้นแบบ tabHistory() (รื้อ 2026-09-15)
   จัดกลุ่มตามวัน ใหม่ไปเก่า · จุดสีบอกหมวดชุดเดียวกับเส้นเวลาในภาพรวม ·
   แถวเปลี่ยนสถานะบอก "สถานะ: เดิม → ใหม่" ด้วยชื่อไทย · ชื่อคนมาจาก server (changedByName)
   โชว์ทั้งหมดโดยไม่พับซ่อน (เบสชี้ 06-12)
   ============================================================ */

const dayLabel = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BANGKOK_TZ,
});

export function OrderRevisions({ revisions }: { revisions: TimelineRevision[] }) {
  const sorted = [...(revisions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const days: { day: string; items: TimelineRevision[] }[] = [];
  for (const revision of sorted) {
    const day = dayLabel.format(new Date(revision.createdAt));
    const current = days[days.length - 1];
    if (current && current.day === day) current.items.push(revision);
    else days.push({ day, items: [revision] });
  }

  return (
    <section className={c("card")} aria-labelledby="hs-h">
      <CardHead
        icon={History}
        id="hs-h"
        title="ประวัติออเดอร์"
        right={sorted.length > 0 ? <span className={c("chip gray")}>{sorted.length.toLocaleString("th-TH")} รายการ</span> : undefined}
      />
      {sorted.length === 0 ? (
        <Empty icon={History} title="ยังไม่มีประวัติการเปลี่ยนแปลง" />
      ) : (
        <div className={c("cb")}>
          <div className={c("tl")}>
            {days.map(({ day, items }) => (
              <section key={day} aria-label={day}>
                <h3>{day}</h3>
                <ol>
                  {items.map((revision) => {
                    const { kind, icon: Icon } = revisionKind(revision);
                    const isStatusRow = revision.changeType === "STATUS" && revision.oldValue && revision.newValue;
                    return (
                      <li key={revision.id}>
                        <span className={c("ic", kind)} aria-hidden="true">
                          <Icon />
                        </span>
                        <div className={c("ev")}>
                          <b>{revisionTitle(revision)}</b>
                          <div className={c("m")}>
                            {revision.changedByName ?? revision.changedBy} · {timeText(revision.createdAt)}
                          </div>
                          {isStatusRow ? (
                            <div className={c("chg")}>
                              <div>
                                สถานะ: <span>{statusLabel(revision.oldValue!)}</span> → <b>{statusLabel(revision.newValue!)}</b>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
