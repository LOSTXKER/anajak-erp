"use client";

/**
 * "ที่ถอดไป" — ของเดิมไม่มีให้เรนเดอร์แล้ว (เบสสั่งลบทั้งโมดูล 2026-09-02 และสั่ง "ลืมให้หมด")
 * แต่กติกาหน้าลองบังคับให้มีของเดิมเป็นตัวตั้ง จึงเหลือเป็นคำอธิบายว่าเคยเป็นอะไร
 * และอะไรที่ทำให้เบสสั่งลบ — เพื่อให้เทียบได้ว่า "ดีขึ้นจริงไหม" ไม่ใช่เลือกจากความรู้สึกล้วน
 */

import { Factory, MonitorUp, ScanLine, Layers3, Printer, Handshake } from "lucide-react";
import { ToneMark } from "@/components/ui/section";
import { TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

const PAGES = [
  {
    icon: Factory,
    title: "/production — รายการผลิต",
    body: "ตาราง 1 ออเดอร์ต่อแถว · ชิปกรองเป็นสายพานขั้นงาน (ตัวเลขนำ + ลูกศร) · ตารางแบ่งกลุ่มตามกำหนดส่ง · คอลัมน์เส้นทางงานเป็นแถบแบ่งช่วงสี · ปุ่มเปิดใบผลิตอยู่หน้านี้",
  },
  {
    icon: ScanLine,
    title: "/factory/station — จอสถานี",
    body: "เลือก 1 ใน 5 สถานีก่อน → เห็นคิวของสถานีนั้น (กำลังทำ → พร้อมทำ → ติดปัญหา) → เปิดใบแล้วมีปุ่มลงมือปุ่มเดียว · สแกน QR เปิดบริบท · DTF เป็นรอบพิมพ์แยก",
  },
  {
    icon: Printer,
    title: "/production/print-runs — รอบพิมพ์ DTF",
    body: "workspace สองฝั่ง: กำลังพิมพ์ → ตัดแยก/ติดป้าย → คิวพิมพ์ → ประวัติ 7 วัน",
  },
  {
    icon: Layers3,
    title: "/production/films — คลังฟิล์ม",
    body: "รายการฟิล์มที่พิมพ์แล้วยังไม่รีด แยกตามลาย/ลูกค้า",
  },
  {
    icon: Handshake,
    title: "/outsource — คิวร้านนอก",
    body: "ส่งร้าน / รับกลับ / ตรวจรับจากร้าน / ประวัติ",
  },
  {
    icon: MonitorUp,
    title: "/factory — จอโรงงาน (TV)",
    body: "ยังอยู่ — กระดาน 5 ด่านอ่านอย่างเดียว ไม่ได้ถูกถอด",
  },
] as const;

export function RemovedVariant() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card-surface rounded-2xl p-5">
        <p className="text-sm font-semibold text-strong">โมดูลผลิตเดิม = 6 หน้า 3 ทางเข้า</p>
        <p className="mt-1 text-sm text-secondary">
          หัวหน้าเข้าทางรายการ · ช่างเข้าทางจอสถานี · ทีวีดูจอโรงงาน — งานเดียวกันโผล่ 3 ที่
          คนละหน้าตา และรอบพิมพ์/คลังฟิล์ม/ร้านนอกแยกเป็นหน้าของตัวเองอีก 3 หน้า
        </p>
        <ul className="mt-4 space-y-3">
          {PAGES.map((page) => (
            <li key={page.title} className="flex gap-3">
              <ToneMark icon={page.icon} tone="production" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-strong">{page.title}</p>
                <p className="text-xs text-secondary">{page.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("rounded-2xl border p-5 text-sm", TINT.warning)}>
        <p className="font-medium">ทำไมถึงถอด (สิ่งที่ทางใหม่ทุกทางต้องแก้ให้ได้)</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>เปิดหน้ามาแล้วยังต้องคิดว่า “ต้องไปหน้าไหนต่อ” — ทางเข้าเยอะกว่าคนใช้ (ทีม 5 คน)</li>
          <li>รายการเป็นบรรทัดเทาเท่ากันหมด จุดที่ต้องรีบ (เลยกำหนด · ของร้านนอกยังไม่กลับ · ติดปัญหา) ไม่เด้งออกมา</li>
          <li>งานร้านนอกไม่รู้ในหน้าเดียวว่าอยู่ร้านไหน กลับเมื่อไร — ต้องไปอีกหน้า</li>
          <li>จอสถานีกับรายการเป็นคนละแอป คนละหน้าตา ช่างกับหัวหน้าคุยกันคนละภาพ</li>
        </ul>
      </div>
    </div>
  );
}
