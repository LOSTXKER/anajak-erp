"use client";

import { Section } from "@/components/ui/section";
import { PageShell } from "@/components/page-shell";
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
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows, type Permission } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { VISUAL_TONE_CLASSES, type VisualTone } from "@/lib/visual-tone";

// หน้าตั้งค่า = hub ลิงก์ไปหน้าตั้งค่าจริงเท่านั้น (Gate B8) — ฟอร์มปลอม 4 section เดิม
// (ข้อมูลโรงงาน/การผลิต/ความปลอดภัย/เชื่อมต่อภายนอก) ถูกถอดทิ้ง: input ไม่ผูกอะไร
// ปุ่ม "บันทึก" แค่ปิดแถบ = ระบบโกหกผู้ใช้ (audit 2026-07-02 จัด BLOCKER ความเชื่อใจ)
// ตั้งค่าที่จำเป็นจริง (% มัดจำ/เพดานส่วนลด/ฟรีแก้แบบ) ค่อยทำเป็นชิ้นๆ เมื่อมี use case
// พร้อมท่อจริงถึง logic — ห้ามขึ้นฟอร์มก่อนมีของ

interface SettingLink {
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
  tone: VisualTone;
  permissionsAny?: readonly Permission[];
  // จัดกลุ่ม hub ให้สแกนเจอเร็ว (UX4) — เดิม 10 ลิงก์แบนเรียงติดกันไม่มีหมวด
  group: "กิจการและทีม" | "การผลิตและบริการ" | "ระบบและข้อมูล";
}

const SETTING_GROUPS = ["กิจการและทีม", "การผลิตและบริการ", "ระบบและข้อมูล"] as const;

const SETTING_LINKS: readonly SettingLink[] = [
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
    meta: "บริการเสริม · สกรีน · ค่าบริการ",
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

export default function SettingsPage() {
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const visibleLinks = SETTING_LINKS.filter((link) =>
    !link.permissionsAny || link.permissionsAny.some((permission) =>
      permAllows(me?.permissions, permission)
    )
  );

  return (
    <PageShell
      title="ตั้งค่า"
      meta="การเปลี่ยนค่ามีผลกับงานจริงทันที"
      loading={meQuery.isLoading}
      error={meQuery.isError ? {
        message: "โหลดสิทธิ์สำหรับหน้าตั้งค่าไม่สำเร็จ",
        onRetry: () => void meQuery.refetch(),
      } : null}
      skeleton={SETTING_GROUPS.map((group) => (
          <div key={group} className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-3">
              {SETTING_LINKS.filter((link) => link.group === group).map((link) => (
                <Skeleton key={link.href} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
    >
      {SETTING_GROUPS.map((group) => {
        const links = visibleLinks.filter((link) => link.group === group);
        if (links.length === 0) return null;
        return (
          <Section key={group} title={group} bordered={false} className="grid gap-1 sm:gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="divide-y divide-divider border-y border-divider">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn("group flex items-center gap-4 px-3 py-4 transition-colors hover:bg-interactive-hover active:bg-interactive-pressed", FOCUS_BUTTON)}
                >
                  <link.icon
                    className={cn("h-5 w-5 shrink-0", VISUAL_TONE_CLASSES[link.tone].mark)}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:items-center sm:gap-4">
                    <p className="break-words text-sm font-medium text-strong">
                      {link.title}
                    </p>
                    <p className="text-sm leading-relaxed text-secondary">
                      {link.meta}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </Section>
        );
      })}
    </PageShell>
  );
}
