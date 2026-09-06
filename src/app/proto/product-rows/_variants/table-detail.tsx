"use client";

/**
 * A · ตารางเดียว + แถวรายละเอียดใต้
 * ทุกแหล่งอยู่ในตาราง 8 คอลัมน์เดียวกัน (โครงเดิมของสต๊อก) · เสื้อตัดเย็บ/ลูกค้าส่งมาได้ "แถวลูก" ใต้แถวหลัก
 * กางสเปคกับไซส์ให้เห็นตลอด · พื้นขาว มีเส้นบางซ้ายบอกว่าเป็นลูกของแถวบน — ไม่มีกล่องเทา
 */
import type { OrderItemProductForm } from "@/types/order-form";
import {
  CustomerNote, DetailRail, FormCols, FormHead, IdentityCell, NarrowCard, PackSelect, PriceInput,
  QtyCell, RowActions, SectionHead, SizeBlock, SourceBadge, SpecFields, TotalCell, DENSE_CELL,
  isCustomMade, isStock, type ProductHandlers,
} from "../_shared";

function Detail({ p, idx, h }: { p: OrderItemProductForm; idx: number; h: ProductHandlers }) {
  if (isStock(p)) return null;
  if (isCustomMade(p)) {
    return (
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <SpecFields p={p} idx={idx} h={h} compact />
        <div className="min-w-0 lg:border-l lg:border-divider lg:pl-5"><SizeBlock p={p} idx={idx} h={h} prefix="a" /></div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <CustomerNote />
      <SizeBlock p={p} idx={idx} h={h} prefix="a" />
    </div>
  );
}

export function TableDetailVariant({ products, h }: { products: OrderItemProductForm[]; h: ProductHandlers }) {
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
              <tr key={p.formKey ?? i} className="group">
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
