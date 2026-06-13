// ลิงก์สถานะออเดอร์ให้ลูกค้า (FLOW-REDESIGN ก้อน 4 — portal ขั้น 1)
//
// ลูกค้าเปิดผ่าน token ไม่ต้อง login → เห็น "เฉพาะข้อมูลของตัวเอง": สถานะ + แถบคืบหน้า
// + กำหนดส่ง + แบบที่อนุมัติ + เอกสาร (ใบเสนอ/ใบแจ้งหนี้ — เลข/ยอด/สถานะจ่าย/PDF) + พัสดุ
//
// **กฎเหล็กกันรั่ว**: select เฉพาะ field ที่ลูกค้าควรเห็น — ห้ามแตะ ราคาแยก/ส่วนลด/VAT/
// ต้นทุน/กำไร/internalStatus/notes ภายใน/ข้อมูลสต๊อค-outsource เด็ดขาด (หน้านี้ public)
// blindShip (ลูกค้า reseller): กลบแบรนด์ Anajak ใช้ชื่อผู้ส่งของลูกค้าแทน (เผื่อส่งลิงก์ต่อ)

import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { withFileToken } from "@/lib/file-urls";
import { CUSTOMER_STATUS_LABELS } from "@/lib/order-status";
import type { PrismaTx } from "@/lib/prisma";
import type { CustomerStatus } from "@prisma/client";

const STATUS_TOKEN_TTL_DAYS = 90; // read-only ความเสี่ยงต่ำ + ออเดอร์ลากได้หลายสัปดาห์

export function newStatusToken(): string {
  return randomBytes(32).toString("hex");
}

export function statusTokenExpiry(): Date {
  return new Date(Date.now() + STATUS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// ลำดับขั้นที่ลูกค้าเห็นบนแถบคืบหน้า (CANCELLED ไม่อยู่ในแถบ — โชว์เป็น banner แยก)
export const CUSTOMER_STEP_ORDER: CustomerStatus[] = [
  "ORDER_RECEIVED",
  "PREPARING",
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
];

const num = (d: unknown): number => Number(d ?? 0);

/** หาออเดอร์จาก statusToken + ตรวจหมดอายุ + คืน payload ที่ sanitize แล้ว (public-safe) */
export async function getOrderStatusByToken(
  prisma: Pick<PrismaTx, "order">,
  token: string
) {
  const order = await prisma.order.findUnique({
    where: { statusToken: token },
    select: {
      // ── ปลอดภัย ──
      orderNumber: true,
      title: true,
      deadline: true,
      createdAt: true,
      customerStatus: true,
      statusTokenExpiresAt: true,
      blindShip: true,
      blindShipSenderName: true,
      customer: { select: { name: true } },
      // แบบที่อนุมัติแล้ว (เฉพาะ APPROVED — ห้ามคืน PENDING/REJECTED)
      designs: {
        where: { approvalStatus: "APPROVED" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { versionNumber: true, fileUrl: true, thumbnailUrl: true, createdAt: true },
      },
      // ใบเสนอราคา (ไม่คืน subtotal/discount/tax — เฉพาะยอดรวม)
      quotations: {
        orderBy: { createdAt: "desc" },
        select: {
          quotationNumber: true,
          status: true,
          title: true,
          validUntil: true,
          totalAmount: true,
          pdfUrl: true,
          createdAt: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: { name: true, quantity: true, unit: true, totalPrice: true },
          },
        },
      },
      // ใบแจ้งหนี้/ใบเสร็จ (เฉพาะยอดรวม+สถานะจ่าย — ไม่คืน amount/discount/tax แยก/notes)
      invoices: {
        orderBy: { createdAt: "desc" },
        select: {
          invoiceNumber: true,
          type: true,
          totalAmount: true,
          paymentStatus: true,
          dueDate: true,
          paidAt: true,
          isVoided: true,
          createdAt: true,
        },
      },
      // พัสดุ (ไม่คืน shippingCost/isPaid/notes ภายใน)
      deliveries: {
        orderBy: { createdAt: "desc" },
        select: {
          shippingMethod: true,
          trackingNumber: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
          recipientName: true,
          address: true,
          subDistrict: true,
          district: true,
          province: true,
          postalCode: true,
          createdAt: true,
          lines: {
            select: { description: true, size: true, color: true, qty: true },
          },
        },
      },
    },
  });

  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลิงก์สถานะนี้" });
  }
  // fail-closed: ไม่มีวันหมดอายุ = ถือว่าหมดอายุ
  if (!order.statusTokenExpiresAt || order.statusTokenExpiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ลิงก์สถานะหมดอายุแล้ว กรุณาติดต่อร้านเพื่อขอลิงก์ใหม่",
    });
  }

  const design = order.designs[0] ?? null;
  const addr = (d: (typeof order.deliveries)[number]) =>
    [d.address, d.subDistrict, d.district, d.province, d.postalCode]
      .filter(Boolean)
      .join(" ");

  return {
    orderNumber: order.orderNumber,
    title: order.title,
    customerName: order.customer.name,
    deadline: order.deadline,
    createdAt: order.createdAt,
    customerStatus: order.customerStatus,
    // blindShip: กลบแบรนด์ Anajak (reseller อาจส่งลิงก์ต่อให้ปลายทาง)
    isBlindShip: order.blindShip,
    brandName: order.blindShip
      ? order.blindShipSenderName || "ร้านค้า"
      : "Anajak Print",
    steps: CUSTOMER_STEP_ORDER.map((s) => ({
      status: s,
      label: CUSTOMER_STATUS_LABELS[s],
    })),
    approvedDesign: design
      ? {
          versionNumber: design.versionNumber,
          imageUrl: withFileToken(design.thumbnailUrl || design.fileUrl, token, "s"),
          createdAt: design.createdAt,
        }
      : null,
    quotations: order.quotations.map((q) => ({
      quotationNumber: q.quotationNumber,
      status: q.status,
      title: q.title,
      validUntil: q.validUntil,
      totalAmount: num(q.totalAmount),
      pdfUrl: withFileToken(q.pdfUrl, token, "s"),
      createdAt: q.createdAt,
      items: q.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        totalPrice: num(it.totalPrice),
      })),
    })),
    invoices: order.invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      type: inv.type,
      totalAmount: num(inv.totalAmount),
      paymentStatus: inv.paymentStatus,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      isVoided: inv.isVoided,
      createdAt: inv.createdAt,
    })),
    deliveries: order.deliveries.map((d) => ({
      shippingMethod: d.shippingMethod,
      trackingNumber: d.trackingNumber,
      status: d.status,
      shippedAt: d.shippedAt,
      deliveredAt: d.deliveredAt,
      recipientName: d.recipientName,
      address: addr(d),
      lines: d.lines.map((l) => ({
        description: l.description,
        size: l.size,
        color: l.color,
        qty: l.qty,
      })),
    })),
  };
}
