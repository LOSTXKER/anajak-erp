import type { ReactNode } from "react";
import { c } from "@/components/kit/kit";
import { cn } from "@/lib/utils";

/**
 * พื้นที่รายละเอียดใต้แถวสินค้า (สเปคตัดเย็บ · ไซส์) — พื้นขาว ไม่ใช่กล่องเทา (เบสเคาะ 2026-09-06)
 * มีเส้นนำซ้ายบาง 2px ตามต้นแบบฟอร์มออเดอร์ 2026-09-18 ที่เบสเคาะหลังคำสั่งเอาแถบซ้ายออก (09-16)
 * เส้นนี้บอกว่าก้อนนี้เป็นของแถวด้านบน ไม่ใช่แถบสีสถานะ
 */
export function ProductDetailRail({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(c("subrail"), className)}>{children}</div>;
}
