import type { PrismaTx } from "@/lib/prisma";
import { nextDocumentNumber } from "@/server/services/document-number";
import { addOrderRevision } from "@/server/services/order-status";

// สร้างใบเคลม — ใช้ร่วมกันระหว่างปุ่มเปิดใบเอง กับการเปิดอัตโนมัติตอนตีกลับใบส่ง
// (ก้อน 1 · เบสสั่ง 2026-09-18) ต้องเรียกใน transaction เดียวกับเหตุการณ์ต้นเรื่องเสมอ
// เพื่อให้เลขเอกสารกับใบเกิดพร้อมกัน ไม่เกิดรูของเลข

export interface OpenClaimLine {
  size: string;
  color?: string | null;
  qtyClaimed: number;
}

export interface OpenClaimParams {
  orderId: string;
  customerId: string;
  source: "DELIVERY_RETURN" | "CUSTOMER_REPORT" | "INTERNAL_FOUND" | "QC_AFTER_DELIVERY";
  title: string;
  detail?: string | null;
  /** วันที่ลูกค้าแจ้ง — ไม่ใช่วันที่เราเปิดใบ (เคลมย้อนหลังมีจริง) */
  reportedAt?: Date;
  /** ข้อความที่ลูกค้าเห็นบนลิงก์ติดตามงาน — ไม่ใส่ = หน้านั้นใช้คำปริยายของแต่ละขั้น */
  customerMessage?: string | null;
  /** รูปหลักฐานของรอบนี้ (ภายใน — ไม่ออกไปฝั่งลูกค้า) */
  photoUrls?: string[];
  openedById: string;
  sourceDeliveryId?: string | null;
  sourceQcRecordId?: string | null;
  fault?: "UNDETERMINED" | "SHOP" | "CUSTOMER" | "VENDOR" | "MATERIAL" | "CARRIER" | "NONE";
  lines?: OpenClaimLine[];
}

export async function openClaim(tx: PrismaTx, params: OpenClaimParams) {
  // รอบที่เท่าไรของออเดอร์นี้ — ขึ้นบนจอช่างและหน้าลูกค้า ("งานแก้ รอบที่ 2")
  const previous = await tx.orderClaim.count({ where: { orderId: params.orderId } });
  const claimNumber = await nextDocumentNumber(tx, "CLAIM");

  const claim = await tx.orderClaim.create({
    data: {
      claimNumber,
      orderId: params.orderId,
      customerId: params.customerId,
      source: params.source,
      fault: params.fault ?? "UNDETERMINED",
      round: previous + 1,
      title: params.title,
      detail: params.detail ?? null,
      reportedAt: params.reportedAt ?? new Date(),
      customerMessage: params.customerMessage ?? null,
      photoUrls: params.photoUrls ?? [],
      openedById: params.openedById,
      sourceDeliveryId: params.sourceDeliveryId ?? null,
      sourceQcRecordId: params.sourceQcRecordId ?? null,
      ...(params.lines && params.lines.length > 0
        ? {
            lines: {
              create: params.lines.map((line) => ({
                size: line.size,
                color: line.color ?? null,
                qtyClaimed: line.qtyClaimed,
              })),
            },
          }
        : {}),
    },
    include: { lines: true },
  });

  // ประวัติออเดอร์ต้องเล่าได้ว่ามีรอบแก้เกิดขึ้น — ชนิด CLAIM ถูกกรองให้ role ที่ไม่เห็นเงิน
  // ตามนโยบายเดิม (revision-policy) จึงใส่ชื่อเรื่องได้โดยไม่ต้องกลัวยอดเงินหลุด
  await addOrderRevision(tx, {
    orderId: params.orderId,
    changedBy: params.openedById,
    changeType: "CLAIM",
    description: `เปิดใบเคลม ${claimNumber} (รอบที่ ${claim.round}): ${params.title}`,
  });

  return claim;
}

/** ยอดรวมของบรรทัดในใบเคลม — ใช้ทั้งตอนโชว์และตอนตรวจก่อนปิดใบ */
export function sumClaimLines(lines: { qtyClaimed: number; qtyAccepted: number | null }[]) {
  return {
    qtyClaimed: lines.reduce((sum, line) => sum + line.qtyClaimed, 0),
    // null = ยังไม่ตรวจ ต่างจาก 0 = ตรวจแล้วไม่รับสักตัว จึงนับเฉพาะที่ตรวจแล้ว
    qtyAccepted: lines.reduce((sum, line) => sum + (line.qtyAccepted ?? 0), 0),
  };
}
