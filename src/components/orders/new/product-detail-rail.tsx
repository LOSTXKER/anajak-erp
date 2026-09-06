import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * พื้นที่รายละเอียดใต้แถวสินค้า (ไซส์ · สเปค) — พื้นขาว มีเส้นบางซ้ายบอกว่าเป็นลูกของแถวบน
 * แทนกล่องพื้นเทา (SUNK_PANEL) เดิม — เบสเคาะ 2026-09-06 "ไม่ชอบพื้นหลังเทา ทำเป็นตาราง"
 */
export function ProductDetailRail({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-l-2 border-border pl-4", className)}>{children}</div>;
}
