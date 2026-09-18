// ใบเคลม / รอบแก้งาน — คำบนจอและกติกาที่คิดได้โดยไม่ต้องต่อฐาน (ก้อน 1 · เบสสั่ง 2026-09-18)
//
// ตัวใบเคลมเป็น "กล่องเก็บเรื่อง" ไม่ใช่คนเขียนสถานะ/เงินเอง — สถานะออเดอร์ยังเดินผ่าน
// transitionOrder() และเงินยังเดินผ่าน billing service เหมือนเดิม ไฟล์นี้จึงมีแต่
// ป้ายภาษาไทยชุดกลาง + ฟังก์ชันตัดสินล้วน ที่ทั้ง server และ UI ใช้ร่วมกัน

export const CLAIM_STATE_LABELS: Record<string, string> = {
  OPEN: "รอตัดสิน",
  DECIDED: "ตัดสินแล้ว รอทำให้จบ",
  CLOSED: "จบแล้ว",
  CANCELLED: "ยกเลิกเรื่อง",
};

export const CLAIM_SOURCE_LABELS: Record<string, string> = {
  DELIVERY_RETURN: "ของตีกลับ",
  CUSTOMER_REPORT: "ลูกค้าแจ้งเอง",
  INTERNAL_FOUND: "เราเจอเอง",
  QC_AFTER_DELIVERY: "ตรวจเจอตอนของกลับเข้าร้าน",
};

export const CLAIM_FAULT_LABELS: Record<string, string> = {
  UNDETERMINED: "ยังไม่สรุป",
  SHOP: "ร้าน",
  CUSTOMER: "ลูกค้า",
  VENDOR: "ร้านนอก",
  MATERIAL: "วัสดุ",
  CARRIER: "ขนส่ง",
  NONE: "ไม่มีใครผิดชัด",
};

export const CLAIM_RESOLUTION_LABELS: Record<string, string> = {
  REWORK: "ซ่อม/ทำใหม่เฉพาะที่เสีย",
  REPLACE: "ทำใหม่ทั้งชุด",
  DISCOUNT: "ลูกค้ารับของไป แลกกับลดราคา",
  REFUND: "คืนเงิน",
  EXTRA_CHARGE: "ลูกค้าขอเปลี่ยน เก็บเงินเพิ่ม",
  GOODWILL: "ไม่คิดเงิน ไม่แก้ของ",
  REJECTED: "ไม่รับเคลม",
};

/** ทางที่ต้องมี "งานแก้" เข้าสายผลิตจริง */
export function resolutionNeedsRework(resolution: string | null | undefined): boolean {
  return resolution === "REWORK" || resolution === "REPLACE";
}

/** ทางที่ยอดลด → ต้องมีใบลดหนี้ (CN) ก่อนปิดใบ */
export function resolutionNeedsCreditNote(resolution: string | null | undefined): boolean {
  return resolution === "DISCOUNT" || resolution === "REFUND";
}

/** ทางที่เก็บเงินเพิ่ม → ต้องมีใบเพิ่มหนี้ (DN) ก่อนปิดใบ */
export function resolutionNeedsDebitNote(resolution: string | null | undefined): boolean {
  return resolution === "EXTRA_CHARGE";
}

export interface ClaimCloseInput {
  state: string;
  resolution: string | null;
  /** ยอดที่ตกลงจะลด/คืน (บาท) */
  agreedCredit: number;
  /** ยอดที่ตกลงจะเก็บเพิ่ม (บาท) */
  agreedCharge: number;
  /** รวมใบลดหนี้ที่ออกให้ใบเคลมนี้และยังไม่ถูกยกเลิก */
  creditNoteTotal: number;
  /** รวมใบเพิ่มหนี้ที่ออกให้ใบเคลมนี้และยังไม่ถูกยกเลิก */
  debitNoteTotal: number;
  /** ขั้นงานแก้ของใบเคลมนี้ที่ยังไม่ปิด */
  openReworkSteps: number;
  /** สั่งงานแก้ไปแล้วหรือยัง (มีขั้นงานแก้ผูกใบนี้กี่ขั้น) */
  reworkSteps: number;
  /** ออเดอร์กลับถึง "จัดส่งแล้ว" หรือยัง */
  orderBackToShipped: boolean;
  closeNote: string | null;
}

/**
 * เหตุที่ยัง "ปิดใบเคลมไม่ได้" — คืนเป็นข้อความไทยที่โชว์บนจอได้ตรงๆ (ว่าง = ปิดได้)
 *
 * เจตนา: ปิดช่องที่วันนี้ปล่อยให้ใบงานค้างสภาพ "ตัดสินแล้วแต่ไม่มีเอกสาร" ได้ถาวร
 * แต่ไม่บังคับสิ่งที่ระบบยังทำไม่ได้จริงในก้อน 1 — ตีกลับได้แค่ทั้งใบ ออเดอร์จึงอาจกลับไป
 * "จัดส่งแล้ว" ไม่ได้ (รอผูกใบส่งกับรายการในก้อน 2) กรณีนั้นบังคับให้เขียนเหตุผลปิดแทน
 */
export function claimCloseBlockers(input: ClaimCloseInput): string[] {
  const blockers: string[] = [];
  if (input.state === "CLOSED") blockers.push("ใบนี้ปิดไปแล้ว");
  if (input.state === "CANCELLED") blockers.push("ใบนี้ถูกยกเลิกเรื่องไปแล้ว");
  if (input.state === "OPEN" || !input.resolution) {
    blockers.push("ยังไม่ได้ตัดสินว่าจะจัดการอย่างไร");
    return blockers;
  }

  if (resolutionNeedsRework(input.resolution)) {
    if (input.reworkSteps === 0) blockers.push("ยังไม่ได้สั่งงานแก้เข้าสายผลิต");
    else if (input.openReworkSteps > 0) {
      blockers.push(`งานแก้ยังไม่จบ เหลืออีก ${input.openReworkSteps} ขั้น`);
    }
  }

  if (resolutionNeedsCreditNote(input.resolution)) {
    if (input.creditNoteTotal <= 0) blockers.push("ยังไม่ได้ออกใบลดหนี้ตามที่ตกลง");
    else if (Math.abs(input.creditNoteTotal - input.agreedCredit) > 0.005) {
      blockers.push(
        `ใบลดหนี้ที่ออกแล้ว ${input.creditNoteTotal.toLocaleString("th-TH")} ไม่ตรงกับที่ตกลงไว้ ${input.agreedCredit.toLocaleString("th-TH")}`,
      );
    }
  }

  if (resolutionNeedsDebitNote(input.resolution)) {
    if (input.debitNoteTotal <= 0) blockers.push("ยังไม่ได้ออกใบเพิ่มหนี้ตามที่ตกลง");
    else if (Math.abs(input.debitNoteTotal - input.agreedCharge) > 0.005) {
      blockers.push(
        `ใบเพิ่มหนี้ที่ออกแล้ว ${input.debitNoteTotal.toLocaleString("th-TH")} ไม่ตรงกับที่ตกลงไว้ ${input.agreedCharge.toLocaleString("th-TH")}`,
      );
    }
  }

  // ของตีกลับทั้งใบแล้วส่งชดเชยบางส่วน = ออเดอร์กลับไป "จัดส่งแล้ว" ไม่ได้ในระบบวันนี้
  // (หลักฐานแพ็คตัดใบที่ตีกลับออกทั้งใบ) จึงไม่บังคับ แต่ต้องมีคนเขียนกำกับว่าปิดทั้งที่ค้าง
  if (resolutionNeedsRework(input.resolution) && !input.orderBackToShipped && !input.closeNote?.trim()) {
    blockers.push("ออเดอร์ยังไม่กลับไปสถานะจัดส่งแล้ว — เขียนเหตุผลที่ปิดใบกำกับไว้ด้วย");
  }

  return blockers;
}

/** ข้อความบรรทัดเดียวบนแถบหัวใบออเดอร์ — สั้นพอที่จะอ่านผ่านๆ แล้วรู้ว่าต้องทำอะไรต่อ */
export function claimHeadline(claim: {
  round: number;
  state: string;
  resolution: string | null;
  qtyClaimed: number;
}): string {
  const round = `งานแก้ รอบที่ ${claim.round}`;
  const qty = claim.qtyClaimed > 0 ? ` · ${claim.qtyClaimed} ตัว` : "";
  if (claim.state === "OPEN") return `${round}${qty} · รอตัดสิน`;
  if (claim.state === "DECIDED") {
    const how = claim.resolution ? CLAIM_RESOLUTION_LABELS[claim.resolution] ?? "" : "";
    return `${round}${qty} · ${how}`;
  }
  return `${round}${qty} · ${CLAIM_STATE_LABELS[claim.state] ?? claim.state}`;
}
