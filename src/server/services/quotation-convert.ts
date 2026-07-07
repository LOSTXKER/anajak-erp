import { Prisma } from "@prisma/client";
import { D, round2 } from "./money";
// นิยาม "หมดอายุ" อยู่ที่ service เดียว (กัน drift กับลิงก์ยืนยันใบเสนอ ก้อน 4)
import { isQuotationExpired } from "./quotation-confirm";
import { badRequest } from "@/server/errors";

// กติกาแปลงใบเสนอราคา → ออเดอร์ (pure calc/assert — แยกจาก tx writes ใน
// routers/quotation.ts เพื่อ unit test ได้ไม่ต้อง DB) · caller โหลดข้อมูล/ถือ lock เอง
// — ฟังก์ชันชุดนี้ตัดสิน/คำนวณจากข้อมูลที่โหลดแล้วเท่านั้น

// gate ก่อนแปลง: ต้อง ACCEPTED และยังไม่หมดอายุ
export function assertQuotationConvertible(q: {
  status: string;
  validUntil: Date;
}): void {
  if (q.status !== "ACCEPTED") {
    badRequest("ใบเสนอราคาต้องได้รับการอนุมัติก่อนแปลงเป็นออเดอร์");
  }
  // ราคายืนถึงแค่ validUntil — แปลงหลังหมดอายุต้องยืนราคาใหม่ก่อน (audit ข้อ 12)
  if (isQuotationExpired(q.validUntil)) {
    badRequest(
      "ใบเสนอนี้หมดอายุแล้ว — แก้วันที่ \"ใช้ได้ถึง\" (ยืนราคาใหม่) ก่อนแปลงเป็นออเดอร์"
    );
  }
}

// ยอดที่จะผูกพันวงเงินจริงตอนแปลง
// (ออเดอร์ผูกที่มีรายการแล้ว = ยอดออเดอร์ · นอกนั้น = ยอดใบเสนอ)
export function convertCommitAmount(params: {
  linkedOrder: { totalAmount: number; itemCount: number } | null;
  quotationTotal: number;
}): number {
  return params.linkedOrder && params.linkedOrder.itemCount > 0
    ? params.linkedOrder.totalAmount
    : params.quotationTotal;
}

// ใบเสนอราคาเก็บภาษีเป็น "บาท" แต่ order ใช้อัตรา % — แปลงอัตรากลับจากยอดจริง
// ไม่งั้น order เกิดมาขัดสูตร A (totalAmount รวมภาษีแต่ taxRate=0) แล้วพอแก้รายการ
// ครั้งแรก ระบบ recompute ด้วย taxRate=0 → เงินภาษีหายเงียบ
export function deriveOrderTaxRate(q: {
  subtotal: number;
  discount: number;
  tax: number;
}): Prisma.Decimal {
  const taxBase = D(q.subtotal).minus(q.discount);
  return q.tax > 0 && taxBase.gt(0)
    ? round2(D(q.tax).div(taxBase).times(100))
    : D(0);
}

export interface QuotationSkeletonItem {
  sortOrder: number;
  taxLineType: "HIRE_OF_WORK";
  description: string;
  totalQuantity: number;
  subtotal: number;
  products: {
    create: {
      sortOrder: number;
      productType: string;
      description: string;
      baseUnitPrice: number;
      totalQuantity: number;
      subtotal: number;
      variants: {
        create: { size: string; quantity: number }[];
      };
    }[];
  };
}

// โครงรายการจากใบเสนอ (ใช้ทั้งเส้นสร้างใหม่ และเส้นเติมออเดอร์ผูกที่ยังไม่มีรายการ)
export function quotationSkeletonItems(
  items: {
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[]
): QuotationSkeletonItem[] {
  return items.map((item, index) => ({
    sortOrder: index,
    // รายการจากใบเสนอถูกบีบจนไม่เหลือโครงลายพิมพ์ — ระบุภาษีชัดเป็นจ้างทำของ
    // (งานใบเสนอเกือบทั้งหมดคืองานพิมพ์ · กัน updateItems derive เป็นขายสินค้าเงียบๆ)
    taxLineType: "HIRE_OF_WORK" as const,
    description: item.name,
    totalQuantity: item.quantity,
    subtotal: item.totalPrice,
    products: {
      create: [{
        sortOrder: 0,
        productType: "OTHER",
        description: item.name + (item.description ? ` - ${item.description}` : ""),
        baseUnitPrice: item.unitPrice,
        totalQuantity: item.quantity,
        subtotal: item.totalPrice,
        variants: {
          create: [{ size: "FREE", quantity: item.quantity }],
        },
      }],
    },
  }));
}
