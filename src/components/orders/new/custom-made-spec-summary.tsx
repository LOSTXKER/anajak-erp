"use client";

import { useState } from "react";
import { AlertTriangle, Scissors } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { customMadeSpecFacts, hasCustomMadeSpec } from "@/lib/custom-made-spec";
import type { OrderItemProductForm } from "@/types/order-form";
import { CustomMadeDetail } from "./custom-made-detail";

/**
 * สเปคตัดเย็บในแถวสินค้า (เบสเคาะ D 2026-09-06): บนแถวเห็นแค่ "ป้าย + ค่า" ที่กรอกแล้ว
 * แก้ใน popup (CustomMadeDetail ตัวเดิม มีแพทเทิร์นจริง + สร้างด่วน) — ของที่กรอกนานๆ ครั้งไม่กินที่ในตาราง
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Scissors className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        <span className="text-xs font-semibold text-secondary">สเปคตัดเย็บ</span>
        {!filled && (
          <InfoChip size="sm" icon={AlertTriangle} tone="warning">ยังไม่ระบุสเปค</InfoChip>
        )}
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          {filled ? "แก้สเปค" : "ระบุสเปค"}
        </Button>
      </div>
      {filled && (
        <FactList columns={4}>
          {facts.map((f) => (
            <Fact key={f.label} size="sm" label={f.label} value={f.value} className={f.wide ? "col-span-full" : undefined} />
          ))}
        </FactList>
      )}

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
