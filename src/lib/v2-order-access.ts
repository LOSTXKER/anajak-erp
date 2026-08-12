import { permAllows } from "@/lib/permissions";

/**
 * ฟอร์มเปิดงานชุดปัจจุบันมีราคา/ส่วนลด/ค่าบริการอยู่ในเนื้อหาเดียวกัน
 * V2 จึงต้อง fail closed ถ้าขาดสิทธิ์ข้อใดข้อหนึ่ง แทนการ mount แล้วซ่อนด้วย CSS
 */
export function canAccessV2OrderCreate(
  permissions: readonly string[] | null | undefined,
): boolean {
  return (
    permAllows(permissions, "create_sales_docs") &&
    permAllows(permissions, "see_order_money")
  );
}
