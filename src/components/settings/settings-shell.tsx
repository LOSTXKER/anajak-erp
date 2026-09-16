"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { SETTING_GROUPS, SETTING_LINKS } from "@/lib/settings-nav";
import { FOCUS_BUTTON, INTERACTIVE_PAGE_PRESSED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/* ============================================================
   โครงหน้าตั้งค่า — เมนูข้างค้างทุกหน้าย่อย (เบสสั่ง 2026-09-16 "หน้าตั้งค่าขอฟีล sidebar")
   เดิมต้องกด "ย้อนกลับ" ไปหน้ารวมก่อนถึงจะไปหัวข้ออื่นได้ · ตอนนี้สลับได้จากเมนูเลย
   จอแคบ (< lg) เมนูเปลี่ยนเป็นแถบเลื่อนแนวนอนด้านบน ไม่กินพื้นที่เนื้อหา
   สิทธิ์: กรองด้วยชุดเดียวกับหน้ารวม — หัวข้อที่ไม่มีสิทธิ์ไม่ขึ้นในเมนู
   ============================================================ */

export function SettingsNav() {
  const pathname = usePathname();
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const links = SETTING_LINKS.filter(
    (link) =>
      !link.permissionsAny ||
      link.permissionsAny.some((permission) => permAllows(me?.permissions, permission)),
  );

  const grouped = SETTING_GROUPS.map(
    (group) => [group, links.filter((link) => link.group === group)] as const,
  ).filter(([, inGroup]) => inGroup.length > 0);

  const item = (href: string, title: string, Icon: typeof Settings) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap lg:whitespace-normal",
          FOCUS_BUTTON,
          INTERACTIVE_PAGE_PRESSED,
          active ? "bg-module-brand-surface font-medium text-module-brand-text" : "text-secondary",
        )}
      >
        <Icon
          className={cn("h-4 w-4 shrink-0", active ? "text-module-brand-text" : "text-muted")}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="min-w-0">{title}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="เมนูตั้งค่า"
      // top-27 = 108px ตามต้นแบบ (.setnav{position:sticky;top:108px}) — พ้นแถบบนของแอปที่ค้างอยู่
      // เดิม top-24 (96px) ทำให้หัวเมนูเบียดใต้แถบบนตอนเลื่อนหน้ายาว
      className="card-surface flex gap-1.5 overflow-x-auto rounded-2xl p-2 lg:sticky lg:top-27 lg:grid lg:gap-0.5 lg:overflow-visible lg:p-2.5"
    >
      <div className="lg:mb-1 lg:border-b lg:border-divider/70 lg:pb-2">
        {item("/settings", "ภาพรวมการตั้งค่า", Settings)}
      </div>
      {grouped.map(([group, inGroup]) => (
        <div key={group} className="contents lg:block">
          <p className="mt-2.5 mb-0.5 hidden px-2.5 text-xs font-medium text-muted lg:block">{group}</p>
          {inGroup.map((link) => item(link.href, link.title, link.icon))}
        </div>
      ))}
    </nav>
  );
}

export function SettingsShell({ children }: { children: ReactNode }) {
  return (
    // gap 18px + คอลัมน์เมนู 236px ตามต้นแบบ (.setwrap)
    <div className="grid items-start gap-4.5 lg:grid-cols-[236px_minmax(0,1fr)]">
      <SettingsNav />
      <div className="min-w-0 space-y-4.5">{children}</div>
    </div>
  );
}
