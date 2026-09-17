"use client";

import { useState } from "react";
import { AlertTriangle, Pen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { c } from "@/components/kit/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customMadeSpecFacts, hasCustomMadeSpec } from "@/lib/custom-made-spec";
import type { OrderItemProductForm } from "@/types/order-form";
import { CustomMadeDetail } from "./custom-made-detail";

/**
 * สเปคตัดเย็บในแถวสินค้า (เบสเคาะ D 2026-09-06): บนแถวเห็นแค่ค่าที่กรอกแล้ว แก้ใน popup
 * (CustomMadeDetail ตัวเดิม มีแพทเทิร์นจริง + สร้างด่วน) — ของที่กรอกนานๆ ครั้งไม่กินที่ในตาราง
 * หน้าตาตามต้นแบบ 2026-09-18: บรรทัดเดียว ป้าย + ชิปเทาทีละค่า + ปุ่มแก้ (ชื่อช่องอยู่ใน title ของชิป)
 * ยังไม่ระบุ = ชิปเตือน + ปุ่ม "ระบุสเปค" ไม่ปล่อยให้เงียบ
 */
export function CustomMadeSpecSummary({
  product,
  updateProduct,
}: {
  product: OrderItemProductForm;
  updateProduct: (field: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  // key เดียวกับ CustomMadeDetail → react-query แชร์ผล ไม่ยิงซ้ำ
  const { data } = trpc.pattern.list.useQuery({ isActive: true });
  const patternName = product.patternId ? data?.patterns.find((p) => p.id === product.patternId)?.name ?? null : null;
  const filled = hasCustomMadeSpec(product);
  const facts = customMadeSpecFacts(product, patternName);

  return (
    <div className={c("specrow")}>
      <span className={c("lb")}>สเปคตัดเย็บ</span>
      {filled ? (
        facts.map((f) => (
          <span key={f.label} className={c("chip gray")} title={f.label}>
            {f.value}
          </span>
        ))
      ) : (
        <span className={c("chip warn")}>
          <AlertTriangle aria-hidden="true" />
          ยังไม่ระบุสเปค
        </span>
      )}
      <button type="button" className={c("btn ghost sm")} onClick={() => setOpen(true)}>
        <Pen aria-hidden="true" />
        {filled ? "แก้สเปค" : "ระบุสเปค"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>สเปคตัดเย็บ</DialogTitle>
            <DialogDescription>{product.description || "สินค้าตัดเย็บใหม่"}</DialogDescription>
          </DialogHeader>
          <CustomMadeDetail embedded product={product} updateProduct={updateProduct} />
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>เสร็จ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
