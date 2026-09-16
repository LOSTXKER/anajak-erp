import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { c } from "@/components/kit/kit";

/* ============================================================
   กล่อง "ยังไม่มีข้อมูล" ของทุกหน้า — ใช้หน้าตา `.empty` ของชุดกลาง (kit.module.css)
   ชุดเดียวกับหน้าออเดอร์/ใบผลิต (รวมสไตล์ 2026-09-17 · เดิมหน้าเก่าวาดเอง)
   ============================================================ */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  density?: "default" | "compact";
}

export function EmptyState({ icon: Icon, title, description, action, density = "default" }: EmptyStateProps) {
  return (
    <div className={c("empty plain", density === "compact" && "sm")}>
      <span className={c("ring")} aria-hidden="true">
        <Icon />
      </span>
      <b>{title}</b>
      {description ? <small>{description}</small> : null}
      {action}
    </div>
  );
}
