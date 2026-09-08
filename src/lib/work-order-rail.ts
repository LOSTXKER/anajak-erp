/**
 * รางใบผลิต (ROADMAP §A9.5 ช่องคู่ — เบสอนุมัติ 2026-09-09)
 * ขั้นที่ตั้งว่า "เดินคู่กับขั้นก่อน" รวมกับขั้นก่อนหน้าเป็นช่องเดียวบนราง — ช่องหนึ่งมีได้หลายขั้น
 * pure — ไม่มี DOM · ใช้ทั้งหน้าใบผลิตและด่าน verify
 */

export interface RailStepLite {
  pairWithPrevious: boolean;
}

/** จัดขั้น (เรียงตาม sortOrder แล้ว) เป็นช่องบนราง — ขั้นแรกของใบเปิดช่องใหม่เสมอ */
export function railNodesOf<S extends RailStepLite>(steps: readonly S[]): S[][] {
  const nodes: S[][] = [];
  for (const step of steps) {
    const last = nodes[nodes.length - 1];
    if (last && step.pairWithPrevious) last.push(step);
    else nodes.push([step]);
  }
  return nodes;
}

/** ช่องที่รางยืนอยู่ = ช่องแรกที่ยังมีขั้นไม่ปิด · -1 = ปิดครบทุกช่อง */
export function currentRailNode<S extends RailStepLite & { status: string }>(nodes: readonly (readonly S[])[]): number {
  return nodes.findIndex((node) => node.some((s) => s.status !== "COMPLETED"));
}
