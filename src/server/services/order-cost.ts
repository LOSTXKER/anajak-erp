import { calculateProfitMargin } from "@/lib/pricing";
import { aggToNumber } from "@/server/services/money";
import type { PrismaTx } from "@/lib/prisma";

// invariant: order.totalCost = Σ costEntry.amount — writer ทุกจุดที่แตะ costEntry
// (cost router / production step actualCost / outsource ค่าจ้างตอน QC ผ่าน) ต้องเรียก
// lockOrderRow + recalcOrderCost ใน $transaction เดียวกับที่เขียน (Gate A4 · audit 2026-07-02:
// เดิม production/outsource เขียน costEntry แต่ไม่ recalc → totalCost บนออเดอร์ drift)

// ล็อกแถวออเดอร์ก่อน recalc — สอง request เขียนต้นทุนพร้อมกัน aggregate มองไม่เห็นแถว
// ของกันและกัน → ค่าที่เขียนทับขาดแถว (pattern เดียวกับ lockInvoiceRow ใน billing)
export async function lockOrderRow(tx: PrismaTx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
}

// aggregate ต้นทุนใหม่ทั้งก้อนแล้วเขียนทับออเดอร์ — เรียกหลัง lockOrderRow เท่านั้น
export async function recalcOrderCost(tx: PrismaTx, orderId: string) {
  const totalCostAgg = await tx.costEntry.aggregate({
    _sum: { amount: true },
    where: { orderId },
  });
  const totalCost = aggToNumber(totalCostAgg._sum.amount);
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { totalAmount: true },
  });
  await tx.order.update({
    where: { id: orderId },
    data: {
      totalCost,
      profitMargin: calculateProfitMargin(order.totalAmount, totalCost),
    },
  });
}
