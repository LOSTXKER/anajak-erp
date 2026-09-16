import {
  Building,
  Calculator,
  Cloud,
  HardDriveDownload,
  History,
  Package,
  Scissors,
  Store,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { VisualTone } from "@/lib/visual-tone";

/* ============================================================
   รายการหน้าตั้งค่า — แหล่งเดียวของทั้งเมนูข้างและหน้ารวม (เบสสั่ง 2026-09-16 "ขอฟีล sidebar")
   เดิมรายการนี้อยู่ในหน้ารวมไฟล์เดียว พอมีเมนูข้างที่ต้องขึ้นทุกหน้าย่อยจึงต้องใช้ร่วมกัน
   สิทธิ์ยังกรองที่จุดใช้เหมือนเดิม (permAllows) — ไฟล์นี้เก็บแค่รายการกับป้าย

   ชื่อกลุ่ม ลำดับ และป้ายหัวข้อยกตามต้นแบบทั้งเว็บที่เบสเคาะ 2026-09-16 (SETS):
   กิจการ · งานผลิต · ของและร้าน — ป้ายเป็นชื่อของสิ่งนั้น ไม่ขึ้นต้นด้วย "จัดการ"
   ============================================================ */

export const SETTING_GROUPS = ["กิจการ", "งานผลิต", "ของและร้าน"] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number];

export interface SettingLink {
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
  tone: VisualTone;
  permissionsAny?: readonly Permission[];
  group: SettingGroup;
}

export const SETTING_LINKS: readonly SettingLink[] = [
  {
    href: "/settings/company",
    group: "กิจการ",
    icon: Building,
    title: "ข้อมูลกิจการ",
    meta: "ชื่อ · ที่อยู่ · เลขผู้เสียภาษี",
    tone: "system",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/users",
    group: "กิจการ",
    icon: Users,
    title: "ผู้ใช้และสิทธิ์",
    meta: "บัญชี · สิทธิ์ · รหัสผ่าน",
    tone: "system",
    permissionsAny: ["manage_users"],
  },
  {
    href: "/settings/backup",
    group: "กิจการ",
    icon: HardDriveDownload,
    title: "สำรองข้อมูล",
    meta: "ดาวน์โหลดข้อมูล · เจ้าของเท่านั้น",
    tone: "system",
    permissionsAny: ["manage_users"],
  },
  {
    href: "/settings/audit",
    group: "กิจการ",
    icon: History,
    title: "ประวัติระบบ",
    meta: "ผู้แก้ไข · รายการ · เวลา",
    tone: "system",
    permissionsAny: ["view_admin_reports"],
  },
  {
    href: "/settings/services",
    group: "งานผลิต",
    icon: Wrench,
    title: "บริการและราคา",
    meta: "Add-ons · สกรีน · ค่าบริการ",
    tone: "product",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/routings",
    group: "งานผลิต",
    icon: Workflow,
    title: "สูตรขั้นงาน",
    meta: "ขั้นตอนผลิต · ทำเอง/ส่งร้าน · ขั้นที่ต้องเสร็จก่อน",
    tone: "production",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/patterns",
    group: "งานผลิต",
    icon: Scissors,
    title: "แพทเทิร์น",
    meta: "แพทเทิร์นงานตัดเย็บ",
    tone: "product",
    permissionsAny: ["create_design_assets", "manage_design_files", "manage_settings"],
  },
  {
    href: "/settings/cost-rates",
    group: "งานผลิต",
    icon: Calculator,
    title: "เรตต้นทุนกลาง",
    meta: "ฟิล์ม · ค่าแรง · กำไรประมาณการ",
    tone: "finance",
    permissionsAny: ["see_finance"],
  },
  {
    href: "/settings/stock",
    group: "ของและร้าน",
    icon: Cloud,
    title: "สต๊อกเสื้อ",
    meta: "จอง · เบิก · คืนเสื้อ",
    tone: "product",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/vendors",
    group: "ของและร้าน",
    icon: Store,
    title: "ร้านรับจ้างภายนอก",
    meta: "DTG · สกรีน · ปัก · ตัดเย็บ",
    tone: "production",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/packaging",
    group: "ของและร้าน",
    icon: Package,
    title: "แพ็คเกจจัดส่ง",
    meta: "ตัวเลือกสำหรับจัดส่ง",
    tone: "product",
    permissionsAny: ["manage_settings"],
  },
];

/* หัวข้อที่หน้ารวมยกขึ้นการ์ด "สรุปการตั้งค่าที่ใช้อยู่" พร้อมข้อเท็จจริงของระบบ (ต้นแบบ 6 แถว)
   ที่เหลืออยู่การ์ด "ตั้งค่าอื่น" — ทุกหัวข้อยังเข้าถึงได้จากเมนูข้างทั้งจอกว้างและจอแคบ */
export const SETTING_SUMMARY_HREFS = [
  "/settings/company",
  "/settings/users",
  "/settings/services",
  "/settings/stock",
  "/settings/vendors",
  "/settings/backup",
] as const;
