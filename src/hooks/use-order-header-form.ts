import { useCallback, useMemo, useState } from "react";
import { isMarketplaceChannel } from "@/lib/order-status";

/* หัวฟอร์มออเดอร์ — ชิ้นเดียวที่หน้าเปิดงานและกล่องแก้ข้อมูลออเดอร์ใช้ร่วมกัน
 * (ก้อน 2 ของใบงาน "ฟอร์มออเดอร์ตัวเดียวใช้ทั้งสร้างและแก้" · เบสสั่ง 2026-08-11)
 *
 * ทำไมต้องมี: วันนี้ทั้งสองที่ถือ state ชุดเดียวกันคนละแบบ — หน้าเปิดงานใช้ useState
 * กระจาย 11 ตัว ส่วนกล่องแก้ใช้ object FormData ก้อนเดียว · เพิ่มช่องใหม่ทีต้องแก้ 2 ที่
 * และเคยหลุดมาแล้ว (ช่องภาษี % หายจากกล่องแก้ · PO ค้างข้ามลูกค้า)
 *
 * ขอบเขตของ hook นี้ = **เฉพาะหัวฟอร์ม** — รายการสินค้า/ค่าใช้จ่าย/ที่อยู่จัดส่ง
 * มี hook ของตัวเองอยู่แล้ว (useOrderItemsForm · useOrderFeesForm · useOrderShippingState)
 * ไม่ยุบรวมกัน เพราะแต่ละก้อนมีกติกาการบันทึกคนละแบบ
 *
 * ⚠️ refactor ล้วน — หน้าตาและพฤติกรรมต้องไม่เปลี่ยนแม้แต่จุดเดียว
 */

export interface OrderHeaderState {
  customerId: string;
  channel: string;
  description: string;
  deadline: string;
  notes: string;
  priority: OrderPriority;
  paymentTerms: string;
  poNumber: string;
  externalOrderId: string;
  taxRate: number;
  discount: number;
  platformFee: number;
}

export type OrderPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const EMPTY_ORDER_HEADER: OrderHeaderState = {
  customerId: "",
  channel: "LINE",
  description: "",
  deadline: "",
  notes: "",
  priority: "NORMAL",
  paymentTerms: "",
  poNumber: "",
  externalOrderId: "",
  // default 7% — บริษัทจด VAT ทุกการขายต้องมีภาษีขาย (Gate B2 · เบส confirm 2026-07-02)
  // งานยกเว้นภาษี = ผู้ใช้ตั้ง 0 เอง (เดิม default 0 → ภาษีขายขาด เสี่ยงประเมินย้อนหลัง)
  taxRate: 7,
  discount: 0,
  platformFee: 0,
};

export function useOrderHeaderForm(initial?: Partial<OrderHeaderState>) {
  const [header, setHeader] = useState<OrderHeaderState>(() => ({
    ...EMPTY_ORDER_HEADER,
    ...initial,
  }));

  /** แก้ทีละช่อง — ชื่อ field เป็น key ของ state ตรงๆ ไม่ต้องจำชื่อ setter 13 ตัว */
  const setField = useCallback(
    <K extends keyof OrderHeaderState>(key: K, value: OrderHeaderState[K]) => {
      setHeader((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /** เซ็ตหลายช่องพร้อมกัน (โหลดร่าง · seed จากออเดอร์เดิม · เปลี่ยนลูกค้าแล้วล้างของที่ผูกกับลูกค้า) */
  const patch = useCallback((next: Partial<OrderHeaderState>) => {
    setHeader((prev) => ({ ...prev, ...next }));
  }, []);

  const reset = useCallback((next?: Partial<OrderHeaderState>) => {
    setHeader({ ...EMPTY_ORDER_HEADER, ...next });
  }, []);

  const isMarketplace = useMemo(
    () => isMarketplaceChannel(header.channel),
    [header.channel],
  );

  return { header, setField, patch, reset, isMarketplace };
}
