// แท็บของฟอร์มออเดอร์ (หน้าเปิดงานใหม่ — และต่อไปคือโหมดแก้ไขด้วย)
// แยกเป็น pure ให้ test ได้ เพราะจุดเขียว/จุดแดงคือกลไกกันพังของการเปลี่ยนเป็นแท็บ
//
// ⚠️ กติกาที่ห้ามแยกทำ (เบสเคาะ 2026-08-11 จาก mockup):
// พอเนื้อหาถูกซ่อนหลังแท็บ "กดบันทึกแล้วไม่มีอะไรเกิดขึ้น" กลายเป็นอาการที่เป็นไปได้ทันที
// เพราะข้อความ error ชี้ไปที่ช่องในแท็บที่คนกดมองไม่เห็น → ต้องมี 2 อย่างคู่กันเสมอ:
//   1. จุดแดงบนหัวแท็บที่มีปัญหา (TabsTrigger รองรับผ่าน prop hasPending อยู่แล้ว)
//   2. กดบันทึกแล้วเด้งไปแท็บแรกที่ติดให้เอง
// ทั้งคู่ใช้ผลจาก validateForm() ตัวเดิม — **ห้ามเขียนกฎ "ครบ/ไม่ครบ" ขึ้นใหม่ซ้อนของเดิม**

export type OrderFormTabKey = "intake" | "items" | "pricing" | "attachments";

export interface OrderFormTabDef {
  key: OrderFormTabKey;
  label: string;
}

// ลำดับและชื่อ = 4 ช่วงเดิมของหน้าเปิดงานเป๊ะ (เบสเคาะโครงนี้ 2026-08-03)
// รอบนี้เปลี่ยนแค่ "กลไกนำทาง" จากแถบกระโดด → แท็บ ไม่ได้ย้ายของข้ามช่วง
export const ORDER_FORM_TABS: OrderFormTabDef[] = [
  { key: "intake", label: "รับเรื่อง" },
  { key: "items", label: "รายการงาน" },
  { key: "pricing", label: "ราคาและเงื่อนไข" },
  { key: "attachments", label: "ไฟล์แนบ" },
];

export const ORDER_FORM_DEFAULT_TAB: OrderFormTabKey = "intake";

/** ข้อผิดพลาด 1 ข้อ + แท็บที่ต้องไปแก้ (validateForm ติดป้ายตอน push ไม่ได้เพิ่มเงื่อนไขใหม่) */
export interface OrderFormError {
  tab: OrderFormTabKey;
  message: string;
}

export function normalizeOrderFormTab(value: string | null): OrderFormTabKey | null {
  return ORDER_FORM_TABS.some((t) => t.key === value) ? (value as OrderFormTabKey) : null;
}

/** สถานะที่ต้องมีข้อมูลอยู่แล้วถึงจะขึ้นจุดเขียว — ค่าบูลีนชุดเดียวกับแถบขั้นตอนเดิม */
export interface OrderFormFilled {
  /** เลือกลูกค้าแล้ว (ช่องบังคับช่องเดียวของทั้งฟอร์ม) */
  intake: boolean;
  /** มีเนื้อรายการอย่างน้อย 1 ชุด */
  items: boolean;
  /** ยอดรวมมากกว่า 0 (เป็น 0 เสมอถ้ายังไม่มีรายการ) */
  pricing: boolean;
  /** แนบไฟล์อ้างอิงแล้ว */
  attachments: boolean;
}

export interface OrderFormTabMark extends OrderFormTabDef {
  /** มีข้อมูลแล้ว */
  green: boolean;
  /** มีที่ต้องแก้ — โผล่หลังกดบันทึกครั้งแรกเท่านั้น (ไม่ด่าคนตั้งแต่ยังไม่ได้กรอก) */
  red: boolean;
  /** ข้อความที่ติดอยู่ในแท็บนี้ — ใช้เป็น aria-label ของหัวแท็บ */
  errors: string[];
}

/**
 * รวมสถานะของทุกแท็บไว้ที่เดียว
 *
 * แดงชนะเขียวเสมอ — แท็บที่ "มีข้อมูลแต่ข้อมูลผิด" ไม่ใช่แท็บที่เสร็จแล้ว
 * ถ้าปล่อยให้เขียวทับ คนจะเห็นจุดเขียวครบ 4 แท็บแล้วงงว่าทำไมกดบันทึกไม่ผ่าน
 */
export function buildOrderFormTabMarks(params: {
  filled: OrderFormFilled;
  errors: readonly OrderFormError[];
  /** ยังไม่เคยกดบันทึก = ไม่ต้องขึ้นจุดแดง */
  submitted: boolean;
}): OrderFormTabMark[] {
  const { filled, errors, submitted } = params;

  return ORDER_FORM_TABS.map((tab) => {
    const tabErrors = submitted
      ? errors.filter((e) => e.tab === tab.key).map((e) => e.message)
      : [];
    return {
      ...tab,
      errors: tabErrors,
      red: tabErrors.length > 0,
      green: tabErrors.length === 0 && filled[tab.key],
    };
  });
}

/** แท็บแรกที่ติด — ใช้เด้งไปให้เองตอนกดบันทึกแล้วไม่ผ่าน · ไม่มีปัญหา = null */
export function firstErrorTab(
  errors: readonly OrderFormError[],
): OrderFormTabKey | null {
  for (const tab of ORDER_FORM_TABS) {
    if (errors.some((e) => e.tab === tab.key)) return tab.key;
  }
  return null;
}
