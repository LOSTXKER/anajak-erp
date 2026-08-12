"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON, FOCUS_INSET } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/**
 * แถบแท็บแบบเส้นใต้ของระบบ — ข้อความ + active line โดยคง semantics ของ Radix
 *
 * ที่ต้องรู้ก่อนใช้:
 * - จอแคบ: แถบเลื่อนแนวนอนได้ ป้ายชุดเดียวกับจอกว้าง (ห้ามมีป้ายคนละชุด 2 จอ — สอนงานกันไม่ได้)
 * - `TabsContent` ที่นี่ **บังคับ forceMount เสมอ** แล้วซ่อนด้วย CSS แทนการถอดออกจากหน้า
 *   เหตุผล: ของเดิมเป็นหน้าเดียวเลื่อนยาว ทุกส่วน mount อยู่แล้ว · ถ้าปล่อยให้ Radix ถอด DOM
 *   ทิ้งตามค่าเริ่มต้น คนที่กำลังพิมพ์แก้รายการแล้วสลับแท็บจะเสียของที่ยังไม่เซฟ
 *   (แลกด้วยการ render ทุกแท็บ = เท่าพฤติกรรมเดิมของหน้า ไม่ได้หนักขึ้นกว่าเดิม)
 */
export const Tabs = TabsPrimitive.Root;

/**
 * แถบรองของ TabsList ตอนปักหมุด (sticky) — **ต้องใช้ทุกครั้งที่ TabsList เป็น sticky**
 *
 * ทำไมต้องมี: TabsList เลื่อนได้ตามความกว้างเนื้อหา พอปักหมุดแล้วเลื่อนหน้า
 * ถ้าไม่มีแถบพื้นเต็มความกว้าง ตัวหนังสือของฟอร์มจะวิ่งทะลุขึ้นมาอยู่ข้างแท็บ
 * (เบสเห็นบนจอจริง 2026-08-12: ช่อง "ช่องทาง" กับ "กำหนดส่ง" โผล่ข้างแถบ)
 *
 * สูตรนี้ยกมาจากแถบขั้นตอนเดิมของหน้าเปิดงานที่แก้ปัญหานี้ไปแล้ว —
 * พื้นสีเดียวกับพื้นหน้า + ระยะบนล่าง + เส้นบางเป็นขอบให้รู้ว่าของเลื่อนลอดข้างใต้
 * (-mx-1/px-1 เผื่อวงแหวนโฟกัสของแท็บไม่ให้โดนตัด)
 */
export function TabsBar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-1 border-b border-divider bg-bg px-1",
        className,
      )}
      {...props}
    />
  );
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        // no-scrollbar: จอแคบเลื่อนได้แต่ไม่มีแถบเลื่อนมากินที่
        "no-scrollbar flex w-full max-w-full gap-6 overflow-x-auto pr-1 sm:gap-8",
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
>(({ className, children, hasPending = false, onClick, ...props }, forwardedRef) => {
  const localRef = React.useRef<React.ElementRef<typeof TabsPrimitive.Trigger>>(null);
  const ref = React.useCallback(
    (node: React.ElementRef<typeof TabsPrimitive.Trigger> | null) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const bringActiveTabIntoView = React.useCallback(() => {
    requestAnimationFrame(() => {
      if (localRef.current?.getAttribute("data-state") === "active") {
        localRef.current.scrollIntoView({ inline: "nearest", block: "nearest" });
      }
    });
  }, []);

  React.useEffect(() => {
    const node = localRef.current;
    if (!node) return;

    // Radix เปลี่ยน data-state ผ่าน context ตอน URL back / validation พาไปแท็บอื่น
    // ซึ่งไม่ได้เกิดจาก click บน trigger เป้าหมายเสมอ จึงเฝ้า state จริงที่ DOM จุดเดียว
    const observer = new MutationObserver(bringActiveTabIntoView);
    observer.observe(node, { attributes: true, attributeFilter: ["data-state"] });
    bringActiveTabIntoView();
    return () => observer.disconnect();
  }, [bringActiveTabIntoView]);

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        CONTROL_MIN_H,
        FOCUS_INSET,
        "inline-flex min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium text-muted transition-colors",
        "hover:text-secondary",
        "-mb-px border-b-2 border-transparent px-1 data-[state=active]:border-slate-900 data-[state=active]:font-semibold data-[state=active]:text-strong dark:data-[state=active]:border-white",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        bringActiveTabIntoView();
      }}
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
  );
});
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
