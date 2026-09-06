"use client";

/**
 * "ปัจจุบัน" = ชิ้นส่วนตัวจริงของฟอร์ม: ชุดงานที่มีเสื้อตัดเย็บ/ลูกค้าส่งมา → ProductAdaptiveCard (กล่องเทา)
 * สต๊อกล้วน → ตาราง ProductTableRow · ต่างจากของจริงแค่ข้อมูลปลอม (รายการแพคดึงจากฐานจริงเหมือนฟอร์ม)
 */
import { ProductAdaptiveCard } from "@/components/orders/new/product-adaptive-card";
import { ProductTableRow } from "@/components/orders/new/product-table-row";
import { EMPTY_ITEM, type OrderItemForm, type OrderItemProductForm } from "@/types/order-form";
import { FormCols, FormHead, SectionHead } from "../_shared";

export function CurrentVariant({ products, setProducts }: { products: OrderItemProductForm[]; setProducts: (next: OrderItemProductForm[]) => void }) {
  const items: OrderItemForm[] = [{ ...EMPTY_ITEM, products }];
  const onSetItems = (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => setProducts(updater(items)[0].products);
  const usesAdaptive = products.some((p) => p.itemSource !== "FROM_STOCK");
  return (
    <div className="@container">
      <SectionHead />
      {usesAdaptive ? (
        <div className="space-y-3">
          {products.map((p, i) => (
            <ProductAdaptiveCard key={p.formKey ?? i} product={p} prodIdx={i} itemIdx={0} totalProducts={products.length} onSetItems={onSetItems} />
          ))}
        </div>
      ) : (
        <table className="w-full table-fixed">
          <FormCols />
          <FormHead />
          <tbody>
            {products.map((p, i) => (
              <ProductTableRow key={p.formKey ?? i} product={p} prodIdx={i} itemIdx={0} totalProducts={products.length} onSetItems={onSetItems} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
