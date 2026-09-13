"use client";

import { useState } from "react";
import { ArrowRight, CircleDollarSign, FileImage, History, Info, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { TabKey } from "@/lib/order-tabs";
import styles from "./_history.module.css";

type Category = "info" | "files" | "money";
export type WorkspaceActivity = {
  id: string;
  title: string;
  category: Category;
  at: string;
  actor: string;
  changes?: { label: string; before: string; after: string }[];
  target?: { tab: TabKey; label: string; fileGroup?: "mockup" | "print" };
};
const CATEGORIES = [
  { key: "all", label: "ทั้งหมด" },
  { key: "info", label: "ข้อมูลออเดอร์" },
  { key: "files", label: "ไฟล์" },
  { key: "money", label: "การเงิน" },
] as const;
const ICONS = { info: Info, files: FileImage, money: CircleDollarSign };
const LABELS = { info: "ข้อมูลออเดอร์", files: "ไฟล์", money: "การเงิน" };
const BADGES = { info: "accent", files: "warning", money: "purple" } as const;

export function WorkspaceHistory({ events, onNavigate }: { events: WorkspaceActivity[]; onNavigate: (target: NonNullable<WorkspaceActivity["target"]>) => void }) {
  const [filter, setFilter] = useState<"all" | Category>("all");
  const visible = events.filter(event => filter === "all" || event.category === filter).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const days = new Map<string, WorkspaceActivity[]>();
  for (const event of visible) {
    const day = formatDate(event.at);
    days.set(day, [...(days.get(day) ?? []), event]);
  }

  return <section className={styles.history} aria-labelledby="workspace-history-heading">
    <header className={styles.heading}><h2 id="workspace-history-heading"><History size={19} />ประวัติออเดอร์</h2><span>{visible.length} รายการ</span></header>
    <div className={styles.filters} role="group" aria-label="กรองประวัติออเดอร์">
      {CATEGORIES.map(category => <button key={category.key} aria-pressed={filter === category.key} onClick={() => setFilter(category.key)}>{category.label}<span>{events.filter(event => category.key === "all" || event.category === category.key).length}</span></button>)}
    </div>
    {visible.length ? <div className={styles.days}>
      {Array.from(days, ([day, entries]) => <section className={styles.day} key={day} aria-label={`ประวัติ ${day}`}>
        <h3>{day}</h3>
        <ol className={styles.timeline}>
          {entries.map(event => {
            const Icon = ICONS[event.category];
            return <li key={event.id}>
              <span className={`${styles.eventIcon} ${styles[event.category]}`}><Icon size={17} /></span>
              <div className={styles.event}>
                <div className={styles.eventHeading}><h4>{event.title}</h4><div className={styles.eventActions}><Badge size="sm" variant={BADGES[event.category]}>{LABELS[event.category]}</Badge>{event.target && <Button variant="outline" size="sm" className={styles.open} onClick={() => onNavigate(event.target!)}>{event.target.label}<ArrowRight /></Button>}</div></div>
                <div className={styles.eventMeta}><span>{event.actor}</span>{event.at.includes("T") && <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}</time>}</div>
                {event.changes?.length ? <dl className={styles.changes}>{event.changes.map(change => <div key={change.label}><dt>{change.label}</dt><dd><span>{change.before || "—"}</span><ArrowRight size={14} aria-hidden="true" /><span className="sr-only">เปลี่ยนเป็น</span><strong>{change.after || "—"}</strong></dd></div>)}</dl> : null}
              </div>
            </li>;
          })}
        </ol>
      </section>)}
    </div> : <div className={styles.empty}><ListFilter size={30} /><p>ยังไม่มีประวัติในหมวดนี้</p><Button variant="outline" size="sm" onClick={() => setFilter("all")}>ดูทั้งหมด</Button></div>}
  </section>;
}
