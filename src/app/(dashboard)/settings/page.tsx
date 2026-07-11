"use client";

import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/page-header";
import {
  Building,
  Calculator,
  Cloud,
  Scissors,
  ChevronRight,
  Wrench,
  Package,
  Users,
  HardDriveDownload,
  Store,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows, type Permission } from "@/lib/permissions";
import { QueryError } from "@/components/ui/query-error";

// หน้าตั้งค่า = hub ลิงก์ไปหน้าตั้งค่าจริงเท่านั้น (Gate B8) — ฟอร์มปลอม 4 section เดิม
// (ข้อมูลโรงงาน/การผลิต/ความปลอดภัย/เชื่อมต่อภายนอก) ถูกถอดทิ้ง: input ไม่ผูกอะไร
// ปุ่ม "บันทึก" แค่ปิดแถบ = ระบบโกหกผู้ใช้ (audit 2026-07-02 จัด BLOCKER ความเชื่อใจ)
// ตั้งค่าที่จำเป็นจริง (% มัดจำ/เพดานส่วนลด/ฟรีแก้แบบ) ค่อยทำเป็นชิ้นๆ เมื่อมี use case
// พร้อมท่อจริงถึง logic — ห้ามขึ้นฟอร์มก่อนมีของ

interface SettingLink {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  permissionsAny?: readonly Permission[];
}

const SETTING_LINKS: readonly SettingLink[] = [
  {
    href: "/settings/company",
    icon: Building,
    title: "ข้อมูลกิจการ",
    description: "ชื่อ/ที่อยู่/เลขผู้เสียภาษี — ขึ้นหัวเอกสารและใบกำกับภาษี",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/users",
    icon: Users,
    title: "จัดการผู้ใช้",
    description: "บัญชีพนักงาน สิทธิ์ และรหัสผ่าน",
    permissionsAny: ["manage_users"],
  },
  {
    href: "/settings/stock",
    icon: Cloud,
    title: "เชื่อมต่อ Anajak Stock",
    description: "API URL/Key ระบบสต๊อกเสื้อ — จอง/เบิก/คืนใช้ท่อนี้",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/vendors",
    icon: Store,
    title: "ร้านรับจ้างภายนอก",
    description: "ทะเบียนร้านสำหรับงาน DTG, สกรีน, ปัก, ตัดเย็บ และป้ายคอ",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/cost-rates",
    icon: Calculator,
    title: "เรตต้นทุนกลาง",
    description: "เรตฟิล์ม/ค่าแรงเหมา — กำไรขั้นต้นโดยประมาณตอนตีราคา",
    permissionsAny: ["see_finance"],
  },
  {
    href: "/settings/services",
    icon: Wrench,
    title: "จัดการบริการ",
    description: "Add-ons, สกรีน, ค่าบริการ",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/patterns",
    icon: Scissors,
    title: "จัดการแพทเทิร์น",
    description: "แพทเทิร์นสำเร็จรูปสำหรับงานตัดเย็บ",
    permissionsAny: ["create_design_assets", "manage_design_files", "manage_settings"],
  },
  {
    href: "/settings/packaging",
    icon: Package,
    title: "จัดการแพ็คเกจ",
    description: "ตัวเลือกแพ็คเกจสำหรับจัดส่ง",
    permissionsAny: ["manage_settings"],
  },
  {
    href: "/settings/backup",
    icon: HardDriveDownload,
    title: "สำรองข้อมูล",
    description: "ดาวน์โหลดข้อมูลทั้งระบบเก็บไว้เอง (เจ้าของเท่านั้น)",
    permissionsAny: ["manage_users"],
  },
  {
    href: "/settings/audit",
    icon: History,
    title: "ประวัติระบบ",
    description: "ตรวจว่าใครเปลี่ยนข้อมูลอะไร เมื่อไหร่",
    permissionsAny: ["view_admin_reports"],
  },
];

export default function SettingsPage() {
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const visibleLinks = SETTING_LINKS.filter((link) =>
    !link.permissionsAny || link.permissionsAny.some((permission) =>
      permAllows(me?.permissions, permission)
    )
  );

  if (meQuery.isError) {
    return (
      <QueryError
        message="โหลดสิทธิ์สำหรับหน้าตั้งค่าไม่สำเร็จ"
        onRetry={() => void meQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="ตั้งค่า" description="ตั้งค่าระบบ Anajak Print" />

      <Section title="หมวดตั้งค่า" description="ทุกหน้าในนี้บันทึกจริง — แก้แล้วมีผลกับระบบทันที">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group card-surface card-surface-hover flex items-center gap-3 rounded-2xl p-3.5 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-300">
                <link.icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {link.title}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {link.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
