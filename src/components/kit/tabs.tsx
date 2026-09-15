"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { c } from "@/components/kit/kit";

/* ============================================================
   แถบแท็บของชุดกลาง (.tabs) — ขีดสีน้ำเงินเลื่อนไปใต้แท็บที่เลือกทุกครั้ง
   ←→ Home End เลื่อนแท็บด้วยคีย์บอร์ด · ใช้ร่วม: หน้าออเดอร์ · ใบผลิต (เบสทัก 09-16 ใบผลิตไม่มีขีด)
   ============================================================ */

export type KitTab<K extends string> = {
  key: K;
  label: string;
  /** ตัวเลขข้างชื่อแท็บ · 0/ไม่ส่ง = ไม่แสดง */
  count?: number;
  /** จุดแดง "มีงานค้าง" (แสดงเฉพาะตอนแท็บนั้นไม่ได้เลือก) */
  pending?: boolean;
};

export function KitTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: readonly KitTab<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  /** id ของแท็บ = `${idPrefix}-tab-${key}` · แผงเนื้อหา = `${idPrefix}-panel-${key}` */
  idPrefix: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const countKey = tabs.map((tab) => `${tab.key}:${tab.count ?? ""}:${tab.pending ? 1 : 0}`).join("|");

  useLayoutEffect(() => {
    const list = listRef.current;
    const ind = indRef.current;
    if (!list || !ind) return;
    const place = () => {
      const on = list.querySelector<HTMLElement>('[aria-selected="true"]');
      ind.style.opacity = on ? "1" : "0";
      if (!on) return;
      ind.style.left = `${on.offsetLeft}px`;
      ind.style.width = `${on.offsetWidth}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    void document.fonts?.ready.then(place);
    return () => observer.disconnect();
  }, [value, countKey]);

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === value);
    const nextIndex =
      event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    const next = tabs[nextIndex]!;
    onChange(next.key);
    document.getElementById(`${idPrefix}-tab-${next.key}`)?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} className={c("tabs")}>
      {tabs.map((tab) => {
        const selected = tab.key === value;
        const pending = Boolean(tab.pending) && !selected;
        return (
          <button
            key={tab.key}
            id={`${idPrefix}-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            aria-label={pending ? `${tab.label} — มีงานค้าง` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={move}
            className={c("tab")}
          >
            {tab.label}
            {tab.count ? <span className={c("n")}>{tab.count.toLocaleString("th-TH")}</span> : null}
            {pending ? <span className={c("pend")} aria-hidden="true" /> : null}
          </button>
        );
      })}
      <span ref={indRef} className={c("ind")} aria-hidden="true" />
    </div>
  );
}
