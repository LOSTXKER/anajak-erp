"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MonitorUp, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  FOCUS_INSET,
  MENU_ITEM,
  OVERLAY_PANEL,
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
      <div className="flex min-w-0 items-center gap-2">
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
                    ? "border-blue-600 font-semibold text-blue-700 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent font-medium text-muted hover:text-secondary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 px-2.5 font-medium"
            >
              <ScanLine aria-hidden="true" />
              <span className="sm:hidden">หน้างาน</span>
              <span className="hidden sm:inline">พื้นที่หน้างาน</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={cn(OVERLAY_PANEL, "z-50 min-w-48 p-1")}
            >
              {WORKSPACE_ITEMS.map((item) => (
                <DropdownMenu.Item key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={cn(CONTROL_MIN_H, MENU_ITEM, RADIUS.item)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
                      {item.label}
                    </span>
                  </Link>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </nav>
  );
}
