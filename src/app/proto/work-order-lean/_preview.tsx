"use client";

import { Copy, Layers, MessageSquareWarning, MousePointerClick } from "lucide-react";
import { Metric } from "@/components/ui/metric";
import { decisionNumbers, orderFor, type Variant } from "./_data";
import { CurrentE, CutA, HeadC, OneB } from "./_variants";

export { OPTIONS, VALUES } from "./_data";
export type { Variant };

const LABEL: Record<Variant, string> = {
  now: "ปัจจุบัน — ตัวเลข 4 ช่อง → การ์ดแผนที่ → แถบเสื้อ → หัวข้อ + การ์ดขั้น → ถัดไป → พับ 3 กล่อง",
  cut: "A — โครงเดิม แต่ตัวเลข 4 ช่อง / ชิป 3 / ช่องว่างเปล่า / ถัดไป หายไป · คอลัมน์ขวา = เสื้อและลาย / ข้อมูลใบ / ประวัติ (ไม่พับ)",
  one: "B — การ์ดเดียว 2 คอลัมน์: ซ้าย แผนที่ (เป็นแท็บ) → ขั้นที่กด · ขวา เสื้อและลาย / ข้อมูลใบ / ประวัติ (ไม่พับ)",
  head: "C — ประโยคเดียว + ปุ่ม → ซ้าย แถบขั้นย่อ + รายการที่ทำได้ตอนนี้ · ขวา เสื้อและลาย / ข้อมูลใบ / ประวัติ (ไม่พับ)",
};

/**
 * ตัวเลขก่อนตัดสิน + ตัวหน้าลอง · key รีเซ็ตขั้นที่กดค้างไว้เมื่อสลับทาง/ใบ
 * `@container` = ขนาดจอในหน้าลองอ่านจากความกว้างของกรอบนี้ ไม่ใช่หน้าต่าง — กรอบมือถือ 390 บนหน้าเดียวกันจึงพับจริง
 */
export function Preview({ variant, complex, boss, idPrefix, numbers = true }: { variant: Variant; complex: boolean; boss: boolean; idPrefix: string; numbers?: boolean }) {
  const order = orderFor(complex);
  const n = decisionNumbers(variant, order);
  const key = `${variant}-${order.key}-${boss ? 1 : 0}`;
  return (
    <div className="@container space-y-8">
      {numbers ? (
        <section className="space-y-2">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted">ตัวเลขที่ต้องเห็นก่อนตัดสิน — {order.orderNumber} ({order.steps.length} ขั้น)</p>
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <div className="card-surface rounded-2xl p-4">
              <Metric label="กล่องที่เห็นทันทีก่อนกดอะไร" value={n.boxes} unit="กล่อง" size="lg" icon={Layers} tone={n.boxes <= 5 ? "success" : "default"} />
            </div>
            <div className="card-surface rounded-2xl p-4">
              <Metric label="ข้อมูลเดิมที่โชว์ซ้ำ" value={n.duplicates} unit="ที่" size="lg" icon={Copy} tone={n.duplicates === 0 ? "success" : "warning"} />
            </div>
            <div className="card-surface rounded-2xl p-4">
              <Metric label="ศัพท์ภายในที่เห็นทันที" value={n.jargon} unit="คำ" size="lg" icon={MessageSquareWarning} tone={n.jargon === 0 ? "success" : "warning"} />
            </div>
            <div className="card-surface rounded-2xl p-4">
              <Metric label="กดกี่ครั้งเห็นครบทั้งใบ (งาน + ลาย + ข้อมูลใบ + ประวัติ)" value={n.clicks} unit="ครั้ง" size="lg" icon={MousePointerClick} tone={n.clicks === 0 ? "success" : "default"} />
            </div>
          </div>
        </section>
      ) : null}
      <section className="space-y-2">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted">{LABEL[variant]}</p>
        {variant === "now" ? <CurrentE key={key} order={order} boss={boss} idPrefix={idPrefix} /> : variant === "cut" ? <CutA key={key} order={order} boss={boss} idPrefix={idPrefix} /> : variant === "one" ? <OneB key={key} order={order} boss={boss} idPrefix={idPrefix} /> : <HeadC key={key} order={order} boss={boss} idPrefix={idPrefix} />}
      </section>
    </div>
  );
}
