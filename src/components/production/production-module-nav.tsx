"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonitorUp, ScanLine } from "lucide-react";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  FOCUS_INSET,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  RADIUS,
} from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

const MODULE_ITEMS = [
  { href: "/production", label: "คิวผลิต" },
  { href: "/production/print-runs", label: "รอบพิมพ์ DTF" },
  { href: "/production/films", label: "คลังฟิล์ม" },
  { href: "/outsource", label: "งานร้านนอก" },
] as const;

const WORKSPACE_ITEMS = [
  { href: "/factory/station", label: "โหมดสถานี", icon: ScanLine },
  { href: "/factory", label: "จอโรงงาน", icon: MonitorUp },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/production") {
    return (
      pathname === href ||
      (pathname.startsWith("/production/") &&
        !pathname.startsWith("/production/print-runs") &&
        !pathname.startsWith("/production/films"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * แถบนำทางย่อยของโมดูลผลิตภายใน AppShell เดิม
 * หน้าสถานีและจอโรงงานเป็นพื้นที่ใช้งานเฉพาะ จึงแยกเป็นทางเข้าเสริมแทนแท็บหลัก
 */
export function ProductionModuleNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ส่วนงานผลิต"
      data-production-module-nav=""
      className={cn("border-b border-divider", className)}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3">
        <div className="no-scrollbar -mb-px flex min-w-0 flex-1 overflow-x-auto">
          {MODULE_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_INSET,
                  "inline-flex shrink-0 items-center border-b-2 px-2 text-sm transition-colors",
                  active
                    ? "border-blue-600 font-semibold text-strong dark:border-blue-400"
                    : "border-transparent font-medium text-muted hover:text-secondary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="พื้นที่หน้างาน"
          className="flex w-full shrink-0 items-center gap-1 border-t border-divider py-2 sm:w-auto sm:border-l sm:border-t-0 sm:pl-3"
        >
          {WORKSPACE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_INSET,
                RADIUS.item,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                "inline-flex items-center gap-1.5 px-2 text-sm font-medium text-secondary transition-colors",
              )}
            >
              <item.icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
