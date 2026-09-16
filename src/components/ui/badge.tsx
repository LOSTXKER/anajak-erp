import * as React from "react";
import { c } from "@/components/kit/kit";

/* ============================================================
   ป้ายสั้น — ใช้หน้าตา `.chip` ของชุดกลาง (kit.module.css) ชุดเดียวกับหน้าออเดอร์/ใบผลิต
   (รวมสไตล์ 2026-09-17 · เดิมหน้าเก่าวาดเองด้วย Tailwind จนเป็นคนละหน้าตากับหน้าใหม่)

   โทนกลางเป็นเทา สีสงวนไว้ให้สถานะที่มีความหมาย — ป้ายถูกเรียกใช้เกือบร้อยจุด
   ถ้าย้อมทุกใบ ตารางจะกลายเป็นพรมสีจนของที่ต้องรีบแข่งไม่ขึ้น
   ============================================================ */

export type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "destructive"
  | "outline"
  | "secondary"
  | "purple"
  | "indigo"
  | "orange"
  | "teal"
  | "cyan";

/** ชื่อโทนของ .chip — alias เดิม (purple/indigo/orange/teal/cyan) ยุบเป็นเทาทั้งหมด */
const CHIP_TONE: Record<BadgeVariant, string> = {
  default: "gray",
  accent: "blue",
  success: "good",
  warning: "warn",
  destructive: "bad",
  outline: "line",
  secondary: "gray",
  purple: "gray",
  indigo: "gray",
  orange: "gray",
  teal: "gray",
  cyan: "gray",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant | null;
  size?: "sm" | "md" | "lg" | null;
}

export function badgeVariants({
  variant,
  size,
  className,
}: { variant?: BadgeVariant | null; size?: "sm" | "md" | "lg" | null; className?: string } = {}) {
  return [c("chip", CHIP_TONE[variant ?? "default"], size === "lg" && "lg"), className ?? ""]
    .filter(Boolean)
    .join(" ");
}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={badgeVariants({ variant, size, className })} {...props} />;
}

export { Badge };
