"use client";

/**
 * "ที่ถอดไป" — ใบผลิตเดิม 2 แบบ (legacy กับ V2) ถูกลบ 2026-09-02 และหน้าลอง 20+ แบบก่อนหน้า
 * (ผังสายพานคู่ · จอสถานี · แผงลงมือ) เบสสั่ง "ลืมให้หมด" — เหลือสรุปไว้เป็นตัวตั้งเทียบ
 */

import { ToneMark } from "@/components/ui/section";
import { TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { FileText, Layers3, MonitorUp } from "lucide-react";

const OLD = [
  {
    icon: FileText,
    title: "ใบผลิต legacy (ที่ใช้จริงบนเว็บจนถึง 2 ก.ย.)",
    body: "หัวใบ + แท็บ 4 แท็บ (ขั้นตอน / เบิกของ / ม็อกอัพ / ประวัติ) · การ์ด “ตอนนี้ทำอะไร” · รายการขั้นเป็นแถวข้อความมีปุ่มเล็ก ๆ ท้ายแถว · ปัญหาเปิดใน dialog · ทุกอย่างเป็นตัวหนังสือเทาต่อกันด้วยจุด",
  },
  {
    icon: Layers3,
    title: "Control Record V2 (ยังไม่เคยขึ้นเว็บจริง)",
    body: "ใบสั่งผลิตแบบ ERP/MES: ตาราง operation · quantity ledger ต่อขั้น · exception list · release blocker · ปุ่มจัดการฝั่งหัวหน้าเยอะ · ไม่มีที่ลงมือของช่าง (ไปจอสถานี)",
  },
  {
    icon: MonitorUp,
    title: "หน้าลอง 20+ แบบ (ลบ 2 ก.ย.)",
    body: "ผังสายพานคู่ R3 · จอสถานีขัดเงา · แผงลงมือ · ความหนาแน่น 3 ระดับ — เบสตำหนิว่า “อะไร ๆ ก็เป็น text ธรรมดา” และ “ธีมสีไม่เข้ากับเว็บ” แล้วสั่งเริ่มใหม่ · ห้ามเสนอซ้ำ",
  },
] as const;

export function RemovedVariant() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card-surface rounded-2xl p-5">
        <p className="text-sm font-semibold text-strong">ใบผลิตเดิมมี 2 แบบ + หน้าลองอีก 20 กว่าแบบ</p>
        <ul className="mt-4 space-y-3">
          {OLD.map((item) => (
            <li key={item.title} className="flex gap-3">
              <ToneMark icon={item.icon} tone="production" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-strong">{item.title}</p>
                <p className="text-xs text-secondary">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("rounded-2xl border p-5 text-sm", TINT.warning)}>
        <p className="font-medium">โจทย์ที่เบสตั้ง (2 ก.ย.) — ทางใหม่ทุกทางต้องตอบ 2 ข้อนี้</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>เปิดมาแล้ว<strong>เห็นภาพรวมการผลิตของออเดอร์นี้ทั้งหมด</strong>: ทำอะไร กี่ตัว ส่งเมื่อไร ถึงขั้นไหน ใครทำ ของอยู่ร้านไหน ติดอะไร</li>
          <li><strong>ลงมือได้อย่างมีประสิทธิภาพและมีมาตรฐาน</strong>: ทุกขั้นทำเหมือนกัน (ข้อกำหนดของขั้น → ปุ่มหลักปุ่มเดียว) ไม่ต้องเดา ไม่พึ่งความจำ</li>
        </ul>
      </div>
    </div>
  );
}
