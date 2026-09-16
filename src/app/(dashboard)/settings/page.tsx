"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON, INTERACTIVE_PAGE_PRESSED } from "@/components/ui/tokens";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { SETTING_GROUPS, SETTING_LINKS } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";
import { VISUAL_TONE_CLASSES } from "@/lib/visual-tone";

// หน้าตั้งค่า = ทางเข้าหน้าตั้งค่าจริงเท่านั้น (Gate B8) — ฟอร์มปลอม 4 section เดิม
// (ข้อมูลโรงงาน/การผลิต/ความปลอดภัย/เชื่อมต่อภายนอก) ถูกถอดทิ้ง: input ไม่ผูกอะไร
// ปุ่ม "บันทึก" แค่ปิดแถบ = ระบบโกหกผู้ใช้ (audit 2026-07-02 จัด BLOCKER ความเชื่อใจ)
// 2026-09-16: เมนูข้างย้ายไป layout แล้ว หน้านี้จึงเหลือรายการพร้อมคำอธิบายว่าแต่ละหัวข้อตั้งอะไร
export default function SettingsPage() {
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const visibleLinks = SETTING_LINKS.filter(
    (link) =>
      !link.permissionsAny ||
      link.permissionsAny.some((permission) => permAllows(me?.permissions, permission)),
  );
  const grouped = SETTING_GROUPS.map(
    (group) => [group, visibleLinks.filter((link) => link.group === group)] as const,
  ).filter(([, links]) => links.length > 0);

  return (
    <PageShell
      title="ตั้งค่า"
      meta="การเปลี่ยนค่ามีผลกับงานจริงทันที"
      loading={meQuery.isLoading}
      error={
        meQuery.isError
          ? { message: "โหลดสิทธิ์สำหรับหน้าตั้งค่าไม่สำเร็จ", onRetry: () => void meQuery.refetch() }
          : null
      }
      skeleton={<Skeleton className="h-[420px] rounded-2xl" />}
    >
      <div className="card-surface overflow-hidden rounded-2xl">
        {grouped.map(([group, links]) => (
          <div key={group}>
            <p className="border-b border-divider/60 bg-surface-muted px-4.5 py-2 text-xs font-medium text-muted">
              {group}
            </p>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 border-b border-divider/60 px-4.5 py-3 last:border-b-0",
                  FOCUS_BUTTON,
                  INTERACTIVE_PAGE_PRESSED,
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-[11px]",
                    VISUAL_TONE_CLASSES[link.tone].soft,
                  )}
                >
                  <link.icon
                    className={"h-4 w-4"}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-strong">{link.title}</span>
                  <span className="mt-0.5 block text-xs text-secondary">{link.meta}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ))}
      </div>
    </PageShell>
  );
}
