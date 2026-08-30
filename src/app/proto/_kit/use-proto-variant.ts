"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

/** `history.replaceState` ไม่ยิง popstate — เปลี่ยนเองแล้วต้องบอก subscriber เอง */
function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  // SSR เรนเดอร์ด้วยค่าเริ่มต้นเสมอ (เซิร์ฟเวอร์ไม่รู้ query) — พอ subscribe ติดแล้ว
  // ต้องบอกให้อ่าน URL จริงซ้ำหนึ่งรอบ ไม่งั้นเปิดลิงก์ `?v=board` ตรง ๆ จะค้างอยู่ที่
  // ค่าเริ่มต้น = ลิงก์พกตัวเลือกไม่ได้จริง ซึ่งเป็นเหตุผลเดียวที่เก็บค่าไว้ใน URL
  queueMicrotask(onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const getSearch = () => window.location.search;
/** ตอน SSR ยังไม่มี URL → เรนเดอร์ด้วยค่าเริ่มต้น แล้วค่อยสลับหลัง hydrate */
const getServerSearch = () => "";

export function useProtoVariant<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
) {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const raw = new URLSearchParams(search).get(key);
  const value =
    raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const set = useCallback(
    (next: T) => {
      const url = new URL(window.location.href);
      // ค่าเริ่มต้นไม่เขียนลง URL — ลิงก์เปล่าจึงแปลว่า "ค่าเริ่มต้น" เสมอ
      if (next === fallback) url.searchParams.delete(key);
      else url.searchParams.set(key, next);
      window.history.replaceState(null, "", url);
      emit();
    },
    [key, fallback],
  );

  return [value, set] as const;
}

const FLAG_VALUES = ["0", "1"] as const;

/** รุ่นสวิตช์เปิด/ปิด สำหรับปุ่มสลับสถานะขอบ (งานน้อย/งานล้น) */
export function useProtoFlag(key: string, fallback = false) {
  const [raw, setRaw] = useProtoVariant(key, FLAG_VALUES, fallback ? "1" : "0");
  const toggle = useCallback(() => setRaw(raw === "1" ? "0" : "1"), [raw, setRaw]);
  return [raw === "1", toggle] as const;
}
