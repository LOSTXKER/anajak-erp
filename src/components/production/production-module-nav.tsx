"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Factory,
  Handshake,
  Layers3,
  LayoutList,
  MonitorUp,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  MENU_ITEM,
  MENU_SEPARATOR,
  OVERLAY_PANEL,
  RADIUS,
} from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

const MODULE_ITEMS = [
  { href: "/production", label: "คิวผลิต", icon: LayoutList },
  { href: "/production/print-runs", label: "รอบพิมพ์ DTF", icon: Printer },
  { href: "/production/films", label: "คลังฟิล์ม", icon: Layers3 },
  { href: "/outsource", label: "งานร้านนอก", icon: Handshake },
] as const;

// จอสถานี (/factory/station) ถูกถอดออก 2026-09-02 — รอออกแบบใหม่ก่อนค่อยกลับมาใส่ทางเข้า
const WORKSPACE_ITEMS = [
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

/** เมนูรวมทางเข้าโมดูลผลิต — ซ่อน complexity จนกว่าจะต้องสลับพื้นที่ */
export function ProductionModuleNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("shrink-0 font-medium", className)}
          aria-label="เมนูงานผลิต"
        >
          <Factory aria-hidden="true" />
          งานผลิต
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(OVERLAY_PANEL, "z-50 min-w-52 p-1")}
        >
          {MODULE_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <DropdownMenu.Item key={item.href} asChild>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    CONTROL_MIN_H,
                    MENU_ITEM,
                    RADIUS.item,
                    active && "bg-interactive-selected font-medium text-interactive-selected-text",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <item.icon className="h-4 w-4" strokeWidth={1.75} />
                    {item.label}
                  </span>
                </Link>
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className={MENU_SEPARATOR} />
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
  );
}
