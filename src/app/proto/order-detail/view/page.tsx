"use client";

/**
 * หน้าที่อยู่ "ข้างใน" กรอบของหน้าเทียบ — วาดใบงานหนึ่งแบบเต็มหน้าจอ ไม่มีของหน้าลองปน
 *
 * ทำไมต้องเป็นหน้าแยกแล้วให้หน้าเทียบเรียกผ่าน <iframe>:
 * ของจริงตัดสินขนาดจอด้วย breakpoint ของ "หน้าต่างเบราว์เซอร์" ไม่ใช่ของกล่องที่มันอยู่
 * → ถ้าเอากรอบมือถือ 390px ไปวางในหน้าคอมเฉย ๆ ข้างในจะยังคิดว่าตัวเองอยู่บนจอ 1440
 *   แล้วโชว์เลย์เอาต์คอมในกรอบมือถือ = ภาพที่เบสเห็นไม่ตรงกับของจริง
 * iframe มีหน้าต่างของตัวเอง กว้าง 390 จริง จึงได้เลย์เอาต์มือถือจริง
 *
 * ธีมไม่ต้องส่งข้าม — iframe อยู่โดเมนเดียวกัน next-themes อ่าน localStorage ตัวเดียวกัน
 * และฟัง event `storage` อยู่แล้ว กดสลับธีมที่หน้าเทียบ ข้างในจึงเปลี่ยนตาม
 */

import { useSyncExternalStore } from "react";
import { CalmVariant } from "../_variants/calm";
import { CurrentVariant } from "../_variants/current";
import { DenseVariant } from "../_variants/dense";
import { LeadVariant } from "../_variants/lead";

const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  queueMicrotask(onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}
const getSearch = () => window.location.search;
const getServerSearch = () => "";

export default function OrderDetailProtoView() {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const params = new URLSearchParams(search);
  const variant = params.get("v") ?? "current";
  const thin = params.get("thin") === "1";
  // ค่าเริ่มต้น = เห็นเงิน (เจ้าของ/ฝ่ายขาย) · money=0 คือมุมของช่าง/กราฟิก
  const showMoney = params.get("money") !== "0";

  const props = { thin, showMoney };

  return (
    // กล่องเดียวกับ <main> ของเว็บจริง (mx-auto max-w-screen-2xl + ระยะขอบชุดเดียวกัน)
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      {variant === "calm" ? (
        <CalmVariant {...props} />
      ) : variant === "lead" ? (
        <LeadVariant {...props} />
      ) : variant === "dense" ? (
        <DenseVariant {...props} />
      ) : (
        <CurrentVariant {...props} />
      )}
    </div>
  );
}
