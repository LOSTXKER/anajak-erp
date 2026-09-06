"use client";

/**
 * B · แถวละไซส์ (มิเรอร์แท็บรายการ)
 * เสื้อตัดเย็บ/ลูกค้าส่งมา = แถวหัว (ชื่อ แพค ราคา) + แถวลูกไซส์ละแถว (ไซส์ · สี · จำนวน · รวมแถว)
 * เหมือนแท็บรายการที่เพิ่งเคาะ (เสื้อแถวละตัว) · สเปคตัดเย็บอยู่แถวลูกท้ายสุด
 * ไม่มีตารางไซส์ S/M/L สำเร็จรูป — เพิ่มไซส์ทีละแถว
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { cn, formatCurrency } from "@/lib/utils";
import type { OrderItemProductForm, VariantForm } from "@/types/order-form";
import {
  CustomerNote, DetailRail, FormCols, FormHead, IdentityCell, NarrowCard, PackSelect, PriceInput,
  QtyCell, RowActions, SectionHead, SourceBadge, SpecFields, TotalCell, DENSE_CELL, Dash,
  isCustomMade, isCustomerProvided, isStock, netPrice, type ProductHandlers,
} from "../_shared";

function setVariant(h: ProductHandlers, p: OrderItemProductForm, idx: number, vi: number, patch: Partial<VariantForm>) {
  h.setVariants(idx, p.variants.map((v, i) => (i === vi ? { ...v, ...patch } : v)));
}

function SizeRowsTable({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  const noPrice = isCustomerProvided(p);
  return (
    <table className="w-full table-fixed">
      <colgroup>
        <col style={{ width: 96 }} />
        <col style={{ width: 120 }} />
        <col style={{ width: 88 }} />
        <col />
        <col style={{ width: 96 }} />
        <col style={{ width: 44 }} />
      </colgroup>
      <thead>
        <tr className="text-xs font-medium text-muted">
          <th className="px-2 py-1.5 text-left">ไซส์</th>
          <th className="px-2 py-1.5 text-left">สี</th>
          <th className="px-2 py-1.5 text-center">จำนวน</th>
          <th aria-hidden="true" />
          <th className="px-2 py-1.5 text-center">{noPrice ? "" : "รวม"}</th>
          <th aria-hidden="true" />
        </tr>
      </thead>
      <tbody>
        {p.variants.map((v, vi) => (
          <tr key={vi}>
            <td className="px-2 py-1 align-middle"><Input size="dense" aria-label={`ไซส์ แถว ${vi + 1}`} value={v.size} onChange={(e) => setVariant(h, p, idx, vi, { size: e.target.value })} placeholder="S" className="px-2 text-center" /></td>
            <td className="px-2 py-1 align-middle"><Input size="dense" aria-label={`สี แถว ${vi + 1}`} value={v.color} onChange={(e) => setVariant(h, p, idx, vi, { color: e.target.value })} placeholder="สี" className="px-2" /></td>
            <td className="px-2 py-1 align-middle"><NumberInput integer min={0} size="dense" aria-label={`จำนวน แถว ${vi + 1}`} value={v.quantity} onValueChange={(q) => setVariant(h, p, idx, vi, { quantity: q })} className="w-full text-center" /></td>
            <td aria-hidden="true" />
            <td className={cn("px-2 py-1 text-center align-middle text-sm tabular-nums", noPrice ? "" : "font-medium text-strong")}>{noPrice ? <Dash /> : formatCurrency(netPrice(p) * v.quantity)}</td>
            <td className="py-1 pr-1 text-right align-middle">
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`ลบไซส์ แถว ${vi + 1}`} className="text-muted hover:text-red-600" onClick={() => h.setVariants(idx, p.variants.filter((_, i) => i !== vi))}><Trash2 /></Button>
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={6} className="px-2 pt-1">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => h.setVariants(idx, [...p.variants, { size: "", color: p.variants[0]?.color ?? "", quantity: 0 }])}><Plus />เพิ่มไซส์</Button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function SizeRowsVariant({ products, h }: { products: OrderItemProductForm[]; h: ProductHandlers }) {
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
                            <DetailRail className="space-y-4">
                              {isCustomerProvided(p) && <CustomerNote />}
                              <SizeRowsTable p={p} idx={i} h={h} />
                              {isCustomMade(p) && <div className="border-t border-divider pt-4"><SpecFields p={p} idx={i} h={h} compact /></div>}
                            </DetailRail>
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
            {!isStock(p) && (
              <div className="space-y-4 border-t border-divider pt-3">
                {isCustomerProvided(p) && <CustomerNote />}
                <SizeRowsTable p={p} idx={i} h={h} />
                {isCustomMade(p) && <div className="border-t border-divider pt-4"><SpecFields p={p} idx={i} h={h} compact /></div>}
              </div>
            )}
          </NarrowCard>
        ))}
      </div>
    </div>
  );
}
