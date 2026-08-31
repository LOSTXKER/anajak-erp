"use client";

/**
 * กรอบหน้าของทุกแบบ — หัวหน้า/เมนูโมดูล/ตัวบอกความสดของข้อมูล ใช้ของจริงทั้งหมด
 * และเหมือนกันทุกแบบโดยตั้งใจ · สิ่งที่กำลังเทียบมีแค่ "การ์ดกรอง" กับ "ตาราง"
 */

import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { ProductionFreshness } from "@/components/production/production-freshness";
import { ProductionModuleNav } from "@/components/production/production-module-nav";

import { PROTO_NOW } from "./_data";

export function ProductionShell({ children }: { children: ReactNode }) {
  return (
    <PageShell title="ควบคุมการผลิต" action={<ProductionModuleNav />}>
      {children}
    </PageShell>
  );
}

/** ตัวจริงจากหน้าจริง — เวลาตรึงไว้ที่ "วันนี้" ของหน้าลอง */
export function ProtoFreshness() {
  return (
    <ProductionFreshness
      updatedAt={PROTO_NOW.getTime()}
      isFetching={false}
      stale={false}
    />
  );
}
