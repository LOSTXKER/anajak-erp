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
} from "lucide-react";
import Link from "next/link";

// หน้าตั้งค่า = hub ลิงก์ไปหน้าตั้งค่าจริงเท่านั้น (Gate B8) — ฟอร์มปลอม 4 section เดิม
// (ข้อมูลโรงงาน/การผลิต/ความปลอดภัย/เชื่อมต่อภายนอก) ถูกถอดทิ้ง: input ไม่ผูกอะไร
// ปุ่ม "บันทึก" แค่ปิดแถบ = ระบบโกหกผู้ใช้ (audit 2026-07-02 จัด BLOCKER ความเชื่อใจ)
// ตั้งค่าที่จำเป็นจริง (% มัดจำ/เพดานส่วนลด/ฟรีแก้แบบ) ค่อยทำเป็นชิ้นๆ เมื่อมี use case
// พร้อมท่อจริงถึง logic — ห้ามขึ้นฟอร์มก่อนมีของ

const SETTING_LINKS = [
  {
    href: "/settings/company",
    icon: Building,
    title: "ข้อมูลกิจการ",
    description: "ชื่อ/ที่อยู่/เลขผู้เสียภาษี — ขึ้นหัวเอกสารและใบกำกับภาษี",
  },
  {
    href: "/settings/users",
    icon: Users,
    title: "จัดการผู้ใช้",
    description: "บัญชีพนักงาน สิทธิ์ และรหัสผ่าน",
  },
  {
    href: "/settings/stock",
    icon: Cloud,
    title: "เชื่อมต่อ Anajak Stock",
    description: "API URL/Key ระบบสต๊อกเสื้อ — จอง/เบิก/คืนใช้ท่อนี้",
  },
  {
    href: "/settings/cost-rates",
    icon: Calculator,
    title: "เรตต้นทุนกลาง",
    description: "เรตฟิล์ม/ค่าแรงเหมา — กำไรขั้นต้นโดยประมาณตอนตีราคา",
  },
  {
    href: "/settings/services",
    icon: Wrench,
    title: "จัดการบริการ",
    description: "Add-ons, สกรีน, ค่าบริการ",
  },
  {
    href: "/settings/patterns",
    icon: Scissors,
    title: "จัดการแพทเทิร์น",
    description: "แพทเทิร์นสำเร็จรูปสำหรับงานตัดเย็บ",
  },
  {
    href: "/settings/packaging",
    icon: Package,
    title: "จัดการแพ็คเกจ",
    description: "ตัวเลือกแพ็คเกจสำหรับจัดส่ง",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="ตั้งค่า" description="ตั้งค่าระบบ Anajak Print" />

      <Section title="หมวดตั้งค่า" description="ทุกหน้าในนี้บันทึกจริง — แก้แล้วมีผลกับระบบทันที">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SETTING_LINKS.map((link) => (
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
