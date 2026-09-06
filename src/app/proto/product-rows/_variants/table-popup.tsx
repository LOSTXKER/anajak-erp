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
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import type { OrderItemProductForm } from "@/types/order-form";
import {
  CustomerNote, DetailRail, FormCols, FormHead, IdentityCell, NarrowCard, PackSelect, PriceInput,
  QtyCell, RowActions, SectionHead, SizeBlock, SourceBadge, SpecFields, TotalCell, DENSE_CELL,
  isCustomMade, isStock, specSummary, type ProductHandlers,
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

function SpecSummary({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  const [open, setOpen] = useState(false);
  const specs = specSummary(p);
  // ประเภทสินค้ามีค่าตั้งต้นเสมอ — "ระบุสเปคแล้ว" ต้องนับจากช่องตัดเย็บจริง (ผ้า/คอ/แขน/ทรง/แพทเทิร์น)
  const hasSpec = Boolean(p.patternId || p.fabricType || p.material || p.fabricWeight || p.fabricColor || p.collarType || p.sleeveType || p.bodyFit);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InfoChipRow>
        <InfoChip size="sm" icon={Scissors} strong>สเปค</InfoChip>
        {hasSpec ? (
          specs.map((s) => <InfoChip key={s} size="sm">{s}</InfoChip>)
        ) : (
          <InfoChip size="sm" icon={AlertTriangle} tone="warning">ยังไม่ระบุสเปค</InfoChip>
        )}
      </InfoChipRow>
      <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setOpen(true)}>
        {hasSpec ? "แก้สเปค" : "ระบุสเปค"}
      </Button>
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
