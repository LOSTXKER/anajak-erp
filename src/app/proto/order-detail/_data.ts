/**
 * ข้อมูลตัวอย่างของ "ใบงานหนึ่งใบ" สำหรับหน้าลอง /proto/order-detail
 *
 * ปลอมทั้งหมด ไม่ยิงฐานข้อมูล — แต่ต้องครบทุกช่องที่หน้าจริงวาดได้ ไม่งั้นหน้าลอง
 * จะโชว์แต่เคสสวย แล้วพอลงของจริงเจอช่องที่ไม่เคยเห็น (กฎ "เอาของมาให้ครบ")
 *
 * ตั้งใจใส่เคสขอบไว้ในชุด `full`:
 *   · ชื่อบริษัทยาวจนต้องตัดบรรทัด (ไทยไม่มีเว้นวรรค)
 *   · เงื่อนไขชำระของใบนี้ต่างจากมาตรฐานลูกค้า (ต้องขึ้นบรรทัด "มาตรฐานลูกค้า:")
 *   · ป้ายลูกค้าหลายป้าย · หมายเหตุลูกค้ายาว · หมายเหตุเฉพาะใบ · ส่งแบบไม่ระบุผู้ส่ง
 *   · แบรนด์ลูกค้าครบ (โลโก้ · โค้ดสี · ฟอนต์ · โน้ตสไตล์)
 * และชุด `thin` = ใบที่เพิ่งเปิด ยังไม่มีอะไรเลย (ทดสอบว่าหน้าไม่พังตอนช่องหาย)
 */

import type { CustomerStatus, OrderType } from "@prisma/client";

/* วันที่ตายตัว — ห้ามใช้ new Date() ในหน้าลอง ไม่งั้นภาพที่เบสเห็นวันนี้กับพรุ่งนี้ไม่ตรงกัน */
const D = (iso: string) => new Date(iso);

export type DemoOrder = ReturnType<typeof buildOrder>;

function buildOrder(variant: "full" | "thin") {
  const thin = variant === "thin";

  return {
    id: "demo-order-1",
    orderNumber: thin ? "SO-2026-0413" : "SO-2026-0391",
    title: thin
      ? "เสื้อยืดงานวิ่งการกุศล (ยังไม่สรุปแบบ)"
      : "เสื้อโปโลพนักงานปี 2026 — ปักอกซ้าย + สกรีนหลัง",
    description: thin
      ? null
      : "โปโลคอปกสีกรมท่า ปักโลโก้อกซ้าย 8 ซม. และสกรีน DTF ด้านหลังเต็มแผ่น " +
        "ลูกค้าขอตัวอย่างจริง 1 ตัวก่อนผลิตทั้งล็อต · ไซซ์ตามตารางที่ส่งมาในไลน์ " +
        "ห้ามใช้ผ้าล็อตเดิมกับรอบที่แล้วเพราะสีเพี้ยน",
    notes: thin ? null : "ห้ามพับทับลายสกรีน — ม้วนใส่ถุงแยกตัวต่อตัว ส่งก่อนบ่าย 3",
    orderType: "CUSTOM" as OrderType,
    channel: "LINE",
    customerStatus: (thin ? "ORDER_RECEIVED" : "IN_PRODUCTION") as CustomerStatus,
    priority: thin ? "NORMAL" : "URGENT",
    paymentTerms: thin ? null : "DEPOSIT_50",
    poNumber: thin ? null : "PO-BKKMED-2026-0088",
    deadline: thin ? null : D("2026-09-08"),
    estimatedQuantity: thin ? 60 : null,
    createdAt: D("2026-08-14T09:24:00"),
    updatedAt: D("2026-08-29T16:41:00"),
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    confirmedAt: thin ? null : D("2026-08-16T11:05:00"),
    blindShip: !thin,
    blindShipSenderName: thin ? null : "บริษัท บางกอกเมดิคอลซัพพลาย จำกัด",
    stockReservedAt: thin ? null : D("2026-08-19T14:12:00"),
    stockReservationError: null,
    shippingRecipientName: thin ? null : "คุณพิมพ์ชนก เรืองวัฒนกิจ (ฝ่ายบุคคล)",
    shippingPhone: thin ? null : "081-234-5678",
    shippingAddress: thin
      ? null
      : "เลขที่ 1042/17 อาคารเมดิคอลทาวเวอร์ ชั้น 12 ถนนพระราม 4",
    shippingSubDistrict: thin ? null : "แขวงคลองเตย",
    shippingDistrict: thin ? null : "เขตคลองเตย",
    shippingProvince: thin ? null : "กรุงเทพมหานคร",
    shippingPostalCode: thin ? null : "10110",
    externalOrderId: null,
    platformFee: null,
    trackingNumber: thin ? null : "TH01234567890X",

    customer: thin
      ? null
      : {
          id: "demo-customer-1",
          name: "คุณพิมพ์ชนก เรืองวัฒนกิจ",
          company: "บริษัท บางกอกเมดิคอลซัพพลายแอนด์เซอร์วิส จำกัด (สำนักงานใหญ่)",
          phone: "02-116-4820 ต่อ 118",
          email: "purchasing@bkkmedical.co.th",
          lineId: "@bkkmed-purchase",
          chatName: "จัดซื้อ BKK Medical",
          chatUrl: "https://line.me/R/ti/p/@bkkmed-purchase",
          address:
            "1042/17 อาคารเมดิคอลทาวเวอร์ ชั้น 12 ถนนพระราม 4 แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
          taxId: "0105558123456",
          branchNumber: "00000",
          customerType: "CORPORATE",
          notes:
            "ต้องมี PO ทุกครั้งก่อนเริ่มงาน · วางบิลทุกวันที่ 25 รับเช็ควันศุกร์แรกของเดือนถัดไป",
          tags: ["ลูกค้าประจำ", "เครดิต 30 วัน", "ต้องมี PO", "ออกใบกำกับเต็มรูป"],
          defaultPaymentTerms: "NET_30",
          billingAddress: "1042/17 อาคารเมดิคอลทาวเวอร์ ชั้น 12 ถนนพระราม 4",
          billingSubDistrict: "แขวงคลองเตย",
          billingDistrict: "เขตคลองเตย",
          billingProvince: "กรุงเทพมหานคร",
          billingPostalCode: "10110",
          totalOrders: 27,
          lastOrderAt: D("2026-07-02"),
          creditLimit: 300000,
          totalSpent: 1284500,
        },

    brandProfile: thin
      ? null
      : {
          id: "demo-brand-1",
          brandName: "BKK Medical",
          logoUrl: "/demo-mockups/front.svg",
          colorCodes: ["#0F3D6E", "#12A594", "#F4F6F8"],
          fonts: ["Sarabun", "Inter"],
          styleNotes:
            "โลโก้ต้องอยู่บนพื้นสีเข้มเสมอ ห้ามวางบนพื้นขาว · เว้นระยะรอบโลโก้อย่างน้อยเท่าความสูงตัว B",
        },

    createdBy: { name: "ณัฐพงศ์ (ฝ่ายขาย)" },
  };
}

export const demoOrderFull = buildOrder("full");
export const demoOrderThin = buildOrder("thin");

export function demoOrder(thin: boolean) {
  return thin ? demoOrderThin : demoOrderFull;
}

/** ตัวเลขที่หน้าจริงคำนวณมาจากรายการสินค้า (อยู่คนละแท็บ) — ส่งเข้ามาเป็น prop */
export function demoTotals(thin: boolean) {
  return thin
    ? { totalAmount: 0, totalQuantity: 0 }
    : { totalAmount: 187400, totalQuantity: 240 };
}

/** สถานะปัจจุบันของใบนี้ + ประวัติที่แถบสถานะใช้หาว่าค้างที่ขั้นไหน */
export function demoStatus(thin: boolean) {
  return thin
    ? { internalStatus: "INQUIRY", customerStatus: "ORDER_RECEIVED" as CustomerStatus }
    : { internalStatus: "PRODUCING", customerStatus: "IN_PRODUCTION" as CustomerStatus };
}
