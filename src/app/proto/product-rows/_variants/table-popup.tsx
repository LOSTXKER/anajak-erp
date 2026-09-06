"use client";

/**
 * D · ตาราง + สเปคใน popup (แบบผสมที่เบสถาม 2026-09-06 "ผสมกับ popup ดีมั้ย")
 * แถวหลักเหมือน A · แถวลูกมีแค่ตารางไซส์ (กางตลอด — ทุกออเดอร์ต้องกรอก)
 * สเปคตัดเย็บ 9 ช่อง (กรอกนานๆ ครั้ง) ย้ายไป popup — บนแถวเหลือชิปสรุป + ปุ่ม "แก้สเปค"
 * ยังไม่ระบุสเปค = ชิปเตือน ไม่ปล่อยให้เงียบ
 */
import { useState } from "react";
import { AlertTriangle, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Fact, FactList } from "@/components/ui/fact";
import { InfoChip } from "@/components/ui/info-chip";
import { customMadeSpecFacts, hasCustomMadeSpec } from "@/lib/custom-made-spec";
import type { OrderItemProductForm } from "@/types/order-form";
import { PATTERNS } from "../_data";
import {
  CustomerNote, DetailRail, FormCols, FormHead, IdentityCell, NarrowCard, PackSelect, PriceInput,
  QtyCell, RowActions, SectionHead, SizeBlock, SourceBadge, SpecFields, TotalCell, DENSE_CELL,
  isCustomMade, isStock, type ProductHandlers,
} from "../_shared";

/** เนื้อใน popup — แยกไว้ให้เรนเดอร์นิ่งดูได้ (Dialog ตัวจริงต้องมีหน้าจอถึงจะเปิด) */
export function SpecDialogBody({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>สเปคตัดเย็บ</DialogTitle>
        <DialogDescription>{p.description || `สินค้า ${idx + 1}`}</DialogDescription>
      </DialogHeader>
      <SpecFields p={p} idx={idx} h={h} />
    </>
  );
}

/** สรุปสเปคแบบ "ป้าย + ค่า" — เบสทักว่าชิปค่าโดดๆ ดูไม่รู้เรื่อง (helper ตัวเดียวกับของจริง) */
function SpecSummary({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  const [open, setOpen] = useState(false);
  const filled = hasCustomMadeSpec(p);
  const facts = customMadeSpecFacts(p, PATTERNS.find((pt) => pt.id === p.patternId)?.name ?? null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Scissors className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        <span className="text-xs font-semibold text-secondary">สเปคตัดเย็บ</span>
        {!filled && <InfoChip size="sm" icon={AlertTriangle} tone="warning">ยังไม่ระบุสเปค</InfoChip>}
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          {filled ? "แก้สเปค" : "ระบุสเปค"}
        </Button>
      </div>
      {filled && (
        <FactList columns={4}>
          {facts.map((f) => <Fact key={f.label} size="sm" label={f.label} value={f.value} className={f.wide ? "col-span-full" : undefined} />)}
        </FactList>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <SpecDialogBody p={p} idx={idx} h={h} />
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>เสร็จ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  return (
    <div className="space-y-3">
      {isCustomMade(p) ? <SpecSummary p={p} idx={idx} h={h} /> : <CustomerNote />}
      <SizeBlock p={p} idx={idx} h={h} prefix="d" />
    </div>
  );
}

export function TablePopupVariant({ products, h }: { products: OrderItemProductForm[]; h: ProductHandlers }) {
  const total = products.length;
  return (
    <div className="@container">
      <SectionHead />
      <div className="hidden overflow-hidden @2xl:block">
        <table className="w-full table-fixed">
          <FormCols />
          <FormHead />
          <tbody className="divide-y divide-divider">
            {products.map((p, i) => (
              <tr key={p.formKey ?? i}>
                <td colSpan={8} className="p-0">
                  <table className="w-full table-fixed">
                    <FormCols />
                    <tbody>
                      <tr>
                        <td className="py-2 pl-1 pr-3 align-top"><SourceBadge p={p} /></td>
                        <td className="py-2 pr-2 align-top"><IdentityCell p={p} idx={i} h={h} /></td>
                        <td className={DENSE_CELL}><PackSelect p={p} idx={i} h={h} /></td>
                        <td className={DENSE_CELL}><PriceInput p={p} idx={i} h={h} field="baseUnitPrice" /></td>
                        <td className={DENSE_CELL}><PriceInput p={p} idx={i} h={h} field="discount" /></td>
                        <td className={DENSE_CELL}><QtyCell p={p} idx={i} h={h} /></td>
                        <td className={DENSE_CELL}><TotalCell p={p} /></td>
                        <td className="py-2 pr-1 align-top"><RowActions idx={i} total={total} h={h} /></td>
                      </tr>
                      {!isStock(p) && (
                        <tr>
                          <td aria-hidden="true" />
                          <td colSpan={7} className="pb-4 pr-2 pt-1">
                            <DetailRail><Detail p={p} idx={i} h={h} /></DetailRail>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 @2xl:hidden">
        {products.map((p, i) => (
          <NarrowCard key={p.formKey ?? i} p={p} idx={i} total={total} h={h}>
            {!isStock(p) && <div className="border-t border-divider pt-3"><Detail p={p} idx={i} h={h} /></div>}
          </NarrowCard>
        ))}
      </div>
    </div>
  );
}
