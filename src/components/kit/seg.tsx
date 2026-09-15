"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { c } from "@/components/kit/kit";

/* ============================================================
   ตัวกรองแบบเลื่อน (.seg ของต้นแบบ) — ตัวเลื่อนวิ่งไปใต้ปุ่มที่เลือก
   วัดปุ่มจริงแล้วเขียน style ตรง ไม่ setState ใน effect · ใช้ร่วม: แท็บไฟล์ของออเดอร์ · ตารางออเดอร์หน้าแรก
   ============================================================ */

export interface SegOption<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export function Seg<K extends string>({
  label,
  options,
  value,
  onChange,
  style,
}: {
  /** ชื่อกลุ่มสำหรับเครื่องอ่านหน้าจอ */
  label: string;
  options: readonly SegOption<K>[];
  /** null = ไม่มีปุ่มไหนถูกเลือก (เช่น กำลังกรองด้วยอย่างอื่นอยู่) */
  value: K | null;
  onChange: (key: K) => void;
  style?: CSSProperties;
}) {
  const segRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const countKey = options.map((option) => `${option.key}:${option.count ?? ""}`).join("|");

  useLayoutEffect(() => {
    const seg = segRef.current;
    const ind = indRef.current;
    if (!seg || !ind) return;
    const place = () => {
      const on = seg.querySelector<HTMLElement>('[aria-pressed="true"]');
      ind.style.opacity = on ? "1" : "0";
      if (!on) return;
      ind.style.left = `${on.offsetLeft}px`;
      ind.style.width = `${on.offsetWidth}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(seg);
    void document.fonts?.ready.then(place);
    return () => observer.disconnect();
  }, [value, countKey]);

  return (
    <div ref={segRef} className={c("seg")} role="group" aria-label={label} style={style}>
      <span ref={indRef} className={c("ind")} aria-hidden="true" />
      {options.map((option) => (
        <button key={option.key} type="button" aria-pressed={option.key === value} onClick={() => onChange(option.key)}>
          {option.label}
          {option.count !== undefined ? <span className={c("n")}>{option.count.toLocaleString("th-TH")}</span> : null}
        </button>
      ))}
    </div>
  );
}
