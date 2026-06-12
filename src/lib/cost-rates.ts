// เรตต้นทุนกลาง (FLOW-REDESIGN ก้อน 2 · doc หัวข้อ 6 "ค่าน้ำมันต่อกิโลเมตร")
// ตั้งครั้งเดียวใน Settings แล้วระบบคูณเองตอนตีราคา — ไม่มีใครกรอกเลขหน้างาน
//
// ขอบเขตตายตัว: นี่คือ "เข็มทิศตอนตั้งราคา" (กำไรขั้นต้นโดยประมาณ) เท่านั้น
// กำไรขาดทุนจริงทางบัญชีคิดรายเดือนนอกระบบ — ห้ามต่อยอดเป็น job costing
// (มติเลิกคิดต้นทุนต่อออเดอร์ 2026-06-12) · ตัวเลขกำไรเห็นเฉพาะ role การเงิน
//
// 4 ก้อนต้นทุนของงานสกรีนเสื้อ:
// ① ตัวเสื้อ (~50-70%) = ราคาทุนจริงจากแอป Stock (costPrice ที่ sync มา) — ไม่ใช่เรต
// ② ฟิล์ม+หมึก+ผง (~10-20%) = พื้นที่ลาย × จำนวนตัว × เรตต่อเมตรวิ่ง (ม้วนหน้ากว้างคงที่)
// ③ งานร้านนอก = ตามบิลร้าน (optional ตอนเปิดใบส่งร้าน) — ไม่อยู่ในเรตนี้
// ④ ค่าแรง+ค่าไฟ+ค่าเสื่อม = เหมาต่อชิ้น

export const COST_RATES_KEY = "cost_rates";

export interface CostRates {
  /** ค่าฟิล์ม+หมึก+ผง ต่อเมตรวิ่ง (บาท) — เรตวงการไทย ~25-50 บาท/เมตร */
  filmRatePerMeter: number;
  /** หน้ากว้างม้วนฟิล์ม (ซม.) — ใช้แปลงพื้นที่ลายเป็นความยาวเมตรวิ่ง */
  filmRollWidthCm: number;
  /** ค่าแรงเหมาต่อชิ้น (บาท) */
  laborPerPiece: number;
  /** ค่าไฟ+ค่าเสื่อมเครื่อง เหมาต่อชิ้น (บาท) */
  overheadPerPiece: number;
  /** เตือนเมื่อทุนซื้อล็อตใหม่เบี่ยงจากที่ตั้งไว้เกิน % นี้ */
  costDeviationAlertPct: number;
}

export const EMPTY_COST_RATES: CostRates = {
  filmRatePerMeter: 0,
  filmRollWidthCm: 60,
  laborPerPiece: 0,
  overheadPerPiece: 0,
  costDeviationAlertPct: 10,
};

export function parseCostRates(raw: string | null | undefined): CostRates {
  if (!raw) return EMPTY_COST_RATES;
  try {
    return { ...EMPTY_COST_RATES, ...(JSON.parse(raw) as Partial<CostRates>) };
  } catch {
    return EMPTY_COST_RATES;
  }
}

/** เรตยังไม่ถูกตั้ง = กำไรขั้นต้นโดยประมาณยังคำนวณไม่ได้ (อย่าโชว์เลขมั่ว) */
export function costRatesConfigured(rates: CostRates): boolean {
  return rates.filmRatePerMeter > 0 || rates.laborPerPiece > 0 || rates.overheadPerPiece > 0;
}

/**
 * ค่าฟิล์มโดยประมาณของลายหนึ่งตำแหน่ง — พื้นที่ลาย (กว้าง×สูง ซม.) × จำนวนตัว
 * แปลงเป็นเมตรวิ่งบนม้วนหน้ากว้างคงที่ แล้วคูณเรตต่อเมตร
 * ลายไม่รู้ขนาด (ไม่ได้กรอก กว้าง/สูง) คืน null — ผู้เรียกตัดสินใจเองว่าโชว์อะไร
 */
export function estimateFilmCost(
  print: { widthCm: number | null | undefined; heightCm: number | null | undefined },
  qty: number,
  rates: CostRates
): number | null {
  if (!print.widthCm || !print.heightCm || print.widthCm <= 0 || print.heightCm <= 0) return null;
  if (rates.filmRatePerMeter <= 0 || rates.filmRollWidthCm <= 0) return null;
  const areaCm2 = print.widthCm * print.heightCm * Math.max(0, qty);
  const meters = areaCm2 / (rates.filmRollWidthCm * 100);
  return meters * rates.filmRatePerMeter;
}

/** ค่าแรง+โสหุ้ยเหมาต่อชิ้น × จำนวน */
export function estimateLaborOverhead(qty: number, rates: CostRates): number {
  return Math.max(0, qty) * (rates.laborPerPiece + rates.overheadPerPiece);
}
