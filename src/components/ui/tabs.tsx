"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
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

/**
 * แถบรองของ TabsList ตอนปักหมุด (sticky) — **ต้องใช้ทุกครั้งที่ TabsList เป็น sticky**
 *
 * ทำไมต้องมี: TabsList กว้างเท่าแท็บจริง (`w-fit`) พอปักหมุดแล้วเลื่อนหน้า
 * ที่ว่างข้างๆ แถบเป็นพื้นโปร่ง → ตัวหนังสือของฟอร์มวิ่งทะลุขึ้นมาอยู่ข้างแท็บ
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
        "sticky top-0 z-20 -mx-1 border-b border-slate-200/70 bg-bg px-1 py-2 dark:border-white/10",
        className
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
      // w-fit: ถาดกว้างเท่าแท็บจริง ไม่ยืดเต็มบรรทัด — ยืดแล้วมันจะไปพาดคลุมของที่ตัวเอง
      // ไม่ได้คุม (เบสเห็นจอจริง 2026-08-11 แล้วบอกว่า "ไม่เห็นแยกหน้า tab ให้เลย")
      // max-w-full ต้องมาคู่เสมอ ไม่งั้นจอแคบเลื่อนแถบไม่ได้
      "no-scrollbar flex w-fit max-w-full gap-0.5 overflow-x-auto p-1",
      // เดิมใช้ SUNK_PANEL (slate-100 #f1f1f3) วางบนพื้นหน้า (--bg #f3f4f6) — ต่างกัน 2 หน่วยสี
      // ตามองไม่เห็นถาด เหลือแค่คำเทาลอยๆ ไม่มีอะไรมัดว่า "6 อันนี้เป็นชุดเดียว เลือกได้ทีละอัน"
      // (SUNK_PANEL ออกแบบมาให้จมใน "การ์ดขาว" ไม่ใช่บนพื้นเทาของหน้า — ใช้ผิดบริบท)
      // สูตรนี้ยกมาจาก SegmentedControl ที่เห็นชัดบนพื้นเทาเดียวกันอยู่แล้ว ไม่ได้เพิ่มสี/เส้นใหม่ให้ระบบ
      "bg-surface-muted ring-1 ring-inset ring-slate-200 dark:ring-white/10",
      // มุม 8px = "ปุ่มในแถบสลับ" ตามที่ RADIUS.item เขียนกำกับตัวเองไว้ · ทรงแคปซูลสงวนให้
      // ชิปตัวกรอง ซึ่งกติกาสีกลับด้านกัน (ตัวกรอง: ขาว = ยังไม่เลือก · แท็บ: ขาว = เปิดอยู่)
      RADIUS.item,
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
        FOCUS_BUTTON,
        RADIUS.item,
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 text-sm font-medium text-muted transition-colors",
        "hover:text-secondary",
        "data-[state=active]:bg-surface data-[state=active]:font-semibold data-[state=active]:text-strong data-[state=active]:shadow-sm",
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
