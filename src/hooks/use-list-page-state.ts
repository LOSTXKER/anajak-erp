"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* ============================================================
   state ของหน้า list — filter/sort/page เก็บใน URL (แชร์ลิงก์/กด back แล้วตัวกรองอยู่ครบ)

   เดิมชุดนี้ (~70 บรรทัด: replaceListState + positivePage + debounce ค้นหา +
   sync input + ดึง page กลับเมื่อผลลัพธ์มีหน้าน้อยลง) ถูกก๊อปคำต่อคำใน 6-7 หน้า
   (orders, customers, quotations, billing, billing/notes, billing/aging, audit)
   — เจอบั๊กใน logic นี้ต้องไล่แก้ทุกหน้า และหน้าใหม่ (products, films) ที่ไม่ได้ก๊อป
   ก็แตกแถว: ไม่ debounce เลย / hack อ่าน window.location เอง

   วิธีใช้ (ดูหน้า customers เป็นตัวอย่าง):
     const list = useListPageState();
     const status = list.searchParams.get("status") ?? "";           // filter เฉพาะหน้า
     const query = trpc.x.list.useQuery({ search: list.search.trim() || undefined, page: list.page, ... });
     usePageClamp(list.page, query.data?.pages, list.replaceListState);
     <SearchInput ref={list.searchInputRef} defaultValue={list.search}
       onChange={(e) => list.onSearchChange(e.target.value)} />
     <button onClick={() => list.replaceListState({ status: v || null, page: null })}>

   กติกาใน URL: ค่าว่าง/null = ลบ param ทิ้ง · page=1 ไม่เก็บ (URL สะอาด)
   ============================================================ */

/** กันเลขหน้าเพี้ยนจาก URL (มือแก้/ลิงก์เก่า) — ต่ำกว่า 1 หรือไม่ใช่จำนวนเต็ม → 1 */
export function positivePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function useListPageState(options?: {
  /** ชื่อ query param ของช่องค้นหา (default "q") */
  searchParam?: string;
  /** หน่วงค้นหา ms (default 300) */
  debounceMs?: number;
}) {
  const searchParam = options?.searchParam ?? "q";
  const debounceMs = options?.debounceMs ?? 300;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get(searchParam) ?? "";
  const page = positivePage(searchParams.get("page"));

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // input ค้นหาเป็น uncontrolled (กัน caret เด้งระหว่าง debounce) — ref นี้ให้ hook
  // sync ค่าจาก URL กลับเข้า input ตอนกด back/forward
  const searchInputRef = useRef<HTMLInputElement>(null);

  const replaceListState = useCallback(
    (updates: Record<string, string | null>) => {
      // อ่านจาก window.location ไม่ใช่ searchParams — กันค่า stale ตอนกดรัวๆ
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || (key === "page" && value === "1")) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );

  useEffect(() => {
    if (searchInputRef.current && searchInputRef.current.value !== search) {
      searchInputRef.current.value = search;
    }
  }, [search]);

  /** ต่อกับ onChange ของช่องค้นหา — debounce แล้วเขียนลง URL พร้อมรีเซ็ตหน้า */
  const onSearchChange = useCallback(
    (value: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(
        () => replaceListState({ [searchParam]: value.trim() || null, page: null }),
        debounceMs
      );
    },
    [replaceListState, searchParam, debounceMs]
  );

  return {
    search,
    page,
    searchParams,
    replaceListState,
    onSearchChange,
    searchInputRef,
    searchTimer,
  };
}

/** กดหน้าถัดไปช่วง placeholderData ค้าง → ผลใหม่มีหน้าน้อยกว่า — ดึงกลับหน้าสุดท้าย
 *  ที่มีจริง ไม่งั้นติดหน้าว่างไร้แถบถอย (pattern เดียวกันทุกหน้า list) */
export function usePageClamp(
  page: number,
  pages: number | undefined,
  replaceListState: (updates: Record<string, string | null>) => void
) {
  useEffect(() => {
    if (pages != null && pages >= 1 && page > pages) {
      replaceListState({ page: String(pages) });
    }
  }, [page, pages, replaceListState]);
}
