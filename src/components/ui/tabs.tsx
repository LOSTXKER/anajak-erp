"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON, RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/**
 * แถบแท็บของทั้งระบบ — แคปซูลพื้นจม ปุ่มที่เลือกอยู่เป็นแผ่นขาวลอยขึ้นมา
 * (ภาษาเดียวกับตัวสลับอื่นในเว็บ ไม่ใช่แท็บขีดเส้นใต้ซึ่งจะเพิ่มเส้นให้หน้าอีก)
 *
 * ที่ต้องรู้ก่อนใช้:
 * - จอแคบ: แถบเลื่อนแนวนอนได้ ป้ายชุดเดียวกับจอกว้าง (ห้ามมีป้ายคนละชุด 2 จอ — สอนงานกันไม่ได้)
 * - `TabsContent` ที่นี่ **บังคับ forceMount เสมอ** แล้วซ่อนด้วย CSS แทนการถอดออกจากหน้า
 *   เหตุผล: ของเดิมเป็นหน้าเดียวเลื่อนยาว ทุกส่วน mount อยู่แล้ว · ถ้าปล่อยให้ Radix ถอด DOM
 *   ทิ้งตามค่าเริ่มต้น คนที่กำลังพิมพ์แก้รายการแล้วสลับแท็บจะเสียของที่ยังไม่เซฟ
 *   (แลกด้วยการ render ทุกแท็บ = เท่าพฤติกรรมเดิมของหน้า ไม่ได้หนักขึ้นกว่าเดิม)
 */
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // no-scrollbar: จอแคบเลื่อนได้แต่ไม่มีแถบเลื่อนมากินที่
      "no-scrollbar flex gap-0.5 overflow-x-auto p-1",
      RADIUS.pill,
      SUNK_PANEL,
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    /** จุดแดง = แท็บนี้มีของค้าง (คิดจากข้อมูลชุดเดียวกับแถบขั้นต่อไป ห้ามเขียนตรรกะใหม่) */
    hasPending?: boolean;
  }
>(({ className, children, hasPending = false, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      CONTROL_MIN_H,
      FOCUS_BUTTON,
      RADIUS.pill,
      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 text-sm font-medium text-muted transition-colors",
      "hover:text-secondary",
      "data-[state=active]:bg-surface data-[state=active]:font-semibold data-[state=active]:text-strong data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  >
    {children}
    {hasPending && (
      <span
        // ข้อความจริงอยู่ใน aria-label ของ trigger ที่ผู้เรียกส่งมา — จุดนี้เป็นภาพล้วน
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
      />
    )}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    forceMount
    className={cn(
      "outline-none data-[state=inactive]:hidden",
      FOCUS_BUTTON,
      className
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
