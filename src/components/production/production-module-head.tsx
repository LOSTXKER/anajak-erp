"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChartColumn, Factory, Printer, Truck } from "lucide-react";
import { c } from "@/components/kit/kit";
import { trpc } from "@/lib/trpc";
import { differenceInBangkokDays } from "@/lib/date-utils";

/* ============================================================
   หัวของโมดูลการผลิต (ต้นแบบ mockup-production-calm-2026-09-15 · เบสสั่งลงจริง 2026-09-16)
   ไอคอนสีฟ้า + ชื่อหน้า + ปุ่มขวา · แถบเมนูย่อยแบบปุ่มในกรอบเทาอ่อน ใช้ร่วมทุกหน้าในโมดูล
   ไม่มีบรรทัดสรุปใต้ชื่อ (เบส "รกตา ไม่โปร่ง") — ตัวเลขที่ต้องจัดการอยู่ในเลขแดงของเมนู
   ============================================================ */

export type ProductionModuleKey = "desk" | "dtf" | "outsource" | "metrics";

export const PRODUCTION_MODULE_LINKS: readonly {
  key: ProductionModuleKey;
  href: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "desk", href: "/production", label: "งานในโรงงาน", icon: Factory },
  { key: "dtf", href: "/production/print-runs", label: "พิมพ์ DTF", icon: Printer },
  { key: "outsource", href: "/production/outsource", label: "ร้านนอก", icon: Truck },
  { key: "metrics", href: "/production/metrics", label: "ตัวชี้วัด", icon: ChartColumn },
];

export function ProductionModuleHead({
  active,
  title,
  actions,
  badges,
}: {
  active: ProductionModuleKey;
  title: string;
  actions?: ReactNode;
  /** เลขแดงที่หน้านั้นรู้อยู่แล้ว (ทับค่าที่หัวดึงเอง) · 0 = ไม่แสดง */
  badges?: Partial<Record<ProductionModuleKey, number>>;
}) {
  // เลขแดงชุดเดียวกันทุกหน้าในโมดูล: งานรอพิมพ์ DTF · ร้านนอกเลยนัดรับ (query เดิม ใช้ cache ร่วมกับหน้านั้น ๆ)
  const queue = trpc.printRun.queue.useQuery(undefined, { staleTime: 60_000 });
  const outsource = trpc.outsource.listOrders.useQuery({}, { staleTime: 60_000 });
  const lateOutsource = (outsource.data ?? []).filter(
    (order) => ["SENT", "IN_PROGRESS", "COMPLETED"].includes(order.status) && (differenceInBangkokDays(order.expectedBackAt, outsource.dataUpdatedAt || 0) ?? 0) < 0,
  ).length;
  const counts: Partial<Record<ProductionModuleKey, number>> = { dtf: queue.data?.length ?? 0, outsource: lateOutsource, ...badges };
  const current = PRODUCTION_MODULE_LINKS.find((link) => link.key === active) ?? PRODUCTION_MODULE_LINKS[0]!;
  const Icon = current.icon;
  return (
    <header className={c("mhead")}>
      <div className={c("top")}>
        <span className={c("mic")} aria-hidden="true">
          <Icon />
        </span>
        <div className={c("tt")}>
          <h1>{title}</h1>
        </div>
        {actions ? <div className={c("acts")}>{actions}</div> : null}
      </div>
      <nav className={c("mnav")} aria-label="ส่วนของการผลิต">
        {PRODUCTION_MODULE_LINKS.map((link) => {
          const LinkIcon = link.icon;
          const count = counts[link.key] ?? 0;
          return (
            <Link key={link.key} href={link.href} aria-current={link.key === active ? "page" : undefined}>
              <LinkIcon aria-hidden="true" />
              {link.label}
              {count > 0 ? (
                <span className={c("dotn")} aria-label={`ต้องจัดการ ${count}`}>
                  {count.toLocaleString("th-TH")}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
