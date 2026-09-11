import type { ComponentProps } from "react";
import type { OrderOverviewTab } from "@/components/orders/detail/order-overview-tab";
import type { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import type { ArtworkVersion } from "@/components/orders/detail/order-artwork-card";
import { CASE_4 } from "../work-order-form/_data";

// ข้อมูลจำลองสำหรับเทียบหน้าตา วันที่คงที่และไม่มี ID ของฐานที่ใช้งานจริง
export const PREVIEW_ORDER_NUMBER = "ORD-2609-0128";
export const PREVIEW_ORDER: ComponentProps<typeof OrderOverviewTab>["order"] = {
  id: "preview-ui-reset-order",
  description: "เสื้อทีมเปิดตัวร้านกาแฟ 30 ตัว สีกรม Cotton 100% สกรีน DTF โลโก้อกซ้าย 9 × 6 ซม. ให้เห็นโลโก้ชัดบนผ้าสีเข้ม แยกถุงตามไซซ์ S 7 / M 12 / L 11",
  notes: "ส่งถึงร้านก่อน 15.00 น. วันที่ 25 ก.ย. แยกถุงและติดป้ายไซซ์ทุกตัว",
  orderType: "CUSTOM", channel: "LINE", customerStatus: "PREPARING", priority: "HIGH",
  paymentTerms: "DEPOSIT_50", poNumber: "PO-STUDIO-0268", deadline: "2026-09-25T08:00:00+07:00",
  estimatedQuantity: 30, createdAt: "2026-09-10T10:15:00+07:00", updatedAt: "2026-09-11T09:20:00+07:00",
  completedAt: null, cancelledAt: null, cancelledReason: null,
  blindShip: false, blindShipSenderName: null, stockReservedAt: null, stockReservationError: null,
  shippingRecipientName: "คุณฟ้า — ทีมเปิดร้าน", shippingPhone: "080-000-1280",
  shippingAddress: "128 อาคารสตูดิโอ ชั้น 1", shippingSubDistrict: "บางจาก", shippingDistrict: "พระโขนง",
  shippingProvince: "กรุงเทพมหานคร", shippingPostalCode: "10260",
  externalOrderId: null, platformFee: null, trackingNumber: null, createdBy: { name: "ฝ่ายขาย" },
  customer: {
    id: "preview-ui-reset-customer", name: "คุณฟ้า", company: "บริษัท สตูดิโอกาแฟและเพื่อน จำกัด",
    phone: "080-000-1280", email: "team@studio-coffee.example.invalid", lineId: "studio-coffee-example",
    chatName: "ทีมสตูดิโอกาแฟ", chatUrl: "https://example.invalid/customer-chat",
    address: "128 อาคารสตูดิโอ แขวงบางจาก เขตพระโขนง กรุงเทพฯ 10260",
    taxId: "0105550000128", branchNumber: "00000", customerType: "CORPORATE",
    notes: "ติดต่อคุณฟ้าเรื่องแบบและวันส่ง เอกสารส่งทางอีเมลฝ่ายจัดซื้อ", tags: ["ร้านกาแฟ", "ลูกค้าประจำ"],
    defaultPaymentTerms: "NET_30", billingAddress: null, billingSubDistrict: null, billingDistrict: null,
    billingProvince: null, billingPostalCode: null, totalOrders: 8, lastOrderAt: "2026-08-20T10:00:00+07:00",
    creditLimit: 50000, totalSpent: 87342.5,
  },
  brandProfile: {
    id: "preview-ui-reset-brand", brandName: "Studio Coffee", logoUrl: "/proto/ui-reset/studio-coffee-logo.svg",
    colorCodes: ["#173047", "#F2E5CB"], fonts: ["Kanit"], styleNotes: "โลโก้สีครีมบนเสื้อสีกรม ไม่เปลี่ยนสัดส่วนตัวอักษร",
  },
};

// ใช้รูปแบบข้อมูลที่ OrderItemsDisplay ใช้อยู่ในหน้าลองเดิม เปลี่ยนเป็นใบขายชุดนี้
export const PREVIEW_ITEMS = (CASE_4.orderItems as ComponentProps<typeof OrderItemsDisplay>["items"]).map((item) => ({
  ...item, id: "preview-ui-reset-item", description: "เสื้อทีม Studio Coffee", notes: "แยกถุงพร้อมติดป้ายไซซ์", subtotal: 5100,
  products: item.products.map((product) => ({
    ...product, id: "preview-ui-reset-product", description: "เสื้อ Cotton 100% สีกรม", itemSource: "FROM_STOCK" as const,
    baseUnitPrice: 105, discount: 0, subtotal: 3150, receivedInspected: false, receiveNote: null,
  })),
  prints: item.prints.map((print) => ({
    ...print, id: "preview-ui-reset-print", printType: "DTF" as const, width: 9, height: 6,
    designNote: "โลโก้อกซ้าย สีครีม", designImageUrl: "/proto/ui-reset/studio-coffee-shirt.svg", unitPrice: 65,
  })),
  addons: [],
}));

export const PREVIEW_FEES: ComponentProps<typeof OrderItemsDisplay>["fees"] = [{
  id: "preview-ui-reset-fee", orderId: PREVIEW_ORDER.id, feeType: "DESIGN_FEE", name: "ปรับไฟล์พร้อมพิมพ์",
  description: null, amount: 500, notes: null, createdAt: new Date("2026-09-10T10:15:00+07:00"),
}];

export const PREVIEW_PRICING = {
  subtotalItems: 5100, subtotalFees: 500, platformFee: 0, discount: 0, taxAmount: 392, grandTotal: 5992,
};

export const PREVIEW_ARTWORK: ArtworkVersion = {
  fileUrl: "/proto/ui-reset/studio-coffee-shirt.svg", versionNumber: 2, approvalStatus: "PENDING", approvedAt: null,
  createdAt: "2026-09-11T09:20:00+07:00",
  files: [{ fileUrl: "/proto/ui-reset/studio-coffee-shirt.svg", position: "FRONT", caption: "อกซ้าย 9 × 6 ซม. · สีครีม" }],
};
