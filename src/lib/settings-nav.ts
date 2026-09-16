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
   ============================================================ */

export const SETTING_GROUPS = ["กิจการและทีม", "การผลิตและบริการ", "ระบบและข้อมูล"] as const;

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
    group: "กิจการและทีม",
    icon: Building,
    title: "ข้อมูลกิจการ",
    meta: "ชื่อ · ที่อยู่ · เลขผู้เสียภาษี",
    tone: "system",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/users",
    group: "กิจการและทีม",
    icon: Users,
    title: "จัดการผู้ใช้",
    meta: "บัญชี · สิทธิ์ · รหัสผ่าน",
    tone: "system",
    permissionsAny: ["manage_users"],
  },
  {
    href: "/settings/stock",
    group: "ระบบและข้อมูล",
    icon: Cloud,
    title: "สต๊อกเสื้อ",
    meta: "จอง · เบิก · คืนเสื้อ",
    tone: "product",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/vendors",
    group: "การผลิตและบริการ",
    icon: Store,
    title: "ร้านรับจ้างภายนอก",
    meta: "DTG · สกรีน · ปัก · ตัดเย็บ",
    tone: "production",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/cost-rates",
    group: "การผลิตและบริการ",
    icon: Calculator,
    title: "เรตต้นทุนกลาง",
    meta: "ฟิล์ม · ค่าแรง · กำไรประมาณการ",
    tone: "finance",
    permissionsAny: ["see_finance"],
  },
  {
    href: "/settings/services",
    group: "การผลิตและบริการ",
    icon: Wrench,
    title: "จัดการบริการ",
    meta: "Add-ons · สกรีน · ค่าบริการ",
    tone: "product",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/patterns",
    group: "การผลิตและบริการ",
    icon: Scissors,
    title: "จัดการแพทเทิร์น",
    meta: "แพทเทิร์นงานตัดเย็บ",
    tone: "product",
    permissionsAny: ["create_design_assets", "manage_design_files", "manage_settings"],
  },
  {
    href: "/settings/routings",
    group: "การผลิตและบริการ",
    icon: Workflow,
    title: "สูตรขั้นงาน",
    meta: "ขั้นตอนผลิต · ทำเอง/ส่งร้าน · ขั้นที่ต้องเสร็จก่อน",
    tone: "production",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/packaging",
    group: "การผลิตและบริการ",
    icon: Package,
    title: "จัดการแพ็คเกจ",
    meta: "ตัวเลือกสำหรับจัดส่ง",
    tone: "product",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/backup",
    group: "ระบบและข้อมูล",
    icon: HardDriveDownload,
    title: "สำรองข้อมูล",
    meta: "ดาวน์โหลดข้อมูล · เจ้าของเท่านั้น",
    tone: "system",
    permissionsAny: ["manage_users"],
  },
  {
    href: "/settings/audit",
    group: "ระบบและข้อมูล",
    icon: History,
    title: "ประวัติระบบ",
    meta: "ผู้แก้ไข · รายการ · เวลา",
    tone: "system",
    permissionsAny: ["view_admin_reports"],
  },
];
