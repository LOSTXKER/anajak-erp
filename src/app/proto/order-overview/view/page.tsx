/**
 * หน้าที่อยู่ "ข้างใน" กรอบมือถือและปุ่มเปิดเต็มจอ — วาดใบงานหนึ่งแบบเต็มหน้า ไม่มีของหน้าลองปน
 *
 * ทำไมกรอบมือถือต้องเป็น <iframe> ไม่ใช่ div กว้าง 390:
 * ของจริงตัดสินเลย์เอาต์จาก breakpoint ของ "หน้าต่างเบราว์เซอร์" ไม่ใช่ของกล่องที่มันอยู่
 * → ยัด div แคบในหน้าคอม ข้างในจะยังคิดว่าอยู่บนจอ 1440 แล้วโชว์เลย์เอาต์คอมในกรอบมือถือ
 * iframe มีหน้าต่างของตัวเอง กว้าง 390 จริง จึงได้เลย์เอาต์มือถือจริง
 *
 * หน้านี้จงใจเป็น **server component** ที่อ่าน searchParams ตรง ๆ (ไม่ใช่ client ที่อ่าน
 * window.location หลัง hydrate) — ไม่งั้นเปิดลิงก์ `?v=cover` จะเห็นแบบ "ของจริงตอนนี้"
 * แว้บหนึ่งก่อนแล้วค่อยสลับ ซึ่งทำให้ภาพที่เบสเห็นครั้งแรกไม่ใช่แบบที่กดมาดู
 *
 * ธีมไม่ต้องส่งข้าม — iframe อยู่โดเมนเดียวกัน next-themes อ่าน localStorage ตัวเดียวกัน
 */

import { OrderShell } from "../_shell";
import { CoverVariant } from "../_variants/cover";
import { CurrentVariant } from "../_variants/current";
import { PairVariant } from "../_variants/pair";
import { StripVariant } from "../_variants/strip";

export default async function OrderOverviewProtoView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const variant = pick("v") ?? "current";
  const thin = pick("thin") === "1";
  // ค่าเริ่มต้น = เห็นเงิน (เจ้าของ/ฝ่ายขาย) · money=0 คือมุมของช่าง/กราฟิก
  const showMoney = pick("money") !== "0";
  const props = { thin, showMoney };

  return (
    // กล่องเดียวกับ <main> ของเว็บจริง (mx-auto max-w-screen-2xl + ระยะขอบชุดเดียวกัน)
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <OrderShell {...props}>
        {variant === "strip" ? (
          <StripVariant {...props} />
        ) : variant === "pair" ? (
          <PairVariant {...props} />
        ) : variant === "cover" ? (
          <CoverVariant {...props} />
        ) : (
          <CurrentVariant {...props} />
        )}
      </OrderShell>
    </div>
  );
}
