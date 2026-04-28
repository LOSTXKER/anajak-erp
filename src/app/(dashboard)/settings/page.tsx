"use client";

import { useState } from "react";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import {
  Building,
  Palette as PaletteIcon,
  Shield,
  Link2,
  Scissors,
  ChevronRight,
  Wrench,
  Package,
  Settings,
} from "lucide-react";
import Link from "next/link";

type SectionId = "general" | "production" | "security" | "integrations";

const NAV: { id: SectionId; label: string; icon: typeof Building }[] = [
  { id: "general", label: "ข้อมูลโรงงาน", icon: Building },
  { id: "production", label: "การผลิต", icon: PaletteIcon },
  { id: "security", label: "ความปลอดภัย", icon: Shield },
  { id: "integrations", label: "เชื่อมต่อภายนอก", icon: Link2 },
];

const QUICK_LINKS = [
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
      {children}
    </label>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState<SectionId>("general");
  const [dirty, setDirty] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader title="ตั้งค่า" description="ตั้งค่าระบบ Anajak Print" />

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900/80 dark:hover:border-slate-700 dark:hover:bg-slate-800/40"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-300">
              <link.icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
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

      {/* Settings content with sidebar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr]">
        <nav className="space-y-0.5 lg:sticky lg:top-20 lg:self-start">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={cn(
                "relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                active === item.id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              )}
            >
              {active === item.id && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="space-y-4 pb-20">
          {active === "general" && (
            <Section title="ข้อมูลโรงงาน" description="ข้อมูลที่จะแสดงบนเอกสาร">
              <div className="space-y-4">
                <div>
                  <FieldLabel>ชื่อโรงงาน</FieldLabel>
                  <Input placeholder="Anajak Print" onChange={() => setDirty(true)} />
                </div>
                <div>
                  <FieldLabel>ที่อยู่</FieldLabel>
                  <Input placeholder="ที่อยู่โรงงาน" onChange={() => setDirty(true)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>โทรศัพท์</FieldLabel>
                    <Input placeholder="0xx-xxx-xxxx" onChange={() => setDirty(true)} />
                  </div>
                  <div>
                    <FieldLabel>เลขผู้เสียภาษี</FieldLabel>
                    <Input placeholder="Tax ID" onChange={() => setDirty(true)} />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {active === "production" && (
            <Section
              title="ตั้งค่าการผลิต"
              description="กฎเกณฑ์ที่ใช้กับงานผลิตทั้งหมด"
            >
              <div className="space-y-4">
                <div>
                  <FieldLabel>จำนวนแก้ไขแบบฟรี</FieldLabel>
                  <Input
                    type="number"
                    defaultValue={3}
                    min={0}
                    onChange={() => setDirty(true)}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    เกินจำนวนนี้จะมีค่าใช้จ่ายเพิ่ม
                  </p>
                </div>
                <div>
                  <FieldLabel>ค่าแก้ไขต่อครั้ง (บาท)</FieldLabel>
                  <Input
                    type="number"
                    defaultValue={500}
                    min={0}
                    onChange={() => setDirty(true)}
                  />
                </div>
                <div>
                  <FieldLabel>% มัดจำเริ่มต้น</FieldLabel>
                  <Input
                    type="number"
                    defaultValue={50}
                    min={0}
                    max={100}
                    onChange={() => setDirty(true)}
                  />
                </div>
              </div>
            </Section>
          )}

          {active === "security" && (
            <Section title="ป้องกันทุจริต" description="กฎควบคุมการอนุมัติ">
              <div className="space-y-4">
                <div>
                  <FieldLabel>ส่วนลดสูงสุดที่ไม่ต้องอนุมัติ (%)</FieldLabel>
                  <Input
                    type="number"
                    defaultValue={10}
                    min={0}
                    max={100}
                    onChange={() => setDirty(true)}
                  />
                </div>
                <div>
                  <FieldLabel>จำนวนยกเลิกบิล/สัปดาห์ ก่อนแจ้งเตือน</FieldLabel>
                  <Input
                    type="number"
                    defaultValue={3}
                    min={1}
                    onChange={() => setDirty(true)}
                  />
                </div>
              </div>
            </Section>
          )}

          {active === "integrations" && (
            <Section
              title="เชื่อมต่อภายนอก"
              description="API และบริการของบุคคลที่สาม"
              action={
                <Link href="/settings/stock">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                    Stock API
                  </Button>
                </Link>
              }
            >
              <div className="space-y-4">
                <div>
                  <FieldLabel>Anajak Stock API URL</FieldLabel>
                  <Input
                    placeholder="https://stock.anajak.com/api"
                    onChange={() => setDirty(true)}
                  />
                </div>
                <div>
                  <FieldLabel>Anajak Stock API Key</FieldLabel>
                  <Input
                    type="password"
                    placeholder="API Key"
                    onChange={() => setDirty(true)}
                  />
                </div>
                <div>
                  <FieldLabel>LINE OA Channel Token</FieldLabel>
                  <Input
                    type="password"
                    placeholder="Channel Access Token"
                    onChange={() => setDirty(true)}
                  />
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDirty(false)}
              >
                ยกเลิก
              </Button>
              <Button size="sm" onClick={() => setDirty(false)}>
                บันทึกการเปลี่ยนแปลง
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
