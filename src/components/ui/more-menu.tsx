"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { LucideIcon } from "lucide-react";
import { Ellipsis } from "lucide-react";
import { Button } from "./button";
import { RADIUS } from "./tokens";
import { cn } from "@/lib/utils";

/* ============================================================
   MoreMenu — เมนู "เพิ่มเติม" สำหรับคำสั่งที่นาน ๆ ใช้ (เพิ่ม 2026-09-03 · เบสเคาะ A จาก /proto/action-zone)

   ที่มา: โซนลงมือมี 4 ปุ่มเท่ากัน เบสทัก "CTA ดูเยอะ อัดกัน" จึงแยกตามความถี่:
   ของที่ทำทุกวันเป็นปุ่ม ส่วนของที่นาน ๆ ทำ (เช่น บันทึกรายละเอียด และแก้ให้) ซ่อนไว้ที่นี่
   กติกา: รายการที่ทำไม่ได้ให้ disabled + `hint` บอกเหตุ (ไม่ซ่อน — คนต้องรู้ว่ามีแต่ทำไม่ได้เพราะอะไร)
   ============================================================ */

export type MoreMenuItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** คำอธิบายสั้นใต้ชื่อ — ตอน disabled ใช้บอกว่าทำไมทำไม่ได้ */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function MoreMenu({
  items,
  label = "เพิ่มเติม",
  size = "default",
  align = "end",
  className,
}: {
  items: MoreMenuItem[];
  label?: string;
  size?: "default" | "sm" | "lg";
  align?: "start" | "end";
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size={size} className={className} aria-label={label}>
          <Ellipsis /> {label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className={cn("card-surface z-50 min-w-60 max-w-xs p-2 text-sm", RADIUS.inner)}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenu.Item
                key={item.key}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-interactive-hover data-[disabled]:cursor-default data-[disabled]:opacity-60",
                  item.danger ? "text-red-700 dark:text-red-300" : "text-strong",
                )}
              >
                {Icon ? <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", item.danger ? "text-red-600 dark:text-red-400" : "text-muted")} aria-hidden="true" /> : null}
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  {item.hint ? <span className="block text-xs text-secondary">{item.hint}</span> : null}
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
