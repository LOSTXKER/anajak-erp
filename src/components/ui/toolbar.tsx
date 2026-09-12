import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// จัดค้นหาและตัวกรองตามพื้นที่งานจริง หลังหักเมนูและการซูมของผู้ใช้

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="@container min-w-0">
      <div
        className={cn(
          "flex min-w-0 flex-col gap-3 @2xl:flex-row @2xl:flex-wrap @2xl:items-center",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** ตัวกรองที่เกี่ยวกันอยู่กลุ่มเดียว และขึ้นแถวใหม่เมื่อพื้นที่ไม่พอ */
export function ToolbarGroup({
  children,
  className,
  align,
}: {
  children: ReactNode;
  className?: string;
  /** ดันไปชิดขวาเมื่อมีที่เหลือ — ใช้กับกลุ่มรอง เช่น ปุ่มมุมขวา */
  align?: "end";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2",
        align === "end" && "@2xl:ml-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
