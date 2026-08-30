"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * ตัวเลือกของหน้าลองเก็บไว้ใน URL — เจ้าของงานจึงก๊อปลิงก์ส่งกลับมาได้เลยว่าชอบแบบไหน
 * โดยไม่ต้องบรรยายเป็นคำพูด (นี่คือเหตุผลเดียวที่เก็บค่าไว้ใน URL แทน useState)
 *
 * ⚠️ ประวัติบั๊ก (แก้ 2026-08-31 ตอนทำ /proto/order-overview):
 * เดิมอ่าน URL ผ่าน `useSyncExternalStore` + `window.location.search` โดยมี
 * `getServerSnapshot` คืนค่าว่าง แล้วคอยแจ้งตัวเองหลัง subscribe
 * → **ใช้ไม่ได้จริงบน React 19**: หลัง hydrate ค่า snapshot ฝั่ง client ไม่ได้ "เปลี่ยน"
 *   (มันเป็นค่าเดิมมาตั้งแต่ก่อน commit) React จึงไม่ re-render แล้วหน้าค้างที่ค่าเริ่มต้น
 *   ถาวร — เปิด `/proto/order-detail?v=dense` ได้หน้าตาแบบ "ของจริงตอนนี้" ทุกครั้ง
 *   = ลิงก์พกตัวเลือกไม่ได้เลย ทั้งที่เป็นหัวใจของหน้าลอง
 *
 * `useSearchParams` ของ Next รู้ค่า query ตั้งแต่ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ จึงถูกตั้งแต่
 * เฟรมแรกไม่มีสลับให้เห็น · การเขียนกลับใช้ `window.history.replaceState` ซึ่ง Next
 * ผูกเข้ากับ router ให้แล้ว (ตั้งแต่ 15) — ค่าที่ hook อ่านจึงอัปเดตเองโดยไม่ต้องแจ้งเอง
 * และไม่มี entry ใหม่ในประวัติเบราว์เซอร์ (กดย้อนกลับแล้วออกจากหน้าลองได้ตามคาด)
 *
 * ต้องมี <Suspense> คั่นเหนือหน้าที่เรียก — วางไว้ใน `src/app/proto/layout.tsx` แล้ว
 */
export function useProtoVariant<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
) {
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);
  const value =
    raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const set = useCallback(
    (next: T) => {
      const url = new URL(window.location.href);
      // ค่าเริ่มต้นไม่เขียนลง URL — ลิงก์เปล่าจึงแปลว่า "ค่าเริ่มต้น" เสมอ
      if (next === fallback) url.searchParams.delete(key);
      else url.searchParams.set(key, next);
      window.history.replaceState(null, "", url);
    },
    [key, fallback],
  );

  return [value, set] as const;
}

const FLAG_VALUES = ["0", "1"] as const;

/** รุ่นสวิตช์เปิด/ปิด สำหรับปุ่มสลับสถานะขอบ (งานน้อย/งานล้น · ใบครบ/ใบเพิ่งเปิด) */
export function useProtoFlag(key: string, fallback = false) {
  const [raw, setRaw] = useProtoVariant(key, FLAG_VALUES, fallback ? "1" : "0");
  const toggle = useCallback(() => setRaw(raw === "1" ? "0" : "1"), [raw, setRaw]);
  return [raw === "1", toggle] as const;
}
