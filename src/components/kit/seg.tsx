"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { c } from "@/components/kit/kit";

/* ============================================================
   ตัวกรองแบบเลื่อน (.seg ของต้นแบบ) — ตัวเลื่อนวิ่งไปใต้ปุ่มที่เลือก
   วัดปุ่มจริงแล้วเขียน style ตรง ไม่ setState ใน effect · ใช้ร่วม: แท็บไฟล์ของออเดอร์ · ตารางออเดอร์หน้าแรก
   ตัววัดแยกเป็น useSegIndicator ให้ SegmentedControl ของชุดเก่าใช้ร่วม (รวมสไตล์ 2026-09-17)
   ============================================================ */

export interface SegOption<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

/** ตัวเลื่อนของ .seg/.tabs — วัดปุ่มที่เลือกอยู่ในกล่องแม่ของแถบเลื่อน แล้วขยับไปทับ
 *  คืนแค่ ref ของแถบเลื่อน (หากล่องแม่เอง) จึงใช้กับ component ที่ ref ของตัวเองถูกจองไว้แล้วได้ */
export function useSegIndicator(deps: string) {
  const indRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const ind = indRef.current;
    const box = ind?.parentElement;
    if (!ind || !box) return;
    const place = () => {
      const on = box.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"]');
      ind.style.opacity = on ? "1" : "0";
      if (!on) return;
      ind.style.left = `${on.offsetLeft}px`;
      ind.style.width = `${on.offsetWidth}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(box);
    // แท็บของ Radix (ui/tabs) สลับ aria-selected เองโดยไม่ผ่าน deps ของผู้เรียก — ไม่ฟังตรงนี้
    // ขีดจะค้างใต้แท็บแรกจนกว่ากล่องจะเปลี่ยนขนาด (เบสเจอในฟอร์มออเดอร์ 2026-09-18)
    const selection = new MutationObserver(place);
    selection.observe(box, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "aria-pressed"] });
    void document.fonts?.ready.then(place);
    return () => {
      observer.disconnect();
      selection.disconnect();
    };
  }, [deps]);
  return indRef;
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
  const countKey = options.map((option) => `${option.key}:${option.count ?? ""}`).join("|");
  const indRef = useSegIndicator(`${value ?? ""}|${countKey}`);

  return (
    <div className={c("seg")} role="group" aria-label={label} style={style}>
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
