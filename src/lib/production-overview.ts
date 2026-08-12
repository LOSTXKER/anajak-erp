export type ActionableLaneCard = {
  orderId: string;
};

/**
 * สรุปงานที่ลงมือได้จากการ์ดเลนชุดเต็ม
 *
 * หนึ่งออเดอร์อาจมีหลายเทคนิค จึงต้องแยกจำนวนออเดอร์ไม่ซ้ำออกจาก
 * จำนวนการ์ดเลนที่หัวหน้าต้องจัดคิวจริง
 */
export function summarizeActionableWork(cards: readonly ActionableLaneCard[]) {
  return {
    orderCount: new Set(cards.map((card) => card.orderId)).size,
    laneCount: cards.length,
  };
}
