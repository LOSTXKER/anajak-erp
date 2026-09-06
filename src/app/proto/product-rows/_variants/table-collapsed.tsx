"use client";

/**
 * C · ตาราง + สเปคพับได้
 * แถวหลักเหมือน A แต่แถวลูกเป็น "บรรทัดสรุป" ชิปสเปค + ชิปไซส์ พร้อมปุ่มแก้ — กดแล้วค่อยกางช่องกรอก
 * ตารางเตี้ยลงมาก แต่ของที่ต้องกรอกซ่อนอยู่หลังปุ่ม
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Ruler, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import type { OrderItemProductForm } from "@/types/order-form";
import {
  CustomerNote, DetailRail, FormCols, FormHead, IdentityCell, NarrowCard, PackSelect, PriceInput,
  QtyCell, RowActions, SectionHead, SizeBlock, SourceBadge, SpecFields, TotalCell, DENSE_CELL,
  isCustomMade, isStock, specSummary, totalQty, type ProductHandlers,
} from "../_shared";

function Summary({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  const [specOpen, setSpecOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizes = p.variants.filter((v) => v.size.trim() && v.quantity > 0);
  const specs = specSummary(p);
  return (
    <div className="space-y-3">
      {isCustomMade(p) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <InfoChipRow>
              <InfoChip size="sm" icon={Scissors} strong>สเปค</InfoChip>
              {specs.length > 0 ? specs.map((s) => <InfoChip key={s} size="sm">{s}</InfoChip>) : <span className="text-xs text-muted">ยังไม่ได้กรอกสเปค</span>}
            </InfoChipRow>
            <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={() => setSpecOpen((v) => !v)} aria-expanded={specOpen}>
              {specOpen ? <ChevronUp /> : <ChevronDown />}{specOpen ? "พับสเปค" : "แก้สเปค"}
            </Button>
          </div>
          {specOpen && <SpecFields p={p} idx={idx} h={h} compact />}
        </div>
      )}
      {!isCustomMade(p) && <CustomerNote />}
      <div className="flex flex-wrap items-center gap-2">
        <InfoChipRow>
          <InfoChip size="sm" icon={Ruler} strong>{totalQty(p)} ตัว</InfoChip>
          {sizes.map((v) => <InfoChip key={v.size} size="sm">{v.size} {v.quantity}</InfoChip>)}
          {sizes[0]?.color && <InfoChip size="sm">{sizes[0].color}</InfoChip>}
        </InfoChipRow>
        <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={() => setSizeOpen((v) => !v)} aria-expanded={sizeOpen}>
          {sizeOpen ? <ChevronUp /> : <ChevronDown />}{sizeOpen ? "พับไซส์" : "แก้ไซส์"}
        </Button>
      </div>
      {sizeOpen && <SizeBlock p={p} idx={idx} h={h} prefix="c" />}
    </div>
  );
}

export function TableCollapsedVariant({ products, h }: { products: OrderItemProductForm[]; h: ProductHandlers }) {
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
                          <td colSpan={7} className="pb-3 pr-2 pt-1">
                            <DetailRail><Summary p={p} idx={i} h={h} /></DetailRail>
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
            {!isStock(p) && <div className="border-t border-divider pt-3"><Summary p={p} idx={i} h={h} /></div>}
          </NarrowCard>
        ))}
      </div>
    </div>
  );
}
