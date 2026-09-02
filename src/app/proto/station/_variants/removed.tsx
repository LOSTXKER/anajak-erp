"use client";

/**
 * "ที่ถอดไป" — จอสถานี `/factory/station` 2 รุ่น (legacy + V2) ถูกลบ 2026-09-02 ตามที่เบสสั่ง "ออกแบบใหม่"
 * เหลือสรุปไว้เป็นตัวตั้งเทียบ + สิ่งที่จอใหม่ต้องไม่ทำหาย
 */

import { ToneMark } from "@/components/ui/section";
import { TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { Layers3, MonitorUp, ScanLine } from "lucide-react";

const OLD = [
  {
    icon: MonitorUp,
    title: "จอสถานี legacy (ใช้จริงบนเว็บจนถึง 2 ก.ย.)",
    body: "เต็มจอธีมมืด ไม่มีเมนูข้าง · หน้าแรกเลือก 1 ใน 5 สถานีตายตัวในโค้ด (เตรียมเสื้อ · พิมพ์ DTF · รีดร้อน · QC · แพ็ก) · คิวเรียง กำลังทำ → พร้อมทำ → ติดปัญหา → ช่องสแกน · เปิดงานแล้วงานปัจจุบันเป็นผืนหลัก มีปุ่มหลักปุ่มเดียว · เพิ่มสถานีใหม่ต้องแก้โค้ด",
  },
  {
    icon: Layers3,
    title: "จอสถานี V2 (ยังไม่เคยขึ้นเว็บจริง)",
    body: "ผูกกับ work center ในหน้าตั้งค่า (ต่อเติมได้) · server เป็นคนบอกว่าปุ่มไหนกดได้ (availableCommands) · แต่หน้าจอเป็น ERP/MES เต็มรูป: ตาราง operation · quantity ledger · exception list — ช่างที่ไม่ถนัดคอมอ่านไม่ออกว่าต้องกดอะไร",
  },
  {
    icon: ScanLine,
    title: "สิ่งที่ทั้งสองรุ่นไม่มี",
    body: "ที่ให้หัวหน้า “แก้ให้” ต่อสถานี (ช่างกดปิดผิด นับผิด กดรับงานผิดคน) — ต้องไปหาในใบผลิตทีละใบ · แจ้งปัญหาต้องพิมพ์ · ไม่มีย้อนกลับหลังกดผิด · ไม่มีวิธีเปลี่ยนคนบนจอที่ใช้ร่วมกันนอกจากออกจากระบบ",
  },
] as const;

export function RemovedVariant() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card-surface rounded-2xl p-5">
        <p className="text-sm font-semibold text-strong">จอสถานีเดิมมี 2 รุ่น</p>
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
        <p className="font-medium">โจทย์ที่เบสตั้ง (3 ก.ย.) — ทางใหม่ทุกทางต้องตอบ 3 ข้อนี้</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li><strong>พนักงานไม่เก่งคอม</strong> — ดูง่าย ใช้ง่าย เปิดมาแล้วรู้ว่าต้องทำอะไร ปุ่มใหญ่ ปุ่มเดียว ไม่ต้องพิมพ์</li>
          <li><strong>หัวหน้าจัดการได้แต่ละสถานี</strong> — ช่างงงหรือกดมั่ว หัวหน้าเห็นและแก้ให้ได้เลย ไม่ต้องไปไล่หาในใบผลิต</li>
          <li><strong>ต่อเติมในอนาคตได้</strong> — เพิ่มสถานี / เพิ่มขั้นแบบใหม่ / ส่งร้านนอก โดยไม่ต้องรื้อจอ</li>
        </ul>
        <p className="mt-3 text-xs">
          ที่ต้องไม่ทำหาย: เบิกเสื้อผ่านสต๊อกจริง · DTF ผ่านรอบพิมพ์ · รับเสื้อลูกค้าผ่านใบตรวจรับ · QC บันทึกของเสียพร้อมรูป · ร้านนอกมีนัดรับ/ตรวจรับ · จอสถานีไม่มีเงิน · ทุกปุ่มผ่านสิทธิ์และกติกาฝั่ง server เดิม
        </p>
      </div>
    </div>
  );
}
