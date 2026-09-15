import type { ReactNode } from "react";

/**
 * พื้นที่รายละเอียดใต้แถวสินค้า (ไซส์ · สเปค) — พื้นขาว ไม่มีเส้นขอบซ้าย (เบสสั่งเอาแถบขอบซ้ายออกทั้งเว็บ 2026-09-16)
 * แทนกล่องพื้นเทา (SUNK_PANEL) เดิม — เบสเคาะ 2026-09-06 "ไม่ชอบพื้นหลังเทา ทำเป็นตาราง"
 */
export function ProductDetailRail({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
