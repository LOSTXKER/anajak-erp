import { permAllows } from "@/lib/permissions";

/**
 * ฟอร์มเปิดงานชุดปัจจุบันมีราคา/ส่วนลด/ค่าบริการอยู่ในเนื้อหาเดียวกัน
 * จึงต้อง fail closed ถ้าขาดสิทธิ์ข้อใดข้อหนึ่ง แทนการ mount แล้วซ่อนด้วย CSS
 */
function canUseOrderPricingForm(
  permissions: readonly string[] | null | undefined,
): boolean {
  return (
    permAllows(permissions, "create_sales_docs") &&
    permAllows(permissions, "see_order_money")
  );
}

export function canCreateOrderWithPricing(
  permissions: readonly string[] | null | undefined,
): boolean {
  return canUseOrderPricingForm(permissions);
}

/** ฟอร์มแก้ทั้งใบมีราคาเหมือนหน้าสร้าง จึงต้อง fail closed ด้วยสิทธิ์คู่เดียวกัน */
export function canEditOrderWithPricing(
  permissions: readonly string[] | null | undefined,
): boolean {
  return canUseOrderPricingForm(permissions);
}
